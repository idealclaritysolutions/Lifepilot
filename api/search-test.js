export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const apiKey = process.env.SERPER_API_KEY;
  const keyPreview = apiKey ? apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4) : 'NOT SET';

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'best blender under 100', num: 2 }),
    });
    const data = await response.json();
    
    return res.status(200).json({
      provider: 'Serper.dev',
      keyPreview,
      status: response.status,
      resultCount: data.organic?.length || 0,
      shoppingCount: data.shopping?.length || 0,
      firstResult: data.organic?.[0] ? { title: data.organic[0].title, link: data.organic[0].link } : null,
      error: data.message || null,
    });
  } catch (err) {
    return res.status(200).json({ keyPreview, error: err.message });
  }
}
