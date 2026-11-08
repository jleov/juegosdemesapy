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

/* ---------- la Biblia: páginas con texto real (dos columnas, como una Biblia impresa) ---------- */
const ORDEN = ['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SOL','ISA','JER','LAM','EZE','DAN','HOS','JOE','AMO','OBA','JON','MIC','NAH','HAB','ZEP','HAG','ZEC','MAL',
  'MAT','MAR','LUK','JOH','ACT','ROM','1CO','2CO','GAL','EPH','PHI','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAM','1PE','2PE','1JO','2JO','3JO','JUD','REV'];
const libCod = id => id.slice(0,3);
const capDe = id => +id.slice(3).split(':')[0];
// pasajes de cada libro, ordenados por capítulo y versículo
const PORLIB = {};
IDS.forEach(id=>{ (PORLIB[libCod(id)] = PORLIB[libCod(id)] || []).push(id); });
for(const k in PORLIB) PORLIB[k].sort((a,b)=>capDe(a)-capDe(b) || V[a][3]-V[b][3]);
const LIBS = Object.keys(PORLIB).sort((a,b)=>ORDEN.indexOf(a)-ORDEN.indexOf(b));
// toda la base en el orden de la Biblia (para llenar páginas seguidas)
const SEQ = [].concat(...LIBS.map(l=>PORLIB[l]));
const POS = Object.fromEntries(SEQ.map((id,i)=>[id,i]));
const nomLib = id => libroDe(V[id][0]);
function libroDe(cita){ return cita.replace(/\s+\d+:[\d-]+$/,''); }

function bloqueHTML(id){
  const v = V[id], c = capDe(id), a = v[3], esSal = libCod(id)==='PSA';
  let h = '<p>';
  if(a===1) h = (esSal ? `<span class="st">Salmo ${c}</span>` : '') + `<p><span class="cn">${c}</span>`;
  v[4].forEach((t,i)=>{ h += (a===1 && i===0 ? '' : `<sup>${a+i}</sup>`) + esc(t) + ' '; });
  return h + '</p>';
}
// arma el cuerpo de una página juntando pasajes seguidos del mismo libro
function cuerpoDesde(desde, hacia, max){
  const L = SEQ, out = []; let n = 0, i = desde;
  while(n < max && i >= 0 && i < L.length){ const b = bloqueHTML(L[i]); hacia>0 ? out.push(b) : out.unshift(b); n += V[L[i]][1].length; i += hacia; }
  return {html: out.join(''), primero: L[Math.max(0, hacia>0 ? desde : i+1)]};
}
function hojaHTML(cab, num, cuerpo, lado, extra=''){
  const izq = lado==='izq';
  return `<div class="tx${extra}"><div class="cb">${izq?`<b>${num}</b><span>${cab}</span>`:`<span>${cab}</span><b>${num}</b>`}</div><div class="cols">${cuerpo}</div></div><div class="brillo"></div>`;
}
let numPag = 300 + Math.floor(Math.random()*500);
function paginaFalsa(n, lado){
  const i = Math.floor(Math.random()*(SEQ.length-12));
  const c = cuerpoDesde(i, 1, 3300);
  return hojaHTML(`${esc(nomLib(c.primero))} ${capDe(c.primero)}`, n, c.html, lado);
}
function paginaVerso(R){
  const v = V[R.id], lib = libCod(R.id), i = POS[R.id], c = capDe(R.id), a = v[3];
  let h = '';
  if(a===1 && lib==='PSA') h += `<span class="st">Salmo ${c}</span>`;
  h += '<p>' + (a===1 ? `<span class="cn">${c}</span>` : '') + (v[5] ? `<sup>${a-1}</sup>${esc(v[5])} ` : '');
  h += v[4].map((t,k)=>`<mark>${a===1 && k===0 ? '' : `<sup>${a+k}</sup>`}${esc(t)}</mark>`).join(' ');
  h += (v[6] ? ` <sup>${a+v[4].length}</sup>${esc(v[6])}` : '') + '</p>';
  h += cuerpoDesde(i+1, 1, 2200 - v[1].length*1.3).html;
  return hojaHTML(`${esc(libroDe(v[0]))} ${c}`, numPag+1, h, 'der', ' final');
}
function paginaAntes(R){
  const i = POS[R.id];
  const c = cuerpoDesde(i>8 ? i-1 : SEQ.length-1, -1, 3300);
  return hojaHTML(`${esc(nomLib(c.primero))} ${capDe(c.primero)}`, numPag, c.html, 'izq');
}
function ajustar(){
  const p = $('#pDer'); if(!p) return;
  const w = p.offsetWidth; if(w) $('#libro').style.setProperty('--k', (w/300).toFixed(4));
}
addEventListener('resize', ajustar);
function libroInicial(){ $('#pIzq').innerHTML = paginaFalsa(numPag, 'izq'); $('#pDer').innerHTML = paginaFalsa(numPag+1, 'der'); ajustar(); }

/* una hoja que pasa de derecha a izquierda */
let hojasVivas = 0;
function pasarHoja(dur, siguienteDer, siguienteIzq){
  const base = $('#base'), h = document.createElement('div');
  h.className = 'hoja';
  h.innerHTML = `<div class="f papel">${$('#pDer').innerHTML}<div class="sombra"></div></div><div class="d papel">${siguienteIzq}<div class="sombra"></div></div>`;
  base.insertBefore(h, base.querySelector('.lomo'));
  $('#pDer').innerHTML = siguienteDer;   // lo que queda debajo de la hoja que se levanta
  hojasVivas++;
  const fin = ()=>{ $('#pIzq').innerHTML = siguienteIzq; h.remove(); hojasVivas--; };
  if(!MOV || !h.animate){ fin(); return Promise.resolve(); }
  const curva = 'cubic-bezier(.42,.08,.32,1)';
  const a = h.animate([
    {transform:'rotateY(-5deg) translateZ(1px)'},
    {transform:'rotateY(-60deg) translateZ(14px) skewY(-1.5deg)', offset:.3},
    {transform:'rotateY(-120deg) translateZ(14px) skewY(1.5deg)', offset:.7},
    {transform:'rotateY(-175deg) translateZ(1px)'}
  ], {duration:dur, easing:curva, fill:'forwards'});
  h.querySelectorAll('.sombra').forEach(s=>s.animate([{opacity:0},{opacity:1,offset:.5},{opacity:0}], {duration:dur, easing:curva}));
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
  $('#escena').classList.remove('fin','luz');
  estado='listo'; vel=0; acum=0;
  msg(R.nombre ? `${esc(R.nombre)}, pensá en lo que llevás en el corazón…` : 'Pensá en lo que llevás en el corazón…');
  $('#gesto').style.opacity=1;
  $('#gesto').textContent = matchMedia('(pointer:coarse)').matches ? 'Mantené apretada la Biblia y soltá · o deslizá la página' : 'Mantené apretado el clic y soltá · o arrastrá la página';
  ir('pBiblia');
  libroInicial();
  sonido.abrir();
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
    if(acum >= 1 && hojasVivas < 8){
      acum -= 1; numPag += 2;
      const dur = Math.max(260, Math.min(1000, 1800/vel));
      pasarHoja(dur, paginaFalsa(numPag+1, 'der'), paginaFalsa(numPag, 'izq'));
      sonido.hoja(Math.min(1, 3/vel+.25));
    }
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
async function ultimaHoja(mi){
  estado = 'revelando'; numPag += 2;
  sonido.hoja(1);
  await pasarHoja(1400, paginaVerso(R), paginaAntes(R));
  if(mi!==corrida) return;
  revelar(mi);
}
function revelar(mi){
  $('#escena').classList.add('fin','luz');
  sonido.revelar();
  setTimeout(()=>{ const tx = $('#pDer .tx'); if(tx) tx.classList.add('ve'); }, 80);
  chispas($('#pDer'));
  msg(R.nombre ? `Este es el versículo para ${esc(R.nombre)} ✦` : 'Este es tu versículo ✦');
  setTimeout(()=>{ if(mi===corrida) mostrarResultado(R, true); }, MOV?1100:0);
  estado = 'fin';
}
function chispas(el){
  if(!MOV) return;
  const esc_ = $('#escena'), rb = el.getBoundingClientRect(), re = esc_.getBoundingClientRect();
  for(let i=0;i<26;i++){
    const c=document.createElement('div'); c.className='chispa'; esc_.appendChild(c);
    const x = rb.left-re.left + rb.width*(.15+Math.random()*.7), y = rb.top-re.top + rb.height*(.2+Math.random()*.5);
    const ang = Math.random()*6.283, d = 40+Math.random()*100;
    c.animate([{transform:`translate(${x}px,${y}px) scale(1)`,opacity:1},{transform:`translate(${x+Math.cos(ang)*d}px,${y+Math.sin(ang)*d-40}px) scale(.2)`,opacity:0}],
      {duration:1000+Math.random()*800, easing:'cubic-bezier(.2,.7,.3,1)'}).finished.then(()=>c.remove(), ()=>c.remove());
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
  if(animar && bajar) setTimeout(()=>{ const b=$('#res .box'); if(b && b.getBoundingClientRect().top > innerHeight*.7) b.scrollIntoView({behavior:MOV?'smooth':'auto', block:'start'}); }, 900);
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
/* nube: muchas bolitas blancas con borde suave (sirve para el fondo y para la imagen) */
function nube(x, cx, cy, w, sem, alfa=1){
  let s = sem>>>0 || 1; const rr=()=>((s=Math.imul(s^s>>>15,2246822507)+0x6D2B79F5|0)>>>0)/4294967296;
  const n = 9 + Math.floor(rr()*6);
  for(let i=0;i<n;i++){
    const t = i/(n-1), px = cx + (t-.5)*w*(.9+rr()*.15), alto = Math.sin(t*Math.PI);
    const r = w*(.1 + alto*.16 + rr()*.06), py = cy - alto*w*.08 + rr()*w*.03;
    const g = x.createRadialGradient(px, py-r*.3, r*.1, px, py, r);
    g.addColorStop(0, `rgba(255,255,255,${.95*alfa})`); g.addColorStop(.55, `rgba(255,255,255,${.75*alfa})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill();
  }
  // base con sombra celeste suave
  const g2 = x.createRadialGradient(cx, cy+w*.08, w*.05, cx, cy+w*.08, w*.5);
  g2.addColorStop(0, `rgba(190,215,240,${.35*alfa})`); g2.addColorStop(1, 'rgba(190,215,240,0)');
  x.fillStyle = g2; x.beginPath(); x.ellipse(cx, cy+w*.08, w*.5, w*.1, 0, 0, 6.283); x.fill();
}
function rayos(x, cx, cy, largo, n, ancho, alfa, giro=0){
  x.save(); x.translate(cx, cy); x.globalCompositeOperation='lighter';
  for(let i=0;i<n;i++){
    x.save(); x.rotate(giro + i/n*6.283);
    const g = x.createLinearGradient(0,0,0,largo); g.addColorStop(0,`rgba(255,240,190,${alfa})`); g.addColorStop(1,'rgba(255,240,190,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(-ancho*.15,0); x.lineTo(ancho*.15,0); x.lineTo(ancho,largo); x.lineTo(-ancho,largo); x.closePath(); x.fill();
    x.restore();
  }
  x.restore();
}
async function hacerImagen(R){
  const W=1080, H=1920, cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const x=cv.getContext('2d');
  try{ await Promise.all(['700 40px Cinzel','italic 600 40px "Cormorant Garamond"','600 40px "Cormorant Garamond"','italic 500 40px "Cormorant Garamond"'].map(f=>document.fonts.load(f))); }catch(e){}
  const CIN='Cinzel,Georgia,serif', COR='"Cormorant Garamond",Georgia,serif';
  // cielo
  let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#3f93e0'); g.addColorStop(.3,'#7cbcf2'); g.addColorStop(.62,'#c4e3fa'); g.addColorStop(1,'#fff3d8');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  // sol y rayos
  rayos(x, W/2, 120, 1500, 22, 70, .13, .05);
  g=x.createRadialGradient(W/2,120,10,W/2,120,620); g.addColorStop(0,'rgba(255,255,245,1)'); g.addColorStop(.18,'rgba(255,246,200,.9)'); g.addColorStop(.5,'rgba(255,230,160,.35)'); g.addColorStop(1,'rgba(255,230,160,0)');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  // nubes
  const sem = (R.o.k>>>0)||7;
  nube(x, 150, 470, 420, sem+1, .85); nube(x, 960, 600, 460, sem+2, .8); nube(x, 120, 1180, 380, sem+3, .7); nube(x, 1000, 1290, 420, sem+4, .7);
  for(let i=0;i<5;i++) nube(x, i*270, 1820, 560, sem+10+i, 1);
  for(let i=0;i<4;i++) nube(x, 130+i*280, 1700, 460, sem+20+i, .9);
  // brillitos
  let s=sem; const rr=()=>((s=Math.imul(s^s>>>15,2246822507)+0x6D2B79F5|0)>>>0)/4294967296;
  for(let i=0;i<70;i++){ const px=rr()*W, py=rr()*H*.8, r=rr()*2.6+.8; x.globalAlpha=.4+rr()*.6; x.fillStyle='#fff'; x.beginPath(); x.arc(px,py,r,0,6.283); x.fill(); }
  x.globalAlpha=1;
  x.textAlign='center'; x.textBaseline='alphabetic';
  // título
  x.shadowColor='rgba(220,160,40,.9)'; x.shadowBlur=26; x.fillStyle='#fff'; x.font=`700 60px ${CIN}`;
  x.fillText(R.dia ? 'VERSÍCULO DEL DÍA' : 'UNA PALABRA PARA VOS', W/2, 300); x.shadowBlur=0;
  x.shadowColor='rgba(30,70,140,.55)'; x.shadowBlur=12; x.fillStyle='#fff'; x.font=`italic 600 44px ${COR}`;
  const sub = R.dia ? cap(`${DIAS[R.fecha.getDay()]} ${fechaTxt(R.fecha)} de ${R.fecha.getFullYear()}`)
    : (R.nombre ? `${R.nombre}, ${cuandoCorto(R.plazo, R.fecha)}` : cap(cuandoTxt(R.plazo, R.fecha)));
  let y = 366; for(const l of partir(x, sub, W-200).slice(0,2)){ x.fillText(l, W/2, y); y+=50; }
  x.shadowBlur=0;
  // tarjeta de papel con el versículo
  const top = y + 30, fondo = H - 330, cxx = 80, cw = W-160;
  x.save(); x.shadowColor='rgba(40,90,160,.35)'; x.shadowBlur=50; x.shadowOffsetY=16;
  g=x.createLinearGradient(0,top,0,fondo); g.addColorStop(0,'rgba(255,253,246,.95)'); g.addColorStop(1,'rgba(251,241,214,.95)'); x.fillStyle=g;
  x.beginPath(); x.roundRect ? x.roundRect(cxx, top, cw, fondo-top, 40) : x.rect(cxx, top, cw, fondo-top); x.fill(); x.restore();
  x.strokeStyle='rgba(200,150,42,.55)'; x.lineWidth=3; x.beginPath(); x.roundRect ? x.roundRect(cxx+18, top+18, cw-36, fondo-top-36, 28) : x.rect(cxx+18, top+18, cw-36, fondo-top-36); x.stroke();
  x.fillStyle='#c8962a'; x.font=`700 30px ${CIN}`; x.fillText('✦   ✦   ✦', W/2, top+80);
  // el versículo: busca el tamaño que entra
  const vTop = top + 110, vFin = fondo - 300, alto = vFin - vTop;
  let fs = 72, lin, lh;
  for(; fs>=32; fs-=2){ x.font=`italic 600 ${fs}px ${COR}`; lin = partir(x, `“${R.txt}”`, cw-130); lh = fs*1.27; if(lin.length*lh <= alto) break; }
  let yy = vTop + (alto - lin.length*lh)/2 + fs*.9;
  x.fillStyle='#2b2140'; lin.forEach(l=>{ x.fillText(l, W/2, yy); yy+=lh; });
  x.fillStyle='#9a6a14'; x.font=`700 48px ${CIN}`; x.fillText(R.cita, W/2, vFin + 80);
  x.font=`italic 500 35px ${COR}`; x.fillStyle='#5d4a33';
  const rl = partir(x, R.nucleo, cw-150).slice(0,3); let ry = vFin + 150;
  rl.forEach(l=>{ x.fillText(l, W/2, ry); ry+=43; });
  // pie sobre las nubes
  x.fillStyle='#2f4a7a'; x.font=`italic 600 40px ${COR}`; x.fillText('Pedí tu versículo en', W/2, H-200);
  x.shadowColor='rgba(255,255,255,1)'; x.shadowBlur=16; x.fillStyle='#9a6a14'; x.font=`700 56px ${CIN}`; x.fillText('juegospy.com/versiculo', W/2, H-130); x.shadowBlur=0;
  x.fillStyle='rgba(70,90,120,.7)'; x.font=`500 25px ${COR}`; x.fillText('Reina-Valera 1909 · dominio público', W/2, H-80);
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
  ir('pBiblia');
  $('#pIzq').innerHTML = paginaAntes(R); $('#pDer').innerHTML = paginaVerso(R); ajustar();
  $('#escena').classList.add('fin','luz'); $('#gesto').style.opacity=0;
  setTimeout(()=>{ const tx=$('#pDer .tx'); if(tx) tx.classList.add('ve'); }, 500);
  $('#msg').innerHTML = R.dia ? 'Una palabra para este día ✦' : R.nombre ? `Un versículo para ${esc(R.nombre)} ✦` : 'Alguien te compartió este versículo ✦';
  mostrarResultado(R, true, false);
  document.title = `${R.cita} · Versículo del Día`;
  return true;
}
$('#btnMio').onclick = ()=>{
  sonido.toque(); verModo(false);
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
  document.title = 'Versículo del Día: tu versículo de la Biblia para hoy, la semana, el mes o el año | Juegos PY';
  estado='quieto'; ir('pInicio');
};

/* ---------- fondo: cielo con nubes que pasan, rayos de sol y destellos ---------- */
(function cielo(){
  const cv=$('#cielo'), ctx=cv.getContext('2d'); let W,H,dpr=1,nubes=[],brillos=[];
  function sprite(w, sem, alfa){
    const c=document.createElement('canvas'); c.width=Math.ceil(w*1.25); c.height=Math.ceil(w*.55);
    nube(c.getContext('2d'), c.width/2, c.height*.62, w, sem, alfa); return c;
  }
  function tam(){
    dpr=Math.min(2,devicePixelRatio||1); W=cv.width=innerWidth*dpr; H=cv.height=innerHeight*dpr;
    const base = Math.max(W, H*.8);
    nubes = [...Array(9)].map((_,i)=>{
      const capa = i<3 ? 0 : i<6 ? 1 : 2, w = base*(capa===0?.32:capa===1?.42:.55)*(.8+Math.random()*.4);
      return {s:sprite(w, 1+i*97+Math.floor(Math.random()*1000), capa===0?.55:capa===1?.75:.92), x:Math.random()*W*1.3-W*.15,
        y: capa===0 ? H*(.15+Math.random()*.25) : capa===1 ? H*(.4+Math.random()*.3) : H*(.75+Math.random()*.2), v:(capa+1)*.06*dpr};
    });
    brillos = [...Array(Math.round(Math.min(70, innerWidth*innerHeight/14000)))].map(()=>({x:Math.random()*W,y:Math.random()*H,r:(Math.random()*1.6+.6)*dpr,f:Math.random()*6.28,v:.4+Math.random()*1.2,sube:(.05+Math.random()*.2)*dpr}));
  }
  tam(); addEventListener('resize', tam);
  function cuadro(t){
    if(document.hidden){ requestAnimationFrame(cuadro); return; }
    ctx.clearRect(0,0,W,H);
    // rayos de sol que giran muy despacio
    rayos(ctx, W/2, -H*.04, Math.hypot(W,H), 18, 60*dpr, .085, MOV ? t/90000 : 0);
    for(const n of nubes){
      if(MOV){ n.x += n.v; if(n.x > W+20) n.x = -n.s.width; }
      ctx.drawImage(n.s, n.x, n.y - n.s.height/2);
    }
    for(const b of brillos){
      if(MOV){ b.y -= b.sube; if(b.y < -5){ b.y = H+5; b.x = Math.random()*W; } }
      const a = MOV ? Math.max(0, Math.sin(b.f + t/1000*b.v)) : .6;
      ctx.globalAlpha = a; ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      if(a > .85){ ctx.globalAlpha = (a-.85)*4; ctx.fillRect(b.x-b.r*4, b.y-.5*dpr, b.r*8, dpr); ctx.fillRect(b.x-.5*dpr, b.y-b.r*4, dpr, b.r*8); }
    }
    ctx.globalAlpha=1;
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
})();

/* ---------- sonido: alabanza suave (coro, arpa, trompetas) + papel. Todo sintetizado ---------- */
const sonido = (function(){
  let ctx=null, master=null, efx=null, rev=null, musica=null, on=true;
  try{ on = localStorage.getItem('ver_musica')!=='0'; }catch(e){}
  const btn = $('#btnSnd');
  function pintar(){ btn.textContent = on?'🎵':'🔇'; btn.title = on?'Silenciar la música':'Activar la música'; }
  pintar();
  const hz = m => 440*Math.pow(2,(m-69)/12);
  function crear(){
    if(ctx) return true;
    try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return false; }
    // reverberación de iglesia/catedral: respuesta al impulso hecha con ruido que se apaga
    rev = ctx.createConvolver();
    const largo = ctx.sampleRate*3.6, ir = ctx.createBuffer(2, largo, ctx.sampleRate);
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<largo;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/largo, 2.6); }
    rev.buffer = ir;
    const revOut = ctx.createGain(); revOut.gain.value=.55; rev.connect(revOut); revOut.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = on?1:0; master.connect(ctx.destination); master.connect(rev);
    efx = ctx.createGain(); efx.gain.value = 1; efx.connect(ctx.destination); efx.connect(rev);   // efectos suenan aunque la música esté apagada
    return true;
  }
  /* arpa: cuerda pulsada (Karplus-Strong) pre-calculada por nota */
  const cuerdas = {};
  function cuerda(m){
    if(cuerdas[m]) return cuerdas[m];
    const sr = ctx.sampleRate, f = hz(m), N = Math.round(sr/f), dur = Math.min(4, 1.6 + (84-m)*.06), len = Math.floor(sr*dur);
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), buf = new Float32Array(N);
    for(let i=0;i<N;i++) buf[i] = (Math.random()*2-1);
    let k = 0, prev = 0; const dec = .996 - (m-60)*.00012;
    for(let i=0;i<len;i++){ const a = buf[k], nb = buf[(k+1)%N]; const v = (a+nb)*.5*dec; buf[k] = v; d[i] = a*.6 + prev*.4; prev = a; k = (k+1)%N; }
    return cuerdas[m] = b;
  }
  function arpa(m, vol, cuando=0, dest){
    if(!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = cuerda(m);
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 3800;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(lp); lp.connect(g); g.connect(dest||master); s.start(ctx.currentTime + cuando);
  }
  /* trompeta: diente de sierra con filtro que se abre al soplar y vibrato */
  function trompeta(m, vol, dur, cuando=0, dest){
    if(!ctx) return;
    const t = ctx.currentTime + cuando, o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.type='sawtooth'; o2.type='square'; o.frequency.value = hz(m); o2.frequency.value = hz(m); o2.detune.value = 4;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.2; vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(hz(m)*.006, t+.35);
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    const mix = ctx.createGain(); const g2 = ctx.createGain(); g2.gain.value=.35; o.connect(mix); o2.connect(g2); g2.connect(mix);
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2600, t+.07); lp.frequency.exponentialRampToValueAtTime(1500, t+.3);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+.05); g.gain.setTargetAtTime(vol*.75, t+.1, .1);
    g.gain.setTargetAtTime(0, t+dur, .08);
    mix.connect(lp); lp.connect(g); g.connect(dest||master);
    [o,o2,vib].forEach(x=>{ x.start(t); x.stop(t+dur+.6); });
  }
  function fanfarria(dest, vol=.05){
    // ta-ta-taaa de alabanza (tónica Re mayor)
    const notas = [[69,.16],[69,.16],[74,.9]], arm = [[66,.16],[66,.16],[69,.9]];
    let c = 0; notas.forEach(([m,d],i)=>{ trompeta(m, vol, d, c, dest); trompeta(arm[i][0], vol*.7, d, c, dest); c += d + .04; });
  }
  function campanita(fq, vol, dur, cuando=0, dest){
    if(!ctx) return;
    const t=ctx.currentTime+cuando, o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine'; o.frequency.value=fq; o2.type='sine'; o2.frequency.value=fq*2.01;
    const g2=ctx.createGain(); g2.gain.value=.2; o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.015); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(dest||master); o.start(t); o2.start(t); o.stop(t+dur+.05); o2.stop(t+dur+.05);
  }
  /* coro "aaah": dientes de sierra por un banco de filtros con las formantes de la vocal a */
  // progresión de alabanza en Re: Re – La – Si menor – Sol (I–V–vi–IV)
  const ACORDES = [{b:50, v:[62,66,69,74]}, {b:45, v:[61,64,69,73]}, {b:47, v:[62,66,71,74]}, {b:43, v:[62,67,71,74]}];
  function arrancarMusica(){
    if(musica || !ctx) return;
    const out = ctx.createGain(); out.gain.value=0; out.connect(master); out.gain.setTargetAtTime(1, ctx.currentTime, 2.5);
    const coro = ctx.createGain(); coro.gain.value = .05; coro.connect(out);
    const formantes = [[730,1,8],[1090,.55,10],[2440,.25,12]].map(([f,gv,q])=>{ const b=ctx.createBiquadFilter(); b.type='bandpass'; b.frequency.value=f; b.Q.value=q; const g=ctx.createGain(); g.gain.value=gv*3.2; b.connect(g); g.connect(coro); return b; });
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.6; vg.gain.value = 3.5; vib.connect(vg); vib.start();
    const voces = ACORDES[0].v.map((m,i)=>[-8,7].map(det=>{
      const o = ctx.createOscillator(); o.type='sawtooth'; o.frequency.value = hz(m); o.detune.value = det + (i-1.5)*2; vg.connect(o.detune);
      const g = ctx.createGain(); g.gain.value = .5; o.connect(g); formantes.forEach(f=>g.connect(f)); o.start(); return o;
    }));
    // bajo suave (cuerdas graves)
    const bajo = ctx.createOscillator(); bajo.type='triangle'; bajo.frequency.value = hz(ACORDES[0].b);
    const bg = ctx.createGain(); bg.gain.value = .06; const blp = ctx.createBiquadFilter(); blp.type='lowpass'; blp.frequency.value=380;
    bajo.connect(blp); blp.connect(bg); bg.connect(out); bajo.start();
    let ac = 0, vueltas = 0;
    const tocarAcorde = ()=>{
      const A = ACORDES[ac], now = ctx.currentTime;
      voces.forEach((par,i)=>par.forEach(o=>o.frequency.setTargetAtTime(hz(A.v[i]), now, .35)));
      bajo.frequency.setTargetAtTime(hz(A.b), now, .2);
      coro.gain.cancelScheduledValues(now); coro.gain.setTargetAtTime(.06, now, .6); coro.gain.setTargetAtTime(.04, now+3, 1.5);
      // arpa: arpegio que sube y baja sobre el acorde
      const notas = [A.b+12, A.v[0], A.v[1], A.v[2], A.v[3], A.v[1]+12, A.v[2]+12, A.v[3]+12];
      const patron = Math.random()<.5 ? notas : notas.concat(notas.slice(1,-1).reverse());
      patron.forEach((m,i)=>arpa(m, .22, i*.17 + Math.random()*.015));
      // trompetas de vez en cuando, al volver al primer acorde
      if(ac===0 && vueltas>0 && Math.random()<.6) fanfarria(out, .03);
      ac = (ac+1) % ACORDES.length; if(ac===0) vueltas++;
    };
    tocarAcorde();
    const cada = setInterval(tocarAcorde, 6000);
    musica = {cada};
  }
  let ruidoBuf=null;
  function papel(vol){
    if(!ctx) return;
    if(!ruidoBuf){ const n=ctx.sampleRate*.5; ruidoBuf=ctx.createBuffer(1,n,ctx.sampleRate); const d=ruidoBuf.getChannelData(0); let b=0; for(let i=0;i<n;i++){ b = b*.6 + (Math.random()*2-1)*.4; d[i]=b + (Math.random()*2-1)*.5*(Math.random()<.08?1:.3); } }
    const t=ctx.currentTime, dur=.16+Math.random()*.12;
    const s=ctx.createBufferSource(); s.buffer=ruidoBuf; s.playbackRate.value=.85+Math.random()*.3;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=700;
    const bp=ctx.createBiquadFilter(); bp.type='peaking'; bp.frequency.value=3000; bp.gain.value=6;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(2500,t); lp.frequency.linearRampToValueAtTime(7000,t+dur*.4); lp.frequency.linearRampToValueAtTime(3000,t+dur);
    const g=ctx.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol*.32,t+dur*.3); g.gain.linearRampToValueAtTime(vol*.12,t+dur*.6); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(hp); hp.connect(bp); bp.connect(lp); lp.connect(g); g.connect(efx); s.start(t, Math.random()*.3); s.stop(t+dur+.02);
  }
  return {
    activar(){ if(!crear()) return; if(ctx.state==='suspended') ctx.resume(); if(on) arrancarMusica(); },
    alternar(){
      on=!on; try{ localStorage.setItem('ver_musica', on?'1':'0'); }catch(e){}
      if(crear()){ if(ctx.state==='suspended') ctx.resume(); master.gain.setTargetAtTime(on?1:0, ctx.currentTime, .15); if(on) arrancarMusica(); }
      pintar();
    },
    toque(){ if(ctx) arpa(81, .16, 0, efx); },
    abrir(){ if(!ctx) return; [62,66,69,74,78,81].forEach((m,i)=>arpa(m, .14, i*.06, efx)); },
    hoja(v){ papel(v); },
    revelar(){
      if(!ctx) return;
      [62,64,66,69,71,74,76,78,81,83,86].forEach((m,i)=>arpa(m, .2, i*.045, efx));   // glissando de arpa
      fanfarria(efx, on ? .045 : .03);
      [74,78,81,86].forEach((m,i)=>campanita(hz(m), .03, 3, .5+i*.12, efx));
    }
  };
})();
$('#btnSnd').onclick = ()=>sonido.alternar();
addEventListener('pointerdown', function primero(){ sonido.activar(); removeEventListener('pointerdown', primero); }, {once:true});

libroInicial();
abrirCompartido();

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
