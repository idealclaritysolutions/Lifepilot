import { useState, useCallback } from 'react'

export interface DocumentAnalysis {
  summary: string
  extractedItems: { text: string; category: string; dueDate?: string }[]
  keyFacts: string[]
}

export function useDocumentUpload() {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzeDocument = useCallback(async (file: File, customPrompt?: string): Promise<DocumentAnalysis | null> => {
    setAnalyzing(true)
    setError(null)

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Strip the data:mime;base64, prefix
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const mediaType = file.type || 'image/jpeg'

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType,
          prompt: customPrompt,
        }),
      })

      if (!res.ok) throw new Error(`Analysis failed: ${res.status}`)
      
      const data = await res.json()
      const rawText = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || ''

      // Parse the AI response
      try {
        const cleaned = rawText.replace(/```(?:json)?\s*\n?/g, '').replace(/\n?```/g, '').trim()
        const firstBrace = cleaned.indexOf('{')
        const lastBrace = cleaned.lastIndexOf('}')
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1))
          setAnalyzing(false)
          return {
            summary: parsed.summary || 'Document analyzed',
            extractedItems: Array.isArray(parsed.extractedItems) ? parsed.extractedItems : [],
            keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
          }
        }
      } catch {}

      // Fallback: return raw text as summary
      setAnalyzing(false)
      return { summary: rawText, extractedItems: [], keyFacts: [] }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze document')
      setAnalyzing(false)
      return null
    }
  }, [])

  return { analyzeDocument, analyzing, error }
}
