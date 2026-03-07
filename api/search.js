// Web Search API using Serper.dev (Google search results)

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://getlifepilot.app', 'http://localhost:5173', 'http://localhost:4173'];
  const isAllowed = allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('vercel.app');
  
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Search not configured' });
  }

  try {
    const { query, num = 5 } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'No search query provided' });
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query.trim(),
        num: Math.min(Math.max(num, 1), 10),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Search API] Serper error:', response.status, JSON.stringify(data));
      return res.status(response.status).json({ error: data.message || 'Search failed', details: data });
    }

    // Format results to match our existing client-side expectations
    const organic = data.organic || [];
    const shopping = data.shopping || [];
    
    const results = organic.map(item => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      displayLink: item.link ? new URL(item.link).hostname : '',
      price: null,
      image: null,
    }));

    // Add shopping results with prices if available
    shopping.slice(0, 3).forEach(item => {
      results.push({
        title: item.title || '',
        link: item.link || '',
        snippet: item.source ? `${item.source} — ${item.price || ''}` : '',
        displayLink: item.link ? new URL(item.link).hostname : '',
        price: item.price || null,
        image: item.imageUrl || null,
      });
    });

    return res.status(200).json({
      results: results.slice(0, num),
      totalResults: data.searchParameters?.totalResults || String(results.length),
      searchTime: 0,
    });

  } catch (err) {
    console.error('[Search API] Exception:', err.message);
    return res.status(500).json({ error: 'Search request failed: ' + err.message });
  }
}
