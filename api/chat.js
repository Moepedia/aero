export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const upstream = await fetch('https://keylessai.thryx.workers.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream error: ${upstream.status}`,
        detail: text.slice(0, 500),
      });
    }

    // Try parse JSON; if it fails, return raw text
    try {
      return res.status(200).json(JSON.parse(text));
    } catch {
      return res.status(200).json({
        choices: [{ message: { content: text } }],
      });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Proxy failure' });
  }
}
