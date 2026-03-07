import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export function IOSInstallPrompt() {
  const [show, setShow] = useState(false)
  const [browser, setBrowser] = useState<'safari' | 'chrome' | 'other'>('safari')

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem('lp-ios-install-dismissed')

    if (isIOS && !isStandalone && !dismissed) {
      const ua = navigator.userAgent
      if (/CriOS/.test(ua)) setBrowser('chrome')
      else if (/Safari/.test(ua) && !/Chrome/.test(ua)) setBrowser('safari')
      else setBrowser('other')
      setTimeout(() => setShow(true), 4000)
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem('lp-ios-install-dismissed', '1')
  }

  if (!show) return null

  const shareIcon = (
    <span className="inline-flex items-center mx-0.5 align-middle" style={{ position: 'relative', top: '-1px' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
    </span>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 pb-6" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={dismiss}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center shadow-sm">
                <span className="text-lg">✦</span>
              </div>
              <div>
                <p className="font-bold text-stone-800 text-[15px]">Install LifePilot</p>
                <p className="text-[11px] text-stone-500">Get notifications, voice shortcuts & more</p>
              </div>
            </div>
            <button onClick={dismiss} className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-3">How to install:</p>

          {browser === 'chrome' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-none">
                  <span className="text-xs font-bold text-blue-600">1</span>
                </div>
                <p className="text-sm text-stone-700 pt-0.5">Tap the {shareIcon} <strong>Share</strong> icon in Chrome</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-none">
                  <span className="text-xs font-bold text-blue-600">2</span>
                </div>
                <p className="text-sm text-stone-700 pt-0.5">Tap <strong>"Add to Home Screen"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-none">
                  <span className="text-xs font-bold text-blue-600">3</span>
                </div>
                <p className="text-sm text-stone-700 pt-0.5">Tap <strong>"Add"</strong> to confirm</p>
              </div>
            </div>
          ) : browser === 'safari' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-none">
                  <span className="text-xs font-bold text-blue-600">1</span>
                </div>
                <p className="text-sm text-stone-700 pt-0.5">Tap the {shareIcon} <strong>Share</strong> button at the bottom of Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-none">
                  <span className="text-xs font-bold text-blue-600">2</span>
                </div>
                <p className="text-sm text-stone-700 pt-0.5">Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-none">
                  <span className="text-xs font-bold text-blue-600">3</span>
                </div>
                <p className="text-sm text-stone-700 pt-0.5">Tap <strong>"Add"</strong> in the top right</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-600">Open this page in <strong>Safari</strong> for the best install experience.</p>
          )}

          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[11px] text-amber-700 leading-relaxed">
              <strong>Why install?</strong> You'll get push notifications for reminders, a home screen icon for quick access, and the app runs full-screen like a native app.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={dismiss}
            className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-600 text-sm font-medium">
            Not now
          </button>
          <button onClick={dismiss}
            className="flex-1 py-3 rounded-xl bg-stone-800 text-white text-sm font-medium">
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  )
}
