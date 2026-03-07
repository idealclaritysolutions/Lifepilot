// Rate limiting store (in-memory, resets on cold start — fine for serverless)
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 15; // 15 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    rateLimits.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  record.count++;
  if (record.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Generate a simple HMAC-like token that only our app knows how to create
function validateAppToken(token) {
  if (!token) return false;
  // The token is a hash of the current hour + a secret salt
  // This rotates hourly, so stolen tokens expire quickly
  const salt = 'lifepilot-2026-app-verify';
  const hour = Math.floor(Date.now() / 3600000);
  const expected = simpleHash(salt + hour);
  const prevExpected = simpleHash(salt + (hour - 1)); // Accept previous hour too
  return token === expected || token === prevExpected;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export default async function handler(req, res) {
  // CORS — restrict to known origins in production
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://getlifepilot.app', 'http://localhost:5173', 'http://localhost:4173'];
  const isAllowed = allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('vercel.app');
  
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  // App token validation (soft check — warn but allow for now during transition)
  const appToken = req.headers['x-app-token'];
  if (!validateAppToken(appToken)) {
    // Log but don't block yet — enable strict mode after testing
    console.warn(`Invalid app token from ${ip}: ${appToken}`);
  }

  try {
    const { messages, system, image } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    // Clean messages
    const clean = messages
      .filter(m => m && m.content && String(m.content).trim())
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).trim() }));

    const deduped = [];
    for (const msg of clean) {
      if (deduped.length > 0 && deduped[deduped.length - 1].role === msg.role) {
        deduped[deduped.length - 1].content += '\n' + msg.content;
      } else {
        deduped.push({ ...msg });
      }
    }

    while (deduped.length && deduped[0].role !== 'user') deduped.shift();
    while (deduped.length && deduped[deduped.length - 1].role !== 'user') deduped.pop();
    if (!deduped.length) return res.status(400).json({ error: 'No valid messages' });

    if (image && image.base64 && image.mediaType) {
      const lastUserIdx = deduped.length - 1;
      deduped[lastUserIdx] = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
          { type: 'text', text: deduped[lastUserIdx].content },
        ],
      };
    }

    const body = { model: 'claude-sonnet-4-20250514', max_tokens: 1200, messages: deduped };
    if (system && String(system).trim()) body.system = String(system).trim();

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const text = await apiRes.text();

    if (!apiRes.ok) {
      body.model = 'claude-3-5-sonnet-20241022';
      const retry = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
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
