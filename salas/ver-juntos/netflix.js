// Ver juntos — solo en Netflix, corre dentro de la página para usar el reproductor propio de Netflix
// (cambiar el minuto del <video> directamente hace que Netflix muestre un error).
(() => {
  function jugador() {
    try {
      const vp = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
      const ids = vp.getAllPlayerSessionIds();
      const id = ids.find(s => s.startsWith('watch')) || ids[0];
      return id ? vp.getVideoPlayerBySessionId(id) : null;
    } catch (e) { return null; }
  }
  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.src !== 'salas-nf') return;
    const p = jugador(); if (!p) return;
    try {
      if (e.data.a === 'seek' && isFinite(e.data.time)) p.seek(Math.round(e.data.time * 1000));
      else if (e.data.a === 'play') p.play();
      else if (e.data.a === 'pause') p.pause();
    } catch (err) {}
  });
})();
