// Cloudflare Pages Function: /api/records
// Tabla de récords de los juegos de un jugador (por ahora Yva Rape, juego 'frutas').
//   POST /api/records {g:'frutas', id, n, niv, pts, tot, est, max}
//        id  = código al azar del aparato (no es de la persona), n = nombre que puso
//        lista = [[nivel, puntos], ...] mejores puntajes de niveles que todavía no subió
//        tot = suma de sus mejores puntajes, est = estrellas totales, max = niveles ganados
//   GET  /api/records?g=frutas            → ranking general (top 50)
//   GET  /api/records?g=frutas&niv=3      → mejores 10 de ese nivel
//   (con &id=... también devuelve en qué puesto está ese aparato)
// Usa la misma base D1 (variable DB) que /api/stats.
const ALLOWED = [/^https:\/\/(www\.)?juegospy\.com$/, /^https:\/\/juegosdemesapy\.pages\.dev$/, /^https:\/\/[a-z0-9-]+\.juegosdemesapy\.pages\.dev$/, /^https:\/\/jleov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/];
const JUEGOS = { frutas: { niveles: 66, maxNivel: 400000 } };
const esCupo = e => /limit|exceeded|quota|too many/i.test(String(e && e.message || e));
const limpio = s => String(s || '').replace(/[\u0000-\u001f\u007f<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);

async function tablas(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS rec_total (juego TEXT NOT NULL, id TEXT NOT NULL, nombre TEXT NOT NULL, tot INTEGER NOT NULL, est INTEGER NOT NULL, max INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (juego, id))'),
    db.prepare('CREATE INDEX IF NOT EXISTS rec_total_tot ON rec_total (juego, tot DESC)'),
    db.prepare('CREATE TABLE IF NOT EXISTS rec_nivel (juego TEXT NOT NULL, niv INTEGER NOT NULL, id TEXT NOT NULL, nombre TEXT NOT NULL, pts INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (juego, niv, id))'),
    db.prepare('CREATE INDEX IF NOT EXISTS rec_nivel_pts ON rec_nivel (juego, niv, pts DESC)'),
  ]);
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
      try { await tablas(env.DB); return await atender(request, env.DB, json); } catch (e2) { e = e2; }
    }
    if (esCupo(e)) return json({ error: 'cupo' }, 503);
    return json({ error: 'base: ' + String(e && e.message || e).slice(0, 160) }, 500);
  }
}

async function atender(request, db, json) {
  if (request.method === 'POST') {
    let d = null;
    try { d = JSON.parse((await request.text()).slice(0, 4000)); } catch (e) {}
    const J = d && JUEGOS[d.g];
    const id = String((d && d.id) || '');
    const n = limpio(d && d.n);
    if (!J || !/^[a-z0-9]{12,32}$/.test(id) || !n) return json({ error: 'datos inválidos' }, 400);
    const max = Math.max(0, Math.min(J.niveles, Math.floor(Number(d.max) || 0)));
    const est = Math.max(0, Math.min(max * 3, Math.floor(Number(d.est) || 0)));
    const tot = Math.max(0, Math.min(max * J.maxNivel, Math.floor(Number(d.tot) || 0)));
    const ahora = Date.now(), ops = [];
    // el nombre se actualiza siempre (si lo cambió); los números solo si mejoran
    ops.push(db.prepare('INSERT INTO rec_total (juego, id, nombre, tot, est, max, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (juego, id) DO UPDATE SET nombre = excluded.nombre, tot = MAX(tot, excluded.tot), est = MAX(est, excluded.est), max = MAX(max, excluded.max), ts = excluded.ts')
      .bind(d.g, id, n, tot, est, max, ahora));
    const lista = Array.isArray(d.lista) ? d.lista.slice(0, J.niveles) : [];
    for (const x of lista) {
      const niv = Array.isArray(x) ? Math.floor(Number(x[0])) : -1, pts = Array.isArray(x) ? Math.floor(Number(x[1]) || 0) : 0;
      if (!(niv >= 0 && niv < J.niveles && pts > 0 && pts <= J.maxNivel)) continue;
      ops.push(db.prepare('INSERT INTO rec_nivel (juego, niv, id, nombre, pts, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (juego, niv, id) DO UPDATE SET nombre = excluded.nombre, pts = MAX(pts, excluded.pts), ts = CASE WHEN excluded.pts > pts THEN excluded.ts ELSE ts END')
        .bind(d.g, niv, id, n, pts, ahora));
    }
    // el nombre nuevo también en los niveles que ya tenía
    ops.push(db.prepare('UPDATE rec_nivel SET nombre = ?3 WHERE juego = ?1 AND id = ?2 AND nombre <> ?3').bind(d.g, id, n));
    await db.batch(ops);
    return json({ ok: true });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const g = url.searchParams.get('g') || '', J = JUEGOS[g];
    if (!J) return json({ error: 'juego desconocido' }, 400);
    const id = url.searchParams.get('id') || '';
    const nivS = url.searchParams.get('niv');
    if (nivS !== null) {
      const niv = parseInt(nivS, 10);
      if (!(niv >= 0 && niv < J.niveles)) return json({ error: 'nivel inválido' }, 400);
      const r = await db.prepare('SELECT id, nombre, pts FROM rec_nivel WHERE juego = ?1 AND niv = ?2 ORDER BY pts DESC, ts ASC LIMIT 10').bind(g, niv).all();
      let yo = null;
      if (/^[a-z0-9]{12,32}$/.test(id)) {
        const m = await db.prepare('SELECT pts, (SELECT COUNT(*) FROM rec_nivel b WHERE b.juego = a.juego AND b.niv = a.niv AND b.pts > a.pts) + 1 AS puesto FROM rec_nivel a WHERE juego = ?1 AND niv = ?2 AND id = ?3').bind(g, niv, id).first();
        if (m) yo = m;
      }
      return json({ lista: (r.results || []).map(x => ({ n: x.nombre, pts: x.pts, yo: x.id === id })), yo });
    }
    const r = await db.prepare('SELECT id, nombre, tot, est, max FROM rec_total WHERE juego = ?1 ORDER BY tot DESC, ts ASC LIMIT 50').bind(g).all();
    let yo = null;
    if (/^[a-z0-9]{12,32}$/.test(id)) {
      const m = await db.prepare('SELECT tot, est, max, (SELECT COUNT(*) FROM rec_total b WHERE b.juego = a.juego AND b.tot > a.tot) + 1 AS puesto FROM rec_total a WHERE juego = ?1 AND id = ?2').bind(g, id).first();
      if (m) yo = m;
    }
    return json({ lista: (r.results || []).map(x => ({ n: x.nombre, tot: x.tot, est: x.est, max: x.max, yo: x.id === id })), yo });
  }
  return json({ error: 'método no permitido' }, 405);
}
