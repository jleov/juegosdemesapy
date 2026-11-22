/* =====================================================================
   Tiro Guasu — el mundo: mapas, armas, movimiento y disparos.
   No usa nada de la pantalla: lo usan igual el anfitrión (para los bots
   y para revisar los tiros) y cada jugador (para moverse y apuntar).
   Medidas en metros. Cada caja del mapa es [x0,y0,z0,x1,y1,z1,color].
   ===================================================================== */
(function (G) {
  'use strict';
  const F = {
    GRAV: 24, JUMP: 8.2, SPEED: 6.4, CROUCH: 2.9, AIM: 3.8, R: 0.36, H: 1.75, HC: 1.15,
    STEP: 0.56, SLIDE: 11.5, SLIDE_T: 0.65, ACC: 70, AIR: 14,
  };
  // colores de las cajas (índice → color)
  const PAL = ['#9aa0a8', '#b5543c', '#8a5a33', '#2f5fae', '#c0392b', '#e5b52a', '#3c8d4a', '#e9e4d8', '#5d6670', '#d97b2b', '#6c4a8a', '#2b2b2b'];

  // ---------- armas ----------
  const ARMAS = {
    fusil:    { n: 'Fusil',         ico: '🔫', dmg: 22, head: 2,   cad: 105,  mag: 30, rec: 1800, hip: 0.018, aim: 0.004, auto: true,  pel: 1, range: 140, zoom: 1.45, kick: 0.012 },
    escopeta: { n: 'Escopeta',      ico: '💥', dmg: 11, head: 1.5, cad: 820,  mag: 6,  rec: 2300, hip: 0.075, aim: 0.055, auto: false, pel: 9, range: 34,  zoom: 1.2,  kick: 0.06 },
    franco:   { n: 'Francotirador', ico: '🎯', dmg: 85, head: 2,   cad: 1150, mag: 5,  rec: 2600, hip: 0.09,  aim: 0,     auto: false, pel: 1, range: 260, zoom: 4,    kick: 0.08 },
    pistola:  { n: 'Pistola',       ico: '🔫', dmg: 26, head: 2,   cad: 230,  mag: 12, rec: 1300, hip: 0.012, aim: 0.005, auto: false, pel: 1, range: 90,  zoom: 1.3,  kick: 0.025 },
  };
  const ARMA_IDS = ['fusil', 'escopeta', 'franco', 'pistola'];

  // ---------- mapas ----------
  function armar(id, n, S, extra) {
    const B = [];
    const b = (cx, cz, w, d, h, c, y) => { y = y || 0; B.push([cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2, c]); };
    // escalera de cajas de 0,5 m pegada a un lado de algo alto (dir: hacia dónde baja)
    const escalera = (x, z, dx, dz, alto, ancho, c) => {
      const n = Math.ceil(alto / 0.52);
      for (let i = 0; i < n; i++) {
        const h = alto - i * (alto / n), px = x + dx * (0.4 + i * 0.8), pz = z + dz * (0.4 + i * 0.8);
        if (dx) b(px, pz, 0.8, ancho, h, c); else b(px, pz, ancho, 0.8, h, c);
      }
    };
    // paredes de afuera
    b(0, -S - 0.5, 2 * S + 2, 1, 7, 8); b(0, S + 0.5, 2 * S + 2, 1, 7, 8);
    b(-S - 0.5, 0, 1, 2 * S + 2, 7, 8); b(S + 0.5, 0, 1, 2 * S + 2, 7, 8);
    extra(b, escalera);
    return { id, n, S, boxes: B };
  }

  const MAPAS = {
    mercado: () => armar('mercado', 'Mercado 4', 32, (b, esc) => {
      // fuente del medio
      b(0, 0, 4.4, 4.4, 0.9, 7); b(0, 0, 1, 1, 2.4, 7);
      // kioscos
      [[-8, -8, 4], [8, 8, 4], [-8, 8, 6], [8, -8, 6]].forEach(([x, z, c]) => { b(x, z, 3, 3, 2.6, 1); b(x, z, 3.8, 3.8, 0.2, c, 2.6); });
      // filas de puestos con toldos de colores
      const toldos = [4, 5, 6, 3, 9];
      [-21, -13, 13, 21].forEach((z, j) => [-25, -19.5, -14, 14, 19.5, 25].forEach((x, i) => {
        if ((i + j) % 5 === 3) return;
        b(x, z, 3.4, 1.6, 1.15, 2); b(x, z, 4, 2.6, 0.15, toldos[(i + j) % 5], 2.5);
        b(x - 1.85, z, 0.12, 0.12, 2.5, 11); b(x + 1.85, z, 0.12, 0.12, 2.5, 11);
      }));
      [-20, 20].forEach(x => [-5, 0.5, 6].forEach((z, i) => { b(x, z, 1.6, 3.2, 1.15, 2); b(x, z, 2.6, 4, 0.15, toldos[i + 1], 2.5); }));
      // contenedores en las esquinas con escaleras (lugares para tirar de lejos)
      [[-1, -1, 3], [1, 1, 4], [-1, 1, 6], [1, -1, 5]].forEach(([sx, sz, c]) => {
        const cx = sx * 26, cz = sz * 26;
        b(cx, cz, 6, 2.4, 2.6, c);
        esc(cx - sx * 3, cz, -sx, 0, 2.6, 2.4, 8);
        b(cx, cz - sz * 3, 2.4, 2.4, 2.6, c);
      });
      // cajones sueltos
      [[-4, -16], [4, 16], [-15, 4], [15, -4], [-27, 8], [27, -8], [10, -27], [-10, 27], [0, -9], [0, 9], [-9, 0.5], [9, -0.5], [5, -24], [-5, 24]]
        .forEach(([x, z], i) => { b(x, z, 1.2, 1.2, 1.1, 2); if (i % 3 === 0) b(x + 0.1, z - 0.1, 1, 1, 0.9, 9, 1.1); });
      // paredes cortas para cubrirse
      b(-27, -14, 0.5, 5, 2.2, 1); b(27, 14, 0.5, 5, 2.2, 1); b(14, 27, 5, 0.5, 2.2, 1); b(-14, -27, 5, 0.5, 2.2, 1);
    }),

    puerto: () => armar('puerto', 'Puerto de Asunción', 34, (b, esc) => {
      const cols = [3, 4, 5, 6, 10, 9];
      // filas de contenedores
      let k = 0;
      for (let z = -26; z <= 26; z += 8.5) for (let x = -24; x <= 24; x += 12) {
        k++;
        if (Math.abs(x) < 7 && Math.abs(z) < 7) continue;
        if (k % 7 === 3) continue;
        const c = cols[k % cols.length];
        if (k % 2) b(x, z, 7, 2.5, 2.6, c); else b(x, z, 2.5, 6, 2.6, c);
        if (k % 5 === 0) { b(x, z, 6.4, 2.3, 2.6, cols[(k + 2) % cols.length], 2.6); }
        if (k % 5 === 1 && k % 2) esc(x + 3.5, z, 1, 0, 2.6, 2.5, 8);
      }
      // galpón del medio (sin techo) con puertas
      const W = 7, D = 5.5, h = 3.6, t = 0.4;
      b(-W / 2 - 1.6, -D, W - 3.2 + 0.0, t, h, 7); b(W / 2 + 1.6, -D, W - 3.2, t, h, 7);
      b(-W / 2 - 1.6, D, W - 3.2, t, h, 7); b(W / 2 + 1.6, D, W - 3.2, t, h, 7);
      b(-W, -3.4, t, 4.2, h, 7); b(-W, 3.4, t, 4.2, h, 7); b(W, -3.4, t, 4.2, h, 7); b(W, 3.4, t, 4.2, h, 7);
      b(0, 0, 2.2, 1.2, 1.1, 2); b(-3, 2, 1.1, 1.1, 1.1, 2); b(3, -2, 1.1, 1.1, 1.1, 2);
      // muelle elevado de un lado
      b(0, 31, 60, 4, 1.1, 8); esc(-10, 29, 0, -1, 1.1, 3, 8); esc(10, 29, 0, -1, 1.1, 3, 8);
      // grúa: dos patas altas y una viga
      b(-30, -30, 1, 1, 9, 5); b(-30, -22, 1, 1, 9, 5); b(-30, -26, 1.2, 9, 0.8, 5, 9);
      b(30, 22, 1, 1, 9, 5); b(30, 30, 1, 1, 9, 5); b(30, 26, 1.2, 9, 0.8, 5, 9);
      // bolsas y barriles sueltos
      [[-16, 0], [16, 0], [0, -17], [0, 17], [-29, 5], [29, -5]].forEach(([x, z], i) => b(x, z, 1.4, 1.4, i % 2 ? 1.2 : 0.9, i % 2 ? 9 : 2));
    }),

    chaco: () => armar('chaco', 'Estancia en el Chaco', 30, (b, esc) => {
      // casa de la estancia (con puertas, sin techo para ver)
      const t = 0.35, h = 3.2;
      b(-4, -6, 6, t, h, 7); b(5, -6, 4, t, h, 7); b(-4, 6, 6, t, h, 7); b(5, 6, 4, t, h, 7);
      b(-7, -3.5, t, 5, h, 7); b(-7, 3.5, t, 5, h, 7); b(7, 0, t, 12.3, h, 7);
      b(0, 0, t, 5, h, 7); b(-3.5, 0, 1.8, 1, 0.9, 2);
      // tanque de agua alto con escalera (mirador)
      b(18, -18, 4, 4, 4.2, 8); b(18, -18, 4.6, 4.6, 0.3, 11, 4.2); esc(16, -18, -1, 0, 4.2, 1.6, 2);
      // corrales de troncos (bajitos, se saltan)
      [[-18, 14], [16, 14]].forEach(([x, z]) => { b(x, z - 4, 8, 0.3, 1.1, 2); b(x, z + 4, 8, 0.3, 1.1, 2); b(x - 4, z, 0.3, 8, 1.1, 2); });
      // fardos y árboles (palos borrachos: tronco gordo)
      [[-20, -16], [-12, -22], [8, 20], [22, 2], [-24, 2], [0, -20], [0, 22], [12, -10], [-12, 12]].forEach(([x, z], i) => {
        if (i % 2) { b(x, z, 1.4, 1.4, 4.5, 2); b(x, z, 4, 4, 1.2, 6, 4.5); }
        else { b(x, z, 2.2, 1.3, 1.2, 5); b(x + 2.3, z, 2.2, 1.3, 1.2, 5); }
      });
      // camioneta abandonada
      b(-18, -4, 2, 4.6, 1.5, 4); b(-18, -5, 1.9, 1.8, 0.7, 11, 1.5);
    }),
  };
  const MAPA_IDS = Object.keys(MAPAS);
  const cacheM = {};
  function mapa(id) {
    if (!MAPAS[id]) id = 'mercado';
    if (!cacheM[id]) { const m = MAPAS[id](); m.nav = navGrid(m); cacheM[id] = m; }
    return cacheM[id];
  }

  // ---------- choques ----------
  function choca(M, x, y, z, h) {
    const r = F.R, B = M.boxes;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (b[4] > y + 0.01 && b[1] < y + h && x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5]) return b;
    }
    return null;
  }
  // altura del piso debajo (lo más alto que no esté por encima de "tope")
  function piso(M, x, z, tope) {
    const r = F.R - 0.02, B = M.boxes; let g = 0;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (b[4] <= tope && b[4] > g && x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5]) g = b[4];
    }
    return g;
  }
  // un paso de movimiento. s = {x,y,z,vx,vy,vz,ground,crouch,slideT,slideCd}
  // inp = {mx,mz (dirección en el mundo, largo ≤1), jump, crouch, aim}
  function mover(M, s, inp, dt) {
    // agacharse / pararse (solo si hay lugar arriba)
    const quiere = !!inp.crouch;
    if (quiere && !s.crouch) {
      s.crouch = true;
      const v = Math.hypot(s.vx, s.vz);
      if (s.ground && v > 4.5 && (s.slideCd || 0) <= 0) {
        const k = F.SLIDE / (v || 1); s.vx *= k; s.vz *= k; s.slideT = F.SLIDE_T; s.slideCd = 1.1;
      }
    } else if (!quiere && s.crouch && !choca(M, s.x, s.y, s.z, F.H)) { s.crouch = false; s.slideT = 0; }
    s.slideCd = Math.max(0, (s.slideCd || 0) - dt);
    const h = s.crouch ? F.HC : F.H;
    // velocidad buscada
    if (s.slideT > 0) {
      s.slideT -= dt;
      const f = Math.max(0, 1 - dt * 1.6); s.vx *= f; s.vz *= f;
      if (s.slideT <= 0 && !quiere && !choca(M, s.x, s.y, s.z, F.H)) s.crouch = false;
    } else {
      const sp = s.crouch ? F.CROUCH : inp.aim ? F.AIM : F.SPEED;
      const tx = inp.mx * sp, tz = inp.mz * sp, a = (s.ground ? F.ACC : F.AIR) * dt;
      const dx = tx - s.vx, dz = tz - s.vz, d = Math.hypot(dx, dz);
      if (d <= a) { s.vx = tx; s.vz = tz; } else { s.vx += dx / d * a; s.vz += dz / d * a; }
    }
    if (inp.jump && s.ground) { s.vy = F.JUMP; s.ground = false; if (s.slideT > 0) { s.slideT = 0; } }
    // horizontal, un eje a la vez, subiendo escalones
    const ejes = [['x', 'vx'], ['z', 'vz']];
    for (const [p, v] of ejes) {
      const old = s[p]; s[p] += s[v] * dt;
      const b = choca(M, s.x, s.y, s.z, h);
      if (b) {
        const sube = b[4] - s.y;
        if (s.ground && sube > 0 && sube <= F.STEP && !choca(M, s.x, b[4], s.z, h)) s.y = b[4];
        else { s[p] = old; s[v] = 0; }
      }
    }
    // vertical
    s.vy -= F.GRAV * dt;
    const ny = s.y + s.vy * dt;
    if (s.vy <= 0) {
      const g = piso(M, s.x, s.z, s.y + 0.02);
      if (ny <= g) { s.y = g; s.vy = 0; s.ground = true; }
      else { s.y = ny; s.ground = false; }
    } else {
      const b = choca(M, s.x, ny, s.z, h);
      if (b && b[1] >= s.y + h - 0.05) { s.y = b[1] - h; s.vy = 0; } else s.y = ny;
      s.ground = false;
    }
    if (s.y < -5) s.y = 0;
  }

  // ---------- rayos ----------
  function rayCaja(o, d, b, max) {
    let t0 = 0, t1 = max;
    for (let i = 0; i < 3; i++) {
      const lo = b[i], hi = b[i + 3];
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo || o[i] > hi) return -1; continue; }
      let a = (lo - o[i]) / d[i], c = (hi - o[i]) / d[i];
      if (a > c) { const t = a; a = c; c = t; }
      if (a > t0) t0 = a; if (c < t1) t1 = c;
      if (t0 > t1) return -1;
    }
    return t0;
  }
  function rayMundo(M, o, d, max) {
    let best = max;
    const B = M.boxes;
    for (let i = 0; i < B.length; i++) { const t = rayCaja(o, d, B[i], best); if (t >= 0 && t < best) best = t; }
    if (d[1] < 0) { const t = -o[1] / d[1]; if (t < best) best = t; }   // el piso
    return best;
  }
  function raySphere(o, d, c, r, max) {
    const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
    const b = ox * d[0] + oy * d[1] + oz * d[2], q = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - q;
    if (disc < 0) return -1;
    const t = -b - Math.sqrt(disc);
    return t >= 0 && t <= max ? t : -1;
  }
  // cuerpos: lista de {id,x,y,z,crouch}
  function cabeza(p) { const h = p.crouch ? F.HC : F.H; return [p.x, p.y + h - 0.22, p.z]; }
  function rayCuerpos(list, o, d, max) {
    let best = null;
    for (const p of list) {
      const h = p.crouch ? F.HC : F.H;
      let t = raySphere(o, d, cabeza(p), 0.26, max), head = true;
      const tb = rayCaja(o, d, [p.x - 0.34, p.y, p.z - 0.34, p.x + 0.34, p.y + h - 0.44, p.z + 0.34], max);
      if (tb >= 0 && (t < 0 || tb < t - 0.05)) { t = tb; head = false; }
      if (t >= 0 && (!best || t < best.t)) best = { id: p.id, t, head };
    }
    return best;
  }
  // dirección desde yaw (giro) y pitch (arriba/abajo). yaw 0 = mira hacia -z
  function dir(ry, rx) { const c = Math.cos(rx); return [-Math.sin(ry) * c, Math.sin(rx), -Math.cos(ry) * c]; }
  // dirección con desvío al azar
  function desvio(d, sp, rnd) {
    if (!sp) return d;
    rnd = rnd || Math.random;
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * sp;
    // dos vectores perpendiculares a d
    let ux = -d[2], uy = 0, uz = d[0]; let l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
    const vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux;
    const x = d[0] + (ux * Math.cos(a) + vx * Math.sin(a)) * r, y = d[1] + (uy * Math.cos(a) + vy * Math.sin(a)) * r, z = d[2] + (uz * Math.cos(a) + vz * Math.sin(a)) * r;
    l = Math.hypot(x, y, z); return [x / l, y / l, z / l];
  }
  function seVe(M, a, b) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]);
    if (L < 0.01) return true;
    d[0] /= L; d[1] /= L; d[2] /= L;
    return rayMundo(M, a, d, L) >= L - 0.05;
  }

  // ---------- grilla para que los bots caminen (1 m) ----------
  function navGrid(M) {
    const S = M.S, N = 2 * S, ok = new Uint8Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -S + i + 0.5, z = -S + j + 0.5;
      ok[j * N + i] = choca(M, x, 0, z, F.H) || piso(M, x, z, 0.6) > 0.6 ? 0 : 1;
      // cajitas bajas (escalones) se pueden pisar
      if (!ok[j * N + i]) { const g = piso(M, x, z, F.STEP); if (g > 0 && g <= F.STEP && !choca(M, x, g, z, F.H)) ok[j * N + i] = 1; }
    }
    return { S, N, ok, flows: new Map() };
  }
  const celda = (nav, x, z) => { const i = Math.floor(x + nav.S), j = Math.floor(z + nav.S); return i < 0 || j < 0 || i >= nav.N || j >= nav.N ? -1 : j * nav.N + i; };
  function flujo(nav, tc) {
    let f = nav.flows.get(tc); if (f) return f;
    const N = nav.N; f = new Int16Array(N * N).fill(-1);
    const q = new Int32Array(N * N); let h = 0, t = 0;
    f[tc] = 0; q[t++] = tc;
    while (h < t) {
      const c = q[h++], i = c % N, j = (c / N) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, bb = j + dj; if (a < 0 || bb < 0 || a >= N || bb >= N) continue;
        const n = bb * N + a; if (f[n] >= 0 || !nav.ok[n]) continue;
        f[n] = f[c] + 1; q[t++] = n;
      }
    }
    if (nav.flows.size > 40) nav.flows.delete(nav.flows.keys().next().value);
    nav.flows.set(tc, f); return f;
  }
  // hacia dónde caminar para llegar a (tx,tz): devuelve punto intermedio o null
  function rumbo(M, x, z, tx, tz) {
    const nav = M.nav; let tc = celda(nav, tx, tz);
    if (tc < 0 || !nav.ok[tc]) tc = cercana(nav, tx, tz); if (tc < 0) return null;
    const f = flujo(nav, tc), c = celda(nav, x, z), N = nav.N;
    if (c < 0) return null;
    if (f[c] < 0) { const cc = cercana(nav, x, z); if (cc < 0) return null; return [-nav.S + cc % N + 0.5, -nav.S + ((cc / N) | 0) + 0.5]; }
    // mira 3 celdas adelante siguiendo el flujo
    let cur = c;
    for (let s = 0; s < 3; s++) {
      const i = cur % N, j = (cur / N) | 0; let best = cur;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = i + di, bb = j + dj; if (a < 0 || bb < 0 || a >= N || bb >= N) continue;
        const n = bb * N + a; if (f[n] < 0) continue;
        if (di && dj && (f[j * N + a] < 0 || f[bb * N + i] < 0)) continue;
        if (f[n] < f[best]) best = n;
      }
      if (best === cur) break; cur = best;
    }
    return [-nav.S + cur % N + 0.5, -nav.S + ((cur / N) | 0) + 0.5];
  }
  function cercana(nav, x, z) {
    const N = nav.N; let best = -1, bd = 1e9;
    for (let k = 0; k < N * N; k++) if (nav.ok[k]) {
      const d = (-nav.S + k % N + 0.5 - x) ** 2 + (-nav.S + ((k / N) | 0) + 0.5 - z) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function puntoLibre(M, rnd) {
    rnd = rnd || Math.random; const nav = M.nav;
    for (let k = 0; k < 200; k++) {
      const c = (rnd() * nav.N * nav.N) | 0;
      if (nav.ok[c] && piso(M, -nav.S + c % nav.N + 0.5, -nav.S + ((c / nav.N) | 0) + 0.5, 0.01) === 0) {
        const x = -nav.S + c % nav.N + 0.5, z = -nav.S + ((c / nav.N) | 0) + 0.5;
        if (!choca(M, x, 0, z, F.H)) return [x, 0, z];
      }
    }
    return [0, 0, 0];
  }

  G.TiroMundo = { F, PAL, ARMAS, ARMA_IDS, MAPAS, MAPA_IDS, mapa, choca, piso, mover, rayMundo, rayCuerpos, dir, desvio, seVe, rumbo, puntoLibre, cabeza };
})(typeof window !== 'undefined' ? window : globalThis);
