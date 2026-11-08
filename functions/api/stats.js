// Cloudflare Pages Function: /api/stats
// Cuenta cuánto se usa cada juego para el panel del dueño (gráfico de los más jugados).
//   POST /api/stats  {g:'banquero', e:'v'|'p'}   → suma una entrada (v) o una partida empezada (p)
//   GET  /api/stats?dias=30&ts=...&sig=...       → números por día y por juego (solo el dueño:
//        la firma sale de la contraseña del dueño, la misma llave del panel)
// Necesita una base D1 conectada al proyecto de Cloudflare Pages con el nombre de variable DB.
// No guarda nada de las personas: solo el día, el juego y cuántas veces.
const ALLOWED = [/^https:\/\/(www\.)?juegospy\.com$/, /^https:\/\/juegosdemesapy\.pages\.dev$/, /^https:\/\/[a-z0-9-]+\.juegosdemesapy\.pages\.dev$/, /^https:\/\/jleov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/];
const JUEGOS = ['portada', 'banquero', 'loteria', 'kombate', 'petei', 'escoba', 'impostor', 'tarot', 'versiculo', 'billar', 'bolos', 'minigolf', 'basta', 'tejo', 'botones', 'naval', 'mavapa', 'mavaiko', 'ajedrez', 'salon', 'odisea', 'salas', 'karaoke'];
const OWNER_PUB = { kty: 'EC', crv: 'P-256', x: 'eLdK1LWh1LGyAlt0IW6Apa9bnuRt1LwLi3D1MQtqtHk', y: 'XPx_IfKocm2ZANCG_As4PxsgjToAMnZMEaWlzZWWBKk' };
// día de Paraguay (UTC-3)
const diaPY = (t = Date.now()) => new Date(t - 3 * 3600e3).toISOString().slice(0, 10);
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

let tablaLista = false;
async function tabla(db) {
  if (tablaLista) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS uso (dia TEXT NOT NULL, juego TEXT NOT NULL, visitas INTEGER NOT NULL DEFAULT 0, partidas INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, juego))').run();
  tablaLista = true;
}
async function esDueno(ts, sig) {
  if (!ts || !sig || Math.abs(Date.now() - Number(ts)) > 10 * 60e3) return false;
  try {
    const k = await crypto.subtle.importKey('jwk', OWNER_PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, unb64u(sig), new TextEncoder().encode('stats:' + ts));
  } catch (e) { return false; }
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const from = origin || (referer.match(/^https?:\/\/[^/]+/) || [''])[0];
  const okOrigin = ALLOWED.some(r => r.test(from));
  const cors = {
    'Access-Control-Allow-Origin': okOrigin ? from : 'https://juegospy.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (!okOrigin) return json({ error: 'origen no permitido' }, 403);
  if (!env.DB) return json({ error: 'falta conectar la base D1 con el nombre DB' }, 503);
  const db = env.DB;
  await tabla(db);

  if (request.method === 'POST') {
    let d = null;
    try { d = JSON.parse((await request.text()).slice(0, 200)); } catch (e) {}
    if (!d || !JUEGOS.includes(d.g) || (d.e !== 'v' && d.e !== 'p')) return json({ error: 'datos inválidos' }, 400);
    const v = d.e === 'v' ? 1 : 0, p = d.e === 'p' ? 1 : 0;
    await db.prepare('INSERT INTO uso (dia, juego, visitas, partidas) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (dia, juego) DO UPDATE SET visitas = visitas + excluded.visitas, partidas = partidas + excluded.partidas')
      .bind(diaPY(), d.g, v, p).run();
    return json({ ok: true });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (!(await esDueno(url.searchParams.get('ts'), url.searchParams.get('sig')))) return json({ error: 'solo el dueño' }, 401);
    const dias = Math.max(1, Math.min(3650, parseInt(url.searchParams.get('dias'), 10) || 30));
    const desde = diaPY(Date.now() - (dias - 1) * 86400e3);
    const r = await db.prepare('SELECT dia, juego, visitas, partidas FROM uso WHERE dia >= ?1 ORDER BY dia').bind(desde).all();
    return json({ hoy: diaPY(), desde, filas: r.results || [] });
  }
  return json({ error: 'método no permitido' }, 405);
}
