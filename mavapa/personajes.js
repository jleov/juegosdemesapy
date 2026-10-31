'use strict';
/* =====================================================================
   ¿Mávapa? — los personajes.
   Para agregar uno: copiá una línea, poné la foto (240×240, ya en
   caricatura) en fotos/<id>.jpg y elegí sus rasgos de la lista RASGOS.
   También se pueden agregar desde el juego (botón "Mis personajes") y
   después mandar el archivo para sumarlos acá a todos.
     cat:  fut futbolistas · his históricos · pol políticos · far farándula · inf influencers
     nac:  año en que nació (aproximado en algunos influencers)
     fin:  año en que murió (vacío = vive)
     r:    rasgos separados por coma (ver RASGOS)
   ===================================================================== */
const CATS = {
  fut:{n:'Futbolistas', e:'⚽', c:'#2a9d3f'},
  his:{n:'Históricos',  e:'📜', c:'#8d5a2b'},
  pol:{n:'Políticos',   e:'🏛️', c:'#1d4fbf'},
  far:{n:'Farándula',   e:'🎤', c:'#c2185b'},
  inf:{n:'Influencers', e:'📱', c:'#7c4dff'},
  mio:{n:'Agregados',   e:'⭐', c:'#e09b00'},
};
// rasgos que se pueden preguntar (los de "foto" se ven en la caricatura)
const RASGOS = [
  {k:'muj', q:'¿Es mujer?',                          t:'Mujer'},
  {k:'ant', q:'¿Usa anteojos?',                      t:'Anteojos', foto:1},
  {k:'bar', q:'¿Tiene barba?',                       t:'Barba', foto:1},
  {k:'big', q:'¿Tiene bigote?',                      t:'Bigote', foto:1},
  {k:'pel', q:'¿Es pelado o tiene poco pelo?',       t:'Pelado', foto:1},
  {k:'can', q:'¿Tiene el pelo canoso (blanco o gris)?', t:'Canoso', foto:1},
  {k:'rub', q:'¿Tiene el pelo rubio o claro?',       t:'Rubio', foto:1},
  {k:'lar', q:'¿Tiene el pelo largo?',               t:'Pelo largo', foto:1},
  {k:'gor', q:'¿Tiene gorro, gorra o sombrero?',     t:'Gorro', foto:1},
  {k:'son', q:'¿Sonríe mostrando los dientes?',      t:'Sonríe', foto:1},
  {k:'cor', q:'¿Tiene corbata?',                     t:'Corbata', foto:1},
  {k:'uni', q:'¿Tiene uniforme militar?',            t:'Uniforme', foto:1},
  {k:'cam', q:'¿Tiene camiseta de fútbol?',          t:'Camiseta', foto:1},
  {k:'gui', q:'¿Aparece con una guitarra?',          t:'Guitarra', foto:1},
  {k:'tat', q:'¿Se le ven tatuajes?',                t:'Tatuajes', foto:1},
  {k:'ban', q:'¿Tiene la banda presidencial puesta?', t:'Banda presidencial', foto:1},
  {k:'gob', q:'¿Gobernó el Paraguay?',               t:'Gobernó'},
  {k:'mil', q:'¿Fue militar?',                       t:'Militar'},
  {k:'sel', q:'¿Jugó en la Selección Paraguaya?',    t:'Selección'},
  {k:'arq', q:'¿Es o fue arquero?',                  t:'Arquero'},
  {k:'mus', q:'¿Es músico o cantante?',              t:'Músico'},
  {k:'cin', q:'¿Trabaja en cine o televisión como actor o director?', t:'Cine'},
  {k:'esc', q:'¿Es o fue escritor?',                 t:'Escritor'},
  {k:'ext', q:'¿Nació fuera del Paraguay?',          t:'Extranjero'},
];
// preguntas que salen del año de nacimiento o de la categoría
const PREG_EXTRA = [
  {k:'vivo',  q:'¿Está vivo?',                       f:p=>!p.fin},
  {k:'n1900', q:'¿Nació antes de 1900?',             f:p=>p.nac<1900},
  {k:'n1950', q:'¿Nació antes de 1950?',             f:p=>p.nac<1950},
  {k:'n1990', q:'¿Nació después de 1990?',           f:p=>p.nac>=1990},
  {k:'nomAM', q:'¿Su nombre empieza con una letra de la A a la M?', f:p=>/^[a-m]/i.test(p.n.normalize('NFD').replace(/[̀-ͯ]/g,''))},
  ...Object.keys(CATS).filter(c=>c!=='mio').map(c=>({k:'cat_'+c, q:{fut:'¿Es futbolista?', his:'¿Es un personaje histórico?', pol:'¿Es político?', far:'¿Es de la farándula (artista, modelo, músico)?', inf:'¿Es influencer?'}[c], f:p=>p.cat===c})),
];

const PERSONAJES = [
  // ⚽ Futbolistas
  {id:'chilavert', n:'José Luis Chilavert', cat:'fut', nac:1965, r:'sel,arq,cam', bio:'Arquero goleador: hizo goles de tiro libre y de penal. Tres veces el mejor arquero del mundo.'},
  {id:'santacruz', n:'Roque Santa Cruz', cat:'fut', nac:1981, r:'sel,cam', bio:'Delantero de Olimpia, Bayern Múnich y Blackburn. Uno de los máximos goleadores de la Albirroja.'},
  {id:'gamarra', n:'Carlos Gamarra', cat:'fut', nac:1971, r:'sel,cam', bio:'Defensor central y capitán. Famoso por jugar el Mundial 1998 sin hacer una sola falta.'},
  {id:'cabanas', n:'Salvador Cabañas', cat:'fut', nac:1980, r:'sel,son,cam', bio:'Goleador del América de México y de la Selección.'},
  {id:'cardozo', n:'Óscar Cardozo', cat:'fut', nac:1983, r:'sel,cam', bio:'"Tacuara", delantero zurdo, ídolo del Benfica de Portugal.'},
  {id:'valdez', n:'Nelson Haedo Valdez', cat:'fut', nac:1983, r:'sel,cam', bio:'Delantero del Borussia Dortmund, goleador de la Selección rumbo a Sudáfrica 2010.'},
  {id:'villar', n:'Justo Villar', cat:'fut', nac:1977, r:'sel,arq,cam', bio:'Arquero y capitán de la Albirroja en el Mundial 2010.'},
  {id:'almiron', n:'Miguel Almirón', cat:'fut', nac:1994, r:'sel,son,cam', bio:'Volante rápido de Atlanta United y del Newcastle de Inglaterra.'},
  {id:'enciso', n:'Julio Enciso', cat:'fut', nac:2004, r:'sel,cam,rub,tat', bio:'Joven crack surgido de Libertad que jugó en la Premier League.'},
  {id:'erico', n:'Arsenio Erico', cat:'fut', nac:1915, fin:1977, r:'cam', bio:'"El Diablo Saltarín": máximo goleador de la historia del fútbol argentino con Independiente.'},
  {id:'dasilva', n:'Paulo da Silva', cat:'fut', nac:1980, r:'sel,cam', bio:'Defensor central, uno de los jugadores con más partidos en la Selección.'},
  {id:'sanabria', n:'Antonio Sanabria', cat:'fut', nac:1996, r:'sel,bar,big,cam,tat', bio:'Delantero que jugó en Italia (Torino) y España.'},
  {id:'romerito', n:'Julio César Romero', cat:'fut', nac:1960, r:'sel,son,cam', bio:'"Romerito": figura del Cosmos y del Fluminense; ganó la Copa América 1979.'},
  {id:'diegogomez', n:'Diego Gómez', cat:'fut', nac:2003, r:'sel,cam', bio:'Volante joven que pasó de Libertad al Inter Miami y a Inglaterra.'},
  // 📜 Históricos
  {id:'francia', n:'José Gaspar Rodríguez de Francia', cat:'his', nac:1766, fin:1840, r:'gob', bio:'"El Supremo": gobernó el Paraguay independiente desde 1814 hasta su muerte.'},
  {id:'calopez', n:'Carlos Antonio López', cat:'his', nac:1792, fin:1862, r:'gob,pel', bio:'Presidente que modernizó el país: ferrocarril, astillero y escuelas.'},
  {id:'solanolopez', n:'Francisco Solano López', cat:'his', nac:1826, fin:1870, r:'gob,mil,bar,big,uni', bio:'Mariscal y presidente durante la Guerra de la Triple Alianza. Murió en Cerro Corá.'},
  {id:'lynch', n:'Elisa Alicia Lynch', cat:'his', nac:1833, fin:1886, r:'muj,ext', bio:'Irlandesa, compañera de Francisco Solano López durante la guerra.'},
  {id:'bcaballero', n:'Bernardino Caballero', cat:'his', nac:1839, fin:1912, r:'gob,mil,bar,big', bio:'General de la guerra, presidente y fundador del Partido Colorado.'},
  {id:'estigarribia', n:'José Félix Estigarribia', cat:'his', nac:1888, fin:1940, r:'gob,mil,uni,gor', bio:'Mariscal, conductor del ejército en la Guerra del Chaco y después presidente.'},
  {id:'roabastos', n:'Augusto Roa Bastos', cat:'his', nac:1917, fin:2005, r:'esc,can', bio:'Escritor de "Yo el Supremo", ganó el Premio Cervantes en 1989.'},
  {id:'mangore', n:'Agustín Barrios "Mangoré"', cat:'his', nac:1885, fin:1944, r:'mus,big,gui', bio:'Genio de la guitarra clásica, autor de "La Catedral".'},
  {id:'jaflores', n:'José Asunción Flores', cat:'his', nac:1904, fin:1972, r:'mus,pel,cor', bio:'Músico que creó la guarania, autor de "India" y "Panambí verá".'},
  {id:'yegros', n:'Fulgencio Yegros', cat:'his', nac:1780, fin:1821, r:'gob,mil,bar,big,uni', bio:'Prócer de la independencia de 1811 y primer gobernante del Paraguay independiente.'},
  // 🏛️ Políticos
  {id:'pena', n:'Santiago Peña', cat:'pol', nac:1978, r:'gob,son', bio:'Economista, presidente de la República desde 2023.'},
  {id:'abdo', n:'Mario Abdo Benítez', cat:'pol', nac:1971, r:'gob,son,can,bar,big,cor', bio:'"Marito", presidente de 2018 a 2023.'},
  {id:'cartes', n:'Horacio Cartes', cat:'pol', nac:1956, r:'gob,son,cor', bio:'Empresario y presidente de 2013 a 2018.'},
  {id:'lugo', n:'Fernando Lugo', cat:'pol', nac:1951, r:'gob,ant,bar,big,can,son,ban', bio:'Ex obispo, presidente de 2008 a 2012.'},
  {id:'nicanor', n:'Nicanor Duarte Frutos', cat:'pol', nac:1956, r:'gob,ant,son,cor,ban', bio:'Presidente de 2003 a 2008.'},
  {id:'efrain', n:'Efraín Alegre', cat:'pol', nac:1963, r:'', bio:'Líder del Partido Liberal y candidato a presidente.'},
  {id:'kattya', n:'Kattya González', cat:'pol', nac:1980, r:'muj,lar', bio:'Abogada y legisladora, conocida por sus discursos en el Congreso.'},
  {id:'payo', n:'"Payo" Cubas', cat:'pol', nac:1962, r:'pel,bar,big,can,son', bio:'Paraguayo Cubas, político polémico, candidato a presidente en 2023.'},
  {id:'samaniego', n:'Lilian Samaniego', cat:'pol', nac:1958, r:'muj,son', bio:'Senadora y ex presidenta del Partido Colorado.'},
  // 🎤 Farándula
  {id:'larissa', n:'Larissa Riquelme', cat:'far', nac:1985, r:'muj,lar,son', bio:'Modelo que se hizo famosa en el Mundial 2010 como "la novia del Mundial".'},
  {id:'nadia', n:'Nadia Ferreira', cat:'far', nac:1999, r:'muj,lar', bio:'Modelo, segunda en Miss Universo 2021.'},
  {id:'bertarojas', n:'Berta Rojas', cat:'far', nac:1966, r:'muj,mus,son,gui', bio:'Guitarrista clásica reconocida en todo el mundo.'},
  {id:'lali', n:'Lali González', cat:'far', nac:1985, r:'muj,cin,lar', bio:'Actriz de la película "7 cajas".'},
  {id:'marilina', n:'Marilina Bogado', cat:'far', nac:1996, r:'muj,mus,gor,rub,lar,son', bio:'Cantante paraguaya, conocida por su estilo vaquero.'},
  // 📱 Influencers
  {id:'ariel', n:'Ariel Delgadillo', cat:'inf', nac:1995, r:'bar,big', bio:'Tiktoker de humor, uno de los creadores más queridos del país.'},
  {id:'romi', n:'Romi Mendoza', cat:'inf', nac:1998, r:'muj', bio:'Influencer de TikTok con millones de seguidores.'},
  {id:'fabri', n:'Fabri Velázquez', cat:'inf', nac:2001, r:'gor,son', bio:'Tiktoker de humor.'},
  {id:'diegovera', n:'Diego Vera', cat:'inf', nac:1992, r:'', bio:'Creador de videos de humor familiar.'},
  {id:'rebecca', n:'Rebecca Bareiro', cat:'inf', nac:2000, r:'muj,lar,son', bio:'Creadora de contenido en TikTok.'},
  {id:'marcosdiaz', n:'Marcos Díaz Villalba', cat:'inf', nac:1996, r:'', bio:'Creador de contenido en TikTok.'},
  {id:'nadiaportillo', n:'Nadia Portillo', cat:'inf', nac:1998, r:'muj,lar', bio:'Creadora de contenido paraguaya.'},
  {id:'verodelgado', n:'Vero Delgado', cat:'inf', nac:2000, r:'muj,lar,son', bio:'Creadora de contenido paraguaya.'},
  {id:'laurys', n:'Laurys Divas', cat:'inf', nac:1998, r:'muj,lar', bio:'Creadora de contenido paraguaya.'},
  {id:'franccesco', n:'Franccesco Masivo', cat:'inf', nac:1995, r:'gor,son,tat', bio:'Creador de contenido paraguayo.'},
  {id:'juanrios', n:'Juan Ríos', cat:'inf', nac:1998, r:'cam,son', bio:'Tiktoker paraguayo con más de un millón de seguidores.'},
  {id:'angelgauto', n:'Ángel Gauto "Atomic"', cat:'inf', nac:2003, r:'', bio:'Creador de contenido paraguayo.'},
];
PERSONAJES.forEach(p=>{ p.foto='fotos/'+p.id+'.jpg'; });

// ¿la respuesta a esta pregunta rápida, para este personaje, es "sí"?
function respuesta(p, k){
  const x=PREG_EXTRA.find(q=>q.k===k); if(x) return !!x.f(p);
  return String(p.r||'').split(',').includes(k);
}
const PREGUNTAS = [...RASGOS.map(r=>({k:r.k, q:r.q})), ...PREG_EXTRA.map(q=>({k:q.k, q:q.q}))];
