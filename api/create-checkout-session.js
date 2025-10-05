// api/create-checkout-session.js
// Creates a Stripe Checkout Session for preset prices, supporting one-time or subscription.
// Env:
//  - STRIPE_SECRET_KEY
//  - STRIPE_PRICE_GENERAL, STRIPE_PRICE_EDUCATION, STRIPE_PRICE_LIBRARY, STRIPE_PRICE_COMPASSION
//  - STRIPE_PRICE_GENERAL_SUB, STRIPE_PRICE_EDUCATION_SUB, STRIPE_PRICE_LIBRARY_SUB, STRIPE_PRICE_COMPASSION_SUB
export default async function handler(req, res){
  if(req.method !== 'POST'){ res.setHeader('Allow','POST'); return res.status(405).end('Method Not Allowed'); }
  const key = process.env.STRIPE_SECRET_KEY;
  if(!key) return res.status(200).json({ error:'Stripe not configured' });
  const priceMap = {
    payment: {
      general: process.env.STRIPE_PRICE_GENERAL,
      education: process.env.STRIPE_PRICE_EDUCATION,
      library: process.env.STRIPE_PRICE_LIBRARY,
      compassion: process.env.STRIPE_PRICE_COMPASSION
    },
    subscription: {
      general: process.env.STRIPE_PRICE_GENERAL_SUB,
      education: process.env.STRIPE_PRICE_EDUCATION_SUB,
      library: process.env.STRIPE_PRICE_LIBRARY_SUB,
      compassion: process.env.STRIPE_PRICE_COMPASSION_SUB
    }
  };
  const { priceKey='general', mode='payment' } = req.body || {};
  const price = (priceMap[mode] || priceMap.payment)[priceKey];
  if(!price) return res.status(200).json({ error: 'Price not set for this fund/mode' });
  try{
    const body = new URLSearchParams({
      mode,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: req.headers.origin ? `${req.headers.origin}/?success=true` : 'https://example.org/?success=true',
      cancel_url: req.headers.origin ? `${req.headers.origin}/?canceled=true` : 'https://example.org/?canceled=true'
    });
    const upstream = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    const js = await upstream.json();
    return res.status(200).json({ url: js.url, id: js.id });
  }catch(e){
    return res.status(200).json({ error: 'Unable to create session' });
  }
}
