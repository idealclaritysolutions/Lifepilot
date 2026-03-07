import { useState, useEffect } from 'react'

export function useDeepLink() {
  const [initialTab, setInitialTab] = useState<string | null>(null)
  const [initialAction, setInitialAction] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const action = params.get('action')
    if (action === 'journal-voice' || action === 'journal') {
      setInitialTab('journal')
      setInitialAction(action)
    }
    // Clean URL
    if (action) {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  return { initialTab, initialAction }
}
