/* =====================================================================
   Tarot Jasy — signos, numerología y la lectura escrita.
   Arma un texto distinto cada vez mezclando: el signo (elemento, planeta),
   el número de vida, el año personal, el tema elegido y las cartas que salieron.
   ===================================================================== */
(function(){
let rnd = Math.random;   // leer() lo cambia por uno con semilla, así un link reproduce la misma lectura
const elige = a => a[Math.floor(rnd()*a.length)];
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);

/* ---------- signos del zodíaco ---------- */
const SIGNOS = [
 {n:'Capricornio',s:'♑',d:[12,22],el:'tierra',pl:'Saturno',arc:15,r:'la ambición paciente y el sentido de la responsabilidad'},
 {n:'Acuario',s:'♒',d:[1,20],el:'aire',pl:'Saturno',arc:17,r:'la originalidad y el amor por la libertad'},
 {n:'Piscis',s:'♓',d:[2,19],el:'agua',pl:'Júpiter',arc:18,r:'la sensibilidad y una imaginación sin límites'},
 {n:'Aries',s:'♈',d:[3,21],el:'fuego',pl:'Marte',arc:4,r:'el impulso de quien abre caminos'},
 {n:'Tauro',s:'♉',d:[4,20],el:'tierra',pl:'Venus',arc:5,r:'la paciencia y el amor por lo seguro y lo lindo'},
 {n:'Géminis',s:'♊',d:[5,21],el:'aire',pl:'Mercurio',arc:6,r:'la curiosidad y la palabra rápida'},
 {n:'Cáncer',s:'♋',d:[6,21],el:'agua',pl:'la Luna',arc:7,r:'la ternura y el instinto de proteger a los suyos'},
 {n:'Leo',s:'♌',d:[7,23],el:'fuego',pl:'el Sol',arc:8,r:'el brillo propio y la generosidad del corazón'},
 {n:'Virgo',s:'♍',d:[8,23],el:'tierra',pl:'Mercurio',arc:9,r:'el detalle, el orden y las ganas de ayudar'},
 {n:'Libra',s:'♎',d:[9,23],el:'aire',pl:'Venus',arc:11,r:'la búsqueda de armonía y belleza'},
 {n:'Escorpio',s:'♏',d:[10,23],el:'agua',pl:'Marte',arc:13,r:'la intensidad y el poder de transformarse'},
 {n:'Sagitario',s:'♐',d:[11,22],el:'fuego',pl:'Júpiter',arc:14,r:'el optimismo y las ganas de aventura'}
];
// índice por la fecha de inicio de cada signo (mes, día)
function signo(dia, mes){
  // SIGNOS[k] empieza en d=[mes,dia]; recorrer de atrás hacia adelante
  const orden = [...SIGNOS].sort((a,b)=> (a.d[0]*100+a.d[1]) - (b.d[0]*100+b.d[1]));
  const v = mes*100+dia; let s = orden[orden.length-1]; // antes del 20/1 → Capricornio
  for(const o of orden) if(v >= o.d[0]*100+o.d[1]) s = o;
  return s;
}

const ELEM = {
 fuego:{desc:'fuego, que da coraje y entusiasmo', clave:'poner pasión y tomar la iniciativa', color:'rojo o dorado', piedra:'el ámbar'},
 tierra:{desc:'tierra, que da constancia y los pies bien plantados', clave:'construir paso a paso, sin apuro pero sin pausa', color:'verde o marrón', piedra:'el jaspe'},
 aire:{desc:'aire, que da ideas claras y facilidad de palabra', clave:'hablar con claridad y pensar antes de actuar', color:'celeste o amarillo', piedra:'el cuarzo transparente'},
 agua:{desc:'agua, que da intuición y un corazón sensible', clave:'dejarte guiar por la intuición y lo que sentís', color:'azul o plateado', piedra:'la amatista'}
};
const DIAS = {'Marte':'martes','Venus':'viernes','Mercurio':'miércoles','la Luna':'lunes','el Sol':'domingo','Júpiter':'jueves','Saturno':'sábado'};
const PALO_ELEM = {bastos:'fuego', copas:'agua', espadas:'aire', oros:'tierra'};
const AMIGOS = {fuego:'aire', aire:'fuego', agua:'tierra', tierra:'agua'};

/* ---------- numerología ---------- */
function reducir(n, maestros=true){
  while(n>9 && !(maestros && (n===11||n===22||n===33))) n = String(n).split('').reduce((a,b)=>a+ +b,0);
  return n;
}
function numeroVida(d,m,a){ return reducir(reducir(d)+reducir(m)+reducir(a)); }
function anioPersonal(d,m,anio){ return reducir(reducir(d)+reducir(m)+reducir(anio), false); }
const NUM = {
 1:'el número de quien lidera y abre caminos propios',
 2:'el número del alma sensible, con el don de unir y conciliar',
 3:'el número de la creatividad, la alegría y la facilidad para expresarse',
 4:'el número de la constancia, el orden y las bases firmes',
 5:'el número de la libertad, la curiosidad y el gusto por el cambio',
 6:'el número del amor a la familia y las ganas de cuidar',
 7:'el número de la mente profunda, la intuición y la búsqueda de la verdad',
 8:'el número del poder de concretar y el talento para lo material',
 9:'el número de la generosidad y la sabiduría de quien ya vivió mucho',
 11:'un número maestro: intuición finísima e inspiración para los demás',
 22:'un número maestro: el de quien construye sueños grandes',
 33:'un número maestro: el del amor que enseña y sana'
};
const ANIO = {
 1:'un año de comienzos: lo que siembres ahora marca los próximos nueve años',
 2:'un año de paciencia y alianzas, donde los vínculos pesan más que la prisa',
 3:'un año de expresión, vida social y alegría',
 4:'un año de trabajo y de poner bases firmes',
 5:'un año de cambios, movimiento y sorpresas',
 6:'un año de hogar, amor y responsabilidades',
 7:'un año de introspección, estudio y crecimiento interior',
 8:'un año de cosecha, logros y asuntos de plata',
 9:'un año de cierres y limpieza, para dejar lugar a lo nuevo'
};

/* ---------- temas ---------- */
const TEMAS = {
 amor:{t:'Amor',gn:'Mborayhu',e:'❤️',palo:'copas',nom:'el amor',
  pos:['En el amor esto se traduce en {k}: un viento a favor para tu corazón.','Para tu vida afectiva, esta carta trae {k}; abrí la puerta sin miedo.','En lo sentimental anuncia {k}, y eso se siente en el pecho.'],
  neu:['En el amor, {k} pide atención: no es bueno ni malo, depende de cómo lo vivas.','En lo afectivo aparece {k}; tomate tu tiempo para entender qué sentís.'],
  neg:['En el amor marca {k}; conviene hablar claro y no guardarse nada.','En tu corazón esto se nota como {k}: cuidate, pero no te cierres.'],
  cierre:{pos:'El amor viene con buena estrella: hay ternura, encuentro y ganas compartidas en tu camino.',
          mix:'El amor está en movimiento: hay cosas lindas y otras por acomodar. La sinceridad va a ser la llave.',
          neg:'El corazón pide pausa y cuidado. No es un “no” para siempre: es un “todavía no”, mientras sanás y te elegís primero.'},
  extra:['Escribile a esa persona que te viene a la mente cuando ves la luna.','Regalate algo lindo: el amor propio también cuenta.','Compartí un tereré y una charla sin apuro: ahí florece lo verdadero.']},
 salud:{t:'Salud',gn:'Tesãi',e:'🌿',palo:'oros',nom:'tu salud y tu bienestar',
  pos:['Para tu bienestar significa {k}: el cuerpo responde cuando lo escuchás.','En la salud trae {k}, una energía que renueva.'],
  neu:['En tu bienestar aparece {k}: buen momento para revisar hábitos.','Para el cuerpo y la mente habla de {k}; escuchá lo que te pide.'],
  neg:['En la salud señala {k}; no lo dejes pasar y date el descanso que merecés.','Para tu bienestar avisa de {k}: bajá un cambio y cuidate.'],
  cierre:{pos:'Tu energía vital está fuerte: buen tiempo para moverte, comer rico y sano, y dormir mejor.',
          mix:'Tu cuerpo te habla en voz baja: pequeños cambios de rutina harán una gran diferencia.',
          neg:'Las cartas piden pausa: descansá, tomá agua, y si algo te preocupa, consultá a quien sabe.'},
  extra:['Un yuyo fresco en el tereré y una caminata al atardecer te van a caer de diez.','Dormí una horita más esta semana.','Respirá hondo tres veces cuando sientas el pecho apretado.']},
 dinero:{t:'Dinero y trabajo',gn:'Pirapire ha tembiapo',e:'💰',palo:'oros',nom:'el dinero y el trabajo',
  pos:['En lo laboral y económico anuncia {k}: buena señal para tus bolsillos.','En el trabajo esto trae {k}; aprovechá la racha.','Para tu plata y tus proyectos significa {k}.'],
  neu:['En el trabajo aparece {k}: momento de ordenar números y prioridades.','En lo económico habla de {k}; ni gastes de más ni te paralices.'],
  neg:['En la plata marca {k}: cuidá los gastos y no firmes nada a las apuradas.','En lo laboral señala {k}; paciencia, que esto también pasa.'],
  cierre:{pos:'Se abre una puerta para la prosperidad: tu esfuerzo empieza a dar frutos y puede llegar una oportunidad concreta.',
          mix:'El panorama económico se mueve: hay oportunidades, pero piden orden y buenas decisiones.',
          neg:'Es tiempo de ajustar el cinturón y planificar. Lo que hoy cuesta, mañana se convierte en experiencia.'},
  extra:['Anotá tus gastos durante una semana: te vas a sorprender.','Guardá una monedita para la suerte en tu billetera.','Hablá de ese proyecto con alguien de confianza: puede abrirte una puerta.']},
 familia:{t:'Familia',gn:'Ogaygua',e:'🏡',palo:'copas',nom:'tu familia',
  pos:['En la familia esto trae {k}: la casa se llena de buena energía.','Para los tuyos significa {k}, y eso une.'],
  neu:['En la familia aparece {k}: escuchá a cada uno antes de opinar.','En casa habla de {k}; un poco de paciencia hace milagros.'],
  neg:['En la familia señala {k}; vale la pena sentarse a hablar con calma.','En casa marca {k}: no tomes partido apurado.'],
  cierre:{pos:'Tu familia es tu fuerza: se vienen encuentros, abrazos y algo para celebrar alrededor de la mesa.',
          mix:'En la familia hay cariño, pero también temas pendientes. Una charla sincera puede destrabar mucho.',
          neg:'Hay tensiones en el hogar que piden paciencia. Poner límites con amor también es cuidar.'},
  extra:['Organizá un almuerzo de domingo, aunque sea sencillo.','Llamá a esa tía o abuela que hace mucho no escuchás.','Una sopa paraguaya compartida arregla más de lo que parece.']},
 amistad:{t:'Amistad',gn:'Angirũ',e:'🤝',palo:'copas',nom:'tus amistades',
  pos:['En la amistad anuncia {k}: buena gente cerca tuyo.','Con tus amigos esto trae {k}, y la ronda se agranda.'],
  neu:['En la amistad aparece {k}: fijate quién está de verdad.','Con tus amistades habla de {k}; elegí bien tus confidentes.'],
  neg:['En la amistad marca {k}; no todos merecen tus secretos.','Con los amigos señala {k}: cuidá tu energía.'],
  cierre:{pos:'Tus amistades son un tesoro: llegan reencuentros, risas y alguien nuevo que suma.',
          mix:'Hay amistades que crecen y otras que se enfrían. Es natural: quedate con las que te hacen bien.',
          neg:'Hay alguien cerca que no juega limpio. Escuchá tu intuición y guardate un poco.'},
  extra:['Armá una ronda de tereré con quienes más querés.','Mandale un audio a ese amigo de siempre.','Decí que no a quien solo aparece cuando necesita algo.']},
 estudios:{t:'Estudios',gn:'Mbo\'e',e:'📚',palo:'espadas',nom:'tus estudios',
  pos:['En los estudios trae {k}: la mente está despierta.','Para tu aprendizaje significa {k}; buen momento para rendir.'],
  neu:['En los estudios aparece {k}: organizá bien tus tiempos.','Para aprender habla de {k}; constancia antes que velocidad.'],
  neg:['En los estudios señala {k}; pedí ayuda sin vergüenza.','Para tu aprendizaje marca {k}: repasá con calma.'],
  cierre:{pos:'Tu mente está en su mejor momento: lo que estudies ahora se queda, y los exámenes vienen con buena estrella.',
          mix:'Vas bien, aunque hay temas que cuestan. La constancia le gana al talento cuando el talento no estudia.',
          neg:'El camino del estudio se puso cuesta arriba, pero no es imposible. Cambiá de método y pedí una mano.'},
  extra:['Estudiá en bloques cortos con mate o tereré al lado.','Explicale el tema a alguien: si lo podés contar, lo sabés.','Dormí bien antes del examen; la memoria trabaja de noche.']},
 cambios:{t:'Viajes y cambios',gn:'Jeguata',e:'🧭',palo:'bastos',nom:'los viajes y los cambios',
  pos:['Para tus cambios anuncia {k}: el camino se abre.','En viajes y mudanzas trae {k}; buena época para moverse.'],
  neu:['En los cambios aparece {k}: planificá antes de saltar.','Para los viajes habla de {k}; revisá bien cada detalle.'],
  neg:['En los cambios señala {k}; quizás convenga esperar un poco.','Para moverte marca {k}: no fuerces lo que no fluye.'],
  cierre:{pos:'El viento sopla a favor: un cambio, un viaje o una mudanza puede traer justo lo que buscás.',
          mix:'El cambio llega, pero a su ritmo. Prepará la valija sin desesperar.',
          neg:'Las cartas aconsejan prudencia: no es momento de saltar sin red. Prepará bien el terreno.'},
  extra:['Escribí en un papel adónde querés estar dentro de un año.','Ordená un cajón: mover cosas chicas mueve energías grandes.','Mirá el atardecer sobre el río y preguntale qué sigue.']},
 general:{t:'Pregunta general',gn:'Porandu',e:'🔮',palo:null,nom:'tu consulta',
  pos:['Para tu consulta esto trae {k}: una buena señal.','En lo que preguntás aparece {k}, una energía que empuja hacia adelante.'],
  neu:['En tu consulta aparece {k}: todavía hay cosas que dependen de vos.','Para lo que preguntás habla de {k}; mirá todos los lados.'],
  neg:['En tu consulta señala {k}; conviene ir con cuidado.','Para lo que preguntás marca {k}: no es el final, es un aviso.'],
  cierre:{pos:'La respuesta de las cartas es luminosa: el camino se abre y lo que buscás está más cerca de lo que creés.',
          mix:'La respuesta es un “sí, pero…”: hay luz al final, aunque el camino pide paciencia y decisiones claras.',
          neg:'Las cartas piden prudencia: hoy no es el momento de forzar las cosas. Esperá, observá, y la puerta va a aparecer.'},
  extra:['Esta noche, antes de dormir, hacé tu pregunta en voz baja: la respuesta puede llegar en un sueño.','Prendé una vela y escribí lo que te preocupa; después soltalo.','Prestá atención a las señales de los próximos tres días.']}
};

/* ---------- para cuándo: hoy, la semana, el mes, el año ---------- */
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_S = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const PERIODOS = {
 dia:{n:'Hoy', d:'Del día', un:'un día', ese:'este día', carta:'Tu carta del día', tres:['La mañana','La tarde','La noche'], tresF:['Por la mañana','Por la tarde','Cuando caiga la noche']},
 semana:{n:'Semana', d:'Esta semana', un:'una semana', ese:'esta semana', carta:'Tu carta de la semana', tres:['Inicio de semana','Mitad de semana','Fin de semana'], tresF:['Al empezar la semana','A mitad de semana','Para el fin de semana']},
 mes:{n:'Mes', d:'Este mes', un:'un mes', ese:'este mes', carta:'Tu carta del mes', tres:['Primeros días','Mediados de mes','Fin de mes'], tresF:['En los primeros días','A mediados de mes','Para el cierre del mes']},
 anio:{n:'Año', d:'Este año', un:'un año', ese:'este año', carta:'Tu carta del año', tres:['Pasado','Presente','Futuro'], tresF:['En tu pasado','En tu presente','Hacia el futuro']},
 libre:{n:'Sin plazo', d:'Sin fecha', carta:'Tu mensaje'}
};
const ENERGIA = {
 1:'de comienzos: animate a dar el primer paso',
 2:'de paciencia y acuerdos: mejor juntos que solos',
 3:'de alegría, charla y creatividad',
 4:'de trabajo y orden: lo que construyas queda firme',
 5:'de movimiento y sorpresas: estate atento a lo inesperado',
 6:'de hogar, amor y gente querida',
 7:'de calma y reflexión: escuchá tu voz interior',
 8:'de logros y cosecha: lo que sembraste empieza a rendir',
 9:'de cierres y limpieza: soltá lo que ya no va'
};
function hoyMismo(f){ const h=new Date(); return f.getFullYear()===h.getFullYear() && f.getMonth()===h.getMonth() && f.getDate()===h.getDate(); }
// el texto del plazo, con la fecha escrita (así un link visto otro día sigue siendo correcto)
function cuando(per, f){
  const dm = x => `${x.getDate()} de ${MESES[x.getMonth()]}`;
  if(per==='dia') return (hoyMismo(f) ? 'hoy, ' : 'el ') + `${DIAS_S[f.getDay()]} ${dm(f)}`;
  if(per==='semana'){
    const lu = new Date(f.getFullYear(), f.getMonth(), f.getDate() - (f.getDay()+6)%7), dom = new Date(lu.getFullYear(), lu.getMonth(), lu.getDate()+6);
    return `la semana del ${lu.getDate()}${lu.getMonth()!==dom.getMonth()?' de '+MESES[lu.getMonth()]:''} al ${dm(dom)}`;
  }
  if(per==='mes') return `${MESES[f.getMonth()]} de ${f.getFullYear()}`;
  if(per==='anio') return `el año ${f.getFullYear()}`;
  return '';
}
// número personal del plazo (numerología: año personal + mes + día)
function numPlazo(pf, per, f){
  if(per==='mes') return reducir(pf.ap + reducir(f.getMonth()+1), false);
  if(per==='dia' || per==='semana') return reducir(pf.ap + reducir(f.getMonth()+1) + reducir(f.getDate()), false);
  return pf.ap;
}

/* ---------- tiradas ---------- */
const TIRADAS = {
 1:{n:'Una carta',d:'Un mensaje directo',pos:[{n:'Tu mensaje',f:'Para tu consulta'}]},
 3:{n:'Tres cartas',d:'Pasado · presente · futuro',pos:[{n:'Pasado',f:'En tu pasado'},{n:'Presente',f:'En tu presente'},{n:'Futuro',f:'Hacia el futuro'}]},
 5:{n:'La cruz',d:'Cinco cartas en cruz',pos:[{n:'Tu situación',f:'En el centro de tu situación'},{n:'A tu favor',f:'Como aliada'},{n:'En contra',f:'Como obstáculo'},{n:'El consejo',f:'Como consejo'},{n:'Resultado',f:'Como resultado probable'}]}
};
const VERBO = ['aparece','se muestra','sale','se presenta'];

/* ---------- el mensaje de Jasy: lo que hace distinta a cada lectura ----------
   Se elige según el tono de las cartas, las cartas que salieron, el tema y el azar. */
const ARQ = [
 {id:'alerta', e:'⚠️', t:'Cuidado: algo se acerca', ton:['neg'], cartas:['M15','M16','M18','E3','E5','E7','E9','E10'],
  v:['Las cartas encienden una luz de alerta: alguien cerca tuyo no es tan sincero como parece. No cuentes tus planes a cualquiera y fijate quién se alegra de verdad con tus logros.',
     'Se asoma un tropiezo en el camino: un gasto inesperado, una discusión o una noticia que no esperabas. No es para asustarse, es para estar alerta: el que avisa no traiciona.',
     'Hay una energía pesada dando vueltas a tu alrededor. Cuidá tu salud, tu plata y tus palabras en los próximos días, y no firmes ni prometas nada a las apuradas.',
     'Jasy ve nubes negras en el horizonte, pero también ve que tenés con qué enfrentarlas. Prestá atención a las señales chicas: ellas avisan antes de la tormenta.']},
 {id:'proteccion', e:'🛡️', t:'Protegé tu energía', ton:['neg','mix'], cartas:['M15','E8','E9','B9','M9'],
  v:['Hay envidia rondando. Una ramita de ruda en el bolsillo o en la puerta de tu casa, como hacían las abuelas, y menos detalles de tu vida en las redes.',
     'Estás dando mucho y recibiendo poco. Aprendé a decir “no” sin culpa: cuidar tu energía también es una forma de quererte.',
     'Alejate de las personas que solo aparecen para quejarse o pedir. Rodeate de gente que suma y tu suerte va a cambiar sola.']},
 {id:'amorpropio', e:'💗', t:'El amor empieza en vos', ton:['mix','neg','pos'], temas:['amor','amistad','salud'], cartas:['M3','M8','M14','M17','C1','C9','O9'],
  v:['Antes de buscar amor afuera, las cartas te piden que lo busques adentro. Mirate al espejo con ternura: nadie te va a querer bien si vos no te querés primero.',
     'Te pasaste mucho tiempo cuidando a los demás. Ahora toca cuidarte a vos: un paseo sin apuro, tu comida favorita, un rato de silencio. Te lo merecés.',
     'El corazón que buscás empieza en el tuyo. Cuando te elegís, atraés a quien también te elige. No te conformes con migajas.']},
 {id:'renacer', e:'🦋', t:'Renacer', ton:['mix','neg'], cartas:['M13','M16','M20','M12','E10','C5'],
  v:['Algo se termina, y está bien que así sea. Como el lapacho que pierde sus hojas antes de florecer, estás por renacer con más fuerza.',
     'Un ciclo se cierra para que otro empiece. Lo que hoy duele es la puerta de algo mejor: no la sostengas cerrada con miedo.',
     'Te estás transformando, aunque todavía no lo veas. Dentro de un tiempo vas a mirar atrás y agradecer este momento.']},
 {id:'bendicion', e:'🌟', t:'Una bendición en camino', ton:['pos'], cartas:['M19','M17','M21','M10','C10','O10','C1'],
  v:['Se viene una alegría que no esperabas: una noticia linda, un mensaje, un abrazo. Dejá la puerta abierta y el celular cerca.',
     'Las estrellas se alinearon a tu favor. Lo que pediste con fe está por llegar, quizás no como lo imaginaste, pero sí como lo necesitás.',
     'Hay buena suerte acompañándote. Animate a ese paso que venías postergando: ahora el viento sopla a favor.',
     'Jasy y Kuarahy te sonríen: se acerca un tiempo de alivio, de risas y de cosas que por fin salen bien.']},
 {id:'abundancia', e:'💰', t:'Abundancia', ton:['pos','mix'], temas:['dinero','estudios'], cartas:['O1','O3','O6','O8','O9','O10','M1','M4'],
  v:['Las cartas huelen a prosperidad: una entrada de plata, un trabajo nuevo o un negocio que empieza a rendir. Tené tus papeles en orden.',
     'Tu esfuerzo está por dar frutos. Lo que sembraste con paciencia empieza a crecer: no aflojes justo ahora.',
     'Alguien va a reconocer lo que valés. Cuando llegue la oportunidad, no te achiques: pedí lo que corresponde.']},
 {id:'sorpresa', e:'🎲', t:'Una sorpresa', ton:['pos','mix'], cartas:['M0','M10','M7','B8','E6','B3'],
  v:['Algo inesperado va a mover tu rutina: una invitación, un viaje, una persona nueva. Decí que sí a lo que te dé curiosidad.',
     'La rueda gira y te toca a vos. Un cambio que no planeaste puede ser justo lo que tu vida pedía.',
     'Preparate para sorprenderte: lo que parecía trabado se destraba de golpe, y por donde menos lo esperabas.']},
 {id:'paciencia', e:'⏳', t:'Todavía no: paciencia', ton:['mix','neg'], cartas:['M12','M9','M14','O4','O7','B4','E4'],
  v:['La semilla ya está plantada, pero todavía está bajo la tierra. No la desentierres para ver si creció: dale tiempo.',
     'No es un “no”, es un “todavía no”. Lo que esperás llega, pero a su ritmo. Mientras tanto, preparate para recibirlo.',
     'Bajá un cambio. Forzar las cosas ahora las puede romper; esperar un poco las va a acomodar solas.']},
 {id:'decision', e:'⚖️', t:'Una decisión importante', ton:['mix'], cartas:['M6','M11','E2','C7','M7'],
  v:['Estás frente a dos caminos y no podés tomar los dos. Escuchá a tu cabeza, pero decidí con el corazón.',
     'Hay una decisión que venís postergando. Las cartas dicen que ya es hora: lo que no se decide, se decide solo.',
     'Pesá bien las cosas, como la balanza de la justicia. La respuesta correcta es la que te deja dormir en paz.']},
 {id:'soltar', e:'🍃', t:'Soltá lo que pesa', ton:['neg','mix'], cartas:['C5','C8','E3','B10','M13','M9'],
  v:['Estás cargando algo que ya no te corresponde: un rencor, una culpa o una persona que no suma. Soltalo y vas a respirar distinto.',
     'Hay un capítulo que ya terminó, aunque te cueste aceptarlo. Darlo vuelta no es olvidar: es dejar lugar para lo nuevo.',
     'No todo lo que se va es una pérdida. A veces la vida te saca de lugares donde ya no podías crecer.']},
 {id:'reencuentro', e:'🔄', t:'Alguien vuelve', ton:['pos','mix'], temas:['amor','familia','amistad'], cartas:['C6','C2','C3','M6','C10'],
  v:['Alguien del pasado va a reaparecer: un mensaje, una visita o un cruce casual. Fijate qué te despierta antes de abrir la puerta.',
     'Se viene un reencuentro con alguien querido. Puede ser una charla pendiente que por fin se da, con tereré de por medio.',
     'Un lazo que parecía cortado se vuelve a tejer, como un ñandutí que se arregla hilo por hilo.']},
 {id:'intuicion', e:'🌙', t:'Escuchá tu intuición', ton:['mix','neg','pos'], cartas:['M2','M18','M17','C7','E8'],
  v:['Tu intuición está más despierta que nunca. Ese presentimiento que tuviste no es casualidad: hacele caso.',
     'Prestá atención a tus sueños de estas noches: traen respuestas que la cabeza todavía no entiende.',
     'No todo lo que te dicen es verdad. Cuando algo no te cierra, confiá en esa vocecita interior.']},
 {id:'sanacion', e:'🌿', t:'Tiempo de sanar', ton:['mix','pos'], temas:['salud','familia','amor'], cartas:['M14','M17','C6','O4','B6'],
  v:['Una herida vieja empieza a cerrar. Date permiso para estar bien, aunque todavía duela un poquito.',
     'Tu cuerpo y tu alma piden descanso. Un yuyo en el tereré, una siesta larga y menos preocupaciones: así empieza a sanar todo.',
     'Perdonar, aunque sea en silencio, te va a quitar un peso enorme de encima. No es por el otro: es por vos.']},
 {id:'camino', e:'🧭', t:'Camino abierto', ton:['pos'], temas:['cambios','estudios','dinero'], cartas:['M7','M0','B8','B3','B6','E6'],
  v:['Se abre un camino que antes estaba cerrado. Es momento de moverse: lo que esperás no va a tocar tu puerta, hay que ir a buscarlo.',
     'Un viaje, una mudanza o un proyecto nuevo te está llamando. Prepará la valija, aunque sea la del alma.',
     'Todo empuja hacia adelante. Si estabas por arrancar algo, este es el momento.']}
];
function elegirArq(tono, sacadas, temaId){
  const ids = sacadas.map(t=>t.c.id);
  const pesos = ARQ.map(a=>{
    let w = a.ton.includes(tono) ? (a.ton[0]===tono ? 3 : 1.5) : 0.15;
    if(a.cartas && ids.some(i=>a.cartas.includes(i))) w *= 4;
    if(a.temas && a.temas.includes(temaId)) w *= 2;
    return w;
  });
  let x = rnd()*pesos.reduce((a,b)=>a+b,0);
  for(let i=0;i<ARQ.length;i++){ x -= pesos[i]; if(x<=0) return ARQ[i]; }
  return ARQ[0];
}

function polaridad(t){ return t.inv ? t.c.q : t.c.p; }
function banda(v){ return v>0.35 ? 'pos' : v<-0.05 ? 'neg' : 'neu'; }

/* perfil a partir de nombre y fecha */
function perfil(nombre, d, m, a, fecha){
  const s = signo(d,m), nv = numeroVida(d,m,a), anio = (fecha||new Date()).getFullYear();
  return perfilDe({n:nombre, s:SIGNOS.indexOf(s), nv, ap:anioPersonal(d,m,anio), anio});
}
// perfil sin la fecha de nacimiento (es lo que viaja en un link compartido)
function perfilDe(o){
  const s = SIGNOS[o.s] || SIGNOS[0], nv = NUM[o.nv] ? o.nv : 1;
  return {nombre:String(o.n||'').trim().slice(0,30), signo:s, si:SIGNOS.indexOf(s), nv, ap: ANIO[o.ap] ? o.ap : 1, anio:o.anio||new Date().getFullYear(),
    arcSigno:s.arc, arcNum: nv===22?0 : nv>21 ? reducir(nv,false) : nv};
}

/* ---------- la lectura ---------- */
function posiciones(tiradaId, per){
  const TI = TIRADAS[tiradaId], P = PERIODOS[per] || PERIODOS.libre;
  if(+tiradaId===1) return [{n:P.carta, f:'Para vos'}];
  if(+tiradaId===3 && P.tres) return P.tres.map((n,k)=>({n, f:P.tresF[k]}));
  return TI.pos;
}
function leer(pf, temaId, tiradaId, sacadas, pregunta, soloMayores, opc={}){
  const per = PERIODOS[opc.per] ? opc.per : 'libre', fecha = opc.fecha || new Date(), PR = PERIODOS[per];
  rnd = mulberry(opc.seed!=null ? opc.seed : Math.random()*4294967296>>>0);
  const T = TEMAS[temaId], TI = {...TIRADAS[tiradaId], pos:posiciones(tiradaId, per)}, M = window.TAROT.MAZO;
  const cuandoTxt = cuando(per, fecha);
  const nom = pf.nombre;
  const out = [];   // párrafos (HTML)
  const saludo = nom
    ? elige([`${esc(nom)}, Jasy ya iluminó tus cartas.`, `Mba'éichapa, ${esc(nom)}. Las cartas se abrieron para vos.`, `${esc(nom)}, el ñandutí de tu destino empezó a mostrar su dibujo.`,
        `${esc(nom)}, la luna bajó a mirar tu mesa y las cartas hablaron.`, `Bienvenida tu alma, ${esc(nom)}: las cartas tienen algo para decirte.`, `${esc(nom)}, entre el humo del palo santo y la luz de Jasy, tus cartas se revelaron.`])
    : elige(['Alma curiosa: Jasy ya iluminó tus cartas.', 'Mba\'éichapa. Las cartas se abrieron para vos.', 'El ñandutí de tu destino empezó a mostrar su dibujo.',
        'La luna bajó a mirar tu mesa y las cartas hablaron.', 'Bienvenida tu alma: las cartas tienen algo para decirte.', 'Entre el humo del palo santo y la luz de Jasy, tus cartas se revelaron.']);
  const preg = pregunta ? ` Tu pregunta, <i>“${esc(pregunta)}”</i>, quedó flotando sobre la mesa mientras barajábamos.` : '';
  out.push({cls:'intro', h:`${saludo} Consultaste por <b>${T.t.toLowerCase()}</b> <span class="gn">(${T.gn})</span>${cuandoTxt?` para <b>${cuandoTxt}</b>`:''}.${preg}`});

  const E = ELEM[pf.signo.el];
  out.push({cls:'astro', h:elige([
      `Naciste bajo <b>${pf.signo.s}︎ ${pf.signo.n}</b>, signo de ${E.desc}, regido por ${pf.signo.pl}. Llevás en vos ${pf.signo.r}. `,
      `Tu signo es <b>${pf.signo.s}︎ ${pf.signo.n}</b>: ${pf.signo.pl} te gobierna y el elemento ${E.desc.replace(/,.*/,'')} corre por tus venas. Por eso tenés ${pf.signo.r}. `,
      `Las estrellas te marcaron con <b>${pf.signo.s}︎ ${pf.signo.n}</b>, con la fuerza del ${E.desc.replace(/,.*/,'')} y la guía de ${pf.signo.pl}. Tu don es ${pf.signo.r}. `])
    + `Tu número de vida es el <b>${pf.nv}</b>, ${NUM[pf.nv]}, y este ${pf.anio} es para vos ${ANIO[pf.ap]}. `
    + (per==='dia'||per==='semana'||per==='mes' ? `Para ${PR.ese} tu número personal es el <b>${numPlazo(pf,per,fecha)}</b>, que anuncia ${PR.un} ${ENERGIA[numPlazo(pf,per,fecha)]}. ` : '')
    + `En ${T.nom}, tu elemento te dice que la clave es ${E.clave}.`});

  // cada carta
  sacadas.forEach((t,k)=>{
    const c=t.c, P=TI.pos[k], pol=polaridad(t), b=banda(pol);
    const kw = elige(t.inv ? c.ki : c.kn);
    const apl = elige(T[b]).replace('{k}', `<b>${kw}</b>`);
    const nombreC = `${art(c)}<b class="cn">${c.nombre}</b>${t.inv?' <span class="inv">(invertida)</span>':''}`;
    let pre = `${P.f} ${elige(VERBO)} ${nombreC}.`;
    out.push({cls:'carta', pos:P.n, id:c.id, h:`${pre} ${t.inv?c.i:c.n} ${apl}`});
  });

  // síntesis
  const sint = [];
  const nMay = sacadas.filter(t=>t.c.mayor).length, nInv = sacadas.filter(t=>t.inv).length, N = sacadas.length;
  if(soloMayores) sint.push(N>1 ? 'Tiraste solo con los Arcanos Mayores, las cartas del destino: cada una pesa fuerte en tu camino.' : 'Tu carta es un Arcano Mayor, una carta del destino: el mensaje viene con fuerza.');
  else if(N>1 && nMay >= Math.ceil(N/2)) sint.push(`Que salgan ${nMay} Arcanos Mayores no es casualidad: son fuerzas grandes del destino moviéndose a tu alrededor, y lo que pasa ahora tiene peso para tu camino.`);
  else if(N>1 && nMay===0) sint.push('No salió ningún Arcano Mayor: la situación está en tus manos y depende de las decisiones de todos los días.');
  else if(N===1 && nMay===1) sint.push('Que tu única carta sea un Arcano Mayor le da un peso especial: es un mensaje del destino, no de un día cualquiera.');
  // palo dominante
  const cuenta = {}; sacadas.forEach(t=>{ if(!t.c.mayor) cuenta[t.c.palo]=(cuenta[t.c.palo]||0)+1; });
  const dom = Object.keys(cuenta).sort((a,b)=>cuenta[b]-cuenta[a])[0];
  if(dom && cuenta[dom]>=2){
    const P = window.TAROT.PALOS[dom], el = PALO_ELEM[dom];
    let rel = el===pf.signo.el ? `Es tu mismo elemento: las cartas hablan tu idioma, y eso te da ventaja.`
      : AMIGOS[el]===pf.signo.el ? `Se lleva bien con tu ${pf.signo.el}, así que la energía fluye a tu favor.`
      : `No es tu elemento (sos de ${pf.signo.el}), así que te toca salir un poco de tu forma de ser habitual.`;
    sint.push(`Predominan las <b>${P.n}</b>, que representan ${P.desc}. ${rel}`);
  } else if(T.palo && cuenta[T.palo]){
    sint.push(`Salieron ${window.TAROT.PALOS[T.palo].n}, el palo que mejor habla de ${T.nom}: las cartas fueron directo al grano.`);
  }
  if(N>1 && nInv >= Math.ceil(N/2)) sint.push('Varias cartas salieron invertidas: hay energía trabada que pide paciencia y mirar las cosas con otros ojos.');
  else if(N>2 && nInv===0) sint.push('Ninguna carta salió invertida: la energía corre derecha y sin vueltas.');
  // arcanos personales
  const ids = sacadas.map(t=>t.c.id);
  const aS = M[pf.arcSigno], aN = M[pf.arcNum];
  if(ids.includes(aS.id)) sint.push(`¡Salió <b>${aS.nombre}</b>, el arcano de ${pf.signo.n}! Tu signo se metió en la tirada para reforzar el mensaje.`);
  if(ids.includes(aN.id) && aN.id!==aS.id) sint.push(`¡Salió <b>${aN.nombre}</b>, el arcano de tu número de vida! Eso confirma que esta lectura es muy tuya.`);
  if(sint.length) out.push({cls:'sint', h:sint.join(' ')});

  // tono general: pesa más el futuro / resultado
  let tot=0, peso=0;
  sacadas.forEach((t,k)=>{ const w = (N===3&&k===2)||(N===5&&k===4) ? 1.6 : (N===5&&k===2) ? 0.7 : 1; tot+=polaridad(t)*w; peso+=w; });
  const prom = tot/peso + (rnd()-0.5)*0.12;   // un poco de azar para que no siempre caiga igual
  const tono = prom > 0.38 ? 'pos' : prom < 0.06 ? 'neg' : 'mix';
  const clave = N===5 ? sacadas[3] : sacadas[N-1];
  const consejo = clave.c.consejo || elige(T.extra);
  const numSuerte = ((pf.nv*7 + sacadas.reduce((a,t)=>a+t.c.num,0)) % 90) + 1;
  const cierre = cuandoTxt ? `${cap(cuandoTxt.replace(/^el año /,''))}: ${T.cierre[tono].charAt(0).toLowerCase()+T.cierre[tono].slice(1)}` : T.cierre[tono];
  const arq = elegirArq(tono, sacadas, temaId), arqTxt = elige(arq.v);
  out.push({cls:'arq', h:`<span class="pos">${arq.e} El mensaje de Jasy: ${arq.t}</span>${arqTxt}`});
  out.push({cls:'final', h:`<b>${cierre}</b> ${N===5?'La carta del consejo':'Tu carta clave'}, ${art(clave.c)}${clave.c.nombre}, te susurra: <i>«${consejo}»</i> ${elige(T.extra.filter(e=>e!==consejo))}`});
  out.push({cls:'suerte', h:`Tu número de la suerte: <b>${numSuerte}</b> · Color: <b>${E.color}</b> · ${per==='dia' ? `Hora de suerte: <b>${(numSuerte*7)%12+9} h</b>` : `Día favorable: <b>${DIAS[pf.signo.pl]}</b>`} · Piedra: <b>${E.piedra}</b>`});
  out.push({cls:'despedida', h:elige(['Que Jasy y Kuarahy te acompañen. ¡Jajotopata!','Guardá esta lectura en el corazón y volvé cuando la luna cambie. ¡Jajotopata!','Las cartas muestran caminos, pero quien camina sos vos. ¡Jajotopata!',
    'Que el ñandutí de tu destino se teja con hilos de oro. ¡Jajotopata!','Andá en paz, que las estrellas cuidan a quien se anima a preguntar. ¡Jajotopata!','Volvé cuando el corazón te lo pida: la mesa siempre te espera. ¡Jajotopata!'])});

  rnd = Math.random;
  return {parrafos:out, tono, resumen:T.cierre[tono], cierre, numSuerte, cuando:cuandoTxt, pos:TI.pos, consejo,
    color:E.color, clave:N===5?3:N-1, arq:{e:arq.e, t:arq.t, txt:arqTxt}};
}
function art(c){ return c.mayor ? '' : (c.rango===10||c.rango===12 ? 'la ' : 'el '); }
function esc(s){ return String(s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

window.LECTURA = { SIGNOS, TEMAS, TIRADAS, PERIODOS, ELEM, perfil, perfilDe, leer, posiciones, cuando, signo, numeroVida, esc, cap };
})();
