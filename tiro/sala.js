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
  const COLS = 10;   // cantidad de colores de camiseta (todos contra todos)
  const genId = () => Math.random().toString(36).slice(2, 10);
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
  const r2 = v => Math.round(v * 100) / 100;
  const RACHA = { 2: '¡Doble! 🔥', 3: '¡Triple! 🔥🔥', 5: '¡Imparable! 💪', 7: '¡Hetaiterei! 😱', 10: '¡Leyenda guasu! 👑' };

  class Room {
    constructor(code, io) {
      this.code = code; this.io = io;
      this.players = new Map(); this.order = []; this.hostId = null;
      this.settings = { mode: 'ffa', map: 'mercado', goal: 20, time: 5, bots: 'normal', max: 12 };
      this.phase = 'lobby'; this.endAt = 0; this.score = { r: 0, a: 0 }; this.ranking = null; this.winner = null;
      this.dead = false; this.last = Date.now(); this.snapAcc = 0;
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
        players: this.list().map(p => ({ id: p.id, name: p.name, avatar: p.avatar, bot: !!p.bot, team: p.team, col: p.col, k: p.k, d: p.d, connected: !!p.bot || p.connected, voice: !!p.voice, prim: p.prim })),
        remaining: this.phase === 'play' ? Math.max(0, this.endAt - now) : 0, score: this.score, ranking: this.ranking, winner: this.winner,
        maps: W.MAPA_IDS.map(k => [k, W.mapa(k).n]),
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
    addPlayer({ name, avatar }) {
      if (this.players.size >= this.settings.max) return null;
      const p = this.nuevo({ token: genId() + genId(), name: clean(name, 16) || 'Jugador', avatar: clean(avatar, 8) || '😎', bot: false, connected: true });
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
      const prim = ['fusil', 'fusil', 'escopeta', 'franco'][(Math.random() * 4) | 0];
      const p = this.nuevo({ name: n, avatar: '🤖', bot: { lookT: 0, seen: 0, strafe: 1, strafeT: 0, nextFire: 0, ammo: A[prim].mag, relT: 0, goal: null, goalT: 0, err: [0, 0], errT: 0, stuck: 0 }, connected: true, prim, w: prim });
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
      if (s.mode === 'ffa' || s.mode === 'equipos') {
        if (s.mode !== st.mode && s.mode === 'equipos') { let i = 0; for (const p of this.list()) p.team = i++ % 2 ? 'a' : 'r'; }
        st.mode = s.mode;
      }
      if (W.MAPAS[s.map]) st.map = s.map;
      if ([10, 15, 20, 30, 40, 50].includes(+s.goal)) st.goal = +s.goal;
      if ([3, 5, 8, 10, 15].includes(+s.time)) st.time = +s.time;
      if (SKILL[s.bots]) st.bots = s.bots;
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
      if (this.players.size < 2) { this.to(pid, { t: 'chat', kind: 'system', text: 'Se necesitan al menos 2 jugadores (agregá bots 🤖).' }); return; }
      this.score = { r: 0, a: 0 }; this.ranking = null; this.winner = null;
      for (const p of this.players.values()) { p.k = 0; p.d = 0; p.streak = 0; this.respawn(p, true); }
      this.phase = 'play'; this.endAt = Date.now() + this.settings.time * 60000;
      this.broadcastState();
      this.sys(`🔫 ¡Arranca! ${this.settings.mode === 'equipos' ? 'Rojos contra azules' : 'Todos contra todos'} en ${this.M.n}: gana el primero en llegar a ${this.settings.goal} bajas.`);
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
      else this.winner = L[0] ? L[0].id : null;
      this.broadcastState();
      this.all({ t: 'sfx', name: 'fin' });
    }
    enemigos(p) { return [...this.players.values()].filter(q => q !== p && q.alive && (this.settings.mode !== 'equipos' || q.team !== p.team)); }
    respawn(p, sinAviso) {
      const M = this.M, en = [...this.players.values()].filter(q => q !== p && q.alive);
      let best = null, bd = -1;
      for (let i = 0; i < 18; i++) {
        const c = W.puntoLibre(M);
        let d = 1e9;
        for (const q of en) { const v = Math.hypot(q.x - c[0], q.z - c[2]) * ((this.settings.mode === 'equipos' && q.team === p.team) ? 3 : 1); if (v < d) d = v; }
        if (d > bd) { bd = d; best = c; }
      }
      [p.x, p.y, p.z] = best; p.ry = Math.atan2(p.x, p.z); p.rx = 0; p.crouch = false;
      p.hp = 100; p.alive = true; p.prot = Date.now() + 1800; p.lastHurt = 0; p.w = p.prim;
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
        const t = this.players.get(String(h[0]));
        if (!t || t === p || !t.alive) continue;
        if (this.settings.mode === 'equipos' && t.team === p.team) continue;
        const dist = Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z);
        if (dist > w.range + 6) continue;
        const d = dano.get(t) || { v: 0, head: false };
        d.v += this.calc(w, !!h[1], dist); d.head = d.head || !!h[1]; dano.set(t, d);
      }
      const o = Array.isArray(m.o) ? m.o.slice(0, 3).map(Number) : [p.x, p.y + 1.5, p.z];
      const e = Array.isArray(m.e) ? m.e.slice(0, 9).filter(Array.isArray).map(v => v.slice(0, 3).map(Number)) : [];
      this.all({ t: 'fx', id: pid, w: m.w, o, e }, pid);
      dano.forEach((d, t) => this.hurt(t, d.v, p, d.head, m.w));
    }
    calc(w, head, dist) {
      let v = w.dmg * (head ? w.head : 1);
      if (w === A.escopeta) v *= Math.max(0.35, Math.min(1, 1 - (dist - 7) / 26));
      if (w === A.franco && head) v = 200;
      return v;
    }
    hurt(t, v, a, head, w) {
      const now = Date.now();
      if (!t.alive || now < t.prot) return;
      t.hp -= v; t.lastHurt = now;
      const kill = t.hp <= 0;
      this.to(t.id, { t: 'hurt', a: a.id, hp: Math.max(0, Math.round(t.hp)), from: [r2(a.x), r2(a.z)] });
      this.to(a.id, { t: 'hitm', head, kill, id: t.id });
      if (t.bot && !t.bot.tgt && a.alive) { t.bot.tgt = a; t.bot.seen = 0.15; }
      if (kill) this.die(t, a, w, head);
    }
    die(t, a, w, head) {
      t.alive = false; t.hp = 0; t.d++; t.streak = 0; t.respawnAt = Date.now() + 3500;
      if (a && a !== t) {
        a.k++; a.streak++;
        if (this.settings.mode === 'equipos') this.score[a.team]++;
      }
      this.all({ t: 'kill', a: a ? a.id : null, v: t.id, w, h: !!head, s: a ? a.streak : 0, msg: a && RACHA[a.streak] ? RACHA[a.streak] : null });
      this.broadcastState();
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
      if (now >= this.endAt) { this.finish('time'); return; }
      this.snapAcc += dt;
      if (this.snapAcc >= 0.05) {
        this.snapAcc = 0;
        const P = this.list().map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), r2(p.rx), Math.ceil(p.hp), p.alive ? 1 : 0, W.ARMA_IDS.indexOf(p.w), p.crouch ? 1 : 0, now < p.prot ? 1 : 0]);
        this.all({ t: 'snap', P, tl: Math.max(0, this.endAt - now) });
      }
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
      if (b.tgt && (!b.tgt.alive || !this.players.has(b.tgt.id))) b.tgt = null;
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
      if (b.relT > 0) { b.relT -= dt; if (b.relT <= 0) b.ammo = w.mag; }
      let mx = 0, mz = 0, jump = false, aim = false, quiereRy = p.ry, quiereRx = 0;
      if (b.tgt) {
        const q = b.tgt; b.seen += dt;
        const tx = q.x, ty = q.y + (q.crouch ? 0.75 : 1.2), tz = q.z;
        const dx = tx - ojo[0], dy = ty - ojo[1], dz = tz - ojo[2], L = Math.hypot(dx, dz) || 1;
        b.errT -= dt;
        if (b.errT <= 0) { b.errT = 0.35 + Math.random() * 0.4; b.err = [(Math.random() * 2 - 1) * sk.err, (Math.random() * 2 - 1) * sk.err * 0.7]; }
        quiereRy = Math.atan2(-dx, -dz) + b.err[0]; quiereRx = Math.atan2(dy, L) + b.err[1];
        const ideal = p.w === 'escopeta' ? 5 : p.w === 'franco' ? 32 : p.w === 'pistola' ? 12 : 15;
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
          if (en.length && Math.random() < 0.65) { const q = en.reduce((a, c) => Math.hypot(c.x - p.x, c.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? c : a); b.goal = [q.x, q.z]; }
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
      const L = Math.hypot(mx, mz); if (L > 1) { mx /= L; mz /= L; }
      const s = b.s, ox = s.x, oz = s.z;
      W.mover(M, s, { mx, mz, jump, crouch: false, aim }, dt);
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
        if (h) { const q = this.players.get(h.id), x = dano.get(q) || { v: 0, head: false }; x.v += this.calc(w, h.head, h.t); x.head = x.head || h.head; dano.set(q, x); }
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
        case 'start': return this.start(pid);
        case 'lobby': return this.toLobby(pid);
        case 'chat': { const text = clean(m.text, 120); if (text) this.all({ t: 'chat', kind: 'msg', id: pid, name: p.name, avatar: p.avatar, team: this.settings.mode === 'equipos' ? p.team : null, text }); return; }
        case 'voice': p.voice = !!m.on; return this.broadcastState();
        case 'rtc': { const q = this.players.get(m.to); if (q && !q.bot && q.voice && p.voice) this.to(q.id, { t: 'rtc', from: pid, data: m.data }); return; }
        case 'leave': return this.removePlayer(pid);
      }
    }
  }
  G.TiroSala = { Room, genId, SKILL };
})(typeof window !== 'undefined' ? window : globalThis);
