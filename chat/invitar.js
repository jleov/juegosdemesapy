/* =====================================================================
   📣 Invitar al chat global (el de la portada juegospy.com) desde un juego.
   Lo carga dueno-link.js en todos los juegos con sala. Cuando el anfitrión
   tiene una sala en línea esperando gente, aparece abajo el botón
   "📣 Invitar al chat"; al tocarlo, se manda al chat un mensaje con el juego,
   el código y un botón "🎮 Unirme" para los que están en línea.
   No se queda conectado al chat: entra, deja la invitación y se va.
   La central del chat (chat/chat.js) es la que arma el enlace, pone el nombre
   y frena a quien invite demasiado seguido.
   ===================================================================== */
(function(){
  if(window.__invitarChat) return; window.__invitarChat = true;
  const HUB = 'jpychat26-central', PREF = 'jpychat26-';
  // carpeta de cada juego (el id del juego en dueno-link puede ser otro)
  const CARPETA = { uno:'petei', adivina:'mavapa' };
  // fases en las que todavía se puede entrar a jugar
  const ABIERTA = { lobby:1, venta:1 };
  const ESPERA_MS = 120000;   // la misma sala se puede volver a invitar a los 2 minutos
  const rid = () => Math.random().toString(36).slice(2, 10);
  const load = (k, d) => { try{ const v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } };
  const store = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
  let btn = null, ocupado = false, ultima = {};

  function sala(){
    const D = window.DuenoLink; if(!D || !D.info || !D.juego) return null;
    let i = null; try{ i = D.info(); }catch(e){}
    if(!i || i.local || !i.code) return null;
    const g = D.juego();
    const abierta = g === 'kombate' ? (i.kind === 'duel' && !i.guest) : !!ABIERTA[i.phase];
    if(!abierta) return null;
    const humanos = (i.players || []).filter(p => p && p.n && !p.bot);
    const n = i.host || (humanos[0] && humanos[0].n) || load('jpy_chat_nombre', '') || '';
    return { g: CARPETA[g] || g, c: String(i.code), n };
  }

  function armar(){
    if(btn) return;
    const st = document.createElement('style');
    st.textContent = `#invChat{position:fixed;z-index:8999;left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom));
  border:2px solid rgba(255,255,255,.7);border-radius:999px;background:linear-gradient(180deg,#ff8a3d,#e0531f);color:#fff;
  font:800 14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:9px 14px;box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:pointer;
  display:none;max-width:calc(100vw - 20px);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
#invChat:active{transform:scale(.96)}
#invChat[disabled]{opacity:.85;cursor:default}
#invChat.ok{background:linear-gradient(180deg,#3cbf5a,#23913b)}
#invChat.mal{background:linear-gradient(180deg,#8a8a8a,#666)}
@media print{#invChat{display:none!important}}`;
    document.head.appendChild(st);
    btn = document.createElement('button'); btn.type = 'button'; btn.id = 'invChat';
    btn.title = 'Mandar esta sala al chat de juegospy.com para que se sumen los que están en línea';
    btn.addEventListener('click', invitar);
    document.body.appendChild(btn);
  }
  function pintar(txt, clase){ btn.textContent = txt; btn.className = clase || ''; }
  function revisar(){
    if(!document.body) return;
    const s = sala();
    if(!s){ if(btn && !ocupado) btn.style.display = 'none'; return; }
    armar();
    btn.style.display = 'block';
    if(!ocupado) pintar('📣 Invitar al chat', '');
  }

  function invitar(){
    const s = sala(); if(!s || ocupado || typeof Peer === 'undefined') return;
    const k = s.g + ':' + s.c;
    if(Date.now() - (ultima[k] || 0) < ESPERA_MS){ fin('⏳ Ya la invitaste, esperá un ratito', 'mal'); return; }
    if(+load('jpy_chat_ban', 0) > Date.now()){ fin('⛔ No podés usar el chat por ahora', 'mal'); return; }
    ocupado = true; btn.disabled = true; pintar('📣 Mandando al chat…', '');
    let DEV = load('jpy_chat_dev', ''); if(!DEV){ DEV = rid() + rid(); store('jpy_chat_dev', DEV); }
    const me = new Peer(PREF + rid(), { debug:0, config:{ iceServers: window.ICE_SERVERS || [{urls:'stun:stun.l.google.com:19302'}] } });
    let listo = false;
    const cerrar = (txt, clase) => { if(listo) return; listo = true; clearTimeout(t); setTimeout(() => { try{ me.destroy(); }catch(e){} }, 500); fin(txt, clase); };
    const t = setTimeout(() => cerrar('😕 No se pudo llegar al chat, probá de nuevo', 'mal'), 12000);
    me.on('error', e => cerrar(e && e.type === 'peer-unavailable' ? '😴 Ahora no hay nadie en el chat' : '😕 No se pudo llegar al chat, probá de nuevo', 'mal'));
    me.on('open', () => {
      const c = me.connect(HUB, { reliable:true });
      c.on('open', () => c.send({ t:'hola', n:s.n, dv:DEV, oculto:1 }));
      c.on('data', d => {
        if(!d || typeof d !== 'object') return;
        if(d.t === 'hist') c.send({ t:'inv', g:s.g, c:s.c });
        else if(d.t === 'invOk'){ ultima[k] = Date.now(); const n = +d.n || 0; cerrar(n ? `✅ Invitación enviada (${n} en el chat)` : '✅ Invitación enviada al chat', 'ok'); }
        else if(d.t === 'aviso') cerrar('⚠️ ' + String(d.x || '').slice(0, 90), 'mal');
        else if(d.t === 'echado'){ store('jpy_chat_ban', String(+d.h || 0)); cerrar('⛔ No podés usar el chat por ahora', 'mal'); }
      });
      c.on('close', () => cerrar('😕 No se pudo llegar al chat, probá de nuevo', 'mal'));
    });
  }
  function fin(txt, clase){
    ocupado = true; btn.disabled = true; pintar(txt, clase);
    setTimeout(() => { ocupado = false; btn.disabled = false; revisar(); }, 4000);
  }
  setInterval(revisar, 1500);
})();
