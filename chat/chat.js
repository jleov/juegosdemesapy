/* =====================================================================
   Chat de jugadores de la portada: todos los que tienen juegospy.com abierto
   pueden escribirse para buscar con quién jugar. Solo texto y emojis.
   Sin servidor propio: el primero que entra es la "central" (peer fijo HUB) y
   los demás se conectan a él por PeerJS. Si la central se va, otro toma su lugar
   y sigue con el historial que tenía guardado.
   La central pone el nombre de quién escribió (nadie puede escribir como otro),
   corta los mensajes largos y frena al que manda demasiados seguidos.
   ===================================================================== */
(function(){
  if(!window.Peer) return;
  const HUB = 'jpychat26-central', PREF = 'jpychat26-';
  const MAXT = 200, MAXN = 20, HIST = 60;
  const $ = s => document.querySelector(s);
  const load = (k, d) => { try{ const v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } };
  const store = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
  const opts = () => ({ debug:0, config:{ iceServers: window.ICE_SERVERS || [{urls:'stun:stun.l.google.com:19302'}] } });
  const rid = () => Math.random().toString(36).slice(2, 10);
  const limpiaNom = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, MAXN);
  const limpiaTxt = x => String(x || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAXT);

  // nombre: el del chat, o el que ya usa en algún juego
  let nombre = limpiaNom(load('jpy_chat_nombre', '') || ['bnq_name','petei_name','uno_name','billar_name','bolos_name','ajedrez_name','basta_name'].map(k => load(k, '')).find(Boolean));
  let hist = []; try{ hist = JSON.parse(load('jpy_chat_hist', '[]')).slice(-HIST); }catch(e){}
  let mudos = []; try{ mudos = JSON.parse(load('jpy_chat_mudos', '[]')); }catch(e){}
  let gente = [], yo = '', abierto = false, sinLeer = 0;

  /* ---------------- red ---------------- */
  const R = { me:null, conn:null, hub:null, clientes:new Map(), visto:0, timer:null, reintento:null, soyHub:false, intento:0 };

  function arrancar(){
    clearTimeout(R.reintento);
    if(R.me){ try{ R.me.destroy(); }catch(e){} }
    R.me = new Peer(PREF + rid(), opts());
    R.me.on('open', id => { yo = id; conectarHub(); });
    R.me.on('error', e => {
      if(e.type === 'peer-unavailable'){ ser(); return; }   // no hay central: me hago central
      if(['network','server-error','socket-error','socket-closed','disconnected'].includes(e.type)) reintentar();
    });
    R.me.on('disconnected', () => { try{ R.me.reconnect(); }catch(e){ reintentar(); } });
  }
  function conectarHub(){
    estado('Conectando…');
    const c = R.me.connect(HUB, { reliable:true });
    R.conn = c;
    const espera = setTimeout(() => { if(R.conn === c && !c.open){ R.conn = null; try{ c.close(); }catch(e){} reintentar(); } }, 9000);
    c.on('open', () => { clearTimeout(espera); R.intento = 0; R.visto = Date.now(); enviar({ t:'hola', n:nombre }); estado(''); });
    c.on('data', d => { R.visto = Date.now(); recibir(d); });
    c.on('close', () => { if(R.conn === c){ R.conn = null; reintentar(); } });
    c.on('error', () => {});
  }
  function reintentar(){
    if(R.soyHub) return;
    estado('Reconectando…');
    clearTimeout(R.reintento);
    R.intento++;
    R.reintento = setTimeout(() => { if(R.me && R.me.open) conectarHub(); else arrancar(); }, 800 + Math.random()*1500 + Math.min(R.intento, 8)*400);
  }
  // pido el lugar de central; si otro lo agarró primero, me conecto a él
  function ser(){
    if(R.soyHub || R.hub) return;
    setTimeout(() => {
      if(R.soyHub || R.hub) return;
      const h = new Peer(HUB, opts());
      R.hub = h;
      h.on('open', () => {
        R.soyHub = true; estado('');
        if(R.me){ try{ R.me.destroy(); }catch(e){} R.me = null; }
        if(!yo) yo = PREF + rid();
        R.conn = null;
        avisarGente();
      });
      h.on('connection', c => {
        c.on('open', () => { R.clientes.set(c.peer, { c, n:'', ts:[], visto:Date.now() }); });
        c.on('data', d => hubRecibe(c.peer, d));
        c.on('close', () => { if(R.clientes.delete(c.peer)) avisarGente(); });
        c.on('error', () => {});
      });
      h.on('error', e => {
        if(e.type === 'unavailable-id' || !R.soyHub){ try{ h.destroy(); }catch(x){} R.hub = null; R.soyHub = false; reintentar(); }
      });
      h.on('disconnected', () => { try{ h.reconnect(); }catch(e){} });
    }, Math.random()*1200);
  }

  /* --- la central --- */
  function hubRecibe(id, d){
    const cl = R.clientes.get(id); if(!cl || !d || typeof d !== 'object') return;
    cl.visto = Date.now();
    if(d.t === 'hola' || d.t === 'nom'){
      const n = limpiaNom(d.n) || ('Invitado ' + id.slice(-3).toUpperCase());
      const nuevo = !cl.n; cl.n = n;
      if(nuevo) cl.c.send({ t:'hist', m:hist, yo:id });
      avisarGente();
    } else if(d.t === 'msg'){
      if(!cl.n) return;
      hubMensaje(id, cl.n, d.x, cl);
    }
  }
  function hubMensaje(id, n, x, cl){
    x = limpiaTxt(x); if(!x) return;
    const ahora = Date.now();
    if(cl){   // no más de 1 cada 1,2 s ni 8 en 20 s
      cl.ts = cl.ts.filter(t => ahora - t < 20000);
      if(cl.ts.length >= 8 || (cl.ts.length && ahora - cl.ts[cl.ts.length-1] < 1200)){ cl.c.send({ t:'aviso', x:'Despacio 🙂 esperá un poquito antes de mandar otro mensaje.' }); return; }
      cl.ts.push(ahora);
    }
    const m = { id, n, x, ts:ahora, k:rid() };
    agregar(m);
    R.clientes.forEach(o => { try{ o.c.open && o.c.send({ t:'msg', m }); }catch(e){} });
  }
  const HUBTS = [];
  function avisarGente(){
    gente = [{ id:yo, n:nombre || 'Invitado' }].concat([...R.clientes].filter(([,o]) => o.n).map(([id,o]) => ({ id, n:o.n })));
    R.clientes.forEach(o => { try{ o.c.open && o.c.send({ t:'gente', l:gente }); }catch(e){} });
    pintarGente();
  }

  /* --- cliente --- */
  function enviar(o){ if(R.conn && R.conn.open) try{ R.conn.send(o); }catch(e){} }
  function recibir(d){
    if(!d || typeof d !== 'object') return;
    if(d.t === 'hist' && Array.isArray(d.m)){ hist = d.m.filter(okMsg).slice(-HIST); yo = String(d.yo || yo); guardar(); pintarTodo(); }
    else if(d.t === 'msg' && okMsg(d.m)) agregar(d.m);
    else if(d.t === 'gente' && Array.isArray(d.l)){ gente = d.l.filter(p => p && typeof p.n === 'string' && typeof p.id === 'string').slice(0, 300); pintarGente(); }
    else if(d.t === 'aviso' && typeof d.x === 'string') aviso(d.x.slice(0, 200));
    else if(d.t === 'chau'){ const c = R.conn; R.conn = null; R.intento = 0; try{ c && c.close(); }catch(e){} reintentar(); }
  }
  const okMsg = m => m && typeof m.n === 'string' && typeof m.x === 'string' && typeof m.id === 'string';

  function mandar(x){
    x = limpiaTxt(x); if(!x) return false;
    if(!nombre){ pedirNombre(); return false; }
    if(R.soyHub){
      const ahora = Date.now();
      while(HUBTS.length && ahora - HUBTS[0] > 20000) HUBTS.shift();
      if(HUBTS.length >= 8 || (HUBTS.length && ahora - HUBTS[HUBTS.length-1] < 1200)){ aviso('Despacio 🙂 esperá un poquito antes de mandar otro mensaje.'); return false; }
      HUBTS.push(ahora);
      hubMensaje(yo, nombre, x, null);
      return true;
    }
    if(!(R.conn && R.conn.open)){ aviso('Todavía conectando… probá en un ratito.'); return false; }
    enviar({ t:'msg', x }); return true;
  }
  function cambiarNombre(n){
    nombre = limpiaNom(n); store('jpy_chat_nombre', nombre);
    if(R.soyHub) avisarGente(); else enviar({ t:'nom', n:nombre });
    pintarCabeza();
  }

  // latidos: la central avisa que sigue viva; si alguien deja de responder, se corta
  setInterval(() => {
    const ahora = Date.now();
    if(R.soyHub){
      R.clientes.forEach((o, id) => {
        if(ahora - o.visto > 45000){ try{ o.c.close(); }catch(e){} R.clientes.delete(id); avisarGente(); }
        else try{ o.c.open && o.c.send({ t:'p' }); }catch(e){}
      });
    } else if(R.conn && R.conn.open){
      enviar({ t:'p' });
      if(ahora - R.visto > 30000){ const c = R.conn; R.conn = null; try{ c.close(); }catch(e){} reintentar(); }
    }
  }, 10000);
  // la central avisa que se va, así otro toma su lugar enseguida
  window.addEventListener('pagehide', () => {
    if(R.soyHub) R.clientes.forEach(o => { try{ o.c.open && o.c.send({ t:'chau' }); }catch(e){} });
    try{ R.hub && R.hub.destroy(); R.me && R.me.destroy(); }catch(e){}
  });

  /* ---------------- pantalla ---------------- */
  const EMOJIS = '😀 😂 🤣 😅 😊 😍 😎 🤔 😮 😢 😡 🥳 👍 👎 👏 🙏 💪 🙌 👋 🤝 ❤️ 🔥 ⭐ 🎉 🎲 🃏 🎱 🎳 ♟️ ⚽ 🧉 🇵🇾 ✅ ❌ ⏰ 🙋'.split(' ');
  const css = `
#chatBtn{position:fixed;right:16px;bottom:16px;z-index:8;border:0;border-radius:30px;padding:12px 16px;font:800 15px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f2c14e;color:#2a1608;box-shadow:0 8px 22px rgba(0,0,0,.5);cursor:pointer;display:flex;align-items:center;gap:8px}
#chatBtn .on{display:inline-flex;align-items:center;gap:4px;font-size:13px;background:rgba(0,0,0,.12);border-radius:20px;padding:2px 8px}
#chatBtn .on::before{content:"";width:8px;height:8px;border-radius:50%;background:#1f9d3f}
#chatBtn .nl{background:#d52b1e;color:#fff;border-radius:20px;min-width:22px;padding:2px 6px;font-size:12px;display:none}
#chatBox{position:fixed;right:16px;bottom:16px;z-index:9;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 32px));background:#fff8e6;color:#1d1d1d;border-radius:18px;box-shadow:0 14px 40px rgba(0,0,0,.6);display:none;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#chatBox.on{display:flex}
@media (max-width:520px){#chatBox{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}}
#chatBox .cab{background:#1c1240;color:#fff;padding:10px 12px;display:flex;align-items:center;gap:8px}
#chatBox .cab b{flex:1;font-size:16px}
#chatBox .cab small{display:block;font-weight:500;color:#cfc8ea;font-size:12px}
#chatBox .cab button{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;padding:7px 10px;font:inherit;font-weight:700;cursor:pointer}
#chatBox .yo{display:flex;gap:6px;align-items:center;padding:8px 12px;background:#efe5c8;font-size:13px}
#chatBox .yo input{flex:1;min-width:0;border:1px solid #cbbf99;border-radius:8px;padding:6px 8px;font:inherit;font-size:14px}
#chatBox .gente{padding:6px 12px;background:#f6edd3;font-size:13px;max-height:90px;overflow:auto;display:none;border-bottom:1px solid #e2d6b0}
#chatBox .gente.on{display:block}
#chatBox .gente span{display:inline-block;background:#fff;border-radius:12px;padding:2px 8px;margin:2px 3px 2px 0}
#chatBox .msgs{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
#chatBox .m{max-width:86%;align-self:flex-start;background:#fff;border-radius:12px 12px 12px 4px;padding:6px 10px;box-shadow:0 1px 2px rgba(0,0,0,.12);word-wrap:break-word;overflow-wrap:anywhere;line-height:1.35}
#chatBox .m.mio{align-self:flex-end;background:#d7ecff;border-radius:12px 12px 4px 12px}
#chatBox .m .n{font-weight:800;font-size:12px;color:#0038a8;cursor:pointer;margin-right:6px}
#chatBox .m.mio .n{cursor:default}
#chatBox .m .h{font-size:11px;color:#888}
#chatBox .m .x{display:block;font-size:15px}
#chatBox .m.solo .x{font-size:30px;line-height:1.2}
#chatBox .vacio{color:#777;text-align:center;margin:auto;font-size:14px;padding:20px}
#chatBox .emo{display:none;flex-wrap:wrap;gap:2px;padding:6px 8px;background:#f6edd3;border-top:1px solid #e2d6b0;max-height:132px;overflow:auto}
#chatBox .emo.on{display:flex}
#chatBox .emo button{border:0;background:none;font-size:24px;width:40px;height:40px;cursor:pointer;border-radius:8px}
#chatBox .emo button:hover{background:#e9dcb5}
#chatBox form{display:flex;gap:6px;padding:8px;border-top:1px solid #e2d6b0;background:#fff8e6}
#chatBox form input{flex:1;min-width:0;border:1px solid #cbbf99;border-radius:20px;padding:10px 14px;font:inherit;font-size:16px}
#chatBox form button{border:0;border-radius:50%;width:44px;height:44px;font-size:20px;cursor:pointer;flex:none}
#chatBox form .env{background:#0038a8;color:#fff}
#chatBox form .bem{background:#efe5c8}
#chatBox .est{font-size:12px;color:#7a5b00;text-align:center;padding:3px;background:#fff1c2;display:none}
#chatBox .reg{font-size:11.5px;color:#7a6a45;padding:0 12px 6px;background:#efe5c8}`;

  function armar(){
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const b = document.createElement('button'); b.id = 'chatBtn'; b.type = 'button';
    b.innerHTML = '💬 Chat <span class="on">0</span><span class="nl"></span>';
    b.title = 'Chat de jugadores: buscá con quién jugar';
    b.onclick = () => abrir(true);
    document.body.appendChild(b);
    const box = document.createElement('div'); box.id = 'chatBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Chat de jugadores');
    box.innerHTML = `
      <div class="cab"><b>💬 Chat de jugadores<small class="cnt"></small></b><button type="button" class="vg" title="Ver quiénes están">👥</button><button type="button" class="cer" title="Cerrar">✕</button></div>
      <div class="gente"></div>
      <div class="yo">Tu nombre: <input class="nom" maxlength="${MAXN}" placeholder="Escribí tu nombre" autocomplete="nickname"></div>
      <div class="reg">Buscá con quién jugar y pasá el código de tu sala. Sé respetuoso/a 🙂 Tocá un nombre para silenciarlo.</div>
      <div class="est"></div>
      <div class="msgs"></div>
      <div class="emo">${EMOJIS.map(e => `<button type="button">${e}</button>`).join('')}</div>
      <form><button type="button" class="bem" title="Emojis">😀</button><input class="txt" maxlength="${MAXT}" placeholder="Escribí un mensaje…" autocomplete="off" enterkeyhint="send"><button class="env" title="Enviar">➤</button></form>`;
    document.body.appendChild(box);
    const nom = box.querySelector('.nom'), txt = box.querySelector('.txt');
    nom.value = nombre;
    nom.onchange = () => cambiarNombre(nom.value);
    nom.onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); cambiarNombre(nom.value); txt.focus(); } };
    box.querySelector('.cer').onclick = () => abrir(false);
    box.querySelector('.vg').onclick = () => box.querySelector('.gente').classList.toggle('on');
    box.querySelector('.bem').onclick = () => box.querySelector('.emo').classList.toggle('on');
    box.querySelector('.emo').onclick = e => {
      if(e.target.tagName !== 'BUTTON') return;
      const s = txt.selectionStart ?? txt.value.length, f = txt.selectionEnd ?? s;
      txt.value = (txt.value.slice(0, s) + e.target.textContent + txt.value.slice(f)).slice(0, MAXT);
      const p = s + e.target.textContent.length; txt.setSelectionRange(p, p);
      if(matchMedia('(pointer:fine)').matches) txt.focus();
    };
    box.querySelector('form').onsubmit = e => {
      e.preventDefault();
      if(nom.value !== nombre) cambiarNombre(nom.value);
      if(mandar(txt.value)){ txt.value = ''; box.querySelector('.emo').classList.remove('on'); }
    };
    box.querySelector('.msgs').onclick = e => {
      const n = e.target.closest('.n'); if(!n || !n.dataset.id || n.dataset.id === yo) return;
      silenciar(n.dataset.id, n.textContent);
    };
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && abierto) abrir(false); });
    pintarCabeza(); pintarTodo();
  }
  function abrir(on){
    abierto = on;
    $('#chatBox').classList.toggle('on', on);
    $('#chatBtn').style.display = on ? 'none' : 'flex';
    if(on){
      sinLeer = 0; pintarBoton();
      const m = $('#chatBox .msgs'); m.scrollTop = m.scrollHeight;
      if(!nombre) pedirNombre(); else if(matchMedia('(pointer:fine)').matches) $('#chatBox .txt').focus();
    }
  }
  function pedirNombre(){ const n = $('#chatBox .nom'); n.focus(); n.style.outline = '3px solid #f2c14e'; setTimeout(() => n.style.outline = '', 2500); aviso('Escribí tu nombre primero ✍️'); }
  function silenciar(id, n){
    const ya = mudos.includes(id);
    if(!confirm(ya ? `¿Volver a ver los mensajes de ${n}?` : `¿Silenciar a ${n}? No vas a ver más sus mensajes.`)) return;
    mudos = ya ? mudos.filter(x => x !== id) : mudos.concat(id).slice(-200);
    store('jpy_chat_mudos', JSON.stringify(mudos));
    pintarTodo();
  }

  function agregar(m){
    hist.push(m); if(hist.length > HIST) hist = hist.slice(-HIST); guardar();
    if(mudos.includes(m.id)) return;
    const lista = $('#chatBox .msgs'); if(!lista) return;
    const abajo = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 60;
    const v = lista.querySelector('.vacio'); if(v) v.remove();
    lista.appendChild(burbuja(m));
    while(lista.children.length > HIST) lista.firstChild.remove();
    if(abajo || m.id === yo) lista.scrollTop = lista.scrollHeight;
    if(!abierto && m.id !== yo){ sinLeer++; pintarBoton(); }
  }
  function guardar(){ store('jpy_chat_hist', JSON.stringify(hist.slice(-HIST))); }
  function burbuja(m){
    const d = document.createElement('div');
    d.className = 'm' + (m.id === yo ? ' mio' : '');
    if(/^(\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️|\s){1,12}$/u.test(m.x)) d.classList.add('solo');
    const n = document.createElement('span'); n.className = 'n'; n.textContent = m.n; n.dataset.id = m.id;
    if(m.id !== yo) n.title = 'Tocá para silenciar';
    const h = document.createElement('span'); h.className = 'h';
    const t = new Date(+m.ts || Date.now()); h.textContent = t.toLocaleTimeString('es-PY', { hour:'2-digit', minute:'2-digit' });
    const x = document.createElement('span'); x.className = 'x'; x.textContent = m.x;
    d.append(n, h, x);
    return d;
  }
  function pintarTodo(){
    const lista = $('#chatBox .msgs'); if(!lista) return;
    lista.textContent = '';
    const vis = hist.filter(m => !mudos.includes(m.id));
    if(!vis.length){ const v = document.createElement('div'); v.className = 'vacio'; v.textContent = 'Todavía no hay mensajes. ¡Saludá y buscá con quién jugar! 👋'; lista.appendChild(v); }
    vis.forEach(m => lista.appendChild(burbuja(m)));
    lista.scrollTop = lista.scrollHeight;
  }
  function pintarGente(){
    const g = $('#chatBox .gente'); if(!g) return;
    g.textContent = '';
    gente.forEach(p => { const s = document.createElement('span'); s.textContent = (p.id === yo ? '⭐ ' : '🟢 ') + p.n; g.appendChild(s); });
    pintarCabeza(); pintarBoton();
  }
  function pintarCabeza(){
    const c = $('#chatBox .cnt'); if(!c) return;
    const n = gente.length;
    c.textContent = n ? (n === 1 ? 'Solo vos por ahora' : `${n} conectados`) : '';
  }
  function pintarBoton(){
    const b = $('#chatBtn'); if(!b) return;
    b.querySelector('.on').textContent = gente.length || '…';
    const nl = b.querySelector('.nl'); nl.textContent = sinLeer > 9 ? '9+' : sinLeer; nl.style.display = sinLeer ? 'inline-block' : 'none';
  }
  function estado(t){ const e = $('#chatBox .est'); if(e){ e.textContent = t; e.style.display = t ? 'block' : 'none'; } }
  function aviso(t){ if(typeof window.toast === 'function') window.toast(t); else alert(t); }

  function iniciar(){ armar(); arrancar(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
