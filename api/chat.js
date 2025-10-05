// api/chat.js
// Chat proxy that also pulls live classes from Google Sheet and injects them into the prompt
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  const { messages = [], lang = 'en' } = req.body || {};

  // Pull classes from the same CSV source used by /api/classes
  let classesNote = '';
  try {
    const url = process.env.SHEET_CSV_URL;
    if (url) {
      const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      if (r.ok) {
        const text = await r.text();
        const rows = text.split(/\r?\n/).filter(Boolean).map(l=>l.split(','));
        const [header, ...data] = rows;
        const idx = (name)=> header.findIndex(h => h.trim().toLowerCase() === name);
        const di = idx('date'), ti=idx('time'), ti2=idx('title'), te=idx('teacher'), ur=idx('url');
        const items = data.slice(0,6).map(r=>({date:r[di]||'', time:r[ti]||'', title:r[ti2]||'', teacher:r[te]||'', url:r[ur]||''}));
        if (items.length) {
          classesNote = 'Upcoming classes (from site schedule):\\n' + items.map((it,i)=>`${i+1}. ${it.title} — ${it.date} ${it.time} (${it.teacher}) ${it.url}`).join('\\n');
        }
      }
    }
  } catch {}

  const system = `You are a kind Dharma assistant for a Tibetan Buddhist centre website. Respond in ${lang==='zh'?'Simplified Chinese':'English'}. Be concise, calm, and practical. If users ask about classes or schedule, use this context if relevant. ${classesNote}`;

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages]
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
  const reader = upstream.body.getReader(); const decoder=new TextDecoder(); let buffer='';
  const flush = (line) => { if(!line.startsWith('data:')) return; const payload=line.replace(/^data:\s*/, '').trim(); if(payload==='[DONE]') return;
    try{ const json=JSON.parse(payload); const delta=json.choices?.[0]?.delta?.content||''; if(delta) res.write(delta);}catch{}
  };
  while(true){ const {value, done}=await reader.read(); if(done) break; buffer+=decoder.decode(value,{stream:true}); const parts=buffer.split('\n'); buffer=parts.pop()||''; for(const p of parts) flush(p); }
  res.end();
}
