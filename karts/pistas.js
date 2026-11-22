'use strict';
/* =====================================================================
   Carrera Guasu — pistas (ciudades del Paraguay) y su geometría.
   Acá no hay nada de dibujo: solo los datos de cada pista y las cuentas
   para saber dónde está cada kart (lo usan el motor, los bots y el 3D).
   Coordenadas: x hacia la derecha, z hacia abajo (vista de arriba), y = altura.
   Todas las pistas giran en el mismo sentido: el lado izquierdo es el de afuera.
   ===================================================================== */
const PASO = 4;          // metros entre muestra y muestra de la pista
const MARGEN = 10;
const RAMPA = 7, ALTO_RAMPA = 1.6;   // largo y alto de las rampas de salto (el borde de arriba está justo en la muestra del salto)       // pasto que se puede pisar a cada lado antes de la baranda

/* ---------- ayudas para escribir los decorados ----------
   F: fila a lo largo de la pista  (tipo, de cp, a cp, cada cuántos metros, lado 1=afuera -1=adentro 0=los dos, distancia al borde, tamaño)
   U: uno solo al costado          (tipo, cp, lado, distancia al borde, tamaño, giro extra)
   A: en un lugar fijo del mapa    (tipo, x, z, giro, tamaño)
   AZ: relleno al azar              (tipos, cantidad, distancia mínima a la pista, máxima)
   "cp" es el número de punto de control (con decimales) de la lista pts. */
const F = (t, a, b, cada, l, d, s) => ({k:'F', t, a, b, cada, l, d:d==null?4:d, s:s||1});
const U = (t, cp, l, d, s, rot) => ({k:'U', t, cp, l, d:d==null?6:d, s:s||1, rot:rot||0});
const A = (t, x, z, rot, s) => ({k:'A', t, x, z, rot:rot||0, s:s||1});
const AZ = (t, n, min, max) => ({k:'R', t, n, min:min||14, max:max||120});

const COPAS = [
  {id:'chipa',   n:'Copa Chipa',   e:'🥯', pistas:['asu','sanber','aregua','caacupe']},
  {id:'terere',  n:'Copa Tereré',  e:'🧉', pistas:['encar','trinidad','villarrica','luque']},
  {id:'lapacho', n:'Copa Lapacho', e:'🌸', pistas:['cde','cristal','chaco','cerrocora']},
];

const PISTAS = {
  /* ------------------------------------------------------------------ */
  asu: {
    n:'Costanera de Asunción', ciudad:'Asunción', e:'🏛️',
    d:'La costanera sobre el río Paraguay, el Palacio de López y el Panteón de los Héroes.',
    pts:[[-140,-60],[-60,-70],[40,-64],[130,-70],[175,-30],[160,30],[100,50],[60,20],[10,40],[-30,90],[-110,90],[-170,50],[-180,-10]],
    largada:1.2, ancho:9,
    tema:{cielo:['#3f8fe0','#cfe9ff'], niebla:'#cfe6f7', lejos:520, suelo:'#5aa846', suelo2:'#4b9a3f', camino:'#5b5f68', agua:'#7c8f5a', cerros:'#6fa37a', nCerros:5},
    agua:[{r4:[-900,-900,900,-92]}],
    cajas:[2.6, 5.3, 8.5, 11.2], turbos:[[1.9,0],[9.6,3]], saltos:[10.3],
    atajos:[{de:5.55, a:8.1, l0:-1, l1:-1}],
    deco:[
      F('palmera',0.2,3.4,20,1,3), F('farol',0.3,3.4,20,-1,2), F('lapacho',9.2,10.8,22,1,5),
      U('palacio',2.1,-1,26,1), A('panteon',-75,22,0,1), U('cartel',3.6,1,5,1), U('tribuna',1.0,-1,5,1), U('tribuna',1.5,-1,5,1),
      F('edificio',3.6,5.2,26,1,12), F('edificio',8.8,11.6,30,1,14), F('casa',5.6,8.4,24,1,10), F('arbol',11.3,12.9,16,1,5),
      A('velero',-60,-150,.6,1.3), A('velero',70,-170,-.4,1.1), A('velero',170,-135,1.2,1.2), A('lancha',0,-125,.2,1), A('lancha',-150,-140,2,1),
      U('bandera',1.25,1,4,1.4), U('puesto',4.5,-1,5,1), F('farol',9.2,10.8,22,-1,2),
      AZ(['arbol','lapacho','palmera','arbusto'],70,16,150), AZ(['edificio','casa'],26,60,190),
    ],
  },
  /* ------------------------------------------------------------------ */
  sanber: {
    n:'Lago de San Bernardino', ciudad:'San Bernardino', e:'⛵',
    d:'Verano en el lago Ypacaraí: muelles, veleros y casonas entre los árboles.',
    pts:[[-150,0],[-120,-70],[-40,-100],[40,-80],[90,-110],[160,-80],[170,-10],[110,30],[120,90],[50,120],[-20,80],[-90,110],[-150,70]],
    largada:2.35, ancho:8.5,
    tema:{cielo:['#2f86dd','#d9f1ff'], niebla:'#d4ecf7', lejos:520, suelo:'#4fa24a', suelo2:'#3f8f45', camino:'#62646b', agua:'#3f8fb0', cerros:'#4f8f6a', nCerros:9},
    agua:[{c:[10,5],r:62},{r4:[-900,150,900,900]}],
    cajas:[3.3, 6.2, 9.3, 12.2], turbos:[[2.9,0],[8.4,-2]], saltos:[5.5],
    atajos:[{de:9.5, a:11.4, l0:1, l1:1}],
    deco:[
      F('palmera',2.2,4.2,18,-1,3), F('arbol',2.2,4.2,18,1,5), F('sombrilla',9.0,11.6,12,1,5), F('farol',5.6,7.4,18,-1,2),
      U('hotel',3.4,1,24,1), U('muelle',3.0,-1,10,1), U('muelle',7.0,-1,10,1), U('muelle',10.2,1,12,1), U('tribuna',2.6,1,5,1),
      A('velero',-10,-10,.5,1.2), A('velero',30,25,2,1), A('velero',-5,40,-1,1.1), A('lancha',25,-25,1,1), A('velero',-60,200,1,1.5), A('velero',90,230,-.6,1.4), A('lancha',10,190,.4,1.2),
      F('casa',4.4,6.6,26,1,10), F('casa',11.8,13.9,26,1,10), F('pino',0.2,1.9,14,1,5), U('cartel',6.3,1,5,1), U('puesto',12.6,-1,5,1),
      AZ(['arbol','pino','lapachoA','arbusto','palmera'],120,15,150),
    ],
  },
  /* ------------------------------------------------------------------ */
  aregua: {
    n:'Frutillas de Areguá', ciudad:'Areguá', e:'🍓',
    d:'Cuesta arriba hasta la iglesia, entre frutillas gigantes y cántaros de cerámica.',
    pts:[[-120,-40,0],[-60,-80,0],[10,-70,3],[60,-110,7],[130,-90,10],[150,-30,10],[100,10,6],[130,70,3],[70,110,0],[0,80,0],[-50,110,0],[-120,90,0],[-150,30,0]],
    largada:9.45, ancho:8,
    tema:{cielo:['#4b97e6','#ffe9c7'], niebla:'#f3e6cf', lejos:480, suelo:'#6aa84a', suelo2:'#7a9a3f', camino:'#8a5a3c', agua:'#4f93b5', cerros:'#7b9c5b', nCerros:7, tierra:1},
    agua:[{r4:[-900,160,900,900]}],
    cajas:[11.2, 1.4, 4.3, 7.4], turbos:[[10.5,0],[5.6,0]], saltos:[6.5, 12.6],
    atajos:[{de:1.55, a:3.3, l0:-1, l1:-1}],
    deco:[
      F('frutilla',9.1,11.3,16,1,4,1), F('cantaro',9.3,11.3,14,-1,3,1), F('puesto',11.6,13.2,24,1,5), F('cantaro',0.2,1.6,12,1,3,1.3),
      U('iglesia',4.3,1,22,1), F('casa',3.3,5.6,22,-1,9), F('lapacho',2.0,3.4,16,1,5), F('frutilla',6.6,8.2,18,1,5,1.4), F('farol',3.6,5.4,18,1,2),
      U('cantaro',7.6,-1,6,2.6), U('frutilla',9.45,-1,7,2.6), U('tribuna',9.8,-1,5,1), U('cartel',12.2,1,5,1), U('estacion',8.6,1,16,1),
      A('velero',-80,215,.5,1.4), A('velero',60,240,2,1.4),
      AZ(['arbol','lapacho','lapachoA','arbusto','palmera'],110,15,150), AZ(['casa'],14,40,150), AZ(['frutilla','cantaro'],26,14,60),
    ],
  },
  /* ------------------------------------------------------------------ */
  caacupe: {
    n:'Basílica de Caacupé', ciudad:'Caacupé', e:'⛪',
    d:'La vuelta a la Basílica azul, con los cerros de la Cordillera alrededor.',
    pts:[[-100,-100,0],[0,-120,0],[100,-100,2],[150,-40,6],[110,20,8],[40,10,6],[20,70,3],[90,120,0],[20,150,0],[-60,120,0],[-70,50,0],[-140,30,0],[-160,-40,0]],
    largada:0.4, ancho:8.5,
    tema:{cielo:['#3d8be0','#e6f3ff'], niebla:'#dcebf5', lejos:500, suelo:'#58a548', suelo2:'#6b9a44', camino:'#666a72', agua:'#4f93b5', cerros:'#5f9560', nCerros:14, relieve:1.5},
    cajas:[1.6, 4.5, 7.5, 10.6], turbos:[[0.9,0],[8.5,0]], saltos:[3.5, 11.5],
    atajos:[{de:5.4, a:6.9, l0:1, l1:1}],
    deco:[
      A('basilica',-25,-40,0,1.25), F('farol',0.1,2.2,18,-1,2), F('palmera',0.1,2.2,18,1,3), F('tribuna',0.2,0.9,18,1,5),
      F('puesto',9.2,10.9,20,-1,5), F('casa',2.4,4.2,24,1,10), F('casa',7.2,9.2,24,1,10), F('lapachoA',11.0,12.9,16,1,5),
      U('tupasy',-.2,-1,7,1), U('cartel',8.4,1,5,1), F('vela',10.1,11.0,10,1,3), F('arbol',4.4,6.4,14,-1,4),
      AZ(['arbol','lapachoA','lapacho','arbusto','roca'],130,15,160), AZ(['casa'],16,40,160),
    ],
  },
  /* ------------------------------------------------------------------ */
  encar: {
    n:'Playa y Sambódromo de Encarnación', ciudad:'Encarnación', e:'🏖️',
    d:'La playa San José, la recta del sambódromo con sus tribunas y el puente sobre el Paraná.',
    pts:[[-170,-20],[-90,-40],[0,-40],[90,-40],[160,-60],[190,-10],[150,40],[80,30],[40,70],[80,120],[20,140],[-50,100],[-110,120],[-170,80]],
    largada:1.3, ancho:9,
    tema:{cielo:['#2c8be8','#bfe6ff'], niebla:'#cdeaf8', lejos:560, suelo:'#e2cf93', suelo2:'#56a548', camino:'#5c6068', agua:'#3aa0c8', cerros:'#6fa37a', nCerros:3, arena:1},
    agua:[{r4:[-900,172,900,900]},{r4:[232,-900,900,900]}],
    cajas:[3.4, 6.4, 9.5, 12.5], turbos:[[2.0,0],[2.6,0],[10.5,0]], saltos:[12.0],
    atajos:[{de:7.3, a:9.2, l0:1, l1:1}],
    deco:[
      F('tribuna',0.9,3.2,17,1,5), F('tribuna',0.9,3.2,17,-1,5), U('sambaArco',2.2,0,0,1), U('sambaArco',0.9,0,0,1), F('farol',3.3,5.4,18,1,2),
      F('sombrilla',9.2,13.2,10,1,6), F('palmera',9.2,13.2,18,1,3), F('sombrilla',9.6,12.8,14,1,16), F('palmera',5.6,7.4,16,1,3),
      A('puenteLejos',310,60,0,1), A('velero',-80,230,.5,1.5), A('velero',60,250,2,1.4), A('lancha',-10,215,1,1.2), A('velero',290,-120,1,1.3),
      F('edificio',3.4,5.2,28,-1,12), F('casa',6.2,8.4,24,-1,10), U('cartel',5.6,1,5,1), U('puesto',11.5,-1,5,1), U('carroza',1.7,-1,24,1), U('carroza',2.7,-1,24,1),
      AZ(['palmera','arbol','arbusto'],70,16,140), AZ(['edificio','casa'],16,50,150),
    ],
  },
  /* ------------------------------------------------------------------ */
  trinidad: {
    n:'Ruinas de Trinidad', ciudad:'Trinidad y Jesús', e:'🧱',
    d:'Entre los arcos y muros de piedra roja de las misiones jesuíticas.',
    pts:[[-130,-80],[-40,-100],[50,-70],[130,-100],[170,-40],[120,10],[150,80],[80,110],[30,60],[-30,110],[-100,90],[-90,20],[-160,-10]],
    largada:0.45, ancho:8,
    tema:{cielo:['#5a9fe0','#ffe2bd'], niebla:'#f0dcc3', lejos:470, suelo:'#6aa64c', suelo2:'#5d9a48', camino:'#a0553a', agua:'#4f93b5', cerros:'#6f9c62', nCerros:6, tierra:1},
    cajas:[1.5, 4.4, 7.5, 10.5], turbos:[[0.9,0],[6.5,0]], saltos:[9.5],
    atajos:[{de:7.35, a:9.2, l0:-1, l1:-1},{de:10.5, a:12.2, l0:-1, l1:-1}],
    deco:[
      U('ruinaArco',1.5,0,0,1), U('ruinaArco',5.5,0,0,1), U('ruinaArco',8.5,0,0,1), U('ruinaArco',11.5,0,0,1),
      A('ruinaFachada',20,-15,0,1.3), F('ruinaMuro',2.2,3.8,18,-1,4), F('ruinaMuro',6.2,7.4,18,1,4), F('columna',0.1,1.3,12,1,3), F('columna',0.1,1.3,12,-1,3),
      F('ruinaMuro',9.6,10.4,18,1,4), U('campanario',3.9,-1,14,1), F('columna',4.2,5.2,12,-1,3), U('ruinaFachada',12.5,1,18,1),
      U('tribuna',0.7,1,6,1), U('cartel',6.6,1,5,1), F('lapacho',11.9,12.9,16,-1,5),
      AZ(['arbol','lapacho','arbusto','roca','palmera'],120,15,150), AZ(['ruinaMuro','columna'],22,14,70),
    ],
  },
  /* ------------------------------------------------------------------ */
  villarrica: {
    n:'Cerros del Ybytyruzú', ciudad:'Villarrica', e:'⛰️',
    d:'Subida al cerro entre el monte, con curvas cerradas y la bajada a fondo.',
    pts:[[-140,-90,0],[-50,-110,2],[40,-90,6],[120,-110,12],[170,-50,18],[120,0,22],[50,-20,24],[10,40,20],[70,90,14],[20,130,8],[-60,100,4],[-110,130,1],[-170,60,0],[-180,-20,0]],
    largada:0.3, ancho:8,
    tema:{cielo:['#4a90d8','#dff0e4'], niebla:'#cfe3d2', lejos:430, suelo:'#3f8f3f', suelo2:'#357a3a', camino:'#6a6d73', agua:'#4f93b5', cerros:'#3f7f52', nCerros:18, relieve:3},
    cajas:[1.5, 4.5, 7.5, 10.5], turbos:[[0.9,0],[8.4,0]], saltos:[9.4, 12.5],
    atajos:[{de:5.5, a:7.3, l0:1, l1:1}],
    deco:[
      F('pino',0.1,3.6,12,1,4), F('arbol',0.1,3.6,12,-1,4), F('roca',3.8,6.4,12,1,3), F('pino',6.4,9.8,11,1,4), F('pino',6.6,9.6,13,-1,4),
      U('mirador',5.2,1,10,1), U('cruz',6.2,-1,12,1.4), U('cartel',1.2,1,5,1), U('tribuna',0.6,-1,5,1), F('casa',11.6,13.6,26,1,10), U('carreta',12.4,-1,7,1),
      F('lapachoA',10.2,11.8,16,1,5), U('cascada',4.3,1,16,1),
      AZ(['pino','arbol','arbusto','roca','lapachoA'],190,14,160),
    ],
  },
  /* ------------------------------------------------------------------ */
  luque: {
    n:'Luque, música y fútbol', ciudad:'Luque', e:'🎸',
    d:'Pista rápida entre arpas y guitarras gigantes y la recta del estadio.',
    pts:[[-150,-50],[-50,-80],[60,-80],[150,-50],[170,20],[110,60],[30,40],[-20,90],[-110,100],[-170,40]],
    largada:1.3, ancho:9.5,
    tema:{cielo:['#3b8be2','#d8ecff'], niebla:'#d5e7f6', lejos:520, suelo:'#55a546', suelo2:'#4c9a41', camino:'#585c64', agua:'#4f93b5', cerros:'#6fa37a', nCerros:4},
    cajas:[2.5, 4.5, 6.6, 8.8], turbos:[[1.6,0],[2.2,-3],[8.2,0]], saltos:[7.5],
    atajos:[{de:5.4, a:6.9, l0:1, l1:1}],
    deco:[
      F('tribuna',0.8,2.8,17,1,5,1.25), F('tribuna',0.8,2.8,17,-1,5,1.25), F('reflector',0.8,2.8,40,1,22), U('arcoFutbol',1.9,-1,34,1),
      F('arpa',3.6,5.2,26,1,5,1), F('guitarra',6.2,7.6,24,1,5,1), F('guitarra',8.0,9.6,26,-1,5,1), F('arpa',8.2,9.8,28,1,6,1.2),
      U('pelota',3.2,-1,8,1.6), U('pelota',7.0,-1,8,1.2), F('casa',4.2,5.6,24,-1,10), U('cartel',5.7,1,5,1), U('puesto',9.1,-1,5,1), F('farol',3.2,5.0,18,-1,2),
      AZ(['arbol','palmera','lapacho','arbusto'],90,16,150), AZ(['casa','edificio'],20,45,160),
    ],
  },
  /* ------------------------------------------------------------------ */
  cde: {
    n:'Puente de la Amistad', ciudad:'Ciudad del Este', e:'🌉',
    d:'Cruzá el Paraná por el puente del arco, pasá por las torres y volvé por la represa de Itaipú.',
    pts:[[-170,-40,0],[-110,-90,0],[-30,-80,2],[30,-70,8],[90,-70,8],[150,-70,8],[200,-40,4],[210,30,4],[160,80,8],[90,80,8],[30,80,8],[-20,50,3],[-70,90,0],[-140,80,0],[-180,20,0]],
    largada:1.4, ancho:8.5,
    tema:{cielo:['#3f86d6','#d5e9f7'], niebla:'#cfe2ee', lejos:540, suelo:'#4f9f47', suelo2:'#448f40', camino:'#5a5e66', agua:'#7a6a4a', cerros:'#5f956a', nCerros:5},
    agua:[{r4:[52,-900,128,900]}], nivelAgua:-3,
    puentes:[[2.75,5.2,'arco'],[8.0,10.25,'represa']],
    cajas:[2.3, 5.6, 7.5, 11.2, 13.5], turbos:[[3.6,0],[9.0,0],[13.0,0]], saltos:[14.3],
    atajos:[{de:11.25, a:12.8, l0:1, l1:1}],
    deco:[
      F('torre',0.3,2.4,24,1,10), F('torre',12.2,14.6,26,1,12), F('edificio',0.6,2.2,22,-1,10), F('letrero',1.0,2.4,26,1,4), F('farol',0.2,2.4,18,-1,2),
      F('torre',5.6,7.6,26,1,12,1.1), F('edificio',5.8,7.4,24,-1,10), U('casilla',5.5,1,5,1), U('casilla',2.5,-1,5,1), F('letrero',12.4,14.4,30,-1,4),
      A('saltoMonday',90,215,3.14,1.3), A('lancha',90,-150,0,1.2), A('lancha',88,5,3,1.2), U('tribuna',1.2,1,5,1), U('cartel',7.5,1,5,1),
      AZ(['arbol','palmera','arbusto'],80,16,150), AZ(['edificio','torre','casa'],26,45,170),
    ],
  },
  /* ------------------------------------------------------------------ */
  cristal: {
    n:'Salto Cristal', ciudad:'La Colmena', e:'💦',
    d:'Picada en el monte hasta el salto: puente de madera sobre el arroyo y mucha sombra.',
    pts:[[-130,-70,6],[-50,-100,6],[30,-80,4],[100,-110,2],[160,-60,0],[130,10,0],[60,0,0],[20,60,2],[70,120,4],[0,140,6],[-70,110,8],[-90,40,8],[-160,10,8]],
    largada:0.35, ancho:7.5,
    tema:{cielo:['#4d94d6','#d8f0dc'], niebla:'#c5e0c9', lejos:400, suelo:'#3c8a3c', suelo2:'#2f7636', camino:'#8a6a48', agua:'#4fb0c0', cerros:'#356f48', nCerros:16, relieve:2.5, tierra:1},
    agua:[{c:[165,25],r:46},{r4:[84,-22,150,30]}], nivelAgua:-2.2,
    puentes:[[5.05,5.95,'madera']],
    cajas:[1.5, 3.6, 7.5, 10.5], turbos:[[0.9,0],[8.5,0]], saltos:[2.5, 11.4],
    atajos:[{de:6.4, a:7.9, l0:-1, l1:-1}],
    deco:[
      A('cascada',212,28,-1.57,2.2), F('pino',0.1,4.2,10,1,3), F('arbol',0.1,4.2,10,-1,3), F('helecho',6.0,9.2,7,1,2), F('helecho',6.0,9.2,7,-1,2),
      F('arbol',6.2,12.9,10,1,4,1.3), F('arbol',6.2,12.9,11,-1,4,1.2), F('roca',4.1,5.0,9,1,3), U('cartel',0.8,1,5,1), U('cabana',9.4,1,10,1), U('carreta',1.2,-1,6,1),
      F('roca',10.2,11.6,12,1,3), U('tribuna',0.6,-1,5,.9), F('tucanPalo',2.2,3.8,30,1,4),
      AZ(['arbol','pino','helecho','arbusto','roca','lapacho'],230,13,150),
    ],
  },
  /* ------------------------------------------------------------------ */
  chaco: {
    n:'Picada del Chaco', ciudad:'Filadelfia', e:'🌵',
    d:'Tierra, polvo y rectas largas entre palos borrachos, cactus y molinos de viento.',
    pts:[[-190,-40],[-100,-80],[10,-60],[110,-90],[190,-50],[200,30],[130,70],[40,50],[-30,100],[-120,90],[-200,40]],
    largada:1.3, ancho:10,
    tema:{cielo:['#5f9fdc','#ffdfae'], niebla:'#f2dcb6', lejos:500, suelo:'#c9a86a', suelo2:'#b8985e', camino:'#b07a4a', agua:'#6fa0a8', cerros:'#b99a6a', nCerros:0, tierra:1, seco:1},
    agua:[{c:[40,-5],r:26}], nivelAgua:-1.2,
    cajas:[2.5, 4.6, 7.4, 9.6], turbos:[[1.7,0],[3.4,0],[8.5,0]], saltos:[2.45, 6.5, 9.5],
    atajos:[{de:6.35, a:7.8, l0:1, l1:1}],
    deco:[
      F('paloBorracho',0.2,3.6,26,1,4), F('cactus',0.3,3.6,17,-1,3), F('paloBorracho',6.2,9.8,28,-1,5), F('cactus',5.0,10.6,15,1,3),
      U('molino',2.0,1,14,1), U('molino',8.0,1,14,1), U('molino',5.0,-1,16,1), U('tanque',4.4,1,14,1), F('casaChaco',3.8,5.0,26,1,12), U('cartel',1.1,1,5,1), U('tribuna',0.9,-1,5,1),
      F('vaca',9.2,10.6,14,1,8), U('carreta',7.2,-1,6,1), F('poste',0.2,3.8,14,1,2),
      AZ(['paloBorracho','cactus','arbustoSeco','roca','arbustoSeco'],150,14,170), AZ(['vaca'],10,18,80),
    ],
  },
  /* ------------------------------------------------------------------ */
  cerrocora: {
    n:'Cerro Corá al atardecer', ciudad:'Pedro Juan Caballero', e:'🌄',
    d:'Cerros de piedra, monte y el monumento del parque nacional con el sol cayendo.',
    pts:[[-120,-100,0],[-30,-80,4],[20,-120,8],[100,-110,10],[150,-50,8],[90,-10,4],[130,50,2],[80,110,0],[10,80,2],[-40,130,4],[-120,110,4],[-150,40,2],[-90,-10,0],[-160,-50,0]],
    largada:0.3, ancho:8,
    tema:{cielo:['#35407e','#ff9c5a'], niebla:'#e39a6e', lejos:440, suelo:'#5a8a3c', suelo2:'#6a7a38', camino:'#6b5a52', agua:'#4f93b5', cerros:'#7a4f4a', nCerros:20, relieve:3, tarde:1},
    cajas:[1.4, 4.4, 7.5, 10.5], turbos:[[0.7,0],[6.5,0],[10.4,0]], saltos:[3.5, 8.6],
    atajos:[{de:11.4, a:12.75, l0:-1, l1:-1},{de:4.5, a:5.7, l0:-1, l1:-1}],
    deco:[
      U('monumento',9.5,1,16,1), F('roca',1.2,3.8,10,1,3,1.6), F('roca',1.4,3.6,12,-1,3,1.2), F('lapacho',5.8,7.6,16,1,5), F('pino',7.8,10.6,12,1,4),
      F('cerroPiedra',2.2,4.6,50,1,36), F('cerroPiedra',9.6,12.6,55,1,40), U('cruz',3.0,1,10,1.5), U('cartel',0.8,1,5,1), U('tribuna',0.55,-1,5,1), F('antorcha',8.9,10.1,10,-1,2), F('antorcha',8.9,10.1,10,1,2),
      U('cabana',13.2,1,10,1),
      AZ(['arbol','roca','arbusto','lapacho','lapachoA','pino'],160,14,160),
    ],
  },
};
const ORDEN_PISTAS = COPAS.flatMap(c => c.pistas);

/* =====================================================================
   Arenas del modo batalla (Ñorairõ): una cancha redonda y abierta donde
   todos se ven. Están en PISTAS (con arena:true) para que el nombre, el
   ícono y la descripción sirvan igual que en las pistas.
   obst: [x, z, radio del choque, decorado, tamaño]   cajas: [x, z]
   turbos y rampas: [x, z, rumbo]
   ===================================================================== */
const anillo = (n, r, a0) => Array.from({length:n}, (_,i)=>{ const a=(a0||0)+i/n*Math.PI*2; return [Math.round(Math.sin(a)*r*10)/10, Math.round(Math.cos(a)*r*10)/10]; });
const tangente = (n, r, a0) => Array.from({length:n}, (_,i)=>{ const a=(a0||0)+i/n*Math.PI*2; return [Math.sin(a)*r, Math.cos(a)*r, a+Math.PI/2]; });
PISTAS.plaza = {arena:true, n:'Plaza de los Héroes', ciudad:'Asunción', e:'⚔️',
  d:'Batalla alrededor del Panteón de los Héroes, entre fuentes, lapachos y faroles.',
  radio:70, piso:'baldosa',
  tema:{cielo:['#3f8fe0','#cfe9ff'], niebla:'#cfe6f7', lejos:420, suelo:'#5aa846', suelo2:'#4b9a3f', camino:'#b3aa98', borde:['#d52b1e','#ffffff'], cerros:'#6fa37a', nCerros:5},
  obst:[[0,0,13.5,'panteon',1], ...anillo(4,40,Math.PI/4).map(([x,z])=>[x,z,4.2,'fuente',1]), ...anillo(4,44,0).map(([x,z])=>[x,z,1.6,'lapacho',1]), ...anillo(8,58,Math.PI/8).map(([x,z])=>[x,z,.6,'farol',1])],
  cajas:[...anillo(8,24,Math.PI/8), ...anillo(6,54,0)],
  turbos:tangente(4,30,0), rampas:tangente(2,52,Math.PI/4),
  fuera:'ciudad'};
PISTAS.expo = {arena:true, n:'Predio de la Expo', ciudad:'Mariano Roque Alonso', e:'🐂',
  d:'La cancha de la feria: carretas, puestos de chipa, el tanque de agua y el molino.',
  radio:78, piso:'tierra',
  tema:{cielo:['#4b97e6','#ffe9c7'], niebla:'#f3e6cf', lejos:420, suelo:'#6aa84a', suelo2:'#7a9a3f', camino:'#c39a68', borde:['#8a5a34','#e8d8b0'], cerros:'#7b9c5b', nCerros:7, tierra:1},
  obst:[[0,0,4.2,'tanque',1], [10,7,2.4,'molino',1], ...anillo(3,34,.4).map(([x,z])=>[x,z,3.2,'carreta',1.4]), ...anillo(4,52,1.1).map(([x,z])=>[x,z,2.6,'puesto',1.3]),
    ...anillo(5,21,2.75).map(([x,z])=>[x,z,1.8,'roca',1.1]), [-46,18,4,'cantaro',3.2], [44,-26,3,'frutilla',2.6]],
  cajas:[...anillo(7,16,.2), ...anillo(8,44,.6), ...anillo(4,66,0)],
  turbos:tangente(4,60,Math.PI/4), rampas:tangente(3,28,1.3),
  fuera:'campo'};
const ORDEN_ARENAS = ['plaza', 'expo'];
function armarArena(id){
  if(_PISTA_CACHE[id]) return _PISTA_CACHE[id];
  const def=PISTAS[id], r=def.radio;
  const T = {id, def, arena:true, radio:r, tema:def.tema, S:[], N:1, paso:PASO, L:2*Math.PI*r, atajos:[], saltos:[], puentes:[], agua:[], nivelAgua:-5,
    obst:def.obst.map(([x,z,rr,t,s])=>({x,z,r:rr,t,s:s||1})), cajas:def.cajas.map(([x,z])=>({x,z})),
    turbos:def.turbos.map(([x,z,h])=>({x,z,h})), rampas:def.rampas.map(([x,z,h])=>({x,z,h})),
    caja:{x0:-r, x1:r, z0:-r, z1:r, cx:0, cz:0}};
  _PISTA_CACHE[id]=T; return T;
}

/* =====================================================================
   Geometría
   ===================================================================== */
const suave = t => { t = t<0?0:t>1?1:t; return t*t*(3-2*t); };
function cr(a, b, c, d, t){ const t2=t*t, t3=t2*t; return .5*((2*b) + (-a+c)*t + (2*a-5*b+4*c-d)*t2 + (-a+3*b-3*c+d)*t3); }

const _PISTA_CACHE = {};
function armarPista(id){
  if(_PISTA_CACHE[id]) return _PISTA_CACHE[id];
  if(PISTAS[id] && PISTAS[id].arena) return armarArena(id);
  const def = PISTAS[id], P = def.pts, n = P.length, K = 28;
  const at = cp => {
    const i = Math.floor(cp), t = cp - i, g = k => P[((i+k)%n+n)%n];
    const a=g(-1), b=g(0), c=g(1), d=g(2);
    return {x:cr(a[0],b[0],c[0],d[0],t), z:cr(a[1],b[1],c[1],d[1],t), y:cr(a[2]||0,b[2]||0,c[2]||0,d[2]||0,t), w:cr(a[3]||def.ancho,b[3]||def.ancho,c[3]||def.ancho,d[3]||def.ancho,t)};
  };
  // muestreo fino y después parejo cada PASO metros
  const fino = []; let L = 0;
  for(let k=0; k<=n*K; k++){
    const cp = (def.largada||0) + k/K, p = at(cp); p.cp = cp;
    if(k) L += Math.hypot(p.x-fino[k-1].x, p.z-fino[k-1].z);
    p.d = L; fino.push(p);
  }
  const N = Math.round(L/PASO), paso = L/N, S = [];
  for(let j=0, k=0; j<N; j++){
    const d = j*paso; while(fino[k+1].d < d) k++;
    const a=fino[k], b=fino[k+1], t=(d-a.d)/Math.max(1e-6, b.d-a.d), m=(u,v)=>u+(v-u)*t;
    S.push({x:m(a.x,b.x), z:m(a.z,b.z), y:m(a.y,b.y), w:m(a.w,b.w), cp:((m(a.cp,b.cp)%n)+n)%n, d});
  }
  for(let j=0; j<N; j++){
    const a=S[(j-1+N)%N], b=S[(j+1)%N], s=S[j];
    let tx=b.x-a.x, tz=b.z-a.z; const l=Math.hypot(tx,tz); tx/=l; tz/=l;
    s.tx=tx; s.tz=tz; s.nx=tz; s.nz=-tx;            // n = izquierda
    s.h=Math.atan2(tx,tz); s.pend=(b.y-a.y)/(2*paso);
  }
  for(let j=0; j<N; j++){
    const a=S[(j-1+N)%N], b=S[(j+1)%N];
    S[j].curva = (a.tx*b.tz - a.tz*b.tx)/(2*paso);   // + gira a la derecha... (signo según la mano), se usa sobre todo el valor absoluto
    S[j].puente = 0; S[j].marg = MARGEN;
  }
  const T = {id, def, S, N, paso, L, tema:def.tema};
  T.idxCp = cp => { cp=((cp%n)+n)%n; let best=0, bd=1e9; for(let j=0;j<N;j++){ let d=Math.abs(S[j].cp-cp); d=Math.min(d, n-d); if(d<bd){ bd=d; best=j; } } return best; };
  // puentes: sin pasto a los costados
  T.puentes = (def.puentes||[]).map(([a,b,estilo])=>{
    const i0=T.idxCp(a), i1=T.idxCp(b), len=((i1-i0)%N+N)%N;
    for(let k=0;k<=len;k++){ const s=S[(i0+k)%N]; s.puente=1; s.marg=.6; }
    for(let k=1;k<=5;k++){ S[((i0-k)%N+N)%N].marg=Math.min(S[((i0-k)%N+N)%N].marg, .6+k*1.8); S[(i1+k)%N].marg=Math.min(S[(i1+k)%N].marg, .6+k*1.8); }
    return {i0, len, estilo};
  });
  T.cajas = (def.cajas||[]).map(cp=>T.idxCp(cp));
  T.saltos = (def.saltos||[]).map(cp=>T.idxCp(cp));
  T.turbos = (def.turbos||[]).map(([cp,lat])=>({i:T.idxCp(cp), lat}));
  // atajos: un camino angosto de tierra que corta de un punto a otro
  T.atajos = (def.atajos||[]).map(a=>{
    const i0=T.idxCp(a.de), i1=T.idxCp(a.a), s0=S[i0], s1=S[i1], hw=a.w||3;
    const p0={x:s0.x+s0.nx*(a.l0||0)*(s0.w-1), z:s0.z+s0.nz*(a.l0||0)*(s0.w-1)}, p1={x:s1.x+s1.nx*(a.l1||0)*(s1.w-1), z:s1.z+s1.nz*(a.l1||0)*(s1.w-1)};
    const len=Math.hypot(p1.x-p0.x, p1.z-p0.z), m=Math.max(2, Math.round(len/3)), pts=[];
    const di=((i1-i0)%N+N)%N;
    for(let k=0;k<=m;k++){ const t=k/m; pts.push({x:p0.x+(p1.x-p0.x)*t, z:p0.z+(p1.z-p0.z)*t, y:s0.y+(s1.y-s0.y)*suave(t), t}); }
    return {i0, i1, di, pts, hw, len, tx:(p1.x-p0.x)/len, tz:(p1.z-p0.z)/len};
  });
  T.agua = def.agua||[]; T.nivelAgua = def.nivelAgua==null ? -1.5 : def.nivelAgua;
  // caja que encierra la pista
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for(const s of S){ x0=Math.min(x0,s.x); x1=Math.max(x1,s.x); z0=Math.min(z0,s.z); z1=Math.max(z1,s.z); }
  T.caja = {x0,x1,z0,z1, cx:(x0+x1)/2, cz:(z0+z1)/2};
  // el más cerrado de la pista (para los bots): cuánto hay que frenar en cada muestra
  T.vmax = S.map((s,j)=>{ let c=0; for(let k=0;k<12;k++) c=Math.max(c, Math.abs(S[(j+k)%N].curva)*(1-k/16)); return c; });
  _PISTA_CACHE[id] = T; return T;
}

/* dónde está un punto respecto de la pista, buscando cerca de la muestra "pista" (rápido) */
function ubicar(T, x, z, pista, atras, adelante){
  const S=T.S, N=T.N; let best=-1, bd=1e12;
  for(let k=-(atras||6); k<=(adelante||10); k++){
    const j=((pista+k)%N+N)%N, s=S[j], d=(x-s.x)*(x-s.x)+(z-s.z)*(z-s.z);
    if(d<bd){ bd=d; best=j; }
  }
  return detalle(T, x, z, best);
}
function ubicarGlobal(T, x, z){
  const S=T.S, N=T.N; let best=0, bd=1e12;
  for(let j=0;j<N;j++){ const s=S[j], d=(x-s.x)*(x-s.x)+(z-s.z)*(z-s.z); if(d<bd){ bd=d; best=j; } }
  return detalle(T, x, z, best);
}
const _det = {i:0, f:0, lat:0, y:0, w:8, marg:MARGEN, tx:0, tz:1, h:0, pend:0, puente:0, curva:0};
function detalle(T, x, z, j){
  const S=T.S, N=T.N, s=S[j], dx=x-s.x, dz=z-s.z;
  let al=(dx*s.tx+dz*s.tz)/T.paso; al = al<-1?-1:al>1?1:al;
  const o=S[((j+(al<0?-1:1))%N+N)%N], t=Math.abs(al);
  _det.i=j; _det.f=j+al; _det.lat=dx*s.nx+dz*s.nz;
  _det.y=s.y+(o.y-s.y)*t; _det.w=s.w+(o.w-s.w)*t; _det.marg=s.marg+(o.marg-s.marg)*t;
  _det.tx=s.tx; _det.tz=s.tz; _det.h=s.h; _det.pend=s.pend; _det.puente=s.puente; _det.curva=s.curva;
  return _det;
}
/* ¿está sobre un atajo? devuelve {a, t, y, lat} o null */
const _ata = {a:null, t:0, y:0, lat:0};
function enAtajo(T, x, z, idx){
  for(const a of T.atajos){
    const rel=((idx-a.i0)%T.N+T.N)%T.N;
    if(rel>a.di+6 && rel<T.N-6) continue;
    const p0=a.pts[0], dx=x-p0.x, dz=z-p0.z, al=dx*a.tx+dz*a.tz, lat=dx*a.tz-dz*a.tx;
    if(al<-2 || al>a.len+2 || Math.abs(lat)>a.hw+1.2) continue;
    const t=Math.max(0, Math.min(1, al/a.len)), s0=T.S[a.i0], s1=T.S[a.i1];
    _ata.a=a; _ata.t=t; _ata.lat=lat; _ata.y=s0.y+(s1.y-s0.y)*suave(t);
    return _ata;
  }
  return null;
}
/* agua: cuánto se hunde el terreno en (x,z): 0 = nada, 1 = todo */
function enAgua(T, x, z){
  let f=0;
  for(const a of T.agua){
    let d;
    if(a.c) d = a.r - Math.hypot(x-a.c[0], z-a.c[1]);
    else d = Math.min(x-a.r4[0], a.r4[2]-x, z-a.r4[1], a.r4[3]-z);
    f = Math.max(f, suave(d/12));
  }
  return f;
}
/* altura del terreno en cualquier lugar del mapa (para el piso y los decorados) */
const _ter = {y:0, dist:0, agua:0};
function terreno(T, x, z){
  const S=T.S, N=T.N; let best=0, bd=1e12;
  for(let j=0;j<N;j+=2){ const s=S[j], d=(x-s.x)*(x-s.x)+(z-s.z)*(z-s.z); if(d<bd){ bd=d; best=j; } }
  for(const j of [(best+1)%N, (best-1+N)%N]){ const s=S[j], d=(x-s.x)*(x-s.x)+(z-s.z)*(z-s.z); if(d<bd){ bd=d; best=j; } }
  const s=S[best], dist=Math.sqrt(bd);
  let y=s.y, borde=dist-s.w;
  // atajos: el terreno acompaña su altura
  for(const a of T.atajos){ const p0=a.pts[0], dx=x-p0.x, dz=z-p0.z, al=dx*a.tx+dz*a.tz, lat=Math.abs(dx*a.tz-dz*a.tx);
    if(al>-6 && al<a.len+6 && lat<a.hw+8){ const t=Math.max(0,Math.min(1,al/a.len)), ya=S[a.i0].y+(S[a.i1].y-S[a.i0].y)*suave(t), k=1-suave((lat-a.hw)/8); y=y+(ya-y)*k; borde=Math.min(borde, lat-a.hw); } }
  const fa=enAgua(T, x, z); let hundir=0;
  if(fa>0){ hundir = fa * (s.puente ? suave((dist-1)/3+.6) : suave((borde-MARGEN-2)/12)); }
  // lomas lejos de la pista
  const rel=(T.tema.relieve||0.8), lej=suave((borde-22)/70);
  const ondas=(Math.sin(x*.021+1.3)*Math.cos(z*.017-.6)+Math.sin(x*.043-z*.031)*.5+1.1);
  y += ondas*rel*6*lej*(1-fa);
  if(hundir>0) y = y + ((T.nivelAgua-3.5)-y)*hundir;
  _ter.y=y; _ter.dist=dist; _ter.borde=borde; _ter.agua=fa*hundir;
  return _ter;
}

if(typeof module!=='undefined') module.exports = {PISTAS, COPAS, ORDEN_PISTAS, ORDEN_ARENAS, armarPista, armarArena, ubicar, ubicarGlobal, enAtajo, terreno, enAgua, PASO, MARGEN};
