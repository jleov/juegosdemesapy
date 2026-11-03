// Ver juntos — puente dentro de la página de la Sala de Voz.
// La página habla con la extensión por window.postMessage (src «salas-app» → extensión, «salas-ext» → página).
(() => {
  const ORIGIN = location.origin;
  let port = null;
  const aPagina = m => window.postMessage({ ...m, src: 'salas-ext' }, ORIGIN);
  function conectar() {
    try { port = chrome.runtime.connect({ name: 'puente' }); } catch (e) { port = null; return; }
    port.onMessage.addListener(aPagina);
    // si Chrome duerme la parte central de la extensión, se vuelve a conectar
    port.onDisconnect.addListener(() => { port = null; setTimeout(conectar, 800); });
  }
  conectar();
  const hola = () => aPagina({ type: 'hello', v: chrome.runtime.getManifest().version });
  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.src !== 'salas-app') return;
    if (e.data.type === 'ping') { hola(); return; }
    if (!port) conectar();
    try { port && port.postMessage(e.data); } catch (err) {}
  });
  hola();
  document.addEventListener('DOMContentLoaded', hola);
})();
