// Cloudflare Pages Function: /api/stats
// Cuenta cuánto se usa cada juego para el panel del dueño (gráfico de los más jugados).
//   POST /api/stats  {g:'banquero', e:'v'|'p'}   → suma una entrada (v) o una partida empezada (p)
//        con e:'p' puede venir j:[{n:'Juan', b:0}, ...] = quiénes jugaron esa partida (nombres que pusieron)
//   GET  /api/stats?dias=30&ts=...&sig=...       → números por día y por juego, y las últimas partidas
//        con sus jugadores (solo el dueño: la firma sale de la contraseña del dueño, la misma llave del panel)
// Las partidas con nombres se borran solas a los 90 días.
// Necesita una base D1 conectada al proyecto de Cloudflare Pages con el nombre de variable DB.
// De las personas solo guarda el nombre que escribieron en el juego (nada de IP ni aparato).
const ALLOWED = [/^https:\/\/(www\.)?juegospy\.com$/, /^https:\/\/juegosdemesapy\.pages\.dev$/, /^https:\/\/[a-z0-9-]+\.juegosdemesapy\.pages\.dev$/, /^https:\/\/jleov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/];
const JUEGOS = ['portada', 'banquero', 'loteria', 'kombate', 'petei', 'escoba', 'impostor', 'ludo', 'tarot', 'versiculo', 'billar', 'bolos', 'minigolf', 'basta', 'tejo', 'botones', 'naval', 'mavapa', 'mavaiko', 'ajedrez', 'salon', 'odisea', 'salas', 'karaoke'];
const OWNER_PUB = { kty: 'EC', crv: 'P-256', x: 'eLdK1LWh1LGyAlt0IW6Apa9bnuRt1LwLi3D1MQtqtHk', y: 'XPx_IfKocm2ZANCG_As4PxsgjToAMnZMEaWlzZWWBKk' };
// día de Paraguay (UTC-3)
const diaPY = (t = Date.now()) => new Date(t - 3 * 3600e3).toISOString().slice(0, 10);
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

// Las tablas se crean solo si faltan (antes se hacía en cada arranque y gastaba escrituras del cupo diario).
async function tabla(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS uso (dia TEXT NOT NULL, juego TEXT NOT NULL, visitas INTEGER NOT NULL DEFAULT 0, partidas INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, juego))'),
    db.prepare('CREATE TABLE IF NOT EXISTS partidas (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, juego TEXT NOT NULL, jugadores TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS partidas_ts ON partidas (ts)'),
  ]);
}
// La cuenta gratis de Cloudflare tiene un cupo diario de D1 (5 millones de filas leídas y 100 mil escritas)
// que comparten TODAS las bases de la cuenta (también Predi Jahuga). Se renueva a las 00:00 UTC = 21:00 en Paraguay.
const esCupo = e => /limit|exceeded|quota|too many/i.test(String(e && e.message || e));
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
  try {
    return await atender(request, env.DB, json);
  } catch (e) {
    if (/no such table/i.test(String(e && e.message))) {   // primera vez: crear las tablas y probar de nuevo
      try { await tabla(env.DB); return await atender(request, env.DB, json); } catch (e2) { e = e2; }
    }
    if (esCupo(e)) return json({ error: 'cupo', x: 'Se llenó el cupo diario gratis de la base de datos de Cloudflare. Se renueva a las 21:00 (hora de Paraguay).' }, 503);
    return json({ error: 'base: ' + String(e && e.message || e).slice(0, 160) }, 500);
  }
}

async function atender(request, db, json) {
  if (request.method === 'POST') {
    let d = null;
    try { d = JSON.parse((await request.text()).slice(0, 2000)); } catch (e) {}
    if (!d || !JUEGOS.includes(d.g) || (d.e !== 'v' && d.e !== 'p')) return json({ error: 'datos inválidos' }, 400);
    const v = d.e === 'v' ? 1 : 0, p = d.e === 'p' ? 1 : 0;
    await db.prepare('INSERT INTO uso (dia, juego, visitas, partidas) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (dia, juego) DO UPDATE SET visitas = visitas + excluded.visitas, partidas = partidas + excluded.partidas')
      .bind(diaPY(), d.g, v, p).run();
    if (p && Array.isArray(d.j) && d.j.length) {   // quiénes jugaron (el nombre que pusieron)
      const j = d.j.slice(0, 12).map(x => ({ n: String((x && x.n) || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 24), b: x && x.b ? 1 : 0 })).filter(x => x.n);
      if (j.length) {
        await db.prepare('INSERT INTO partidas (ts, juego, jugadores) VALUES (?1, ?2, ?3)').bind(Date.now(), d.g, JSON.stringify(j)).run();
        if (Math.random() < 0.05) await db.prepare('DELETE FROM partidas WHERE ts < ?1').bind(Date.now() - 90 * 86400e3).run();
      }
    }
    return json({ ok: true });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (!(await esDueno(url.searchParams.get('ts'), url.searchParams.get('sig')))) return json({ error: 'solo el dueño' }, 401);
    const dias = Math.max(1, Math.min(3650, parseInt(url.searchParams.get('dias'), 10) || 30));
    const desde = diaPY(Date.now() - (dias - 1) * 86400e3);
    const r = await db.prepare('SELECT dia, juego, visitas, partidas FROM uso WHERE dia >= ?1 ORDER BY dia').bind(desde).all();
    const q = await db.prepare('SELECT ts, juego, jugadores FROM partidas ORDER BY ts DESC LIMIT 1000').all();
    const lista = (q.results || []).map(x => { let j = []; try { j = JSON.parse(x.jugadores); } catch (e) {} return { ts: x.ts, juego: x.juego, j }; });
    return json({ hoy: diaPY(), desde, filas: r.results || [], partidas: lista });
  }
  return json({ error: 'método no permitido' }, 405);
}
