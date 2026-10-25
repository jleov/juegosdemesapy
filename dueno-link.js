/* =====================================================================
   Aviso al PANEL DEL DUEÑO (juegosdemesapy/dueno/): cada sala abierta de
   cualquier juego le cuenta al panel cómo va la partida.
   Para que nadie se haga pasar por el dueño, el panel firma con una llave
   que sale de su contraseña y la sala lo comprueba con esta llave pública.
   Uso en cada juego:  DuenoLink.start({game:'uno', info:()=>({...}) | null, onIam:token=>{}})
   ===================================================================== */
(function(){
  const OWNER_PUB = {x:'eLdK1LWh1LGyAlt0IW6Apa9bnuRt1LwLi3D1MQtqtHk', y:'XPx_IfKocm2ZANCG_As4PxsgjToAMnZMEaWlzZWWBKk'};
  const PANEL_ID = 'jmdpy26-dueno';
  const EC={name:'ECDSA', namedCurve:'P-256'}, SIG={name:'ECDSA', hash:'SHA-256'};
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
  let pubKey=null;
  async function verify(nonce, sig){
    if(!window.crypto || !crypto.subtle) return false;
    try{
      pubKey = pubKey || await crypto.subtle.importKey('jwk', {kty:'EC', crv:'P-256', x:OWNER_PUB.x, y:OWNER_PUB.y}, EC, false, ['verify']);
      return await crypto.subtle.verify(SIG, pubKey, unb64u(sig), new TextEncoder().encode(nonce));
    }catch(e){ return false; }
  }
  const L={cfg:null, peer:null, conn:null, ok:false, lastSeen:0, tried:0, nonce:null};
  function newPeer(){
    return new Peer({debug:0, config:{iceServers: window.ICE_SERVERS || [{urls:"stun:stun.l.google.com:19302"}]}});
  }
  function drop(){ const c=L.conn; Object.assign(L,{conn:null, ok:false}); try{ c && c.close(); }catch(e){} }
  function info(){ try{ return L.cfg && L.cfg.info(); }catch(e){ return null; } }
  function send(i){
    i = i || info(); const c=L.conn;
    if(!i || !L.ok || !c || !c.open) return;
    try{ c.send({t:'room', game:L.cfg.game, code:i.code, info:i}); }catch(e){}
  }
  function tick(){
    if(!L.cfg || typeof Peer==='undefined') return;
    const i=info();
    if(!i){   // no hay sala abierta en este aparato: no hace falta la conexión
      if(L.peer){ drop(); try{ L.peer.destroy(); }catch(e){} L.peer=null; }
      return;
    }
    if(!L.peer || L.peer.destroyed){
      const p=L.peer=newPeer();
      p.on('error', ()=>{});   // si el panel no está abierto, la conexión simplemente no se encuentra
      p.on('disconnected', ()=>{ if(!p.destroyed) setTimeout(()=>{ try{ p.reconnect(); }catch(e){} }, 1500); });
      return;
    }
    if(!L.peer.open) return;
    const c=L.conn;
    if(c && c.open && Date.now()-L.lastSeen<20000){ send(i); return; }   // conectado: se manda cómo va
    if(c && !c.open && Date.now()-L.tried<10000) return;                  // todavía conectando
    drop();
    const n=L.peer.connect(PANEL_ID, {reliable:true});
    Object.assign(L,{conn:n, tried:Date.now(), lastSeen:Date.now()});
    n.on('open', ()=>{ L.nonce=b64u(crypto.getRandomValues(new Uint8Array(18))); n.send({t:'hi', nonce:L.nonce}); });
    n.on('data', async d=>{
      if(L.conn!==n || !d || typeof d!=='object') return;
      L.lastSeen=Date.now();
      if(d.t==='proof'){ if(await verify(L.nonce, d.sig)){ L.ok=true; send(); } else drop(); return; }
      if(!L.ok) return;
      if(d.t==='iam'){ const i=info(); if(L.cfg.onIam && i){ L.cfg.onIam(String(d.token)); try{ n.send({t:'iamOk', game:L.cfg.game, code:i.code}); }catch(e){} } }
      else if(d.t==='ping'){ try{ n.send({t:'pong'}); }catch(e){} }
    });
    n.on('close', ()=>{ if(L.conn===n) Object.assign(L,{conn:null, ok:false}); });
  }
  setInterval(tick, 4000);
  window.DuenoLink = {
    start(cfg){ L.cfg=cfg; setTimeout(tick, 1500); },
    report(){ send(); },   // para avisar enseguida un cambio importante
  };
})();
