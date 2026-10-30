/* =====================================================================
   Modo transmisión (todos los juegos): para los que transmiten en vivo
   (TikTok, etc.) y no quieren que cualquiera vea el código de la sala.
   - Al lado del código de la sala aparece un botoncito 🙈: lo tapa con puntitos.
     Con 👁️ se vuelve a ver. Queda guardado en el aparato.
   - Con el código tapado tampoco se ve en la barra de direcciones ni en el
     cuadro donde se escribe para entrar.
   - Copiar, compartir e invitar siguen mandando el código de verdad: los juegos
     lo sacan de su memoria, no de la pantalla.
   Funciona sin cambiar los juegos: busca en la pantalla el texto del código de
   la sala actual y lo envuelve en <span class="sala-cod"> (el texto no cambia,
   solo se tapa con CSS).
   ===================================================================== */
(function(){
  if(window.__transmision) return; window.__transmision = true;
  const KEY = 'jpy_ocultar_codigo';
  let oculto = false; try{ oculto = localStorage.getItem(KEY) === '1'; }catch(e){}
  const CONOCIDOS = new Set();   // códigos de esta visita (aunque ya no estén en la dirección)
  const INPUTS = ['joinCode', 'oCode', 'inCode'];   // donde se escribe el código para entrar

  // ---------- estilos ----------
  const css = document.createElement('style');
  css.textContent = `
  .sala-cod{position:relative;display:inline-block}
  html.cod-oculto .sala-cod{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}
  html.cod-oculto .sala-cod::after{content:attr(data-mask);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    color:var(--cod-c,#888);-webkit-text-fill-color:var(--cod-c,#888);letter-spacing:.05em;white-space:nowrap;overflow:hidden}
  html.cod-oculto #${INPUTS.join(',html.cod-oculto #')}{-webkit-text-security:disc;text-security:disc}
  #codOjo{position:fixed;z-index:2147483000;display:none;align-items:center;gap:4px;border:0;border-radius:50%;width:28px;height:28px;padding:0;justify-content:center;font-size:15px;
    line-height:1;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:rgba(20,20,30,.85);color:#fff;cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,.45);white-space:nowrap;touch-action:manipulation;transform:translateY(-50%)}
  #codOjo:hover{background:rgba(40,40,60,.95)}
  `;
  (document.head || document.documentElement).appendChild(css);
  document.documentElement.classList.toggle('cod-oculto', oculto);

  // ---------- cuál es el código de la sala ahora ----------
  function codigos(){
    const s = new Set(CONOCIDOS);
    try{ if(typeof NET !== 'undefined' && NET && NET.code) s.add(String(NET.code).toUpperCase()); }catch(e){}
    const h = location.hash.slice(1).toUpperCase();
    if(/^[A-Z0-9]{4,8}$/.test(h)) s.add(h);
    try{
      const sala = new URLSearchParams(location.search).get('sala') || '';
      const m = sala.match(/([A-Za-z0-9]{4,8})$/); if(m && /-/.test(sala)) s.add(m[1].toUpperCase());
      else if(/^[A-Za-z0-9]{4,8}$/.test(sala)) s.add(sala.toUpperCase());
    }catch(e){}
    try{ const rc = document.querySelector('#roomCode b'); if(rc){ const t = rc.textContent.trim().toUpperCase(); if(/^[A-Z0-9]{4,10}$/.test(t)) s.add(t); } }catch(e){}   // Karaoke y Salas de Voz
    s.forEach(c => CONOCIDOS.add(c));
    return [...s].filter(c => c.length >= 4);
  }

  // ---------- envolver el código donde aparezca en la pantalla ----------
  const SALTAR = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|NOSCRIPT|CANVAS|SVG)$/;
  let RX = null, RXkey = '';
  function rx(){
    const cs = codigos(), k = cs.join('|');
    if(k !== RXkey){ RXkey = k; RX = cs.length ? new RegExp('(^|[^A-Za-z0-9])(' + cs.map(c => c.replace(/[^A-Z0-9]/g, '')).join('|') + ')(?![A-Za-z0-9])', 'i') : null; }
    return RX;
  }
  function envolver(root){
    const r = rx(); if(!r || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode(n){
      const p = n.parentElement; if(!p || SALTAR.test(p.tagName) || p.closest('.sala-cod,#codOjo')) return NodeFilter.FILTER_REJECT;
      return r.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }});
    const nodos = []; while(w.nextNode()) nodos.push(w.currentNode);
    for(let n of nodos){
      let m;
      while(n && (m = r.exec(n.nodeValue))){
        const ini = m.index + m[1].length, cod = m[2];
        const despues = n.splitText(ini);
        const resto = despues.splitText(cod.length);
        const sp = document.createElement('span');
        sp.className = 'sala-cod'; sp.dataset.mask = '•'.repeat(cod.length);
        try{ sp.style.setProperty('--cod-c', getComputedStyle(n.parentElement).color); }catch(e){}
        despues.parentNode.replaceChild(sp, despues); sp.appendChild(despues);
        n = resto;
      }
    }
  }
  // solo se revisa lo que cambió en la pantalla (no toda la página), así no carga los juegos con animaciones
  let pend = null;
  const obs = new MutationObserver(muts => {
    if(!rx()) return;   // sin sala no hay nada que tapar
    pend = pend || new Set();
    for(const m of muts){
      if(m.type === 'characterData'){ if(m.target.parentNode) pend.add(m.target.parentNode); }
      else m.addedNodes.forEach(n => { if(n.nodeType === 1 || n.nodeType === 3) pend.add(n.nodeType === 3 ? n.parentNode : n); });
    }
    if(!pend.__agendado){ pend.__agendado = true; requestAnimationFrame(() => {
      const todo = pend; pend = null;
      todo.forEach(n => { if(n && n.isConnected) envolver(n); });
      ubicarOjo();
    }); }
  });
  function arrancar(){
    if(!document.body) return setTimeout(arrancar, 50);
    envolver(document.body);
    obs.observe(document.body, {childList:true, subtree:true, characterData:true});
    crearOjo(); ubicarOjo();
    setInterval(() => { const k = RXkey; rx(); if(RXkey !== k) envolver(document.body); limpiarDireccion(); ubicarOjo(); }, 700);
  }

  // ---------- el botoncito 🙈 / 👁️ al lado del código ----------
  let ojo = null;
  function crearOjo(){
    ojo = document.createElement('button');
    ojo.id = 'codOjo'; ojo.type = 'button';
    ojo.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); cambiar(!oculto); });
    document.body.appendChild(ojo);
    pintarOjo();
  }
  function pintarOjo(){
    if(!ojo) return;
    ojo.innerHTML = oculto ? '👁️' : '🙈';
    ojo.title = oculto ? 'Mostrar el código de la sala' : 'Ocultar el código de la sala (para transmitir en vivo). Copiar y compartir siguen funcionando.';
  }
  // se pone al lado del código más grande que se vea en la pantalla
  function ubicarOjo(){
    if(!ojo) return;
    let mejor = null, tam = 0;
    document.querySelectorAll('.sala-cod').forEach(sp => {
      const r = sp.getBoundingClientRect();
      if(!r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
      const vis = getComputedStyle(sp); if(vis.visibility === 'hidden' || +vis.opacity === 0) return;
      // que no esté tapado por otra cosa (un panel, una ventana)
      const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      const enc = document.elementFromPoint(cx, cy);
      if(enc && enc !== ojo && !sp.contains(enc) && !enc.contains(sp)) return;
      const t = r.height * r.width; if(t > tam){ tam = t; mejor = r; }
    });
    if(!mejor){ ojo.style.display = 'none'; return; }
    ojo.style.display = 'flex';
    // la primera vez se explica para qué es (en el celular no se ve el texto de ayuda)
    try{ if(!oculto && !localStorage.getItem(KEY + '_aviso')){ localStorage.setItem(KEY + '_aviso', '1'); setTimeout(() => aviso('🙈 ¿Vas a transmitir en vivo? Tocá el monito al lado del código de la sala para taparlo. Copiar y compartir siguen funcionando.', 7000), 1500); } }catch(e){}
    const w = ojo.offsetWidth || 90;
    let x = mejor.right + 6; if(x + w > innerWidth - 4) x = Math.max(4, mejor.left - w - 6);
    ojo.style.left = x + 'px'; ojo.style.top = Math.max(14, Math.min(innerHeight - 14, mejor.top + mejor.height / 2)) + 'px';
  }
  addEventListener('scroll', () => ubicarOjo(), {passive:true, capture:true});
  addEventListener('resize', () => ubicarOjo());

  // ---------- la barra de direcciones ----------
  function sinCodigo(url){
    const r = rx(); if(!r) return url;
    try{
      const u = new URL(url, location.href);
      if(r.test(u.hash)) u.hash = '';
      if(r.test(u.searchParams.get('sala') || '')) u.searchParams.delete('sala');
      return u.pathname + u.search + u.hash;
    }catch(e){ return url; }
  }
  function limpiarDireccion(){
    if(!oculto) return;
    const limpio = sinCodigo(location.href);
    if(limpio !== location.pathname + location.search + location.hash) H.replace.call(history, history.state, '', limpio);
  }
  const H = {replace: history.replaceState, push: history.pushState};
  history.replaceState = function(st, t, url){ codigos(); return H.replace.call(this, st, t, (oculto && url != null) ? sinCodigo(url) : url); };
  history.pushState = function(st, t, url){ codigos(); return H.push.call(this, st, t, (oculto && url != null) ? sinCodigo(url) : url); };

  function cambiar(v){
    oculto = v;
    try{ localStorage.setItem(KEY, v ? '1' : '0'); }catch(e){}
    document.documentElement.classList.toggle('cod-oculto', v);
    codigos();
    if(v) limpiarDireccion();
    pintarOjo(); ubicarOjo();
    aviso(v ? '🙈 Código oculto para transmitir. “Copiar” y “Compartir” siguen mandando el código a tus amigos.' : '👁️ Código de la sala visible de nuevo.');
  }
  function aviso(txt, ms){
    const d = document.createElement('div');
    d.textContent = txt;
    d.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483001;background:#222;color:#fff;padding:10px 16px;border-radius:10px;max-width:90%;text-align:center;font:600 14px/1.35 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.5)';
    document.body.appendChild(d); setTimeout(() => d.remove(), ms || 3500);
  }
  window.ocultarCodigoSala = cambiar;   // por si un juego quiere un botón propio

  arrancar();
})();
