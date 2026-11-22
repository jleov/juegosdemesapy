'use strict';
/* =====================================================================
   Carrera Guasu — la sala: quiénes juegan, qué se corre (carrera libre
   o copa), los puntos y el paso de una carrera a la otra. Esto lo lleva
   el anfitrión (o el propio aparato en las partidas contra bots).
   ===================================================================== */
const MAXP = 8;
let S = null;
const rnd = n => Math.floor(Math.random()*n);
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const defaultOpts = () => ({modo:'libre', pista:'asu', copa:'chipa', carreras:4, arena:'plaza', vidas:3, tiempo:180, vueltas:3, karts:8, nivel:'medio', ritmo:'normal', objetos:true});
function lobbyState(){ return {phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), carrera:null, res:null, nCarrera:0, iCopa:0, startedAt:null, final:false}; }
function addPlayer(name, ch, token, peerId){
  const usados=S.players.map(p=>p.color), color=COLORES.find(c=>!usados.includes(c))||COLORES[S.players.length%COLORES.length];
  const p={id:'p'+(++S.seq), name, ch:ch|0, emoji:piloto(ch).e, color, token, peerId, conn:true, bot:false, mic:false, cam:false, pts:0};
  S.players.push(p); return p;
}
function llenarBots(){
  const quiero=Math.max(S.players.filter(p=>!p.bot).length, Math.min(MAXP, S.opts.karts|0));
  while(S.players.length<quiero){
    const usados=S.players.map(p=>p.ch); let ch=PILOTOS.findIndex((x,i)=>!usados.includes(i)); if(ch<0) ch=rnd(PILOTOS.length);
    const p=addPlayer(piloto(ch).n, ch, null, null); p.bot=true; p.conn=false;
    if(S.players.filter(x=>x.name===p.name).length>1) p.name+=' '+S.players.filter(x=>x.ch===ch).length;
  }
  while(S.players.length>quiero && S.players.some(p=>p.bot)){ const i=S.players.map(p=>p.bot).lastIndexOf(true); S.players.splice(i,1); }
}
const pistaDe = () => S.opts.modo==='arena' ? (S.opts.arena==='azar' || !PISTAS[S.opts.arena] ? ORDEN_ARENAS[rnd(ORDEN_ARENAS.length)] : S.opts.arena) : S.opts.modo==='copa' ? pistasCopa(S.opts.copa, S.opts.carreras)[S.iCopa] : S.opts.pista;
function nuevaCarrera(){
  S.nCarrera++; S.phase='race'; S.res=null; S.final=false;
  let orden;
  if(S.ultimo && S.ultimo.length) orden=S.ultimo.filter(id=>P(id)).concat(S.players.filter(p=>!S.ultimo.includes(p.id)).map(p=>p.id));
  else { orden=S.players.map(p=>p.id); for(let i=orden.length-1;i>0;i--){ const j=rnd(i+1); [orden[i],orden[j]]=[orden[j],orden[i]]; } }
  const pista = S.opts.modo==='libre' && S.opts.pista==='azar' ? ORDEN_PISTAS[rnd(ORDEN_PISTAS.length)] : pistaDe();
  S.carrera={id:S.seq+'-'+S.nCarrera+'-'+Date.now().toString(36), pista, vueltas:S.opts.vueltas|0||3, ritmo:S.opts.ritmo, nivel:S.opts.nivel, objetos:S.opts.objetos!==false||S.opts.modo==='arena', modo:S.opts.modo, vidas:S.opts.vidas|0||3, tiempo:S.opts.tiempo|0||180, parrilla:orden};
}
// el anfitrión avisa cómo terminó
function cerrarCarrera(res){
  if(!S || S.phase!=='race') return;
  S.res=res.filter(r=>P(r.pid)); S.ultimo=S.res.map(r=>r.pid);
  S.res.forEach(r=>{ const p=P(r.pid); p.pts=(p.pts||0)+r.pts; r.total=p.pts; });
  S.phase='results';
  const copa=COPAS.find(c=>c.id===S.opts.copa)||COPAS[0];
  S.final = S.opts.modo==='copa' && S.iCopa>=pistasCopa(S.opts.copa, S.opts.carreras).length-1;
  const g=P(S.res[0] && S.res[0].pid); if(g) sysChat(S.carrera.modo==='arena' ? `💥 ${piloto(g.ch).e} ${g.name} ganó la batalla en ${PISTAS[S.carrera.pista].n}.` : `🏁 ${piloto(g.ch).e} ${g.name} ganó en ${PISTAS[S.carrera.pista].n}.`);
  if(S.final){ const c=S.players.slice().sort((a,b)=>b.pts-a.pts)[0]; if(c) sysChat(`🏆 ${c.name} se lleva la ${copa.n} con ${c.pts} puntos.`); }
  commit();
}

/* ---------- lo que puede hacer cada uno ---------- */
function act(pid, a){
  if(!S || !a) return;
  const p=P(pid), ob=OB(pid), host=pid===S.hostPid, quien=p||ob;
  if(!quien) return;
  const t=a.type;
  if(t==='mic' || t==='cam'){ quien[t]=!!a.on; return commit(); }
  if(t==='ch'){ if(!p || S.phase==='race') return 'El piloto se cambia antes de la carrera.'; p.ch=((a.ch|0)%PILOTOS.length+PILOTOS.length)%PILOTOS.length; p.emoji=piloto(p.ch).e; return commit(); }
  if(t==='color'){ if(!p || S.phase==='race') return; if(COLORES.includes(a.c) && !S.players.some(x=>x!==p && !x.bot && x.color===a.c)){ const otro=S.players.find(x=>x!==p && x.color===a.c); if(otro) otro.color=p.color; p.color=a.c; } return commit(); }
  if(t==='leave'){
    if(ob){ S.observers=S.observers.filter(x=>x!==ob); return commit(); }
    if(S.phase==='lobby') S.players=S.players.filter(x=>x!==p); else { p.bot=true; p.conn=false; p.token=null; p.peerId=null; }
    sysChat(`🚪 ${p.name} salió${S.phase==='lobby'?'':': un bot sigue con su kart'}.`); if(typeof alSalirJugador==='function') alSalirJugador(p.id); return commit();
  }
  if(t==='joinNext'){
    if(!ob) return;
    if(S.phase==='race') return 'Esperá que termine esta carrera para sentarte.';
    const bot=S.players.find(x=>x.bot);
    if(!bot && S.players.length>=MAXP) return 'La parrilla está llena.';
    let np;
    if(bot && S.phase!=='lobby'){ np=bot; np.bot=false; np.name=ob.name; np.token=ob.token; np.peerId=ob.peerId; np.conn=true; np.mic=ob.mic; np.cam=ob.cam; }
    else { np=addPlayer(ob.name, a.ch|0, ob.token, ob.peerId); np.mic=ob.mic; np.cam=ob.cam; }
    S.observers=S.observers.filter(x=>x!==ob);
    if(typeof onSeatChange==='function') onSeatChange(ob.id, np.id);
    sysChat(`🪑 ${np.name} se suma a la parrilla.`); return commit();
  }
  if(!host) return 'Eso lo decide el anfitrión 👑.';
  if(t==='opt'){
    if(S.phase==='race') return;
    const o=S.opts, k=a.k, v=a.v;
    if(k==='modo' && (v==='libre'||v==='copa'||v==='arena')) o.modo=v;
    else if(k==='pista' && ((PISTAS[v] && !PISTAS[v].arena)||v==='azar')) o.pista=v;
    else if(k==='arena' && ((PISTAS[v] && PISTAS[v].arena)||v==='azar')) o.arena=v;
    else if(k==='vidas') o.vidas=Math.max(1, Math.min(5, v|0));
    else if(k==='tiempo') o.tiempo=Math.max(60, Math.min(600, v|0));
    else if(k==='copa' && COPAS.some(c=>c.id===v)){ o.copa=v; }
    else if(k==='carreras' && [4,6,8].includes(v|0)) o.carreras=v|0;
    else if(k==='vueltas') o.vueltas=Math.max(1, Math.min(7, v|0));
    else if(k==='karts') o.karts=Math.max(1, Math.min(MAXP, v|0));
    else if(k==='nivel' && NIVELES.some(n=>n.id===v)) o.nivel=v;
    else if(k==='ritmo' && RITMOS.some(n=>n.id===v)) o.ritmo=v;
    else if(k==='objetos') o.objetos=!!v;
    return commit();
  }
  if(t==='start'){
    if(S.phase!=='lobby') return;
    S.players.forEach(x=>x.pts=0); S.iCopa=0; S.nCarrera=0; S.ultimo=null; S.startedAt=Date.now();
    llenarBots(); nuevaCarrera(); return commit();
  }
  if(t==='next'){
    if(S.phase!=='results') return;
    if(S.opts.modo==='copa'){ if(S.final){ S.players.forEach(x=>x.pts=0); S.iCopa=0; S.ultimo=null; const i=COPAS.findIndex(c=>c.id===S.opts.copa); S.opts.copa=COPAS[(i+1)%COPAS.length].id; } else S.iCopa++; }
    else if(S.opts.modo==='arena'){ if(a.sig){ const i=ORDEN_ARENAS.indexOf(S.carrera.pista); S.opts.arena=ORDEN_ARENAS[(i+1)%ORDEN_ARENAS.length]; } }
    else if(a.pista && (PISTAS[a.pista]||a.pista==='azar')) S.opts.pista=a.pista;
    else if(a.sig){ const i=ORDEN_PISTAS.indexOf(S.carrera.pista); S.opts.pista=ORDEN_PISTAS[(i+1)%ORDEN_PISTAS.length]; }
    llenarBots(); nuevaCarrera(); return commit();
  }
  if(t==='lobby'){
    S.players=S.players.filter(x=>!x.bot); S.players.forEach(x=>x.pts=0); S.phase='lobby'; S.carrera=null; S.res=null; S.iCopa=0; S.ultimo=null; S.final=false; return commit();
  }
  if(t==='kick'){
    const q=P(a.pid); if(!q || q.id===S.hostPid) return;
    if(typeof alEchar==='function') alEchar(q.id);
    if(S.phase==='lobby' || q.bot) S.players=S.players.filter(x=>x!==q); else { q.bot=true; q.conn=false; q.token=null; q.peerId=null; }
    sysChat(`🚪 ${q.name} fue sacado de la sala.`); if(typeof alSalirJugador==='function') alSalirJugador(q.id); return commit();
  }
}
