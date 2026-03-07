// Rate limiting
const rateLimits = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now - record.windowStart > 60000) {
    rateLimits.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  record.count++;
  return record.count <= 10; // 10 analyze requests per minute
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = origin.includes('vercel.app') || origin.includes('localhost');
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : 'https://getlifepilot.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { imageBase64, mediaType, prompt } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image data provided' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: prompt || 'Analyze this document. Extract all important information. Return JSON: {"summary":"...","extractedItems":[{"text":"...","category":"meal|health|finance|home|family|errand|general","dueDate":"YYYY-MM-DD or null"}],"keyFacts":["..."]}' }
      ]
    }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages,
        system: 'You are LifePilot, analyzing a document. Extract ALL actionable information. Return JSON with summary, extractedItems, and keyFacts.',
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      const retry = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 2000, messages, system: 'Analyze document. Return JSON.' }),
      });
      const retryText = await retry.text();
      if (retry.ok) return res.status(200).json(JSON.parse(retryText));
      return res.status(retry.status).json({ error: retryText });
    }

    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    return res.status(500).json({ error: String(err.message) });
  }
}
