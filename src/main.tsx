import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/lib/auth'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'
import App from './App.tsx'

// Global error handler
window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root && !root.children.length) {
    root.innerHTML = `<div style="padding:20px;font-family:sans-serif;color:#333">
      <h2>Life Pilot AI couldn't load</h2>
      <p style="color:#888">${e.message}</p>
      <p style="font-size:12px;color:#aaa">${e.filename}:${e.lineno}</p>
      <button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;background:#F59E0B;color:white;border:none;border-radius:8px">Retry</button>
    </div>`
  }
})

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </StrictMode>,
  )
} catch (e: any) {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<div style="padding:20px;font-family:sans-serif;color:#333">
      <h2>Life Pilot AI couldn't start</h2>
      <p style="color:#888">${e?.message || 'Unknown error'}</p>
      <button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;background:#F59E0B;color:white;border:none;border-radius:8px">Retry</button>
    </div>`
  }
}
