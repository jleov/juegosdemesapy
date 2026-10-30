/* =====================================================================
   Servidores para conectar los aparatos entre sí (lo usan todos los juegos).
   STUN: para la conexión directa. TURN de Cloudflare: respaldo cuando la red
   no deja conectarse directo (datos móviles, algunos routers). Los permisos
   del TURN los da /api/turn del sitio y se guardan unas horas en el aparato.
   ICE_SERVERS es siempre la misma lista: cuando llegan los permisos se agregan
   ahí, y las conexiones nuevas ya los usan aunque la sala se haya abierto antes.
   ===================================================================== */
window.ICE_SERVERS = [
  {urls:'stun:stun.cloudflare.com:3478'},
  {urls:'stun:stun.l.google.com:19302'},
  {urls:'stun:stun1.l.google.com:19302'},
];
(function(){
  const KEY='jmpy_turn', API=(/(^|\.)juegospy\.com$|\.pages\.dev$/.test(location.hostname) ? '/api/' : 'https://juegosdemesapy.pages.dev/api/')+'turn';   // en juegospy.com (y pages.dev) el del mismo sitio; desde GitHub, el de Cloudflare
  const add = list => (list||[]).forEach(s=>{ if(s && s.urls && s.username) ICE_SERVERS.push(s); });
  let got=false;
  try{ const c=JSON.parse(localStorage.getItem(KEY)||'null'); if(c && c.exp>Date.now()+30*60e3){ add(c.list); got=true; } }catch(e){}
  if(got) return;
  const ask = tries => fetch(API, {cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{
    if(!d || !d.iceServers || !d.iceServers.length) return;
    add(d.iceServers);
    try{ localStorage.setItem(KEY, JSON.stringify({list:d.iceServers, exp:Date.now()+(d.ttl||3600)*1000})); }catch(e){}
  }).catch(()=>{ if(tries>0) setTimeout(()=>ask(tries-1), 5000); });
  ask(2);
})();

/* =====================================================================
   Protección común: todo lo que llega de otro aparato (nombres, chat, partida)
   se limpia antes de que el juego lo use, para que nadie pueda meter código
   en un nombre o un mensaje y hacerlo correr en el celular de los demás.
   Los caracteres que sirven para eso se cambian por otros que se ven parecido:
   < > → ‹ ›   " → ”   ' → ’   ` → ´
   Vale también si el anfitrión tiene el juego modificado.
   ===================================================================== */
(function(){
  if(!window.Peer || Peer.__seguro) return;
  Peer.__seguro = true;
  const MAP = {'<':'‹', '>':'›', '"':'”', "'":'’', '`':'´'};
  const fix = s => /[<>"'`]/.test(s) ? s.replace(/[<>"'`]/g, c => MAP[c]) : s;
  const clean = (v, depth) => {
    if(typeof v === 'string') return fix(v);
    if(!v || typeof v !== 'object' || depth > 40) return v;
    if(v instanceof ArrayBuffer || ArrayBuffer.isView(v) || (typeof Blob !== 'undefined' && v instanceof Blob)) return v;   // audio, imágenes binarias
    if(Array.isArray(v)){ for(let i=0; i<v.length; i++) v[i] = clean(v[i], depth+1); return v; }
    for(const k of Object.keys(v)){
      const val = clean(v[k], depth+1);
      const nk = fix(k);
      if(nk !== k){ delete v[k]; v[nk] = val; } else v[k] = val;
    }
    return v;
  };
  const wrap = c => {
    if(!c || c.__seguro || typeof c.emit !== 'function') return c;
    c.__seguro = true;
    const emit = c.emit;
    c.emit = function(ev, ...a){ if(ev === 'data') a[0] = clean(a[0], 0); return emit.call(this, ev, ...a); };
    return c;
  };
  const P = Peer.prototype, connect = P.connect, emit = P.emit;
  P.connect = function(){ return wrap(connect.apply(this, arguments)); };   // conexiones que abro yo
  P.emit = function(ev, ...a){ if(ev === 'connection') wrap(a[0]); return emit.call(this, ev, ...a); };   // las que me abren
  window.limpiarRed = clean;
})();
