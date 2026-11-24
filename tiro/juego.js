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
  const CIELO = { mercado: ['#9fd3ff', '#8d8a84', 'baldosa'], puerto: ['#b9d3e8', '#5b5e63', 'asfalto'], chaco: ['#cfe2ef', '#b87444', 'tierra'], laberinto: ['#cfe6d2', '#6f9a52', 'cesped'], estadio: ['#bcd4ea', '#ffffff', 'estadio'] };
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
    else if (tipo === 'agua') { g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 14, 1.5); } ruido(10); }
    else if (tipo === 'cesped') { ruido(40); for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(80,80,80,.22)' : 'rgba(255,255,255,.2)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 2 + Math.random() * 4); } }
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
    mapaId = id; const M = W.mapa(id), cfg = CIELO[id] || M.cielo || CIELO.mercado;
    puertasB = {};
    // reflectores de algunos mapas (la fachada de la Basílica)
    for (const [x, y, z, col, it, dist] of (M.luces || [])) { const l = new T.PointLight(col, it, dist, 1.5); l.position.set(x, y, z); mapGroup.add(l); }
    mapGroup = new T.Group();
    scene.background = new T.Color(cfg[0]); scene.fog = new T.Fog(cfg[0], 45, 150);
    let ft; if (cfg[2] === 'estadio') ft = pisoEstadio(M); else { ft = tex(cfg[2]).clone(); ft.needsUpdate = true; ft.repeat.set(M.S, M.S); }
    const piso = new T.Mesh(new T.PlaneGeometry(2 * M.S + 2, 2 * M.S + 2), new T.MeshPhongMaterial({ color: cfg[1], map: ft, shininess: 4, specular: 0x0a0a0a }));
    piso.rotation.x = -Math.PI / 2; mapGroup.add(piso);
    // afuera: agua en el puerto, campo en las demás
    const afuera = new T.Mesh(new T.PlaneGeometry(600, 600), new T.MeshLambertMaterial({ color: { puerto: '#3b6f8f', chaco: '#9a7a3e', laberinto: '#4f7a3a', estadio: '#55585e' }[id] || (M.cielo && M.cielo[3]) || '#6f8a52' }));
    afuera.rotation.x = -Math.PI / 2; afuera.position.y = -0.05; mapGroup.add(afuera);
    // partes del piso pintadas (asfalto, arena, agua...)
    for (const [x0, z0, x1, z1, col, tx] of (M.suelos || [])) {
      const t2 = tex(tx || 'ruido').clone(); t2.needsUpdate = true; t2.repeat.set((x1 - x0) / 2, (z1 - z0) / 2);
      const pl = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), new T.MeshPhongMaterial({ color: col, map: t2, shininess: tx === 'agua' ? 60 : 4, specular: tx === 'agua' ? 0x335566 : 0x0a0a0a }));
      pl.rotation.x = -Math.PI / 2; pl.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2); mapGroup.add(pl);
    }
    for (const b of M.boxes) {
      if (b[7]) continue;
      const w = b[3] - b[0], h = b[4] - b[1], d = b[5] - b[2];
      const m = new T.Mesh(cajaGeo(w, h, d), matCaja(b[6]));
      m.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); mapGroup.add(m);
    }
    // árboles y cerros de lejos para que no se vea vacío
    const tronco = new T.MeshLambertMaterial({ color: '#6b4a2b' }), copa = new T.MeshLambertMaterial({ color: id === 'chaco' ? '#7d8f3a' : '#3f7d3a' });
    const adentro = id === 'c_bunker' || id === 'c_itaipu';
    for (let i = 0; i < (adentro ? 0 : 40); i++) {
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
    // objetos 3D: mientras cargan se ven cajas, después los modelos
    propsGroup = null;
    if (M.props && M.props.length) {
      const tipos = [...new Set(M.props.map(p => p.t))];
      if (tipos.every(t => t in GLBP)) ponerProps(M);
      else { ponerProps(M); Promise.all(tipos.map(cargarProp)).then(() => { if (mapaId === id && mapGroup) ponerProps(M); }); }
    }
  }

  // ================= objetos 3D de los mapas =================
  // Modelos gratis de Poly Pizza (Quaternius, Isa y Kay: CC0; los demás CC-BY, nombrados en los créditos)
  const GLBP = {}, cargaP = {};
  const TINTE = {
    lapacho: c => { if (c.r > c.g * 1.4) c.set('#f06aae'); },
    columna: c => c.lerp(new T.Color('#b9b2a5'), 0.7),
    fuente: c => c.lerp(new T.Color('#d8d2c4'), 0.3),
  };
  let propsGroup = null, lamparas = [], humeantes = [];
  function cargarProp(t) {
    if (cargaP[t]) return cargaP[t];
    if (!T.GLTFLoader || W.PROPS[t].archivo === false) { GLBP[t] = null; return cargaP[t] = Promise.resolve(null); }
    return cargaP[t] = new Promise(res => new T.GLTFLoader().load('modelos/props/' + t + '.glb', g => {
      prepararGLB(g); g.scene.updateMatrixWorld(true);
      // retoques de color: lapacho bien rosado, columnas de piedra clara
      if (TINTE[t]) { const vistos = new Set(); g.scene.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if (!vistos.has(m) && m.color) { vistos.add(m); TINTE[t](m.color); } }); }); }
      g.caja = new T.Box3().setFromObject(g.scene); GLBP[t] = g; res(g);
    }, null, () => { GLBP[t] = null; res(null); }));
  }
  let lampMat = null;
  const lampCol = {};
  function brilloLampara(col) {
    if (col) { if (!lampCol[col]) lampCol[col] = new T.SpriteMaterial({ map: brillo(col), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }); return new T.Sprite(lampCol[col]); }
    if (!lampMat) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.25, 'rgba(255,220,140,.55)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      lampMat = new T.SpriteMaterial({ map: new T.CanvasTexture(c), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    }
    return new T.Sprite(lampMat);
  }
  function ponerProps(M) {
    if (propsGroup) { mapGroup.remove(propsGroup); propsGroup.traverse(o => { if (o.geometry && o.userData.propio) o.geometry.dispose(); }); }
    propsGroup = new T.Group(); lamparas = []; humeantes = []; puertasP = {};
    const sueltos = new T.Group();
    for (const p of M.props) {
      const P = W.PROPS[p.t], piv = new T.Group();
      piv.rotation.y = p.q * Math.PI / 2; piv.position.set(p.x, p.y, p.z);
      if (P.brillo) {
        const b = brilloLampara(P.color), k = p.t === 'torre_luz' ? 7 : P.color ? 1 : 1.3;
        b.scale.set(k, k, 1); b.position.set(P.brillo[0] * p.w, P.brillo[1] * p.h, P.brillo[2] * p.d); b.visible = noche || !!P.color;
        const bp = new T.Group(); bp.rotation.y = p.q * Math.PI / 2; bp.position.set(p.x, p.y, p.z); bp.add(b); propsGroup.add(bp); lamparas.push(b); b.userData.siempre = !!P.color;
      }
      if (p.humo) humeantes.push([p.x, p.y + p.h * 0.7, p.z]);
      let dest = sueltos;
      if (p.puerta) {
        piv.userData.abre = p.abre; dest = propsGroup;
        if ((M.abiertas || []).includes(p.puerta)) { if (p.abre && p.abre[1] < -1) continue; if (p.abre) { piv.position.x += p.abre[0]; piv.position.y += p.abre[1]; piv.position.z += p.abre[2]; } }
        else (puertasP[p.puerta] = puertasP[p.puerta] || []).push(piv);
      }
      if (p.t === 'publi') { piv.add(cartelPubli(p)); propsGroup.add(piv); continue; }
      const g = GLBP[p.t];
      if (!g) {
        // todavía no cargó (o no hay internet): una caja del color del objeto
        if (P.solido === false) continue;
        const col = P.col || [1, 1, 1], w = p.w * col[0], h = p.h * col[1], d = p.d * col[2];
        const m = new T.Mesh(cajaGeo(w, h, d), matCaja(P.c)); m.position.y = h / 2; m.userData.propio = true; piv.add(m); propsGroup.add(piv);
        continue;
      }
      const c = g.caja, sz = c.getSize(new T.Vector3()), ce = c.getCenter(new T.Vector3());
      const sx = p.w / sz.x, sy = p.h / sz.y, sz2 = p.d / sz.z;
      const hold = new T.Group(); hold.add(g.scene.clone(true));
      hold.scale.set(sx, sy, sz2); hold.position.set(-ce.x * sx, -c.min.y * sy, -ce.z * sz2);
      piv.add(hold); dest.add(piv);
      if (false) {
        const b = brilloLampara(), k = p.t === 'torre_luz' ? 7 : 1.3;
        b.scale.set(k, k, 1); b.position.set(P.brillo[0] * p.w, P.brillo[1] * p.h, P.brillo[2] * p.d); b.visible = noche;
        const bp = new T.Group(); bp.rotation.y = p.q * Math.PI / 2; bp.position.set(p.x, p.y, p.z); bp.add(b); propsGroup.add(bp); lamparas.push(b);
      }
    }
    fundir(sueltos, propsGroup);
    mapGroup.add(propsGroup);
  }
  // junta todos los objetos que comparten material en una sola malla (mucho más liviano para el celular)
  function fundir(raiz, destino) {
    raiz.updateMatrixWorld(true);
    const grupos = new Map();
    raiz.traverse(o => {
      if (!o.isMesh) return;
      if (Array.isArray(o.material) || o.isSkinnedMesh || o.morphTargetInfluences) {
        const c = new T.Mesh(o.geometry, o.material); c.matrixAutoUpdate = false; c.matrix.copy(o.matrixWorld); destino.add(c); return;
      }
      const at = ['position', 'normal', 'uv', 'color'].filter(a => o.geometry.attributes[a]);
      const k = o.material.uuid + '|' + at.join(',') + '|' + at.map(a => o.geometry.attributes[a].itemSize).join(',');
      if (!grupos.has(k)) grupos.set(k, { mat: o.material, at, list: [] });
      grupos.get(k).list.push(o);
    });
    const v = new T.Vector3(), nm = new T.Matrix3();
    const den = a => !a.normalized ? 1 : a.array instanceof Uint8Array ? 255 : a.array instanceof Uint16Array ? 65535 : a.array instanceof Int8Array ? 127 : a.array instanceof Int16Array ? 32767 : 1;
    for (const gr of grupos.values()) {
      let nv = 0, ni = 0;
      for (const o of gr.list) { const g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
      const out = {}; for (const a of gr.at) out[a] = new Float32Array(nv * gr.list[0].geometry.attributes[a].itemSize);
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let ov = 0, oi = 0;
      for (const o of gr.list) {
        const g = o.geometry, n = g.attributes.position.count; nm.getNormalMatrix(o.matrixWorld);
        for (const a of gr.at) {
          const src = g.attributes[a], is = src.itemSize, dst = out[a], q = den(src);
          for (let i = 0; i < n; i++) {
            const j = (ov + i) * is;
            if (a === 'position') { v.fromBufferAttribute(src, i).applyMatrix4(o.matrixWorld); dst[j] = v.x; dst[j + 1] = v.y; dst[j + 2] = v.z; }
            else if (a === 'normal') { v.fromBufferAttribute(src, i).applyMatrix3(nm).normalize(); dst[j] = v.x; dst[j + 1] = v.y; dst[j + 2] = v.z; }
            else { dst[j] = src.getX(i) / q; if (is > 1) dst[j + 1] = src.getY(i) / q; if (is > 2) dst[j + 2] = src.getZ(i) / q; if (is > 3) dst[j + 3] = src.getW(i) / q; }
          }
        }
        if (g.index) for (let k = 0; k < g.index.count; k++) idx[oi + k] = g.index.getX(k) + ov;
        else for (let k = 0; k < n; k++) idx[oi + k] = ov + k;
        ov += n; oi += g.index ? g.index.count : n;
      }
      const geo = new T.BufferGeometry();
      for (const a of gr.at) geo.setAttribute(a, new T.BufferAttribute(out[a], gr.list[0].geometry.attributes[a].itemSize));
      geo.setIndex(new T.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
      const m = new T.Mesh(geo, gr.mat); m.userData.propio = true; destino.add(m);
    }
  }
  // carteles de publicidad del estadio
  const publiCache = {};
  function cartelPubli(p) {
    const n = Object.keys(publiCache).length;
    if (!publiCache[p.txt]) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
      const fondo = ['#c8241a', '#1d4fd8', '#f4f4f4'][n % 3], letra = n % 3 === 2 ? '#c8241a' : '#ffffff';
      g.fillStyle = fondo; g.fillRect(0, 0, 512, 96);
      g.fillStyle = letra; g.font = 'bold 54px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (p.est === 'letras') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 96); const cs = ['#e63946', '#f4a261', '#2a9d8f', '#1d4fd8', '#9b5de5', '#f15bb5', '#00a86b']; let x = 22; g.font = 'bold 66px Arial, sans-serif'; g.textAlign = 'left'; for (let i = 0; i < p.txt.length; i++) { const ch = p.txt[i]; g.fillStyle = ch === '♥' ? '#d62828' : cs[i % cs.length]; g.fillText(ch, x, 52); x += g.measureText(ch).width + 2; } }
      else g.fillText(p.txt, 256, 50, 490);
      publiCache[p.txt] = new T.MeshPhongMaterial({ map: new T.CanvasTexture(c), shininess: 20 });
    }
    const lado = matCaja(8), mats = [lado, lado, lado, lado, publiCache[p.txt], publiCache[p.txt]];
    const m = new T.Mesh(new T.BoxGeometry(p.w, p.h, p.d), mats); m.position.y = p.h / 2; m.userData.propio = true;
    return m;
  }
  // la cancha pintada (pasto a rayas y las líneas blancas)
  function pisoEstadio(M) {
    const R = 1024, L = 2 * M.S + 2, k = R / L, X = x => (x + M.S + 1) * k;
    const c = document.createElement('canvas'); c.width = c.height = R; const g = c.getContext('2d');
    g.fillStyle = '#80838a'; g.fillRect(0, 0, R, R);
    for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'; g.fillRect(Math.random() * R, Math.random() * R, 2, 2); }
    g.fillStyle = '#2f7230'; g.fillRect(X(-25), X(-14.6), 50 * k, 29.2 * k);
    for (let x = -25, i = 0; x < 25; x += 4, i++) if (i % 2) { g.fillStyle = '#367d35'; g.fillRect(X(x), X(-14.6), Math.min(4, 25 - x) * k, 29.2 * k); }
    for (let i = 0; i < 14000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,40,0,.12)' : 'rgba(200,255,160,.08)'; g.fillRect(X(-25) + Math.random() * 50 * k, X(-14.6) + Math.random() * 29.2 * k, 1, 3); }
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 0.14 * k;
    const rect = (x0, z0, x1, z1) => g.strokeRect(X(x0), X(z0), (x1 - x0) * k, (z1 - z0) * k);
    rect(-22.4, -13, 22.4, 13);
    g.beginPath(); g.moveTo(X(0), X(-13)); g.lineTo(X(0), X(13)); g.stroke();
    g.beginPath(); g.arc(X(0), X(0), 4.5 * k, 0, 7); g.stroke();
    [-1, 1].forEach(sg => {
      rect(sg > 0 ? 22.4 - 6.5 : -22.4, -8, sg > 0 ? 22.4 : -22.4 + 6.5, 8);
      rect(sg > 0 ? 22.4 - 2.5 : -22.4, -4, sg > 0 ? 22.4 : -22.4 + 2.5, 4);
      g.beginPath(); g.arc(X(sg * 17.2), X(0), 4.5 * k, sg > 0 ? Math.PI * 0.71 : -Math.PI * 0.29, sg > 0 ? Math.PI * 1.29 : Math.PI * 0.29); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(sg * 16.9), X(0), 0.2 * k, 0, 7); g.fill();
    });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X(0), X(0), 0.22 * k, 0, 7); g.fill();
    const t = new T.CanvasTexture(c); t.anisotropy = 8;
    return t;
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
  const ARMA_NODO = { fusil: 'AK', subfusil: 'SMG', escopeta: 'Shotgun', franco: 'Sniper', pistola: 'Pistol', cuchillo: 'Knife_1' };
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
  const LARGO = { fusil: 0.78, subfusil: 0.5, escopeta: 0.85, franco: 1.0, pistola: 0.3, cuchillo: 0.34 };
  function armasVM() {
    const gl = GLB.soldado, m = T.SkeletonUtils.clone(gl.scene), mix = new T.AnimationMixer(m);
    const c = gl.animations.find(a => /(^|\|)Idle_Shoot$/.test(a.name));
    if (c) { mix.clipAction(c).play(); mix.update(0); }
    m.updateMatrixWorld(true);
    const giro = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI);
    for (const w in ARMA_NODO) {
      if (w === 'cuchillo') continue;
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
  const TIPOS_Z = ['zombi', 'gordo', 'brazo', 'medio', 'explosivo', 'teju'];
  // el jefe final: "Dragon Evolved" de Quaternius (CC0), con armadura
  const ARCH_Z = { zombi: 'modelos/zombi.glb', gordo: 'modelos/zombi_gordo.glb', brazo: 'modelos/zombi_brazo.glb', medio: 'modelos/zombi_medio.glb', teju: 'modelos/jefe/teju_jagua.glb' };
  const ALTO_Z = { zombi: 1.8, gordo: 1.85, brazo: 2.05, medio: 0.75, explosivo: 1.8, teju: 4.4 };
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
  function zombiNuevo(tipo, caliente) {
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
      const pide = { quieto: [/(^|\|)(Zombie)?Idle$/, /(^|\|)Flying_Idle$/], camina: [/(^|\|)Walk$/, /(^|\|)Crawl$/, /(^|\|)Flying_Idle$/], corre: [/(^|\|)Run_Arms$/, /(^|\|)Run$/, /(^|\|)Crawl$/, /(^|\|)Fast_Flying$/],
        ataca: [/(^|\|)Headbutt$/, /(^|\|)Punch$/, /(^|\|)Idle_Attack$/, /(^|\|)Run_Attack$/, /(^|\|)Attack$/, /(^|\|)Crawl$/], muere: [/(^|\|)Death$/], aturdido: [/(^|\|)HitReact$/] };
      if (tipo === 'medio') { pide.camina = [/(^|\|)Crawl$/]; pide.corre = [/(^|\|)Crawl$/]; pide.ataca = [/(^|\|)Crawl$/]; }
      for (const k in pide) { for (const re of pide[k]) { const c = clip(re); if (c) { acc[k] = mixer.clipAction(c); break; } } }
      if (acc.muere) { acc.muere.setLoop(T.LoopOnce, 1); acc.muere.clampWhenFinished = true; }
      u = { modelo: true, mixer, acc, actual: null };
      // el explosivo es verde y brilla; el jefe es oscuro y acorazado
      if (tipo === 'explosivo' || tipo === 'teju') {
        const mats = [];
        m.traverse(o => { if (o.isMesh) { o.material = [].concat(o.material).map(x => { const c = x.clone(); mats.push(c); return c; }); if (o.material.length === 1) o.material = o.material[0]; } });
        for (const c of mats) { if (tipo === 'explosivo') { c.color.lerp(new T.Color('#7cff3a'), 0.55); if (c.emissive) { c.emissive.set('#2f8a00'); c.emissiveIntensity = 0.7; } } else c.color.lerp(new T.Color('#3a4434'), 0.55); }
        u.mats = mats;
      }
    } else {
      // sin modelos: un muñeco verde de cajas
      const mat = new T.MeshLambertMaterial({ color: '#5f8a3a' }), ropa = new T.MeshLambertMaterial({ color: '#4a3b2a' });
      const alto = ALTO_Z[tipo] || 1.8, c1 = new T.Mesh(new T.BoxGeometry(0.6, alto * 0.45, 0.35), ropa); c1.position.y = alto * 0.5;
      const c2 = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.4), mat); c2.position.y = alto * 0.85;
      const b1 = new T.Mesh(new T.BoxGeometry(0.15, 0.15, 0.6), mat); b1.position.set(0.2, alto * 0.65, -0.3); const b2 = b1.clone(); b2.position.x = -0.2;
      g.add(c1, c2, b1, b2); u = { modelo: false };
      if (caliente) [mat, ropa].forEach(m => { m.emissive.set('#ff8a3a'); m.emissiveIntensity = 1.3; });
    }
    g.userData = u; scene.add(g);
    return g;
  }
  function animarZ(z, dt) {
    const u = z.g.userData;
    if (!u.modelo) { if (z.estado === 2) z.g.rotation.x = -Math.min(1.5, (z.muerto || 0) * 4); return; }
    const q = z.estado === 2 ? 'muere' : z.estado === 4 && u.acc.aturdido ? 'aturdido' : z.estado === 1 || z.estado === 3 ? 'ataca' : z.estado === 5 || z.vel > 3 ? 'corre' : z.velS > 0.3 ? 'camina' : 'quieto';
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
      if (!z) { const tipo = TIPOS_Z[ti] || 'zombi'; z = { id, tipo, g: zombiNuevo(tipo, visionNoche), buf: [], estado: 0, vel: 0, velS: 0, cur: null, gruT: 2 + Math.random() * 5, muerto: 0 }; zombis.set(id, z); }
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
      if (z.tipo === 'teju' && z.g.userData.mats) { const ex = campC && campC[8] > 0, k = ex ? 0.6 + Math.sin(performance.now() / 120) * 0.4 : 0; for (const c of z.g.userData.mats) if (c.emissive) { c.emissive.set(ex ? '#7fd8ff' : '#000000'); c.emissiveIntensity = k; } }
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
  const PROY = ['granada', 'molotov', 'acido', 'ruido', 'humo'];
  const proys = new Map(), areas = [], humos = [];
  let geoG = null;
  function proyNuevo(tipo) {
    if (!geoG) geoG = { esfera: new T.SphereGeometry(1, 10, 8), botella: new T.CylinderGeometry(0.05, 0.07, 0.28, 8) };
    const g = new T.Group();
    const glp = (tipo === 'granada' || tipo === 'molotov') && GLBP['item_' + tipo];
    if (glp) { const m = glp.scene.clone(true), c = glp.caja, sz = c.getSize(new T.Vector3()), ce = c.getCenter(new T.Vector3()), k = (tipo === 'granada' ? 0.2 : 0.34) / sz.y; m.scale.setScalar(k); m.position.set(-ce.x * k, -ce.y * k, -ce.z * k); g.add(m); if (tipo === 'molotov') { const llama = new T.Sprite(new T.SpriteMaterial({ map: brillo('#ffb040'), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); llama.scale.set(0.35, 0.35, 1); llama.position.y = 0.2; g.add(llama); } }
    else if (tipo === 'granada') { g.add(new T.Mesh(geoG.esfera, new T.MeshPhongMaterial({ color: '#3d4a2a' }))); g.children[0].scale.setScalar(0.1); }
    else if (tipo === 'molotov') {
      const b = new T.Mesh(geoG.botella, new T.MeshPhongMaterial({ color: '#6b3d12', transparent: true, opacity: 0.85 })); g.add(b);
      const llama = new T.Sprite(new T.SpriteMaterial({ map: brillo('#ffb040'), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); llama.scale.set(0.35, 0.35, 1); llama.position.y = 0.2; g.add(llama);
    } else if (tipo === 'ruido' || tipo === 'humo') {
      const b = new T.Mesh(geoG.botella, new T.MeshPhongMaterial({ color: tipo === 'ruido' ? '#b0281a' : '#8a8f96' })); g.add(b);
      if (tipo === 'ruido') { const l = new T.Sprite(new T.SpriteMaterial({ map: brillo('#ff3a20'), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); l.scale.set(0.4, 0.4, 1); g.add(l); }
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
          else if (a.tipo === 'humo') { u.f += dt; const s = Math.min(u.s, 1 + u.f * 3) * (0.9 + Math.sin(u.f + u.v * 6) * 0.08); c.scale.set(s, s, 1); c.position.y = u.y + u.f * 0.08; c.material.opacity = 0.9 * fin; }
          else if (a.tipo === 'ruido') { c.material.opacity = (Math.sin(a.t * 14) > 0 ? 1 : 0.1) * fin; }
          else { u.f += dt * u.v; c.position.y = 0.05 + (u.f % 1) * 0.5; c.material.opacity = (1 - (u.f % 1)) * 0.8 * fin; }
        } else if (c.material) c.material.opacity = (a.tipo === 'fuego' ? 0.35 : 0.55) * fin;
      });
      if (a.tipo === 'ruido' && ((a.beepT = (a.beepT || 0) - dt) <= 0)) { a.beepT = 0.45; tono(1600, 0, 0.08, 'square', 0.06 * aDistancia(a) + 0.01); }
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
    if (m.tipo === 'humo') {
      for (let i = 0; i < 22; i++) { const an = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 3.6; const sp = new T.Sprite(new T.SpriteMaterial({ map: brillo('#9aa0a6'), transparent: true, depthWrite: false, opacity: 0.9 })); sp.material.color.set(noche ? '#3a3d40' : '#b8bcc0'); sp.position.set(Math.cos(an) * r, 0.6 + Math.random() * 2.2, Math.sin(an) * r); sp.userData = { f: 0, v: Math.random(), s: 3.2 + Math.random() * 2.2, y: sp.position.y }; g.add(sp); }
      raspa(0, 1.5, 3000, 800, 0.2);
    } else if (m.tipo === 'ruido') {
      const l = new T.Sprite(new T.SpriteMaterial({ map: brillo('#ff3a20'), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); l.scale.set(1.6, 1.6, 1); l.position.y = 0.3; g.add(l);
    } else if (m.tipo === 'fuego') {
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
    const bola = new T.Sprite(new T.SpriteMaterial({ map: brillo(m.verde ? '#7dff3a' : '#ff9a2a'), blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1 }));
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
    const S = C.S(); if (!S || (S.settings.mode !== 'zombis' && S.settings.mode !== 'campana') || !yo.alive) return;
    const me = S.players.find(p => p.id === C.me()); if (!me || (tipo === 'granada' ? me.gr : tipo === 'ruido' ? me.ru : me.mo) <= 0) return;
    C.send({ t: 'lanza', tipo, d: W.dir(yo.ry, yo.rx).map(v => Math.round(v * 1000) / 1000) });
    yo.cambioT = 0.35; raspa(0, 0.2, 400, 1600, 0.25);
  }
  J.lanzar = lanzar;
  function tiraHUD() {
    const S = C.S(), el = $('#aTira'); if (!S || !el) return;
    const z = S.settings.mode === 'zombis' || S.settings.mode === 'campana', me = S.players.find(p => p.id === C.me()), N = nivelDe(S), ru = !!(N && N.id >= 5);
    el.classList.toggle('hidden', !z || C.obs());
    if (z && me) el.textContent = `💣 ${me.gr | 0}   🔥 ${me.mo | 0}` + (ru ? `   📢 ${me.ru | 0}` : '');
    document.querySelectorAll('[data-b="granada"],[data-b="molotov"]').forEach(b => b.classList.toggle('hidden', !z));
    document.querySelectorAll('[data-b="ruido"]').forEach(b => b.classList.toggle('hidden', !ru));
    document.querySelectorAll('[data-b="usar"]').forEach(b => b.classList.toggle('hidden', !N));
    document.querySelectorAll('[data-b="curar"]').forEach(b => b.classList.toggle('hidden', !(me && me.lim)));
    if (z && me && me.lim) el.textContent += `   💊 ${me.bq | 0}`;
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
    g = new T.Group(); box(g, 0.025, 0.05, 0.22, 0, 0.01, -0.2, met2); box(g, 0.035, 0.06, 0.13, 0, -0.01, -0.02, mad); mano(g); VM.cuchillo = g;
    for (const k in VM) { VM[k].visible = false; vmGrupo.add(VM[k]); }
    const fc = document.createElement('canvas'); fc.width = fc.height = 64; const fg = fc.getContext('2d');
    const gr = fg.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.3, 'rgba(255,200,60,.9)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
    fg.fillStyle = gr; fg.fillRect(0, 0, 64, 64);
    fogon = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(fc), blending: T.AdditiveBlending, depthTest: false, transparent: true }));
    fogon.scale.set(0.22, 0.22, 1); fogon.visible = false; vmGrupo.add(fogon);
  }
  const PUNTA = { fusil: -0.62, escopeta: -0.5, franco: -0.88, pistola: -0.24, subfusil: -0.37, cuchillo: -0.3 };

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
      const tierra = mapaId === 'chaco' || mapaId === 'laberinto' || mapaId === 'estadio';
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
  // deslizarse: nubecitas de polvo en los pies y un roce largo
  let polvoTex = null;
  function polvoPies(x, y, z) {
    if (!polvoTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); polvoTex = new T.CanvasTexture(c);
    }
    const col = noche ? '#4a463f' : { chaco: '#c9a079', laberinto: '#9c9a78', estadio: '#a9b090' }[mapaId] || '#c8c2b4';
    const h = new T.Sprite(new T.SpriteMaterial({ map: polvoTex, color: col, transparent: true, depthWrite: false, opacity: 0.6 }));
    h.position.set(x + (Math.random() - 0.5) * 0.5, y + 0.15 + Math.random() * 0.2, z + (Math.random() - 0.5) * 0.5); scene.add(h);
    humos.push({ o: h, t: 0, max: 0.55 + Math.random() * 0.3, s0: 0.35, s1: 1.1, op: 0.6, sube: 0.5 });
  }
  function deslizSnd(vol, pan) {
    if (!soundOn || !actx || vol < 0.01) return;
    try {
      const t = actx.currentTime, src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      const tierra = mapaId === 'chaco' || mapaId === 'laberinto' || mapaId === 'estadio';
      src.buffer = ruido(); f.type = 'bandpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(tierra ? 900 : 1500, t); f.frequency.exponentialRampToValueAtTime(tierra ? 260 : 420, t + 0.55);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      let out = g;
      if (actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
      out.connect(actx.destination);
      src.connect(f); f.connect(g); src.start(t, Math.random() * 0.2); src.stop(t + 0.65);
    } catch (e) {}
  }
  function deslizDe(p) {
    const dx = p.x - cam.position.x, dz = p.z - cam.position.z, d = Math.hypot(dx, dz);
    if (d > 32) return;
    const rel = Math.atan2(-dx, -dz) - cam.rotation.y;
    deslizSnd(Math.pow(1 - d / 32, 1.5) * 0.6, -Math.sin(rel) * Math.min(1, d / 3));
  }
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
      if (w === 'cuchillo') { raspa(0, 0.12, 4000, 1500, 0.18 * vol); return; }
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
    const NV = nivelDe(S);
    noche = S.settings.mode === 'zombis' || !!(NV && NV.noche);
    const cfg = CIELO[mapaId] || (mapaId && W.mapa(mapaId).cielo) || CIELO.mercado;
    if (noche) {
      scene.background = new T.Color('#04060c'); scene.fog = new T.Fog('#04060c', 4, 34);
      luz.cielo.intensity = 0.07; luz.cielo.color.set('#6b7fb0'); luz.cielo.groundColor.set('#120d08');
      luz.sol.intensity = 0.12; luz.sol.color.set('#7f93c8');
      luz.vm1.intensity = 0.16; luz.vm2.intensity = 0.1;
      if (NV && NV.niebla) { scene.background = new T.Color(NV.niebla[0]); scene.fog = new T.Fog(NV.niebla[0], NV.niebla[1], NV.niebla[2]); }
      if (NV && NV.luna) { luz.cielo.intensity = NV.luna; luz.cielo.color.set(NV.id === 10 ? '#4aa0c8' : '#8a9ad0'); }
    } else {
      scene.background = new T.Color(cfg[0]); scene.fog = new T.Fog(cfg[0], 45, 150);
      luz.cielo.intensity = 0.8; luz.cielo.color.set(0xe8f0ff); luz.cielo.groundColor.set(0x6a5532);
      luz.sol.intensity = 0.75; luz.sol.color.set(0xfff4e0);
      luz.vm1.intensity = 1.0; luz.vm2.intensity = 0.5;
      if (NV && NV.niebla) { scene.background = new T.Color(NV.niebla[0]); scene.fog = new T.Fog(NV.niebla[0], NV.niebla[1], NV.niebla[2]); luz.sol.color.set('#ffcf8a'); }
      else if (NV && NV.id === 2) { luz.sol.color.set('#ffd0a0'); }
    }
    luz.linterna.intensity = noche && linternaOn ? 2.6 : 0;
    for (const r of remotos.values()) if (r.g.userData.haz) r.g.userData.haz.visible = noche;
    for (const b of lamparas) b.visible = noche || b.userData.siempre;
  }
  // mira nocturna del francotirador: imagen verde que ve lejos, y los zombis brillan por el calor
  let visionNoche = false;
  function visionNocturna(on) {
    visionNoche = on;
    $('#nv').classList.toggle('hidden', !on);
    ren.domElement.style.filter = on ? 'grayscale(1) sepia(1) hue-rotate(70deg) saturate(3) brightness(0.95) contrast(1.6)' : '';
    if (on) {
      luz.cielo.intensity = 0.4; luz.cielo.color.set('#ffffff'); luz.cielo.groundColor.set('#333333'); luz.sol.intensity = 0.22;
      for (const r of remotos.values()) if (r.g.userData.haz) r.g.userData.haz.visible = false;   // los haces de las linternas encandilan
      scene.fog = new T.Fog('#04060c', 70, 260);
    } else if (C && C.S()) ambiente(C.S());
    calor(on);
  }
  // los zombis "calientes": brillan en naranja (en la imagen verde se ven casi blancos)
  function calor(on) {
    const vistos = new Set();
    const pinta = m => { if (!m || vistos.has(m) || !m.emissive) return; vistos.add(m); m.emissive.set(on ? '#ffb070' : '#000000'); m.emissiveIntensity = on ? 2 : 1; };
    for (const k in GLBZ) GLBZ[k].scene.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(pinta); });
    for (const z of zombis.values()) z.g.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(pinta); });
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
    if (S.settings.mode === 'campana') ['torreta', 'escudo', 'blindado', 'palmera', 'helicoptero', 'jeep', 'locomotora', 'colectivo', 'camion_militar', 'humvee'].forEach(cargarProp);
    if (S.settings.mode === 'campana' && S.camp && !activo) setTimeout(() => briefing(S.camp.n), 300);
    if (!activo) { activo = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    if (!obs && !tactil() && !yo.alive) { /* espera el spawn */ }
    pausa(!tactil() && !obs && document.pointerLockElement !== ren.domElement);
    medir();
  };
  J.salir = () => {
    activo = false; cancelAnimationFrame(raf);
    for (const r of remotos.values()) scene.remove(r.g); remotos.clear();
    for (const z of zombis.values()) scene.remove(z.g); zombis.clear(); yo.ola = null;
    limpiarTiros(); campLimpiar();
    if (visionNoche) visionNocturna(false);
    yo.alive = false; inp.fire = false; inp.aim = false;
    if (document.pointerLockElement) document.exitPointerLock();
    $('#juego').classList.add('hidden'); $('#muerte').classList.add('hidden'); $('#pausa').classList.add('hidden');
    $('#feed').innerHTML = ''; $('#clog').innerHTML = '';
  };
  J.activo = () => activo;
  J.estado = S => {
    if (S.settings.mode === 'zombis' || S.settings.mode === 'campana') { J.cargarZombis(); cargarItems(); }
    if (S.settings.mode === 'campana' && !cuchilloVM.hecho) { cuchilloVM.hecho = true; cuchilloVM(); }
    if (!scene) return;
    const NV = nivelDe(S), quiereNoche = S.settings.mode === 'zombis' || !!(NV && NV.noche);
    if (S.settings.map !== mapaId) { cargarMapa(S.settings.map); ambiente(S); }
    else if (quiereNoche !== noche || (NV && NV.niebla)) ambiente(S);
    J.campAbiertas(S);
    document.querySelectorAll('[data-b="luz"]').forEach(b => b.classList.toggle('hidden', !quiereNoche));
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
        if (m.C || mercs.size || campK) J.campSnap(m);
        break;
      }
      case 'spawn': {
        if (m.id === me) {
          Object.assign(yo.s, { x: m.p[0], y: m.p[1], z: m.p[2], vx: 0, vy: 0, vz: 0, crouch: false, slideT: 0, ground: true });
          yo.aparecio = { x: m.p[0], y: m.p[1], z: m.p[2] }; yo.bueno = null;
          yo.ry = m.ry; yo.rx = 0; yo.alive = true; yo.hp = 100; yo.reloadT = 0; yo.w = yo.prim; yo.kick = 0; yo.bloom = 0;
          yo.ammo = { [yo.prim]: A[yo.prim].mag, pistola: A.pistola.mag };
          yo.res = m.res ? Object.assign({}, m.res) : null;
          $('#muerte').classList.add('hidden'); SFX.aparece(); armaHUD();
          // si no volvió a agarrar el mouse mientras estaba muerto, se le pide un clic
          if (!tactil() && !C.obs() && document.pointerLockElement !== ren.domElement && !chatAbierto()) pausa(true);
        } else { const r = remotos.get(m.id); if (r) { r.buf = [{ t: performance.now(), x: m.p[0], y: m.p[1], z: m.p[2], ry: m.ry, rx: 0 }]; r.alive = true; r.caida = 0; } }
        break;
      }
      case 'fx': {
        const r = remotos.get(m.id) || mercs.get(m.id); if (!r) break;
        const o = m.o;
        for (const e of m.e) { trazo(o, e); polvo(e, '#cfc6b0'); }
        const d = Math.hypot(o[0] - (yo.s ? yo.s.x : 0), o[2] - (yo.s ? yo.s.z : 0));
        tiroSnd(m.w, 1 / (1 + d / 10));
        r.fuego = 0.06; r.tiroT = 0.45;
        break;
      }
      case 'kill': feedKill(m); break;
      case 'item': { if (m.res) yo.res = Object.assign({}, m.res); const t = { balas: ['📦 +1 cargador', 'para cada arma'], botiquin: ['💊 Botiquín guardado', 'Usalo con H (o 💊)'], granada: ['💣 +1 granada', ''], molotov: ['🔥 +1 molotov', ''] }[m.tipo] || ['+1', '']; aviso(t[0], t[1]); metal(0, 0.08, 1800, 900, 0.15, 3); tono(880, 0.05, 0.08, 'triangle', 0.08); armaHUD(); break; }
      case 'curado': yo.hp = m.hp; aviso('💊 +60 de vida', ''); tono(660, 0, 0.12, 'sine', 0.1); tono(990, 0.1, 0.2, 'sine', 0.1); break;
      case 'cnivel': case 'cfase': case 'cfin': case 'cfalla': case 'cpunto': case 'abrir': case 'jefe': case 'final': J.campMsg(m); break;
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
        const h = $('#hitm'); h.className = m.kill ? 'kill' : m.bl ? 'bl' : m.head ? 'head' : '';
        if (m.bl && !m.kill) { metal(0, 0.06, 3000, 1800, 0.12, 6); break; } h.style.opacity = 1; clearTimeout(h._t); h._t = setTimeout(() => h.style.opacity = 0, 160);
        (m.head ? SFX.head : SFX.hit)();
        break;
      }
    }
  };
  function nombre(id, vn) { if (vn) return (id && id[0] === 'm' ? '🪖 ' : '🐉 ') + vn; const mr = mercs.get(id); if (mr) return '🪖 ' + CAMP().MT[mr.tipo].n; const zz = zombis.get(id); if (zz && zz.tipo === 'teju') return '🐉 Teju Jagua'; if (zz && zz.tipo === 'explosivo') return '💥 Zombi explosivo'; if (esZombi(id) || /^z\d+$/.test(id || '')) return '🧟 Zombi'; const p = (C.S().players || []).find(x => x.id === id); return p ? p.name : '¿?'; }
  function colorDe(id) {
    const S = C.S(), p = S.players.find(x => x.id === id); if (!p) return /^z\d+$/.test(id || '') ? '#9ccc65' : /^m\d+$/.test(id || '') ? '#ff8a80' : '#fff';
    return S.settings.mode === 'equipos' ? (p.team === 'r' ? '#ff8a80' : '#8ab4ff') : CAMIS_TXT[p.col % CAMIS_TXT.length];
  }
  function feedKill(m) {
    const me = C.me(), w = { zombi: { ico: '🧟' }, granada: { ico: '💣' }, molotov: { ico: '🔥' }, acido: { ico: '🧪' }, hack: { ico: '✋🔧' }, explosivo: { ico: '💥' }, derrumbe: { ico: '🪨' } }[m.w] || A[m.w] || A.fusil;
    const d = document.createElement('div'); d.className = 'fk' + (m.a === me || m.v === me ? ' mio' : '');
    d.innerHTML = m.a && m.a !== m.v ? `<b style="color:${colorDe(m.a)}">${esc(nombre(m.a, m.an))}</b> <span>${w.ico}${m.h ? '🎯' : ''}</span> <b style="color:${colorDe(m.v)}">${esc(nombre(m.v, m.vn))}</b>` : `💀 <b>${esc(nombre(m.v))}</b>`;
    const f = $('#feed'); f.prepend(d); while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
    if (m.v === me) morir(m);
    if (m.a === me && m.v !== me) {
      SFX.baja(); aviso(`${m.h ? '🎯 ¡A la cabeza! ' : ''}${m.w === 'hack' ? 'Desactivaste' : 'Bajaste a'} ${nombre(m.v, m.vn)}`, m.msg);
    }
    const r = remotos.get(m.v); if (r) { r.alive = false; r.caida = 0.001; }
  }
  function aviso(t, t2) {
    const a = $('#aviso'); a.innerHTML = esc(t) + (t2 ? `<div class="racha">${esc(t2)}</div>` : '');
    a.classList.remove('ver'); void a.offsetWidth; a.classList.add('ver');
  }
  function morir(m) {
    if (!yo.alive && !m) return;
    const estaba = yo.alive; yo.alive = false; yo.deadAt = performance.now(); inp.fire = false; yo.curando = null; yo.tajo = null;
    if (estaba) SFX.muero();
    if (m && m.a && m.a !== C.me()) yo.killer = m.a; else if (m) yo.killer = null;
    const w = m && A[m.w];
    $('#mTxt').innerHTML = m && m.w === 'explosivo' ? 'Te voló un zombi explosivo 💥' : m && m.w === 'derrumbe' ? 'Te agarró el derrumbe del búnker 🪨' : m && m.a && /^m\d+$/.test(m.a) ? `Te bajó un ${esc(nombre(m.a, m.an))}${m.h ? ' <b>¡a la cabeza!</b> 🎯' : ''}` : m && m.w === 'acido' ? 'Te derritió el ácido de un zombi 🧪' : m && m.w === 'zombi' ? 'Te agarró un zombi 🧟' : m && m.a && m.a !== m.v ? `Te bajó <b style="color:${colorDe(m.a)}">${esc(nombre(m.a))}</b> con ${w ? w.ico + ' ' + w.n : 'un tiro'}${m.h ? ' <b>¡a la cabeza!</b> 🎯' : ''}` : 'Caíste 💀';
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
      if (k === 'KeyB') lanzar('ruido');
      if (k === 'KeyH') J.curar();
      if (k === 'KeyE') usar(true);
      if (k === 'KeyV') lanzar('molotov');
      if (k === 'Digit1') ponerArma(yo.prim); if (k === 'Digit2') ponerArma('pistola'); if (k === 'KeyQ') cambiar();
    });
    addEventListener('keyup', e => { inp.keys.delete(e.code); if (e.code === 'KeyE') usar(false); if (e.code === 'Tab') { inp.tabla = false; tabla(); } });
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
    let palId = null, p0 = null, R = 55; const miradas = new Map();
    const editando = () => document.body.classList.contains('editando');
    // la palanca: fija en su lugar o aparece donde se apoya el dedo (se elige en "Acomodar controles")
    const moverPal = (t) => {
      let dx = t.clientX - p0.x, dy = t.clientY - p0.y; const L = Math.hypot(dx, dy);
      if (L > R) { dx = dx / L * R; dy = dy / L * R; }
      bolita.style.transform = `translate(${dx}px,${dy}px)`;
      inp.mx = dx / R; inp.mz = dy / R;
    };
    z.addEventListener('touchstart', e => {
      if (editando()) { e.preventDefault(); return; }
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
          else if (b === 'granada' || b === 'molotov' || b === 'ruido') lanzar(b);
          else if (b === 'usar') usar(true);
          else if (b === 'curar') J.curar();
          continue;
        }
        if (C.obs()) { mira++; continue; }
        const rr = pal.getBoundingClientRect(), pr = rr.width / 2, pcx = rr.left + pr, pcy = rr.top + pr;
        const fija = document.body.classList.contains('palfija');
        if (palId == null && (fija ? Math.hypot(t.clientX - pcx, t.clientY - pcy) < pr * 1.4 : t.clientX < innerWidth * 0.42)) {
          palId = t.identifier; R = pr; pal.classList.add('on'); bolita.style.transform = '';
          if (fija) { p0 = { x: pcx, y: pcy }; moverPal(t); }
          else { p0 = { x: t.clientX, y: t.clientY }; pal.style.left = (t.clientX - R) + 'px'; pal.style.top = (t.clientY - R) + 'px'; pal.style.right = pal.style.bottom = 'auto'; }
        } else miradas.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      e.preventDefault();
    }, { passive: false });
    z.addEventListener('touchmove', e => {
      if (editando()) { e.preventDefault(); return; }
      for (const t of e.changedTouches) {
        if (t.identifier === palId) moverPal(t);
        else if (miradas.has(t.identifier)) {
          const m = miradas.get(t.identifier), dx = t.clientX - m.x, dy = t.clientY - m.y; m.x = t.clientX; m.y = t.clientY;
          const zz = 1 + (A[yo.w].zoom - 1) * yo.aimK, k = 0.0055 * tsens / zz;
          yo.ry -= dx * k; yo.rx = Math.max(-1.5, Math.min(1.5, yo.rx - dy * k));
        }
      }
      e.preventDefault();
    }, { passive: false });
    const fin = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === palId) { palId = null; inp.mx = inp.mz = 0; pal.classList.remove('on'); bolita.style.transform = ''; if (window.ctAplicar) window.ctAplicar(); }
        if (miradas.has(t.identifier)) miradas.delete(t.identifier);
        const btn = t.target.closest && t.target.closest('[data-b]');
        if (btn) { btn.classList.remove('on'); if (btn.dataset.b === 'fire') { inp.fire = false; yo.latch = false; } if (btn.dataset.b === 'usar') usar(false); }
      }
      z.querySelectorAll('[data-b="aim"]').forEach(b => b.classList.toggle('on', inp.aim));
      z.querySelectorAll('[data-b="crouch"]').forEach(b => b.classList.toggle('on', inp.crouchT));
    };
    z.addEventListener('touchend', fin); z.addEventListener('touchcancel', fin);
  }

  // ================= armas =================
  function ponerArma(w) {
    if (!yo.alive || yo.w === w || (w !== yo.prim && w !== 'pistola' && !(w === 'cuchillo' && esCamp()))) return;
    yo.w = w; yo.reloadT = 0; yo.nextFire = Math.max(yo.nextFire, performance.now() + 280); yo.cambioT = 0.28;
    if (yo.ammo[w] == null) yo.ammo[w] = A[w].mag;
    armaHUD();
  }
  function cambiar() { if (esCamp()) ponerArma(yo.w === yo.prim ? 'pistola' : yo.w === 'pistola' ? 'cuchillo' : yo.prim); else ponerArma(yo.w === 'pistola' ? yo.prim : 'pistola'); }
  function recargar() {
    const w = A[yo.w]; if (!yo.alive || yo.reloadT > 0 || w.melee || yo.ammo[yo.w] >= w.mag) return;
    if (yo.res && (yo.res[yo.w] | 0) <= 0) { SFX.vacio(); if (!yo.avisoBal || performance.now() - yo.avisoBal > 3000) { yo.avisoBal = performance.now(); aviso('🎒 Sin cargadores de ' + w.n, 'Buscá cajas de balas en el suelo'); } return; }
    yo.reloadT = yo.reloadOf = w.rec / 1000;
    const r = RECARGA[yo.w]; if (r) r(w.mag - (yo.ammo[yo.w] | 0)); else SFX.recarga();
  }
  function disparar(now) {
    const w = A[yo.w];
    if (yo.reloadT > 0 || now < yo.nextFire) return;
    if (!w.auto && yo.latch) return;
    if (!w.melee && (yo.ammo[yo.w] | 0) <= 0) {
      SFX.vacio(); yo.latch = true;
      if (yo.res && (yo.res[yo.w] | 0) <= 0) { const otra = yo.w === yo.prim ? 'pistola' : yo.prim; if ((yo.ammo[otra] | 0) > 0 || (yo.res[otra] | 0) > 0) ponerArma(otra); else { ponerArma('cuchillo'); aviso('🔪 ¡Sin balas!', 'A cuchillo hasta encontrar munición'); } return; }
      recargar(); return;
    }
    yo.latch = true; yo.nextFire = now + w.cad; if (!w.melee) yo.ammo[yo.w]--;
    const s = yo.s, mov = Math.hypot(s.vx, s.vz) > 1, apunta = yo.aimK > 0.8;
    let sp = (apunta ? w.aim : w.hip) * (mov ? 1.5 : 1) * (s.ground ? 1 : 2.2) + yo.bloom;
    if (s.crouch && s.slideT <= 0) sp *= 0.75;
    const o = [s.x, s.y + yo.eye, s.z], d0 = W.dir(yo.ry, yo.rx);
    const S = C.S(), eq = S.settings.mode === 'equipos', miEq = (S.players.find(p => p.id === C.me()) || {}).team;
    const cuerpos = [];
    const zomb = S.settings.mode === 'zombis' || S.settings.mode === 'campana';
    const fa = !!S.settings.fa;   // fuego amigo: también se le puede pegar a los compañeros
    if (!zomb || fa) for (const [id, r] of remotos) if (r.alive && r.cur && (fa || !(eq && r.team === miEq))) cuerpos.push({ id, x: r.cur.x, y: r.cur.y, z: r.cur.z, crouch: r.crouch });
    for (const [id, z] of zombis) if (z.estado !== 2 && z.cur) cuerpos.push(z.tipo === 'teju' ? { id, x: z.cur.x, y: z.cur.y, z: z.cur.z, alto: 4.4, ancho: 1.25, cabR: 0.8 } : { id, x: z.cur.x, y: z.cur.y, z: z.cur.z, alto: ALTO_Z[z.tipo] || 1.75 });
    for (const [id, r] of mercs) if (r.alive && r.cur) cuerpos.push(r.tipo === 'torreta' ? { id, x: r.cur.x, y: r.cur.y, z: r.cur.z, alto: 1.15, ancho: 0.6, cabR: 0.32 } : { id, x: r.cur.x, y: r.cur.y, z: r.cur.z, crouch: r.crouch });
    const M = W.mapa(mapaId), hits = [], ends = [];
    for (let i = 0; i < w.pel; i++) {
      const d = W.desvio(d0, sp), tw = W.rayMundo(M, o, d, w.range), h = W.rayCuerpos(cuerpos, o, d, tw), t = h ? h.t : tw;
      const e = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
      ends.push(e.map(v => Math.round(v * 100) / 100));
      if (h) { hits.push([h.id, h.head ? 1 : 0]); polvo(e, h.id[0] === 'z' && zombis.get(h.id) && zombis.get(h.id).tipo === 'teju' && !(campC && campC[8] > 0) ? '#cfd6dc' : '#c0392b'); } else if (t < w.range) polvo(e, '#cfc6b0');
      // el rastro sale un poco abajo a la derecha (del caño)
      const right = [Math.cos(yo.ry), 0, -Math.sin(yo.ry)], k = apunta ? 0 : 0.18;
      if (!w.melee) trazo([o[0] + right[0] * k + d0[0] * 0.6, o[1] - (apunta ? 0.06 : 0.14) + d0[1] * 0.6, o[2] + right[2] * k + d0[2] * 0.6], e);
    }
    C.send({ t: 'fire', w: yo.w, o: o.map(v => Math.round(v * 100) / 100), e: ends, hits });
    tiroSnd(yo.w, 0.8);
    if (w.melee) { yo.tajo = { t: 0, lado: yo.tajo && yo.tajo.lado > 0 ? -1 : 1 }; } else yo.kick = Math.min(0.5, yo.kick + w.kick * (apunta ? 0.6 : 1));
    if (!w.melee) { yo.rx = Math.min(1.5, yo.rx + w.kick * (apunta ? 0.45 : 0.7)); yo.ry += (Math.random() - 0.5) * w.kick * 0.4; }
    if (w.auto) yo.bloom = Math.min(0.05, yo.bloom + 0.004);
    if (!w.melee) fogon.visible = true; fogon.t = 0.05; if (luz.destello && !w.melee) luz.destello.intensity = noche ? 3 : 1.2;
    if (yo.ammo[yo.w] > 0) { if (yo.w === 'escopeta') chikChak(0.32); else if (yo.w === 'franco') cerrojo(0.42); }
    if (yo.ammo[yo.w] <= 0 && !w.melee) setTimeout(recargar, 120);
    armaHUD();
  }

  // ================= bucle =================
  function loop(t) {
    if (!activo) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.max(0, Math.min(0.05, (t - last) / 1000)); last = Math.max(last, t);
    const now = performance.now(), obs = C.obs();
    if (cine) { cineTick(dt); return; }
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
      if (r.crouch && vel > 6.2 && enPiso) r.deslT = 0.15; else r.deslT = (r.deslT || 0) - dt;
      const desl = r.deslT > 0;
      if (desl && !r.desl) deslizDe(cur);
      r.desl = desl;
      r.deslK = (r.deslK || 0) + ((desl ? 1 : 0) - (r.deslK || 0)) * Math.min(1, dt * 12);
      if (desl) { r.polvoT = (r.polvoT || 0) - dt; if (r.polvoT <= 0) { r.polvoT = 0.035; polvoPies(cur.x, cur.y, cur.z); } }
      g.position.set(cur.x, cur.y, cur.z); g.rotation.order = 'YXZ'; g.rotation.set(r.deslK * 0.75, cur.ry, 0);
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
    campTick(dt, rt);
    for (const h of humeantes) if (Math.random() < dt * 4) humoNegro(h[0], h[1], h[2]);
    if (proys.size || areas.length || humos.length || (luz.boom && luz.boom.intensity > 0)) proysTick(dt);
    if (obs) camObs(dt);
    efectosTick(dt);
    if (fogon.visible) { fogon.t -= dt; if (fogon.t <= 0) fogon.visible = false; }
    if (luz.destello && luz.destello.intensity > 0) luz.destello.intensity = Math.max(0, luz.destello.intensity - dt * 50);
    // reloj del HUD
    const NVL = nivelDe(C.S());
    if (NVL) { const f = faseAct(); $('#tReloj').textContent = f && (f.tipo === 'aguantar' || f.tipo === 'escapar') ? '⏱️ ' + campC[4] + ' s' : '🎖️ Nivel ' + NVL.id; }
    else if (C.S() && C.S().settings.mode === 'zombis') $('#tReloj').textContent = yo.ola ? (yo.ola[2] ? '⏸️ Descanso' : '🧟 Oleada ' + yo.ola[0]) : '🧟 Preparense';
    else if (yo.tl != null) { const ms = Math.max(0, yo.tl - (now - yo.tlAt)), s = Math.ceil(ms / 1000); $('#tReloj').textContent = `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; }
    ren.clear(); ren.render(scene, cam);
    if (!obs && yo.alive && !(yo.w === 'franco' && yo.aimK > 0.85)) { ren.clearDepth(); ren.render(vmScene, vmCam); }
    $('#mirilla').classList.toggle('hidden', !(yo.alive && !obs && yo.w === 'franco' && yo.aimK > 0.85));
    // de noche, la mira del francotirador ve en la oscuridad y muestra el calor de los zombis
    const nv = noche && yo.alive && !obs && yo.w === 'franco' && yo.aimK > 0.85;
    if (nv !== visionNoche) visionNocturna(nv);
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
    if (s.slideT > 0 && !yo.desl) deslizSnd(0.35, 0);
    yo.desl = s.slideT > 0;
    // por las dudas: si la posición se rompe (NaN), vuelve a la última buena
    if (!Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz)) { const b = yo.bueno || yo.aparecio || { x: 0, y: 0, z: 0 }; Object.assign(s, { x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, ground: true }); }
    else yo.bueno = { x: s.x, y: s.y, z: s.z };
    // y si quedó metido adentro de algo, se sale solo
    W.liberar(W.mapa(mapaId), s);
    yo.eye += ((s.crouch ? 0.95 : 1.55) - yo.eye) * Math.min(1, dt * 14);
    yo.aimK += ((aim ? 1 : 0) - yo.aimK) * Math.min(1, dt * 14);
    yo.bloom = Math.max(0, yo.bloom - dt * 0.06);
    // armas
    if (yo.reloadT > 0) { yo.reloadT -= dt; if (yo.reloadT <= 0) { if (yo.res) { const n = Math.min(w.mag - (yo.ammo[yo.w] | 0), yo.res[yo.w] | 0); yo.ammo[yo.w] = (yo.ammo[yo.w] | 0) + n; yo.res[yo.w] = (yo.res[yo.w] | 0) - n; C.send({ t: 'recarga', w: yo.w, n }); } else yo.ammo[yo.w] = w.mag; armaHUD(); } }
    if (yo.cambioT > 0) yo.cambioT -= dt;
    if (yo.curando) curaTick(dt);
    else if (inp.fire) disparar(now);
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
    for (const k in VM) VM[k].visible = k === yo.w && !yo.curando;
    const bx = Math.sin(yo.bob) * 0.012 * (1 - yo.aimK), by = Math.abs(Math.cos(yo.bob)) * 0.012 * (1 - yo.aimK);
    const hip = [0.16, -0.16, -0.4], ads = [0, yo.w === 'pistola' ? -0.115 : -0.105, -0.34];
    const r = yo.reloadT > 0 ? Math.sin(Math.min(1, 1 - yo.reloadT / yo.reloadOf) * Math.PI) : 0, cb = Math.max(0, yo.cambioT || 0) / 0.28;
    vmGrupo.position.set(hip[0] + (ads[0] - hip[0]) * yo.aimK + bx, hip[1] + (ads[1] - hip[1]) * yo.aimK + by - r * 0.12 - cb * 0.25, hip[2] + (ads[2] - hip[2]) * yo.aimK + yo.kick * 0.25);
    vmGrupo.rotation.set(yo.kick * 0.9 + r * 0.6, 0, r * 0.4);
    // cuchillo: quieto se lleva abajo a la derecha; al atacar hace un tajo de lado a lado
    if (yo.w === 'cuchillo') {
      vmGrupo.position.set(0.2 + bx, -0.24 + by, -0.38); vmGrupo.rotation.set(0.75, 0.2, -0.3);
      if (yo.tajo) {
        yo.tajo.t += dt; const p = Math.min(1, yo.tajo.t / 0.3), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, L = yo.tajo.lado;
        const ida = Math.sin(p * Math.PI);
        vmGrupo.position.set(0.06 + L * (0.22 - e * 0.44), -0.2 - e * 0.08 + ida * 0.04, -0.44 - ida * 0.12);
        vmGrupo.rotation.set(0.8 - e * 0.6, L * (0.3 - e * 0.6), L * (-1.1 + e * 2));
        if (yo.tajo.t >= 0.42) yo.tajo = null;
      }
    }
    // curándose: el arma baja y aparece la venda, la pastilla o el inyectable
    if (yo.curando) curaVM(dt);
    else if (vmCura) vmCura.visible = false;
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
    $('#mCuenta').textContent = esCamp() ? (Math.max(0, 15 - (now - yo.deadAt) / 1000) > 0 ? `Volvés en ${Math.ceil(15 - (now - yo.deadAt) / 1000)} s al lado de un compañero 🎖️` : 'Volviendo…') : C.S() && C.S().settings.mode === 'zombis' ? 'Volvés cuando empiece la próxima oleada 🧟' : left > 0 ? `Volvés en ${Math.ceil(left)}…` : 'Volviendo…';
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
    $('#aBal').innerHTML = w.melee ? '<b>∞</b>' : `<b>${yo.ammo[yo.w] ?? w.mag}</b> / ${yo.res ? (yo.res[yo.w] | 0) + ' 🎒' : w.mag}`;
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
    if (st.mode === 'campana') { const me = S.players.find(p => p.id === C.me()), N = nivelDe(S); el.innerHTML = N ? `🎖️ Nivel <b>${N.id}</b>/10 · ${campC ? campC[1] + 1 : 1}/${N.fases.length}` + (me && !C.obs() ? ` · <b>vos ${me.k}</b>` : '') : '🎖️ Operación Yvy'; }
    else if (st.mode === 'zombis') { const me = S.players.find(p => p.id === C.me()), o = yo.ola; el.innerHTML = (o ? `🧟 quedan <b>${o[1]}</b>` : '🧟 ya vienen...') + (me && !C.obs() ? ` · <b>vos ${me.k}</b>` : ''); }
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
  // ================= CAMPAÑA "OPERACIÓN YVY" =================
  const CAMP = () => window.TiroCampana;
  const mercs = new Map(); let camion = null, campC = null, campK = null, abriendo = [], cine = null, ambT = 6, derrumbeT = 3, usarOn = false;
  let puertasB = {}, puertasP = {};
  const ICO_P = { generador: '⚡', tablero: '⚡', terminal: '💻', camion: '🧪', helicoptero: '📡', valvula: '❄️', bloqueo: '🚧' };
  const VERBO = { generador: 'arrancar el generador', tablero: 'cortar el tablero', terminal: 'hackear la terminal', camion: 'sacar las muestras', helicoptero: 'recuperar las coordenadas', valvula: 'abrir la válvula de agua helada', bloqueo: 'despejar el bloqueo', torreta: 'desactivar la torreta' };
  function nivelDe(S) {
    const c = CAMP(); if (!c || !S || S.settings.mode !== 'campana') return null;
    return c.NIVELES[S.camp ? S.camp.n : (S.settings.nivel || 0)] || null;
  }
  J.nivelDe = nivelDe;
  const esCamp = () => { const S = C.S(); return !!(S && S.settings.mode === 'campana'); };
  const faseAct = () => { const N = nivelDe(C.S()); return N && campC ? N.fases[campC[1]] : null; };
  function puntosDe(f) { return !f ? [] : f.paradas ? f.paradas.map(p => [p.punto[0], p.punto[1], 'bloqueo']) : (f.puntos || []); }

  // ---------- mercenarios ----------
  function mercsSnap(L) {
    const now = performance.now(), vistos = new Set(), TM = CAMP().TIPOS_M;
    for (const e of L) {
      const [id, ti, x, y, z, ry, estado, cr, rx, hp, hack] = e; vistos.add(id);
      let r = mercs.get(id);
      if (!r) r = mercNuevo(id, TM[ti] || 'merc');
      const vivo = estado !== 2;
      if (!vivo && r.alive) r.caida = 0.001;
      r.alive = vivo; r.estado = estado; r.crouch = !!cr; r.hp = hp; r.hack = hack;
      r.buf.push({ t: now, x, y, z, ry, rx }); if (r.buf.length > 30) r.buf.shift();
    }
    for (const [id, r] of mercs) if (!vistos.has(id)) { scene.remove(r.g); if (r.laser) scene.remove(r.laser); mercs.delete(id); }
  }
  function mercNuevo(id, tipo) {
    const T2 = CAMP().MT[tipo];
    let g;
    if (tipo === 'torreta') {
      g = new T.Group(); const gl = GLBP.torreta;
      if (gl) { const m = gl.scene.clone(true), c = gl.caja, sz = c.getSize(new T.Vector3()), k = 1.3 / Math.max(sz.x, sz.z); m.scale.setScalar(k); m.position.y = -c.min.y * k; g.add(m); }
      else { const b = new T.Mesh(new T.BoxGeometry(0.9, 0.6, 0.9), matCaja(8)); b.position.y = 0.3; g.add(b); }
      const cano = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.9), new T.MeshLambertMaterial({ color: '#222' })); cano.position.set(0, 0.62, -0.55); g.add(cano);
      const nom = cartel('🔧 Torreta', '#ff9a8a'); nom.position.y = 1.7; g.add(nom);
      g.userData = { modelo: false, torreta: true, nom };
      scene.add(g);
    } else {
      g = muneco({ id, name: T2.n, skin: 'enemigo', team: 'r', col: 3 }, 'campana');
      const u = g.userData; if (u.nom) { g.remove(u.nom); u.nom = cartel(T2.n, tipo === 'comandante' ? '#ffd24a' : '#ff8a80'); u.nom.position.y = 2.15; g.add(u.nom); }
      if (tipo === 'comandante') { g.scale.setScalar(1.15); (u.mats || []).forEach(m => m.color && m.color.multiplyScalar(0.55)); }
      if (tipo === 'escudo') {
        let e; const gl = GLBP.escudo;
        if (gl) { e = gl.scene.clone(true); const c = gl.caja, sz = c.getSize(new T.Vector3()); e.scale.set(0.9 / sz.x, 1.3 / sz.y, 0.18 / sz.z); e.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#3a3f47'); } }); }
        else e = new T.Mesh(new T.BoxGeometry(0.9, 1.3, 0.08), new T.MeshPhongMaterial({ color: '#3a3f47', shininess: 40 }));
        const h = new T.Group(); h.add(e); e.position.set(0, 0, 0); h.position.set(0.05, 0.75, -0.55); g.add(h); u.escudo = h;
      }
    }
    const r = { id, tipo, g, buf: [], alive: true, crouch: false, w: Math.max(0, W.ARMA_IDS.indexOf(T2.w)), tiroT: 0, cur: null, velS: 0, caida: 0, paso: 0, estado: 0 };
    if (tipo === 'franco') {
      const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 0, -1)]);
      r.laser = new T.Line(geo, new T.LineBasicMaterial({ color: '#ff2a1a', transparent: true, opacity: 0.85, fog: false }));
      r.laser.visible = false; scene.add(r.laser);
    }
    mercs.set(id, r); return r;
  }
  function mercsTick(dt, rt) {
    const M = W.mapa(mapaId);
    for (const r of mercs.values()) {
      if (!r.buf.length) continue;
      const cur = interp(r.buf, rt), last = r.buf[r.buf.length - 1]; cur.rx = last.rx || 0;
      const v = r.cur ? Math.hypot(cur.x - r.cur.x, cur.z - r.cur.z) / Math.max(dt, 0.001) : 0;
      r.velS = r.velS * 0.85 + Math.min(v, 10) * 0.15; r.cur = cur;
      const g = r.g, u = g.userData;
      if (!r.alive) { r.caida += dt; g.visible = r.caida < 3; if (r.laser) r.laser.visible = false; if (u.modelo) animar(r, 0, dt); else if (!u.torreta) g.rotation.x = -Math.min(1.5, r.caida * 4); continue; }
      g.visible = true;
      g.position.set(cur.x, cur.y, cur.z); g.rotation.y = cur.ry;
      if (u.torreta) { if (r.hack > 0) g.rotation.z = Math.sin(performance.now() / 40) * 0.04; continue; }
      if (u.haz) { u.haz.rotation.x = cur.rx; u.haz.position.y = r.crouch ? 0.95 : 1.35; u.haz.visible = noche; }
      if (u.modelo) animar(r, r.velS, dt); else if (u.brazos) u.brazos.rotation.x = cur.rx;
      if (r.fuego > 0) r.fuego -= dt;
      r.paso += Math.min(r.velS, 8) * dt * 1.6;
      const st = Math.floor(r.paso * 3 / Math.PI); if (st !== r.st) { r.st = st; if (r.velS > 2.2 && !r.crouch) pasoDe(cur, r.velS); }
      // el láser rojo del francotirador cuando apunta (aviso para cubrirse)
      if (r.laser) {
        r.laser.visible = r.estado === 1;
        if (r.laser.visible) {
          const o = [cur.x, cur.y + 1.5, cur.z], d = W.dir(cur.ry, cur.rx), L = W.rayMundo(M, o, d, 140);
          r.laser.position.set(o[0], o[1], o[2]); r.laser.lookAt(o[0] - d[0], o[1] - d[1], o[2] - d[2]); r.laser.scale.set(1, 1, L);
        }
      }
    }
  }
  // ---------- el camión blindado ----------
  function camionTick(dt) {
    if (!campK) { if (camion) { scene.remove(camion.g); camion = null; } return; }
    if (!camion) {
      const g = new T.Group(), gl = GLBP.blindado;
      if (gl) { const m = gl.scene.clone(true), c = gl.caja, sz = c.getSize(new T.Vector3()), ce = c.getCenter(new T.Vector3()); const k = 6 / sz.z; m.scale.setScalar(k); m.position.set(-ce.x * k, -c.min.y * k, -ce.z * k); g.add(m); }
      else { const b = new T.Mesh(cajaGeo(2.8, 2.6, 6), matCaja(13)); b.position.y = 1.3; g.add(b); }
      g.position.set(campK[0], 0, campK[1]); scene.add(g); camion = { g, humoT: 0 };
    }
    const g = camion.g, k = Math.min(1, dt * 6);
    g.position.x += (campK[0] - g.position.x) * k; g.position.z += (campK[1] - g.position.z) * k;
    let dr = campK[2] - g.rotation.y; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI; g.rotation.y += dr * k;
    if (campK[3] < 45 && (camion.humoT -= dt) <= 0) { camion.humoT = 0.2; humoNegro(g.position.x, 2.6, g.position.z); }
  }
  function humoNegro(x, y, z) {
    const h = new T.Sprite(new T.SpriteMaterial({ map: brillo('#555555'), transparent: true, depthWrite: false, opacity: 0.6 }));
    h.material.color.set('#222'); h.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6); scene.add(h);
    humos.push({ o: h, t: 0, max: 2.5, s0: 1, s1: 3, op: 0.55, sube: 1.4 });
  }
  // ---------- puertas que se abren (vagón, bloqueos, compuerta) ----------
  function abrirVisual(id, ya) {
    const L = (puertasB[id] || []).concat(puertasP[id] || []); delete puertasB[id]; delete puertasP[id];
    for (const o of L) {
      const a = o.userData.abre || [0, -3.5, 0];
      if (ya) { o.position.x += a[0]; o.position.y += a[1]; o.position.z += a[2]; if (a[1] < -1) o.visible = false; }
      else abriendo.push({ o, a, t: 0, desde: o.position.clone() });
    }
    if (!ya && L.length) { raspa(0, 2.2, 150, 500, 0.35); metal(0.1, 1.8, 90, 60, 0.25, 3); }
  }
  function abriendoTick(dt) {
    for (let i = abriendo.length - 1; i >= 0; i--) {
      const b = abriendo[i]; b.t = Math.min(1, b.t + dt / 3.5); const e = b.t * b.t * (3 - 2 * b.t);
      b.o.position.set(b.desde.x + b.a[0] * e, b.desde.y + b.a[1] * e, b.desde.z + b.a[2] * e);
      if (b.t >= 1) { if (b.a[1] < -1) b.o.visible = false; abriendo.splice(i, 1); }
    }
  }
  // ---------- cartel del objetivo, marcas en el mundo y el ✋ ----------
  function campHUD() {
    const S = C.S(), N = nivelDe(S), el = $('#obj');
    if (!N || !campC || cine) { el.classList.add('hidden'); $('#jefeBar').classList.add('hidden'); return; }
    const f = N.fases[campC[1]]; if (!f) return;
    el.classList.remove('hidden');
    let extra = '';
    if (f.tipo === 'aguantar' || f.tipo === 'escapar') extra += ` ⏱️ ${campC[4]} s`;
    if (f.tipo === 'activar') extra += ` · ${campC[3].filter(v => v === -1).length}/${campC[3].length}`;
    if (f.tipo === 'matar') extra += ` · ${Math.round(campC[2] * 100)}%`;
    if (campC[6] >= 0) extra += ` · ⛪ ${campC[6]}%`;
    if (campK && (f.tipo === 'escoltar' || f.defiende)) extra += ` · 🚚 ${campK[3]}%` + (campK[4] && f.tipo === 'escoltar' ? ' ⏸️' : '');
    const html = `<small>Nivel ${N.id}/10 · ${esc(N.n)} · ${esc(N.lugar)}</small>🎯 ${esc(f.txt)}<b>${extra}</b>`;
    if (el._h !== html) { el._h = html; $('#objT').innerHTML = html; }
    $('#objB').style.width = Math.round(Math.min(1, Math.max(0, campC[2])) * 100) + '%';
    const j = $('#jefeBar'); j.classList.toggle('hidden', campC[7] < 0);
    if (campC[7] >= 0) { j.querySelector('i').style.width = campC[7] + '%'; j.querySelector('span').textContent = campC[8] > 0 ? `❄️⚡ ¡AL DESCUBIERTO! Tírenle a la cabeza · ${campC[8]} s` : '🛡️ Blindado: activen DOS consolas a la vez (✋)'; j.classList.toggle('exp', campC[8] > 0); }
  }
  function marcasTick() {
    const f = faseAct(), cont = $('#marcas'), L = [];
    if (f && campC[5] === 0 && !cine) {
      if (f.zona) L.push([f.zona[0], 1.6, f.zona[1], f.tipo === 'escapar' ? '🛗' : f.tipo === 'aguantar' ? '🛡️' : '🏁', '']);
      puntosDe(f).forEach(([x, z, t], i) => { const v = campC[3][i]; if (v === -1 || v === -2 || v == null) return; L.push([x, 1.4, z, ICO_P[t] || '✋', v > 0 ? Math.round(v * 100) + '%' : '']); });
      if (f.puerta) L.push([f.puerta[0], 3, f.puerta[1], '⛪', campC[6] + '%']);
      if (campK && (f.tipo === 'escoltar' || f.defiende)) L.push([campK[0], 3.4, campK[1], '🚚', campK[3] + '%']);
      if (f.tipo === 'matar') for (const r of mercs.values()) if (r.alive && r.tipo === 'torreta' && r.cur) L.push([r.cur.x, r.cur.y + 1.5, r.cur.z, '🔧', '']);
    }
    while (cont.children.length < L.length) { const d = document.createElement('div'); d.className = 'marca'; cont.appendChild(d); }
    const W2 = innerWidth, H2 = innerHeight, v = new T.Vector3();
    [...cont.children].forEach((d, i) => {
      const m = L[i]; if (!m) { d.style.display = 'none'; return; }
      v.set(m[0], m[1], m[2]).project(cam);
      let x = (v.x * 0.5 + 0.5) * W2, y = (-v.y * 0.5 + 0.5) * H2;
      if (v.z > 1) { x = W2 - x; y = H2 - 60; }
      x = Math.max(26, Math.min(W2 - 26, x)); y = Math.max(70, Math.min(H2 - 50, y));
      const dist = Math.round(Math.hypot(m[0] - cam.position.x, m[2] - cam.position.z));
      d.style.display = ''; d.style.transform = `translate(${x}px,${y}px)`;
      const html = `${m[3]}<small>${m[4] ? m[4] + ' · ' : ''}${dist} m</small>`; if (d._h !== html) { d._h = html; d.innerHTML = html; }
    });
  }
  function usarTick() {
    if (yo.curando) return;   // mientras se cura, el cartel muestra la curación
    const f = faseAct(); let txt = '', prog = 0;
    if (f && campC[5] === 0 && yo.alive && yo.s && !C.obs()) {
      const s = yo.s;
      puntosDe(f).forEach(([x, z, t], i) => { const v = campC[3][i]; if (v === -1 || v === -2) return; if (Math.hypot(x - s.x, z - s.z) < 2.6) { txt = VERBO[t]; prog = Math.max(0, v); } });
      if (f.tipo === 'matar') for (const r of mercs.values()) if (r.alive && r.tipo === 'torreta' && r.cur && Math.hypot(r.cur.x - s.x, r.cur.z - s.z) < 2.4) { txt = VERBO.torreta; prog = r.hack || 0; }
    }
    const el = $('#usar');
    el.classList.toggle('hidden', !txt);
    if (txt) { const t2 = (tactil() ? 'Mantené ✋ para ' : 'Mantené E para ') + txt; if (el._t !== t2) { el._t = t2; el.querySelector('span').textContent = t2; } el.querySelector('i').style.width = Math.round(Math.min(1, prog) * 100) + '%'; }
    document.querySelectorAll('[data-b="usar"]').forEach(b => b.classList.toggle('lista', !!txt));
  }
  function usar(on) { if (on === usarOn) return; usarOn = on; C.send({ t: 'usar', on }); }
  J.usar = usar;
  J.curar = () => {
    const S = C.S(), me = S && S.players.find(p => p.id === C.me()); if (!me || !me.lim || !yo.alive || yo.curando) return;
    if ((me.bq | 0) <= 0) { aviso('💊 No tenés botiquines', 'Buscalos en el suelo'); return; }
    if (yo.hp >= 100) { aviso('💊 Tenés la vida llena', ''); return; }
    const tipo = ['venda', 'pastilla', 'inyectable'][(Math.random() * 3) | 0];
    yo.curando = { t: 0, tipo }; yo.reloadT = 0; inp.fire = false;
    ['cura_venda', 'cura_pastilla', 'cura_inyectable'].forEach(cargarProp);
    if (tipo === 'venda') raspa(0, 1.6, 2500, 900, 0.22); else if (tipo === 'pastilla') { for (let i = 0; i < 5; i++) metal(0.1 + i * 0.09, 0.05, 2600, 2000, 0.08, 6); } else { metal(0.2, 0.06, 3000, 2600, 0.12, 5); raspa(0.9, 0.7, 6000, 3000, 0.08); }
  };
  // ---------- curarse (2 segundos) ----------
  let vmCura = null;
  const CURA_TXT = { venda: '🩹 Vendándote...', pastilla: '💊 Tomando la pastilla...', inyectable: '💉 Poniéndote el inyectable...' };
  function curaTick(dt) {
    const c = yo.curando; c.t += dt;
    const el = $('#usar'); el.classList.remove('hidden'); el.querySelector('span').textContent = CURA_TXT[c.tipo]; el.querySelector('i').style.width = Math.min(100, c.t / 2 * 100) + '%';
    if (c.t >= 2) { yo.curando = null; C.send({ t: 'curar' }); el.classList.add('hidden'); }
  }
  function curaVM(dt) {
    const c = yo.curando, gl = GLBP['cura_' + c.tipo];
    if (!vmCura) { vmCura = new T.Group(); vmScene.add(vmCura); }
    if (vmCura.userData.tipo !== c.tipo) {
      vmCura.children.slice().forEach(ch => vmCura.remove(ch));
      if (gl) {
        const m = gl.scene.clone(true), cj = gl.caja, sz = cj.getSize(new T.Vector3()), ce = cj.getCenter(new T.Vector3());
        const largo = { venda: 0.3, pastilla: 0.12, inyectable: 0.2 }[c.tipo], k = largo / Math.max(sz.x, sz.y, sz.z);
        m.scale.setScalar(k); m.position.set(-ce.x * k, -ce.y * k, -ce.z * k);
        const h = new T.Group(); h.add(m); if (c.tipo === 'venda') h.rotation.x = Math.PI / 2; vmCura.add(h);
      } else { const b = new T.Mesh(new T.BoxGeometry(0.06, 0.1, 0.06), new T.MeshLambertMaterial({ color: '#eee' })); vmCura.add(b); }
      const mano = new T.Mesh(new T.BoxGeometry(0.08, 0.08, 0.2), new T.MeshLambertMaterial({ color: '#c99a73' })); mano.position.set(0.03, -0.06, 0.12); vmCura.add(mano);
      vmCura.userData.tipo = c.tipo;
    }
    vmCura.visible = true;
    const p = Math.min(1, c.t / 2), sube = Math.min(1, c.t / 0.35), baja = c.t > 1.7 ? (c.t - 1.7) / 0.3 : 0, en = sube * (1 - baja);
    if (c.tipo === 'pastilla') {
      // se lleva el frasco a la boca y se inclina
      vmCura.position.set(0.12 - en * 0.1, -0.32 + en * 0.2, -0.32);
      vmCura.rotation.set(en * 0.4 + Math.max(0, Math.sin((p - 0.3) * Math.PI * 1.6)) * 0.9, 0, en * 0.5);
    } else if (c.tipo === 'inyectable') {
      // abajo a la izquierda, se clava en el brazo y se aprieta
      const pica = c.t > 0.5 && c.t < 1.5 ? Math.min(1, (c.t - 0.5) / 0.2) : c.t >= 1.5 ? 1 - Math.min(1, (c.t - 1.5) / 0.2) : 0;
      vmCura.position.set(-0.08 - pica * 0.05, -0.3 + en * 0.1, -0.34 + pica * 0.06);
      vmCura.rotation.set(0.3, 0.8, 1.2 + pica * 0.3);
    } else {
      // la venda da vueltas alrededor del brazo
      const a = c.t * 7;
      vmCura.position.set(0.02 + Math.cos(a) * 0.05 * en, -0.3 + en * 0.08 + Math.sin(a) * 0.04 * en, -0.34);
      vmCura.rotation.set(0.6, a * 0.3, Math.sin(a) * 0.4);
    }
    vmGrupo.position.y -= 0.4 * en;
  }
  // ---------- cosas tiradas en el suelo (dificultad normal y difícil) ----------
  const items = new Map(); let itemGeo = null;
  const ALTO_I = { balas: 0.5, botiquin: 0.42, granada: 0.3, molotov: 0.45 };
  const ITEMS_GLB = ['item_balas', 'item_botiquin', 'item_granada', 'item_molotov'];
  // cuando terminan de bajar los modelos, se cambian las cosas del suelo
  function cargarItems() { Promise.all(ITEMS_GLB.map(cargarProp)).then(() => { for (const it of items.values()) { const p = it.g.position.clone(); scene.remove(it.g); it.g = itemNuevo(it.tipo); it.g.position.copy(p); } }); }
  J.cargarItems = cargarItems;
  function cuchilloVM() {
    cargarProp('arma_cuchillo').then(gl => {
      if (!gl || !VM.cuchillo) return;
      const g = VM.cuchillo; g.children.filter(ch => !ch.userData.mano).forEach(ch => g.remove(ch));
      const m = gl.scene.clone(true), cj = gl.caja, sz = cj.getSize(new T.Vector3()), ce = cj.getCenter(new T.Vector3()), k = 0.3 / sz.y;
      m.scale.setScalar(k); m.position.set(-ce.x * k, -cj.min.y * k, -ce.z * k);
      const h = new T.Group(); h.add(m); h.rotation.x = -Math.PI / 2 + 0.25; h.position.set(0.01, -0.03, 0.05); g.add(h);
    });
  }
  function itemNuevo(tipo) {
    if (!itemGeo) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d62828'; g.fillRect(24, 10, 16, 44); g.fillRect(10, 24, 44, 16);
      itemGeo = { cruz: new T.MeshPhongMaterial({ map: new T.CanvasTexture(c) }), caja: new T.MeshPhongMaterial({ color: '#4a5a2a' }), fr: new T.MeshPhongMaterial({ color: '#e0b020' }) };
    }
    const g = new T.Group(), gl = GLBP['item_' + tipo];
    if (gl) {
      // modelos bajados: caja de balas (Zsky), botiquín (Quaternius), granada y molotov (CreativeTrio)
      const m = gl.scene.clone(true), c = gl.caja, sz = c.getSize(new T.Vector3()), ce = c.getCenter(new T.Vector3()), k = ALTO_I[tipo] / sz.y;
      m.scale.setScalar(k); m.position.set(-ce.x * k, -c.min.y * k, -ce.z * k); g.add(m);
    }
    else if (tipo === 'balas') { const b = new T.Mesh(new T.BoxGeometry(0.55, 0.3, 0.32), itemGeo.caja); b.position.y = 0.15; g.add(b); const f = new T.Mesh(new T.BoxGeometry(0.56, 0.06, 0.33), itemGeo.fr); f.position.y = 0.2; g.add(f); }
    else if (tipo === 'botiquin') { const b = new T.Mesh(new T.BoxGeometry(0.5, 0.32, 0.36), itemGeo.cruz); b.position.y = 0.16; g.add(b); }
    else { const p = proyNuevo(tipo); scene.remove(p); p.scale.setScalar(1.6); p.position.y = 0.2; g.add(p); }
    const brillo2 = new T.Sprite(new T.SpriteMaterial({ map: brillo(tipo === 'botiquin' ? '#ff6a6a' : tipo === 'balas' ? '#ffe070' : '#ffb040'), blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    brillo2.scale.set(1.3, 1.3, 1); brillo2.position.y = 0.25; g.add(brillo2);
    scene.add(g); return g;
  }
  function itemsSnap(L) {
    const vistos = new Set(), TI = CAMP().TIPOS_I;
    for (const [id, ti, x, y, z] of L) { vistos.add(id); if (!items.has(id)) { const g = itemNuevo(TI[ti]); g.position.set(x, y, z); items.set(id, { g, y, tipo: TI[ti] }); } }
    for (const [id, it] of items) if (!vistos.has(id)) { scene.remove(it.g); items.delete(id); }
  }
  function itemsTick() { const t = performance.now() / 1000; for (const it of items.values()) { it.g.rotation.y = t * 1.5; it.g.position.y = it.y + 0.08 + Math.sin(t * 2.5) * 0.06; } }
  // ---------- sonidos de la campaña ----------
  function rugido(vol) {
    if (!soundOn || !actx) return;
    try {
      const t = actx.currentTime, o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 1.6);
      const lfo = actx.createOscillator(), lg = actx.createGain(); lfo.frequency.value = 18; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * vol, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(f); f.connect(g); g.connect(actx.destination); o.start(t); lfo.start(t); o.stop(t + 1.8); lfo.stop(t + 1.8);
      raspa(0, 1.2, 300, 120, 0.25 * vol);
    } catch (e) { }
  }
  function silbido() {   // el silbido del Pombero, de lejos y de algún costado
    if (!soundOn || !actx) return;
    try {
      const t = actx.currentTime, pan = actx.createStereoPanner ? actx.createStereoPanner() : null;
      for (let i = 0; i < 2; i++) {
        const o = actx.createOscillator(), g = actx.createGain(), t0 = t + i * 0.42;
        o.type = 'sine'; o.frequency.setValueAtTime(1900 + i * 300, t0); o.frequency.linearRampToValueAtTime(2500 + i * 200, t0 + 0.25);
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        o.connect(g); if (pan) { g.connect(pan); } else g.connect(actx.destination); o.start(t0); o.stop(t0 + 0.35);
      }
      if (pan) { pan.pan.value = Math.random() < 0.5 ? -0.85 : 0.85; pan.connect(actx.destination); }
    } catch (e) { }
  }
  function grillo() {
    if (!soundOn || !actx) return;
    try {
      const t = actx.currentTime;
      for (let i = 0; i < 4; i++) { const o = actx.createOscillator(), g = actx.createGain(), t0 = t + i * 0.09; o.frequency.value = 4200 + Math.random() * 300; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.012, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06); o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + 0.07); }
    } catch (e) { }
  }
  function ambienteTick(dt) {
    const N = nivelDe(C.S()); if (!N || cine) return;
    ambT -= dt;
    if (ambT <= 0) {
      ambT = 4 + Math.random() * 8;
      if (N.selva) (Math.random() < 0.45 ? silbido : grillo)();
      else if (N.noche && N.id !== 10 && N.id !== 6) grillo();
    }
    // autodestrucción del búnker: temblores y piedras que caen
    const f = faseAct();
    if (f && f.tipo === 'escapar' && campC[5] === 0) {
      derrumbeT -= dt;
      if (derrumbeT <= 0) {
        derrumbeT = 2 + Math.random() * 3; yo.temblor = Math.max(yo.temblor || 0, 0.18); boomSnd(0.25);
        if (yo.s) for (let i = 0; i < 6; i++) { const h = new T.Mesh(polvoGeo, new T.MeshBasicMaterial({ color: '#6a6258', transparent: true })); h.position.set(yo.s.x + (Math.random() - 0.5) * 12, 7 + Math.random() * 3, yo.s.z + (Math.random() - 0.5) * 12); scene.add(h); humos.push({ o: h, t: 0, max: 1.4, s0: 2, s1: 3, op: 0.9, sube: -6 }); }
      }
    }
  }
  // ---------- pantallas de la historia ----------
  function briefing(n) {
    const N = CAMP().NIVELES[n]; if (!N) return;
    $('#briefBox').innerHTML = `<div class="nv">NIVEL ${N.id} DE 10</div><h2>${esc(N.n)}</h2><div class="lugar">📍 ${esc(N.lugar)}</div><p>${esc(N.historia)}</p><div class="enem">${esc(N.enemigos)}</div><ol>${N.fases.map(f => `<li>${esc(f.txt)}</li>`).join('')}</ol><button class="btn-ok jugar" id="briefOk">¡Vamos! 💪</button>`;
    $('#brief').classList.remove('hidden');
    $('#briefOk').onclick = e => { e.stopPropagation(); $('#brief').classList.add('hidden'); bloquear(); };
    clearTimeout(briefing._t); briefing._t = setTimeout(() => $('#brief').classList.add('hidden'), 16000);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function finNivel(n) {
    const c = CAMP(), N = c.NIVELES[n], sig = c.NIVELES[n + 1];
    const el = $('#cfin');
    el.innerHTML = `<div class="card"><h2>✅ ¡Nivel ${N.id} completado!</h2><p>${esc(N.fin)}</p>${sig ? `<p class="sig">Siguiente: <b>Nivel ${sig.id} · ${esc(sig.n)}</b> — ${esc(sig.lugar)}</p>` : ''}</div>`;
    el.classList.remove('hidden'); clearTimeout(finNivel._t); finNivel._t = setTimeout(() => el.classList.add('hidden'), 9500);
    SFX.fin();
  }
  // ---------- final: amanecer en el Chaco con tereré ----------
  J.final = () => {
    const S = C.S(); if (!S || !scene) return;
    const sc = new T.Scene(); cine = { t: 0, sc, rs: [] };
    sc.background = new T.Color('#f0a25c'); sc.fog = new T.Fog('#f0a25c', 18, 80);
    sc.add(new T.HemisphereLight(0xffe0bc, 0x7a4a2a, 1.05)); const sol = new T.DirectionalLight(0xffc27a, 0.95); sol.position.set(-20, 8, -40); sc.add(sol);
    const ft = tex('tierra').clone(); ft.needsUpdate = true; ft.repeat.set(40, 40);
    const piso = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshLambertMaterial({ color: '#b8784a', map: ft })); piso.rotation.x = -Math.PI / 2; sc.add(piso);
    const ruta = new T.Mesh(new T.PlaneGeometry(6, 200), new T.MeshLambertMaterial({ color: '#4a4a4a' })); ruta.rotation.x = -Math.PI / 2; ruta.position.set(-7, 0.02, 0); sc.add(ruta);
    const s2 = new T.Sprite(new T.SpriteMaterial({ map: brillo('#ffd890'), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s2.scale.set(26, 26, 1); s2.position.set(-30, 3, -70); sc.add(s2);
    if (GLBP.palmera) for (let i = 0; i < 14; i++) { const p = GLBP.palmera.scene.clone(true), a = i / 14 * 6.28, r = 14 + (i % 3) * 7; p.scale.setScalar(2 + (i % 2)); p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 6); sc.add(p); }
    // la escotilla del búnker por donde salieron
    const esco = new T.Mesh(new T.BoxGeometry(2.6, 0.5, 2.6), matCaja(8)); esco.position.set(3.5, 0.25, -3); sc.add(esco);
    // los 4 del escuadrón
    const gente = S.players.filter(p => !p.bot).concat(S.players.filter(p => p.bot)).slice(0, 4);
    gente.forEach((p, i) => {
      const g = muneco(p, 'campana'); sc.add(g);
      const a = (i - (gente.length - 1) / 2) * 0.55; g.position.set(Math.sin(a) * 3, 0, Math.cos(a) * 3 - 3); g.rotation.y = a + Math.PI;
      if (g.userData.haz) g.userData.haz.visible = false; if (g.userData.nom) g.userData.nom.visible = false;
      cine.rs.push({ g, w: 0, alive: true, crouch: false, tiroT: 0, velS: 0 });
    });
    // el tereré: termo abollado y guampa con bombilla
    const termo = new T.Mesh(new T.CylinderGeometry(0.09, 0.1, 0.42, 10), new T.MeshPhongMaterial({ color: '#c9cdd2', shininess: 60 })); termo.rotation.z = 0.12;
    const guampa = new T.Mesh(new T.CylinderGeometry(0.07, 0.055, 0.14, 10), new T.MeshPhongMaterial({ color: '#7a4a24' }));
    const bombilla = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.2, 5), new T.MeshPhongMaterial({ color: '#d8d8d8', shininess: 80 })); bombilla.position.set(0.02, 0.12, 0); bombilla.rotation.z = -0.25; guampa.add(bombilla);
    const r0 = cine.rs[0];
    if (r0) { termo.position.set(r0.g.position.x + 0.45, 0.21, r0.g.position.z + 0.3); guampa.position.set(r0.g.position.x + 0.25, 1.15, r0.g.position.z + 0.35); }
    sc.add(termo, guampa); cine.guampa = guampa;
    document.body.classList.add('cine');
    const textos = ['🧉 Operación Yvy — Cumplida', 'Amanece en el Chaco. Los cuatro salen a la superficie, agotados y llenos de polvo.', 'El acuífero está a salvo: el agua de todos queda limpia.', 'Uno saca una guampa y un termo abollado...', '...y ceban el primer tereré de la victoria. 🧉', 'Gracias por jugar · Tiro Guasu · juegospy.com'];
    const el = $('#cine'); el.innerHTML = textos.map((t, i) => `<p style="animation-delay:${1 + i * 4}s"${i === 0 ? ' class="tit"' : ''}>${esc(t)}</p>`).join('');
    el.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    SFX.fin();
  };
  function cineTick(dt) {
    if (cine.escape) return escapeTick(dt);
    cine.t += dt;
    const a = -0.9 + cine.t * 0.045, R = 6.5 - Math.min(2, cine.t * 0.06);
    cam.position.set(Math.sin(a) * R, 1.7 + Math.sin(cine.t * 0.2) * 0.15, Math.cos(a) * R - 3); cam.lookAt(0, 1.1, -3);
    cam.fov = fovBase; cam.updateProjectionMatrix();
    for (const r of cine.rs) if (r.g.userData.modelo) animar(r, 0, dt);
    if (cine.guampa) cine.guampa.position.y = 1.15 + Math.sin(cine.t * 1.3) * 0.05;
    ren.clear(); ren.render(cine.sc, cam);
  }
  // ---------- al terminar cada nivel: el escuadrón se escapa del lugar ----------
  // vehículo de cada nivel: [modelo, cómo se va, medidas]
  const ESCAPE = {
    1: ['helicoptero', 'sube', { w: 9, h: 3.2, d: 10 }, 'El helicóptero de rescate los saca del Mercado 4...'],
    2: ['jeep', 'auto', { h: 2.3 }, 'Se escapan por la Costanera en un jeep abandonado...'],
    3: ['locomotora', 'auto', { w: 10.4, h: 2.7, d: 2.4 }, 'Suben al tren de carga y dejan Areguá entre la neblina...'],
    4: ['colectivo', 'auto', { w: 2.9, h: 3.1, d: 9.5 }, 'Evacúan a la gente de la Basílica en un colectivo...'],
    5: ['camion_militar', 'auto', { h: 2.8 }, 'Se llevan las muestras en el camión de la corporación...'],
    6: ['jeep', 'auto', { h: 2.3 }, 'Salen de la represa a oscuras, en un jeep de mantenimiento...'],
    7: ['humvee', 'auto', { h: 2 }, 'Encuentran un vehículo enemigo y dejan atrás la selva...'],
    8: ['humvee', 'auto', { h: 2 }, 'Con los datos, se van de las ruinas rumbo al Chaco...'],
    9: ['blindado', 'auto', { h: 2.9 }, 'El camión blindado llega a la entrada del búnker...'],
  };
  J.finNivel = n => {
    const c = CAMP(), N = c.NIVELES[n], S = C.S(), V = ESCAPE[N && N.id];
    if (!N || !V || !scene || !mapaId) return finNivel(n);
    if (cine) campLimpiar();
    const f = N.fases[N.fases.length - 1], ex = (f.zona ? [f.zona[0], f.zona[1]] : f.cp).slice();
    if (N.id === 9 && campK) { ex[0] = campK[0]; ex[1] = campK[1]; }
    let dx = ex[0], dz = ex[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (N.id === 3) { dx = 1; dz = 0; } if (N.id === 9) { dx = 0; dz = -1; }
    const grupo = new T.Group(); scene.add(grupo);
    // el vehículo, mirando hacia donde se va
    const veh = new T.Group(), gl = GLBP[V[0]];
    if (gl) {
      const m = gl.scene.clone(true), cj = gl.caja, sz = cj.getSize(new T.Vector3()), ce = cj.getCenter(new T.Vector3());
      const sp = V[2], P = W.PROPS[V[0]], k = sp.h / sz.y;
      const sx = sp.w ? sp.w / sz.x : k, sz2 = sp.d ? sp.d / sz.z : k;
      const hold = new T.Group(); hold.add(m); hold.scale.set(sx, k, sz2); hold.position.set(-ce.x * sx, -cj.min.y * k, -ce.z * sz2);
      const largoX = sz.x * sx > sz.z * sz2;
      const piv = new T.Group(); piv.add(hold); piv.rotation.y = largoX ? Math.atan2(-dz, dx) : Math.atan2(dx, dz); veh.add(piv);
    } else { const b = new T.Mesh(cajaGeo(2.6, 2.4, 5), matCaja(13)); b.position.y = 1.2; b.rotation.y = Math.atan2(dx, dz); veh.add(b); }
    veh.position.set(ex[0], 0, ex[1]); grupo.add(veh);
    if (N.id === 1) veh.position.y = 0.2;
    // el escuadrón camina hasta el vehículo y sube
    const gente = S.players.filter(p => !p.bot).concat(S.players.filter(p => p.bot)).slice(0, 4), rs = [];
    gente.forEach((p, i) => {
      const g = muneco(p, 'campana'); scene.remove(g); grupo.add(g);
      const lado = (i - 1.5) * 1.3, px = ex[0] - dx * 9 - dz * lado, pz = ex[1] - dz * 9 + dx * lado;
      g.position.set(px, W.piso(W.mapa(mapaId), px, pz, 1), pz); g.rotation.y = Math.atan2(-dx, -dz) + Math.PI;
      if (g.userData.nom) g.userData.nom.visible = false; if (g.userData.haz) g.userData.haz.visible = noche;
      rs.push({ g, w: 0, alive: true, crouch: false, tiroT: 0, velS: 3, desde: g.position.clone() });
    });
    for (const r of remotos.values()) r.g.visible = false;
    // cámara: de costado, un poco arriba
    const cx = ex[0] - dx * 12 + dz * 10, cz = ex[1] - dz * 12 - dx * 10;
    cine = { escape: true, t: 0, t0: performance.now(), grupo, veh, rs, dir: [dx, dz], tipo: V[1], cam: [cx, 5, cz], N };
    document.body.classList.add('cine');
    const el = $('#cine'); el.innerHTML = '<p class="tit" style="animation-delay:.6s">✅ ¡Nivel ' + N.id + ' completado!</p><p style="animation-delay:2.2s">' + esc(V[3]) + '</p><p style="animation-delay:4.4s">' + esc(N.fin) + '</p>';
    el.classList.remove('hidden'); el.style.background = '';
    if (document.pointerLockElement) document.exitPointerLock();
    SFX.fin();
  };
  function escapeTick(dt0) {
    // con el reloj de verdad (en un celular lento la escena no se atrasa)
    const c = cine, nt = (performance.now() - c.t0) / 1000, dt = Math.min(0.2, Math.max(0, nt - c.t)); c.t = nt;
    const [dx, dz] = c.dir, veh = c.veh;
    // 0 a 3 s: caminan hasta el vehículo; después suben (desaparecen)
    c.rs.forEach((r, i) => {
      const k = Math.min(1, c.t / 2.6);
      r.g.position.x = r.desde.x + (veh.position.x - dx * 2.5 - r.desde.x) * k; r.g.position.z = r.desde.z + (veh.position.z - dz * 2.5 - r.desde.z) * k;
      r.g.visible = c.t < 2.8 + i * 0.12;
      if (r.g.userData.modelo) animar(r, k < 1 ? 3.5 : 0, dt);
    });
    // después el vehículo se va
    const v = Math.max(0, c.t - 3.2);
    if (c.tipo === 'sube') {
      veh.position.y = 0.2 + v * v * 0.9; veh.position.x += dx * v * dt * 3; veh.position.z += dz * v * dt * 3; veh.rotation.x = -Math.min(0.25, v * 0.08);
      if (v > 0 && Math.random() < dt * 9) tono(70, 0, 0.08, 'sawtooth', 0.05);
    } else {
      const vel = Math.min(14, v * 4); veh.position.x += dx * vel * dt; veh.position.z += dz * vel * dt;
      if (v > 0 && !c.motor) { c.motor = true; raspa(0, 5, 160, 420, 0.25); }
    }
    // la cámara sigue al vehículo
    cam.position.set(c.cam[0], c.cam[1] + Math.min(4, v * 0.4), c.cam[2]);
    cam.lookAt(veh.position.x, veh.position.y + 1.5, veh.position.z);
    cam.fov = fovBase; cam.updateProjectionMatrix();
    // al final, la pantalla se pone negra
    if (c.t > 8.5) $('#cine').style.background = 'rgba(0,0,0,' + Math.min(1, (c.t - 8.5) / 1.5) + ')';
    if (zombis.size) zombisTick(dt, performance.now() - 110);
    ren.clear(); ren.render(scene, cam);
  }
  function campLimpiar() {
    for (const r of mercs.values()) { scene.remove(r.g); if (r.laser) scene.remove(r.laser); } mercs.clear();
    if (camion) { scene.remove(camion.g); camion = null; } for (const it of items.values()) scene.remove(it.g); items.clear(); campC = null; campK = null; abriendo.length = 0;
    if (cine) { if (cine.grupo) scene.remove(cine.grupo); cine = null; document.body.classList.remove('cine'); $('#cine').classList.add('hidden'); $('#cine').style.background = ''; }
    $('#obj').classList.add('hidden'); $('#jefeBar').classList.add('hidden'); $('#usar').classList.add('hidden'); $('#marcas').innerHTML = '';
    usar(false);
  }
  J.campMsg = m => {
    const c = CAMP(); if (!c) return;
    switch (m.t) {
      case 'cnivel': {
        const N = c.NIVELES[m.n]; if (!N) break;
        W.reiniciarMapa(N.mapa); mapaId = null;
        campLimpiar(); briefing(m.n);
        ['torreta', 'escudo', 'blindado', 'palmera', 'helicoptero', 'jeep', 'locomotora', 'colectivo', 'camion_militar', 'humvee'].forEach(cargarProp);
        break;
      }
      case 'cfase': {
        const f = c.NIVELES[m.n].fases[m.f]; if (!f) break;
        if (m.f > 0) { aviso('🎯 Nuevo objetivo', f.txt); SFX.aparece(); }
        if (f.aviso) setTimeout(() => aviso('⚠️ ' + f.aviso, f.txt), m.f > 0 ? 2200 : 0);
        if (f.tipo === 'jefe') rugido(1);
        break;
      }
      case 'cfin': J.finNivel(m.n); break;
      case 'cfalla': aviso('💀 ' + m.motivo, 'Reintentan desde el último punto de control...'); SFX.muero(); break;
      case 'cpunto': SFX.baja(); if (!m.jefe) aviso('✅ ¡Listo!', 'Sigan con el objetivo'); break;
      case 'abrir': { const M = W.mapa(mapaId); W.abrir(M, m.id); abrirVisual(m.id); break; }
      case 'jefe': {
        const j = [...zombis.values()].find(z => z.tipo === 'teju');
        if (m.ev === 'expuesto') { aviso('❄️⚡ ¡Teju Jagua al descubierto!', '¡Tírenle a la cabeza ahora!'); metal(0, 1.2, 2400, 300, 0.3, 4); if (j && j.cur) for (let i = 0; i < 16; i++) { const h = new T.Sprite(new T.SpriteMaterial({ map: brillo(m.tipo === 'valvula' ? '#bfefff' : '#9ad0ff'), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); h.position.set(j.cur.x + (Math.random() - 0.5) * 3, 1 + Math.random() * 3.5, j.cur.z + (Math.random() - 0.5) * 3); scene.add(h); humos.push({ o: h, t: 0, max: 1.5 + Math.random(), s0: 0.6, s1: 2, op: 0.9, sube: 0.6 }); } }
        else if (m.ev === 'golpe') { boomSnd(0.45); if (yo.s && Math.hypot(m.x - yo.s.x, m.z - yo.s.z) < 12) yo.temblor = Math.max(yo.temblor || 0, 0.3); }
        else rugido(m.ev === 'carga' ? 0.7 : 1);
        break;
      }
      case 'final': J.final(); break;
    }
  };
  J.campSnap = m => { if (m.I) itemsSnap(m.I); if (m.M) mercsSnap(m.M); else if (mercs.size) mercsSnap([]); if (m.C) { campC = m.C; campHUD(); } campK = m.K || null; };
  J.campAbiertas = S => {
    if (!S.camp || !S.camp.ab || !mapaId) return;
    const M = W.mapa(mapaId);
    for (const id of S.camp.ab) if (W.abrir(M, id) || puertasB[id] || puertasP[id]) abrirVisual(id, true);
  };
  function campTick(dt, rt) {
    if (mercs.size) mercsTick(dt, rt);
    camionTick(dt); abriendoTick(dt); if (items.size) itemsTick();
    if (esCamp()) { marcasTick(); usarTick(); ambienteTick(dt); }
  }

  J._dbg = { yo, inp, remotos, VM, mercs };   // para probar desde la consola
  J.vivo = () => yo.alive;
  J.prim = () => yo.prim;
  J.setPrim = w => { if (A[w]) yo.prim = w; };
})();
