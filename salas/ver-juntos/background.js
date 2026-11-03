// Ver juntos — parte central de la extensión.
// Une la Sala de Voz (puente.js, en la pestaña de la sala) con la pestaña donde está la película (video.js).
// La sala manda órdenes (play, pausa, ir a un minuto, volumen) y recibe cómo va la película.

const videos = new Map();   // "pestaña:marco" -> { port, tabId, info }
const puentes = new Set();  // pestañas de la Sala de Voz abiertas
let elegido = null;         // video que se está sincronizando

const lista = () => [...videos.entries()]
  .filter(([, v]) => v.info && v.info.has)
  .map(([key, v]) => ({ key, tabId: v.tabId, title: v.info.title || '', url: v.info.url || '', plat: v.info.plat || '', dur: v.info.duration || 0, elegido: key === elegido }));

function aPuentes(msg) { puentes.forEach(p => { try { p.postMessage(msg); } catch (e) {} }); }
let tabsT = 0;
function avisarLista() { clearTimeout(tabsT); tabsT = setTimeout(() => aPuentes({ type: 'tabs', list: lista() }), 150); }

chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'puente') {
    puentes.add(port);
    port.onDisconnect.addListener(() => puentes.delete(port));
    port.onMessage.addListener(m => desdeSala(m));
    port.postMessage({ type: 'tabs', list: lista() });
    return;
  }
  if (port.name !== 'video' || !port.sender || !port.sender.tab) return;
  const key = port.sender.tab.id + ':' + (port.sender.frameId || 0);
  videos.set(key, { port, tabId: port.sender.tab.id, info: null });
  port.onDisconnect.addListener(() => {
    if (videos.get(key) && videos.get(key).port === port) videos.delete(key);
    if (elegido === key) { elegido = null; aPuentes({ type: 'state', has: false }); }
    avisarLista();
  });
  port.onMessage.addListener(m => desdeVideo(key, m));
});

function desdeVideo(key, m) {
  const v = videos.get(key); if (!v) return;
  if (m.type === 'state') {
    const tenia = v.info && v.info.has;
    v.info = m;
    if (!elegido && m.has) elegido = key;   // la primera película que aparece queda elegida
    if (!!tenia !== !!m.has || !v.dicho) { v.dicho = true; avisarLista(); }
    if (key === elegido) aPuentes({ ...m, type: 'state', key });
  } else if (m.type === 'ev' && key === elegido) {
    aPuentes({ ...m, type: 'ev', key });
  }
}

function desdeSala(m) {
  if (!m || typeof m !== 'object') return;
  if (m.type === 'tabs') { aPuentes({ type: 'tabs', list: lista() }); return; }
  if (m.type === 'bind') { if (videos.has(m.key)) elegido = m.key; avisarLista(); return; }
  if (m.type === 'cmd') {
    const v = elegido && videos.get(elegido);
    if (v) try { v.port.postMessage(m); } catch (e) {}
    return;
  }
  if (m.type === 'open' && /^https:\/\//.test(m.url || '')) { chrome.tabs.create({ url: m.url }); return; }
  if (m.type === 'focus') {
    const v = elegido && videos.get(elegido);
    if (v) chrome.tabs.update(v.tabId, { active: true }).catch(() => {});
  }
}
