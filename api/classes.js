// api/classes.js
// Reads a public Google Sheet CSV and returns a simple JSON list.
// Env: SHEET_CSV_URL
export default async function handler(req, res){
  const url = process.env.SHEET_CSV_URL;
  if(!url) return res.status(200).json([]);
  try{
    const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    if(!r.ok) throw new Error('fetch failed');
    const text = await r.text();
    // Expect columns: date,time,title,teacher,url
    const rows = text.split(/\r?\n/).filter(Boolean).map(l=>l.split(','));
    const [header, ...data] = rows;
    const idx = (name)=> header.findIndex(h => h.trim().toLowerCase() === name);
    const di = idx('date'), ti=idx('time'), ti2=idx('title'), te=idx('teacher'), ur=idx('url');
    const items = data.map(r=>({ date:r[di]||'', time:r[ti]||'', title:r[ti2]||'', teacher:r[te]||'', url:r[ur]||'' }));
    res.status(200).json(items);
  }catch(e){
    res.status(200).json([]);
  }
}
