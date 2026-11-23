/* =====================================================================
   Tiro Guasu — lo que se ve y se toca: el mundo en 3D (Three.js), tu
   jugador en primera persona, las armas, los controles (PC y celular),
   el sonido y los carteles (vida, balas, bajas, tabla).
   La sala (sala.js) es la que manda: acá se mueve uno y se avisa cada tiro.
   index.html lo usa con: Juego.conectar({...}), entrar(S), estado(S), msg(m), salir()
   ===================================================================== */
(function () {
  'use strict';
  const W = window.TiroMundo, F = W.F, A = W.ARMAS, T = window.THREE;
  const $ = s => document.querySelector(s);
  const tactil = () => matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CAMIS = ['#d52b1e', '#0038a8', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#ff6fb1', '#ecf0f1', '#34495e'];
  const TEAM = { r: '#d52b1e', a: '#1d4fd8' };
  const CAMIS_TXT = ['#ff7a6e', '#7fa8ff', '#f1c40f', '#4cd47f', '#c18be0', '#ffa24d', '#3fd1b4', '#ff8fc4', '#ffffff', '#a9b8c9'];
  const CIELO = { mercado: ['#9fd3ff', '#8d8a84', 'baldosa'], puerto: ['#b9d3e8', '#5b5e63', 'asfalto'], chaco: ['#cfe2ef', '#b87444', 'tierra'] };
  const J = window.Juego = {};
  const luz = {};   // luces de la escena (de día o de noche)
  let noche = false, linternaOn = true;
  let C = null;                 // {send, S(), me(), obs(), toast}
  let ren, scene, cam, vmScene, vmCam, mapaId = null, mapGroup = null, activo = false, raf = 0, last = 0;
  const remotos = new Map();
  const yo = { s: null, ry: 0, rx: 0, alive: false, hp: 100, w: 'fusil', prim: 'fusil', ammo: {}, reloadT: 0, reloadOf: 0, nextFire: 0, aimK: 0, kick: 0, bloom: 0, eye: 1.55, deadAt: 0, killer: null, mvT: 0, latch: false, bob: 0 };
  const inp = { keys: new Set(), fire: false, aim: false, mx: 0, mz: 0, jumpQ: false, crouchT: false, tabla: false };
  let sens = store.get('tg_sens', 1), tsens = store.get('tg_tsens', 1), fovBase = store.get('tg_fov', 80), aimToggle = store.get('tg_aimtog', false);
  let mira = 0;   // espectador: a quién se mira

  // ================= arranque =================
  J.conectar = o => { C = o; };
  function crear() {
    if (ren) return;
    const cv = $('#cv3');
    ren = new T.WebGLRenderer({ canvas: cv, antialias: !tactil(), powerPreference: 'high-performance' });
    ren.setPixelRatio(Math.min(devicePixelRatio || 1, tactil() ? 1.5 : 2));
    ren.autoClear = false;
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(fovBase, 1, 0.05, 400); cam.rotation.order = 'YXZ';
    luz.cielo = new T.HemisphereLight(0xe8f0ff, 0x6a5532, 0.8); scene.add(luz.cielo);
    luz.sol = new T.DirectionalLight(0xfff4e0, 0.75); luz.sol.position.set(30, 60, 18); scene.add(luz.sol);
    // linterna del arma (solo de noche) y el fogonazo que ilumina al tirar
    scene.add(cam);
    luz.linterna = new T.SpotLight(0xfff3d6, 0, 38, 0.42, 0.45, 1.3); luz.linterna.position.set(0.2, -0.15, 0);
    luz.linterna.target.position.set(0, -0.3, -10); cam.add(luz.linterna); cam.add(luz.linterna.target);
    luz.destello = new T.PointLight(0xffc870, 0, 14, 2); luz.destello.position.set(0.2, -0.1, -0.6); cam.add(luz.destello);
    luz.boom = new T.PointLight(0xffa040, 0, 22, 2); scene.add(luz.boom);
    luz.fuego = new T.PointLight(0xff7a20, 0, 11, 2); scene.add(luz.fuego);
    vmScene = new T.Scene(); vmCam = new T.PerspectiveCamera(62, 1, 0.01, 10);
    luz.vm1 = new T.HemisphereLight(0xffffff, 0x555555, 1.0); vmScene.add(luz.vm1);
    luz.vm2 = new T.DirectionalLight(0xffffff, 0.5); luz.vm2.position.set(1, 2, 1); vmScene.add(luz.vm2);
    armarVM();
    if (modelosListos) { try { armasVM(); } catch (e) { console.warn('armas 3D', e); } }   // si los modelos cargaron antes que la pantalla 3D
    addEventListener('resize', medir); medir();
    controles();
  }
  function medir() {
    if (!ren) return;
    const w = innerWidth, h = innerHeight;
    ren.setSize(w, h, false); cam.aspect = vmCam.aspect = w / h; cam.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
  }

  // ================= texturas =================
  const texCache = {};
  function tex(tipo) {
    if (texCache[tipo]) return texCache[tipo];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const ruido = (a) => { const im = g.getImageData(0, 0, 128, 128), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(im, 0, 0); };
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 128, 128);
    if (tipo === 'ladrillo') { g.fillStyle = '#9a9a9a'; for (let y = 0; y < 128; y += 16) { g.fillRect(0, y, 128, 2); for (let x = (y / 16) % 2 ? 0 : 16; x < 128; x += 32) g.fillRect(x, y, 2, 16); } ruido(30); }
    else if (tipo === 'madera') { for (let y = 0; y < 128; y += 21) { g.fillStyle = '#b8b8b8'; g.fillRect(0, y, 128, 2); } for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(120,120,120,.25)'; g.fillRect(0, Math.random() * 128, 128, 1); } ruido(22); }
    else if (tipo === 'chapa') { for (let x = 0; x < 128; x += 10) { g.fillStyle = '#ffffff'; g.fillRect(x, 0, 4, 128); g.fillStyle = '#b4b4b4'; g.fillRect(x + 6, 0, 2, 128); } ruido(14); }
    else if (tipo === 'baldosa') { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#a8a8a8'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128); g.fillRect(0, 63, 128, 3); g.fillRect(63, 0, 3, 128); ruido(26); }
    else if (tipo === 'asfalto') { ruido(40); g.fillStyle = 'rgba(255,220,0,.7)'; g.fillRect(0, 60, 128, 6); }
    else if (tipo === 'tierra') { ruido(55); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(90,60,20,.18)'; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 6, 0, 7); g.fill(); } }
    else ruido(28);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    return texCache[tipo] = t;
  }
  const TIPO = { 14: 'ladrillo', 1: 'ladrillo', 2: 'madera', 9: 'madera', 3: 'chapa', 4: 'chapa', 5: 'chapa', 6: 'chapa', 10: 'chapa' };
  const matCache = {};
  function matCaja(c) { return matCache[c] || (matCache[c] = new T.MeshPhongMaterial({ color: W.PAL[c], map: tex(TIPO[c] || 'ruido'), shininess: 6, specular: 0x111111 })); }
  function cajaGeo(w, h, d) {
    const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const esc2 = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * esc2[f][0] / 2, uv.getY(i) * esc2[f][1] / 2); }
    return g;
  }

  // ================= el mapa =================
  function cargarMapa(id) {
    if (mapaId === id && mapGroup) return;
    if (mapGroup) { scene.remove(mapGroup); mapGroup.traverse(o => o.geometry && o.geometry.dispose()); }
    mapaId = id; const M = W.mapa(id), cfg = CIELO[id] || CIELO.mercado;
    mapGroup = new T.Group();
    scene.background = new T.Color(cfg[0]); scene.fog = new T.Fog(cfg[0], 45, 150);
    const ft = tex(cfg[2]).clone(); ft.needsUpdate = true; ft.repeat.set(M.S, M.S);
    const piso = new T.Mesh(new T.PlaneGeometry(2 * M.S + 2, 2 * M.S + 2), new T.MeshPhongMaterial({ color: cfg[1], map: ft, shininess: 4, specular: 0x0a0a0a }));
    piso.rotation.x = -Math.PI / 2; mapGroup.add(piso);
    // afuera: agua en el puerto, campo en las demás
    const afuera = new T.Mesh(new T.PlaneGeometry(600, 600), new T.MeshLambertMaterial({ color: id === 'puerto' ? '#3b6f8f' : id === 'chaco' ? '#9a7a3e' : '#6f8a52' }));
    afuera.rotation.x = -Math.PI / 2; afuera.position.y = -0.05; mapGroup.add(afuera);
    for (const b of M.boxes) {
      const w = b[3] - b[0], h = b[4] - b[1], d = b[5] - b[2];
      const m = new T.Mesh(cajaGeo(w, h, d), matCaja(b[6]));
      m.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); mapGroup.add(m);
    }
    // árboles y cerros de lejos para que no se vea vacío
    const tronco = new T.MeshLambertMaterial({ color: '#6b4a2b' }), copa = new T.MeshLambertMaterial({ color: id === 'chaco' ? '#7d8f3a' : '#3f7d3a' });
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2 + Math.random() * 0.1, r = M.S + 10 + Math.random() * 30;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 4 + Math.random() * 6;
      const t1 = new T.Mesh(new T.BoxGeometry(0.6, h, 0.6), tronco); t1.position.set(x, h / 2, z); mapGroup.add(t1);
      const t2 = new T.Mesh(new T.BoxGeometry(3 + Math.random() * 3, 2.5, 3 + Math.random() * 3), copa); t2.position.set(x, h + 1, z); mapGroup.add(t2);
    }
    // bandera paraguaya en un mástil
    const mastil = new T.Mesh(new T.BoxGeometry(0.15, 9, 0.15), new T.MeshLambertMaterial({ color: '#dddddd' })); mastil.position.set(M.S - 3, 4.5, -M.S + 3); mapGroup.add(mastil);
    const bc = document.createElement('canvas'); bc.width = 90; bc.height = 60; const bg = bc.getContext('2d');
    bg.fillStyle = '#d52b1e'; bg.fillRect(0, 0, 90, 20); bg.fillStyle = '#fff'; bg.fillRect(0, 20, 90, 20); bg.fillStyle = '#0038a8'; bg.fillRect(0, 40, 90, 20);
    bg.fillStyle = '#f5c518'; bg.beginPath(); bg.arc(45, 30, 6, 0, 7); bg.fill();
    const band = new T.Mesh(new T.PlaneGeometry(2.4, 1.6), new T.MeshLambertMaterial({ map: new T.CanvasTexture(bc), side: T.DoubleSide }));
    band.position.set(M.S - 3 - 1.25, 8, -M.S + 3); mapGroup.add(band);
    scene.add(mapGroup);
  }

  // ================= muñecos de los otros =================
  const skinM = new T.MeshLambertMaterial({ color: '#c99a73' }), pantsM = new T.MeshLambertMaterial({ color: '#2d3340' }), negroM = new T.MeshLambertMaterial({ color: '#1b1b1b' });
  let rayadaTex = null;
  function matCamisa(p, modo) {
    if (modo === 'equipos' && p.team === 'r') {
      if (!rayadaTex) { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#d52b1e'; g.fillRect(i * 8, 0, 8, 16); } rayadaTex = new T.CanvasTexture(c); }
      return new T.MeshLambertMaterial({ map: rayadaTex });
    }
    return new T.MeshLambertMaterial({ color: modo === 'equipos' ? TEAM[p.team] : CAMIS[p.col % CAMIS.length] });
  }
  function cartel(txt, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.font = 'bold 34px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(txt, 128, 32); g.fillStyle = color; g.fillText(txt, 128, 32);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false, transparent: true }));
    s.scale.set(1.7, 0.42, 1); return s;
  }
  function muneco(p, modo) {
    if (modelosListos) { const m = modeloDe(p, modo); if (m) return m; }
    const g = new T.Group(), camisa = matCamisa(p, modo), skin = skinM.clone(), pants = pantsM.clone(), negro = negroM.clone();
    const pierna1 = new T.Mesh(new T.BoxGeometry(0.22, 0.82, 0.24), pants), pierna2 = pierna1.clone();
    pierna1.position.set(-0.14, 0.41, 0); pierna2.position.set(0.14, 0.41, 0);
    const arriba = new T.Group(); arriba.position.y = 0.82;
    const torso = new T.Mesh(new T.BoxGeometry(0.62, 0.62, 0.34), camisa); torso.position.y = 0.31;
    const cabeza = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.4), skin); cabeza.position.y = 0.83;
    const pelo = new T.Mesh(new T.BoxGeometry(0.42, 0.12, 0.42), negro); pelo.position.y = 1.06;
    const ojo1 = new T.Mesh(new T.BoxGeometry(0.07, 0.07, 0.02), negro), ojo2 = ojo1.clone();
    ojo1.position.set(-0.09, 0.86, -0.205); ojo2.position.set(0.09, 0.86, -0.205);
    const brazos = new T.Group(); brazos.position.y = 0.5;
    const b1 = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 0.5), camisa), b2 = b1.clone();
    b1.position.set(-0.3, 0, -0.2); b2.position.set(0.22, 0, -0.25);
    const arma = new T.Mesh(new T.BoxGeometry(0.09, 0.12, 0.75), negro); arma.position.set(0.05, 0.02, -0.55);
    brazos.add(b1, b2, arma);
    arriba.add(torso, cabeza, pelo, ojo1, ojo2, brazos);
    g.add(pierna1, pierna2, arriba);
    const nom = cartel(p.name, modo === 'equipos' ? (p.team === 'r' ? '#ff8a80' : '#8ab4ff') : '#ffffff'); nom.position.y = 2.15; g.add(nom);
    const haz = hazDeLuz(); g.add(haz);
    g.userData = { arriba, brazos, pierna1, pierna2, nom, cabeza, camisa, arma, armaMat: negro, haz };
    scene.add(g);
    return g;
  }
  function remoto(p) {
    const S = C.S(); let r = remotos.get(p.id);
    const key = (S.settings.mode === 'equipos' ? p.team : 'c' + p.col) + p.name + (modelosListos ? 'M' + (p.skin || '') : 'B');
    if (r && r.key !== key) { scene.remove(r.g); r = null; }
    if (!r) {
      r = { g: muneco(p, S.settings.mode), key, buf: [], alive: false, hp: 100, w: 0, crouch: false, prot: false, caida: 0, team: p.team, cur: null, paso: 0 };
      r.g.visible = false; remotos.set(p.id, r);
    }
    r.team = p.team; r.name = p.name; r.avatar = p.avatar;
    return r;
  }

  // ================= personajes y armas en 3D =================
  // Modelos "Toon Shooter Game Kit" de Quaternius (licencia CC0, uso libre): modelos/*.glb.
  // Cada personaje trae todas las armas en la mano derecha; se muestra solo la que usa.
  // Si no cargan (sin internet para el cargador), quedan los muñecos de cajas.
  const ARCHIVOS = { soldado: 'modelos/soldado.glb', enemigo: 'modelos/enemigo.glb', hazmat: 'modelos/hazmat.glb' };
  const PERSONAJES = {
    soldado:   { base: 'soldado' },
    albirrojo: { base: 'soldado', pintar: { Character_Main: '#c8241a', Pants: '#e8e8e8' } },
    enemigo:   { base: 'enemigo' },
    hazmat:    { base: 'hazmat' },
  };
  const MAIN = { soldado: 'Character_Main', enemigo: 'Enemy_Red', hazmat: 'Hazmat_Main' };
  const ARMA_NODO = { fusil: 'AK', subfusil: 'SMG', escopeta: 'Shotgun', franco: 'Sniper', pistola: 'Pistol' };
  const NODOS_ARMA = ['AK', 'SMG', 'Shotgun', 'Sniper', 'Sniper_2', 'Pistol', 'Revolver', 'Revolver_Small', 'GrenadeLauncher', 'ShortCannon', 'RocketLauncher', 'Shovel', 'Knife_1', 'Knife_2'];
  const GLB = {}; let modelosListos = false, cargando = null;
  J.cargarModelos = () => {
    if (cargando) return cargando;
    if (!T.GLTFLoader || !T.SkeletonUtils) return Promise.resolve(false);
    const L = new T.GLTFLoader();
    cargando = Promise.all(Object.entries(ARCHIVOS).map(([k, u]) => new Promise(res =>
      L.load(u, g => { prepararGLB(g); GLB[k] = g; res(); }, null, () => res()))))
      .then(() => {
        modelosListos = !!GLB.soldado;
        if (modelosListos) { try { armasVM(); } catch (e) { console.warn('armas 3D', e); } rehacer(); }
        return modelosListos;
      });
    return cargando;
  };
  J.modelosListos = () => modelosListos;
  // los colores de los modelos vienen "lineales": se pasan a como se ve el resto del juego
  function prepararGLB(g) {
    const vistos = new Set();
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      for (const m of [].concat(o.material)) { if (vistos.has(m)) continue; vistos.add(m); if (m.color) m.color.convertLinearToSRGB(); if (m.map) { m.map.encoding = T.LinearEncoding; m.needsUpdate = true; } m.metalness = 0; m.roughness = 0.8; }
    });
  }
  // cuando terminan de cargar, se cambian los muñecos de cajas por los modelos
  function rehacer() {
    if (!scene || !C || !C.S()) return;
    for (const r of remotos.values()) scene.remove(r.g);
    remotos.clear();
    if (activo) J.estado(C.S());
  }
  function modeloDe(p, modo) {
    const per = PERSONAJES[p.skin] || PERSONAJES.soldado, gl = GLB[per.base] || GLB.soldado;
    if (!gl) return null;
    const m = T.SkeletonUtils.clone(gl.scene);
    // materiales propios de este muñeco (para pintarlo y hacerlo transparente al reaparecer)
    const mats = new Map(), cm = x => { if (!mats.has(x)) mats.set(x, x.clone()); return mats.get(x); };
    m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = Array.isArray(o.material) ? o.material.map(cm) : cm(o.material); } });
    const pintar = Object.assign({}, per.pintar || {});
    if (modo === 'equipos') pintar[MAIN[per.base]] = p.team === 'r' ? '#c8241a' : '#1d4fd8';
    mats.forEach(c => { if (pintar[c.name]) c.color.set(pintar[c.name]); });
    const g = new T.Group(), dentro = new T.Group();
    dentro.add(m); dentro.rotation.y = Math.PI; dentro.scale.setScalar(0.82); g.add(dentro);
    const armas = {};
    for (const n of NODOS_ARMA) { const o = m.getObjectByName(n); if (o) { o.visible = false; armas[n] = o; } }
    const mixer = new T.AnimationMixer(m), clip = re => gl.animations.find(a => re.test(a.name));
    const acc = {};
    for (const [k, re] of [['quieto', /(^|\|)Idle$/], ['corre', /(^|\|)Run_Gun$/], ['agacha', /(^|\|)Duck$/], ['muere', /(^|\|)Death$/], ['tira', /(^|\|)Idle_Shoot$/]]) {
      const c = clip(re); if (c) acc[k] = mixer.clipAction(c);
    }
    if (acc.muere) { acc.muere.setLoop(T.LoopOnce, 1); acc.muere.clampWhenFinished = true; }
    const nom = cartel(p.name, modo === 'equipos' ? (p.team === 'r' ? '#ff8a80' : '#8ab4ff') : '#ffffff'); nom.position.y = 2.1; g.add(nom);
    const haz = hazDeLuz(); g.add(haz);
    g.userData = { modelo: true, mixer, acc, armas, mats: [...mats.values()], nom, actual: null, armaVis: null, haz };
    scene.add(g);
    return g;
  }
  // elige la animación según lo que hace y muestra el arma que tiene en la mano
  function animar(r, vel, dt) {
    const u = r.g.userData;
    const nodo = ARMA_NODO[W.ARMA_IDS[r.w]] || 'AK';
    if (u.armaVis !== nodo) { if (u.armas[u.armaVis]) u.armas[u.armaVis].visible = false; if (u.armas[nodo]) u.armas[nodo].visible = true; u.armaVis = nodo; }
    if (r.tiroT > 0) r.tiroT -= dt;
    const q = !r.alive ? 'muere' : r.crouch ? 'agacha' : vel > 0.8 ? 'corre' : r.tiroT > 0 ? 'tira' : 'quieto';
    if (q !== u.actual) {
      const antes = u.acc[u.actual], luego = u.acc[q];
      if (luego) {
        luego.reset(); luego.play();
        if (antes) antes.crossFadeTo(luego, q === 'muere' ? 0.08 : 0.18, false);
      }
      u.actual = q;
    }
    // agachado: se queda en la parte baja de la animación
    if (q === 'agacha' && u.acc.agacha && u.acc.agacha.time >= 0.6) { u.acc.agacha.time = 0.6; u.acc.agacha.paused = true; }
    if (q === 'corre' && u.acc.corre) u.acc.corre.timeScale = Math.max(0.6, Math.min(1.5, vel / 5.5));
    u.mixer.update(dt);
  }
  // armas 3D en primera persona: se sacan del soldado en pose de disparo para que apunten hacia adelante
  const LARGO = { fusil: 0.78, subfusil: 0.5, escopeta: 0.85, franco: 1.0, pistola: 0.3 };
  function armasVM() {
    const gl = GLB.soldado, m = T.SkeletonUtils.clone(gl.scene), mix = new T.AnimationMixer(m);
    const c = gl.animations.find(a => /(^|\|)Idle_Shoot$/.test(a.name));
    if (c) { mix.clipAction(c).play(); mix.update(0); }
    m.updateMatrixWorld(true);
    const giro = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI);
    for (const w in ARMA_NODO) {
      const src = m.getObjectByName(ARMA_NODO[w]); if (!src || !VM[w]) continue;
      const q = new T.Quaternion(), ws = new T.Vector3();
      src.getWorldQuaternion(q); src.getWorldScale(ws);
      const it = src.clone(); it.visible = true; it.position.set(0, 0, 0); it.quaternion.copy(giro.clone().multiply(q)); it.scale.copy(ws);
      const h = new T.Group(); h.add(it); h.updateMatrixWorld(true);
      let b = new T.Box3().setFromObject(h);
      const largo = Math.max(1e-6, b.max.z - b.min.z);
      it.scale.multiplyScalar(LARGO[w] / largo); h.updateMatrixWorld(true);
      b = new T.Box3().setFromObject(h);
      it.position.set(-(b.min.x + b.max.x) / 2, -b.max.y + 0.02, 0.12 - b.max.z);
      const g = VM[w];
      g.children.slice().forEach(ch => g.remove(ch));   // fuera el arma y las manos de cajas
      g.add(h);
      PUNTA[w] = 0.12 - LARGO[w];
    }
  }

  // ================= zombis (modo supervivencia) =================
  // Modelos del "Zombie Apocalypse Kit" de Quaternius (Poly Pizza): zombi común (CC0), gordo,
  // de brazo grande y el que se arrastra (CC-BY 3.0, con crédito en la ayuda).
  const TIPOS_Z = ['zombi', 'gordo', 'brazo', 'medio'];
  const ARCH_Z = { zombi: 'modelos/zombi.glb', gordo: 'modelos/zombi_gordo.glb', brazo: 'modelos/zombi_brazo.glb', medio: 'modelos/zombi_medio.glb' };
  const ALTO_Z = { zombi: 1.8, gordo: 1.85, brazo: 2.05, medio: 0.75 };
  const GLBZ = {}; let cargandoZ = null;
  const zombis = new Map();
  J.cargarZombis = () => {
    if (cargandoZ) return cargandoZ;
    if (!T.GLTFLoader || !T.SkeletonUtils) return Promise.resolve(false);
    const L = new T.GLTFLoader();
    cargandoZ = Promise.all(Object.entries(ARCH_Z).map(([k, u]) => new Promise(res =>
      L.load(u, g => { prepararGLB(g); medirZ(g, k); GLBZ[k] = g; res(); }, null, () => res()))))
      .then(() => { for (const z of zombis.values()) scene.remove(z.g); zombis.clear(); return true; });
    return cargandoZ;
  };
  // escala para que cada zombi tenga su alto
  function medirZ(g, k) {
    g.scene.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(g.scene), h = Math.max(0.01, b.max.y - b.min.y);
    g.userData.escala = ALTO_Z[k] / h;
    g.userData.suelo = -b.min.y;
  }
  function zombiNuevo(tipo) {
    const gl = GLBZ[tipo] || GLBZ.zombi;
    const g = new T.Group(); let u;
    if (gl) {
      const m = T.SkeletonUtils.clone(gl.scene);
      m.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
      const dentro = new T.Group(); dentro.add(m); dentro.rotation.y = Math.PI;
      const e = gl.userData.escala || 1; dentro.scale.setScalar(e); dentro.position.y = (gl.userData.suelo || 0) * e;
      g.add(dentro);
      const mixer = new T.AnimationMixer(m), clip = re => gl.animations.find(a => re.test(a.name));
      const acc = {};
      const pide = { quieto: [/(^|\|)(Zombie)?Idle$/], camina: [/(^|\|)Walk$/, /(^|\|)Crawl$/], corre: [/(^|\|)Run_Arms$/, /(^|\|)Run$/, /(^|\|)Crawl$/],
        ataca: [/(^|\|)Punch$/, /(^|\|)Idle_Attack$/, /(^|\|)Run_Attack$/, /(^|\|)Attack$/, /(^|\|)Crawl$/], muere: [/(^|\|)Death$/] };
      if (tipo === 'medio') { pide.camina = [/(^|\|)Crawl$/]; pide.corre = [/(^|\|)Crawl$/]; pide.ataca = [/(^|\|)Crawl$/]; }
      for (const k in pide) { for (const re of pide[k]) { const c = clip(re); if (c) { acc[k] = mixer.clipAction(c); break; } } }
      if (acc.muere) { acc.muere.setLoop(T.LoopOnce, 1); acc.muere.clampWhenFinished = true; }
      u = { modelo: true, mixer, acc, actual: null };
    } else {
      // sin modelos: un muñeco verde de cajas
      const mat = new T.MeshLambertMaterial({ color: '#5f8a3a' }), ropa = new T.MeshLambertMaterial({ color: '#4a3b2a' });
      const alto = ALTO_Z[tipo] || 1.8, c1 = new T.Mesh(new T.BoxGeometry(0.6, alto * 0.45, 0.35), ropa); c1.position.y = alto * 0.5;
      const c2 = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.4), mat); c2.position.y = alto * 0.85;
      const b1 = new T.Mesh(new T.BoxGeometry(0.15, 0.15, 0.6), mat); b1.position.set(0.2, alto * 0.65, -0.3); const b2 = b1.clone(); b2.position.x = -0.2;
      g.add(c1, c2, b1, b2); u = { modelo: false };
    }
    g.userData = u; scene.add(g);
    return g;
  }
  function animarZ(z, dt) {
    const u = z.g.userData;
    if (!u.modelo) { if (z.estado === 2) z.g.rotation.x = -Math.min(1.5, (z.muerto || 0) * 4); return; }
    const q = z.estado === 2 ? 'muere' : z.estado === 1 || z.estado === 3 ? 'ataca' : z.vel > 3 ? 'corre' : z.velS > 0.3 ? 'camina' : 'quieto';
    if (q !== u.actual) {
      const antes = u.acc[u.actual], luego = u.acc[q] || u.acc.camina;
      if (luego && luego !== antes) { luego.reset(); luego.play(); if (antes) antes.crossFadeTo(luego, q === 'muere' ? 0.1 : 0.25, false); }
      u.actual = q;
    }
    if (q === 'camina' && u.acc.camina) u.acc.camina.timeScale = Math.max(0.6, Math.min(1.6, z.velS / 1.8));
    u.mixer.update(dt);
  }
  function zombisSnap(Z) {
    const now = performance.now(), vistos = new Set();
    for (const e of Z) {
      const [id, ti, x, y, zz, ry, estado, vel] = e; vistos.add(id);
      let z = zombis.get(id);
      if (!z) { const tipo = TIPOS_Z[ti] || 'zombi'; z = { id, tipo, g: zombiNuevo(tipo), buf: [], estado: 0, vel: 0, velS: 0, cur: null, gruT: 2 + Math.random() * 5, muerto: 0 }; zombis.set(id, z); }
      if (estado === 2 && z.estado !== 2) z.muerto = 0.001;
      z.estado = estado; z.vel = vel;
      z.buf.push({ t: now, x, y, z: zz, ry, rx: 0 }); if (z.buf.length > 30) z.buf.shift();
    }
    for (const [id, z] of zombis) if (!vistos.has(id)) { scene.remove(z.g); zombis.delete(id); }
  }
  function interp(buf, rt) {
    let a = buf[0], c = buf[buf.length - 1];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t <= rt) { a = buf[i]; c = buf[i + 1] || buf[i]; break; }
    const k = c.t > a.t ? Math.max(0, Math.min(1, (rt - a.t) / (c.t - a.t))) : 1;
    let dr = c.ry - a.ry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
    return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k, ry: a.ry + dr * k };
  }
  function zombisTick(dt, rt) {
    for (const z of zombis.values()) {
      if (!z.buf.length) continue;
      const cur = interp(z.buf, rt);
      const v = z.cur ? Math.hypot(cur.x - z.cur.x, cur.z - z.cur.z) / Math.max(dt, 0.001) : 0;
      z.velS = z.velS * 0.85 + Math.min(v, 10) * 0.15;
      z.cur = cur;
      if (z.estado === 2) z.muerto += dt;
      z.g.visible = z.estado !== 2 || z.muerto < 2.4;
      z.g.position.set(cur.x, cur.y, cur.z); z.g.rotation.y = cur.ry;
      animarZ(z, dt);
      // gruñidos de vez en cuando (más seguido si está cerca)
      if (z.estado !== 2 && (z.gruT -= dt) <= 0) { z.gruT = 3 + Math.random() * 6; gruDe(z.cur, z.tipo); }
    }
  }
  function gruDe(p, tipo) {
    if (!soundOn || !actx || !cam) return;
    const dx = p.x - cam.position.x, dz = p.z - cam.position.z, d = Math.hypot(dx, dz);
    if (d > 26) return;
    const vol = Math.pow(1 - d / 26, 1.5) * 0.5, rel = Math.atan2(-dx, -dz) - cam.rotation.y;
    try {
      const t = actx.currentTime, dur = 0.6 + Math.random() * 0.6, o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
      const base = tipo === 'gordo' ? 70 : tipo === 'brazo' ? 85 : tipo === 'medio' ? 140 : 105;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t); o.frequency.linearRampToValueAtTime(base * 0.75, t + dur);
      const lfo = actx.createOscillator(), lg = actx.createGain(); lfo.frequency.value = 7 + Math.random() * 6; lg.gain.value = base * 0.08; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 450 + Math.random() * 300; f.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g; if (actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, -Math.sin(rel) * Math.min(1, d / 3))); g.connect(pn); out = pn; }
      o.connect(f); f.connect(g); out.connect(actx.destination);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    } catch (e) { }
  }
  const esZombi = id => typeof id === 'string' && zombis.has(id);

  // ================= granadas, molotov y ácido =================
  const PROY = ['granada', 'molotov', 'acido'];
  const proys = new Map(), areas = [], humos = [];
  let geoG = null;
  function proyNuevo(tipo) {
    if (!geoG) geoG = { esfera: new T.SphereGeometry(1, 10, 8), botella: new T.CylinderGeometry(0.05, 0.07, 0.28, 8) };
    const g = new T.Group();
    if (tipo === 'granada') { g.add(new T.Mesh(geoG.esfera, new T.MeshPhongMaterial({ color: '#3d4a2a' }))); g.children[0].scale.setScalar(0.1); }
    else if (tipo === 'molotov') {
      const b = new T.Mesh(geoG.botella, new T.MeshPhongMaterial({ color: '#6b3d12', transparent: true, opacity: 0.85 })); g.add(b);
      const llama = new T.Sprite(new T.SpriteMaterial({ map: brillo('#ffb040'), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); llama.scale.set(0.35, 0.35, 1); llama.position.y = 0.2; g.add(llama);
    } else {
      const a = new T.Sprite(new T.SpriteMaterial({ map: brillo('#7dff3a'), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); a.scale.set(0.7, 0.7, 1); g.add(a);
      const c = new T.Mesh(geoG.esfera, new T.MeshBasicMaterial({ color: '#8cff2a' })); c.scale.setScalar(0.14); g.add(c);
    }
    scene.add(g); return g;
  }
  const brillos = {};
  function brillo(col) {
    if (brillos[col]) return brillos[col];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return brillos[col] = new T.CanvasTexture(c);
  }
  function proysSnap(G) {
    const vistos = new Set();
    for (const [id, ti, x, y, z] of G) {
      vistos.add(id);
      let p = proys.get(id);
      if (!p) { p = { g: proyNuevo(PROY[ti] || 'granada'), tipo: PROY[ti], obj: [x, y, z] }; p.g.position.set(x, y, z); proys.set(id, p); }
      p.obj = [x, y, z];
    }
    for (const [id, p] of proys) if (!vistos.has(id)) { scene.remove(p.g); proys.delete(id); }
  }
  function proysTick(dt) {
    const k = Math.min(1, dt * 14);
    for (const p of proys.values()) {
      p.g.position.x += (p.obj[0] - p.g.position.x) * k; p.g.position.y += (p.obj[1] - p.g.position.y) * k; p.g.position.z += (p.obj[2] - p.g.position.z) * k;
      p.g.rotation.x += dt * 9; p.g.rotation.z += dt * 6;
    }
    // fuegos y charcos de ácido
    let fuegoCerca = null, fd = 1e9;
    for (let i = areas.length - 1; i >= 0; i--) {
      const a = areas[i]; a.t += dt;
      if (a.t >= a.dur) { scene.remove(a.g); areas.splice(i, 1); continue; }
      const fin = Math.min(1, (a.dur - a.t) / 0.8);
      a.g.children.forEach((c, j) => {
        if (c.isSprite) {
          const u = c.userData;
          if (a.tipo === 'fuego') { u.f += dt * (2 + u.v); const s = (0.9 + Math.sin(u.f * 5) * 0.25) * u.s * fin; c.scale.set(s, s * 1.5, 1); c.position.y = u.y + s * 0.5; }
          else { u.f += dt * u.v; c.position.y = 0.05 + (u.f % 1) * 0.5; c.material.opacity = (1 - (u.f % 1)) * 0.8 * fin; }
        } else if (c.material) c.material.opacity = (a.tipo === 'fuego' ? 0.35 : 0.55) * fin;
      });
      if (a.tipo === 'fuego') { const d = cam ? Math.hypot(a.x - cam.position.x, a.z - cam.position.z) : 0; if (d < fd) { fd = d; fuegoCerca = a; } if ((a.crepT -= dt) <= 0) { a.crepT = 0.12 + Math.random() * 0.25; crepita(a); } }
    }
    if (luz.fuego) {
      if (fuegoCerca) { luz.fuego.position.set(fuegoCerca.x, fuegoCerca.y + 1, fuegoCerca.z); luz.fuego.intensity = (noche ? 2.2 : 1) * (0.8 + Math.random() * 0.4); }
      else luz.fuego.intensity = 0;
    }
    if (luz.boom && luz.boom.intensity > 0) luz.boom.intensity = Math.max(0, luz.boom.intensity - dt * 14);
    for (let i = humos.length - 1; i >= 0; i--) {
      const h = humos[i]; h.t += dt;
      if (h.t >= h.max) { scene.remove(h.o); humos.splice(i, 1); continue; }
      const k2 = h.t / h.max; h.o.scale.setScalar(h.s0 + h.s1 * k2); h.o.material.opacity = h.op * (1 - k2); h.o.position.y += dt * h.sube;
    }
  }
  function area(m) {
    const g = new T.Group(); g.position.set(m.x, m.y + 0.03, m.z);
    const a = { tipo: m.tipo, x: m.x, y: m.y, z: m.z, dur: (m.dur || 6000) / 1000, t: 0, g, crepT: 0 };
    if (m.tipo === 'fuego') {
      const disco = new T.Mesh(new T.CircleGeometry(m.r, 24), new T.MeshBasicMaterial({ color: '#ff5a10', transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }));
      disco.rotation.x = -Math.PI / 2; g.add(disco);
      for (let i = 0; i < 16; i++) {
        const an = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * m.r * 0.9;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: brillo(i % 3 ? '#ff8a1a' : '#ffd040'), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.position.set(Math.cos(an) * r, 0.3, Math.sin(an) * r); sp.userData = { f: Math.random() * 6, v: Math.random(), s: 0.7 + Math.random() * 0.8, y: 0 }; g.add(sp);
      }
      fuegoSnd(m);
    } else {
      const disco = new T.Mesh(new T.CircleGeometry(m.r, 24), new T.MeshBasicMaterial({ color: '#5aff1a', transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
      disco.rotation.x = -Math.PI / 2; g.add(disco);
      for (let i = 0; i < 10; i++) {
        const an = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * m.r * 0.85;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: brillo('#9dff4a'), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.scale.set(0.25, 0.25, 1); sp.position.set(Math.cos(an) * r, 0.05, Math.sin(an) * r); sp.userData = { f: Math.random(), v: 0.6 + Math.random() }; g.add(sp);
      }
      chisporrotea(m);
    }
    scene.add(g); areas.push(a);
  }
  function boom(m) {
    const d = cam ? Math.hypot(m.x - cam.position.x, m.y - cam.position.y, m.z - cam.position.z) : 30;
    if (luz.boom) { luz.boom.position.set(m.x, m.y + 1.5, m.z); luz.boom.intensity = noche ? 9 : 5; }
    const bola = new T.Sprite(new T.SpriteMaterial({ map: brillo('#ff9a2a'), blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1 }));
    bola.position.set(m.x, m.y + 0.6, m.z); scene.add(bola); humos.push({ o: bola, t: 0, max: 0.45, s0: 1, s1: 9, op: 1, sube: 0 });
    for (let i = 0; i < 9; i++) {
      const h = new T.Mesh(polvoGeo, new T.MeshBasicMaterial({ color: '#3a3a3a', transparent: true }));
      h.position.set(m.x + (Math.random() - 0.5) * 2.5, m.y + 0.3 + Math.random(), m.z + (Math.random() - 0.5) * 2.5); scene.add(h);
      humos.push({ o: h, t: 0, max: 1.6 + Math.random(), s0: 4, s1: 10, op: 0.7, sube: 1.2 });
    }
    if (d < 9) { yo.temblor = Math.max(yo.temblor || 0, (9 - d) / 9 * 0.35); }
    boomSnd(1 / (1 + d / 12));
  }
  // sonidos
  function boomSnd(vol) {
    if (!soundOn || !actx) return;
    try {
      const t = actx.currentTime, src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      src.buffer = ruido(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(120, t + 1.1);
      g.gain.setValueAtTime(0.9 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      src.connect(f); f.connect(g); g.connect(actx.destination); src.start(t); src.stop(t + 1.3);
      const o = actx.createOscillator(), g2 = actx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
      g2.gain.setValueAtTime(0.8 * vol, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(g2); g2.connect(actx.destination); o.start(t); o.stop(t + 0.75);
    } catch (e) { }
  }
  function aDistancia(p) { if (!cam) return 0; const d = Math.hypot(p.x - cam.position.x, p.z - cam.position.z); return Math.max(0, 1 - d / 28); }
  function fuegoSnd(m) { const v = aDistancia(m); metal(0, 0.5, 600, 200, 0.5 * v, 1); golpe(0, 0.4 * v); raspa(0.02, 0.35, 3000, 900, 0.3 * v); }
  function crepita(a) { const v = aDistancia(a) * 0.5; if (v > 0.02) clic(0, 1500 + Math.random() * 2500, 0.15 * v); }
  function chisporrotea(m) { const v = aDistancia(m); if (v <= 0) return; metal(0, 0.9, 5000, 2500, 0.35 * v, 1.5); }
  function escupeSnd(z) {
    if (!z || !z.cur) return; const v = aDistancia(z.cur); if (v <= 0.02 || !soundOn || !actx) return;
    try {
      const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.5);
      f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * v, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(f); f.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.6);
      metal(0.45, 0.25, 1200, 400, 0.35 * v, 2);
    } catch (e) { }
  }
  // tirar (G granada, V molotov)
  function lanzar(tipo) {
    const S = C.S(); if (!S || S.settings.mode !== 'zombis' || !yo.alive) return;
    const me = S.players.find(p => p.id === C.me()); if (!me || (tipo === 'granada' ? me.gr : me.mo) <= 0) return;
    C.send({ t: 'lanza', tipo, d: W.dir(yo.ry, yo.rx).map(v => Math.round(v * 1000) / 1000) });
    yo.cambioT = 0.35; raspa(0, 0.2, 400, 1600, 0.25);
  }
  J.lanzar = lanzar;
  function tiraHUD() {
    const S = C.S(), el = $('#aTira'); if (!S || !el) return;
    const z = S.settings.mode === 'zombis', me = S.players.find(p => p.id === C.me());
    el.classList.toggle('hidden', !z || C.obs());
    if (z && me) el.textContent = `💣 ${me.gr | 0}   🔥 ${me.mo | 0}`;
    document.querySelectorAll('[data-b="granada"],[data-b="molotov"]').forEach(b => b.classList.toggle('hidden', !z));
  }
  function limpiarTiros() {
    for (const p of proys.values()) scene.remove(p.g); proys.clear();
    for (const a of areas) scene.remove(a.g); areas.length = 0;
    for (const h of humos) scene.remove(h.o); humos.length = 0;
    if (luz.fuego) luz.fuego.intensity = 0; if (luz.boom) luz.boom.intensity = 0;
  }

  // ================= arma en la mano (primera persona) =================
  const VM = {};
  let vmGrupo, fogon;
  function armarVM() {
    vmGrupo = new T.Group(); vmGrupo.scale.setScalar(0.8); vmScene.add(vmGrupo);
    const met = new T.MeshLambertMaterial({ color: '#2a2d33' }), met2 = new T.MeshLambertMaterial({ color: '#4a4f58' }), mad = new T.MeshLambertMaterial({ color: '#7a4b26' }), piel = new T.MeshLambertMaterial({ color: '#c99a73' }), manga = new T.MeshLambertMaterial({ color: '#d52b1e' });
    const box = (g, w, h, d, x, y, z, m) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
    const mano = g => { box(g, 0.09, 0.09, 0.32, 0.02, -0.09, 0.12, piel).userData.mano = true; box(g, 0.11, 0.11, 0.3, 0.03, -0.12, 0.38, manga).userData.mano = true; };
    let g = new T.Group(); box(g, 0.07, 0.1, 0.46, 0, 0, -0.1, met); box(g, 0.035, 0.035, 0.3, 0, 0.02, -0.45, met2); box(g, 0.05, 0.15, 0.08, 0, -0.1, -0.08, met2); box(g, 0.05, 0.08, 0.14, 0, -0.02, 0.17, mad); box(g, 0.015, 0.04, 0.015, 0, 0.07, -0.3, met2); mano(g); VM.fusil = g;
    g = new T.Group(); box(g, 0.08, 0.08, 0.5, 0, 0, -0.2, met); box(g, 0.05, 0.05, 0.4, 0, -0.06, -0.3, mad); box(g, 0.07, 0.1, 0.25, 0, -0.03, 0.15, mad); mano(g); VM.escopeta = g;
    g = new T.Group(); box(g, 0.06, 0.08, 0.6, 0, 0, -0.18, met); box(g, 0.03, 0.03, 0.4, 0, 0.01, -0.65, met2); box(g, 0.05, 0.05, 0.28, 0, 0.08, -0.15, met2); box(g, 0.07, 0.1, 0.22, 0, -0.02, 0.22, mad); mano(g); VM.franco = g;
    g = new T.Group(); box(g, 0.05, 0.06, 0.2, 0, 0.02, -0.12, met); box(g, 0.045, 0.12, 0.06, 0, -0.06, -0.04, met2); mano(g); VM.pistola = g;
    g = new T.Group(); box(g, 0.065, 0.1, 0.32, 0, 0, -0.08, met); box(g, 0.03, 0.03, 0.12, 0, 0.02, -0.3, met2); box(g, 0.04, 0.2, 0.05, 0, -0.14, -0.12, met2); box(g, 0.04, 0.1, 0.05, 0, -0.08, 0.03, met2); box(g, 0.03, 0.03, 0.2, 0, 0.01, 0.17, met2); box(g, 0.015, 0.035, 0.015, 0, 0.065, -0.2, met2); mano(g); VM.subfusil = g;
    for (const k in VM) { VM[k].visible = false; vmGrupo.add(VM[k]); }
    const fc = document.createElement('canvas'); fc.width = fc.height = 64; const fg = fc.getContext('2d');
    const gr = fg.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.3, 'rgba(255,200,60,.9)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
    fg.fillStyle = gr; fg.fillRect(0, 0, 64, 64);
    fogon = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(fc), blending: T.AdditiveBlending, depthTest: false, transparent: true }));
    fogon.scale.set(0.22, 0.22, 1); fogon.visible = false; vmGrupo.add(fogon);
  }
  const PUNTA = { fusil: -0.62, escopeta: -0.5, franco: -0.88, pistola: -0.24, subfusil: -0.37 };

  // ================= rastros de bala y polvito =================
  const efectos = [];
  const trazoMat = new T.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
  function trazo(o, e) {
    const g = new T.BufferGeometry().setFromPoints([new T.Vector3(o[0], o[1], o[2]), new T.Vector3(e[0], e[1], e[2])]);
    const l = new T.Line(g, trazoMat.clone()); scene.add(l); efectos.push({ o: l, t: 0, max: 0.08, tipo: 'trazo' });
  }
  const polvoGeo = new T.BoxGeometry(0.12, 0.12, 0.12);
  function polvo(p, color) {
    for (let i = 0; i < 3; i++) {
      const m = new T.Mesh(polvoGeo, new T.MeshBasicMaterial({ color, transparent: true }));
      m.position.set(p[0], p[1], p[2]); scene.add(m);
      efectos.push({ o: m, t: 0, max: 0.35, tipo: 'polvo', v: [(Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3] });
    }
  }
  function efectosTick(dt) {
    for (let i = efectos.length - 1; i >= 0; i--) {
      const e = efectos[i]; e.t += dt;
      if (e.tipo === 'polvo') { e.o.position.x += e.v[0] * dt; e.o.position.y += e.v[1] * dt; e.o.position.z += e.v[2] * dt; e.v[1] -= 9 * dt; }
      e.o.material.opacity = Math.max(0, 1 - e.t / e.max);
      if (e.t >= e.max) { scene.remove(e.o); e.o.geometry !== polvoGeo && e.o.geometry.dispose(); e.o.material.dispose(); efectos.splice(i, 1); }
    }
  }

  // ================= sonido =================
  let actx = null, ruidoBuf = null, soundOn = store.get('tg_sound', true);
  J.audio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { } };
  J.sonido = v => { if (v != null) { soundOn = v; store.set('tg_sound', v); } return soundOn; };
  function ruido() {
    if (ruidoBuf) return ruidoBuf;
    ruidoBuf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate); const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return ruidoBuf;
  }
  // un paso: ruido corto filtrado + golpe grave; el piso cambia el sonido (tierra más suave)
  function pasoSnd(vol, pan) {
    if (!soundOn || !actx || vol < 0.01) return;
    try {
      const t = actx.currentTime, src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      const tierra = mapaId === 'chaco';
      src.buffer = ruido(); f.type = 'bandpass'; f.frequency.value = (tierra ? 320 : 650) + Math.random() * 250; f.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + (tierra ? 0.12 : 0.08));
      let out = g;
      if (actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
      out.connect(actx.destination);
      src.connect(f); f.connect(g); src.start(t, Math.random() * 0.3); src.stop(t + 0.15);
      const o = actx.createOscillator(), g2 = actx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.07);
      g2.gain.setValueAtTime(vol * 0.8, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g2);
      if (out !== g) { const p2 = actx.createStereoPanner(); p2.pan.value = Math.max(-1, Math.min(1, pan)); g2.connect(p2); p2.connect(actx.destination); } else g2.connect(actx.destination);
      o.start(t); o.stop(t + 0.1);
    } catch (e) { }
  }
  // pasos de otro jugador: más fuerte cuanto más cerca, y del lado donde está
  function pasoDe(p, vel) {
    const dx = p.x - cam.position.x, dz = p.z - cam.position.z, d = Math.hypot(dx, dz);
    if (d > 30) return;
    const vol = Math.pow(1 - d / 30, 1.6) * 0.75 * Math.min(1, vel / 6);
    const rel = Math.atan2(-dx, -dz) - cam.rotation.y;
    pasoSnd(vol, -Math.sin(rel) * Math.min(1, d / 3));
  }
  function tiroSnd(w, vol) {
    if (!soundOn || !actx || vol < 0.02) return;
    try {
      const t = actx.currentTime, src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      src.buffer = ruido();
      const cfg = { fusil: [1400, 0.12], escopeta: [700, 0.28], franco: [900, 0.45], pistola: [2000, 0.1], subfusil: [2400, 0.07] }[w] || [1200, 0.15];
      f.type = 'lowpass'; f.frequency.setValueAtTime(cfg[0] * 2, t); f.frequency.exponentialRampToValueAtTime(cfg[0] / 3, t + cfg[1]);
      g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + cfg[1]);
      src.connect(f); f.connect(g); g.connect(actx.destination); src.start(t); src.stop(t + cfg[1] + 0.05);
      const o = actx.createOscillator(), g2 = actx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g2.gain.setValueAtTime(0.35 * vol, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g2); g2.connect(actx.destination); o.start(t); o.stop(t + 0.16);
    } catch (e) { }
  }
  // ruiditos de metal para recargar: golpe seco, clic, raspado del cerrojo
  function metal(t0, dur, f0, f1, vol, q) {
    if (!soundOn || !actx) return;
    try {
      const t = actx.currentTime + t0, src = actx.createBufferSource(), fl = actx.createBiquadFilter(), g = actx.createGain();
      src.buffer = ruido(); fl.type = 'bandpass'; fl.Q.value = q || 4;
      fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(fl); fl.connect(g); g.connect(actx.destination); src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
    } catch (e) { }
  }
  const clic = (t, f, v) => { metal(t, 0.025, f || 3200, (f || 3200) * 0.8, v || 0.35, 8); tono((f || 3200) / 2, t, 0.02, 'square', (v || 0.35) * 0.08); };
  const golpe = (t, v) => { metal(t, 0.07, 900, 300, v || 0.4, 2); tono(160, t, 0.08, 'sine', (v || 0.4) * 0.35); };
  const raspa = (t, dur, f0, f1, v) => metal(t, dur, f0, f1, v || 0.22, 3);
  // cada arma suena distinto al recargar (los tiempos siguen lo que dura la recarga)
  const RECARGA = {
    // fusil: saca el cargador, mete el nuevo y tira del cerrojo
    fusil: () => { clic(0.08, 2600); raspa(0.12, 0.16, 1200, 700); golpe(0.85, 0.45); clic(0.9, 3000); raspa(1.3, 0.1, 1600, 3200, 0.28); clic(1.4, 3600, 0.4); raspa(1.47, 0.07, 3000, 1500, 0.25); golpe(1.52, 0.3); },
    // subfusil: lo mismo pero más rápido y agudo
    subfusil: () => { clic(0.06, 3200); raspa(0.09, 0.12, 1500, 900); golpe(0.6, 0.35); clic(0.64, 3600); raspa(1.0, 0.08, 2000, 3800, 0.25); clic(1.08, 4200, 0.4); golpe(1.13, 0.25); },
    // escopeta: un cartucho por vez y al final "chik-chak" de la corredera
    escopeta: n => {
      const k = Math.max(1, Math.min(6, n || 6)), paso = 1.5 / k;
      for (let i = 0; i < k; i++) { raspa(0.15 + i * paso, 0.09, 700, 1400, 0.2); golpe(0.22 + i * paso, 0.3); }
      chikChak(1.75);
    },
    // francotirador: levanta el cerrojo, lo tira atrás, mete balas, adelante y abajo
    franco: () => { clic(0.1, 2200, 0.4); raspa(0.18, 0.18, 1000, 2600, 0.3); clic(0.38, 3400); golpe(0.9, 0.3); clic(1.1, 2800, 0.3); clic(1.35, 2800, 0.3); raspa(1.9, 0.18, 2600, 1000, 0.3); golpe(2.1, 0.35); clic(2.25, 2000, 0.45); },
    // pistola: cargador afuera, adentro y suelta la corredera
    pistola: () => { clic(0.07, 3400); raspa(0.1, 0.1, 1600, 1000, 0.18); golpe(0.6, 0.35); clic(0.63, 3800); raspa(0.95, 0.06, 3500, 1800, 0.3); clic(1.0, 4400, 0.45); },
  };
  // corredera de la escopeta: atrás y adelante
  function chikChak(t) { raspa(t, 0.09, 900, 2200, 0.32); golpe(t + 0.06, 0.35); raspa(t + 0.16, 0.08, 2200, 900, 0.32); golpe(t + 0.22, 0.45); clic(t + 0.23, 2600, 0.3); }
  // cerrojo del francotirador después de cada tiro
  function cerrojo(t) { clic(t, 2200, 0.35); raspa(t + 0.06, 0.12, 1000, 2600, 0.28); raspa(t + 0.26, 0.12, 2600, 1000, 0.28); golpe(t + 0.38, 0.3); clic(t + 0.44, 2000, 0.35); }
  function tono(f, t0, dur, type, vol) {
    if (!soundOn || !actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + t0;
      o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { }
  }
  const SFX = {
    hit: () => tono(1500, 0, 0.05, 'square', 0.05), head: () => { tono(1900, 0, 0.06, 'square', 0.06); tono(2500, 0.05, 0.08, 'square', 0.05); },
    baja: () => { tono(880, 0, 0.1, 'triangle', 0.12); tono(1320, 0.08, 0.18, 'triangle', 0.12); },
    duele: () => tono(120, 0, 0.18, 'sawtooth', 0.12), muero: () => { tono(300, 0, 0.3, 'sawtooth', 0.1); tono(180, 0.25, 0.5, 'sawtooth', 0.1); },
    recarga: () => { tono(600, 0, 0.04, 'square', 0.05); tono(420, 0.25, 0.05, 'square', 0.05); }, vacio: () => tono(900, 0, 0.03, 'square', 0.04),
    aparece: () => { tono(520, 0, 0.1); tono(780, 0.1, 0.15); }, fin: () => [523, 659, 784, 1046].forEach((f, i) => tono(f, i * 0.12, 0.3, 'triangle', 0.12)),
  };
  J.sfx = n => SFX[n] && SFX[n]();

  // ================= entrar / salir =================
  // supervivencia zombi: de noche, solo se ve con la linterna del arma
  function ambiente(S) {
    if (!scene) return;
    noche = S.settings.mode === 'zombis';
    const cfg = CIELO[mapaId] || CIELO.mercado;
    if (noche) {
      scene.background = new T.Color('#04060c'); scene.fog = new T.Fog('#04060c', 4, 34);
      luz.cielo.intensity = 0.07; luz.cielo.color.set('#6b7fb0'); luz.cielo.groundColor.set('#120d08');
      luz.sol.intensity = 0.12; luz.sol.color.set('#7f93c8');
      luz.vm1.intensity = 0.16; luz.vm2.intensity = 0.1;
    } else {
      scene.background = new T.Color(cfg[0]); scene.fog = new T.Fog(cfg[0], 45, 150);
      luz.cielo.intensity = 0.8; luz.cielo.color.set(0xe8f0ff); luz.cielo.groundColor.set(0x6a5532);
      luz.sol.intensity = 0.75; luz.sol.color.set(0xfff4e0);
      luz.vm1.intensity = 1.0; luz.vm2.intensity = 0.5;
    }
    luz.linterna.intensity = noche && linternaOn ? 2.6 : 0;
    for (const r of remotos.values()) if (r.g.userData.haz) r.g.userData.haz.visible = noche;
  }
  J.linterna = () => { linternaOn = !linternaOn; if (luz.linterna) luz.linterna.intensity = noche && linternaOn ? 2.6 : 0; return linternaOn; };
  // haz de luz de los demás: un cono transparente que sale del arma (no ilumina, pero se ve)
  let hazGeo = null, hazMat = null, brilloMat = null;
  function hazDeLuz() {
    if (!hazGeo) {
      hazGeo = new T.ConeGeometry(2.2, 13, 18, 1, true); hazGeo.translate(0, -6.5, 0); hazGeo.rotateX(Math.PI / 2);
      hazMat = new T.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,230,160,.6)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      brilloMat = new T.SpriteMaterial({ map: new T.CanvasTexture(c), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    }
    const h = new T.Group(); h.add(new T.Mesh(hazGeo, hazMat));
    const b = new T.Sprite(brilloMat); b.scale.set(0.5, 0.5, 1); h.add(b);
    h.position.set(0.15, 1.35, -0.35); h.visible = noche;
    return h;
  }
  J.entrar = S => {
    crear(); J.audio(); J.cargarModelos();
    cargarMapa(S.settings.map);
    ambiente(S);
    J.estado(S);
    $('#juego').classList.remove('hidden');
    const obs = C.obs();
    if (!yo.s) yo.s = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ground: true, crouch: false, slideT: 0 };
    $('#hud').classList.toggle('obs', obs);
    $('#tctl').classList.toggle('hidden', !tactil() || obs);
    document.querySelectorAll('[data-b="luz"]').forEach(b => b.classList.toggle('hidden', S.settings.mode !== 'zombis'));
    if (!activo) { activo = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    if (!obs && !tactil() && !yo.alive) { /* espera el spawn */ }
    pausa(!tactil() && !obs && document.pointerLockElement !== ren.domElement);
    medir();
  };
  J.salir = () => {
    activo = false; cancelAnimationFrame(raf);
    for (const r of remotos.values()) scene.remove(r.g); remotos.clear();
    for (const z of zombis.values()) scene.remove(z.g); zombis.clear(); yo.ola = null;
    limpiarTiros();
    yo.alive = false; inp.fire = false; inp.aim = false;
    if (document.pointerLockElement) document.exitPointerLock();
    $('#juego').classList.add('hidden'); $('#muerte').classList.add('hidden'); $('#pausa').classList.add('hidden');
    $('#feed').innerHTML = ''; $('#clog').innerHTML = '';
  };
  J.activo = () => activo;
  J.estado = S => {
    if (S.settings.mode === 'zombis') J.cargarZombis();
    if (!scene) return;
    if (S.settings.map !== mapaId) { cargarMapa(S.settings.map); ambiente(S); }
    else if ((S.settings.mode === 'zombis') !== noche) ambiente(S);
    const ids = new Set();
    for (const p of S.players) { if (p.id === C.me()) { yo.prim = p.prim; continue; } ids.add(p.id); remoto(p); }
    for (const [id, r] of remotos) if (!ids.has(id)) { scene.remove(r.g); remotos.delete(id); }
    marcador(); tabla(); tiraHUD();
  };

  // ================= mensajes de la sala =================
  J.msg = m => {
    const me = C.me();
    switch (m.t) {
      case 'snap': {
        const now = performance.now();
        for (const e of m.P) {
          const [id, x, y, z, ry, rx, hp, alive, w, c, prot] = e;
          if (id === me) { yo.hp = hp; if (!alive && yo.alive) morir(null); continue; }
          const r = remotos.get(id); if (!r) continue;
          if (alive && !r.alive) { r.buf = []; r.caida = 0; }
          r.alive = !!alive; r.hp = hp; r.w = w; r.crouch = !!c; r.prot = !!prot;
          if (alive) { r.buf.push({ t: now, x, y, z, ry, rx }); if (r.buf.length > 30) r.buf.shift(); }
        }
        yo.tl = m.tl; yo.tlAt = performance.now();
        if (m.Z) { zombisSnap(m.Z); yo.ola = m.ol; marcador(); } else if (zombis.size) zombisSnap([]);
        if (m.G) proysSnap(m.G); else if (proys.size) proysSnap([]);
        break;
      }
      case 'spawn': {
        if (m.id === me) {
          Object.assign(yo.s, { x: m.p[0], y: m.p[1], z: m.p[2], vx: 0, vy: 0, vz: 0, crouch: false, slideT: 0, ground: true });
          yo.aparecio = { x: m.p[0], y: m.p[1], z: m.p[2] }; yo.bueno = null;
          yo.ry = m.ry; yo.rx = 0; yo.alive = true; yo.hp = 100; yo.reloadT = 0; yo.w = yo.prim; yo.kick = 0; yo.bloom = 0;
          yo.ammo = { [yo.prim]: A[yo.prim].mag, pistola: A.pistola.mag };
          $('#muerte').classList.add('hidden'); SFX.aparece(); armaHUD();
          // si no volvió a agarrar el mouse mientras estaba muerto, se le pide un clic
          if (!tactil() && !C.obs() && document.pointerLockElement !== ren.domElement && !chatAbierto()) pausa(true);
        } else { const r = remotos.get(m.id); if (r) { r.buf = [{ t: performance.now(), x: m.p[0], y: m.p[1], z: m.p[2], ry: m.ry, rx: 0 }]; r.alive = true; r.caida = 0; } }
        break;
      }
      case 'fx': {
        const r = remotos.get(m.id); if (!r) break;
        const o = m.o;
        for (const e of m.e) { trazo(o, e); polvo(e, '#cfc6b0'); }
        const d = Math.hypot(o[0] - (yo.s ? yo.s.x : 0), o[2] - (yo.s ? yo.s.z : 0));
        tiroSnd(m.w, 1 / (1 + d / 10));
        r.fuego = 0.06; r.tiroT = 0.45;
        break;
      }
      case 'kill': feedKill(m); break;
      case 'ola': if (m.n) { aviso('🧟 ¡Oleada ' + m.n + '!', 'Vienen zombis...'); SFX.aparece(); } else if (m.fin) aviso('✅ ¡Pasaron la oleada ' + m.fin + '!', 'Respiren: la próxima en 8 segundos'); break;
      case 'boom': boom(m); break;
      case 'area': area(m); break;
      case 'escupe': escupeSnd(zombis.get(m.id)); break;
      case 'tira': { if (m.id !== C.me()) { const r = remotos.get(m.id); if (r && r.cur) raspa(0, 0.2, 400, 1600, 0.25 * aDistancia(r.cur)); } break; }
      case 'muerde': { const z = zombis.get(m.id); if (z && z.cur) gruDe(z.cur, 'brazo'); break; }
      case 'hurt': {
        yo.hp = m.hp; SFX.duele();
        const v = $('#dano'); v.style.opacity = Math.min(0.85, 0.35 + (100 - m.hp) / 200); clearTimeout(v._t); v._t = setTimeout(() => v.style.opacity = 0, 350);
        if (m.from && yo.s) {
          const dx = m.from[0] - yo.s.x, dz = m.from[1] - yo.s.z, ang = Math.atan2(-dx, -dz) - yo.ry;
          const fl = $('#flecha'); fl.style.transform = `rotate(${-ang}rad)`; fl.style.opacity = 1; clearTimeout(fl._t); fl._t = setTimeout(() => fl.style.opacity = 0, 900);
        }
        break;
      }
      case 'hitm': {
        const h = $('#hitm'); h.className = m.kill ? 'kill' : m.head ? 'head' : ''; h.style.opacity = 1; clearTimeout(h._t); h._t = setTimeout(() => h.style.opacity = 0, 160);
        (m.head ? SFX.head : SFX.hit)();
        break;
      }
    }
  };
  function nombre(id) { if (esZombi(id) || /^z\d+$/.test(id || '')) return '🧟 Zombi'; const p = (C.S().players || []).find(x => x.id === id); return p ? p.name : '¿?'; }
  function colorDe(id) {
    const S = C.S(), p = S.players.find(x => x.id === id); if (!p) return /^z\d+$/.test(id || '') ? '#9ccc65' : '#fff';
    return S.settings.mode === 'equipos' ? (p.team === 'r' ? '#ff8a80' : '#8ab4ff') : CAMIS_TXT[p.col % CAMIS_TXT.length];
  }
  function feedKill(m) {
    const me = C.me(), w = { zombi: { ico: '🧟' }, granada: { ico: '💣' }, molotov: { ico: '🔥' }, acido: { ico: '🧪' } }[m.w] || A[m.w] || A.fusil;
    const d = document.createElement('div'); d.className = 'fk' + (m.a === me || m.v === me ? ' mio' : '');
    d.innerHTML = m.a && m.a !== m.v ? `<b style="color:${colorDe(m.a)}">${esc(nombre(m.a))}</b> <span>${w.ico}${m.h ? '🎯' : ''}</span> <b style="color:${colorDe(m.v)}">${esc(nombre(m.v))}</b>` : `💀 <b>${esc(nombre(m.v))}</b>`;
    const f = $('#feed'); f.prepend(d); while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
    if (m.v === me) morir(m);
    if (m.a === me && m.v !== me) {
      SFX.baja(); aviso(`${m.h ? '🎯 ¡A la cabeza! ' : ''}Bajaste a ${nombre(m.v)}`, m.msg);
    }
    const r = remotos.get(m.v); if (r) { r.alive = false; r.caida = 0.001; }
  }
  function aviso(t, t2) {
    const a = $('#aviso'); a.innerHTML = esc(t) + (t2 ? `<div class="racha">${esc(t2)}</div>` : '');
    a.classList.remove('ver'); void a.offsetWidth; a.classList.add('ver');
  }
  function morir(m) {
    if (!yo.alive && !m) return;
    const estaba = yo.alive; yo.alive = false; yo.deadAt = performance.now(); inp.fire = false;
    if (estaba) SFX.muero();
    if (m && m.a && m.a !== C.me()) yo.killer = m.a; else if (m) yo.killer = null;
    const w = m && A[m.w];
    $('#mTxt').innerHTML = m && m.w === 'acido' ? 'Te derritió el ácido de un zombi 🧪' : m && m.w === 'zombi' ? 'Te agarró un zombi 🧟' : m && m.a && m.a !== m.v ? `Te bajó <b style="color:${colorDe(m.a)}">${esc(nombre(m.a))}</b> con ${w ? w.ico + ' ' + w.n : 'un tiro'}${m.h ? ' <b>¡a la cabeza!</b> 🎯' : ''}` : 'Caíste 💀';
    $('#muerte').classList.remove('hidden');
    // en la PC se suelta el mouse para poder tocar el arma de la próxima vida
    if (document.pointerLockElement) document.exitPointerLock();
    pintarElegir();
  }
  function pintarElegir() {
    document.querySelectorAll('#mArmas [data-w]').forEach(b => b.classList.toggle('sel', b.dataset.w === yo.prim));
  }
  J.elegirArma = w => { if (!A[w] || w === 'pistola') return; yo.prim = w; store.set('tg_prim', w); C.send({ t: 'prim', w }); pintarElegir(); };

  // ================= controles =================
  function pausa(v) { $('#pausa').classList.toggle('hidden', !v); }
  function bloquear() { if (!tactil() && ren && activo && !C.obs()) { try { const p = ren.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } } }
  J.bloquear = bloquear;
  function chatAbierto() { return document.activeElement === $('#cin'); }
  function controles() {
    const cv = ren.domElement;
    cv.addEventListener('click', () => { J.audio(); if (C.obs()) { mira++; return; } if (!tactil() && document.pointerLockElement !== cv) bloquear(); });
    // muerto: al tocar un arma (o cualquier lugar) se vuelve a agarrar el mouse para seguir jugando
    $('#muerte').addEventListener('click', () => setTimeout(bloquear, 0));
    $('#pausa').addEventListener('click', e => { if (e.target.closest('.no-lock')) return; J.audio(); bloquear(); });
    document.addEventListener('pointerlockchange', () => {
      const ok = document.pointerLockElement === cv;
      if (!ok) { inp.fire = false; inp.aim = false; inp.keys.clear(); }
      if (activo && !C.obs() && !tactil()) pausa(!ok && !chatAbierto() && yo.alive);
    });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== cv) return;
      const z = 1 + (A[yo.w].zoom - 1) * yo.aimK, k = 0.0022 * sens / z;
      yo.ry -= e.movementX * k; yo.rx = Math.max(-1.5, Math.min(1.5, yo.rx - e.movementY * k));
    });
    cv.addEventListener('mousedown', e => {
      if (document.pointerLockElement !== cv) return;
      if (e.button === 0) inp.fire = true;
      if (e.button === 2) inp.aim = aimToggle ? !inp.aim : true;
    });
    addEventListener('mouseup', e => { if (e.button === 0) { inp.fire = false; yo.latch = false; } if (e.button === 2 && !aimToggle) inp.aim = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { if (activo && document.pointerLockElement === cv) cambiar(); }, { passive: true });
    addEventListener('keydown', e => {
      if (!activo) return;
      if (chatAbierto()) { if (e.key === 'Escape') { $('#cin').value = ''; $('#cin').blur(); bloquear(); } return; }
      if (e.key === 'Enter' || (e.key === 't' && document.pointerLockElement)) { e.preventDefault(); abrirChat(); return; }
      if (C.obs()) { if (e.key === 'ArrowRight' || e.key === ' ') mira++; if (e.key === 'ArrowLeft') mira--; if (e.key === 'Tab') { e.preventDefault(); inp.tabla = true; tabla(); } return; }
      const k = e.code;
      if (k === 'Tab') { e.preventDefault(); inp.tabla = true; tabla(); return; }
      // muerto: 1, 2, 3 o 4 elige el arma de la próxima vida
      if (!yo.alive && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(k)) { const w = ['fusil', 'subfusil', 'escopeta', 'franco'][+k.slice(5) - 1]; const b = document.querySelector(`#mArmas [data-w="${w}"]`); if (b) b.click(); else J.elegirArma(w); return; }
      inp.keys.add(k);
      if (k === 'Space') { inp.jumpQ = true; e.preventDefault(); }
      if (k === 'KeyR') recargar();
      if (k === 'KeyF' && noche) J.linterna();
      if (k === 'KeyG') lanzar('granada');
      if (k === 'KeyV') lanzar('molotov');
      if (k === 'Digit1') ponerArma(yo.prim); if (k === 'Digit2') ponerArma('pistola'); if (k === 'KeyQ') cambiar();
    });
    addEventListener('keyup', e => { inp.keys.delete(e.code); if (e.code === 'Tab') { inp.tabla = false; tabla(); } });
    addEventListener('blur', () => { inp.keys.clear(); inp.fire = false; });
    $('#chatF').addEventListener('submit', e => { e.preventDefault(); const v = $('#cin').value.trim(); if (v) C.send({ t: 'chat', text: v }); $('#cin').value = ''; $('#cin').blur(); $('#chatF').classList.remove('abierto'); bloquear(); });
    $('#cin').addEventListener('blur', () => setTimeout(() => $('#chatF').classList.remove('abierto'), 100));
    // ajustes
    $('#sSens').value = sens; $('#sSens').oninput = e => { sens = +e.target.value; store.set('tg_sens', sens); $('#vSens').textContent = sens.toFixed(1); };
    $('#vSens').textContent = sens.toFixed(1);
    $('#sTsens').value = tsens; $('#sTsens').oninput = e => { tsens = +e.target.value; store.set('tg_tsens', tsens); $('#vTsens').textContent = tsens.toFixed(1); };
    $('#vTsens').textContent = tsens.toFixed(1);
    $('#sFov').value = fovBase; $('#sFov').oninput = e => { fovBase = +e.target.value; store.set('tg_fov', fovBase); $('#vFov').textContent = fovBase; };
    $('#vFov').textContent = fovBase;
    $('#sAimTog').checked = aimToggle; $('#sAimTog').onchange = e => { aimToggle = e.target.checked; store.set('tg_aimtog', aimToggle); };
    tactilCtl();
  }
  function abrirChat() {
    $('#chatF').classList.add('abierto');
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => $('#cin').focus(), 30);
  }
  J.abrirChat = abrirChat;
  // ---------- celular: palanca a la izquierda, mirar arrastrando a la derecha ----------
  function tactilCtl() {
    const z = $('#tctl'), pal = $('#palanca'), bolita = $('#bolita');
    let palId = null, p0 = null; const miradas = new Map();
    const R = 55;
    z.addEventListener('touchstart', e => {
      J.audio();
      for (const t of e.changedTouches) {
        const btn = t.target.closest && t.target.closest('[data-b]');
        if (btn) {
          const b = btn.dataset.b; btn.classList.add('on');
          if (b === 'fire') { inp.fire = true; miradas.set(t.identifier, { x: t.clientX, y: t.clientY }); }
          else if (b === 'aim') inp.aim = !inp.aim;
          else if (b === 'jump') inp.jumpQ = true;
          else if (b === 'crouch') inp.crouchT = !inp.crouchT;
          else if (b === 'reload') recargar();
          else if (b === 'swap') cambiar();
          else if (b === 'tabla') { inp.tabla = !inp.tabla; tabla(); }
          else if (b === 'chat') abrirChat();
          else if (b === 'luz') { if (noche) J.linterna(); }
          else if (b === 'granada' || b === 'molotov') lanzar(b);
          continue;
        }
        if (C.obs()) { mira++; continue; }
        if (t.clientX < innerWidth * 0.42 && palId == null) {
          palId = t.identifier; p0 = { x: t.clientX, y: t.clientY };
          pal.style.left = (t.clientX - R) + 'px'; pal.style.top = (t.clientY - R) + 'px'; pal.classList.add('on'); bolita.style.transform = '';
        } else miradas.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      e.preventDefault();
    }, { passive: false });
    z.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === palId) {
          let dx = t.clientX - p0.x, dy = t.clientY - p0.y; const L = Math.hypot(dx, dy);
          if (L > R) { dx = dx / L * R; dy = dy / L * R; }
          bolita.style.transform = `translate(${dx}px,${dy}px)`;
          inp.mx = dx / R; inp.mz = dy / R;
        } else if (miradas.has(t.identifier)) {
          const m = miradas.get(t.identifier), dx = t.clientX - m.x, dy = t.clientY - m.y; m.x = t.clientX; m.y = t.clientY;
          const zz = 1 + (A[yo.w].zoom - 1) * yo.aimK, k = 0.0055 * tsens / zz;
          yo.ry -= dx * k; yo.rx = Math.max(-1.5, Math.min(1.5, yo.rx - dy * k));
        }
      }
      e.preventDefault();
    }, { passive: false });
    const fin = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === palId) { palId = null; inp.mx = inp.mz = 0; pal.classList.remove('on'); }
        if (miradas.has(t.identifier)) miradas.delete(t.identifier);
        const btn = t.target.closest && t.target.closest('[data-b]');
        if (btn) { btn.classList.remove('on'); if (btn.dataset.b === 'fire') { inp.fire = false; yo.latch = false; } }
      }
      z.querySelectorAll('[data-b="aim"]').forEach(b => b.classList.toggle('on', inp.aim));
      z.querySelectorAll('[data-b="crouch"]').forEach(b => b.classList.toggle('on', inp.crouchT));
    };
    z.addEventListener('touchend', fin); z.addEventListener('touchcancel', fin);
  }

  // ================= armas =================
  function ponerArma(w) {
    if (!yo.alive || yo.w === w || (w !== yo.prim && w !== 'pistola')) return;
    yo.w = w; yo.reloadT = 0; yo.nextFire = Math.max(yo.nextFire, performance.now() + 280); yo.cambioT = 0.28;
    if (yo.ammo[w] == null) yo.ammo[w] = A[w].mag;
    armaHUD();
  }
  function cambiar() { ponerArma(yo.w === 'pistola' ? yo.prim : 'pistola'); }
  function recargar() {
    const w = A[yo.w]; if (!yo.alive || yo.reloadT > 0 || yo.ammo[yo.w] >= w.mag) return;
    yo.reloadT = yo.reloadOf = w.rec / 1000;
    const r = RECARGA[yo.w]; if (r) r(w.mag - (yo.ammo[yo.w] | 0)); else SFX.recarga();
  }
  function disparar(now) {
    const w = A[yo.w];
    if (yo.reloadT > 0 || now < yo.nextFire) return;
    if (!w.auto && yo.latch) return;
    if ((yo.ammo[yo.w] | 0) <= 0) { SFX.vacio(); yo.latch = true; recargar(); return; }
    yo.latch = true; yo.nextFire = now + w.cad; yo.ammo[yo.w]--;
    const s = yo.s, mov = Math.hypot(s.vx, s.vz) > 1, apunta = yo.aimK > 0.8;
    let sp = (apunta ? w.aim : w.hip) * (mov ? 1.5 : 1) * (s.ground ? 1 : 2.2) + yo.bloom;
    if (s.crouch && s.slideT <= 0) sp *= 0.75;
    const o = [s.x, s.y + yo.eye, s.z], d0 = W.dir(yo.ry, yo.rx);
    const S = C.S(), eq = S.settings.mode === 'equipos', miEq = (S.players.find(p => p.id === C.me()) || {}).team;
    const cuerpos = [];
    const zomb = S.settings.mode === 'zombis';
    if (!zomb) for (const [id, r] of remotos) if (r.alive && r.cur && !(eq && r.team === miEq)) cuerpos.push({ id, x: r.cur.x, y: r.cur.y, z: r.cur.z, crouch: r.crouch });
    for (const [id, z] of zombis) if (z.estado !== 2 && z.cur) cuerpos.push({ id, x: z.cur.x, y: z.cur.y, z: z.cur.z, alto: ALTO_Z[z.tipo] || 1.75 });
    const M = W.mapa(mapaId), hits = [], ends = [];
    for (let i = 0; i < w.pel; i++) {
      const d = W.desvio(d0, sp), tw = W.rayMundo(M, o, d, w.range), h = W.rayCuerpos(cuerpos, o, d, tw), t = h ? h.t : tw;
      const e = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
      ends.push(e.map(v => Math.round(v * 100) / 100));
      if (h) { hits.push([h.id, h.head ? 1 : 0]); polvo(e, '#c0392b'); } else if (t < w.range) polvo(e, '#cfc6b0');
      // el rastro sale un poco abajo a la derecha (del caño)
      const right = [Math.cos(yo.ry), 0, -Math.sin(yo.ry)], k = apunta ? 0 : 0.18;
      trazo([o[0] + right[0] * k + d0[0] * 0.6, o[1] - (apunta ? 0.06 : 0.14) + d0[1] * 0.6, o[2] + right[2] * k + d0[2] * 0.6], e);
    }
    C.send({ t: 'fire', w: yo.w, o: o.map(v => Math.round(v * 100) / 100), e: ends, hits });
    tiroSnd(yo.w, 0.8);
    yo.kick = Math.min(0.5, yo.kick + w.kick * (apunta ? 0.6 : 1));
    yo.rx = Math.min(1.5, yo.rx + w.kick * (apunta ? 0.45 : 0.7)); yo.ry += (Math.random() - 0.5) * w.kick * 0.4;
    if (w.auto) yo.bloom = Math.min(0.05, yo.bloom + 0.004);
    fogon.visible = true; fogon.t = 0.05; if (luz.destello) luz.destello.intensity = noche ? 3 : 1.2;
    if (yo.ammo[yo.w] > 0) { if (yo.w === 'escopeta') chikChak(0.32); else if (yo.w === 'franco') cerrojo(0.42); }
    if (yo.ammo[yo.w] <= 0) setTimeout(recargar, 120);
    armaHUD();
  }

  // ================= bucle =================
  function loop(t) {
    if (!activo) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.max(0, Math.min(0.05, (t - last) / 1000)); last = Math.max(last, t);
    const now = performance.now(), obs = C.obs();
    if (!obs && yo.alive) jugar(dt, now);
    else if (!obs) camMuerto(dt, now);
    // otros jugadores (con 110 ms de atraso para que se vean suaves)
    const rt = now - 110;
    for (const [id, r] of remotos) {
      const g = r.g, u = g.userData;
      if (!r.alive) {
        if (r.caida > 0 && r.cur) {
          r.caida += dt; g.visible = r.caida < (u.modelo ? 2 : 1.4); g.position.y = r.cur.y;
          if (u.modelo) animar(r, 0, dt); else g.rotation.x = -Math.min(1.5, r.caida * 4);
        }
        else g.visible = false;
        continue;
      }
      const b = r.buf; if (!b.length) { g.visible = false; continue; }
      let a = b[0], c = b[b.length - 1];
      for (let i = b.length - 1; i >= 0; i--) if (b[i].t <= rt) { a = b[i]; c = b[i + 1] || b[i]; break; }
      const k = c.t > a.t ? Math.max(0, Math.min(1, (rt - a.t) / (c.t - a.t))) : 1;
      let dr = c.ry - a.ry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
      const cur = { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k, ry: a.ry + dr * k, rx: a.rx + (c.rx - a.rx) * k };
      const vel0 = r.cur ? Math.hypot(cur.x - r.cur.x, cur.z - r.cur.z) / Math.max(dt, 0.001) : 0;
      const vel = vel0 > 15 ? 0 : vel0;   // un salto grande es que reapareció: no es caminar
      const enPiso = !r.cur || Math.abs(cur.y - r.cur.y) < 0.03;
      r.velS = (r.velS || 0) * 0.85 + vel * 0.15;
      r.cur = cur;
      // pasos: se escuchan si camina o corre parado (agachado no hace ruido)
      const st = Math.floor(r.paso * 3 / Math.PI);
      if (st !== r.st) { r.st = st; if (r.velS > 2.2 && !r.crouch && enPiso) pasoDe(cur, r.velS); }
      g.visible = !(obs && mirado() === id);
      g.position.set(cur.x, cur.y, cur.z); g.rotation.set(0, cur.ry, 0);
      r.paso += Math.min(vel, 8) * dt * 1.6;
      if (u.modelo) {
        u.nom.position.y = r.crouch ? 1.6 : 2.1;
        if (u.haz) { u.haz.rotation.x = cur.rx; u.haz.position.y = r.crouch ? 0.95 : 1.35; }
        animar(r, r.velS, dt);
        if (r.prot || r.eraProt) { r.eraProt = r.prot; const op = r.prot ? 0.45 + 0.25 * Math.sin(now / 80) : 1; for (const m of u.mats) { m.transparent = r.prot; m.opacity = op; } }
        if (r.fuego > 0) r.fuego -= dt;
        continue;
      }
      const ag = r.crouch ? 0.55 : 1;
      u.pierna1.scale.y = u.pierna2.scale.y = ag; u.pierna1.position.y = u.pierna2.position.y = 0.41 * ag; u.arriba.position.y = 0.82 * ag;
      u.nom.position.y = r.crouch ? 1.75 : 2.15;
      u.brazos.rotation.x = cur.rx;
      if (u.haz) { u.haz.rotation.x = cur.rx; u.haz.position.y = r.crouch ? 0.95 : 1.35; }
      const sw = vel > 0.5 ? Math.sin(r.paso * 3) * 0.5 : 0;
      u.pierna1.rotation.x = sw; u.pierna2.rotation.x = -sw;
      if (r.prot || r.eraProt) { r.eraProt = r.prot; const op = r.prot ? 0.45 + 0.25 * Math.sin(now / 80) : 1; const vistos = new Set(); g.traverse(o => { if (o.material && o !== u.nom && !vistos.has(o.material)) { vistos.add(o.material); o.material.transparent = r.prot; o.material.opacity = op; } }); }
      if (r.fuego > 0) { r.fuego -= dt; u.arma.material = r.fuego > 0 ? fuegoMat : u.armaMat; }
    }
    if (zombis.size) zombisTick(dt, rt);
    if (proys.size || areas.length || humos.length || (luz.boom && luz.boom.intensity > 0)) proysTick(dt);
    if (obs) camObs(dt);
    efectosTick(dt);
    if (fogon.visible) { fogon.t -= dt; if (fogon.t <= 0) fogon.visible = false; }
    if (luz.destello && luz.destello.intensity > 0) luz.destello.intensity = Math.max(0, luz.destello.intensity - dt * 50);
    // reloj del HUD
    if (C.S() && C.S().settings.mode === 'zombis') $('#tReloj').textContent = yo.ola ? (yo.ola[2] ? '⏸️ Descanso' : '🧟 Oleada ' + yo.ola[0]) : '🧟 Preparense';
    else if (yo.tl != null) { const ms = Math.max(0, yo.tl - (now - yo.tlAt)), s = Math.ceil(ms / 1000); $('#tReloj').textContent = `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; }
    ren.clear(); ren.render(scene, cam);
    if (!obs && yo.alive && !(yo.w === 'franco' && yo.aimK > 0.85)) { ren.clearDepth(); ren.render(vmScene, vmCam); }
    $('#mirilla').classList.toggle('hidden', !(yo.alive && !obs && yo.w === 'franco' && yo.aimK > 0.85));
  }
  const fuegoMat = new T.MeshBasicMaterial({ color: '#ffd04a' });

  function jugar(dt, now) {
    const s = yo.s, w = A[yo.w];
    // mover
    let fx = 0, fz = 0;
    const K = inp.keys;
    if (K.has('KeyW') || K.has('ArrowUp')) fz -= 1; if (K.has('KeyS') || K.has('ArrowDown')) fz += 1;
    if (K.has('KeyA') || K.has('ArrowLeft')) fx -= 1; if (K.has('KeyD') || K.has('ArrowRight')) fx += 1;
    fx += inp.mx; fz += inp.mz;
    let L = Math.hypot(fx, fz); if (L > 1) { fx /= L; fz /= L; }
    const c = Math.cos(yo.ry), sn = Math.sin(yo.ry);
    const mx = fx * c + fz * sn, mz = -fx * sn + fz * c;
    const crouch = inp.crouchT || K.has('ShiftLeft') || K.has('ShiftRight') || K.has('KeyC') || K.has('ControlLeft');
    const aim = inp.aim && yo.reloadT <= 0;
    W.mover(W.mapa(mapaId), s, { mx, mz, jump: inp.jumpQ || K.has('Space'), crouch, aim }, dt);
    inp.jumpQ = false;
    // por las dudas: si la posición se rompe (NaN), vuelve a la última buena
    if (!Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz)) { const b = yo.bueno || yo.aparecio || { x: 0, y: 0, z: 0 }; Object.assign(s, { x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, ground: true }); }
    else yo.bueno = { x: s.x, y: s.y, z: s.z };
    // y si quedó metido adentro de algo, se sale solo
    W.liberar(W.mapa(mapaId), s);
    yo.eye += ((s.crouch ? 0.95 : 1.55) - yo.eye) * Math.min(1, dt * 14);
    yo.aimK += ((aim ? 1 : 0) - yo.aimK) * Math.min(1, dt * 14);
    yo.bloom = Math.max(0, yo.bloom - dt * 0.06);
    // armas
    if (yo.reloadT > 0) { yo.reloadT -= dt; if (yo.reloadT <= 0) { yo.ammo[yo.w] = w.mag; armaHUD(); } }
    if (yo.cambioT > 0) yo.cambioT -= dt;
    if (inp.fire) disparar(now);
    // avisar a la sala 20 veces por segundo
    yo.mvT -= dt;
    if (yo.mvT <= 0) { yo.mvT = 0.05; C.send({ t: 'mv', p: [s.x, s.y, s.z].map(v => Math.round(v * 100) / 100), ry: Math.round(yo.ry * 100) / 100, rx: Math.round(yo.rx * 100) / 100, c: s.crouch, w: yo.w }); }
    // cámara
    yo.kick = Math.max(0, yo.kick - dt * 3);
    const z = 1 + (w.zoom - 1) * yo.aimK;
    cam.fov = fovBase / z; cam.updateProjectionMatrix();
    cam.position.set(s.x, s.y + yo.eye, s.z); cam.rotation.set(yo.rx, yo.ry, s.slideT > 0 ? 0.06 : 0);
    // temblor de una explosión cerca
    if (yo.temblor > 0) { yo.temblor = Math.max(0, yo.temblor - dt * 0.8); cam.position.x += (Math.random() - 0.5) * yo.temblor; cam.position.y += (Math.random() - 0.5) * yo.temblor; }
    // arma en la mano: balanceo al caminar, retroceso, apuntar al medio
    const v = Math.hypot(s.vx, s.vz); yo.bob += dt * v * (s.ground ? 1.7 : 0);
    // mis propios pasos, más bajitos
    const mp = Math.floor(yo.bob / Math.PI);
    if (mp !== yo.mp) { yo.mp = mp; if (v > 2.2 && s.ground && !s.crouch) pasoSnd(0.16 * Math.min(1, v / 6), 0); }
    for (const k in VM) VM[k].visible = k === yo.w;
    const bx = Math.sin(yo.bob) * 0.012 * (1 - yo.aimK), by = Math.abs(Math.cos(yo.bob)) * 0.012 * (1 - yo.aimK);
    const hip = [0.16, -0.16, -0.4], ads = [0, yo.w === 'pistola' ? -0.115 : -0.105, -0.34];
    const r = yo.reloadT > 0 ? Math.sin(Math.min(1, 1 - yo.reloadT / yo.reloadOf) * Math.PI) : 0, cb = Math.max(0, yo.cambioT || 0) / 0.28;
    vmGrupo.position.set(hip[0] + (ads[0] - hip[0]) * yo.aimK + bx, hip[1] + (ads[1] - hip[1]) * yo.aimK + by - r * 0.12 - cb * 0.25, hip[2] + (ads[2] - hip[2]) * yo.aimK + yo.kick * 0.25);
    vmGrupo.rotation.set(yo.kick * 0.9 + r * 0.6, 0, r * 0.4);
    fogon.position.set(0, 0.03, PUNTA[yo.w]);
    hud(dt);
  }
  function camMuerto(dt, now) {
    if (!yo.s) return;
    const r = yo.killer && remotos.get(yo.killer), s = yo.s;
    const k = Math.min(1, (now - yo.deadAt) / 1200);
    cam.position.set(s.x, s.y + 1.55 + k * 2.5, s.z);
    if (r && r.cur) {
      const dx = r.cur.x - s.x, dz = r.cur.z - s.z, dy = r.cur.y + 1.2 - cam.position.y;
      const ry = Math.atan2(-dx, -dz), rx = Math.atan2(dy, Math.hypot(dx, dz));
      cam.rotation.set(cam.rotation.x + (rx - cam.rotation.x) * Math.min(1, dt * 4), ry, 0);
    } else cam.rotation.set(-0.5 * k, yo.ry, 0);
    cam.fov = fovBase; cam.updateProjectionMatrix();
    const left = Math.max(0, 3.5 - (now - yo.deadAt) / 1000);
    $('#mCuenta').textContent = C.S() && C.S().settings.mode === 'zombis' ? 'Volvés cuando empiece la próxima oleada 🧟' : left > 0 ? `Volvés en ${Math.ceil(left)}…` : 'Volviendo…';
    hud(dt);
  }
  // espectador: sigue a un jugador vivo, desde sus ojos
  function vivos() { return [...remotos.entries()].filter(([, r]) => r.alive && r.cur); }
  function mirado() { const v = vivos(); if (!v.length) return null; mira = ((mira % v.length) + v.length) % v.length; return v[mira][0]; }
  function camObs(dt) {
    const id = mirado(), r = id && remotos.get(id);
    if (r && r.cur) {
      cam.position.set(r.cur.x, r.cur.y + (r.crouch ? 0.95 : 1.55), r.cur.z); cam.rotation.set(r.cur.rx, r.cur.ry, 0);
      $('#obsTxt').innerHTML = `👀 Mirando a <b style="color:${colorDe(id)}">${esc(r.name)}</b> · ❤️ ${r.hp} <small>(tocá o ←/→ para cambiar)</small>`;
    } else {
      const M = W.mapa(mapaId); cam.position.set(0, M.S * 0.9, M.S * 0.9); cam.rotation.set(-0.75, 0, 0);
      $('#obsTxt').innerHTML = '👀 Mirando la partida';
    }
    cam.fov = fovBase; cam.updateProjectionMatrix();
  }

  // ================= carteles =================
  function armaHUD() {
    const w = A[yo.w];
    $('#aNom').textContent = `${w.ico} ${w.n}`;
    $('#aBal').innerHTML = `<b>${yo.ammo[yo.w] ?? w.mag}</b> / ${w.mag}`;
  }
  function hud(dt) {
    const v = Math.max(0, Math.round(yo.hp));
    $('#vBar').style.width = v + '%'; $('#vBar').style.background = v > 60 ? '#2ecc71' : v > 30 ? '#f1c40f' : '#e74c3c'; $('#vNum').textContent = v;
    const w = A[yo.w], s = yo.s;
    let sp = (yo.aimK > 0.8 ? w.aim : w.hip) * (s && Math.hypot(s.vx, s.vz) > 1 ? 1.5 : 1) * (s && !s.ground ? 2.2 : 1) + yo.bloom;
    const gap = 5 + sp * 700;
    const m = $('#mira'); m.style.setProperty('--g', gap + 'px'); m.style.opacity = yo.alive ? (yo.aimK > 0.6 ? 0.25 : 1) : 0;
    const rl = $('#aRec');
    if (yo.reloadT > 0) { rl.style.display = 'block'; rl.firstChild.style.width = (100 * (1 - yo.reloadT / yo.reloadOf)) + '%'; } else rl.style.display = 'none';
  }
  function marcador() {
    const S = C.S(); if (!S) return;
    const st = S.settings, el = $('#tScore');
    if (st.mode === 'zombis') { const me = S.players.find(p => p.id === C.me()), o = yo.ola; el.innerHTML = (o ? `🧟 quedan <b>${o[1]}</b>` : '🧟 ya vienen...') + (me && !C.obs() ? ` · <b>vos ${me.k}</b>` : ''); }
    else if (st.mode === 'equipos') el.innerHTML = `<span class="tr">🔴 ${S.score.r}</span> <small>/${st.goal}</small> <span class="ta">${S.score.a} 🔵</span>`;
    else {
      const L = S.players.slice().sort((a, b) => b.k - a.k), me = S.players.find(p => p.id === C.me());
      el.innerHTML = `🥇 ${esc(L[0] ? L[0].name : '')} ${L[0] ? L[0].k : 0}<small>/${st.goal}</small>` + (me && !C.obs() ? ` · <b>vos ${me.k}</b>` : '');
    }
  }
  function tabla() {
    const S = C.S(), t = $('#tabla'); if (!S || !activo) return;
    t.classList.toggle('hidden', !inp.tabla);
    if (!inp.tabla) return;
    const fila = p => `<tr class="${p.id === C.me() ? 'me' : ''}"><td>${esc(p.avatar)} <span style="color:${colorDe(p.id)}">${esc(p.name)}</span>${p.bot ? ' 🤖' : ''}${!p.connected ? ' ⚠️' : ''}</td><td>${p.k}</td><td>${p.d}</td></tr>`;
    const orden = l => l.slice().sort((a, b) => b.k - a.k || a.d - b.d);
    if (S.settings.mode === 'equipos') {
      t.innerHTML = ['r', 'a'].map(tm => `<h3 class="${tm === 'r' ? 'tr' : 'ta'}">${tm === 'r' ? '🔴 Albirroja' : '🔵 Azules'} · ${S.score[tm]}</h3><table><tr><th>Jugador</th><th>Bajas</th><th>Caídas</th></tr>${orden(S.players.filter(p => p.team === tm)).map(fila).join('')}</table>`).join('');
    } else t.innerHTML = `<h3>Tabla · ${esc(W.mapa(S.settings.map).n)}</h3><table><tr><th>Jugador</th><th>Bajas</th><th>Caídas</th></tr>${orden(S.players).map(fila).join('')}</table>`;
  }
  J.tabla = tabla;
  J.chat = m => {
    const d = document.createElement('div'); d.className = 'cl';
    if (m.kind === 'msg') d.innerHTML = `<b style="color:${colorDe(m.id)}">${esc(m.name)}:</b> ${esc(m.text)}`; else d.innerHTML = `<i>${esc(m.text)}</i>`;
    const b = $('#clog'); b.appendChild(d); while (b.children.length > 7) b.firstChild.remove();
    setTimeout(() => d.classList.add('viejo'), 9000);
  };
  J._dbg = { yo, inp, remotos, VM };   // para probar desde la consola
  J.vivo = () => yo.alive;
  J.prim = () => yo.prim;
  J.setPrim = w => { if (A[w]) yo.prim = w; };
})();
