// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  const { messages = [], lang = 'en' } = req.body || {};

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      stream: true,
      messages: [
        { role: 'system', content: `Respond in ${lang==='zh'?'Simplified Chinese':'English'}.` },
        ...messages
      ]
    })
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(()=>'');
    return res.status(500).send(text || 'Upstream error');
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer='';
  const flush = (line) => {
    if (!line.startsWith('data:')) return;
    const payload = line.replace(/^data:\s*/, '').trim();
    if (payload === '[DONE]') return;
    try {
      const json = JSON.parse(payload);
      const delta = json.choices?.[0]?.delta?.content || '';
      if (delta) res.write(delta);
    } catch {}
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n'); buffer = parts.pop() || '';
    for (const p of parts) flush(p);
  }
  res.end();
}
