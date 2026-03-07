// Document reader — upload photos/documents for AI to extract info

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Extract base64 data after the comma
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function getMediaType(file: File): string {
  const type = file.type
  if (type.startsWith('image/')) return type
  if (type === 'application/pdf') return type
  // Default to jpeg for camera captures
  return 'image/jpeg'
}

export interface DocumentContent {
  base64: string
  mediaType: string
  fileName: string
}

export async function processFile(file: File): Promise<DocumentContent> {
  const base64 = await fileToBase64(file)
  return {
    base64,
    mediaType: getMediaType(file),
    fileName: file.name,
  }
}
