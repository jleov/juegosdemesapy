/* =====================================================================
   Yva Rape — el recorrido por Paraguay: ciudades, su producto típico y
   los niveles. Frutas por color (lugar): 0 rojo, 1 naranja, 2 amarillo,
   3 verde, 4 violeta, 5 marrón. Cada ciudad puede cambiar alguna fruta.
   Tablero de 8 columnas x 9 filas:
     '.' casilla   '#' sin casilla   'i' hielo   'I' hielo doble
     'w' ñandutí (traba la fruta)   'W' ñandutí sobre hielo
     'b' 'B' 'C' cajón de madera de 1, 2 o 3 golpes
   Objetivos (g): pts puntos · fr [[lugar|'P', cantidad]] juntar frutas
     ('P' = la fruta de la ciudad) · hielo · tela (ñandutí) · bloq (cajones)
     · baj (bajar productos de la ciudad hasta abajo). m = movidas, s = segundos.
   ===================================================================== */
(function(){
const FRUTAS_BASE = ['frutilla','naranja','banana','guayaba','yvapuru','mbokaja'];

// c1,c2: colores del fondo · pool: cambios de frutas · prod: producto (dibujo de arte.js)
const CIUDADES = [
  {n:'Asunción', prod:'mango', c1:'#ff9a3c', c2:'#d8452a', pool:{1:'mango'},
   dato:'En verano las calles y los patios de Asunción se llenan de mangos que caen de los árboles.'},
  {n:'Luque', prod:'guitarra', c1:'#d9a05a', c2:'#7a3a1a',
   dato:'Luque es la capital de la música: guitarras y arpas hechas a mano, y joyas en filigrana.'},
  {n:'Areguá', prod:'frutilla', c1:'#ff6b8a', c2:'#b81a3a',
   dato:'Areguá es tierra de frutillas: cada año se hace la Expo Frutilla junto al lago Ypacaraí.'},
  {n:'Itauguá', prod:'nanduti', c1:'#ff8fc0', c2:'#8a2a6a',
   dato:'Itauguá es la cuna del ñandutí, el encaje que en guaraní quiere decir “tela de araña”.'},
  {n:'San Bernardino', prod:'sandia', c1:'#3ac8e8', c2:'#1a6aa8', pool:{0:'sandia'},
   dato:'San Bernardino, a orillas del lago Ypacaraí, es el lugar del verano: agua, sol y sandía fresquita.'},
  {n:'Caacupé', prod:'vela', c1:'#6ab0ff', c2:'#1a3a8a',
   dato:'Caacupé es la capital espiritual: cada 8 de diciembre miles de peregrinos llegan con sus velas.'},
  {n:'Tobatí', prod:'cantaro', c1:'#e88a5a', c2:'#8a3a1a',
   dato:'En Tobatí se trabaja el barro y la madera: cántaros, ollas y santos tallados a mano.'},
  {n:'Atyrá', prod:'bota', c1:'#b8d86a', c2:'#4a7a2a', pool:{3:'aguacate'},
   dato:'Atyrá, famosa por ser de las ciudades más limpias del país y por su artesanía en cuero.'},
  {n:'Valenzuela', prod:'pina', c1:'#ffd84a', c2:'#c8840a', pool:{2:'pina'},
   dato:'Valenzuela es la capital de la piña: su Expo Piña junta a los productores de la Cordillera.'},
  {n:'Eusebio Ayala', prod:'chipa', c1:'#f2c26a', c2:'#9a5a1a',
   dato:'Eusebio Ayala (Barrero Grande) es la capital de la chipa: horneada en tatakua, recién salida.'},
  {n:'Piribebuy', prod:'poncho', c1:'#d8c8b0', c2:'#6a2a1a',
   dato:'En Piribebuy se teje el poncho para’i de 60 listas, una joya del tejido paraguayo.'},
  {n:'Itá', prod:'miel', c1:'#ffcf4a', c2:'#b8740a', pool:{2:'mburukuja'},
   dato:'Itá, ciudad de la gallinita de la suerte, con chacras, colmenas y miel de monte.'},
  {n:'Yaguarón', prod:'naranja', c1:'#ffb84a', c2:'#c8640a',
   dato:'En Yaguarón, junto a su templo franciscano, se destila la esencia de naranja agria (petitgrain).'},
  {n:'Carapeguá', prod:'hamaca', c1:'#ff8a6a', c2:'#9a2a3a',
   dato:'Carapeguá es conocida por sus tejidos: hamacas y ponchos de colores hechos en telar.'},
  {n:'Ybycuí', prod:'gota', c1:'#6ad8a8', c2:'#1a7a5a', pool:{3:'aguacate'},
   dato:'En el Parque Nacional Ybycuí está el salto Mbocaruzú, entre monte y arroyos.'},
  {n:'Villarrica', prod:'libro', c1:'#c8a8ff', c2:'#5a2a9a',
   dato:'Villarrica del Espíritu Santo, la ciudad culta, cuna de poetas como Manuel Ortiz Guerrero.'},
  {n:'Colonia Independencia', prod:'uva', c1:'#c88ae8', c2:'#5a1a7a', pool:{4:'uva'},
   dato:'En Colonia Independencia se celebra la Fiesta de la Vendimia con uvas y vino de la zona.'},
  {n:'Coronel Oviedo', prod:'mandioca', c1:'#e8c890', c2:'#7a5a2a',
   dato:'Caaguazú, con Coronel Oviedo de capital, es de los mayores productores de mandioca del país.'},
  {n:'San Juan Bautista', prod:'nota', c1:'#8ab0ff', c2:'#2a3a8a', pool:{2:'mburukuja'},
   dato:'San Juan Bautista de las Misiones es la tierra natal de Agustín Pío Barrios, Mangoré.'},
  {n:'Pilar', prod:'surubi', c1:'#5ac8d8', c2:'#1a5a7a',
   dato:'Pilar, a orillas del río Paraguay, hace cada año la Fiesta Internacional del Surubí.'},
  {n:'Encarnación', prod:'mascara', c1:'#ff6ad8', c2:'#6a1aa8',
   dato:'Encarnación, la Perla del Sur, tiene playas sobre el Paraná y el Carnaval Encarnaceno.'},
  {n:'Trinidad', prod:'campana', c1:'#e8b88a', c2:'#7a4a2a',
   dato:'Las ruinas jesuíticas de Trinidad son Patrimonio de la Humanidad.'},
  {n:'Bella Vista', prod:'yerba', c1:'#8ad86a', c2:'#2a6a1a', pool:{3:'aguacate'},
   dato:'Bella Vista (Itapúa) es la capital de la yerba mate: de ahí sale el tereré de muchos.'},
  {n:'Ciudad del Este', prod:'rayo', c1:'#5ab8ff', c2:'#1a2a6a',
   dato:'Ciudad del Este, junto al Paraná, está al lado de la represa de Itaipú y sus compras.'},
  {n:'Concepción', prod:'vaca', c1:'#a8d86a', c2:'#4a6a1a',
   dato:'Concepción, la Perla del Norte, es tierra ganadera: ahí se hace la Expo Norte.'},
  {n:'Belén', prod:'mbokaja', c1:'#e8b86a', c2:'#7a4a1a',
   dato:'En el norte crecen los palmares de mbokaja, la palmera de cocos chiquitos.'},
  {n:'Benjamín Aceval', prod:'cana', c1:'#c8e86a', c2:'#5a7a1a',
   dato:'En Benjamín Aceval, ya en el Chaco, hay un ingenio que hace azúcar de la caña.'},
  {n:'Filadelfia', prod:'leche', c1:'#9ad8ff', c2:'#2a5a8a', pool:{3:'aguacate', 2:'mburukuja'},
   dato:'Filadelfia, en el corazón del Chaco, es famosa por sus cooperativas de leche y queso.'},
];

const F8 = '........';
const rep = (s,n) => Array(n).fill(s);
const L = {
  full: rep(F8,9),
  esq: ['#......#', ...rep(F8,7), '#......#'],
  diam: ['###..###','##....##','#......#',F8,F8,F8,'#......#','##....##','###..###'],
  corazon: ['#..##..#',F8,F8,F8,F8,'#......#','##....##','###..###','########'],
  cruz: ['##....##','##....##',F8,F8,F8,F8,F8,'##....##','##....##'],
  reloj: [F8,'#......#','##....##','##....##','##....##','##....##','#......#',F8,F8],
  hc: [F8,F8,'..iiii..','.iiiiii.','.iiiiii.','.iiiiii.','..iiii..',F8,F8],
  hc2: [F8,F8,'..iiii..','.iIIIIi.','.iIIIIi.','.iIIIIi.','..iiii..',F8,F8],
  hb: [...rep(F8,6),'iiiiiiii','iiiiiiii','iiiiiiii'],
  hb2: [...rep(F8,5),'iiiiiiii','iIIiiIIi','IIIIIIII','IIIIIIII'],
  hall: rep('iiiiiiii',9),
  hall2: ['IIIIIIII',...rep('IiiiiiiI',7),'IIIIIIII'],
  hx: ['I......I','.I....I.','..I..I..','...II...','...II...','..I..I..','.I....I.','I......I','iiiiiiii'],
  hx2: ['IiiiiiiI','iIiiiiIi','iiIiiIii','iiiIIiii','iiiIIiii','iiIiiIii','iIiiiiIi','IiiiiiiI','#iiiiii#'],
  t1: [F8,F8,F8,'.w.ww.w.',F8,'.w.ww.w.',F8,F8,F8],
  t2: [F8,'w......w','ww....ww',F8,'...ww...',F8,'ww....ww','w......w',F8],
  t3: [F8,F8,'iwiiiiwi','iiwiiwii','iiiWWiii','iiwiiwii','iwiiiiwi',F8,F8],
  t4: [F8,F8,'w.w.w.w.',F8,'.w.w.w.w',F8,F8,F8,F8],
  t5: [F8,'wwi..iww','wi....iw','i......i','...WW...','i......i','wi....iw','wwi..iww',F8],
  t6: [F8,F8,'.ww..ww.','.ww..ww.',F8,F8,'w.w..w.w',F8,F8],
  t7: [F8,F8,'bw.ww.wb',F8,'..bBBb..',F8,'bw.ww.wb',F8,F8],
  t8: [F8,'w..ww..w','.w....w.','..w..w..','w..ww..w','..w..w..','.w....w.','w..ww..w',F8],
  b1: [F8,F8,F8,F8,'bb.bb.bb',F8,F8,F8,F8],
  b2: [...rep(F8,7),'bbbbbbbb','bbBBBBbb'],
  b3: [F8,F8,'b......b','bb....bb',F8,F8,'bb....bb','b......b',F8],
  b4: [F8,F8,F8,'..BBBB..','..BCCB..','..BBBB..',F8,F8,F8],
  b5: [F8,F8,'b.B..B.b','b.B..B.b',F8,F8,F8,'bbbbbbbb','BBBBBBBB'],
  b6: [F8,F8,F8,'bb....bb','Bb....bB','bb....bb',F8,F8,F8],
  b7: [F8,F8,'iiiiiiii','iibbbbii','iibBBbii','iibbbbii','iiiiiiii',F8,F8],
  b8: ['..b..b..',F8,'b..BB..b',F8,'.b.CC.b.',F8,'b..BB..b',F8,'bbbbbbbb'],
  b9: [F8,F8,'BB....BB',F8,'..CbbC..',F8,'BB....BB',F8,F8],
  b10: [F8,F8,'b.b..b.b','.b.bb.b.',F8,F8,'.b.bb.b.','b.b..b.b',F8],
  final: ['#......#',F8,'iwiBBiwi','iibCCbii','Iw.ii.wI','iibBBbii','iwi..iwi','IIIIIIII','#IIIIII#'],
};

// [ciudad, nivel]  (col = cantidad de frutas distintas, 5 o 6)
const N = [
  // Asunción
  {c:0, m:20, col:5, L:'full', g:{pts:6000}, tip:'Deslizá una fruta hacia su vecina para juntar 3 iguales.'},
  {c:0, m:20, col:5, L:'full', g:{fr:[['P',20]]}, tip:'Juntá mangos: cada mango que desaparece cuenta.'},
  {c:0, m:18, col:5, L:'esq', g:{pts:10000}, tip:'Juntá 4 en línea y se forma una fruta con rayitas: limpia toda la fila o la columna.'},
  // Luque
  {c:1, m:22, col:5, L:'hc', g:{hielo:1}, tip:'Rompé el hielo del tereré haciendo jugadas encima.'},
  {c:1, m:20, col:5, L:'full', g:{baj:2}, tip:'Bajá las guitarras hasta el fondo del tablero.'},
  {c:1, m:22, col:5, L:'diam', g:{baj:3}, tip:'Formas de L o de T crean una bomba que explota alrededor.'},
  // Areguá
  {c:2, m:20, col:5, L:'full', g:{fr:[['P',30]]}, tip:'Con 5 en línea se forma la guampa de tereré: cambiala con una fruta y se van todas las de ese tipo.'},
  {c:2, m:22, col:5, L:'hb', g:{hielo:1}},
  {c:2, m:20, col:5, L:'corazon', g:{fr:[['P',25],[1,25]]}},
  // Itauguá
  {c:3, m:20, col:5, L:'t1', g:{tela:1}, tip:'El ñandutí traba la fruta: juntala con otras iguales para soltarla.'},
  {c:3, m:22, col:5, L:'t2', g:{tela:1}},
  {c:3, m:24, col:5, L:'t3', g:{tela:1, hielo:1}},
  // San Bernardino
  {c:4, s:90, col:5, L:'full', g:{pts:15000}, tip:'¡Contra reloj! Hacé todos los puntos que puedas antes de que se acabe el tiempo.'},
  {c:4, m:22, col:5, L:'hall', g:{hielo:1}},
  // Caacupé
  {c:5, m:22, col:5, L:'full', g:{baj:2}},
  {c:5, m:24, col:5, L:'b1', g:{bloq:1}, tip:'Los cajones se rompen con jugadas al lado o con explosiones.'},
  {c:5, m:27, col:5, L:'cruz', g:{baj:3}},
  // Tobatí
  {c:6, m:22, col:5, L:'b2', g:{bloq:1}},
  {c:6, m:24, col:5, L:'hc2', g:{baj:2, hielo:1}},
  // Atyrá
  {c:7, m:22, col:5, L:'esq', g:{pts:10000}},
  {c:7, m:24, col:5, L:'b3', g:{bloq:1, baj:2}},
  // Valenzuela
  {c:8, m:22, col:5, L:'full', g:{fr:[['P',35]]}},
  {c:8, m:24, col:5, L:'hx', g:{hielo:1}},
  {c:8, m:22, col:5, L:'reloj', g:{fr:[['P',30],[0,30]]}},
  // Eusebio Ayala
  {c:9, m:24, col:5, L:'full', g:{baj:3}},
  {c:9, s:100, col:5, L:'esq', g:{pts:18000}},
  {c:9, m:26, col:5, L:'t4', g:{baj:3, tela:1}},
  // Piribebuy
  {c:10, m:24, col:5, L:'b4', g:{bloq:1}},
  {c:10, m:25, col:5, L:'diam', g:{baj:3}},
  // Itá
  {c:11, m:24, col:5, L:'hall2', g:{hielo:1}},
  {c:11, m:26, col:5, L:'b1', g:{baj:3, bloq:1}},
  // Yaguarón
  {c:12, m:22, col:5, L:'full', g:{fr:[['P',40],[3,30]]}},
  {c:12, m:24, col:5, L:'t5', g:{tela:1, hielo:1}},
  // Carapeguá
  {c:13, m:24, col:5, L:'full', g:{baj:4}},
  {c:13, m:24, col:5, L:'b5', g:{bloq:1}},
  // Ybycuí
  {c:14, s:90, col:5, L:'corazon', g:{pts:15000}},
  {c:14, m:25, col:5, L:'hb2', g:{hielo:1, baj:2}},
  // Villarrica
  {c:15, m:24, col:5, L:'t2', g:{tela:1, baj:2}},
  {c:15, m:26, col:5, L:'cruz', g:{fr:[[0,35],[2,35],[4,35]]}},
  // Colonia Independencia
  {c:16, m:24, col:5, L:'full', g:{fr:[['P',45]]}},
  {c:16, m:25, col:5, L:'hx2', g:{hielo:1, fr:[['P',25]]}},
  // Coronel Oviedo
  {c:17, m:24, col:5, L:'b6', g:{bloq:1, baj:2}},
  {c:17, m:24, col:5, L:'reloj', g:{baj:4}},
  // San Juan Bautista
  {c:18, s:90, col:5, L:'full', g:{pts:17000}},
  {c:18, m:25, col:5, L:'t6', g:{tela:1, baj:3}},
  // Pilar
  {c:19, m:24, col:5, L:'hall', g:{hielo:1}},
  {c:19, m:24, col:5, L:'diam', g:{baj:4}},
  // Encarnación
  {c:20, m:22, col:5, L:'esq', g:{pts:14000}},
  {c:20, m:25, col:5, L:'b7', g:{bloq:1, hielo:1}},
  {c:20, m:26, col:5, L:'corazon', g:{baj:4, fr:[[0,30]]}},
  // Trinidad
  {c:21, m:24, col:5, L:'b8', g:{bloq:1}},
  {c:21, m:26, col:5, L:'t3', g:{tela:1, hielo:1, baj:2}},
  // Bella Vista
  {c:22, m:24, col:5, L:'hall2', g:{hielo:1, baj:3}},
  {c:22, s:80, col:5, L:'cruz', g:{pts:14000}},
  // Ciudad del Este
  {c:23, m:22, col:5, L:'full', g:{fr:[[1,45],[3,45]]}},
  {c:23, m:25, col:5, L:'b9', g:{bloq:1, baj:3}},
  {c:23, m:26, col:5, L:'t7', g:{tela:1, bloq:1}},
  // Concepción
  {c:24, m:24, col:5, L:'reloj', g:{hielo:1, baj:3}},
  {c:24, m:25, col:5, L:'b5', g:{bloq:1, fr:[[2,40]]}},
  // Belén
  {c:25, m:24, col:5, L:'hx2', g:{hielo:1, fr:[['P',40]]}},
  {c:25, m:25, col:5, L:'t5', g:{tela:1, fr:[['P',30]]}},
  // Benjamín Aceval
  {c:26, m:25, col:5, L:'b10', g:{bloq:1, baj:4}},
  {c:26, s:75, col:5, L:'full', g:{pts:15000}},
  // Filadelfia
  {c:27, m:26, col:5, L:'hall2', g:{hielo:1, fr:[[4,40]]}},
  {c:27, m:26, col:5, L:'t8', g:{tela:1, baj:4}},
  {c:27, m:28, col:5, L:'final', g:{hielo:1, bloq:1, tela:1, baj:3}, tip:'¡El último nivel del recorrido! Usá todo lo que aprendiste.'},
];

// arma cada nivel: frutas de la ciudad, tablero y metas de estrellas
const NIVELES = N.map((d, i) => {
  d.col = 5;   // con 6 frutas distintas en 8x9 casi no salen jugadas: la dificultad sube con los obstáculos
  // calibrado con el bot de prueba: más movidas donde hay obstáculos o productos para bajar
  if(d.m && !(d.g.pts && Object.keys(d.g).length === 1)){ d.m += 3; if(d.g.baj) d.m += 5; if(d.g.hielo) d.m += 3; if(d.g.bloq) d.m += 2; if(/^(hall|hall2|hb2)$/.test(d.L)) d.m += 3; }
  const ciu = CIUDADES[d.c];
  const frutas = FRUTAS_BASE.map((f, k) => (ciu.pool && ciu.pool[k]) || f);
  const usadas = frutas.slice(0, d.col);
  // si la fruta de la ciudad no entra en las primeras 5, se pone en el lugar 4
  let lugarP = usadas.indexOf(ciu.prod);
  if(lugarP < 0 && frutas.indexOf(ciu.prod) >= 0){ lugarP = d.col - 1; usadas[lugarP] = ciu.prod; }
  const g = JSON.parse(JSON.stringify(d.g));
  if(g.fr) g.fr = g.fr.map(([k, n]) => [k === 'P' ? lugarP : k, n]);
  // puntaje para 2 y 3 estrellas
  let e;
  if(g.pts) e = [g.pts, Math.round(g.pts * 1.6 / 500) * 500, Math.round(g.pts * 2.4 / 500) * 500];
  else { const base = d.s ? d.s * 250 : d.m * 900; e = [0, Math.round(base / 500) * 500, Math.round(base * 1.65 / 500) * 500]; }
  return {i, ciudad: d.c, frutas: usadas, m: d.m || 0, s: d.s || 0, mapa: L[d.L], g, e, tip: d.tip || '', prod: ciu.prod};
});

window.YVA = { CIUDADES, NIVELES };
})();
