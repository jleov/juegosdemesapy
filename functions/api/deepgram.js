// Cloudflare Pages Function: /api/deepgram
// Entrega a las Salas un permiso de 1 minuto para abrir los subtítulos en vivo de Deepgram,
// así la clave de Deepgram nunca llega al navegador.
// Necesita en el proyecto de Cloudflare Pages la variable secreta DEEPGRAM_KEY, con una clave
// de Deepgram de permiso «Member» (DEEPGRAM_API_KEY quedó con una clave sin ese permiso).
const ALLOWED = [/^https:\/\/juegosdemesapy\.pages\.dev$/, /^https:\/\/[a-z0-9-]+\.juegosdemesapy\.pages\.dev$/, /^https:\/\/jleov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/];

export async function onRequest({ request, env }) {
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
  const json = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (!okOrigin) return json({ error: 'origen no permitido' }, 403);
  // DEEPGRAM_KEY: clave con permiso «Member» (la que permite dar permisos temporales)
  const key = env.DEEPGRAM_KEY || env.DEEPGRAM_API_KEY;
  if (!key) return json({ error: 'falta configurar DEEPGRAM_KEY' }, 503);
  const r = await fetch('https://api.deepgram.com/v1/auth/grant', {
    method: 'POST',
    headers: { 'Authorization': `Token ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl_seconds: 60 }),
  });
  if (!r.ok) return json({ error: 'Deepgram no dio el permiso', status: r.status, detalle: (await r.text()).slice(0, 300) }, 502);
  const d = await r.json();
  return json({ token: d.access_token, expires_in: d.expires_in }, 200);
}
