import { isNative } from './native'

/**
 * Base URL for the app's own API routes.
 *
 * On the web the app is served from getlifepilot.app, so relative
 * '/api/...' URLs work. Inside the native Capacitor app the WebView
 * is served from localhost, so a relative '/api/chat' would hit the
 * phone itself (and fail) instead of the real backend. On native we
 * must use the absolute production origin — which is why api/chat.js
 * also allows the Capacitor origins through CORS.
 */
export function apiBase(): string {
  try {
    return isNative() ? 'https://getlifepilot.app' : ''
  } catch {
    return ''
  }
}
