// Ver juntos — dentro de la página de la película (Netflix, Disney+, Prime, YouTube…).
// Busca el video principal, cuenta cada segundo cómo va (minuto, pausa, volumen) y obedece las órdenes de la sala.
(() => {
  const H = location.hostname;
  const PLAT = /netflix/.test(H) ? 'Netflix' : /disneyplus/.test(H) ? 'Disney+' : /primevideo|amazon/.test(H) ? 'Prime Video'
    : /max\.com|hbomax/.test(H) ? 'Max' : /starplus/.test(H) ? 'Star+' : /paramountplus/.test(H) ? 'Paramount+'
    : /crunchyroll/.test(H) ? 'Crunchyroll' : /youtube/.test(H) ? 'YouTube' : /apple/.test(H) ? 'Apple TV+'
    : /vix/.test(H) ? 'ViX' : /pluto/.test(H) ? 'Pluto TV' : /mubi/.test(H) ? 'MUBI' : H;
  const NETFLIX = PLAT === 'Netflix';

  let port = null, vid = null, ordenHasta = 0;
  const atados = new WeakSet();

  function conectar() {
    try { port = chrome.runtime.connect({ name: 'video' }); } catch (e) { port = null; return; }
    port.onMessage.addListener(orden);
    port.onDisconnect.addListener(() => { port = null; setTimeout(conectar, 1000); });
  }

  // todos los <video>; si no hay a la vista, se busca dentro de componentes (shadow DOM abierto, ej. Disney+)
  function todos(root, out = [], hondo = false) {
    root.querySelectorAll('video').forEach(v => out.push(v));
    if (hondo || (root === document && !out.length)) root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) todos(el.shadowRoot, out, true); });
    return out;
  }
  // el principal: el más grande que tenga duración (no transmisiones en vivo de cámara)
  function buscar() {
    let mejor = null, area = 0;
    for (const v of todos(document)) {
      if (v.srcObject) continue;
      const r = v.getBoundingClientRect(), a = r.width * r.height;
      if (a > area && (v.readyState > 0 || v.currentSrc)) { mejor = v; area = a; }
    }
    if (mejor && !atados.has(mejor)) {
      atados.add(mejor);
      ['play', 'pause', 'seeked'].forEach(ev => mejor.addEventListener(ev, () => {
        // lo hizo la persona con los controles de la plataforma (no una orden de la sala)
        if (Date.now() < ordenHasta || mejor !== vid || !port) return;
        port.postMessage({ type: 'ev', ev, time: mejor.currentTime, paused: mejor.paused });
      }));
    }
    return mejor;
  }

  const nf = (a, time) => window.postMessage({ src: 'salas-nf', a, time }, location.origin);
  function irA(v, t) {
    if (!isFinite(t)) return;
    if (NETFLIX) nf('seek', t);   // Netflix se rompe si se cambia currentTime directo
    else v.currentTime = t;
  }

  function orden(m) {
    if (!m || m.type !== 'cmd') return;
    const v = vid || buscar(); if (!v) return;
    ordenHasta = Date.now() + 3000;   // lo que pase ahora en el video es por la orden, no lo hizo la persona
    if (typeof m.time === 'number' && Math.abs(v.currentTime - m.time) > (m.seek ? 0.3 : 0.8)) irA(v, m.time);
    if (m.cmd === 'play') { if (NETFLIX) nf('play'); else v.play().catch(() => {}); }
    if (m.cmd === 'pause') { if (NETFLIX) nf('pause'); else v.pause(); }
    if (m.cmd === 'vol' && typeof m.vol === 'number') { v.volume = Math.max(0, Math.min(1, m.vol)); if (m.vol > 0) v.muted = false; }
    if (m.cmd === 'mute') v.muted = !!m.on;
  }

  function contar() {
    vid = buscar();
    if (!port) return;
    const v = vid;
    // en los marcos internos sin video no se molesta a nadie
    if (!v && window !== window.top) return;
    port.postMessage(v ? {
      type: 'state', has: true, plat: PLAT, title: (window === window.top ? document.title : (document.title || PLAT)).replace(/\s*[|·-]\s*(Netflix|Disney\+|Prime Video|YouTube|Max)\s*$/i, ''),
      url: window === window.top ? location.href : '', time: v.currentTime, duration: isFinite(v.duration) ? v.duration : 0,
      paused: v.paused, rate: v.playbackRate, vol: v.muted ? 0 : v.volume, ad: !!document.querySelector('.ad-showing, [class*="ad-interrupting"]'),
    } : { type: 'state', has: false, plat: PLAT, title: document.title, url: location.href });
  }

  conectar();
  setInterval(contar, 1000);
  contar();
})();
