// Cloudflare Pages Function: /api/turn
// Entrega a los juegos permisos temporales para usar el servidor de respaldo (TURN) de Cloudflare.
// Sirve cuando dos aparatos no se pueden conectar directo (datos móviles, algunos routers).
// Necesita en el proyecto de Cloudflare Pages las variables TURN_KEY_ID y TURN_KEY_API_TOKEN.
const ALLOWED = [/^https:\/\/(www\.)?juegospy\.com$/, /^https:\/\/juegosdemesapy\.pages\.dev$/, /^https:\/\/[a-z0-9-]+\.juegosdemesapy\.pages\.dev$/, /^https:\/\/jleov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/];

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
  // solo los juegos de este sitio pueden pedir permisos
  if (!okOrigin) return json({ error: 'origen no permitido' }, 403);
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ error: 'falta configurar TURN_KEY_ID y TURN_KEY_API_TOKEN' }, 503);
  const ttl = 6 * 3600;   // los permisos duran 6 horas
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl }),
  });
  if (!r.ok) return json({ error: 'Cloudflare no dio los permisos', status: r.status }, 502);
  const d = await r.json();
  const list = [].concat(d.iceServers || [])
    // los navegadores bloquean el puerto 53: se sacan esas direcciones
    .map(s => ({ ...s, urls: [].concat(s.urls || []).filter(u => !/:53(\?|$)/.test(u)) }))
    .filter(s => s.urls.length);
  return json({ iceServers: list, ttl }, 200);
}
