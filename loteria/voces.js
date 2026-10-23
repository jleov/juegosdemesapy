// Datos compartidos por la Lotería y el Grabador de Cantos: dichos, pronunciación, voces y cantos grabados.
'use strict';
// Dichos que dice el cantor antes de cada número, al estilo de la lotería familiar paraguaya.
// Para cambiar uno, editá el texto al lado de su número.
const DICHOS = {
  1:'Ary pyahu, año nuevo', 2:'El patito', 3:'Mbohapy, los tres reyes', 4:'La silla de la abuela', 5:'Po, la mano abierta',
  6:'La chipa calentita', 7:'El Luisón, séptimo hijo', 8:'La Virgen de Caacupé', 9:'El kambuchi', 10:'Mokõi po, las dos manos',
  11:'Kamba canilla', 12:'La docena de chipa', 13:'El Pombero', 14:'Fiesta patria', 15:'La niña bonita, mitãkuña porã',
  16:'El mbeju de la abuela', 17:'La sopa paraguaya', 18:'Ya es mayor de edad', 19:'El vori vori', 20:'Mitã rusu, los veinte años',
  21:'El tereré con yuyo', 22:'Los dos patitos', 23:'La guampa', 24:'Nochebuena', 25:'Navidad, el pesebre',
  26:'El so\'o yosopy', 27:'La bombilla', 28:'El kiveve', 29:'El chipa guasu', 30:'Fin de mes, ndaipóri pirapire',
  31:'El Jasy Jatere', 32:'El arpa paraguaya', 33:'Ñandejára ary', 34:'El pastel mandi\'o', 35:'La guarania',
  36:'La polca paraguaya', 37:'El Kurupi', 38:'El ñandutí', 39:'El mbokaja', 40:'Cuarenta grados a la siesta',
  41:'El karai guasu', 42:'El tatakua', 43:'La mandi\'o chyryry', 44:'Las dos sillitas', 45:'El sombrero piri',
  46:'El lapacho florido', 47:'El Mboi Tu\'i', 48:'El Moñai', 49:'El Teju Jagua', 50:'Medio siglo',
  51:'El Ao Ao', 52:'La Ka\'a Jarýi', 53:'Cerro Corá', 54:'La carreta', 55:'Los dos cincos, po ha po',
  56:'El burrito de la chacra', 57:'Mbarakaja, el gato', 58:'Ryguasu, la gallina', 59:'Jagua\'i, el perrito', 60:'El karumbé',
  61:'El cocido negro', 62:'El tren de Sapucai', 63:'La playa de Encarnación', 64:'El lago Ypacaraí', 65:'La jubilación',
  66:'Las dos guampas', 67:'El mburukuja', 68:'La naranja hái', 69:'Tereré jere, la ronda del tereré', 70:'Karai tuja, setenta pirulos',
  71:'El caburé', 72:'El yacaré del Chaco', 73:'El Chaco boreal', 74:'El río Paraná', 75:'El río Paraguay',
  76:'Kurusu, la cruz', 77:'Las dos banderitas', 78:'Pykasu, la paloma', 79:'El tatu carreta', 80:'Jarýi, la abuela',
  81:'El yerbal', 82:'El ka\'a he\'ẽ', 83:'El mate dulce', 84:'El burro de la chacra', 85:'Ka\'aguy, el monte',
  86:'Kokue, la chacra', 87:'Ñu, el campo', 88:'Las dos gorditas', 89:'El que cierra la puerta', 90:'Taita guasu, el abuelo'
};
const dicho = n => DICHOS[n] || '';
// Cómo tiene que leer el cantor las palabras en guaraní. La voz del celular habla castellano,
// así que se escribe "a la castellana": j → y, h → j, la ' (puso) se junta, y el acento va donde lo pone el guaraní
// (casi siempre en la última sílaba). La "y" guaraní (la sexta vocal) no existe en castellano: se acerca con "i".
const HABLA = {
  1:'Arí piajú, año nuevo', 3:'Mbojapí, los tres reyes', 9:'El cambuchí', 10:'Mocói po, las dos manos',
  11:'Cambá canilla', 15:'La niña bonita, mitancuñá porán', 16:'El mbeyú de la abuela', 19:'El vorí vorí',
  20:'Mitán rusú, los veinte años', 26:'El so-ó yosopí', 28:'El quivevé', 29:'El chipá guasú',
  30:'Fin de mes, ndaipóri pirapiré', 31:'El Yasí Yateré', 33:'Ñandeyára arí', 34:'El pastel mandió',
  37:'El Curupí', 39:'El mbocayá', 41:'El carái guasú', 42:'El tatacuá', 43:'La mandió chirirí',
  45:'El sombrero pirí', 47:'El Mbói Tu-í', 48:'El Moñái', 49:'El Teyú Yaguá', 51:'El Aó Aó',
  52:'La Caá Yarií', 55:'Los dos cincos, po já po', 57:'Mbaracayá, el gato', 58:'Riguasú, la gallina',
  59:'Yagua-í, el perrito', 60:'El carumbé', 62:'El tren de Sapucái', 64:'El lago Ipacaraí',
  67:'El mburucuyá', 68:'La naranja jái', 69:'Tereré yeré, la ronda del tereré', 70:'Carái tuyá, setenta pirulos',
  76:'Curusú, la cruz', 79:'El tatú carreta', 80:'Yarií, la abuela', 82:'El caá jeén', 85:'Caaguí, el monte',
  86:'Cocué, la chacra', 90:'Táita guasú, el abuelo'
};
const habla = n => HABLA[n] || dicho(n);
const UNID = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const DEC = {3:'treinta',4:'cuarenta',5:'cincuenta',6:'sesenta',7:'setenta',8:'ochenta',9:'noventa'};
const enLetras = n => n<30 ? UNID[n] : DEC[Math.floor(n/10)] + (n%10 ? ' y '+UNID[n%10] : '');

// Cantores: cada uno usa una voz de hombre o de mujer del dispositivo con su propio tono y velocidad.
// Las voces dependen del celular o la PC; si solo hay una voz en español, se cambia el tono.
const CANTORES = [
  {id:'don',     nombre:'🎩 Don Cantor',          desc:'El de siempre',            sexo:'h', pitch:1,    rate:.95},
  {id:'dona',    nombre:'🌺 Doña Rosa',           desc:'Voz de mujer',             sexo:'m', pitch:1.05, rate:.95},
  {id:'chica',   nombre:'💃 Mitãkuña alegre',     desc:'Mujer joven, rapidita',    sexo:'m', pitch:1.45, rate:1.1},
  {id:'abuela',  nombre:'👵 Jarýi, la abuela',     desc:'Mujer, despacito',         sexo:'m', pitch:.8,   rate:.78},
  {id:'abuelo',  nombre:'👴 Taita, el abuelo',     desc:'Voz gruesa y lenta',       sexo:'h', pitch:.6,   rate:.8},
  {id:'locutor', nombre:'📻 Locutor de radio',    desc:'Hombre, con energía',      sexo:'h', pitch:.85,  rate:1.15}
];
const VOZ_M = /sabina|helena|laura|elvira|paulina|m[oó]nica|dalia|luc[ií]a|paloma|marisol|elena|catalina|ximena|isabel|camila|valentina|francisca|female|mujer|femen/i;
const VOZ_H = /ra[uú]l|pablo|jorge|diego|[aá]lvaro|juan|carlos|enrique|tom[aá]s|gonzalo|jos[eé]|male|hombre|mascul/i;
function vozPara(sexo){
  const es=speechSynthesis.getVoices().filter(v=>/^es/i.test(v.lang));
  const pref = sexo==='m' ? es.find(v=>VOZ_M.test(v.name) && !/\bmale\b/i.test(v.name)) : es.find(v=>VOZ_H.test(v.name) && !/female/i.test(v.name));
  return pref || es[0] || null;
}
const cantorTTS = id => CANTORES.find(c=>c.id===id) || CANTORES[0];
// texto propio por número que puede tener un cantor grabado (lo que dice en su audio), hasta 80 letras
const limpiarTextos = t => { const o={}; if(t && typeof t==='object') for(const k in t){ const n=+k, v=String(t[k]||'').replace(/\s+/g,' ').trim().slice(0,80); if(n>=1 && n<=90 && v) o[n]=v; } return o; };
const dichoDe = (n, textos) => (textos && textos[n]) || dicho(n);
// lo que dice el cantor por cada bolilla: primero el dicho (o el texto propio) y después el número
const textoCanto = (n, textos) => `${(textos && textos[n]) || habla(n)}... ¡El ${n}!`;
function hablarTTS(txt, cantorId){
  if(!window.speechSynthesis) return;
  try{ speechSynthesis.cancel(); const c=cantorTTS(cantorId), u=new SpeechSynthesisUtterance(txt); u.lang='es-ES';
    u.rate=c.rate; u.pitch=c.pitch; const v=vozPara(c.sexo); if(v){ u.voice=v; u.lang=v.lang; } speechSynthesis.speak(u); }catch(e){}
}

/* ====================== CANTOS GRABADOS ======================
   Cada cantor grabado tiene un nombre y hasta 90 grabaciones (una por número, de 10 segundos como máximo).
   Se guardan en este dispositivo (IndexedDB). Para llevarlos a otro, se bajan como archivo y se cargan allá. */
const MAX_SEG = 10;
const CantosDB = (()=>{
  let dbp=null;
  const db = () => dbp || (dbp = new Promise((res,rej)=>{
    const r=indexedDB.open('juegospy-cantos', 1);
    r.onupgradeneeded = () => { const d=r.result; d.createObjectStore('cantores', {keyPath:'id'}); d.createObjectStore('clips', {keyPath:'k'}); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const req = (store, mode, make) => db().then(d=>new Promise((res,rej)=>{
    const t=d.transaction(store, mode), r=make(t.objectStore(store));
    t.oncomplete = () => res(r ? r.result : undefined); t.onerror = t.onabort = () => rej(t.error);
  }));
  const rango = id => IDBKeyRange.bound(id+':', id+':￿');
  return {
    lista: () => req('cantores','readonly', s=>s.getAll()),
    cantor: id => req('cantores','readonly', s=>s.get(id)),
    guardarCantor: c => req('cantores','readwrite', s=>s.put(c)),
    borrarCantor: async id => { await req('clips','readwrite', s=>s.delete(rango(id))); await req('cantores','readwrite', s=>s.delete(id)); },
    clip: (id,n) => req('clips','readonly', s=>s.get(id+':'+n)),
    clips: id => req('clips','readonly', s=>s.getAll(rango(id))),
    guardarClip: (id,n,blob,dur) => req('clips','readwrite', s=>s.put({k:id+':'+n, id, n:+n, blob, type:blob.type, dur})),
    borrarClip: (id,n) => req('clips','readwrite', s=>s.delete(id+':'+n)),
    numeros: id => req('clips','readonly', s=>s.getAllKeys(rango(id))).then(ks=>ks.map(k=>+String(k).split(':')[1]))
  };
})();
const nuevoId = () => 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const blobABase64 = b => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(',')[1]); r.onerror=rej; r.readAsDataURL(b); });
const base64ABlob = (s,type) => { const bin=atob(s), a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a], {type}); };
// archivo para llevar un cantor a otro dispositivo
async function exportarCantor(id){
  const c=await CantosDB.cantor(id), clips=await CantosDB.clips(id);
  const datos={formato:'juegospy-cantos', version:1, nombre:c.nombre, base:c.base, textos:limpiarTextos(c.textos),
    clips: await Promise.all(clips.map(async x=>({n:x.n, type:x.type, dur:x.dur, data:await blobABase64(x.blob)})))};
  return new Blob([JSON.stringify(datos)], {type:'application/json'});
}
async function importarCantor(texto){
  const d=JSON.parse(texto);
  if(d.formato!=='juegospy-cantos' || !Array.isArray(d.clips)) throw new Error('Ese archivo no es de cantos de la Lotería.');
  const id=nuevoId();
  await CantosDB.guardarCantor({id, nombre:String(d.nombre||'Cantor').slice(0,30), base:cantorTTS(d.base).id, textos:limpiarTextos(d.textos), creado:Date.now()});
  for(const x of d.clips){ const n=+x.n; if(n>=1 && n<=90 && x.data) await CantosDB.guardarClip(id, n, base64ABlob(x.data, x.type||'audio/webm'), Math.min(MAX_SEG, +x.dur||0)); }
  return id;
}
let audioActual=null;
function tocarBlob(blob){
  try{ if(audioActual){ audioActual.pause(); URL.revokeObjectURL(audioActual.src); } }catch(e){}
  if(window.speechSynthesis) speechSynthesis.cancel();
  const a=new Audio(URL.createObjectURL(blob)); audioActual=a;
  return a.play();
}
