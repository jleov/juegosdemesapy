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
  const KEY='jmpy_turn', API='https://juegosdemesapy.pages.dev/api/turn';
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
