/* =====================================================================
   Tiro Guasu — la sala (la corre el aparato del anfitrión, o la práctica).
   Lleva los puntos, la vida de cada uno, revisa los tiros, hace reaparecer
   y mueve a los bots. Les manda a todos cómo va ("snap") 20 veces por segundo.
   ===================================================================== */
(function (G) {
  'use strict';
  const W = G.TiroMundo, F = W.F, A = W.ARMAS;
  const BOT_N = ['Ñandú', 'Yaguareté', 'Karai Bot', 'Pombero', 'Kurupí', 'Tatú', 'Jakare', 'Mainumby', 'Arasá', 'Mbói', 'Kure', 'Tuju', 'Ka\'i', 'Guyra'];
  const SKILL = {
    facil:   { react: 0.85, err: 0.11, turn: 3.2, sense: 45 },
    normal:  { react: 0.45, err: 0.06, turn: 5.5, sense: 60 },
    dificil: { react: 0.22, err: 0.032, turn: 9, sense: 80 },
  };
  const COLS = 10;
  const SKINS = ['soldado', 'albirrojo', 'enemigo', 'hazmat'];   // personajes 3D (juego.js)   // cantidad de colores de camiseta (todos contra todos)
  const genId = () => Math.random().toString(36).slice(2, 10);
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
  const r2 = v => Math.round(v * 100) / 100;
  // zombis (modo supervivencia): alto del blanco, vida, velocidad caminando/corriendo y mordida
  const ZT = {
    zombi: { hp: 100, alto: 1.75, camina: 2.1, corre: 4.6, dmg: 14 },
    gordo: { hp: 230, alto: 1.8,  camina: 1.6, corre: 1.6, dmg: 22 },
    brazo: { hp: 170, alto: 1.95, camina: 2.3, corre: 4.2, dmg: 28 },
    medio: { hp: 60,  alto: 0.75, camina: 1.5, corre: 1.5, dmg: 10 },
    explosivo: { hp: 70, alto: 1.75, camina: 2.6, corre: 5, dmg: 0 },     // campaña: explota al llegar
    teju:  { hp: 6000, alto: 4.4, camina: 2.6, corre: 2.6, dmg: 26 },     // el jefe final
  };
  const TIPOS_Z = ['zombi', 'gordo', 'brazo', 'medio', 'explosivo', 'teju'];
  const MAX_Z = 16;
  const PG = 18;   // gravedad de lo que se tira (granadas, molotov, ácido)
  const PROY = ['granada', 'molotov', 'acido', 'ruido', 'humo'];
  // punto adentro de una caja del mapa
  function dentro(M, x, y, z) {
    const B = M.boxes;
    for (let i = 0; i < B.length; i++) { const b = B[i]; if (x > b[0] && x < b[3] && y > b[1] && y < b[4] && z > b[2] && z < b[5]) return b; }
    return null;
  }   // zombis a la vez (para que no se trabe el celular)
  const RACHA = { 2: '¡Doble! 🔥', 3: '¡Triple! 🔥🔥', 5: '¡Imparable! 💪', 7: '¡Hetaiterei! 😱', 10: '¡Leyenda guasu! 👑' };

  class Room {
    constructor(code, io) {
      this.code = code; this.io = io;
      this.players = new Map(); this.order = []; this.hostId = null;
      this.settings = { mode: 'ffa', map: 'mercado', goal: 20, time: 5, bots: 'normal', max: 12, fa: false };
      this.phase = 'lobby'; this.endAt = 0; this.score = { r: 0, a: 0 }; this.ranking = null; this.winner = null;
      this.dead = false; this.last = Date.now(); this.snapAcc = 0;
      this.zombis = new Map(); this.ola = null; this.zc = 0;
      this.proy = []; this.areas = []; this.pc = 0;
      this.timer = setInterval(() => this.tick(), 33);
    }
    destroy() { this.dead = true; clearInterval(this.timer); }
    get M() { return W.mapa(this.settings.map); }
    humans() { return [...this.players.values()].filter(p => !p.bot); }
    list() { return this.order.map(id => this.players.get(id)).filter(Boolean); }

    // ---------- mensajes ----------
    to(id, msg) { const p = this.players.get(id); if (p && !p.bot) this.io.send(id, msg); }
    all(msg, except) { for (const p of this.players.values()) if (!p.bot && p.id !== except) this.io.send(p.id, msg); }
    sys(text) { this.all({ t: 'chat', kind: 'system', text }); }
    stateFor(id) {
      const now = Date.now();
      return {
        t: 'state', me: id, code: this.code, phase: this.phase, hostId: this.hostId, settings: this.settings,
        players: this.list().map(p => ({ id: p.id, name: p.name, avatar: p.avatar, bot: !!p.bot, team: p.team, col: p.col, k: p.k, d: p.d, connected: !!p.bot || p.connected, voice: !!p.voice, prim: p.prim, skin: p.skin, gr: p.granadas | 0, mo: p.molotov | 0, ru: p.ruidos | 0 })),
        remaining: this.phase === 'play' ? Math.max(0, this.endAt - now) : 0, ola: this.ola ? { n: this.ola.n, quedan: this.ola.quedan + this.zVivos() } : null, score: this.score, ranking: this.ranking, winner: this.winner,
        maps: W.MAPA_IDS.map(k => [k, W.mapa(k).n]),
        camp: this.camp ? { n: this.camp.nivel, ab: (this.M.abiertas || []).slice() } : null,
      };
    }
    broadcastState() { for (const p of this.players.values()) if (!p.bot) this.io.send(p.id, this.stateFor(p.id)); }

    // ---------- gente ----------
    nuevo(o) {
      const used = new Set([...this.players.values()].map(p => p.col));
      let col = 0; while (used.has(col) && col < COLS - 1) col++;
      return Object.assign({ id: genId(), k: 0, d: 0, hp: 100, alive: false, x: 0, y: 0, z: 0, ry: 0, rx: 0, w: 'fusil', prim: 'fusil', crouch: false,
        lastHurt: 0, respawnAt: 0, prot: 0, streak: 0, voice: false, lastFire: {}, col, team: this.equipoChico() }, o);
    }
    equipoChico() {
      let r = 0, a = 0; for (const p of this.players.values()) { if (p.team === 'r') r++; else if (p.team === 'a') a++; }
      return r <= a ? 'r' : 'a';
    }
    addPlayer({ name, avatar, skin }) {
      if (this.players.size >= this.settings.max) return null;
      const p = this.nuevo({ token: genId() + genId(), name: clean(name, 16) || 'Jugador', avatar: clean(avatar, 8) || '😎', bot: false, connected: true, skin: SKINS.includes(skin) ? skin : 'soldado' });
      this.players.set(p.id, p); this.order.push(p.id);
      if (!this.hostId) this.hostId = p.id;
      this.sys(`${p.avatar} ${p.name} entró a la sala`);
      this.broadcastState();
      if (this.phase === 'play') this.respawn(p);
      return p;
    }
    addBot(pid) {
      if (pid && pid !== this.hostId) return;
      if (this.players.size >= this.settings.max) return;
      const used = new Set([...this.players.values()].map(p => p.name));
      const n = BOT_N.find(x => !used.has(x)) || 'Bot ' + (this.players.size + 1);
      const prim = ['fusil', 'fusil', 'escopeta', 'franco', 'subfusil'][(Math.random() * 5) | 0];
      const p = this.nuevo({ name: n, avatar: '🤖', bot: { lookT: 0, seen: 0, strafe: 1, strafeT: 0, nextFire: 0, ammo: A[prim].mag, relT: 0, goal: null, goalT: 0, err: [0, 0], errT: 0, stuck: 0 }, connected: true, prim, w: prim, skin: SKINS[(Math.random() * SKINS.length) | 0] });
      this.players.set(p.id, p); this.order.push(p.id);
      this.broadcastState();
      if (this.phase === 'play') this.respawn(p);
    }
    removeBot(pid, id) { if (pid !== this.hostId) return; const p = this.players.get(id); if (p && p.bot) this.removePlayer(id); }
    reconnect(token) {
      const p = [...this.players.values()].find(x => !x.bot && x.token === token);
      if (!p) return null;
      p.connected = true; this.broadcastState(); return p;
    }
    // lo que necesita alguien que recién entra o vuelve a entrar
    sendInitial(id) {
      const p = this.players.get(id); if (!p) return;
      this.to(id, this.stateFor(id));
      if (this.phase === 'play' && p.alive) this.to(id, { t: 'spawn', id, p: [r2(p.x), r2(p.y), r2(p.z)], ry: r2(p.ry), w: p.w });
    }
    disconnect(id) { const p = this.players.get(id); if (!p) return; p.connected = false; p.voice = false; this.broadcastState(); }
    removePlayer(id) {
      const p = this.players.get(id); if (!p) return;
      this.players.delete(id); this.order = this.order.filter(x => x !== id);
      if (!p.bot) this.sys(`${p.avatar} ${p.name} se fue`);
      if (!this.humans().length) { this.destroy(); this.io.onEmpty && this.io.onEmpty(this.code); return; }
      if (this.hostId === id) { this.hostId = this.humans()[0].id; const h = this.players.get(this.hostId); this.sys(`👑 Ahora ${h.name} es el anfitrión`); }
      this.broadcastState();
    }
    setSettings(pid, s) {
      if (pid !== this.hostId || this.phase === 'play' || !s) return;
      const st = this.settings;
      if (s.mode === 'ffa' || s.mode === 'equipos' || s.mode === 'zombis' || s.mode === 'campana') {
        if (s.mode !== st.mode && s.mode === 'equipos') { let i = 0; for (const p of this.list()) p.team = i++ % 2 ? 'a' : 'r'; }
        st.mode = s.mode;
      }
      if (W.MAPAS[s.map]) st.map = s.map;
      if ([10, 15, 20, 30, 40, 50].includes(+s.goal)) st.goal = +s.goal;
      if ([3, 5, 8, 10, 15].includes(+s.time)) st.time = +s.time;
      if (SKILL[s.bots]) st.bots = s.bots;
      if (typeof s.fa === 'boolean') st.fa = s.fa;
      if (Number.isInteger(+s.nivel) && +s.nivel >= 0 && +s.nivel < 10) st.nivel = +s.nivel;
      this.broadcastState();
    }
    setTeam(pid, id, team) {
      const p = this.players.get(id); if (!p || (team !== 'r' && team !== 'a')) return;
      if (id !== pid && !(pid === this.hostId && p.bot)) return;
      p.team = team; this.broadcastState();
    }
    setPrim(pid, w) {
      const p = this.players.get(pid); if (!p || !A[w] || w === 'pistola') return;
      p.prim = w; this.broadcastState();
    }

    // ---------- partida ----------
    start(pid) {
      if (pid !== this.hostId || this.phase === 'play') return;
      if (this.settings.mode === 'campana') {
        // la campaña es de a 4: si faltan, se completa con bots compañeros
        while (this.players.size < 4) { const n = this.players.size; this.addBot(pid); if (this.players.size === n) break; }
      } else if (this.players.size < 2) { this.to(pid, { t: 'chat', kind: 'system', text: 'Se necesitan al menos 2 jugadores (agregá bots 🤖).' }); return; }
      this.camp = null; this.mercs = new Map();
      this.score = { r: 0, a: 0 }; this.ranking = null; this.winner = null;
      for (const p of this.players.values()) { p.k = 0; p.d = 0; p.streak = 0; this.respawn(p, true); }
      this.phase = 'play'; this.endAt = Date.now() + this.settings.time * 60000;
      this.zombis.clear(); this.ola = null; this.proy = []; this.areas = [];
      if (this.settings.mode === 'campana') { this.endAt = Date.now() + 24 * 3600e3; this.phase = 'play'; this.campStart(this.settings.nivel || 0); this.sys('🎖️ Campaña "Operación Yvy": todos juntos contra la corporación y los infectados. Si caen, vuelven en 15 segundos al lado de un compañero.'); return; }
      if (this.settings.mode === 'zombis') { this.endAt = Date.now() + 24 * 3600e3; this.ola = { n: 0, quedan: 0, spawnT: 0, pausaHasta: Date.now() + 4000 }; }
      this.broadcastState();
      if (this.settings.mode === 'zombis') this.sys(`🧟 ¡Supervivencia en ${this.M.n}! Aguanten todas las oleadas de zombis que puedan. Si caen, vuelven en la próxima oleada.`);
      else this.sys(`🔫 ¡Arranca! ${this.settings.mode === 'equipos' ? 'Rojos contra azules' : 'Todos contra todos'} en ${this.M.n}: gana el primero en llegar a ${this.settings.goal} bajas.`);
      if (this.settings.fa && this.settings.mode !== 'ffa') this.sys('🔥 Fuego amigo prendido: cuidado con los tiros, las granadas y el fuego, que también lastiman a los compañeros.');
      for (const p of this.players.values()) this.spawnMsg(p);
    }
    toLobby(pid) {
      if (pid && pid !== this.hostId) return;
      this.phase = 'lobby'; this.ranking = null; this.broadcastState();
    }
    finish(why) {
      if (this.phase !== 'play') return;
      this.phase = 'over';
      const L = this.list().slice().sort((a, b) => b.k - a.k || a.d - b.d);
      this.ranking = L.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, k: p.k, d: p.d, team: p.team, bot: !!p.bot }));
      if (this.settings.mode === 'equipos') this.winner = this.score.r === this.score.a ? 'empate' : this.score.r > this.score.a ? 'r' : 'a';
      else if (this.settings.mode === 'zombis' || this.settings.mode === 'campana') this.winner = null;
      else this.winner = L[0] ? L[0].id : null;
      this.broadcastState();
      this.all({ t: 'sfx', name: 'fin' });
    }
    zVivos() { let n = 0; for (const z of this.zombis.values()) if (z.alive) n++; return n; }
    enemigos(p) {
      if (this.camp) return [...this.zombis.values()].filter(z => z.alive).concat([...this.mercs.values()].filter(m => m.alive));
      if (this.settings.mode === 'zombis') return [...this.zombis.values()].filter(z => z.alive);
      return [...this.players.values()].filter(q => q !== p && q.alive && (this.settings.mode !== 'equipos' || q.team !== p.team));
    }
    respawn(p, sinAviso) {
      const M = this.M, en = [...this.players.values()].filter(q => q !== p && q.alive);
      let best = null, bd = -1;
      if (this.camp) { best = this.campPunto(p); bd = 1e9; }
      for (let i = 0; i < 18 && !this.camp; i++) {
        const c = W.puntoLibre(M);
        let d = 1e9;
        for (const q of en) { const v = Math.hypot(q.x - c[0], q.z - c[2]) * ((this.settings.mode === 'equipos' && q.team === p.team) ? 3 : 1); if (v < d) d = v; }
        if (d > bd) { bd = d; best = c; }
      }
      [p.x, p.y, p.z] = best; p.rx = 0; p.crouch = false;
      // mirar hacia donde hay más lugar libre (no aparecer con la cara contra una pared)
      let lejos = -1;
      for (let a = 0; a < 16; a++) {
        const ry = a / 16 * Math.PI * 2, d = W.rayMundo(M, [p.x, 1.55, p.z], W.dir(ry, 0), 60) + Math.random() * 3;
        if (d > lejos) { lejos = d; p.ry = ry; }
      }
      p.hp = 100; p.alive = true; p.prot = Date.now() + 1800; p.lastHurt = 0; p.w = p.prim;
      p.granadas = 2; p.molotov = 1;   // para la supervivencia zombi
      p.ruidos = this.camp && this.camp.nivel >= 4 ? 2 : 0; p.usando = false;
      if (p.bot) { p.bot.s = { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, ground: true, crouch: false, slideT: 0 }; p.bot.ammo = A[p.w].mag; p.bot.relT = 0; p.bot.tgt = null; p.bot.goal = null; }
      if (!sinAviso) this.spawnMsg(p);
    }
    spawnMsg(p) { this.all({ t: 'spawn', id: p.id, p: [r2(p.x), r2(p.y), r2(p.z)], ry: r2(p.ry), w: p.w }); }

    // ---------- tiros ----------
    fire(pid, m) {
      const p = this.players.get(pid);
      if (!p || !p.alive || this.phase !== 'play') return;
      const w = A[m.w]; if (!w || (m.w !== p.prim && m.w !== 'pistola')) return;
      const now = Date.now();
      if (now - (p.lastFire[m.w] || 0) < w.cad * 0.6) return;
      p.lastFire[m.w] = now; p.w = m.w; p.prot = 0;
      const hits = Array.isArray(m.hits) ? m.hits.slice(0, w.pel) : [];
      const dano = new Map();
      for (const h of hits) {
        if (!Array.isArray(h)) continue;
        const t = this.players.get(String(h[0])) || this.zombis.get(String(h[0])) || (this.mercs && this.mercs.get(String(h[0])));
        if (!t || t === p || !t.alive) continue;
        if (!t.zombi && this.companero(p, t) && !this.settings.fa) continue;   // sin fuego amigo, entre compañeros no se lastiman
        const dist = Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z);
        if (dist > w.range + 6) continue;
        const d = dano.get(t) || { v: 0, head: false };
        d.v += this.calc(w, !!h[1], dist); d.head = d.head || !!h[1]; dano.set(t, d);
      }
      const o = Array.isArray(m.o) ? m.o.slice(0, 3).map(Number) : [p.x, p.y + 1.5, p.z];
      const e = Array.isArray(m.e) ? m.e.slice(0, 9).filter(Array.isArray).map(v => v.slice(0, 3).map(Number)) : [];
      this.all({ t: 'fx', id: pid, w: m.w, o, e }, pid);
      if (this.camp) this.camp.ruido += 1;
      dano.forEach((d, t) => this.hurt(t, d.v, p, d.head, m.w));
    }
    // del mismo lado: en supervivencia todos los jugadores, en equipos los del mismo color
    companero(a, b) {
      if (!a || !b || a.zombi || b.zombi || a.merc || b.merc || a.esCamion || b.esCamion) return false;
      return this.settings.mode === 'zombis' || this.settings.mode === 'campana' || (this.settings.mode === 'equipos' && a.team === b.team);
    }
    calc(w, head, dist) {
      let v = w.dmg * (head ? w.head : 1);
      // subfusil: de lejos (más de 15 m) pega menos
      if (w === A.subfusil && dist > 15) v *= Math.max(0.5, 1 - (dist - 15) / 40);
      // escopeta: muy fuerte de cerca (hasta 4 m vale 1,5 veces), baja hasta los 8 m y después se debilita
      if (w === A.escopeta) v *= dist <= 4 ? 1.5 : dist <= 8 ? 1.5 - (dist - 4) / 8 : Math.max(0.3, 1 - (dist - 8) / 22);
      if (w === A.franco && head) v = 200;
      return v;
    }
    hurt(t, v, a, head, w) {
      const now = Date.now();
      if (t.zombi || t.merc) {
        if (!t.alive) return;
        let bl = false;
        // Teju Jagua: casi antibalas, salvo cuando queda al descubierto
        if (t.tipo === 'teju') { if (now < t.expHasta) v *= head ? 1.8 : 1; else { v *= 0.04; bl = true; } }
        // mercenario con escudo: de frente casi no le entra
        if (t.merc && t.tipo === 'escudo' && a && w !== 'granada' && w !== 'molotov') {
          const f = W.dir(t.ry, 0), dx = a.x - t.x, dz = a.z - t.z, L = Math.hypot(dx, dz) || 1;
          if ((f[0] * dx + f[2] * dz) / L > 0.45) { v *= head && !t.crouch ? 0.6 : 0.1; bl = true; }
        }
        if (t.merc && a && !a.merc && !t.tgt) { t.tgt = a; t.vista = 0.2; }
        t.hp -= v; const kill = t.hp <= 0;
        if (a) this.to(a.id, { t: 'hitm', head, kill, id: t.id, bl });
        if (kill) { if (t.merc) this.matarMerc(t, a, w, head); else this.matarZombi(t, a, w, head); }
        return;
      }
      if (!t.alive || now < t.prot) return;
      t.hp -= v; t.lastHurt = now;
      const kill = t.hp <= 0;
      this.to(t.id, { t: 'hurt', a: a.id, hp: Math.max(0, Math.round(t.hp)), from: [r2(a.x), r2(a.z)] });
      this.to(a.id, { t: 'hitm', head, kill, id: t.id });
      if (t.bot && !t.bot.tgt && a && a.alive && !a.esCamion && !this.companero(a, t)) { t.bot.tgt = a; t.bot.seen = 0.15; }
      if (kill) this.die(t, a, w, head);
    }
    die(t, a, w, head) {
      t.alive = false; t.hp = 0; t.d++; t.streak = 0; t.respawnAt = Date.now() + 3500;
      const zomb = this.settings.mode === 'zombis';
      if (zomb) t.respawnAt = Infinity;   // en supervivencia se vuelve en la próxima oleada
      if (this.camp) t.respawnAt = Date.now() + 15000;   // en la campaña, al lado de un compañero
      const amigo = a && a !== t && this.companero(a, t);
      if (amigo) this.sys(`🔥 Fuego amigo: ${a.name} bajó a ${t.name}`);
      if (a && a !== t && !a.zombi && !a.merc && !amigo) {
        a.k++; a.streak++;
        if (this.settings.mode === 'equipos') this.score[a.team]++;
      }
      this.all({ t: 'kill', a: a ? a.id : null, v: t.id, w, h: !!head, s: a ? a.streak : 0, msg: a && RACHA[a.streak] ? RACHA[a.streak] : null, an: a && a.merc && G.TiroCampana ? G.TiroCampana.MT[a.tipo].n : undefined });
      this.broadcastState();
      if (this.camp) { this.campRevisarCaidos(); return; }
      if (zomb) { if (![...this.players.values()].some(p => p.alive)) { this.sys(`💀 Cayeron todos en la oleada ${this.ola ? this.ola.n : 0}.`); this.finish('caidos'); } return; }
      const goal = this.settings.goal;
      if (this.settings.mode === 'equipos' ? (this.score.r >= goal || this.score.a >= goal) : (a && a.k >= goal)) this.finish('goal');
    }

    // ---------- reloj ----------
    tick() {
      if (this.dead) return;
      const now = Date.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      if (this.phase !== 'play') return;
      for (const p of this.players.values()) {
        if (!p.alive) { if (now >= p.respawnAt) this.respawn(p); continue; }
        if (p.hp < 100 && now - p.lastHurt > 4500) p.hp = Math.min(100, p.hp + 22 * dt);
        if (p.bot) this.botTick(p, dt, now);
      }
      if (this.ola) { this.olaTick(dt, now); for (const z of this.zombis.values()) this.zombiTick(z, dt, now); this.proyTick(dt, now); this.areasTick(dt, now); if (this.phase !== 'play') return; }
      if (this.camp) { this.campTick(dt, now); if (this.phase !== 'play') return; }
      if (now >= this.endAt) { this.finish('time'); return; }
      this.snapAcc += dt;
      if (this.snapAcc >= 0.05) {
        this.snapAcc = 0;
        const P = this.list().map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), r2(p.rx), Math.ceil(p.hp), p.alive ? 1 : 0, W.ARMA_IDS.indexOf(p.w), p.crouch ? 1 : 0, now < p.prot ? 1 : 0]);
        const m = { t: 'snap', P, tl: Math.max(0, this.endAt - now) };
        if (this.ola) {
          m.Z = [...this.zombis.values()].map(z => [z.id, TIPOS_Z.indexOf(z.tipo), r2(z.x), r2(z.y), r2(z.z), r2(z.ry), z.alive ? z.estado : 2, r2(z.vel)]);
          m.G = this.proy.map(p => [p.id, PROY.indexOf(p.tipo), r2(p.x), r2(p.y), r2(p.z)]);
          m.ol = [this.ola.n, this.ola.quedan + this.zVivos(), this.ola.pausaHasta ? 1 : 0];
        }
        if (this.camp) {
          m.Z = [...this.zombis.values()].map(z => [z.id, TIPOS_Z.indexOf(z.tipo), r2(z.x), r2(z.y), r2(z.z), r2(z.ry), z.alive ? z.estado : 2, r2(z.vel)]);
          m.G = this.proy.map(p => [p.id, PROY.indexOf(p.tipo), r2(p.x), r2(p.y), r2(p.z)]);
          Object.assign(m, this.campSnap(now));
        }
        this.all(m);
      }
    }
    // ---------- supervivencia zombi ----------
    cuantos(n) { return Math.round((3 + n * 2.5) * (0.6 + 0.25 * Math.max(1, this.players.size))); }
    olaTick(dt, now) {
      const o = this.ola;
      for (const [id, z] of this.zombis) if (!z.alive && now - z.deadAt > 2500) this.zombis.delete(id);
      if (o.pausaHasta) {
        if (now < o.pausaHasta) return;
        o.pausaHasta = 0; o.n++; o.quedan = this.cuantos(o.n); o.spawnT = 0;
        for (const p of this.players.values()) { if (!p.alive) this.respawn(p); else { p.granadas = Math.min(3, (p.granadas | 0) + 1); p.molotov = Math.min(2, (p.molotov | 0) + 1); } }
        this.all({ t: 'ola', n: o.n });
        this.sys(`🧟 ¡Oleada ${o.n}! Vienen ${o.quedan} zombis.`);
        this.broadcastState();
        return;
      }
      const vivos = this.zVivos();
      o.spawnT -= dt;
      if (o.quedan > 0 && o.spawnT <= 0 && vivos < MAX_Z) { o.spawnT = Math.max(0.35, 1.3 - o.n * 0.07); this.nuevoZombi(o.n); o.quedan--; }
      if (o.quedan === 0 && vivos === 0) {
        o.pausaHasta = now + 8000;
        this.all({ t: 'ola', fin: o.n });
        this.sys(`✅ ¡Pasaron la oleada ${o.n}! La próxima en 8 segundos (los caídos vuelven).`);
        this.broadcastState();
      }
    }
    nuevoZombi(n) {
      const r = Math.random();
      let tipo = 'zombi';
      if (n >= 2 && r < 0.2) tipo = 'gordo'; else if (n >= 3 && r < 0.36) tipo = 'brazo'; else if (r > 0.86) tipo = 'medio';
      const T = ZT[tipo], M = this.M, vivos = [...this.players.values()].filter(p => p.alive);
      // aparece lejos de los jugadores
      let best = null, bd = -1;
      for (let i = 0; i < 14; i++) {
        const c = W.puntoLibre(M); let d = 1e9;
        for (const p of vivos) d = Math.min(d, Math.hypot(p.x - c[0], p.z - c[2]));
        if (d > bd) { bd = d; best = c; }
        if (d > 22) break;
      }
      const corre = (tipo === 'zombi' || tipo === 'brazo') && Math.random() < Math.min(0.65, (n - 1) * 0.13);
      const z = this.zombiEn(tipo, best, 1 + 0.15 * (n - 1), corre);
      z.dmg = T.dmg * (1 + 0.05 * (n - 1));
    }
    zombiEn(tipo, best, k, corre) {
      const T = ZT[tipo] || ZT.zombi;
      const z = { id: 'z' + (++this.zc), zombi: true, tipo, escupe: tipo === 'gordo' || tipo === 'medio', escT: 2 + Math.random() * 3, escupiendo: 0, x: best[0], y: best[1], z: best[2], ry: 0, crouch: false, alto: T.alto,
        hp: T.hp * k, max: T.hp * k, vel: corre || tipo === 'explosivo' ? T.corre : T.camina, dmg: T.dmg * (0.9 + 0.1 * k), alive: true, estado: 0, atkT: 0.6, pathT: 0, paso: null, quieto: 0,
        s: { x: best[0], y: best[1], z: best[2], vx: 0, vy: 0, vz: 0, ground: true, crouch: false, slideT: 0 } };
      this.zombis.set(z.id, z);
      return z;
    }
    zombiTick(z, dt, now) {
      if (!z.alive) return;
      if (z.tipo === 'teju') return this.tejuTick(z, dt, now);
      const M = this.M;
      let t = null, bd = 1e9;
      if (this.camp) t = this.campZObj(z);
      else for (const p of this.players.values()) if (p.alive) { const d = Math.hypot(p.x - z.x, p.z - z.z) + Math.abs(p.y - z.y) * 2; if (d < bd) { bd = d; t = p; } }
      if (!t) { z.estado = 0; return; }
      const dx = t.x - z.x, dz = t.z - z.z, d = Math.hypot(dx, dz);
      let mx = 0, mz = 0;
      if (z.tipo === 'explosivo' && d < 1.8 && !t.ruido) return this.zExplota(z);
      // el gordo y el que se arrastra escupen ácido de lejos: nadie se puede quedar quieto en un lugar
      if (z.escupe) {
        const boca = [z.x, z.y + z.alto * 0.85, z.z];
        if (z.escupiendo > 0) {
          z.escupiendo -= dt; z.estado = 3; z.ry = Math.atan2(-dx, -dz);
          if (z.escupiendo <= 0) this.lanzar('acido', boca, this.lob(boca, [t.x, t.y + 0.4, t.z], 0.55), z);
          W.mover(M, z.s, { mx: 0, mz: 0, jump: false, crouch: false, aim: false }, dt);
          z.x = z.s.x; z.y = z.s.y; z.z = z.s.z;
          return;
        }
        z.escT -= dt;
        if (z.escT <= 0 && d > 4 && d < 24 && W.seVe(M, boca, [t.x, t.y + 1.2, t.z])) { z.escT = 4 + Math.random() * 2.5; z.escupiendo = 0.6; this.all({ t: 'escupe', id: z.id }); }
      }
      if (d < (t.esCamion ? 3.2 : t.esPuerta ? 1.8 : 1.35) && Math.abs((t.y || 0) - z.y) < 1.3 && !t.ruido) {
        z.estado = 1; z.ry = Math.atan2(-dx, -dz);
        z.atkT -= dt;
        if (z.atkT <= 0) { z.atkT = 1.1; this.mordida(t, z, now); }
      } else {
        z.estado = 0; z.atkT = Math.min(z.atkT, 0.45);
        let gx = t.x, gz = t.z;
        if (d > 3.5) {
          z.pathT -= dt;
          if (z.pathT <= 0 || !z.paso) { z.pathT = 0.35; z.paso = W.rumbo(M, z.x, z.z, t.x, t.z); }
          if (z.paso) { gx = z.paso[0]; gz = z.paso[1]; }
        }
        const ex = gx - z.x, ez = gz - z.z, L = Math.hypot(ex, ez) || 1, k = z.vel / F.SPEED;
        mx = ex / L * k; mz = ez / L * k;
        let dr = Math.atan2(-ex, -ez) - z.ry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
        z.ry += Math.max(-7 * dt, Math.min(7 * dt, dr));
      }
      // no amontonarse
      for (const o of this.zombis.values()) {
        if (o === z || !o.alive) continue;
        const sx = z.x - o.x, sz = z.z - o.z, ds = sx * sx + sz * sz;
        if (ds < 0.64 && ds > 1e-4) { const dd = Math.sqrt(ds); mx += sx / dd * 0.3; mz += sz / dd * 0.3; }
      }
      const s = z.s, ox = s.x, oz = s.z;
      W.mover(M, s, { mx, mz, jump: false, crouch: false, aim: false }, dt);
      W.liberar(M, s);
      if (z.estado === 0 && Math.hypot(s.x - ox, s.z - oz) < dt * 0.3) { if ((z.quieto += dt) > 0.7) { z.quieto = 0; z.paso = null; z.pathT = 0; if (s.ground) s.vy = F.JUMP * 0.8; } } else z.quieto = 0;
      z.x = s.x; z.y = s.y; z.z = s.z;
    }
    // velocidad para que algo tirado en arco caiga en "b"
    lob(a, b, ang) {
      const dx = b[0] - a[0], dz = b[2] - a[2], dy = b[1] - a[1], D = Math.hypot(dx, dz) || 0.01;
      let th = ang;
      for (let i = 0; i < 6; i++) {
        const c = Math.cos(th), den = 2 * c * c * (D * Math.tan(th) - dy);
        if (den > 0.01) { const v = Math.sqrt(PG * D * D / den); return [dx / D * v * c, v * Math.sin(th), dz / D * v * c]; }
        th += 0.15;
      }
      return [dx / D * 8, 8, dz / D * 8];
    }
    lanzar(tipo, o, v, dueno) {
      this.proy.push({ id: 'p' + (++this.pc), tipo, x: o[0], y: o[1], z: o[2], vx: v[0], vy: v[1], vz: v[2], t: 0, dueno });
    }
    tirar(p, m) {   // un jugador tira una granada o un molotov
      if (!(this.ola || this.camp) || !p.alive || (m.tipo !== 'granada' && m.tipo !== 'molotov' && m.tipo !== 'ruido')) return;
      const k = m.tipo === 'granada' ? 'granadas' : m.tipo === 'ruido' ? 'ruidos' : 'molotov';
      if ((p[k] | 0) <= 0) return;
      let d = Array.isArray(m.d) ? m.d.slice(0, 3).map(Number) : W.dir(p.ry, p.rx);
      const L = Math.hypot(d[0], d[1], d[2]); if (!(L > 0)) return; d = d.map(v => v / L);
      p[k]--;
      const vel = m.tipo === 'granada' ? 15 : 14;
      this.lanzar(m.tipo, [p.x + d[0] * 0.4, p.y + 1.45, p.z + d[2] * 0.4], [d[0] * vel, d[1] * vel + 2.5, d[2] * vel], p);
      this.all({ t: 'tira', id: p.id, tipo: m.tipo });
      this.broadcastState();
    }
    proyTick(dt, now) {
      const M = this.M;
      for (let i = this.proy.length - 1; i >= 0; i--) {
        const p = this.proy[i]; p.t += dt; let pego = false;
        const N = 4, h = dt / N;
        for (let k = 0; k < N; k++) {
          p.vy -= PG * h;
          const nx = p.x + p.vx * h; if (dentro(M, nx, p.y, p.z)) { p.vx *= -0.45; pego = true; } else p.x = nx;
          const nz = p.z + p.vz * h; if (dentro(M, p.x, p.y, nz)) { p.vz *= -0.45; pego = true; } else p.z = nz;
          const ny = p.y + p.vy * h, bx = dentro(M, p.x, ny, p.z);
          if (ny <= 0.06 || bx) { if (p.vy < 0) p.y = bx ? bx[4] + 0.06 : 0.06; p.vy *= -0.35; p.vx *= 0.65; p.vz *= 0.65; pego = true; } else p.y = ny;
        }
        // el ácido que le pega directo a alguien
        if (p.tipo === 'acido') for (const q of this.players.values()) if (q.alive && Math.hypot(q.x - p.x, q.z - p.z) < 0.6 && p.y > q.y && p.y < q.y + 1.9) { pego = true; this.danarJugador(q, 15, p.dueno, 'acido', now, p); }
        if (p.tipo === 'granada') { if (p.t >= 2.2) { this.explotar(p); this.proy.splice(i, 1); } }
        else if (pego || p.t > 6) { if (p.tipo !== 'humo' || p.t > 1.2 || p.vy * p.vy < 4) { this.area(p.tipo === 'molotov' ? 'fuego' : p.tipo, p, now); this.proy.splice(i, 1); } }
      }
    }
    explotar(p) {
      this.all({ t: 'boom', x: r2(p.x), y: r2(p.y), z: r2(p.z) });
      for (const z of this.zombis.values()) {
        if (!z.alive) continue;
        const d = Math.hypot(z.x - p.x, z.y + 0.8 - p.y, z.z - p.z);
        if (d < 6.5) this.hurt(z, 40 + 280 * (1 - d / 6.5), p.dueno, false, 'granada');
      }
      if (this.mercs) for (const m of this.mercs.values()) { if (!m.alive) continue; const d = Math.hypot(m.x - p.x, m.y + 0.9 - p.y, m.z - p.z); if (d < 6.5) this.hurt(m, 30 + 200 * (1 - d / 6.5), p.dueno, false, 'granada'); }
      if (p.dueno && p.dueno.merc) for (const q of this.players.values()) { if (!q.alive) continue; const d = Math.hypot(q.x - p.x, q.y + 0.9 - p.y, q.z - p.z); if (d < 6 && W.seVe(this.M, [p.x, p.y + 0.2, p.z], [q.x, q.y + 1, q.z])) this.hurt(q, 20 + 90 * (1 - d / 6), p.dueno, false, 'granada'); }
      if (this.settings.fa && p.dueno && !p.dueno.zombi) for (const q of this.players.values()) {
        if (!q.alive) continue;
        const d = Math.hypot(q.x - p.x, q.y + 0.9 - p.y, q.z - p.z);
        if (d < 6.5 && W.seVe(this.M, [p.x, p.y + 0.2, p.z], [q.x, q.y + 1, q.z])) this.hurt(q, 25 + 150 * (1 - d / 6.5), p.dueno, false, 'granada');
      }
    }
    area(tipo, p, now) {
      const M = this.M, y = W.piso(M, p.x, p.z, p.y + 0.3), fuego = tipo === 'fuego';
      const a = { id: 'a' + (++this.pc), tipo, x: p.x, y, z: p.z, r: fuego ? 3.2 : tipo === 'humo' ? 4.5 : tipo === 'ruido' ? 1 : 2.3, hasta: now + (fuego ? 7000 : tipo === 'humo' ? 11000 : tipo === 'ruido' ? 9000 : 6000), dueno: p.dueno };
      this.areas.push(a);
      this.all({ t: 'area', id: a.id, tipo, x: r2(a.x), y: r2(a.y), z: r2(a.z), r: a.r, dur: a.hasta - now });
    }
    areasTick(dt, now) {
      for (let i = this.areas.length - 1; i >= 0; i--) {
        const a = this.areas[i];
        if (now >= a.hasta) { this.areas.splice(i, 1); continue; }
        if (a.tipo === 'fuego') {
          for (const z of this.zombis.values()) {
            if (!z.alive || Math.hypot(z.x - a.x, z.z - a.z) > a.r || Math.abs(z.y - a.y) > 1.5) continue;
            z.hp -= 45 * dt;
            if (z.hp <= 0) this.matarZombi(z, a.dueno, 'molotov', false);
          }
          if (this.mercs) for (const m of this.mercs.values()) { if (m.alive && Math.hypot(m.x - a.x, m.z - a.z) < a.r && Math.abs(m.y - a.y) < 1.5) this.hurt(m, 35 * dt, a.dueno, false, 'molotov'); }
          if (this.settings.fa) for (const q of this.players.values()) {
            if (!q.alive || Math.hypot(q.x - a.x, q.z - a.z) > a.r || Math.abs(q.y - a.y) > 1.5) continue;
            this.danarJugador(q, 22 * dt, a.dueno, 'molotov', now, a);
          }
        } else if (a.tipo === 'acido') {
          for (const q of this.players.values()) {
            if (!q.alive || Math.hypot(q.x - a.x, q.z - a.z) > a.r || Math.abs(q.y - a.y) > 1.2) continue;
            this.danarJugador(q, 16 * dt, a.dueno, 'acido', now, a);
          }
        }
      }
    }
    danarJugador(q, v, z, w, now, src) {
      if (now < q.prot || !q.alive) return;
      q.hp -= v; q.lastHurt = now;
      if (!q.avisoT || now - q.avisoT > 350 || q.hp <= 0) { q.avisoT = now; this.to(q.id, { t: 'hurt', a: z ? z.id : null, hp: Math.max(0, Math.round(q.hp)), from: [r2(src.x), r2(src.z)], w }); }
      if (q.hp <= 0) this.die(q, z && z.zombi ? z : null, w, false);
    }
    mordida(t, z, now) {
      if (!this.players.has(t.id)) return this.campMorder(t, z, now);
      if (!t.alive || now < t.prot) return;
      t.hp -= z.dmg; t.lastHurt = now;
      this.to(t.id, { t: 'hurt', a: z.id, hp: Math.max(0, Math.round(t.hp)), from: [r2(z.x), r2(z.z)] });
      this.all({ t: 'muerde', id: z.id });
      if (t.bot && (!t.bot.tgt || !t.bot.tgt.alive)) { t.bot.tgt = z; t.bot.seen = 0.3; }
      if (t.hp <= 0) this.die(t, z, 'zombi', false);
    }
    matarZombi(z, a, w, head) {
      if (z.tipo === 'explosivo' && !z.exploto && this.camp) { this.zExplota(z); if (a && !a.zombi && !a.merc) { a.k++; a.streak++; } this.all({ t: 'kill', a: a ? a.id : null, v: z.id, w, h: !!head, s: a ? a.streak : 0 }); return; }
      z.alive = false; z.deadAt = Date.now(); z.estado = 2;
      if (a && !a.zombi && !a.merc) { a.k++; a.streak++; }
      this.all({ t: 'kill', a: a ? a.id : null, v: z.id, w, h: !!head, s: a && a.streak ? a.streak : 0, msg: a && RACHA[a.streak] ? RACHA[a.streak] : null, vn: z.tipo === 'teju' ? 'Teju Jagua' : undefined });
      this.broadcastState();
    }
    move(pid, m) {
      const p = this.players.get(pid);
      if (!p || !p.alive || this.phase !== 'play' || !Array.isArray(m.p)) return;
      const [x, y, z] = m.p.map(Number);
      if (![x, y, z].every(Number.isFinite)) return;
      const S = this.M.S + 1;
      p.x = Math.max(-S, Math.min(S, x)); p.y = Math.max(0, Math.min(20, y)); p.z = Math.max(-S, Math.min(S, z));
      p.ry = +m.ry || 0; p.rx = Math.max(-1.55, Math.min(1.55, +m.rx || 0));
      p.crouch = !!m.c; if (A[m.w] && (m.w === p.prim || m.w === 'pistola')) p.w = m.w;
    }

    // ---------- bots ----------
    botTick(p, dt, now) {
      const b = p.bot, M = this.M, sk = SKILL[this.settings.bots] || SKILL.normal, w = A[p.w];
      const ojo = [p.x, p.y + (p.crouch ? 0.95 : 1.55), p.z];
      b.lookT -= dt;
      if (b.tgt && (!b.tgt.alive || !(this.players.has(b.tgt.id) || this.zombis.has(b.tgt.id) || (this.mercs && this.mercs.has(b.tgt.id))))) b.tgt = null;
      if (b.lookT <= 0) {
        b.lookT = 0.2 + Math.random() * 0.1;
        let best = null, bd = sk.sense;
        for (const q of this.enemigos(p)) {
          const d = Math.hypot(q.x - p.x, q.z - p.z); if (d >= bd) continue;
          if (W.seVe(M, ojo, [q.x, q.y + (q.crouch ? 0.8 : 1.25), q.z])) { best = q; bd = d; }
        }
        if (best !== b.tgt) { b.seen = best && b.tgt ? b.seen * 0.5 : 0; b.tgt = best; }
        if (!best && b.tgt) b.tgt = null;
      }
      // recargar
      if ((this.ola || this.camp) && b.tgt && (b.tgt.zombi || b.tgt.merc) && b.tgt.tipo !== 'teju' && (p.granadas | 0) > 0) {
        b.granT = (b.granT == null ? 4 : b.granT) - dt;
        const q = b.tgt, dq = Math.hypot(q.x - p.x, q.z - p.z);
        if (b.granT <= 0 && dq > 6 && dq < 20) {
          let n = 0; for (const z of this.zombis.values()) if (z.alive && Math.hypot(z.x - q.x, z.z - q.z) < 4) n++;
          if (n >= 3) { b.granT = 8; p.granadas--; this.lanzar('granada', [p.x, p.y + 1.45, p.z], this.lob([p.x, p.y + 1.45, p.z], [q.x, q.y, q.z], 0.6), p); this.all({ t: 'tira', id: p.id, tipo: 'granada' }); }
        }
      }
      if (b.relT > 0) { b.relT -= dt; if (b.relT <= 0) b.ammo = w.mag; }
      let mx = 0, mz = 0, jump = false, aim = false, quiereRy = p.ry, quiereRx = 0;
      if (b.tgt) {
        const q = b.tgt; b.seen += dt;
        const tx = q.x, ty = q.y + (q.crouch ? 0.75 : 1.2), tz = q.z;
        const dx = tx - ojo[0], dy = ty - ojo[1], dz = tz - ojo[2], L = Math.hypot(dx, dz) || 1;
        b.errT -= dt;
        if (b.errT <= 0) { b.errT = 0.35 + Math.random() * 0.4; b.err = [(Math.random() * 2 - 1) * sk.err, (Math.random() * 2 - 1) * sk.err * 0.7]; }
        quiereRy = Math.atan2(-dx, -dz) + b.err[0]; quiereRx = Math.atan2(dy, L) + b.err[1];
        const ideal = p.w === 'escopeta' ? 5 : p.w === 'franco' ? 32 : p.w === 'pistola' ? 12 : p.w === 'subfusil' ? 9 : 15;
        b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = 0.5 + Math.random() * 1.2; b.strafe = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.18) jump = true; }
        let fw = L > ideal + 4 ? 1 : L < ideal - 3 ? -0.7 : 0;
        let st = p.w === 'franco' ? 0.25 : 1;
        mx = (dx / L) * fw + (dz / L) * b.strafe * st; mz = (dz / L) * fw - (dx / L) * b.strafe * st;
        aim = p.w === 'franco';
      } else {
        b.goalT -= dt;
        if (!b.goal || b.goalT <= 0 || Math.hypot(b.goal[0] - p.x, b.goal[1] - p.z) < 1.5) {
          b.goalT = 4 + Math.random() * 4;
          const en = this.enemigos(p);
          if (this.camp) { b.goal = this.campMeta(p); b.goalT = 1.5; }
          else if (en.length && Math.random() < 0.65) { const q = en.reduce((a, c) => Math.hypot(c.x - p.x, c.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? c : a); b.goal = [q.x, q.z]; }
          else { const c = W.puntoLibre(M); b.goal = [c[0], c[2]]; }
        }
        const r = W.rumbo(M, p.x, p.z, b.goal[0], b.goal[1]);
        if (r) { const dx = r[0] - p.x, dz = r[1] - p.z, L = Math.hypot(dx, dz) || 1; mx = dx / L; mz = dz / L; quiereRy = Math.atan2(-mx, -mz); }
      }
      // girar de a poco
      let dRy = quiereRy - p.ry; while (dRy > Math.PI) dRy -= 2 * Math.PI; while (dRy < -Math.PI) dRy += 2 * Math.PI;
      const t = sk.turn * dt * (b.tgt ? 1 : 0.8);
      p.ry += Math.max(-t, Math.min(t, dRy)); p.rx += Math.max(-t, Math.min(t, quiereRx - p.rx));
      // tirar
      if (b.tgt && b.relT <= 0 && b.seen > sk.react && Math.abs(dRy) < 0.14 && now >= b.nextFire && Math.hypot(b.tgt.x - p.x, b.tgt.z - p.z) < w.range * 0.85) {
        b.nextFire = now + w.cad * (w.auto ? 1 : 1.25 + Math.random() * 0.6) + (w.auto && Math.random() < 0.12 ? 350 : 0);
        this.botShoot(p, ojo, w, aim);
        if (--b.ammo <= 0) b.relT = w.rec / 1000;
      }
      // moverse
      for (const a of this.areas) if (a.tipo === 'acido') { const ax = p.x - a.x, az = p.z - a.z, d = Math.hypot(ax, az); if (d < a.r + 1) { mx += ax / (d || 1) * 1.5; mz += az / (d || 1) * 1.5; } }
      const L = Math.hypot(mx, mz); if (L > 1) { mx /= L; mz /= L; }
      const s = b.s, ox = s.x, oz = s.z;
      W.mover(M, s, { mx, mz, jump, crouch: false, aim }, dt);
      W.liberar(M, s);
      if (L > 0.3 && Math.hypot(s.x - ox, s.z - oz) < dt * 0.6) { if ((b.stuck += dt) > 0.4) { b.stuck = 0; b.strafe *= -1; b.goal = null; if (s.ground) s.vy = F.JUMP; } } else b.stuck = 0;
      p.x = s.x; p.y = s.y; p.z = s.z; p.crouch = s.crouch;
    }
    botShoot(p, o, w, aim) {
      const M = this.M, d0 = W.dir(p.ry, p.rx), en = this.enemigos(p);
      const e = [], dano = new Map();
      for (let i = 0; i < w.pel; i++) {
        const d = W.desvio(d0, aim ? Math.max(w.aim, 0.006) : w.hip);
        const tw = W.rayMundo(M, o, d, w.range), h = W.rayCuerpos(en, o, d, tw);
        const t = h ? h.t : tw;
        e.push([r2(o[0] + d[0] * t), r2(o[1] + d[1] * t), r2(o[2] + d[2] * t)]);
        if (h) { const q = this.players.get(h.id) || this.zombis.get(h.id) || (this.mercs && this.mercs.get(h.id)), x = dano.get(q) || { v: 0, head: false }; x.v += this.calc(w, h.head, h.t); x.head = x.head || h.head; dano.set(q, x); }
      }
      p.prot = 0;
      this.all({ t: 'fx', id: p.id, w: p.w, o: o.map(r2), e });
      dano.forEach((x, q) => this.hurt(q, x.v, p, x.head, p.w));
    }

    // ---------- entrada ----------
    handle(pid, m) {
      if (!m || typeof m !== 'object' || this.dead) return;
      const p = this.players.get(pid); if (!p) return;
      switch (m.t) {
        case 'mv': return this.move(pid, m);
        case 'fire': return this.fire(pid, m);
        case 'settings': return this.setSettings(pid, m.s);
        case 'addBot': return this.addBot(pid);
        case 'removeBot': return this.removeBot(pid, m.id);
        case 'team': return this.setTeam(pid, String(m.id || pid), m.team);
        case 'prim': return this.setPrim(pid, m.w);
        case 'lanza': return this.tirar(p, m);
        case 'usar': p.usando = !!m.on; return;
        case 'skin': if (SKINS.includes(m.skin)) { p.skin = m.skin; this.broadcastState(); } return;
        case 'start': return this.start(pid);
        case 'lobby': return this.toLobby(pid);
        case 'chat': { const text = clean(m.text, 120); if (text) this.all({ t: 'chat', kind: 'msg', id: pid, name: p.name, avatar: p.avatar, team: this.settings.mode === 'equipos' ? p.team : null, text }); return; }
        case 'voice': p.voice = !!m.on; return this.broadcastState();
        case 'rtc': { const q = this.players.get(m.to); if (q && !q.bot && q.voice && p.voice) this.to(q.id, { t: 'rtc', from: pid, data: m.data }); return; }
        case 'leave': return this.removePlayer(pid);
      }
    }
  }
  if (G.TiroCampana) G.TiroCampana.instalar(Room);
  G.TiroSala = { Room, genId, SKILL };
})(typeof window !== 'undefined' ? window : globalThis);
