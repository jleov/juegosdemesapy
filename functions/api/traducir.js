// Cloudflare Pages Function: /api/traducir
// Traduce al español las frases de los subtítulos de las Salas.
// Si el proyecto tiene el enlace de Workers AI llamado "AI" usa el traductor de Cloudflare;
// si no, usa el traductor público de Google. Las dos opciones son gratis.
const ALLOWED = [/^https:\/\/juegosdemesapy\.pages\.dev$/, /^https:\/\/[a-z0-9-]+\.juegosdemesapy\.pages\.dev$/, /^https:\/\/jleov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/];

export async function onRequest({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const from = origin || (referer.match(/^https?:\/\/[^/]+/) || [''])[0];
  const okOrigin = ALLOWED.some(r => r.test(from));
  const cors = {
    'Access-Control-Allow-Origin': okOrigin ? from : 'https://juegosdemesapy.pages.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const json = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (!okOrigin) return json({ error: 'origen no permitido' }, 403);
  if (request.method !== 'POST') return json({ error: 'usar POST' }, 405);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'pedido inválido' }, 400); }
  const text = String(body.text || '').slice(0, 600).trim();
  const lang = /^[a-z]{2}$/.test(body.from || '') ? body.from : '';
  if (!text) return json({ text: '' }, 200);

  if (env.AI && lang) {
    try {
      const r = await env.AI.run('@cf/meta/m2m100-1.2b', { text, source_lang: lang, target_lang: 'es' });
      if (r && r.translated_text) return json({ text: r.translated_text, via: 'cloudflare' }, 200);
    } catch (e) { /* si falla, se prueba con Google */ }
  }
  try {
    const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&tl=es&sl=' + (lang || 'auto') + '&q=' + encodeURIComponent(text);
    const r = await fetch(u);
    if (!r.ok) throw new Error('google ' + r.status);
    const d = await r.json();
    const out = (d[0] || []).map(p => p[0]).join('');
    return json({ text: out, via: 'google' }, 200);
  } catch (e) {
    return json({ error: 'no se pudo traducir' }, 502);
  }
}
