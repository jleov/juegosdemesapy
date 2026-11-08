/* =====================================================================
   Versículo del Día · juegospy.com/versiculo
   - Versículo del día (el mismo para todos, cambia a medianoche)
   - Versículo personal: plazo (hoy/semana/mes/año) + tema opcional
   - Biblia abierta que se hojea sola (mantener apretado y soltar / deslizar / tocar)
   - Imagen para estados de WhatsApp + link que abre el mismo versículo
   Textos: Reina-Valera 1909 (dominio público), en versiculos.js
   ===================================================================== */
(function(){
'use strict';
const $ = s => document.querySelector(s);
const MOV = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = window.VERS.v, IDS = Object.keys(V);
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
const esc = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const TEMAS = [
  {id:'todos', e:'✨', t:'Cualquiera'}, {id:'salmo', e:'🎶', t:'Un Salmo'},
  {id:'fortaleza', e:'💪', t:'Fortaleza'}, {id:'paz', e:'🕊️', t:'Paz'},
  {id:'amor', e:'❤️', t:'Amor'}, {id:'familia', e:'🏡', t:'Familia'},
  {id:'trabajo', e:'🛠️', t:'Trabajo'}, {id:'salud', e:'🌿', t:'Salud'},
  {id:'gratitud', e:'🙏', t:'Gratitud'}, {id:'esperanza', e:'🌅', t:'Esperanza'},
  {id:'perdón', e:'🤝', t:'Perdón'}, {id:'fe', e:'🕯️', t:'Fe'},
  {id:'sabiduría', e:'📜', t:'Sabiduría'}, {id:'protección', e:'🛡️', t:'Protección'},
  {id:'consuelo', e:'🤲', t:'Consuelo'}, {id:'alegría', e:'☀️', t:'Alegría'}
];
const TEMA = Object.fromEntries(TEMAS.map(t=>[t.id,t]));
const PLAZOS = [
  {id:'hoy', e:'☀️', t:'Hoy'}, {id:'semana', e:'📅', t:'La semana'},
  {id:'mes', e:'🌙', t:'El mes'}, {id:'anio', e:'✨', t:'El año'}
];
const PLAZO = Object.fromEntries(PLAZOS.map(p=>[p.id,p]));

/* ---------- reflexiones ---------- */
const NUCLEO = {
  fortaleza:['Este versículo recuerda que la fuerza no siempre se nota por fuera: muchas veces es la de seguir de pie, un paso a la vez, sabiendo que no caminás en soledad.',
    'Cuando el cansancio pesa, la Palabra no te pide que seas de hierro: te ofrece una fuerza que llega justo cuando la tuya se termina.',
    'Ser valiente no es no tener miedo, sino animarse igual, confiando en que Dios sostiene lo que vos no alcanzás a sostener.'],
  paz:['La paz de la que habla este texto no depende de que todo esté resuelto: es una calma honda que puede vivir en medio del ruido.',
    'Hay preocupaciones que no se van pensándolas más. Este versículo te invita a dejarlas en manos de Dios y respirar tranquilo.',
    'La paz empieza adentro: en una palabra suave, en un silencio a tiempo, en dejar de cargar lo que no te toca.'],
  amor:['Antes de cualquier cosa que hagas o dejes de hacer, ya sos amado. Este versículo te recuerda un amor que no se gana ni se pierde.',
    'El amor verdadero se nota en lo pequeño: en la paciencia, en el trato amable, en quedarse cuando sería más fácil irse.',
    'Dejá que este versículo te ablande el corazón: amar y dejarse amar también es una forma de fe.'],
  familia:['La familia es tierra que se riega todos los días: con un saludo, un mate compartido, una disculpa a tiempo y mucha paciencia.',
    'Este versículo pone tu casa bajo una bendición. Lo que se siembra con cariño en el hogar da fruto por generaciones.',
    'No hay familias perfectas, pero sí familias que se cuidan. La Palabra te anima a ser abrigo para los tuyos.'],
  trabajo:['El trabajo hecho con el corazón vale más que el sueldo: es servicio, es pan para la mesa, es dignidad.',
    'Este versículo te recuerda que tus esfuerzos no pasan desapercibidos. Poné tus planes en manos de Dios y hacé tu parte con ganas.',
    'La constancia de cada día, aunque parezca poca cosa, va levantando algo firme. No te desanimes por lo que todavía no ves.'],
  salud:['Este versículo es una palabra de alivio para el cuerpo y el alma. Cuidarte también es una forma de agradecer la vida que recibiste.',
    'En los días de dolor o de espera, la Palabra acompaña: no lo vivís en soledad, y hay un Dios que sana y consuela.',
    'Un corazón alegre, un buen descanso y manos que ayudan también son medicina. Que este versículo te traiga ánimo y confianza.'],
  gratitud:['Dar gracias cambia la mirada: lo que parecía poco empieza a verse como regalo. Este versículo te invita a contar tus bendiciones.',
    'Hay mucho por agradecer, incluso en los días comunes: el pan de cada día, la gente que te quiere, una nueva mañana.',
    'La gratitud no niega las dificultades, pero no deja que ellas tengan la última palabra.'],
  esperanza:['Este versículo es una ventana abierta: lo que hoy parece cerrado no es el final de tu historia.',
    'La esperanza no es ingenuidad: es confiar en que Dios sigue obrando aunque todavía no veas el resultado.',
    'Después de la noche llega la mañana. Que esta palabra te ayude a esperar con paciencia y con el corazón despierto.'],
  'perdón':['El perdón es un regalo que libera primero a quien lo da. Este versículo te recuerda que siempre hay camino para volver a empezar.',
    'Nadie está tan lejos que no pueda ser abrazado de nuevo. La misericordia de Dios es más grande que cualquier error.',
    'Perdonar no es olvidar ni justificar: es dejar de cargar una piedra que te lastima. Paso a paso, se puede.'],
  fe:['La fe es como una semilla: chiquita al principio, pero capaz de crecer y sostenerte en los tiempos difíciles.',
    'Este versículo te invita a confiar más allá de lo que ves. A veces el camino se ilumina recién cuando das el primer paso.',
    'Creer no es tener todas las respuestas, sino caminar de la mano de Quien sí las tiene.'],
  'sabiduría':['La sabiduría empieza por escuchar: a Dios, a quienes te quieren bien y a tu propia conciencia. Este versículo es una buena brújula.',
    'Antes de decidir, detenete un momento. La Palabra ilumina el próximo paso, aunque no muestre todo el camino.',
    'Saber mucho no es lo mismo que vivir sabiamente. Este versículo te invita a elegir con el corazón y con la cabeza.'],
  'protección':['Este versículo es un refugio: un lugar donde descansar cuando afuera sopla fuerte el viento.',
    'No estás desamparado. La Palabra promete un cuidado que te acompaña al salir y al volver a casa.',
    'Que esta palabra sea como un manto sobre vos y los tuyos: Dios guarda, cuida y no se duerme.'],
  consuelo:['Si tu corazón está cansado o triste, este versículo es un abrazo. Está bien llorar: no tenés que atravesarlo en soledad.',
    'Dios está cerca de los que tienen el corazón quebrantado. Esta palabra llega para acompañarte, sin apuro.',
    'Hay heridas que sanan despacio. Que este versículo te dé un poco de alivio y la certeza de días más livianos.'],
  'alegría':['La alegría que nace de la fe no depende de que todo salga perfecto: es un gozo sereno que se puede compartir.',
    'Este versículo te invita a celebrar: hay motivos para cantar, para reír y para disfrutar de lo bueno que tenés.',
    'Dejá que esta palabra te saque una sonrisa. La alegría también es una forma de dar gracias.'],
  salmo:['Los Salmos son oraciones hechas canto: tienen palabras para la alegría, el miedo, la gratitud y la espera. Este es para vos.',
    'Este Salmo se rezó y se cantó durante siglos. Leelo despacio, en voz baja, como quien conversa con Dios.',
    'Dejá que este Salmo sea tu oración: no hace falta agregarle nada, solo hacerlo tuyo.']
};
const PARA = {
  hoy:['Para hoy: llevá esta frase con vos. Leela otra vez al mediodía y antes de dormir, y fijate qué te dice en cada momento.',
    'Hoy es un buen día para vivir esta palabra en algo concreto, por pequeño que sea.',
    'Que este versículo te acompañe durante todo el día como una lucecita en el bolsillo.'],
  semana:['Para esta semana: escribilo en un papel o ponelo de fondo en el celular, y volvé a leerlo cada mañana.',
    'En los próximos siete días, buscá una ocasión para vivir esta palabra con alguien cercano.',
    'Que esta semana tenga el ritmo de este versículo: un poco de pausa, un poco de confianza y mucho corazón.'],
  mes:['Para {mes}: que sea tu versículo de cabecera. Cada semana leelo en voz alta y pensá qué fue cambiando en vos.',
    'A lo largo de {mes}, dejá que esta palabra eche raíces sin apuro, como una planta que crece despacio.',
    'Proponete para {mes} un gesto concreto que nazca de este versículo y sostenelo hasta fin de mes.'],
  anio:['Para el {anio}: que este sea tu versículo del año. Guardalo donde lo veas seguido y vas a notar cómo te acompaña en cada etapa.',
    'Un año entero da para mucho: alegrías, desafíos y sorpresas. Que esta palabra sea el hilo que lo una todo.',
    'Al terminar el {anio}, volvé a leer este versículo y mirá hacia atrás: seguro vas a encontrar sus huellas en tu camino.']
};
const ORA = {
  fortaleza:['Dios, cuando me falten las fuerzas, sé mi fuerza. Que no me rinda y que sepa pedir ayuda.','Dame valor para lo que tengo por delante y paz para lo que no puedo cambiar.'],
  paz:['Señor, calmá mi corazón y mis pensamientos. Que tu paz llegue a mi casa y a los que quiero.','Enseñame a soltar lo que me inquieta y a descansar en tu cuidado.'],
  amor:['Gracias, Dios, por amarme como soy. Ayudame a amar con paciencia y ternura.','Que mis palabras y mis gestos sean reflejo de tu amor.'],
  familia:['Bendecí, Señor, a mi familia: a los que están cerca y a los que están lejos. Que en casa haya respeto, abrazos y perdón.','Cuidá a los míos y haceme instrumento de unión en mi hogar.'],
  trabajo:['Dios, bendecí el trabajo de mis manos. Que nunca falte el pan y que sepa compartirlo.','Dame constancia, buen ánimo y sabiduría para hacer bien lo que me toca.'],
  salud:['Señor, cuidá mi cuerpo y mi alma. Acompañá a los enfermos y a quienes los cuidan.','Dame paciencia en la espera, alivio en el dolor y gratitud por cada día de vida.'],
  gratitud:['Gracias, Dios, por todo lo que me das, por lo grande y por lo pequeño.','Que nunca me acostumbre a tus regalos y sepa decir gracias cada día.'],
  esperanza:['Señor, renová mi esperanza. Que no me gane el desánimo y sepa esperar tus tiempos.','Abrí caminos donde yo no los veo y dame ojos para descubrirlos.'],
  'perdón':['Dios, perdoná mis errores y dame un corazón capaz de perdonar.','Saná las heridas que todavía me duelen y ayudame a empezar de nuevo.'],
  fe:['Señor, aumentá mi fe. Que confíe en vos aun cuando no entienda.','Caminá conmigo y no me soltés de la mano.'],
  'sabiduría':['Dios, dame sabiduría para decidir bien y humildad para escuchar consejos.','Iluminá mis pasos y que mis palabras siempre construyan.'],
  'protección':['Señor, cuidame al salir y al volver. Protegé a mi familia de todo mal.','Sé mi refugio y mi escudo; que bajo tu sombra encuentre descanso.'],
  consuelo:['Dios, consolá mi corazón y abrazame en este momento.','Secá mis lágrimas y dame la paz que solo vos podés dar.'],
  'alegría':['Gracias, Señor, por la alegría. Que sepa contagiarla a quienes me rodean.','Llená mi corazón de gozo y mi boca de canto.'],
  salmo:['Que este Salmo sea mi oración y que mi vida entera sea una canción de gratitud.','Señor, recibí estas palabras como mías: con ellas te hablo y te escucho.']
};

function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const elegir = (arr, r) => arr[Math.floor(r()*arr.length)];
function fechaTxt(d){ return `${d.getDate()}${d.getDate()===1?'º':''} de ${MESES[d.getMonth()]}`; }
function fechaCod(d){ return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); }
function deCod(c){ const m=/^(\d{4})(\d{2})(\d{2})$/.exec(c||''); return m ? new Date(+m[1], +m[2]-1, +m[3], 12) : null; }
function semanaDe(d){ const l=new Date(d); const k=(l.getDay()+6)%7; l.setDate(l.getDate()-k); const f=new Date(l); f.setDate(l.getDate()+6); return [l,f]; }
function cuandoTxt(p, d){
  if(p==='hoy') return `para hoy, ${DIAS[d.getDay()]} ${fechaTxt(d)}`;
  if(p==='semana'){ const [a,b]=semanaDe(d); return a.getMonth()===b.getMonth() ? `para la semana del ${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}` : `para la semana del ${fechaTxt(a)} al ${fechaTxt(b)}`; }
  if(p==='mes') return `para el mes de ${MESES[d.getMonth()]}`;
  return `para el año ${d.getFullYear()}`;
}
function cuandoCorto(p, d){ return p==='hoy'?'para hoy':p==='semana'?'para esta semana':p==='mes'?`para ${MESES[d.getMonth()]}`:`para el ${d.getFullYear()}`; }

/* arma todo lo que se muestra a partir de los datos del link (o de una consulta nueva) */
function armar(o){
  const v = V[o.i]; if(!v) return null;
  const fecha = deCod(o.f) || new Date();
  const r = mulberry(o.k>>>0 || 1);
  const tema = TEMA[o.t] && o.t!=='todos' ? o.t : (v[2] || 'fe');
  const temaRefl = NUCLEO[tema] ? tema : 'fe';
  const nucleo = elegir(NUCLEO[temaRefl], r);
  const para = elegir(PARA[o.p]||PARA.hoy, r).replace('{mes}', MESES[fecha.getMonth()]).replace('{anio}', fecha.getFullYear());
  const ora = elegir(ORA[temaRefl], r);
  return {o, id:o.i, cita:v[0], txt:v[1], tema, temaRefl, fecha, nombre:(o.n||'').trim().slice(0,30), plazo:o.p||'hoy', dia:!!o.d, nucleo, para, ora};
}

/* ---------- versículo del día ---------- */
function delDia(d){
  const cod = fechaCod(d);
  // recorrido sin repetir en un ciclo: permutación fija de todos los versículos
  const r = mulberry(hashStr('versiculo-del-dia'));
  const orden = IDS.slice(); for(let i=orden.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [orden[i],orden[j]]=[orden[j],orden[i]]; }
  const n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())/864e5);
  const id = orden[((n % orden.length)+orden.length) % orden.length];
  return armar({i:id, p:'hoy', t:'todos', k:hashStr('dia'+cod), f:cod, d:1});
}

/* ---------- estado y formulario ---------- */
let D = {nombre:'', plazo:'hoy', tema:'todos'};
try{ Object.assign(D, JSON.parse(localStorage.getItem('ver_datos')||'{}')); }catch(e){}
if(!PLAZO[D.plazo]) D.plazo='hoy'; if(!TEMA[D.tema]) D.tema='todos';
function guardar(){ try{ localStorage.setItem('ver_datos', JSON.stringify(D)); }catch(e){} }
function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('on'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('on'), 2600); }
function ir(id){ document.querySelectorAll('.pant').forEach(p=>p.classList.toggle('on', p.id===id)); window.scrollTo(0,0); }

$('#fNombre').value = D.nombre||'';
$('#fNombre').oninput = e=>{ D.nombre = e.target.value; guardar(); };
$('#plazos').innerHTML = PLAZOS.map(p=>`<button class="opt" data-p="${p.id}"><span class="e">${p.e}</span><b>${p.t}</b></button>`).join('');
$('#temas').innerHTML = TEMAS.map(t=>`<button class="opt" data-t="${t.id}"><span class="e">${t.e}</span><b>${t.t}</b></button>`).join('');
function marcar(){
  document.querySelectorAll('#plazos .opt').forEach(b=>b.classList.toggle('sel', b.dataset.p===D.plazo));
  document.querySelectorAll('#temas .opt').forEach(b=>b.classList.toggle('sel', b.dataset.t===D.tema));
  $('#vistaPlazo').textContent = cap(cuandoTxt(D.plazo, new Date()));
}
$('#plazos').onclick = e=>{ const b=e.target.closest('.opt'); if(!b) return; D.plazo=b.dataset.p; guardar(); marcar(); sonido.toque(); };
$('#temas').onclick = e=>{ const b=e.target.closest('.opt'); if(!b) return; D.tema=b.dataset.t; guardar(); marcar(); sonido.toque(); };
marcar();

let hoyR = null;
function pintarDia(){
  const d = new Date(); hoyR = delDia(d);
  $('#dia').innerHTML = `<h3>✦ Versículo del día ✦</h3><div class="fec">${cap(DIAS[d.getDay()])} ${fechaTxt(d)} de ${d.getFullYear()}</div>
    <blockquote>${esc(hoyR.txt)}</blockquote><div class="cita">${esc(hoyR.cita)}</div>
    <p class="refl">${esc(hoyR.nucleo)}</p>
    <div class="acciones"><button class="btn" id="diaCompartir">📤 Compartir</button><button class="btn sec" id="diaCopiar">📋 Copiar</button></div>`;
  $('#diaCompartir').onclick = ()=>compartir(hoyR);
  $('#diaCopiar').onclick = ()=>copiar(hoyR);
}
pintarDia();
// si la página queda abierta y pasa la medianoche, se actualiza
setInterval(()=>{ if(hoyR && fechaCod(new Date())!==hoyR.o.f) pintarDia(); }, 60000);

/* ---------- la Biblia: páginas ---------- */
const LIBROS_AT = ['Génesis','Éxodo','Rut','1 Samuel','Salmos','Proverbios','Eclesiastés','Isaías','Jeremías','Miqueas'];
const LIBROS_NT = ['Mateo','Marcos','Lucas','Juan','Hechos','Romanos','1 Corintios','Efesios','Filipenses','Hebreos'];
let numPag = 400 + Math.floor(Math.random()*300);
function paginaFalsa(n){
  const lib = (n<700 ? LIBROS_AT : LIBROS_NT)[Math.floor(n/37)%10];
  return `<div class="lineas"><div class="tit">${lib.toUpperCase()}</div><div class="col"></div></div><span class="num">${n}</span>`;
}
function libroDe(cita){ return cita.replace(/\s+\d+:[\d-]+$/,''); }
function paginaVerso(R){
  return `<div class="verso"><div class="ref">${esc(R.cita)}</div><div class="tx"><mark>${esc(R.txt)}</mark></div></div><span class="num">${numPag+1}</span>`;
}
function paginaTitulo(R){
  const lib = libroDe(R.cita), c = R.cita.match(/(\d+):/)[1];
  return `<div class="lineas"><div class="tit" style="font-size:clamp(11px,3.4vw,20px);margin:8% 0 3%">${esc(lib.toUpperCase())}</div>
    <div class="tit" style="font-size:clamp(8px,2vw,12px);color:#9a7a48;margin-bottom:8%">${lib==='Salmos'?'SALMO':'CAPÍTULO'} ${c}</div><div class="col"></div></div><span class="num">${numPag}</span>`;
}
function libroInicial(){ $('#pIzq').innerHTML = paginaFalsa(numPag); $('#pDer').innerHTML = paginaFalsa(numPag+1); }

/* una hoja que pasa de derecha a izquierda */
let hojasVivas = 0;
function pasarHoja(dur, siguienteDer, siguienteIzq){
  const libro = $('#libro'), h = document.createElement('div');
  h.className = 'hoja';
  h.innerHTML = `<div class="f">${$('#pDer').innerHTML}<div class="sombra"></div></div><div class="d">${siguienteIzq}<div class="sombra"></div></div>`;
  libro.appendChild(h);
  $('#pDer').innerHTML = siguienteDer;   // lo que queda debajo de la hoja que se levanta
  hojasVivas++;
  const fin = ()=>{ $('#pIzq').innerHTML = siguienteIzq; h.remove(); hojasVivas--; };
  if(!MOV || !h.animate){ fin(); return Promise.resolve(); }
  const curva = 'cubic-bezier(.45,.05,.35,1)';
  const a = h.animate([
    {transform:'rotateY(0deg)'},
    {transform:'rotateY(-90deg) skewY(-2deg)', offset:.5},
    {transform:'rotateY(-180deg)'}
  ], {duration:dur, easing:curva, fill:'forwards'});
  h.querySelectorAll('.sombra').forEach(s=>s.animate([{opacity:0},{opacity:.9,offset:.5},{opacity:0}], {duration:dur, easing:curva}));
  return a.finished.then(fin, fin);
}

/* ---------- el hojeo con el gesto ---------- */
let R = null, estado = 'quieto', vel = 0, acum = 0, apretado = false, tIni = 0, xIni = 0, xUlt = 0, tUlt = 0, freno = 1.2, ultimoT = 0, corrida = 0;
const VMAX = 15;
function msg(h){ const m=$('#msg'); m.style.opacity=0; setTimeout(()=>{ m.innerHTML=h; m.style.opacity=1; }, 160); }

function nuevaConsulta(){
  // elige el versículo de antemano (al azar, sin repetir el último)
  const pool = D.tema==='todos' ? IDS : (window.VERS.temas[D.tema]||IDS);
  let ult=''; try{ ult = localStorage.getItem('ver_ult')||''; }catch(e){}
  let id; for(let n=0;n<6;n++){ id = pool[Math.floor(Math.random()*pool.length)]; if(id!==ult) break; }
  try{ localStorage.setItem('ver_ult', id); }catch(e){}
  const k = (crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.random()*4294967296)>>>0;
  return armar({i:id, p:D.plazo, t:D.tema, k, f:fechaCod(new Date()), n:(D.nombre||'').trim().slice(0,30)});
}
function cabecera(R){
  const tit = R.dia ? '✦ Versículo del día ✦' : R.nombre ? `El versículo de ${esc(R.nombre)}` : 'Tu versículo';
  const t = TEMA[R.o.t] && R.o.t!=='todos' ? `${TEMA[R.o.t].e} ${TEMA[R.o.t].t} · ` : '';
  $('#cab').innerHTML = `<h2>${tit}</h2><p>${t}${cap(R.dia ? `${DIAS[R.fecha.getDay()]} ${fechaTxt(R.fecha)} de ${R.fecha.getFullYear()}` : cuandoTxt(R.plazo, R.fecha))}</p>`;
}
function empezar(){
  corrida++;
  R = nuevaConsulta();
  verModo(false);
  cabecera(R);
  $('#res').innerHTML=''; $('#finBtns').classList.add('oculto');
  const esc_ = $('#escena'); esc_.classList.remove('fin','luz');
  libroInicial();
  estado='listo'; vel=0; acum=0;
  msg(R.nombre ? `${esc(R.nombre)}, pensá en lo que llevás en el corazón…` : 'Pensá en lo que llevás en el corazón…');
  $('#gesto').style.opacity=1;
  $('#gesto').textContent = matchMedia('(pointer:coarse)').matches ? 'Mantené apretada la Biblia y soltá · o deslizá la página' : 'Mantené apretado el clic y soltá · o arrastrá la página';
  ir('pBiblia');
}
$('#btnAbrir').onclick = ()=>{ sonido.toque(); empezar(); };
$('#btnOtra').onclick = ()=>{ sonido.toque(); empezar(); };
$('#btnVolver').onclick = ()=>{ corrida++; sonido.toque(); estado='quieto'; ir('pInicio'); };

const libroEl = $('#libro');
function abajo(x){
  if(estado!=='listo' && estado!=='frenando') return;
  const yaCorria = estado==='frenando';
  apretado = true; estado = 'girando'; tIni = tUlt = performance.now(); xIni = xUlt = x;
  if(vel < 2) vel = 2;
  $('#escena').classList.add('apretando'); $('#gesto').style.opacity=0;
  msg('Las páginas corren… soltá cuando sientas que es el momento');
  if(!yaCorria) bucle();
}
function arriba(x){
  if(!apretado) return; apretado = false;
  $('#escena').classList.remove('apretando');
  const ahora = performance.now(), dt = Math.max(16, ahora - tUlt), v = (xUlt - x)/dt;   // px/ms hacia la izquierda
  const dur = ahora - tIni, dx = xIni - x;
  if(dx > 40 || v > .4) vel = Math.min(VMAX, Math.max(vel, 6 + Math.abs(v)*10));       // deslizar: más fuerte, más rápido
  else if(dur < 280) vel = Math.max(vel, 7 + Math.random()*4);                          // un toque
  vel = Math.max(vel, 5.5);
  freno = .55 + Math.random()*.35;        // cuánto tarda en frenar (aleatorio)
  estado = 'frenando';
  msg('Va frenando…');
}
libroEl.addEventListener('pointerdown', e=>{ e.preventDefault(); try{ libroEl.setPointerCapture(e.pointerId); }catch(_){} abajo(e.clientX); });
libroEl.addEventListener('pointermove', e=>{ if(!apretado) return; const t=performance.now(); if(t-tUlt>30){ xUlt=e.clientX; tUlt=t; } });
libroEl.addEventListener('pointerup', e=>arriba(e.clientX));
libroEl.addEventListener('pointercancel', e=>arriba(e.clientX));
libroEl.addEventListener('lostpointercapture', e=>{ if(apretado) arriba(e.clientX); });
libroEl.addEventListener('contextmenu', e=>e.preventDefault());
libroEl.addEventListener('keydown', e=>{
  if(e.key!=='Enter' && e.key!==' ') return; e.preventDefault();
  if(estado==='listo'){ abajo(0); setTimeout(()=>arriba(0), 120); }
});

function bucle(){
  const mi = corrida; ultimoT = performance.now();
  const paso = t=>{
    if(mi!==corrida || (estado!=='girando' && estado!=='frenando')) return;
    const dt = Math.min(.1, (t-ultimoT)/1000); ultimoT = t;
    if(estado==='girando'){
      if(apretado) vel += (VMAX - vel) * (1 - Math.exp(-dt*1.1));   // mientras más tiempo apretado, más rápido
      $('#medidor i').style.width = Math.round(vel/VMAX*100)+'%';
    } else {
      vel *= Math.exp(-dt*freno);
      if(vel < 1.5){ ultimaHoja(mi); return; }
    }
    acum += vel*dt;
    if(acum >= 1 && hojasVivas < 9){
      acum -= 1; numPag += 2;
      const dur = Math.max(230, Math.min(1000, 1700/vel));
      pasarHoja(dur, paginaFalsa(numPag+1), paginaFalsa(numPag));
      sonido.hoja(Math.min(1, 3/vel+.25));
    }
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
async function ultimaHoja(mi){
  estado = 'revelando'; numPag += 2;
  sonido.hoja(1);
  await pasarHoja(1300, paginaVerso(R), paginaTitulo(R));
  if(mi!==corrida) return;
  revelar(mi);
}
function revelar(mi){
  const esc_ = $('#escena'); esc_.classList.add('fin','luz');
  sonido.revelar();
  setTimeout(()=>{ const vs = $('#pDer .verso'); if(vs) vs.classList.add('ve'); }, 60);
  chispas($('#pDer'));
  msg(R.nombre ? `Este es el versículo para ${esc(R.nombre)} ✦` : 'Este es tu versículo ✦');
  setTimeout(()=>{ if(mi===corrida) mostrarResultado(R, true); }, MOV?900:0);
  estado = 'fin';
}
function chispas(el){
  if(!MOV) return;
  const esc_ = $('#escena'), rb = el.getBoundingClientRect(), re = esc_.getBoundingClientRect();
  for(let i=0;i<22;i++){
    const c=document.createElement('div'); c.className='chispa'; esc_.appendChild(c);
    const x = rb.left-re.left + rb.width*(.2+Math.random()*.6), y = rb.top-re.top + rb.height*(.3+Math.random()*.4);
    const ang = Math.random()*6.283, d = 40+Math.random()*90;
    c.animate([{transform:`translate(${x}px,${y}px) scale(1)`,opacity:1},{transform:`translate(${x+Math.cos(ang)*d}px,${y+Math.sin(ang)*d-30}px) scale(.2)`,opacity:0}],
      {duration:900+Math.random()*700, easing:'cubic-bezier(.2,.7,.3,1)'}).finished.then(()=>c.remove(), ()=>c.remove());
  }
}

function mostrarResultado(R, animar, bajar=true){
  const T = TEMA[R.tema] || TEMA.fe;
  $('#res').innerHTML = `<div class="box">
    <div class="tema anim">${T.e} ${R.tema==='salmo'?'Un Salmo':T.t} · ${R.dia?'Versículo del día':cuandoCorto(R.plazo, R.fecha)}</div>
    <blockquote class="anim">${esc(R.txt)}</blockquote>
    <div class="cita anim">${esc(R.cita)}</div>
    <div class="sep anim">✦ ✦ ✦</div>
    <div class="refl"><p class="anim">${esc(R.nucleo)}</p><p class="anim">${esc(R.para)}</p>
      <p class="ora anim"><b>Para llevar en el corazón</b>${esc(R.ora)}</p></div></div>`;
  const els = [...$('#res').querySelectorAll('.anim')];
  if(!animar || !MOV) els.forEach(e=>e.classList.add('ve'));
  else els.forEach((e,i)=>setTimeout(()=>e.classList.add('ve'), 150+i*260));
  $('#finBtns').classList.toggle('oculto', $('#app').classList.contains('ver'));
  if(animar && bajar) setTimeout(()=>{ const b=$('#res .box'); if(b && b.getBoundingClientRect().top > innerHeight*.7) b.scrollIntoView({behavior:MOV?'smooth':'auto', block:'start'}); }, 700);
}

/* ---------- compartir ---------- */
function b64url(str){ return btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function desdeB64url(b){ b=b.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='='; return new TextDecoder().decode(Uint8Array.from(atob(b), ch=>ch.charCodeAt(0))); }
function linkDe(R){
  const base = /^https:/.test(location.protocol) && !/localhost|127\.0\.0\.1/.test(location.hostname) ? location.origin+location.pathname : 'https://juegospy.com/versiculo/';
  const o = {i:R.o.i, p:R.o.p, t:R.o.t, k:R.o.k>>>0, f:R.o.f}; if(R.o.n) o.n=R.o.n; if(R.o.d) o.d=1;
  return base + '?v=' + b64url(JSON.stringify(o));
}
function textoDe(R){
  const quien = R.dia ? `📖 Versículo del día · ${fechaTxt(R.fecha)}` : `📖 ${R.nombre?`El versículo de ${R.nombre}`:'Mi versículo'} ${cuandoCorto(R.plazo, R.fecha)}`;
  return `${quien}\n\n“${R.txt}”\n— ${R.cita} (Reina-Valera 1909)\n\n${R.nucleo}`;
}
async function copiar(R){
  sonido.toque();
  const t = textoDe(R)+'\n\nPedí el tuyo: '+linkDe(R);
  try{ await navigator.clipboard.writeText(t); toast('Texto copiado ✦ Pegalo donde quieras'); }
  catch(e){
    const ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); toast('Texto copiado ✦'); }catch(_){ toast('No se pudo copiar 😕'); }
    ta.remove();
  }
}
function partir(ctx, txt, ancho){
  const out=[]; let lin='';
  for(const w of txt.split(/\s+/)){ const p = lin ? lin+' '+w : w; if(ctx.measureText(p).width>ancho && lin){ out.push(lin); lin=w; } else lin=p; }
  if(lin) out.push(lin); return out;
}
async function hacerImagen(R){
  const W=1080, H=1920, cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const x=cv.getContext('2d');
  try{ await Promise.all(['700 40px Cinzel','italic 600 40px "Cormorant Garamond"','500 40px "Cormorant Garamond"','italic 500 40px "Cormorant Garamond"'].map(f=>document.fonts.load(f))); }catch(e){}
  const CIN='Cinzel,Georgia,serif', COR='"Cormorant Garamond",Georgia,serif', G='#e9c46a', GL='#fff0c2', SU='#d8ccb4';
  // fondo: amanecer cálido sobre la noche
  let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#5a3f22'); g.addColorStop(.28,'#33294a'); g.addColorStop(.7,'#171a33'); g.addColorStop(1,'#0a0c1a');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  g=x.createRadialGradient(W/2,-80,40,W/2,-80,1100); g.addColorStop(0,'rgba(255,214,140,.55)'); g.addColorStop(1,'rgba(255,214,140,0)');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  // rayos de luz
  x.save(); x.translate(W/2,-120); x.globalCompositeOperation='lighter';
  for(let i=-6;i<=6;i++){ x.save(); x.rotate(i*.11); const gr=x.createLinearGradient(0,0,0,1500); gr.addColorStop(0,'rgba(255,225,160,.16)'); gr.addColorStop(1,'rgba(255,225,160,0)');
    x.fillStyle=gr; x.beginPath(); x.moveTo(-14,0); x.lineTo(14,0); x.lineTo(70,1500); x.lineTo(-70,1500); x.closePath(); x.fill(); x.restore(); }
  x.restore();
  // polvo dorado
  let s=(R.o.k>>>0)||7; const rr=()=>((s=Math.imul(s^s>>>15,2246822507)+0x6D2B79F5|0)>>>0)/4294967296;
  for(let i=0;i<160;i++){ x.globalAlpha=.15+rr()*.6; x.fillStyle=rr()<.4?GL:'#fff'; x.beginPath(); x.arc(rr()*W, rr()*H, rr()*2.4+.4, 0, 6.283); x.fill(); }
  x.globalAlpha=1;
  // marco
  x.strokeStyle='rgba(233,196,106,.55)'; x.lineWidth=3; x.strokeRect(34,34,W-68,H-68);
  x.strokeStyle='rgba(233,196,106,.22)'; x.lineWidth=1.5; x.strokeRect(48,48,W-96,H-96);
  x.textAlign='center'; x.textBaseline='alphabetic';
  // librito abierto
  x.save(); x.translate(W/2, 205); x.scale(1.6,1.6);
  x.fillStyle=GL; x.shadowColor='rgba(233,196,106,.7)'; x.shadowBlur=24;
  x.beginPath(); x.moveTo(0,-20); x.bezierCurveTo(-12,-28,-34,-30,-50,-26); x.lineTo(-50,20); x.bezierCurveTo(-34,16,-12,18,0,26); x.bezierCurveTo(12,18,34,16,50,20); x.lineTo(50,-26); x.bezierCurveTo(34,-30,12,-28,0,-20); x.fill();
  x.shadowBlur=0; x.strokeStyle='#8a6420'; x.lineWidth=1.4; x.beginPath(); x.moveTo(0,-20); x.lineTo(0,26); x.stroke();
  x.restore();
  // título
  x.shadowColor='rgba(233,196,106,.55)'; x.shadowBlur=22; x.fillStyle=GL; x.font=`700 54px ${CIN}`;
  x.fillText(R.dia ? 'VERSÍCULO DEL DÍA' : 'UNA PALABRA PARA VOS', W/2, 330); x.shadowBlur=0;
  x.fillStyle=SU; x.font=`italic 500 42px ${COR}`;
  const sub = R.dia ? cap(`${DIAS[R.fecha.getDay()]} ${fechaTxt(R.fecha)} de ${R.fecha.getFullYear()}`)
    : (R.nombre ? `${R.nombre}, ${cuandoCorto(R.plazo, R.fecha)}` : cap(cuandoTxt(R.plazo, R.fecha)));
  let y = 392; for(const l of partir(x, sub, W-200).slice(0,2)){ x.fillText(l, W/2, y); y+=48; }
  x.fillStyle=G; x.font=`700 26px ${CIN}`; x.fillText('✦   ✦   ✦', W/2, y+8);
  // el versículo: busca el tamaño que entra
  const top = y + 70, fondo = H - 560, alto = fondo - top;
  let fs = 74, lin, lh;
  for(; fs>=34; fs-=2){ x.font=`italic 600 ${fs}px ${COR}`; lin = partir(x, `“${R.txt}”`, W-210); lh = fs*1.28; if(lin.length*lh <= alto) break; }
  const bloque = lin.length*lh; let yy = top + (alto - bloque)/2 + fs*.9;
  x.fillStyle='#fffaf0'; x.shadowColor='rgba(0,0,0,.35)'; x.shadowBlur=10;
  lin.forEach(l=>{ x.fillText(l, W/2, yy); yy+=lh; }); x.shadowBlur=0;
  // cita
  x.fillStyle=G; x.font=`700 50px ${CIN}`; x.shadowColor='rgba(233,196,106,.5)'; x.shadowBlur=16;
  x.fillText(R.cita, W/2, fondo + 92); x.shadowBlur=0;
  // reflexión corta
  x.font=`italic 500 36px ${COR}`; x.fillStyle=SU;
  const rl = partir(x, R.nucleo, W-240).slice(0,3); let ry = fondo + 170;
  rl.forEach(l=>{ x.fillText(l, W/2, ry); ry+=44; });
  // pie
  x.fillStyle='#fff'; x.font=`italic 500 40px ${COR}`; x.fillText('Pedí tu versículo en', W/2, H-178);
  x.shadowColor='rgba(233,196,106,.6)'; x.shadowBlur=18; x.fillStyle=G; x.font=`700 54px ${CIN}`; x.fillText('juegospy.com/versiculo', W/2, H-112); x.shadowBlur=0;
  x.fillStyle='rgba(216,204,180,.5)'; x.font=`500 24px ${COR}`; x.fillText('Reina-Valera 1909 · dominio público', W/2, H-68);
  return new Promise(ok=>cv.toBlob(ok, 'image/png'));
}
function cerrarModal(){ $('#modal').classList.remove('on'); }
$('#modal').onclick = e=>{ if(e.target.id==='modal') cerrarModal(); };
async function compartir(R){
  if(!R) return;
  sonido.toque();
  const link = linkDe(R), texto = textoDe(R);
  $('#modalIn').innerHTML = `<h3>Compartí este versículo</h3><p class="otra">Preparando la imagen…</p>`;
  $('#modal').classList.add('on');
  if(!R.img){ try{ R.img = await hacerImagen(R); }catch(e){ R.img=null; } }
  if(!$('#modal').classList.contains('on')) return;
  const archivo = R.img ? new File([R.img], 'versiculo.png', {type:'image/png'}) : null;
  const puedeArchivo = !!(archivo && navigator.canShare && navigator.canShare({files:[archivo]}));
  const urlImg = R.img ? URL.createObjectURL(R.img) : '';
  $('#modalIn').innerHTML = `<h3>Compartí este versículo</h3>
    ${R.img?`<img class="prev" src="${urlImg}" alt="Imagen del versículo">`:''}
    <p class="otra">Subilo a tu estado de WhatsApp o mandalo a quien lo necesite. Con el link, quien lo abra ve el mismo versículo ✦</p>
    <div class="acciones">
      ${puedeArchivo?`<button class="btn" id="shImg">📲 Compartir imagen</button>`:''}
      ${R.img?`<button class="btn${puedeArchivo?' sec':''}" id="shBaja">⬇️ Guardar imagen</button>`:''}
      <button class="btn sec" id="shLink">🔗 ${navigator.share?'Compartir link':'Copiar link'}</button>
      <button class="btn sec" id="shTxt">📋 Copiar texto</button>
    </div>
    <button class="btn sec" id="cerrarModal" style="margin-top:6px">Cerrar</button>`;
  $('#cerrarModal').onclick = cerrarModal;
  $('#shTxt').onclick = ()=>copiar(R);
  if(puedeArchivo) $('#shImg').onclick = async ()=>{
    try{ await navigator.share({files:[archivo], title:'Versículo', text:texto+'\n\n'+link}); }
    catch(e){ if(!e || e.name!=='AbortError') toast('No se pudo compartir 😕 Probá guardando la imagen'); }
  };
  if(R.img) $('#shBaja').onclick = ()=>{
    const a=document.createElement('a'); a.href=urlImg; a.download='versiculo.png'; document.body.appendChild(a); a.click(); a.remove();
    toast('Imagen guardada ✦ Ya la podés subir a tu estado');
  };
  $('#shLink').onclick = async ()=>{
    try{ if(navigator.share){ await navigator.share({title:'Un versículo para vos', text:texto, url:link}); return; } }
    catch(e){ if(e && e.name==='AbortError') return; }
    try{ await navigator.clipboard.writeText(texto+'\n\n'+link); toast('Link copiado ✦ Pegalo donde quieras'); }
    catch(e){ toast('No se pudo copiar 😕'); }
  };
}
$('#btnCompartir').onclick = ()=>compartir(R);
$('#btnCopiar').onclick = ()=>copiar(R);

/* ---------- abrir un versículo compartido ---------- */
function verModo(on){
  $('#app').classList.toggle('ver', on);
  $('#verBtns').classList.toggle('oculto', !on);
  if(on) $('#finBtns').classList.add('oculto');
}
function abrirCompartido(){
  let o; try{ const q = new URLSearchParams(location.search).get('v'); if(!q) return false; o = JSON.parse(desdeB64url(q)); }catch(e){ return false; }
  if(!o || !V[o.i] || !PLAZO[o.p] || !TEMA[o.t]) return false;
  R = armar(o); if(!R) return false;
  corrida++; estado = 'fin';
  verModo(true);
  cabecera(R);
  $('#pIzq').innerHTML = paginaTitulo(R); $('#pDer').innerHTML = paginaVerso(R);
  $('#escena').classList.add('fin','luz'); $('#gesto').style.opacity=0;
  setTimeout(()=>{ const vs=$('#pDer .verso'); if(vs) vs.classList.add('ve'); }, 400);
  $('#msg').innerHTML = R.dia ? 'Una palabra para este día ✦' : R.nombre ? `Un versículo para ${esc(R.nombre)} ✦` : 'Alguien te compartió este versículo ✦';
  mostrarResultado(R, true, false);
  ir('pBiblia');
  document.title = `${R.cita} · Versículo del Día`;
  return true;
}
$('#btnMio').onclick = ()=>{
  sonido.toque(); verModo(false);
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
  document.title = 'Versículo del Día: tu versículo de la Biblia para hoy, la semana, el mes o el año | Juegos PY';
  estado='quieto'; ir('pInicio');
};

/* ---------- fondo: luz cálida y polvo dorado que flota ---------- */
(function cielo(){
  const cv=$('#cielo'), ctx=cv.getContext('2d'); let W,H,ps=[],dpr=1;
  function tam(){ dpr=Math.min(2,devicePixelRatio||1); W=cv.width=innerWidth*dpr; H=cv.height=innerHeight*dpr;
    const n=Math.round(Math.min(110, innerWidth*innerHeight/9000));
    ps=[...Array(n)].map(()=>({x:Math.random()*W,y:Math.random()*H,r:(Math.random()*1.6+.4)*dpr,f:Math.random()*6.28,v:(.08+Math.random()*.25)*dpr,o:.2+Math.random()*.6})); }
  tam(); addEventListener('resize', tam);
  function cuadro(t){
    if(document.hidden){ requestAnimationFrame(cuadro); return; }
    ctx.clearRect(0,0,W,H);
    // rayos suaves desde arriba
    ctx.save(); ctx.translate(W/2, -H*.08); ctx.globalCompositeOperation='lighter';
    for(let i=-4;i<=4;i++){
      const a = i*.16 + (MOV?Math.sin(t/9000+i)*.02:0);
      ctx.save(); ctx.rotate(a);
      const g=ctx.createLinearGradient(0,0,0,H*.9); g.addColorStop(0,'rgba(255,220,150,.07)'); g.addColorStop(1,'rgba(255,220,150,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-8*dpr,0); ctx.lineTo(8*dpr,0); ctx.lineTo(60*dpr,H*.9); ctx.lineTo(-60*dpr,H*.9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    for(const p of ps){
      if(MOV){ p.y -= p.v; p.x += Math.sin(t/2000+p.f)*.15*dpr; if(p.y < -5){ p.y = H+5; p.x = Math.random()*W; } }
      ctx.globalAlpha = p.o*(MOV ? .55+.45*Math.sin(p.f+t/1300) : .7);
      ctx.fillStyle = '#ffe6a8'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.283); ctx.fill();
    }
    ctx.globalAlpha=1;
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
})();

/* ---------- sonido: ambiente suave + papel + campanitas (todo sintetizado) ---------- */
const sonido = (function(){
  let ctx=null, master=null, efx=null, musica=null, on=true, timer=null;
  try{ on = localStorage.getItem('ver_musica')!=='0'; }catch(e){}
  const btn = $('#btnSnd');
  function pintar(){ btn.textContent = on?'🎵':'🔇'; btn.title = on?'Silenciar la música':'Activar la música'; }
  pintar();
  function crear(){
    if(ctx) return true;
    try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return false; }
    master = ctx.createGain(); master.gain.value = on?1:0; master.connect(ctx.destination);
    efx = ctx.createGain(); efx.gain.value = 1; efx.connect(ctx.destination);   // el papel suena aunque la música esté apagada
    const del = ctx.createDelay(1.5); del.delayTime.value=.5; const fb=ctx.createGain(); fb.gain.value=.35; const wet=ctx.createGain(); wet.gain.value=.3;
    del.connect(fb); fb.connect(del); del.connect(wet); wet.connect(ctx.destination); master.connect(del);
    return true;
  }
  // acordes mayores cálidos: Do, Fa, La menor, Sol
  const ACORDES = [[130.81,196,261.63,329.63],[87.31,174.61,261.63,349.23],[110,164.81,261.63,329.63],[98,196,246.94,293.66]];
  function arrancarMusica(){
    if(musica || !ctx) return;
    const out = ctx.createGain(); out.gain.value=0; out.connect(master); out.gain.setTargetAtTime(.05, ctx.currentTime, 3);
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; lp.Q.value=.5; lp.connect(out);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value=.05; lg.gain.value=300; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const osc = ACORDES[0].map((fq,i)=>{ const o=ctx.createOscillator(); o.type=i%2?'triangle':'sine'; o.frequency.value=fq; o.detune.value=(i-1.5)*5;
      const g=ctx.createGain(); g.gain.value=i===0?.45:.3; o.connect(g); g.connect(lp); o.start(); return o; });
    let ac=0; const cada = setInterval(()=>{ ac=(ac+1)%ACORDES.length; osc.forEach((o,i)=>o.frequency.setTargetAtTime(ACORDES[ac][i], ctx.currentTime, 2)); }, 12000);
    const NOTAS=[523.25,587.33,659.25,783.99,880,1046.5];   // pentatónica de Do
    const arpa = ()=>{ if(musica){ campanita(NOTAS[Math.floor(Math.random()*NOTAS.length)], .02, 3.2); timer=setTimeout(arpa, 2600+Math.random()*4800); } };
    musica = {out, osc, lfo, cada}; timer = setTimeout(arpa, 2500);
  }
  function campanita(fq, vol, dur, cuando=0, dest){
    if(!ctx) return;
    const t=ctx.currentTime+cuando, o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine'; o.frequency.value=fq; o2.type='sine'; o2.frequency.value=fq*2.01;
    const g2=ctx.createGain(); g2.gain.value=.2; o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.015); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(dest||master); o.start(t); o2.start(t); o.stop(t+dur+.05); o2.stop(t+dur+.05);
  }
  let ruidoBuf=null;
  function papel(vol){
    if(!ctx) return;
    if(!ruidoBuf){ const n=ctx.sampleRate*.4; ruidoBuf=ctx.createBuffer(1,n,ctx.sampleRate); const d=ruidoBuf.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; }
    const t=ctx.currentTime, dur=.12+Math.random()*.1;
    const s=ctx.createBufferSource(); s.buffer=ruidoBuf; s.playbackRate.value=.8+Math.random()*.4;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=900;
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=.7; bp.frequency.setValueAtTime(1800+Math.random()*800,t); bp.frequency.exponentialRampToValueAtTime(4200,t+dur);
    const g=ctx.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol*.2,t+dur*.35); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(efx); s.start(t, Math.random()*.2); s.stop(t+dur+.02);
  }
  return {
    activar(){ if(!crear()) return; if(ctx.state==='suspended') ctx.resume(); if(on) arrancarMusica(); },
    alternar(){
      on=!on; try{ localStorage.setItem('ver_musica', on?'1':'0'); }catch(e){}
      if(crear()){ if(ctx.state==='suspended') ctx.resume(); master.gain.setTargetAtTime(on?1:0, ctx.currentTime, .15); if(on) arrancarMusica(); }
      pintar();
    },
    toque(){ if(ctx&&on) campanita(1046.5,.025,.7); },
    hoja(v){ papel(v); },
    revelar(){ if(!ctx) return; [523.25,659.25,783.99,1046.5].forEach((f,i)=>campanita(f,.045,2.6,i*.11,efx)); }
  };
})();
$('#btnSnd').onclick = ()=>sonido.alternar();
addEventListener('pointerdown', function primero(){ sonido.activar(); removeEventListener('pointerdown', primero); }, {once:true});

libroInicial();
abrirCompartido();

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
