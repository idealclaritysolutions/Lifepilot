/**
 * native.ts — Capacitor native bridge (store-build prep).
 *
 * Every function in this module is safe to call on the WEB build:
 * all native code paths are guarded by isNative(), and on web the
 * speech helper falls back to the existing browser SpeechRecognition
 * path while notifications no-op (web keeps using the existing
 * web-push / service-worker implementation in lib/notifications.ts,
 * hooks/use-push-subscribe.ts and Settings).
 *
 * INTEGRATION TODO (slot-in points, intentionally NOT wired into the
 * views in this pass — the existing voice code keeps working as-is):
 *  - src/components/ChatView.tsx    (~lines 658 & 734, `const SR = window.SpeechRecognition || window.webkitSpeechRecognition`)
 *  - src/components/JournalView.tsx (~line 414, same pattern)
 *    → replace the direct webkitSpeechRecognition construction with
 *      `startDictation({ onTranscript, onError, onEnd })` from this
 *      module. On native it uses @capacitor-community/speech-recognition
 *      (WKWebView/Android WebView speech support is unreliable);
 *      on web it constructs the same SpeechRecognition as today.
 *  - App startup (src/App.tsx / src/main.tsx) → call
 *      `initNativeNotifications()` once when isNative() so store
 *      builds register for APNs/FCM push + local notifications.
 *      Server-side native push delivery (FCM/APNs send pipeline)
 *      is a separate backend task — registration here only obtains
 *      and logs the device token until that pipeline exists.
 */

import { Capacitor } from '@capacitor/core'

// ─── Platform ───────────────────────────────────────────────────────

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function nativePlatform(): string {
  try {
    return Capacitor.getPlatform() // 'ios' | 'android' | 'web'
  } catch {
    return 'web'
  }
}

// ─── Speech recognition ─────────────────────────────────────────────

export interface DictationHandlers {
  /** Called with the transcript text (final on web, partial-or-final on native). */
  onTranscript: (text: string, isFinal: boolean) => void
  onError?: (message: string) => void
  onEnd?: () => void
}

export interface DictationSession {
  stop: () => Promise<void>
}

/**
 * Start dictation. Native → @capacitor-community/speech-recognition.
 * Web → the same window.SpeechRecognition / webkitSpeechRecognition
 * construction ChatView and JournalView use today.
 * Returns null (and calls onError) when speech is unavailable.
 */
export async function startDictation(
  handlers: DictationHandlers,
  opts: { language?: string } = {},
): Promise<DictationSession | null> {
  const language = opts.language || 'en-US'

  if (isNative()) {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
      const avail = await SpeechRecognition.available()
      if (!avail.available) {
        handlers.onError?.('Speech recognition is not available on this device.')
        return null
      }
      const perm = await SpeechRecognition.requestPermissions()
      if ((perm as { speechRecognition?: string }).speechRecognition !== 'granted') {
        handlers.onError?.('Microphone / speech permission was not granted.')
        return null
      }
      let stopped = false
      const partialHandle = await SpeechRecognition.addListener('partialResults', (data) => {
        const text = data.matches?.[0]
        if (text) handlers.onTranscript(text, false)
      })
      const endListener = (SpeechRecognition as unknown as {
        addListener: (e: string, cb: () => void) => Promise<{ remove: () => Promise<void> }>
      }).addListener('listeningState', () => { /* state changes handled via stop() */ })
      void endListener
      await SpeechRecognition.start({
        language,
        maxResults: 1,
        partialResults: true,
        popup: false,
      })
      return {
        stop: async () => {
          if (stopped) return
          stopped = true
          try { await SpeechRecognition.stop() } catch { /* already stopped */ }
          try { await partialHandle.remove() } catch { /* noop */ }
          handlers.onEnd?.()
        },
      }
    } catch (err) {
      handlers.onError?.(err instanceof Error ? err.message : 'Native speech recognition failed.')
      return null
    }
  }

  // Web fallback — identical API surface to the existing inline code.
  const SR = (window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }).SpeechRecognition || (window as unknown as {
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }).webkitSpeechRecognition
  if (!SR) {
    handlers.onError?.('Speech recognition is not supported in this browser.')
    return null
  }
  const recognition = new SR()
  recognition.lang = language
  recognition.interimResults = true
  recognition.continuous = false
  recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
    const result = event.results[event.results.length - 1]
    if (result) handlers.onTranscript(result[0]?.transcript ?? '', result.isFinal)
  }
  recognition.onerror = (event: { error?: string }) => {
    handlers.onError?.(event.error || 'Speech recognition error.')
  }
  recognition.onend = () => handlers.onEnd?.()
  recognition.start()
  return {
    stop: async () => {
      try { recognition.stop() } catch { /* already stopped */ }
    },
  }
}

// Minimal structural types for the Web Speech API (not in TS DOM lib everywhere).
interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

// ─── Notifications (native only; web no-ops) ────────────────────────

/**
 * Register for native push + local notifications on store builds.
 * On web this is a deliberate no-op: the web app already handles
 * notifications through the service worker + web-push pipeline.
 */
export async function initNativeNotifications(): Promise<void> {
  if (!isNative()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    await LocalNotifications.requestPermissions()

    const perm = await PushNotifications.requestPermissions()
    if (perm.receive === 'granted') {
      await PushNotifications.addListener('registration', (token) => {
        // TODO(backend): send token.value to the server once an
        // APNs/FCM delivery pipeline exists (today the server only
        // speaks web-push). Stored locally so it can be picked up then.
        try { localStorage.setItem('lp-native-push-token', token.value) } catch { /* noop */ }
      })
      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[native] Push registration error:', err)
      })
      await PushNotifications.register()
    }
  } catch (err) {
    console.error('[native] Notification init failed:', err)
  }
}

/** Schedule a one-off local notification on native; no-op on web. */
export async function scheduleNativeLocalNotification(opts: {
  id?: number
  title: string
  body: string
  at: Date
}): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: [{
        id: opts.id ?? Math.floor(Math.random() * 2_000_000_000),
        title: opts.title,
        body: opts.body,
        schedule: { at: opts.at },
      }],
    })
    return true
  } catch (err) {
    console.error('[native] Local notification failed:', err)
    return false
  }
}
