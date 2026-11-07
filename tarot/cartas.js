/* =====================================================================
   Tarot Jasy — el mazo: 22 Arcanos Mayores y 56 Arcanos Menores.
   Todos los dibujos están hechos acá con SVG (diseño propio, no copiado de
   ningún mazo). Cada carta tiene: nombre, significado normal e invertido,
   palabras clave y "polaridad" (qué tan luminosa es: +1 muy buena, -1 difícil).
   ===================================================================== */
(function(){
const G = '#f2c14e', GL = '#ffe9a8';

/* ---------- Arcanos Mayores ----------
   [nombre, color, palabras normal, palabras invertida, normal, invertida, consejo, polaridad normal, polaridad invertida] */
const MAYORES = [
 ['El Loco','#2d5a7a',['un salto de fe','nuevos comienzos','la libertad'],['la imprudencia','el miedo a arriesgar','la distracción'],
  'Un comienzo lleno de frescura. El Loco invita a confiar en el camino aunque todavía no se vea el final.',
  'Saltar sin mirar o, al revés, no animarse por miedo. Cuidado con las decisiones apuradas.',
  'Animate a dar el primer paso con el corazón liviano.',0.9,-0.3],
 ['El Mago','#6b2340',['la iniciativa','el talento','el poder de crear'],['la dispersión','engaños','talentos sin usar'],
  'Tenés todas las herramientas sobre la mesa: es momento de actuar y hacer realidad lo que deseás.',
  'Energía dispersa o palabras que no coinciden con los hechos. Revisá bien a quién le creés.',
  'Usá lo que ya tenés: alcanza para empezar.',1,-0.4],
 ['La Sacerdotisa','#1f2f6b',['la intuición','los secretos','la sabiduría interior'],['las dudas','algo oculto','la desconexión interior'],
  'La respuesta está adentro tuyo. Escuchá tu intuición y tus sueños; no todo se dice en voz alta.',
  'Ignorar la voz interior o algo que se esconde. Hace falta silencio para ver claro.',
  'Escuchá esa vocecita que ya sabe la respuesta.',0.5,-0.2],
 ['La Emperatriz','#2f6b3a',['la abundancia','la fertilidad','el cuidado amoroso'],['el descuido propio','la dependencia','la creatividad trabada'],
  'Tiempo de florecer: abundancia, creatividad y amor que nutre. Lo que cuidás, crece.',
  'Dar tanto a los demás que te olvidás de vos; la creatividad se traba.',
  'Cuidá tu jardín: tu cuerpo, tu casa y tus afectos.',1,-0.3],
 ['El Emperador','#7a2a1a',['la estructura','la autoridad','la estabilidad'],['la rigidez','el control excesivo','la falta de disciplina'],
  'Orden, firmeza y protección. Las bases sólidas que ponés hoy sostienen tu mañana.',
  'Demasiado control o una autoridad que asfixia. También puede faltar disciplina.',
  'Poné orden y límites claros.',0.7,-0.3],
 ['El Sumo Sacerdote','#5a3a1a',['la tradición','una guía sabia','el aprendizaje'],['la rebeldía','reglas vacías','consejos equivocados'],
  'Un maestro, una tradición o un consejo sabio te muestra el camino. Lo aprendido de los mayores vale oro.',
  'Romper con reglas que ya no sirven, o cuidado con consejos que no te convienen.',
  'Buscá el consejo de alguien con experiencia.',0.6,-0.2],
 ['Los Enamorados','#8a2a55',['el amor','una elección del corazón','la unión'],['el desequilibrio','la indecisión','valores en choque'],
  'Una elección importante hecha desde el corazón. Unión, armonía y valores compartidos.',
  'Dudas entre dos caminos o un vínculo desparejo. Elegí lo que está alineado con lo que sos.',
  'Elegí con el corazón, pero con los ojos abiertos.',1,-0.4],
 ['El Carro','#24456b',['la victoria','la determinación','el avance'],['la falta de rumbo','obstáculos','la impaciencia'],
  'Avanzás con fuerza y voluntad. Las riendas están en tus manos: el triunfo llega por constancia.',
  'Ir en muchas direcciones a la vez. Antes de acelerar, decidí hacia dónde.',
  'Tomá las riendas y no sueltes el rumbo.',1,-0.4],
 ['La Fuerza','#8a5a14',['el coraje','la paciencia','el dominio de sí'],['la inseguridad','los impulsos','el desgaste'],
  'La verdadera fuerza es la calma. Con ternura y paciencia se doma a cualquier león.',
  'Dudar de tu propia fuerza o dejarte llevar por la bronca. Respirá antes de reaccionar.',
  'Sé firme, pero con suavidad.',0.9,-0.3],
 ['El Ermitaño','#2a3550',['la introspección','la búsqueda interior','la sabiduría'],['el aislamiento','la soledad','el miedo a mirar adentro'],
  'Un tiempo para bajar el ruido y buscar tu propia luz. Las respuestas llegan en silencio.',
  'Aislarse de más o huir de las preguntas importantes.',
  'Date un rato a solas para pensar.',0.4,-0.3],
 ['La Rueda de la Fortuna','#4a2a7a',['un cambio de suerte','los ciclos','el destino'],['una mala racha','resistencia al cambio','errores que se repiten'],
  'La rueda gira a tu favor: cambios, sorpresas y oportunidades que llegan de golpe.',
  'Una racha difícil que también va a pasar. Lo que hoy está abajo, mañana sube.',
  'Subite a la ola del cambio.',0.8,-0.4],
 ['La Justicia','#3a4a5a',['el equilibrio','la verdad','decisiones justas'],['una injusticia','verdades a medias','responsabilidades esquivadas'],
  'Cada cosa en su lugar: lo justo llega, los papeles se ordenan y la verdad pesa.',
  'Algo está desbalanceado o hay una verdad a medias. Hacerse cargo es el primer paso.',
  'Actuá con honestidad: la balanza siempre vuelve.',0.6,-0.5],
 ['El Colgado','#1f5a5a',['una pausa','otra mirada','la entrega'],['el estancamiento','sacrificios inútiles','la indecisión'],
  'Una pausa que enseña: mirar las cosas desde otro ángulo lo cambia todo.',
  'Esperar sin sentido o sacrificarse por nada. Es hora de moverse.',
  'Cambiá el punto de vista antes de decidir.',0.2,-0.4],
 ['La Muerte','#2a2a3a',['la transformación','un fin de ciclo','el renacer'],['el miedo al cambio','aferrarse al pasado','el estancamiento'],
  'No es literal: es un final que abre paso a algo nuevo. Lo viejo cae para que nazca lo que viene.',
  'Resistirse a soltar lo que ya terminó. Cuanto más se aferra uno, más duele.',
  'Soltá lo que ya cumplió su ciclo.',0.3,-0.3],
 ['La Templanza','#2a6b6b',['el equilibrio','la paciencia','la sanación'],['los excesos','la desarmonía','el apuro'],
  'La medida justa: mezclar con calma, sanar de a poco y encontrar el punto medio.',
  'Excesos o apuro. Algo pide volver al equilibrio.',
  'Ni tanto ni tan poco: buscá el punto medio.',0.8,-0.4],
 ['El Diablo','#5a1414',['la tentación','las ataduras','el deseo'],['la liberación','romper cadenas','un despertar'],
  'Ataduras que parecen imposibles de romper: hábitos, deseos o vínculos que te atan. Pero las cadenas están flojas.',
  'Liberación: empezás a ver lo que te ataba y a soltarte de a poco.',
  'Mirá de frente lo que te tiene atado.',-0.6,0.5],
 ['La Torre','#4a1f14',['un cambio repentino','una revelación','un derrumbe necesario'],['un cambio postergado','miedo a la crisis','una sacudida interna'],
  'Algo se sacude de golpe y cae lo que estaba mal construido. Duele, pero libera.',
  'Un cambio que se posterga o una crisis interna. Mejor reconstruir antes de que caiga solo.',
  'Dejá caer lo que no tenía buenas bases.',-0.7,-0.3],
 ['La Estrella','#1a3a7a',['la esperanza','la inspiración','la renovación'],['el desánimo','poca fe','la desconexión'],
  'Después de la tormenta, la calma. Esperanza, sanación y un deseo que se cumple.',
  'Desánimo pasajero: la luz sigue ahí aunque hoy esté nublado.',
  'Pedí un deseo y confiá.',1,-0.2],
 ['La Luna','#22205a',['la intuición','las ilusiones','los sueños'],['la niebla que se levanta','miedos que se van','verdades que salen'],
  'No todo es lo que parece. Jasy ilumina a medias: confiá en tu intuición y cuidate de los engaños.',
  'La niebla se levanta: los miedos se van y las verdades aparecen.',
  'No te apures a creer todo; esperá a que aclare.',-0.3,0.3],
 ['El Sol','#9a5a0a',['la alegría','el éxito','la vitalidad'],['una alegría que tarda','exceso de confianza','nubes pasajeras'],
  'Kuarahy brilla fuerte: éxito, alegría, salud y claridad. Una de las mejores cartas del mazo.',
  'La alegría llega, pero un poco más tarde o más tenue. Igual hay luz.',
  'Mostrate como sos y disfrutá.',1,0.3],
 ['El Juicio','#5a2a6b',['un renacer','un llamado','el perdón'],['las dudas','la autocrítica dura','un llamado ignorado'],
  'Un despertar: es hora de responder a tu llamado, perdonar y empezar una nueva etapa.',
  'Juzgarse con dureza o no escuchar lo que la vida te está pidiendo.',
  'Perdoná y date una segunda oportunidad.',0.8,-0.2],
 ['El Mundo','#1a5a3a',['la realización','la plenitud','un logro'],['un cierre pendiente','el último tramo','demoras'],
  'Un ciclo se completa con éxito. Plenitud, logro y la sensación de estar en tu lugar.',
  'Casi llegás: falta cerrar un último detalle.',
  'Celebrá lo logrado antes de empezar lo siguiente.',1,0.2]
];
const ROMANOS = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];

/* ---------- Arcanos Menores ----------
   Por palo: 14 cartas [normal, invertida, palabra normal, palabra invertida, polaridad normal, polaridad invertida] */
const PALOS = {
 bastos:{n:'Bastos',el:'fuego',color:'#7a2a14',desc:'el fuego: la acción, la pasión y los proyectos',cartas:[
  ['Una chispa nueva: un proyecto, una pasión o una idea que pide arrancar ya.','Energía trabada: ganas que no encuentran por dónde salir.','una chispa nueva','arranques postergados',0.9,-0.3],
  ['Planificar el próximo paso: el mundo está en tus manos y toca decidir hacia dónde ir.','Miedo a lo desconocido; quedarse en la zona cómoda por no animarse.','planes de futuro','miedo a salir de lo cómodo',0.5,-0.3],
  ['Expansión: lo que sembraste empieza a moverse y llegan noticias de lejos.','Demoras y frustración porque las cosas no avanzan al ritmo que querías.','la expansión','demoras',0.8,-0.3],
  ['Celebración, hogar en armonía, una etapa que se cierra con alegría.','Falta de apoyo o una fiesta que se posterga; tensiones en casa.','una celebración','tensiones en casa',1,-0.2],
  ['Competencia y roces: muchas voces queriendo tener razón.','Evitar conflictos, o el fin de una pelea que ya cansaba.','roces y competencia','el fin de una pelea',-0.4,0.2],
  ['Victoria y reconocimiento: otros notan tu esfuerzo.','Orgullo herido o un reconocimiento que todavía no llega.','el reconocimiento','orgullo herido',1,-0.3],
  ['Defender tu lugar con firmeza: tenés la posición alta.','Sentirse con todo en contra, ganas de rendirse ante tanta presión.','defender lo tuyo','el cansancio de pelear',0.4,-0.4],
  ['Todo se acelera: mensajes, viajes y novedades que llegan rápido.','Retrasos, apuro mal llevado, cosas que se cruzan.','noticias rápidas','retrasos',0.8,-0.3],
  ['Resistencia: ya falta poco, aunque el cansancio pese.','Agotamiento y desconfianza; es hora de bajar un poco la guardia.','la resistencia','el agotamiento',0.3,-0.4],
  ['Carga pesada: demasiadas responsabilidades sobre tus hombros.','Soltar lo que no te corresponde y aprender a delegar.','una carga pesada','soltar peso',-0.5,0.3],
  ['Entusiasmo de principiante: noticias que encienden una idea nueva.','Impaciencia y proyectos que se quedan en ideas.','el entusiasmo','la impaciencia',0.7,-0.3],
  ['Acción audaz, aventura, ganas de comerse el mundo.','Impulsividad: empezar mucho y terminar poco.','la aventura','la impulsividad',0.7,-0.4],
  ['Confianza, calidez y magnetismo: brillás con luz propia.','Celos o inseguridad que apagan tu fuego.','el magnetismo','los celos',0.9,-0.4],
  ['Liderazgo con visión: sabés guiar y contagiar a otros.','Autoritarismo o expectativas demasiado altas.','el liderazgo','el autoritarismo',0.9,-0.4]]},
 copas:{n:'Copas',el:'agua',color:'#143d6b',desc:'el agua: las emociones, el amor y los vínculos',cartas:[
  ['El corazón se abre: amor nuevo, emoción sincera, ternura que desborda.','Emociones guardadas, corazón cerrado por miedo a sufrir.','un amor nuevo','el corazón cerrado',1,-0.4],
  ['Unión y conexión mutua: una pareja o amistad en equilibrio.','Desencuentros o falta de reciprocidad.','la conexión mutua','los desencuentros',1,-0.4],
  ['Celebración entre amigos, alegría compartida, reencuentros.','Excesos o chismes que enturbian la ronda de amigos.','la alegría compartida','los chismes',1,-0.3],
  ['Apatía: mirar lo que falta sin ver lo que te están ofreciendo.','Despertar: volver a interesarte por la vida.','la apatía','un despertar',-0.3,0.4],
  ['Tristeza por lo perdido, aunque todavía quedan copas en pie.','Aceptación y perdón: empezar a sanar.','la nostalgia de lo perdido','el perdón',-0.5,0.4],
  ['Nostalgia dulce, recuerdos de infancia, la ternura de lo simple.','Quedarse en el pasado: es hora de mirar adelante.','los recuerdos lindos','vivir en el pasado',0.6,-0.3],
  ['Muchas opciones y fantasías: cuidado con las ilusiones.','Claridad: por fin sabés lo que querés de verdad.','las ilusiones','la claridad',-0.2,0.5],
  ['Dejar atrás lo que ya no llena el alma para buscar algo más profundo.','Miedo a irse; quedarse por costumbre.','buscar algo más profundo','quedarse por costumbre',0.2,-0.3],
  ['El deseo cumplido: satisfacción y bienestar emocional.','Insatisfacción aun teniéndolo todo.','el deseo cumplido','la insatisfacción',1,-0.2],
  ['Felicidad en familia, armonía en el hogar, amor que se comparte.','Tensiones familiares o expectativas idealizadas.','la felicidad en familia','tensiones familiares',1,-0.4],
  ['Un mensaje tierno, una sorpresa afectiva, intuición creativa.','Sensibilidad a flor de piel, inmadurez emocional.','un mensaje tierno','la sensibilidad a flor de piel',0.8,-0.2],
  ['Romance: alguien que llega con el corazón en la mano.','Promesas que no se cumplen, cambios de humor.','el romance','promesas vacías',0.9,-0.4],
  ['Compasión, intuición y cuidado: sabés escuchar.','Dependencia emocional o cargar con penas ajenas.','la compasión','la dependencia emocional',0.8,-0.3],
  ['Equilibrio emocional, calma ante la tormenta, sabiduría del corazón.','Emociones reprimidas o manipulación.','la calma interior','emociones reprimidas',0.8,-0.4]]},
 espadas:{n:'Espadas',el:'aire',color:'#3a4060',desc:'el aire: la mente, la verdad y los conflictos',cartas:[
  ['Claridad mental: una verdad que corta la niebla, una decisión firme.','Confusión, palabras que hieren, ideas enredadas.','la claridad mental','la confusión',0.8,-0.4],
  ['Indecisión o tregua: cerrar los ojos para no tener que elegir.','Aparece información que obliga a decidir.','la indecisión','una decisión que se impone',-0.2,0.2],
  ['Dolor del corazón: una verdad que duele pero libera.','Recuperación: dejar ir la pena.','una herida','la recuperación',-0.8,0.3],
  ['Descanso, pausa necesaria, recuperar fuerzas.','Inquietud, agotamiento por no parar nunca.','el descanso','el agotamiento',0.4,-0.3],
  ['Ganar a cualquier precio deja soledad: elegí bien tus batallas.','Reconciliación: dejar atrás una pelea.','las batallas inútiles','la reconciliación',-0.6,0.4],
  ['Transición hacia aguas más tranquilas: dejar atrás lo difícil.','Resistencia al cambio, asuntos sin resolver.','una transición','asuntos pendientes',0.4,-0.3],
  ['Estrategia y astucia; o alguien que no muestra todas sus cartas.','La verdad sale a la luz: confesiones.','la astucia','verdades que salen',-0.3,0.3],
  ['Sentirse atrapado por los propios pensamientos: la salida está más cerca de lo que parece.','Liberarse, ver por fin nuevas salidas.','pensamientos que atan','la liberación',-0.5,0.5],
  ['Preocupaciones que quitan el sueño: la mente agranda los miedos.','Esperanza: los miedos empiezan a ceder.','las preocupaciones','la esperanza',-0.7,0.3],
  ['Tocar fondo: un final doloroso que abre paso al amanecer.','Recuperarse y levantarse de a poco.','un final doloroso','levantarse de nuevo',-0.8,0.3],
  ['Curiosidad, ganas de aprender, mente despierta.','Chismes o palabras apuradas.','la curiosidad','los chismes',0.5,-0.3],
  ['Ir directo al objetivo: pensamiento veloz, ambición.','Precipitación: discutir sin escuchar.','ir directo al grano','la precipitación',0.4,-0.4],
  ['Mirada clara y honesta: independencia y criterio propio.','Frialdad o amargura por heridas viejas.','la honestidad','la frialdad',0.6,-0.4],
  ['Autoridad intelectual, justicia y verdad.','Abuso de poder, rigidez mental.','la verdad','la rigidez',0.6,-0.5]]},
 oros:{n:'Oros',el:'tierra',color:'#5a4a10',desc:'la tierra: el dinero, el trabajo y el cuerpo',cartas:[
  ['Una oportunidad concreta: un ingreso, un trabajo, una semilla de prosperidad.','Oportunidad perdida o mala planificación.','una oportunidad concreta','una oportunidad perdida',1,-0.4],
  ['Hacer malabares con las prioridades y adaptarse con buen humor.','Desorden y gastos que se descontrolan.','el equilibrio entre tareas','el desorden',0.4,-0.4],
  ['Trabajo en equipo, aprendizaje y oficio bien hecho.','Falta de coordinación, esfuerzo poco valorado.','el trabajo en equipo','el esfuerzo poco valorado',0.8,-0.3],
  ['Seguridad y ahorro: cuidar lo que se tiene.','Avaricia o miedo a perder que no deja avanzar.','el ahorro','el miedo a perder',0.5,-0.3],
  ['Estrechez o sensación de quedar afuera: pedí ayuda, está más cerca de lo que creés.','Recuperación después de un tiempo difícil.','la estrechez','la recuperación',-0.7,0.4],
  ['Generosidad: dar y recibir en equilibrio.','Deudas o favores con condiciones.','la generosidad','las deudas',0.9,-0.4],
  ['Paciencia: la cosecha crece, aunque todavía no se vea.','Impaciencia con los resultados, inversión que no rinde.','la paciencia','la impaciencia',0.4,-0.3],
  ['Dedicación y práctica: perfeccionar el oficio.','Rutina sin ganas, trabajo hecho a las apuradas.','la dedicación','la rutina sin ganas',0.7,-0.3],
  ['Independencia y abundancia ganada con esfuerzo.','Dependencia económica o gastos por apariencia.','la abundancia propia','gastos por apariencia',1,-0.3],
  ['Riqueza duradera, herencia, estabilidad familiar.','Conflictos de plata en la familia.','la estabilidad duradera','conflictos de plata',1,-0.4],
  ['Un estudio o una propuesta concreta; ganas de aprender un oficio.','Falta de enfoque, postergar lo importante.','una propuesta concreta','la falta de enfoque',0.7,-0.3],
  ['Constancia y responsabilidad: paso a paso se llega.','Estancamiento o terquedad.','la constancia','el estancamiento',0.6,-0.3],
  ['Abundancia práctica, cuidado del hogar y del cuerpo.','Descuidarse por cuidar a todos.','la abundancia práctica','el descuido propio',0.9,-0.3],
  ['Éxito material, buen manejo del dinero, seguridad.','Materialismo o rigidez con la plata.','el éxito material','el materialismo',0.9,-0.4]]}
};
const RANGOS = ['As','Dos','Tres','Cuatro','Cinco','Seis','Siete','Ocho','Nueve','Diez','Sota','Caballero','Reina','Rey'];
const ROM_MENOR = ['As','II','III','IV','V','VI','VII','VIII','IX','X','Sota','Caballero','Reina','Rey'];

/* ---------- armar el mazo ---------- */
const MAZO = [];
MAYORES.forEach((m,i)=>MAZO.push({id:'M'+i, mayor:true, num:i, rom:ROMANOS[i], nombre:m[0], color:m[1],
  kn:m[2], ki:m[3], n:m[4], i:m[5], consejo:m[6], p:m[7], q:m[8]}));
Object.keys(PALOS).forEach(pk=>{
  const P=PALOS[pk];
  P.cartas.forEach((c,r)=>MAZO.push({id:pk[0].toUpperCase()+(r+1), mayor:false, palo:pk, rango:r, num:r+1, rom:ROM_MENOR[r],
    nombre:RANGOS[r]+' de '+P.n, color:P.color, kn:[c[2]], ki:[c[3]], n:c[0], i:c[1],
    consejo:null, p:c[4], q:c[5]}));
});

/* ---------- dibujos ---------- */
const f = n => +n.toFixed(2);
function estrella(cx,cy,r1,r2,n,rot=-90){
  let pts=[]; for(let k=0;k<n*2;k++){ const r=k%2?r2:r1, a=(rot+k*180/n)*Math.PI/180; pts.push(f(cx+r*Math.cos(a))+','+f(cy+r*Math.sin(a))); }
  return `<polygon points="${pts.join(' ')}"/>`;
}
function rayos(cx,cy,r1,r2,n,extra=''){
  let s=''; for(let k=0;k<n;k++){ const a=k*2*Math.PI/n; s+=`<line x1="${f(cx+r1*Math.cos(a))}" y1="${f(cy+r1*Math.sin(a))}" x2="${f(cx+r2*Math.cos(a))}" y2="${f(cy+r2*Math.sin(a))}" ${extra}/>`; }
  return s;
}
const inf = (cx,cy,s=1)=>`<path transform="translate(${cx} ${cy}) scale(${s})" d="M0 0 C7 -8 17 -8 17 0 C17 8 7 8 0 0 C-7 -8 -17 -8 -17 0 C-17 8 -7 8 0 0Z"/>`;
const SUAVE = 'fill="rgba(242,193,78,.28)"', CLARO='fill="rgba(255,255,255,.22)"', OSCURO='fill="rgba(0,0,0,.35)"';

// símbolos de los palos (centrados en 0,0, unos 22 de alto)
const SIMB = {
 copas:`<path d="M-8 -9 L8 -9 Q8 3 0 4 Q-8 3 -8 -9Z" ${SUAVE}/><path d="M-8 -9 L8 -9"/><path d="M0 4 L0 9"/><path d="M-5 10 L5 10"/>`,
 oros:`<circle r="9.5" ${SUAVE}/><circle r="6.5"/>${rayos(0,0,1.5,6.5,8,'stroke-width="0.8"')}<circle r="1.6" fill="${G}"/>`,
 espadas:`<path d="M0 -12 L2.2 4 L-2.2 4Z" ${CLARO}/><path d="M-6.5 4 L6.5 4"/><path d="M0 4 L0 9.5"/><circle cy="10.8" r="1.3" fill="${G}"/>`,
 bastos:`<path d="M-1.6 11 L-2.6 -8 Q0 -12.5 2.6 -8 L1.6 11Z" ${SUAVE}/><ellipse cx="-5.5" cy="-3" rx="3.2" ry="1.4" transform="rotate(-30 -5.5 -3)"/><ellipse cx="5.2" cy="2.5" rx="3.2" ry="1.4" transform="rotate(30 5.2 2.5)"/><path d="M-2 0 L2 0 M-1.8 5 L1.8 5"/>`
};
const PIPS = {
 1:[[50,82]], 2:[[50,52],[50,110]], 3:[[50,46],[50,81],[50,116]],
 4:[[34,52],[66,52],[34,110],[66,110]], 5:[[34,48],[66,48],[50,81],[34,114],[66,114]],
 6:[[34,46],[66,46],[34,81],[66,81],[34,116],[66,116]], 7:[[34,46],[66,46],[50,63],[34,81],[66,81],[34,116],[66,116]],
 8:[[34,44],[66,44],[50,62],[34,81],[66,81],[50,100],[34,118],[66,118]],
 9:[[34,42],[66,42],[34,68],[66,68],[50,81],[34,94],[66,94],[34,120],[66,120]],
 10:[[34,40],[66,40],[50,52],[34,66],[66,66],[34,96],[66,96],[50,110],[34,122],[66,122]]
};
const PIP_ESC = n => n===1?2:n<=3?1.15:n<=6?0.98:0.82;
const TOCADO = {
 10:`<path d="M38 56 Q40 40 52 40 Q62 40 62 52 L38 56Z" ${SUAVE}/><path d="M60 42 Q72 34 70 22" stroke-width="1.2"/><path d="M62 44 Q76 40 78 28" stroke-width="1"/>`, // sota: gorro con pluma
 11:`<path d="M40 30 Q30 40 34 56 L44 56 Q42 48 50 46 Q58 48 56 56 L66 56 Q70 40 60 30Z" ${SUAVE}/><circle cx="40" cy="36" r="1" fill="${G}"/><circle cx="60" cy="36" r="1" fill="${G}"/><circle cx="50" cy="54" r="1" fill="${G}"/>`, // caballero: herradura
 12:`<path d="M34 56 L36 40 Q42 48 44 38 Q50 46 56 38 Q58 48 64 40 L66 56Z" ${SUAVE}/><circle cx="36" cy="38" r="2"/><circle cx="50" cy="35" r="2.4"/><circle cx="64" cy="38" r="2"/><path d="M34 56 L66 56"/>`, // reina
 13:`<path d="M34 56 L34 38 L42 46 L50 32 L58 46 L66 38 L66 56Z" ${SUAVE}/><path d="M50 32 L50 24 M46 27 L54 27"/><path d="M34 56 L66 56"/><circle cx="50" cy="50" r="2" fill="${G}"/>` // rey
};

const EMBLEMAS = [
 // 0 El Loco
 `<circle cx="74" cy="42" r="7" ${SUAVE}/>${rayos(74,42,9.5,13,12)}
  <path d="M10 124 Q38 116 60 120 L64 130"/><path d="M64 130 L66 122 L72 124" stroke-width="1"/>
  <circle cx="42" cy="62" r="6"/><path d="M42 68 L44 92 L36 112 M44 92 L54 110"/><path d="M43 74 L30 84 M43 74 L56 70"/>
  <path d="M50 96 L66 52"/><circle cx="68" cy="48" r="5" ${SUAVE}/>
  <circle cx="28" cy="86" r="1.8" fill="${G}"/>${rayos(28,86,2.5,5,6)}
  <path d="M24 118 q4 -6 8 0 q2 -5 6 -1" stroke-width="1"/>`,
 // I El Mago
 `${inf(50,42,1)}<path d="M50 54 L50 76"/><circle cx="50" cy="53" r="1.8" fill="${G}"/><circle cx="50" cy="77" r="1.8" fill="${G}"/>
  <rect x="20" y="98" width="60" height="6" rx="1" ${SUAVE}/><path d="M25 104 L25 126 M75 104 L75 126"/>
  <g transform="translate(30 88) scale(.75)">${SIMB.copas}</g><g transform="translate(43 88) scale(.75)">${SIMB.espadas}</g>
  <g transform="translate(57 88) scale(.75)">${SIMB.bastos}</g><g transform="translate(70 89) scale(.75)">${SIMB.oros}</g>
  <path d="M30 70 Q24 66 22 58 M70 70 Q76 66 78 58" stroke-width="1"/>${estrella(22,56,2.5,1,4)}${estrella(78,56,2.5,1,4)}`,
 // II La Sacerdotisa
 `<rect x="20" y="44" width="11" height="80" ${OSCURO}/><rect x="69" y="44" width="11" height="80" ${CLARO}/>
  <path d="M18 44 L33 44 M67 44 L82 44 M18 124 L33 124 M67 124 L82 124"/>
  <text x="25.5" y="58" font-size="7" fill="${G}" stroke="none" text-anchor="middle" font-family="Georgia,serif">B</text>
  <text x="74.5" y="58" font-size="7" fill="${G}" stroke="none" text-anchor="middle" font-family="Georgia,serif">J</text>
  <circle cx="50" cy="44" r="6" ${SUAVE}/><path d="M38 40 A6 6 0 1 0 38 48 A4.5 4.5 0 1 1 38 40Z" fill="${G}"/><path d="M62 40 A6 6 0 1 1 62 48 A4.5 4.5 0 1 0 62 40Z" fill="${G}"/>
  <path d="M40 66 Q50 60 60 66 L60 96 Q50 90 40 96Z" ${SUAVE}/><path d="M44 72 L56 72 M44 78 L56 78 M44 84 L54 84" stroke-width=".8"/>
  <path d="M38 114 A12 12 0 1 0 62 114 A10 10 0 1 1 38 114Z" fill="${G}" stroke="none"/>`,
 // III La Emperatriz
 `${[200,220,240,260,280,300,320,340].map(a=>{const r=26,x=50+r*Math.cos(a*Math.PI/180),y=66+r*Math.sin(a*Math.PI/180);return estrella(x,y,2.6,1.1,5);}).join('')}
  <circle cx="50" cy="64" r="13" ${SUAVE}/><path d="M50 77 L50 104 M39 92 L61 92"/>
  <path d="M22 128 L26 96"/>${[100,107,114].map(y=>`<ellipse cx="${f(22+(128-y)*0.12)}" cy="${y}" rx="3" ry="1.4" transform="rotate(-50 ${f(22+(128-y)*0.12)} ${y})"/><ellipse cx="${f(28+(128-y)*0.12)}" cy="${y+2}" rx="3" ry="1.4" transform="rotate(50 ${f(28+(128-y)*0.12)} ${y+2})"/>`).join('')}
  <path d="M78 128 L74 96"/>${[100,107,114].map(y=>`<ellipse cx="${f(72+(y-96)*0.12)}" cy="${y+2}" rx="3" ry="1.4" transform="rotate(-50 ${f(72+(y-96)*0.12)} ${y+2})"/><ellipse cx="${f(78+(y-96)*0.12)}" cy="${y}" rx="3" ry="1.4" transform="rotate(50 ${f(78+(y-96)*0.12)} ${y})"/>`).join('')}`,
 // IV El Emperador
 `<path d="M36 58 L36 44 L43 51 L50 38 L57 51 L64 44 L64 58Z" ${SUAVE}/><path d="M36 58 L64 58"/>
  <rect x="27" y="68" width="46" height="54" rx="2" ${OSCURO}/>
  <path d="M27 70 C16 66 16 80 24 80 C29 80 29 74 25 74"/><path d="M73 70 C84 66 84 80 76 80 C71 80 71 74 75 74"/>
  <circle cx="50" cy="92" r="8" ${SUAVE}/><path d="M50 84 L50 78 M47 80 L53 80 M42 92 L58 92"/>
  <path d="M10 128 L22 112 L30 120 L40 106 L50 122 M50 128 L60 112 L70 122 L80 108 L90 128" stroke-width="1"/>`,
 // V El Sumo Sacerdote
 `<path d="M22 126 L22 62 Q50 30 78 62 L78 126" ${OSCURO}/><path d="M50 44 L50 118"/><path d="M46 52 L54 52 M44 59 L56 59 M42 66 L58 66"/>
  ${[-35,35].map(a=>`<g transform="translate(50 108) rotate(${a})"><circle cy="-16" r="3.5"/><path d="M0 -12.5 L0 10 M0 6 L3.5 6 M0 9.5 L3 9.5"/></g>`).join('')}
  <circle cx="50" cy="40" r="3" fill="${G}"/>`,
 // VI Los Enamorados
 `<circle cx="50" cy="40" r="7" ${SUAVE}/>${rayos(50,40,9,14,14)}
  <path d="M50 70 C50 62 40 60 40 67 C40 73 50 78 50 82 C50 78 60 73 60 67 C60 60 50 62 50 70Z" fill="${G}"/>
  <circle cx="30" cy="86" r="6"/><path d="M30 92 L22 124 L38 124Z" ${CLARO}/>
  <circle cx="70" cy="86" r="6"/><path d="M70 92 L62 124 L78 124Z" ${SUAVE}/>
  <path d="M36 102 Q50 96 64 102" stroke-width="1"/>`,
 // VII El Carro
 `<path d="M24 54 Q50 38 76 54"/>${[32,42,50,58,68].map(x=>estrella(x,x===50?44:48,2,0.8,4)).join('')}
  <path d="M30 56 L30 60 M70 56 L70 60"/><rect x="30" y="60" width="40" height="32" rx="2" ${SUAVE}/>${estrella(50,76,8,3.2,5)}
  <circle cx="32" cy="100" r="9"/>${rayos(32,100,0,9,6,'stroke-width="1"')}<circle cx="68" cy="100" r="9"/>${rayos(68,100,0,9,6,'stroke-width="1"')}
  <circle cx="38" cy="121" r="6" fill="rgba(0,0,0,.6)"/><circle cx="62" cy="121" r="6" fill="rgba(255,255,255,.6)"/>`,
 // VIII La Fuerza
 `${inf(50,42,0.8)}
  ${rayos(50,86,16,27,20)}<circle cx="50" cy="86" r="15" ${SUAVE}/>
  <circle cx="44" cy="82" r="1.6" fill="${G}"/><circle cx="56" cy="82" r="1.6" fill="${G}"/>
  <path d="M47 90 L53 90 L50 94Z" fill="${G}"/><path d="M45 96 Q50 100 55 96"/>
  <path d="M30 118 Q50 108 70 118" stroke-width="1"/>${[38,50,62].map(x=>`<circle cx="${x}" cy="${x===50?111:114}" r="2" ${SUAVE}/>`).join('')}`,
 // IX El Ermitaño
 `<path d="M46 44 Q36 54 36 126 L66 126 Q64 70 58 50 Q52 40 46 44Z" ${OSCURO}/><path d="M46 44 Q50 52 58 50"/>
  <path d="M68 40 L62 128"/>
  <path d="M40 66 L32 72"/><path d="M26 74 L38 74 L36 92 L28 92Z" ${SUAVE}/>${estrella(32,83,5,2.2,6)}
  <path d="M28 92 L36 92 M30 74 L32 70 L34 74"/>`,
 // X La Rueda de la Fortuna
 `<circle cx="50" cy="82" r="30" ${OSCURO}/><circle cx="50" cy="82" r="22"/><circle cx="50" cy="82" r="6" ${SUAVE}/>
  ${rayos(50,82,6,22,8)}
  ${[0,90,180,270].map(a=>{const x=50+26*Math.cos(a*Math.PI/180),y=82+26*Math.sin(a*Math.PI/180);return `<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="${G}"/>`;}).join('')}
  ${[45,135,225,315].map(a=>{const x=50+26*Math.cos(a*Math.PI/180),y=82+26*Math.sin(a*Math.PI/180);return estrella(x,y,2.2,0.9,4);}).join('')}
  <path d="M14 44 q4 -6 10 -2 q4 -5 8 0" stroke-width="1"/><path d="M68 42 q4 -6 10 -2 q4 -5 8 0" stroke-width="1"/>
  <path d="M16 122 q4 -6 10 -2 q4 -5 8 0" stroke-width="1"/><path d="M66 124 q4 -6 10 -2 q4 -5 8 0" stroke-width="1"/>`,
 // XI La Justicia
 `<path d="M50 34 L53 44 L53 104 L47 104 L47 44Z" ${CLARO}/><path d="M42 104 L58 104 M50 104 L50 114"/><circle cx="50" cy="116" r="2.2" fill="${G}"/>
  <path d="M22 60 L78 60"/><circle cx="50" cy="60" r="2.5" fill="${G}"/>
  <path d="M22 60 L15 84 M22 60 L29 84 M78 60 L71 84 M78 60 L85 84" stroke-width=".8"/>
  <path d="M13 84 Q22 94 31 84Z" ${SUAVE}/><path d="M69 84 Q78 94 87 84Z" ${SUAVE}/>
  <path d="M30 126 L70 126 M34 122 L66 122"/>`,
 // XII El Colgado
 `<path d="M24 36 L76 36" stroke-width="3"/><path d="M28 36 L28 128 M72 36 L72 128" stroke-width="2.2"/>
  <ellipse cx="34" cy="34" rx="4" ry="1.6"/><ellipse cx="66" cy="34" rx="4" ry="1.6"/>
  <path d="M50 36 L50 46"/><path d="M50 46 L50 78"/><path d="M50 56 L60 62 L50 68" />
  <path d="M50 78 L50 100" stroke-width="2.4"/><path d="M50 82 L42 94 L50 98 M50 82 L58 94 L50 98"/>
  <circle cx="50" cy="107" r="6" ${SUAVE}/><circle cx="50" cy="107" r="10.5" stroke-dasharray="2 2" stroke-width=".9"/>`,
 // XIII La Muerte (transformación)
 `<rect x="18" y="74" width="9" height="26" ${OSCURO}/><rect x="73" y="74" width="9" height="26" ${OSCURO}/>
  <path d="M18 74 L22.5 68 L27 74 M73 74 L77.5 68 L82 74"/>
  <path d="M36 100 A14 14 0 0 1 64 100Z" ${SUAVE}/>${[200,225,250,270,290,315,340].map(a=>{const r1=17,r2=24,c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180);return `<line x1="${f(50+r1*c)}" y1="${f(100+r1*s)}" x2="${f(50+r2*c)}" y2="${f(100+r2*s)}"/>`;}).join('')}
  <path d="M12 100 L88 100"/><path d="M16 110 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 M22 120 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0" stroke-width=".9"/>
  ${[0,72,144,216,288].map(a=>{const x=50+5.5*Math.cos((a-90)*Math.PI/180),y=50+5.5*Math.sin((a-90)*Math.PI/180);return `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="rgba(255,255,255,.35)"/>`;}).join('')}<circle cx="50" cy="50" r="2.6" fill="${G}"/>`,
 // XIV La Templanza
 `<path d="M44 40 L56 40 L56 52 L44 52Z"/><path d="M50 42 L54.5 50 L45.5 50Z" fill="${G}"/>
  <g transform="rotate(-20 32 74)"><path d="M24 66 L40 66 Q40 80 32 82 Q24 80 24 66Z" ${SUAVE}/><path d="M32 82 L32 88 M27 88 L37 88"/></g>
  <g transform="rotate(10 68 98)"><path d="M60 90 L76 90 Q76 104 68 106 Q60 104 60 90Z" ${SUAVE}/><path d="M68 106 L68 112 M63 112 L73 112"/></g>
  <path d="M38 66 Q58 60 64 90" stroke-width="2.2" stroke="${GL}"/>
  <path d="M14 128 Q30 118 46 124 M54 124 Q70 118 86 128" stroke-width="1"/>`,
 // XV El Diablo
 `<path d="M36 62 Q22 44 34 30 Q32 46 44 56" ${SUAVE}/><path d="M64 62 Q78 44 66 30 Q68 46 56 56" ${SUAVE}/>
  <path d="M38 58 Q50 54 62 58 Q62 76 50 82 Q38 76 38 58Z" ${OSCURO}/><path d="M43 66 L47 68 M57 66 L53 68"/>
  <rect x="38" y="96" width="24" height="12" ${OSCURO}/><path d="M36 108 L64 108"/>
  ${[0,1,2,3].map(k=>`<ellipse cx="${32-k*3}" cy="${102+k*5}" rx="2.2" ry="1.4" transform="rotate(60 ${32-k*3} ${102+k*5})"/><ellipse cx="${68+k*3}" cy="${102+k*5}" rx="2.2" ry="1.4" transform="rotate(-60 ${68+k*3} ${102+k*5})"/>`).join('')}
  <circle cx="20" cy="124" r="4"/><circle cx="80" cy="124" r="4"/>`,
 // XVI La Torre
 `<path d="M38 128 L42 62 L58 62 L62 128Z" ${OSCURO}/><path d="M40 62 L40 56 L44 56 L44 60 L48 60 L48 56 L52 56 L52 60 L56 60 L56 56 L60 56 L60 62"/>
  <rect x="47" y="76" width="6" height="9" ${SUAVE}/><rect x="45" y="96" width="5" height="8" ${SUAVE}/><rect x="51" y="108" width="5" height="8" ${SUAVE}/>
  <path d="M84 28 L64 46 L72 48 L54 62" stroke="${GL}" stroke-width="2"/>
  <g transform="rotate(28 70 44)"><path d="M62 46 L62 38 L66 42 L70 36 L74 42 L78 38 L78 46Z" ${SUAVE}/></g>
  <path d="M46 76 q-4 -6 0 -10 q1 4 3 4 M54 96 q4 -6 0 -9 q-1 4 -3 4" fill="rgba(255,120,40,.5)" stroke-width=".8"/>
  ${[[26,52],[22,70],[30,88],[74,76],[80,94],[72,110]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="1.5" fill="${G}"/>`).join('')}`,
 // XVII La Estrella
 `${estrella(50,50,17,5,8,-90).replace('<polygon','<polygon fill="rgba(242,193,78,.55)"')}
  ${[[22,36],[78,36],[18,62],[82,62],[30,80],[70,80],[50,26]].map(p=>estrella(p[0],p[1],4,1.4,8)).join('')}
  <path d="M30 98 L42 98 Q44 108 36 112 Q28 108 30 98Z" ${SUAVE}/><path d="M42 100 Q56 100 58 116" stroke="${GL}" stroke-width="1.6"/>
  <path d="M14 118 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 M14 126 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0" stroke-width="1"/>`,
 // XVIII La Luna
 `${rayos(50,48,17,23,18,'stroke-width=".9"')}<circle cx="50" cy="48" r="14" ${SUAVE}/>
  <path d="M50 34 A14 14 0 0 1 50 62 A10 14 0 0 0 50 34Z" fill="${G}" stroke="none"/>
  ${[[38,72],[50,74],[62,72]].map(p=>`<path d="M${p[0]} ${p[1]} q-2 4 0 5 q2 -1 0 -5Z" fill="${G}"/>`).join('')}
  <rect x="16" y="84" width="10" height="34" ${OSCURO}/><path d="M16 84 L21 78 L26 84"/><rect x="74" y="84" width="10" height="34" ${OSCURO}/><path d="M74 84 L79 78 L84 84"/>
  <path d="M50 128 Q42 116 52 106 Q60 96 50 86" stroke-dasharray="3 2"/>
  <path d="M12 124 q6 -4 12 0 t12 0 M64 124 q6 -4 12 0 t12 0" stroke-width="1"/>`,
 // XIX El Sol
 `${[...Array(16)].map((_,k)=>{const a=k*Math.PI/8, r1=21, r2=k%2?29:33, c=Math.cos(a), s=Math.sin(a);
     return k%2 ? `<line x1="${f(50+r1*c)}" y1="${f(60+r1*s)}" x2="${f(50+r2*c)}" y2="${f(60+r2*s)}"/>`
       : `<path d="M${f(50+r1*c)} ${f(60+r1*s)} Q${f(50+27*c-3*s)} ${f(60+27*s+3*c)} ${f(50+r2*c)} ${f(60+r2*s)}"/>`;}).join('')}
  <circle cx="50" cy="60" r="18" fill="rgba(242,193,78,.45)"/><circle cx="44" cy="56" r="1.6" fill="${G}"/><circle cx="56" cy="56" r="1.6" fill="${G}"/><path d="M43 65 Q50 71 57 65"/>
  <path d="M12 106 L88 106 M12 112 L88 112" stroke-width=".9"/>
  ${[26,50,74].map(x=>`<path d="M${x} 130 L${x} 122"/><circle cx="${x}" cy="119" r="2.4" fill="${G}"/>${rayos(x,119,3,6,10,'stroke-width="1"')}`).join('')}`,
 // XX El Juicio
 `<path d="M14 46 q6 -10 16 -4 q6 -10 16 -2 q8 -8 16 0 q10 -6 16 4 q8 2 6 10 L12 54 q-4 -6 2 -8Z" ${CLARO}/>
  <path d="M34 62 L62 50 L68 42 L70 58 L62 54Z" ${SUAVE}/><path d="M44 58 L46 76 L58 72 L56 54"/><path d="M50 60 L52 72 M45 66 L57 64" stroke-width="1"/>
  ${[28,50,72].map(x=>`<rect x="${x-9}" y="112" width="18" height="10" ${OSCURO}/><circle cx="${x}" cy="98" r="4"/><path d="M${x} 102 L${x} 112 M${x-7} 92 L${x} 104 L${x+7} 92"/>`).join('')}
  <path d="M10 126 L90 126"/>`,
 // XXI El Mundo
 `<ellipse cx="50" cy="82" rx="21" ry="32" stroke-width="2.4"/>
  ${[...Array(18)].map((_,k)=>{const a=k*Math.PI/9,x=50+21*Math.cos(a),y=82+32*Math.sin(a);return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="3" ry="1.3" transform="rotate(${f(a*180/Math.PI+60)} ${f(x)} ${f(y)})" ${SUAVE}/>`;}).join('')}
  <path d="M46 48 L54 52 M54 48 L46 52 M46 112 L54 116 M54 112 L46 116" stroke="${GL}"/>
  ${estrella(50,82,11,4.5,5)}<circle cx="50" cy="82" r="2" fill="${G}"/>
  <path d="M20 34 L25 42 L15 42Z"/><path d="M80 42 L85 34 L75 34Z"/><path d="M15 120 L25 120 L20 128Z M15 124 L25 124"/><path d="M75 128 L85 128 L80 120Z M75 124 L85 124"/>`
];

let uid = 0;
function marco(c, inner, arriba, abajo){
  const id = 't'+(uid++);
  const largo = abajo.length, fs = largo>18 ? 7 : largo>13 ? 7.6 : 8.6;
  return `<svg viewBox="0 0 100 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${abajo}">
<defs><radialGradient id="${id}" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${c.color}"/><stop offset="1" stop-color="#0b0820"/></radialGradient></defs>
<rect width="100" height="170" rx="7" fill="url(#${id})"/>
<rect x="4" y="4" width="92" height="162" rx="5" fill="none" stroke="${G}" stroke-width="1.3"/>
<rect x="7" y="7" width="86" height="156" rx="3.5" fill="none" stroke="${G}" stroke-width=".5" opacity=".65"/>
${[[10,10],[90,10],[10,160],[90,160]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="1.4" fill="${G}"/>`).join('')}
<text x="50" y="22" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="${arriba.length>6?8:10}" font-weight="700" fill="${G}" letter-spacing="1">${arriba}</text>
<path d="M30 26 L70 26" stroke="${G}" stroke-width=".5" opacity=".7"/>
<g fill="none" stroke="${G}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
<path d="M8 140 L92 140 L88 148 L92 156 L8 156 L12 148Z" fill="rgba(8,6,24,.82)" stroke="${G}" stroke-width=".8"/>
<text x="50" y="151" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="${f(fs)}" font-weight="700" fill="${GL}"${largo>14?' textLength="74" lengthAdjust="spacingAndGlyphs"':''}>${abajo}</text>
</svg>`;
}

function frenteSVG(c){
  if(c.mayor) return marco(c, EMBLEMAS[c.num], c.rom, c.nombre);
  let inner='';
  if(c.rango<10){
    const n=c.rango+1, s=PIP_ESC(n);
    inner = PIPS[n].map(p=>`<g transform="translate(${p[0]} ${p[1]}) scale(${s})">${SIMB[c.palo]}</g>`).join('');
  } else {
    inner = TOCADO[c.rango] + `<g transform="translate(50 92) scale(1.9)">${SIMB[c.palo]}</g>`
      + `<path d="M24 126 Q50 118 76 126" stroke-width="1"/>`;
  }
  return marco(c, inner, c.rom, c.nombre);
}

/* dorso: un ñandutí dorado sobre azul noche */
function nanduti(cx,cy,r,anillos=4,hilos=24){
  let s='';
  for(let k=1;k<=anillos;k++) s+=`<circle cx="${cx}" cy="${cy}" r="${f(r*k/anillos)}"/>`;
  s+=rayos(cx,cy,r*0.12,r,hilos,'stroke-width=".5"');
  // pétalos (arcos entre hilos)
  for(let k=0;k<hilos;k++){
    const a1=k*2*Math.PI/hilos, a2=(k+1)*2*Math.PI/hilos, rr=r*0.75, ri=r*0.5;
    s+=`<path d="M${f(cx+rr*Math.cos(a1))} ${f(cy+rr*Math.sin(a1))} Q${f(cx+ri*Math.cos((a1+a2)/2))} ${f(cy+ri*Math.sin((a1+a2)/2))} ${f(cx+rr*Math.cos(a2))} ${f(cy+rr*Math.sin(a2))}" stroke-width=".6"/>`;
    s+=`<circle cx="${f(cx+r*Math.cos((a1+a2)/2))}" cy="${f(cy+r*Math.sin((a1+a2)/2))}" r="${f(r*0.035)}" fill="${G}"/>`;
  }
  return s;
}
const DORSO = `<svg viewBox="0 0 100 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs><radialGradient id="dorsoG" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#3a2a7a"/><stop offset="1" stop-color="#120a30"/></radialGradient></defs>
<rect width="100" height="170" rx="7" fill="url(#dorsoG)"/>
<rect x="4" y="4" width="92" height="162" rx="5" fill="none" stroke="${G}" stroke-width="1.3"/>
<rect x="8" y="8" width="84" height="154" rx="3" fill="none" stroke="${G}" stroke-width=".5" opacity=".6"/>
<g fill="none" stroke="${G}" stroke-width=".8" opacity=".95">${nanduti(50,85,30,4,24)}${estrella(50,85,6,2.5,8)}
${nanduti(18,20,8,2,12)}${nanduti(82,20,8,2,12)}${nanduti(18,150,8,2,12)}${nanduti(82,150,8,2,12)}</g>
<path d="M34 47 A10 10 0 1 0 34 33 A8 8 0 1 1 34 47Z" fill="${G}" opacity=".9" transform="translate(16 -4) scale(.7) translate(10 5)"/>
</svg>`;

window.TAROT = { MAZO, PALOS, MAYORES_N:22, frenteSVG, dorso:()=>DORSO, nanduti, estrella };
})();
