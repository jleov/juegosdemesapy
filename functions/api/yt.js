// Cloudflare Pages Function: /api/yt
// Buscador de videos de YouTube para la Sala de Karaoke (sin clave de la API de Google).
//   /api/yt?q=texto  → lista de videos [{id, title, ch, dur}]
//   /api/yt?id=XXXX  → nombre de un video {id, title, ch}
// Primero pregunta al buscador interno de youtube.com; si falla, lee la página de resultados.
const ALLOWED = [/^https:\/\/juegosdemesapy\.pages\.dev$/, /^https:\/\/[a-z0-9-]+\.juegosdemesapy\.pages\.dev$/, /^https:\/\/jleov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export async function onRequest({ request }) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const from = origin || (referer.match(/^https?:\/\/[^/]+/) || [''])[0];
  const okOrigin = ALLOWED.some(r => r.test(from));
  const cors = {
    'Access-Control-Allow-Origin': okOrigin ? from : 'https://juegosdemesapy.pages.dev',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const json = (obj, status = 200, cache = 'no-store') => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': cache } });
  if (!okOrigin) return json({ error: 'origen no permitido' }, 403);

  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);

  if (id) {
    if (!/^[\w-]{11}$/.test(id)) return json({ error: 'id inválido' }, 400);
    try {
      const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id), { headers: { 'User-Agent': UA } });
      if (!r.ok) return json({ id, title: '', error: 'no se puede insertar' }, 200);
      const d = await r.json();
      return json({ id, title: d.title || '', ch: d.author_name || '' }, 200, 'public, max-age=86400');
    } catch (e) { return json({ id, title: '' }); }
  }
  if (!q) return json({ error: 'falta q' }, 400);

  let list = [];
  try { list = await innertube(q); } catch (e) {}
  if (!list.length) { try { list = await page(q); } catch (e) {} }
  if (!list.length) return json({ error: 'YouTube no contestó', list: [] }, 502);
  return json({ list: list.slice(0, 25) }, 200, 'public, max-age=1800');
}

async function innertube(q) {
  const r = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Accept-Language': 'es-419,es;q=0.9', 'Origin': 'https://www.youtube.com' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20241001.00.00', hl: 'es-419', gl: 'PY' } },
      query: q, params: 'EgIQAQ%3D%3D',   // solo videos
    }),
  });
  if (!r.ok) return [];
  return collect(await r.json());
}

async function page(q) {
  const r = await fetch('https://www.youtube.com/results?sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q), {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-419,es;q=0.9', 'Cookie': 'CONSENT=YES+1; SOCS=CAI' },
  });
  if (!r.ok) return [];
  const html = await r.text();
  const m = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!m) return [];
  return collect(JSON.parse(m[1]));
}

// recorre la respuesta de YouTube buscando los videos
function collect(root) {
  const out = [], seen = new Set();
  const txt = t => t ? (t.simpleText || (t.runs || []).map(x => x.text).join('')) : '';
  const walk = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 40 || out.length >= 30) return;
    if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
    const v = o.videoRenderer;
    if (v && v.videoId && !seen.has(v.videoId)) {
      seen.add(v.videoId);
      const live = (v.badges || []).some(b => /LIVE/.test(JSON.stringify(b))) || !v.lengthText;
      if (!live) out.push({ id: v.videoId, title: txt(v.title), ch: txt(v.ownerText || v.longBylineText), dur: txt(v.lengthText) });
      return;
    }
    for (const k in o) walk(o[k], depth + 1);
  };
  walk(root, 0);
  return out;
}
