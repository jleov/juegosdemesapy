/* =====================================================================
   Filtro de palabras ofensivas del chat (español, guaraní y jopara).
   Compara palabra por palabra después de pasar a minúsculas, sacar acentos,
   cambiar números por letras (pu7a, p3rra, 1diota) y juntar letras sueltas
   (p u t a, p.u.t.a). Lo usan el que escribe y la central (que es la que manda).
   Para agregar palabras: EXACTAS (la palabra entera), EMPIEZA (palabras que
   empiezan así) o ADENTRO (en cualquier parte de la palabra).
   ===================================================================== */
window.FILTRO_CHAT = (function(){
  const EXACTAS = ['hdp','hdpm','ptm','ctm','lpm','lpmqtp','pija','pijas','pijudo','pijuda','conyo','conya','culo','culos','concha','conchas','forro','forra','joto','tako','verga','vergas','vergon','cogete','cogeme','chupala','chupalo','chupame','mamala','mamame','negrata','sudaca'];
  const EMPIEZA = ['puta','puto','putit','putaz','idiot','tarad','marica','maricon','trolo','cagon','zorra','perra','ramera','violad','violar','follar','culea','culia','culer','cabron','pajer','porno','tembo','imbecil','estupid','pendej','sorete','pelotud','mogol','subnormal','prostitut','malparid','gonorrea','mamaguev','huevon','chupapij','chupaverg','chupatembo','tetona','culon'];
  const ADENTRO = ['hijodeput','hijadeput','hijueput','mierd','rakore','nderakor','conchetu','conchesu','conchadesu','putamadre','putaqueteparo','chupapija','chupaverga','chupatembo','malcogid','pedofil'];
  // las que tienen letra doble se comparan sin juntar las dobles (perra ≠ pera, forro ≠ foro)
  const doble = w => /(.)\1/.test(w);
  const LEET = { '0':'o', '1':'i', '3':'e', '4':'a', '@':'a', '5':'s', '$':'s', '7':'t', '8':'b', '9':'g' };
  const base = s => String(s || '').toLowerCase().replace(/ñ/g, 'ny').normalize('NFD').replace(/[^\x00-\x7f]/g, '')
    .replace(/[013@4$5789]/g, c => LEET[c]).replace(/[^a-z\s]/g, '');
  const una = w => w.replace(/(.)\1+/g, '$1');          // puuuta → puta
  const dos = w => w.replace(/(.)\1{2,}/g, '$1$1');     // perrrra → perra
  function palabras(s){
    const crudas = base(s).split(/\s+/).filter(Boolean), out = [];
    let sueltas = '';
    crudas.forEach(w => {   // letras sueltas seguidas se juntan: "p u t a"
      if(w.length === 1){ sueltas += w; return; }
      if(sueltas.length > 2) out.push(sueltas); sueltas = '';
      out.push(w);
    });
    if(sueltas.length > 2) out.push(sueltas);
    return out;
  }
  const igual = (w, p) => doble(p) ? dos(w) === p : una(w) === una(p);
  const empieza = (w, p) => doble(p) ? dos(w).startsWith(p) : una(w).startsWith(una(p));
  const adentro = (w, p) => doble(p) ? dos(w).includes(p) : una(w).includes(una(p));
  function ofensivo(s){
    const ws = palabras(s);
    // además se mira todo junto sin espacios, solo para las de ADENTRO (ej.: "hijo de puta")
    const junto = ws.join('');
    return ws.some(w => EXACTAS.some(p => igual(w, p)) || EMPIEZA.some(p => empieza(w, p)) || ADENTRO.some(p => adentro(w, p)))
      || ADENTRO.some(p => adentro(junto, p));
  }
  return { ofensivo };
})();
