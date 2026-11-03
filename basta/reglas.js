'use strict';
/* =====================================================================
   Basta PY — el Basta de lápiz y papel (Tutti Frutti): sale una letra y
   todos escriben una palabra por categoría. El primero que completa grita
   ¡BASTA!, se revisan las palabras entre todos y se cuentan los puntos.
   Todo lo decide el anfitrión. Acá: letras, categorías, reglas, puntos y bots.
   ===================================================================== */
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ====================== LETRAS Y CATEGORÍAS ====================== */
const EASY='ABCDEFGHIJLMNOPRSTUV'.split(''), HARD='KÑQWXYZ'.split('');
const PRESETS={
  clasica:  {t:'📝 Clásica', c:['Nombre','Apellido','País','Ciudad','Animal','Fruta o verdura','Color','Cosa']},
  paraguaya:{t:'🇵🇾 Paraguaya', c:['Nombre','Apellido','Ciudad de Paraguay','Comida o bebida típica','Palabra en guaraní','Animal','Cosa de la casa','Marca']},
  escuela:  {t:'🎒 De la escuela', c:['Nombre','País','Animal','Fruta o verdura','Profesión u oficio','Deporte','Parte del cuerpo','Cosa']},
  corta:    {t:'⚡ Corta (5 categorías)', c:['Nombre','Animal','Fruta o verdura','Color','Cosa']},
  propia:   {t:'✍️ Propia (las escribe el anfitrión)', c:[]},
};
// palabras que conocen los bots (también sirven para reconocer las categorías propias)
const DIC={
  nombre:'Ana Andrés Alicia Alberto Blanca Bruno Beatriz Benjamín Carlos Carmen Clara Cristian Daniel Diana Diego Dora Elena Emilio Esteban Eva Fabián Fernando Flor Florencia Gabriel Gloria Gustavo Graciela Hugo Héctor Helena Hilda Inés Iván Irma Ignacio Javier Julia Juan Jazmín Karina Kevin Karen Katia Laura Luis Lorena Lucas Marta Mario Miguel María Natalia Nicolás Nora Norma Óscar Olga Omar Oriana Pablo Patricia Pedro Paola Quintín Quique Raquel Ramón Rosa Rodrigo Sara Sergio Silvia Sonia Tomás Teresa Tania Ulises Úrsula Ubaldo Valeria Víctor Vanesa Walter Wilma William Ximena Xavier Yolanda Yanina Yésica Zoe Zulma Zacarías',
  apellido:'Acosta Aguilar Ayala Benítez Báez Bogado Cabrera Cáceres Cardozo Díaz Duarte Domínguez Escobar Espínola Estigarribia Fernández Figueredo Franco Giménez González Galeano Gauto Herrera Ibarra Insfrán Irala Jara Jiménez Juárez Krause Kim López Leiva Martínez Medina Morínigo Núñez Nogués Ortiz Ocampo Orué Paredes Pereira Peralta Quintana Quiñónez Ramírez Rojas Riquelme Sánchez Santacruz Sosa Torres Talavera Torales Urbieta Ugarte Valdez Villalba Vera Wagner Weiss Yegros Yampey Zárate Zayas Zaracho',
  pais:'Argentina Alemania Australia Bolivia Brasil Bélgica Chile Colombia Canadá China Dinamarca Ecuador Egipto España Estados_Unidos Francia Finlandia Filipinas Grecia Guatemala Ghana Honduras Haití Holanda India Italia Irlanda Japón Jamaica Jordania Kenia Kuwait Letonia Líbano Luxemburgo México Marruecos Noruega Nicaragua Nigeria Omán Paraguay Perú Portugal Panamá Qatar Rusia Rumania Ruanda Suecia Suiza Senegal Turquía Tailandia Túnez Uruguay Ucrania Uganda Venezuela Vietnam Yemen Zambia Zimbabue',
  ciudad:'Asunción Atenas Ámsterdam Barcelona Berlín Buenos_Aires Bogotá Caracas Córdoba Chicago Dublín Dakar Edimburgo Estambul Florencia Frankfurt Ginebra Guadalajara Hamburgo Houston Ibiza Jerusalén Johannesburgo Kiev Kioto Lima Londres Lisboa Madrid Miami Montevideo Nápoles Nueva_York Niza Oslo Oporto Ottawa París Praga Quito Querétaro Roma Río_de_Janeiro Rosario Santiago Sevilla Tokio Toronto Turín Upsala Valencia Viena Varsovia Washington Yakarta Zúrich Zaragoza',
  animal:'Águila Araña Avestruz Burro Búho Ballena Caballo Cabra Cocodrilo Delfín Dromedario Elefante Erizo Foca Flamenco Gato Gallina Gorila Hormiga Hipopótamo Halcón Iguana Impala Jaguar Jirafa Jabalí Koala Kiwi León Lobo Loro Mono Mariposa Murciélago Nutria Ñandú Oso Oveja Orca Pato Perro Pingüino Puma Quirquincho Ratón Rana Rinoceronte Sapo Serpiente Suricata Tigre Tortuga Tucán Urraca Vaca Víbora Venado Wombat Yacaré Yaguareté Zorro Zorrino',
  fruta:'Ananá Arveja Ajo Banana Batata Berenjena Cereza Coco Calabaza Durazno Damasco Espinaca Frutilla Frambuesa Guayaba Granada Higo Haba Kiwi Lechuga Limón Mango Manzana Mandioca Melón Naranja Nabo Níspero Ñame Oliva Pera Papaya Pepino Pomelo Quinoto Rabanito Repollo Sandía Tomate Toronja Uva Uvilla Vainilla Yuca Zanahoria Zapallo',
  color:'Amarillo Azul Añil Blanco Bordó Beige Celeste Coral Crema Dorado Esmeralda Fucsia Gris Granate Habano Índigo Jade Kaki Lila Lavanda Marrón Magenta Morado Naranja Negro Ocre Oro Plateado Púrpura Rojo Rosa Salmón Sepia Turquesa Terracota Uva Verde Violeta Vino Zafiro',
  cosa:'Anillo Auto Almohada Botella Balde Bicicleta Cama Cuchara Celular Dado Dedal Escoba Espejo Florero Foco Guitarra Gorra Heladera Hacha Imán Jarra Jabón Kayak Lápiz Libro Lámpara Mesa Martillo Mochila Navaja Nevera Olla Ojota Pelota Peine Plato Quena Reloj Radio Silla Sartén Sombrero Taza Tijera Televisor Uniforme Vaso Ventana Valija Xilófono Yoyó Zapato Zapatilla',
  comida:'Arroz Asado Albóndiga Budín Bife Chipa Croqueta Durazno_en_almíbar Empanada Fideo Flan Galleta Guiso Hamburguesa Helado Jamón Lasaña Locro Milanesa Mbejú Ñoquis Omelette Pizza Puchero Queso Ravioles Sopa Sándwich Torta Tarta Tortilla Vori_vori Yogur Zapallito_relleno',
  comidapy:'Asado Arroz_quesú Batiburrillo Bori_bori Chipa Chipa_guazú Caburé Cocido Dulce_de_mamón Empanada Guiso Jopará Kosereva Kivevé Locro Lampreado Mbejú Mazamorra Mate Milanesa Ñoquis Pira_caldo Puchero Queso_paraguay Remolacha_rallada Sopa_paraguaya Soyo Tereré Tortilla Vori_vori Yerba_mate',
  guarani:'Aguyje Ama Ára Arandu Che Chipa Eju Guasu Hína Iñakã Jagua Jasy Jaha Karai Kuñataĩ Kuarahy Kure Mitã Mbarete Ñande Ñemby Oga Ohó Pirá Pytã Porã Pyhare Rory Sapukái Tata Tesãi Tembiapo Vaka Yvy Yvoty Yva',
  marca:'Adidas Apple Audi BMW Bimbo Coca_Cola Canon Chevrolet Dell Danone Duracell Ford Fiat Fanta Google Gucci Honda HP Ikea Intel Jeep Kodak Kia LG Lego Mercedes Nike Nestlé Nokia Oreo Omo Pepsi Puma Philips Quilmes Reebok Renault Samsung Sony Toyota Tigo Unilever Uber Volkswagen Visa Xbox Yamaha Zara',
  profesion:'Abogado Arquitecto Albañil Bombero Barbero Carpintero Cocinero Chofer Dentista Doctor Electricista Enfermero Escritor Farmacéutico Fotógrafo Granjero Guía Herrero Ingeniero Joyero Jardinero Juez Kinesiólogo Locutor Maestro Mecánico Médico Músico Niñera Notario Obrero Odontólogo Panadero Periodista Pintor Plomero Químico Recepcionista Sastre Secretario Taxista Traductor Urólogo Veterinario Vendedor Zapatero Zoólogo',
  deporte:'Atletismo Ajedrez Básquet Béisbol Boxeo Ciclismo Críquet Canotaje Dardos Esgrima Equitación Fútbol Futsal Golf Gimnasia Handball Hockey Judo Karate Kickboxing Lucha Mini_golf Natación Pádel Patinaje Polo Remo Rugby Surf Squash Tenis Taekwondo Triatlón Ultimate Vóley Waterpolo Yudo',
  cuerpo:'Abdomen Antebrazo Boca Brazo Barbilla Cabeza Codo Cadera Cuello Dedo Diente Espalda Estómago Frente Garganta Hombro Hígado Hueso Intestino Labio Lengua Mano Muñeca Mejilla Nariz Nuca Nalga Ojo Oreja Ombligo Pie Pierna Pecho Pulmón Pestaña Rodilla Riñón Rostro Talón Tobillo Uña Vena Vientre',
  ciudadpy:'Asunción Areguá Altos Ayolas Bella_Vista Benjamín_Aceval Caacupé Caaguazú Capiatá Concepción Coronel_Oviedo Ciudad_del_Este Encarnación Emboscada Eusebio_Ayala Filadelfia Fernando_de_la_Mora Guarambaré Hernandarias Horqueta Itauguá Itá Iturbe Jesús Juan_León_Mallorquín Lambaré Limpio Luque Loma_Plata Mariano_Roque_Alonso Minga_Guazú Ñemby Nueva_Italia Obligado Paraguarí Pilar Pedro_Juan_Caballero Piribebuy Quiindy Quyquyhó San_Lorenzo San_Bernardino Salto_del_Guairá Tobatí Trinidad Villarrica Villa_Elisa Villa_Hayes Yaguarón Ypacaraí Yby_Yaú Ybycuí',
};
const DICW={}; for(const k in DIC) DICW[k]=DIC[k].split(' ').map(w=>w.replace(/_/g,' '));
// a qué lista de palabras corresponde una categoría (por el nombre)
function catKey(name){
  const n=norm(name);
  if(/paraguay/.test(n) && /ciudad|pueblo/.test(n)) return 'ciudadpy';
  if(/tipic|paraguay/.test(n) && /comida|bebida|plato/.test(n)) return 'comidapy';
  const R=[['guarani','guarani'],['apellido','apellido'],['nombre','nombre'],['pais','pais'],['ciudad','ciudad'],['animal','animal'],['fruta','fruta'],['verdura','fruta'],['color','color'],
    ['comida','comida'],['bebida','comidapy'],['marca','marca'],['profes','profesion'],['oficio','profesion'],['trabajo','profesion'],['deporte','deporte'],['cuerpo','cuerpo'],['cosa','cosa'],['objeto','cosa']];
  for(const [a,b] of R) if(n.includes(a)) return b;
  return null;
}
// texto para comparar: sin mayúsculas, acentos (menos la ñ), artículos ni espacios de más
function norm(t){
  return String(t||'').toLowerCase().replace(/ñ/g,'\u0001').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\u0001/g,'ñ')
    .replace(/[^a-z0-9ñ ]+/g,' ').replace(/^(el|la|los|las|un|una|unos|unas) /,'').replace(/\s+/g,' ').trim();
}
const letterOf = L => L==='Ñ' ? 'ñ' : L.toLowerCase();

/* ====================== OPCIONES ====================== */
const SCORES={
  clasico:{t:'💯 Clásico: 100 / 50 / 0', d:'Palabra que nadie más puso: 100. Repetida con otro: 50. Vacía o anulada: 0.'},
  solo:   {t:'🥇 Con “solito”: 100 / 50 / 25', d:'Si sos el único que escribió algo en esa categoría: 100. Palabra única: 50. Repetida: 25.'},
  simple: {t:'🔟 Simple: 10 / 5 / 0', d:'Cada palabra buena vale 10 y la repetida 5. Para cuentas cortitas.'},
};
const PICKS={
  azar:      {t:'🌼 Ñandutí (al azar)', d:'Las letras del tablero de ñandutí giran y se frenan solas en una.'},
  abecedario:{t:'🔤 Abecedario y ¡stop!', d:'Como se juega en casa: las letras pasan rapidito por el tablero y al que le toca grita ¡stop! (toca el botón o el tablero) para frenarlas.'},
  elige:     {t:'👉 La elige uno', d:'Por turno, uno elige la letra de las que quedan (tocando un pétalo del tablero o un botón).'},
};
const FORMATS={ind:'👤 Cada uno su planilla', eq:'👥 Por equipos (el equipo comparte la planilla)'};
const HOUSE=[
  {k:'completo', t:'✅ Basta solo con todo completo', d:'Para gritar ¡BASTA! hay que tener todas las categorías escritas.', def:true},
  {k:'dificiles', t:'🔠 Con letras difíciles', d:'También pueden salir la K, Ñ, Q, W, X, Y y Z.', def:false},
  {k:'repetidas0', t:'🚫 Repetidas valen 0', d:'Si dos ponen la misma palabra, ninguno suma.', def:false},
  {k:'largas', t:'📏 Premio a las largas', d:'Las palabras de 8 letras o más suman un poco más (+20, o +2 en el puntaje simple).', def:false},
  {k:'alreves', t:'🔄 Basta al revés', d:'Las palabras tienen que TERMINAR con la letra, no empezar.', def:false},
];
const TIMERS=[{v:0,t:'Sin límite (hasta que alguien grite ¡BASTA!)'},{v:60,t:'1 minuto'},{v:90,t:'1 minuto y medio'},{v:120,t:'2 minutos'},{v:180,t:'3 minutos'}];
const COUNTS=[{v:0,t:'Nada: se corta al toque'},{v:5,t:'5 segundos'},{v:10,t:'10 segundos'}];
const ROUNDS=[{v:3,t:'3 rondas'},{v:5,t:'5 rondas'},{v:8,t:'8 rondas'},{v:10,t:'10 rondas'},{v:0,t:'Todas las letras'}];
const BOTLV=[{v:'facil',t:'🙂 Fácil'},{v:'normal',t:'😎 Normal'},{v:'crack',t:'🔥 Crack'}];
function defaultOpts(){ const o={preset:'clasica', custom:'Nombre, Animal, Cosa, Comida, Lugar, Cantante', score:'clasico', pick:'azar', fmt:'ind', timer:120, count:5, rounds:5, bot:'normal'}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }
function catsOf(o){
  if(o.preset!=='propia') return PRESETS[o.preset].c.slice();
  const c=String(o.custom||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean).map(x=>x.slice(0,24));
  return [...new Set(c)].slice(0,12);
}

let S=null;
const EMOJIS=['✏️','🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🦉'];
const PCOLORS=['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b'];
const TEAMS=[{n:'Equipo Rojo', e:'🔴', c:'#e63946'}, {n:'Equipo Azul', e:'🔵', c:'#1d70d6'}, {n:'Equipo Verde', e:'🟢', c:'#2a9d3f'}, {n:'Equipo Amarillo', e:'🟡', c:'#e9a100'}];
const BOT_NAMES=[['Profe Lápiz','✏️'],['Ña Goma','🌸'],['Karai Letra','🧉'],['Chulo Basta','😎'],['Ña Tiza','🦋'],['Don Diccionario','🐆'],['Pombero','👹'],['Kuñataĩ Tinta','🦜']];
const MAXP=8;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    sides:[], cats:[], round:0, letter:null, used:[], chooser:0, phaseAt:0, endsAt:0, bastaBy:null, sheets:[], votes:[], ready:[], res:null, win:null};
}
function addPlayer(name, emoji, token, peerId, bot, local){
  const used=S.players.map(p=>p.color), cnt=t=>S.players.filter(p=>p.team===t).length;
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, local:!!local, mic:false, team: cnt(0)<=cnt(1) ? 0 : 1};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 8 jugadores (el máximo).';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sentó a la mesa.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }

/* ---------- lados (jugadores o equipos) ---------- */
function buildSides(){
  if(S.opts.fmt==='eq'){ const ts=[0,1,2,3].filter(t=>S.players.some(p=>p.team===t)); S.sides=ts.map(t=>({team:t, pids:S.players.filter(p=>p.team===t).map(p=>p.id), total:0, pts:[]})); }
  else S.sides=S.players.map(p=>({team:null, pids:[p.id], total:0, pts:[]}));
}
function sideName(st, i){
  const s=st.sides[i]; if(!s) return '?';
  if(s.team!=null) return TEAMS[s.team].e+' '+TEAMS[s.team].n;
  const p=st.players.find(x=>x.id===s.pids[0]); return p ? p.name : '?';
}
const sideOf = (st, pid) => st.sides.findIndex(s=>s.pids.includes(pid));
const lettersLeft = st => (st.opts.dificiles ? EASY.concat(HARD) : EASY).filter(l=>!st.used.includes(l));
const humans = () => S.players.filter(p=>!p.bot);
// el que elige (o frena) la letra: va rotando entre las personas (si no hay, un bot)
function chooserPid(st){ const hs=st.players.filter(p=>!p.bot), list=hs.length?hs:st.players; return list.length ? list[st.chooser%list.length].id : null; }

function startGame(){
  buildSides(); S.cats=catsOf(S.opts); S.used=[]; S.round=0; S.win=null; S.chooser=rnd(Math.max(1,humans().length)); S.startedAt=Date.now();
  log(`✏️ Empieza el Basta: ${S.cats.length} categorías, ${S.opts.rounds?S.opts.rounds+' rondas':'todas las letras'}.`);
  nextRound();
}
function nextRound(){
  S.round++; S.letter=null; S.bastaBy=null; S.endsAt=0; S.res=null; S.ready=[];
  S.sheets=S.sides.map(()=>S.cats.map(()=>'')); S.votes=S.sides.map(()=>S.cats.map(()=>[]));
  S.chooser++;
  const o=S.opts;
  if(o.pick==='azar') drawLetter(lettersLeft(S)[rnd(lettersLeft(S).length)]);
  else { S.phase = o.pick==='abecedario' ? 'abc' : 'pick'; S.phaseAt=Date.now(); }
}
// en el abecedario la letra que se ve depende de la hora (todos la ven igual)
const ABC_MS=110;
const abcLetter = (st, t) => { const L=lettersLeft(st); return L[Math.floor(Math.max(0, t-st.phaseAt)/ABC_MS)%L.length]; };
function drawLetter(L){
  if(!L){ return gameOver(); }
  S.letter=L; S.used.push(L); S.phase='spin'; S.phaseAt=Date.now();
  log(`🎱 Ronda ${S.round}: salió la letra ${L}.`);
}
function startWriting(){
  S.phase='write'; S.phaseAt=Date.now(); S.endsAt = S.opts.timer ? Date.now()+S.opts.timer*1000 : 0;
  BOT.plans={};
}
const filled = (st, si) => st.sheets[si] ? st.sheets[si].filter(x=>String(x).trim()).length : 0;
function sayBasta(pid){
  const si=sideOf(S, pid); if(si<0) return;
  if(S.opts.completo && filled(S, si)<S.cats.length) return 'Para gritar ¡BASTA! tenés que completar todas las categorías.';
  if(!S.opts.completo && filled(S, si)<1) return 'Escribí al menos una palabra.';
  S.bastaBy=pid; const p=P(pid);
  const end=Date.now()+S.opts.count*1000;
  S.endsAt = S.endsAt ? Math.min(S.endsAt, end) : end;
  log(`✋ ¡BASTA! gritó ${p?p.name:'?'}${S.opts.count?` (quedan ${S.opts.count} segundos)`:''}.`);
  sysChat(`✋ ¡BASTA! gritó ${p?p.name:'?'}.`);
}
// cerrar la ronda: se pasa a revisar
function closeWriting(){ S.phase='review'; S.phaseAt=Date.now(); S.ready=[]; scoreRound(false); }
// puntos de la ronda (final=true: se suman al total)
function wordOk(st, txt){
  const n=norm(txt); if(!n) return {ok:false, why:'vacía'};
  const l=letterOf(st.letter), w=n.replace(/ /g,'');
  if(st.opts.alreves ? !w.endsWith(l) : !w.startsWith(l)) return {ok:false, why: st.opts.alreves ? `no termina con ${st.letter}` : `no empieza con ${st.letter}`};
  if(w.length<2) return {ok:false, why:'muy corta'};
  return {ok:true, why:''};
}
function voteNeed(st, si){ const voters=st.players.filter(p=>!p.bot && !st.sides[si].pids.includes(p.id)).length; return Math.max(1, Math.ceil(voters/2)); }
function scoreRound(final){
  const st=S, o=st.opts, res=st.sides.map(()=>st.cats.map(()=>null));
  st.cats.forEach((c,k)=>{
    const items=st.sides.map((s,si)=>{ const txt=String(st.sheets[si][k]||'').trim(), chk=wordOk(st, txt), votes=(st.votes[si]&&st.votes[si][k])||[];
      const killed = chk.ok && votes.length>=voteNeed(st, si) && votes.length>0;
      return {txt, n:norm(txt), ok:chk.ok && !killed, why: killed ? 'anulada por votos' : chk.why, votes:votes.length}; });
    const good=items.filter(x=>x.ok);
    items.forEach((x,si)=>{
      let pts=0, dup=false;
      if(x.ok){
        dup = good.filter(y=>y.n===x.n).length>1;
        if(o.score==='clasico') pts = dup ? (o.repetidas0?0:50) : 100;
        else if(o.score==='solo') pts = good.length===1 ? 100 : dup ? (o.repetidas0?0:25) : 50;
        else pts = dup ? (o.repetidas0?0:5) : 10;
        if(o.largas && x.n.replace(/ /g,'').length>=8 && pts>0) pts += o.score==='simple' ? 2 : 20;
      }
      res[si][k]={txt:x.txt, ok:x.ok, why:x.why, dup, pts, votes:x.votes};
    });
  });
  st.res=res;
  if(final){
    st.sides.forEach((s,si)=>{ const r=res[si].reduce((a,x)=>a+x.pts,0); s.pts.push(r); s.total+=r; });
    const rp=st.sides.map((s,si)=>s.pts[s.pts.length-1]), best=Math.max(...rp);
    log(`🧮 Ronda ${st.round} (${st.letter}): ${st.sides.map((s,si)=>`${sideName(st,si)} ${rp[si]}`).join(', ')}.`);
    st.phase='roundEnd'; st.phaseAt=Date.now(); st.roundBest=best;
    const over = (o.rounds && st.round>=o.rounds) || !lettersLeft(st).length;
    if(over) gameOver();
  }
}
function gameOver(){
  const best=Math.max(...S.sides.map(s=>s.total)), ties=S.sides.map((s,i)=>i).filter(i=>S.sides[i].total===best);
  S.win={ties, tie:ties.length>1, pts:best, at:Date.now()}; S.phase='over';
  log(`🏆 ${ties.map(i=>sideName(S,i)).join(' y ')} ${ties.length>1?'empatan':'gana'} con ${best} puntos.`);
}

/* ====================== ACCIONES ====================== */
function act(pid, a){
  if(!S || !a) return;
  const p=P(pid);
  switch(a.type){
    case 'mic': { const w=p||OB(pid); if(w){ w.mic=!!a.on; commit(); } return; }
    case 'suggest': {
      const t=String(a.text||'').trim().slice(0,240); if(!t) return 'Escribí la regla que querés sugerir.';
      const w=p||OB(pid); if(!w) return;
      S.sugs.push({id:'s'+(++S.seq), by:w.name, e:w.emoji, text:t, votes:[pid]}); if(S.sugs.length>40) S.sugs.shift();
      sysChat(`💡 ${w.name} sugirió una regla: “${t}”`); commit(); return;
    }
    case 'vote': {
      const s=S.sugs.find(x=>x.id===a.id); if(!s) return;
      s.votes = s.votes.includes(pid) ? s.votes.filter(x=>x!==pid) : s.votes.concat(pid); commit(); return;
    }
    case 'joinNext': {
      const o=OB(pid); if(!o) return;
      if(S.phase!=='lobby' && S.phase!=='over') return 'Esperá a que termine la partida para sentarte.';
      if(S.players.length>=MAXP) return 'La mesa está llena.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn;
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`🪑 ${np.name} se sentó a jugar.`); commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||S.phase!=='lobby') return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'team': {
      if(S.phase!=='lobby') return;
      const t=P(a.pid); if(!t || (!host && t.id!==pid)) return;
      t.team=(t.team+1)%4; commit(); return;
    }
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} se levantó de la mesa.`); commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts, v=a.v;
      if(a.k==='preset' && PRESETS[v]) o.preset=v;
      else if(a.k==='custom') o.custom=String(v||'').slice(0,400);
      else if(a.k==='score' && SCORES[v]) o.score=v;
      else if(a.k==='pick' && PICKS[v]) o.pick=v;
      else if(a.k==='fmt' && FORMATS[v]) o.fmt=v;
      else if(a.k==='timer' && TIMERS.some(x=>x.v==v)) o.timer=+v;
      else if(a.k==='count' && COUNTS.some(x=>x.v==v)) o.count=+v;
      else if(a.k==='rounds' && ROUNDS.some(x=>x.v==v)) o.rounds=+v;
      else if(a.k==='bot' && BOTLV.some(x=>x.v===v)) o.bot=v;
      else if(HOUSE.some(h=>h.k===a.k)) o[a.k]=!!v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const r=canStart(); if(r) return r;
      startGame(); sysChat('✏️ ¡Empieza el Basta! Agarren el lápiz.'); commit(); return;
    }
    case 'stopAbc': {   // frenar el abecedario
      if(S.phase!=='abc' || (chooserPid(S)!==pid && !(NET.mode==='local' && !p.bot))) return;
      if(Date.now()-S.phaseAt<600) return;
      drawLetter(abcLetter(S, Date.now())); commit(); return;
    }
    case 'pickL': {
      if(S.phase!=='pick' || (chooserPid(S)!==pid && !(NET.mode==='local' && !p.bot))) return;
      if(!lettersLeft(S).includes(a.l)) return 'Esa letra ya salió.';
      drawLetter(a.l); commit(); return;
    }
    case 'write': {
      if(S.phase!=='write' && !(S.phase==='review' && Date.now()-S.phaseAt<900)) return;
      const si=sideOf(S, pid), k=+a.k; if(si<0 || !(k>=0 && k<S.cats.length)) return;
      S.sheets[si][k]=String(a.v||'').replace(/\s+/g,' ').slice(0,40);
      if(S.phase==='review') scoreRound(false);
      commitSoon(); return;
    }
    case 'basta': {
      if(S.phase!=='write' || S.bastaBy) return;
      const r=sayBasta(pid); if(r) return r; commit(); return;
    }
    case 'veto': {   // votar para anular una palabra de otro
      if(S.phase!=='review') return;
      const si=+a.si, k=+a.k; if(!S.votes[si] || !S.votes[si][k]) return;
      if(S.sides[si].pids.includes(pid)) return 'No podés anular tus propias palabras.';
      const v=S.votes[si][k]; const i=v.indexOf(pid); if(i>=0) v.splice(i,1); else v.push(pid);
      scoreRound(false); commit(); return;
    }
    case 'ready': {
      if(S.phase!=='review') return;
      S.ready = S.ready.includes(pid) ? S.ready.filter(x=>x!==pid) : S.ready.concat(pid);
      if(humans().every(h=>S.ready.includes(h.id) || !h.conn)) scoreRound(true);
      commit(); return;
    }
    case 'count': if(!host || S.phase!=='review') return; scoreRound(true); commit(); return;
    case 'next': if(!host || S.phase!=='roundEnd') return; nextRound(); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(); sysChat('🔁 ¡Revancha! Otra partida.'); commit(); return;
    case 'newGame': if(!host || (S.phase!=='over' && !a.force)) return;
      S.phase='lobby'; S.log=[]; S.sides=[]; S.res=null; S.win=null; S.letter=null; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue por él.`); }
      commit(); return;
    }
  }
}
function canStart(){
  const o=S.opts;
  if(S.players.length<2) return 'Hacen falta al menos 2 jugadores (sumá un bot 🤖).';
  if(catsOf(o).length<2) return 'Escribí al menos 2 categorías propias, separadas por comas.';
  if(o.fmt==='eq'){ const ts=new Set(S.players.map(p=>p.team)); if(ts.size<2) return 'Hacen falta al menos 2 equipos. Tocá el color al lado de cada nombre para cambiarlo de equipo.'; }
  return null;
}
function removePlayer(t, msg){
  if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==t); }
  else { t.bot=true; t.conn=false; t.token=null; }
  if(NET.mode==='host' && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}

/* ====================== RELOJ DEL ANFITRIÓN Y BOTS ====================== */
const BOT={plans:{}};
const BOT_TALK={
  basta:['¡BASTA! ✋','¡Basta, basta, basta! 😎','Lápiz abajo 🧉'],
  win:['¡Gané! ¿Otra? 🏆','Fue suerte… o no 😏'],
};
const pick = a => a[rnd(a.length)];
// palabra que se le ocurre a un bot para una categoría
function botWord(cat, L, lv, alreves){
  const key=catKey(cat); if(!key) return null;
  const l=letterOf(L), list=DICW[key].filter(w=>{ const n=norm(w).replace(/ /g,''); return alreves ? n.endsWith(l) : n.startsWith(l); });
  if(!list.length) return null;
  if(lv==='facil' && rnd(100)<7){ const other=DICW[key][rnd(DICW[key].length)]; return other; }   // a veces se equivoca
  return list[rnd(list.length)];
}
function makePlan(si, pid){
  const lv=S.opts.bot, sp = lv==='facil' ? [7,15] : lv==='crack' ? [2.2,5] : [4,9], keep = lv==='facil' ? .6 : lv==='crack' ? 1 : .85;
  let t=1.5+Math.random()*2; const steps=[];
  shuffle(S.cats.map((c,k)=>k)).forEach(k=>{ const w=botWord(S.cats[k], S.letter, lv, S.opts.alreves); if(!w || Math.random()>keep) return; t+=sp[0]+Math.random()*(sp[1]-sp[0]); steps.push({k, w, at:t}); });
  return {pid, steps, start:S.phaseAt, bastaDelay: lv==='crack' ? .4 : lv==='normal' ? 1.5+Math.random()*2 : 3+Math.random()*4};
}
let COMMIT_T=null;
function commitSoon(){ if(COMMIT_T) return; COMMIT_T=setTimeout(()=>{ COMMIT_T=null; commit(); }, 250); }
function hostTick(){
  if(!S || NET.mode==='client') return;
  const now=Date.now(), o=S.opts;
  if(S.phase==='spin' && now-S.phaseAt>2800){ startWriting(); commit(); return; }
  if(S.phase==='abc'){
    const c=P(chooserPid(S));
    if((c && c.bot && now-S.phaseAt>1500+rnd(2500)) || now-S.phaseAt>15000){ drawLetter(abcLetter(S, now)); commit(); }
    return;
  }
  if(S.phase==='pick'){
    const c=P(chooserPid(S));
    if((c && c.bot && now-S.phaseAt>1800) || now-S.phaseAt>20000){ const L=lettersLeft(S); drawLetter(L[rnd(L.length)]); commit(); }
    return;
  }
  if(S.phase==='write'){
    if(S.endsAt && now>=S.endsAt+700){ closeWriting(); commit(); return; }
    // bots escribiendo
    let changed=false;
    S.sides.forEach((s,si)=>{
      s.pids.forEach(pid=>{
        const p=P(pid); if(!p || !(p.bot || (!p.conn && p.offAt && now-p.offAt>20000))) return;
        const key=si+'|'+pid; const pl=BOT.plans[key]||(BOT.plans[key]=makePlan(si, pid));
        const el=(now-pl.start)/1000;
        for(const st of pl.steps){ if(!st.done && el>=st.at){ st.done=true; if(!String(S.sheets[si][st.k]).trim()){ S.sheets[si][st.k]=st.w; changed=true; } } }
        const all=pl.steps.every(x=>x.done);
        if(all && !S.bastaBy && (!S.endsAt || now<S.endsAt)){
          if(!pl.doneAt) pl.doneAt=now;
          const okNow = o.completo ? filled(S,si)===S.cats.length : filled(S,si)>=Math.ceil(S.cats.length*.7);
          if(okNow && now-pl.doneAt>pl.bastaDelay*1000){ sayBasta(pid); if(rnd(2)===0) botChat(p, pick(BOT_TALK.basta)); changed=true; }
        }
      });
    });
    if(changed) commit();
    return;
  }
  if(S.phase==='review' && now-S.phaseAt>90000){ scoreRound(true); commit(); return; }
  if(S.phase==='review' && !humans().some(h=>h.conn) && now-S.phaseAt>4000){ scoreRound(true); commit(); return; }
  if(S.phase==='roundEnd' && now-S.phaseAt>10000){ nextRound(); commit(); return; }
}
setInterval(hostTick, 300);
function botPrivate(bot, from, text){
  void text;
  setTimeout(()=>{ if(!S) return; addChat(bot.id, pick(['Shhh, estoy pensando una con esa letra ✏️','Jaja, después hablamos 😏','¿Me querés copiar? 😂']), from.id); }, 1200+rnd(1500));
}
