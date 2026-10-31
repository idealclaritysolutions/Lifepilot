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
  /** Stops listening. Resolves with the final transcript (or null) once it has arrived. */
  stop: () => Promise<string | null>
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
        handlers.onError?.('Speech recognition is not available on this device. Make sure the Google app is installed and up to date, then try again.')
        return null
      }
      const perm = await SpeechRecognition.requestPermissions()
      if ((perm as { speechRecognition?: string }).speechRecognition !== 'granted') {
        handlers.onError?.('Microphone permission was not granted. Allow microphone access in Settings > Apps > Life Pilot AI > Permissions, then try again.')
        return null
      }
      // FINAL-ONLY mode (partialResults: false) — deliberate, and the
      // fix for the build-6 "blinks forever, nothing captured" glitch.
      // In partial mode this plugin resolves start() the moment
      // listening begins, and then every recognizer error (no match,
      // timeout, network, busy) rejects an already-settled call — a
      // no-op — so JS hears nothing: no transcript, no error, and the
      // UI blinks forever. In final mode the start() promise settles
      // exactly once: matches on success, rejection on error.
      // Cost: no live interim text on native (text lands when the
      // utterance finalizes). Single-utterance dictation, which is
      // what the journal/chat flows already assume.
      let settled = false
      let lastTranscript: string | null = null
      let releaseSettled: (() => void) | null = null
      const settledPromise = new Promise<void>((res) => { releaseSettled = res })
      const markSettled = () => { if (!settled) { settled = true; releaseSettled?.() } }
      SpeechRecognition.start({
        language,
        maxResults: 1,
        partialResults: false,
        popup: false,
      }).then((result) => {
        const text = (result as { matches?: string[] } | undefined)?.matches?.[0]
        if (text) {
          lastTranscript = text
          handlers.onTranscript(text, true)
        }
        markSettled()
        handlers.onEnd?.()
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : '')
        handlers.onError?.(msg || 'Speech recognition failed. Try again.')
        markSettled()
        handlers.onEnd?.()
      })
      return {
        stop: async () => {
          if (settled) return lastTranscript
          // NOTE: the plugin's stop() never resolves its own call, so
          // never await it unbounded — fire it and wait for the start
          // promise to settle (stopListening() delivers onResults /
          // onError, which settles it), bounded by a timeout.
          try { SpeechRecognition.stop().catch(() => {}) } catch { /* ignore */ }
          await Promise.race([settledPromise, new Promise((r) => setTimeout(r, 3000))])
          if (!settled) { markSettled(); handlers.onEnd?.() }
          return lastTranscript
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
    stop: async () => null,
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
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    await LocalNotifications.requestPermissions()

    // Push registration is DELIBERATELY skipped until Firebase is
    // configured (google-services.json + FCM project). The push
    // plugin's register() calls FirebaseMessaging.getInstance(),
    // which throws when no default FirebaseApp exists — on build 2
    // that crashed the app on launch. Re-enable push registration
    // once FCM is set up; server-side push delivery doesn't exist
    // yet anyway, so nothing is lost by waiting.
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
