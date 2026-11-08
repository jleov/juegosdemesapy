/* =====================================================================
   Tarot Jasy — la mesa: formulario, barajar, cortar, repartir, dar vuelta,
   la lectura, el cielo estrellado y la música suave.
   ===================================================================== */
(function(){
const $ = s => document.querySelector(s);
const {MAZO, frenteSVG, dorso, nanduti} = window.TAROT;
const L = window.LECTURA;
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const espera = ms => new Promise(r=>setTimeout(r,ms));
const MOV = !matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- datos guardados ---------- */
let D = {nombre:'', d:0, m:0, a:0, tema:'amor', tirada:3, mazo:78, per:'dia'};
try{ Object.assign(D, JSON.parse(localStorage.getItem('tar_datos')||'{}')); }catch(e){}
function guardar(){ try{ localStorage.setItem('tar_datos', JSON.stringify(D)); }catch(e){} }

/* ---------- formulario ---------- */
function opciones(sel, ph, items){
  sel.innerHTML = `<option value="0" disabled>${ph}</option>` + items.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
}
const hoyAnio = new Date().getFullYear();
opciones($('#fDia'), 'Día', [...Array(31)].map((_,i)=>[i+1, i+1]));
opciones($('#fMes'), 'Mes', MESES.map((m,i)=>[i+1, m.charAt(0).toUpperCase()+m.slice(1)]));
opciones($('#fAnio'), 'Año', [...Array(hoyAnio-1919)].map((_,i)=>[hoyAnio-i, hoyAnio-i]));
$('#fNombre').value = D.nombre||'';
$('#fDia').value = D.d||0; $('#fMes').value = D.m||0; $('#fAnio').value = D.a||0;
if(!D.a){ $('#fAnio').value = 0; }

function fechaOk(){
  const d=+$('#fDia').value, m=+$('#fMes').value, a=+$('#fAnio').value;
  if(!d||!m||!a) return null;
  const f = new Date(a, m-1, d);
  if(f.getMonth()!==m-1) return null;
  return {d,m,a};
}
function verSigno(){
  const f = fechaOk(), el = $('#vistaSigno');
  if(!f){ el.textContent = ($('#fDia').value>0 && $('#fMes').value>0 && $('#fAnio').value>0) ? 'Esa fecha no existe 🙃' : ''; return; }
  const s = L.signo(f.d, f.m), nv = L.numeroVida(f.d, f.m, f.a);
  el.innerHTML = `${s.s}︎ <b>${s.n}</b> · ${s.el} · número de vida <b>${nv}</b>`;
}
['#fDia','#fMes','#fAnio'].forEach(s=>$(s).addEventListener('change', verSigno));
verSigno();

const temasEl = $('#temas');
Object.entries(L.TEMAS).forEach(([id,t])=>{
  const b = document.createElement('button'); b.className='tema'; b.dataset.t=id;
  b.innerHTML = `<span class="e">${t.e}</span><b>${t.t==='Dinero y trabajo'?'Dinero':t.t==='Viajes y cambios'?'Cambios':t.t==='Pregunta general'?'General':t.t}</b><i>${t.gn.split(' ')[0]}</i>`;
  b.onclick = ()=>{ D.tema=id; marcar(); sonido.toque(); };
  temasEl.appendChild(b);
});
const tirEl = $('#tiradas');
Object.entries(L.TIRADAS).forEach(([n,t])=>{
  const b = document.createElement('button'); b.className='opt'; b.dataset.n=n;
  b.innerHTML = `<div class="mini">${'<i></i>'.repeat(+n)}</div><b>${t.n}</b><span>${t.d}</span>`;
  b.onclick = ()=>{ D.tirada=+n; marcar(); sonido.toque(); };
  tirEl.appendChild(b);
});
document.querySelectorAll('#mazos .opt').forEach(b=> b.onclick = ()=>{ D.mazo=+b.dataset.m; marcar(); sonido.toque(); });
const PLAZO_E = {dia:'☀️', semana:'📅', mes:'🌙', anio:'✨', libre:'♾️'};
Object.entries(L.PERIODOS).forEach(([id,P])=>{
  const b = document.createElement('button'); b.className='opt'; b.dataset.p=id;
  b.innerHTML = `<span class="e">${PLAZO_E[id]}</span><b>${P.n}</b>`;
  b.onclick = ()=>{ D.per=id; marcar(); sonido.toque(); };
  $('#plazos').appendChild(b);
});
function marcar(){
  document.querySelectorAll('.tema').forEach(b=>b.classList.toggle('sel', b.dataset.t===D.tema));
  document.querySelectorAll('#tiradas .opt').forEach(b=>b.classList.toggle('sel', +b.dataset.n===D.tirada));
  document.querySelectorAll('#mazos .opt').forEach(b=>b.classList.toggle('sel', +b.dataset.m===D.mazo));
  document.querySelectorAll('#plazos .opt').forEach(b=>b.classList.toggle('sel', b.dataset.p===D.per));
  const c = L.cuando(D.per, new Date());
  $('#vistaPlazo').textContent = c ? `Las cartas van a hablar ${("de "+c).replace(/^de el /,"del ")}` : 'Una lectura sin fecha: el mensaje que tu alma necesita ahora';
}
if(!L.PERIODOS[D.per]) D.per='dia';
if(!L.TEMAS[D.tema]) D.tema='amor';
if(!L.TIRADAS[D.tirada]) D.tirada=3;
if(D.mazo!==22 && D.mazo!==78) D.mazo=78;
marcar();

// ñandutí del logo y de la mesa
$('#logoNandu').innerHTML = nanduti(50,50,46,3,24);
$('#nanduG').innerHTML = nanduti(50,50,48,5,36);

function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('on'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('on'), 2600); }

$('#btnConsultar').onclick = ()=>{
  const f = fechaOk();
  if(!f){ toast('Elegí tu fecha de nacimiento ✦'); $('#fDia').focus(); return; }
  D.nombre = $('#fNombre').value.trim().slice(0,30); Object.assign(D, f); guardar();
  sonido.activar();
  ir('pMesa'); ritual();
};
function ir(id){
  try{ voz.parar(); }catch(e){}
  document.querySelectorAll('.pant').forEach(p=>p.classList.toggle('on', p.id===id));
  window.scrollTo({top:0, behavior:'instant' in window ? 'instant' : 'auto'});
}

/* ---------- azar con semilla (la fecha marca la semilla, el azar la mueve) ---------- */
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function semilla(){
  let r = 0; try{ r = crypto.getRandomValues(new Uint32Array(1))[0]; }catch(e){ r = Math.random()*4294967296>>>0; }
  return (hashStr(`${D.d}/${D.m}/${D.a}|${D.nombre.toLowerCase()}|${D.tema}`) ^ r ^ Date.now())>>>0;
}

/* ---------- animaciones ---------- */
function anim(el, frames, opts){
  const a = el.animate(frames, Object.assign({fill:'forwards', easing:'cubic-bezier(.4,.1,.3,1)'}, opts));
  return a.finished.then(()=>{ const last=frames[frames.length-1]; if(last.transform!==undefined) el.style.transform=last.transform; a.cancel(); }).catch(()=>{});
}
let corrida = 0;  // para cortar un ritual viejo si se vuelve a tirar
const VIS = 14;   // cartas que se ven en el mazo animado

async function ritual(){
  const yo = ++corrida, vivo = ()=>yo===corrida;
  const fecha = new Date(), pf = L.perfil(D.nombre, D.d, D.m, D.a, fecha), T = L.TEMAS[D.tema];
  const TI = {...L.TIRADAS[D.tirada], pos:L.posiciones(D.tirada, D.per)};
  verModo(false);
  chips(pf, T, D.per);
  voz.parar(); $('#lectura').innerHTML=''; $('#finBtns').classList.add('oculto'); $('#btnLeer').classList.add('oculto'); $('#btnTodas').classList.add('oculto');
  const zona = $('#zonaMazo'); zona.classList.remove('chica');
  zona.querySelectorAll('.mz,.pila').forEach(e=>e.remove());
  const tir = $('#tirada'); tir.innerHTML=''; tir.className='t'+D.tirada;

  // el mazo real
  const rng = mulberry(semilla());
  let mazo = MAZO.filter(c=> D.mazo===78 || c.mayor).map(c=>({c, inv: rng()<0.3}));
  for(let i=mazo.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [mazo[i],mazo[j]]=[mazo[j],mazo[i]]; }

  // el mazo que se ve
  const els = [];
  for(let i=0;i<VIS;i++){ const e=document.createElement('div'); e.className='mz'; e.innerHTML=dorso(); e.style.zIndex=i; e.style.transform=base(i); zona.appendChild(e); els.push(e); }
  function base(i){ return `translate(${(i%3-1)*0.4}px,${-i*0.7}px)`; }

  msg(pf.nombre ? `${L.esc(pf.nombre)}, pensá en tu pregunta…` : 'Pensá en tu pregunta…');
  await espera(1300); if(!vivo()) return;
  msg('Barajando las cartas…');
  const w = zona.clientWidth, dx = Math.min(w*0.2, 95);
  // abanico
  sonido.barajar(0.6);
  await Promise.all(els.map((e,i)=>anim(e,[{transform:base(i)},{transform:`translateY(-8px) rotate(${(i-(VIS-1)/2)*8}deg)`}],{duration:650,delay:i*20})));
  els.forEach(e=>e.style.transformOrigin='50% 50%');
  await espera(250);
  await Promise.all(els.map((e,i)=>anim(e,[{transform:e.style.transform},{transform:base(i)}],{duration:450})));
  // riffle (dos veces) — mezcla de verdad el orden de las cartas que se ven
  for(let r=0;r<(MOV?2:1);r++){
    if(!vivo()) return;
    const izq = els.slice(0, VIS/2), der = els.slice(VIS/2);
    await Promise.all([...izq.map((e,i)=>anim(e,[{transform:e.style.transform},{transform:`translate(${-dx}px,${-i*0.7}px) rotate(-10deg)`}],{duration:380})),
      ...der.map((e,i)=>anim(e,[{transform:e.style.transform},{transform:`translate(${dx}px,${-i*0.7}px) rotate(10deg)`}],{duration:380}))]);
    sonido.barajar(0.9);
    const orden=[]; for(let i=0;i<VIS/2;i++){ orden.push(izq[i], der[i]); }
    await Promise.all(orden.map((e,k)=>{ e.style.zIndex=k; return anim(e,[{transform:e.style.transform},{transform:`translate(0,${-k*0.7-10}px)`},{transform:base(k)}],{duration:420,delay:k*45}); }));
    els.splice(0, els.length, ...orden);
  }
  // un par de cortes a mano
  if(MOV) for(let r=0;r<2;r++){
    if(!vivo()) return;
    const tope = els.slice(-5);
    sonido.barajar(0.25);
    await Promise.all(tope.map((e,k)=>anim(e,[{transform:e.style.transform},{transform:`translate(0,${-60-k}px) rotate(${r?4:-4}deg)`}],{duration:260})));
    const resto = els.slice(0,-5), nuevo=[...tope, ...resto];
    nuevo.forEach((e,k)=>e.style.zIndex=k);
    await Promise.all(nuevo.map((e,k)=>anim(e,[{transform:e.style.transform},{transform:base(k)}],{duration:300})));
    els.splice(0, els.length, ...nuevo);
  }
  if(!vivo()) return;

  // cortar el mazo
  msg('Cortá el mazo: tocá el montón que te llame');
  const grupos = [els.slice(0,5), els.slice(5,10), els.slice(10)];
  const gx = Math.min(w*0.3, 140);
  sonido.barajar(0.3);
  await Promise.all(grupos.flatMap((g,gi)=>g.map((e,k)=>anim(e,[{transform:e.style.transform},{transform:`translate(${(gi-1)*gx}px,${-k*0.7}px)`}],{duration:500,delay:gi*80}))));
  if(!vivo()) return;
  const elegido = await new Promise(res=>{
    grupos.forEach((g,gi)=>{
      const p=document.createElement('div'); p.className='pila'; p.style.left=`calc(50% + ${(gi-1)*gx}px - var(--mw)/2)`;
      p.setAttribute('role','button'); p.setAttribute('aria-label','Montón '+(gi+1));
      p.onclick=()=>{ zona.querySelectorAll('.pila').forEach(x=>x.remove()); res(gi); };
      zona.appendChild(p);
    });
  });
  if(!vivo()) return;
  sonido.toque();
  // el corte cambia de verdad el mazo
  const n = mazo.length, corte = Math.floor(n*(elegido+1)/4) + Math.floor(rng()*5);
  mazo = mazo.slice(corte).concat(mazo.slice(0,corte));
  const g = grupos[elegido];
  await Promise.all(g.map((e,k)=>anim(e,[{transform:e.style.transform},{transform:`translate(${(elegido-1)*gx}px,${-k*0.7-34}px)`}],{duration:350})));
  const otros = grupos.filter((_,i)=>i!==elegido).flat();
  const final = [...otros, ...g]; final.forEach((e,k)=>e.style.zIndex=k);
  sonido.barajar(0.3);
  await Promise.all(final.map((e,k)=>anim(e,[{transform:e.style.transform},{transform:base(k)}],{duration:500,delay:k*15})));
  els.splice(0, els.length, ...final);
  if(!vivo()) return;

  // repartir
  msg('Repartiendo…');
  const sacadas = mazo.slice(0, D.tirada);
  const slots = sacadas.map((t,k)=>{
    const s=document.createElement('div'); s.className='slot'+(t.inv?' inv':'');
    s.innerHTML = `<div class="pl">${TI.pos[k].n}</div><div class="carta" role="button" tabindex="0" aria-label="Carta: ${TI.pos[k].n}"><div class="giro"><div class="cara dorso">${dorso()}</div><div class="cara frente"><div class="rot">${frenteSVG(t.c)}</div></div></div></div><div class="nm"></div>`;
    s.style.visibility='hidden'; tir.appendChild(s); return s;
  });
  for(let k=0;k<slots.length;k++){
    if(!vivo()) return;
    const s=slots[k], cEl=s.querySelector('.carta'), top=els.pop();
    const a=top.getBoundingClientRect(), b=cEl.getBoundingClientRect();
    top.remove();
    s.style.visibility='visible';
    sonido.repartir();
    await anim(cEl,[{transform:`translate(${a.left-b.left+(a.width-b.width)/2}px,${a.top-b.top+(a.height-b.height)/2}px) scale(${a.width/b.width}) rotate(${(Math.random()*30-15).toFixed(1)}deg)`},
      {transform:'none'}],{duration:620,easing:'cubic-bezier(.2,.8,.3,1)'});
    s.classList.add('ok');
  }
  await espera(200);
  zona.classList.add('chica');
  setTimeout(()=>zona.querySelectorAll('.mz').forEach(e=>e.remove()), 800);

  // dar vuelta
  msg(sacadas.length>1 ? 'Tocá cada carta para darla vuelta' : 'Tocá la carta para darla vuelta');
  if(sacadas.length>1) $('#btnTodas').classList.remove('oculto');
  let vueltas = 0;
  const darVuelta = (s,k)=>{
    if(s.classList.contains('vuelta')) return false;
    s.classList.add('vuelta'); vueltas++;
    const t=sacadas[k];
    s.querySelector('.nm').innerHTML = `${t.c.nombre}${t.inv?'<i>invertida</i>':''}`;
    sonido.revelar(k); chispas(s.querySelector('.carta'));
    if(vueltas===sacadas.length){
      $('#btnTodas').classList.add('oculto');
      msg('Las cartas ya hablaron ✦');
      setTimeout(()=>{ if(vivo()) $('#btnLeer').classList.remove('oculto'); }, 900);
    }
    return true;
  };
  slots.forEach((s,k)=>{
    const c=s.querySelector('.carta');
    const toca=()=>{ if(!darVuelta(s,k)) detalle(sacadas[k], TI.pos[k].n); };
    c.onclick=toca; c.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toca(); } };
  });
  $('#btnTodas').onclick = async ()=>{ $('#btnTodas').classList.add('oculto'); for(let k=0;k<slots.length;k++){ if(darVuelta(slots[k],k)) await espera(380); } };
  $('#btnLeer').onclick = ()=>{ $('#btnLeer').classList.add('oculto'); mostrarLectura(pf, sacadas, fecha); };
}

function chips(pf, T, per){
  $('#perfil').innerHTML = `<span class="chip">${pf.signo.s}︎ <b>${pf.signo.n}</b></span><span class="chip">Nº de vida <b>${pf.nv}</b></span><span class="chip">${T.e} <b>${T.t}</b></span>`
    + (per!=='libre' ? `<span class="chip">${PLAZO_E[per]} <b>${L.PERIODOS[per].d}</b></span>` : '');
}
function msg(h){ const m=$('#msg'); m.style.opacity=0; setTimeout(()=>{ m.innerHTML=h; m.style.transition='opacity .5s'; m.style.opacity=1; }, 180); }

function chispas(el){
  if(!MOV) return;
  const r=el.getBoundingClientRect();
  for(let i=0;i<16;i++){
    const s=document.createElement('div'); s.className='chispa';
    s.style.left=(r.left+r.width/2+scrollX)+'px'; s.style.top=(r.top+r.height/2+scrollY)+'px'; s.style.position='absolute';
    document.body.appendChild(s);
    const a=Math.random()*Math.PI*2, d=40+Math.random()*r.width*0.8;
    s.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(${Math.cos(a)*d-3}px,${Math.sin(a)*d-3}px) scale(.2)`,opacity:0}],
      {duration:900+Math.random()*500,easing:'cubic-bezier(.2,.7,.3,1)'}).finished.then(()=>s.remove());
  }
}

/* ---------- detalle de una carta ---------- */
function detalle(t, pos){
  const c=t.c;
  $('#modalIn').innerHTML = `<div class="grande${t.inv?' inv':''}">${frenteSVG(c)}</div>
    <div class="kw">${pos.toUpperCase()}</div>
    <h3>${c.nombre}</h3>${t.inv?'<div class="orient">invertida</div>':''}
    <div class="kw">${(t.inv?c.ki:c.kn).join(' · ')}</div>
    <p>${t.inv?c.i:c.n}</p>
    ${c.consejo?`<p><i>Consejo: ${c.consejo}</i></p>`:''}
    <p class="otra"><b>${t.inv?'Al derecho':'Invertida'}:</b> ${t.inv?c.n:c.i}</p>
    <button class="btn sec" id="cerrarModal">Cerrar</button>`;
  $('#modal').classList.add('on');
  $('#cerrarModal').onclick = cerrarModal;
}
function cerrarModal(){ $('#modal').classList.remove('on'); }
$('#modal').onclick = e=>{ if(e.target.id==='modal') cerrarModal(); };
addEventListener('keydown', e=>{ if(e.key==='Escape') cerrarModal(); });

/* ---------- la lectura escrita ---------- */
let ultima = null;
function cajaLectura(r, T, TI, titulo){
  const box = document.createElement('div'); box.className='box';
  box.innerHTML = `<h2>${titulo}</h2><div class="sub">${T.e} ${T.t} · ${TI.n}${r.cuando?` · ${L.cap(r.cuando)}`:''}</div><div class="sep">✦ ✦ ✦</div>`
    + r.parrafos.map(p=>`<p class="${p.cls}">${p.pos?`<span class="pos">${p.pos}</span>`:''}${p.h}</p>`).join('');
  $('#lectura').innerHTML=''; $('#lectura').appendChild(box);
  voz.boton(box);
  return box;
}
/* ---------- que te lea Jasy: voz del navegador (sin servidores) ---------- */
const voz = (function(){
  const ok = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let activa=false, corrida=0, btn=null, vozSel=null;
  function elegirVoz(){
    const vs = speechSynthesis.getVoices().filter(v=>/^es/i.test(v.lang));
    const pts = v => (/es[-_](AR|PY|UY)/i.test(v.lang)?40 : /es[-_](419|US|MX|CO|CL|PE)/i.test(v.lang)?25 : /es[-_]ES/i.test(v.lang)?10 : 5)
      + (/natural|online|neural|google/i.test(v.name)?20:0) + (/sabina|helena|laura|paulina|elena|dalia|elvira|m[oó]nica|lupe|camila|valentina|female/i.test(v.name)?8:0);
    return vs.sort((a,b)=>pts(b)-pts(a))[0] || null;
  }
  if(ok){ vozSel = elegirVoz(); speechSynthesis.addEventListener?.('voiceschanged', ()=>{ vozSel = elegirVoz(); }); }
  const limpiar = t => t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0E\uFE0F✦»«]/gu,' ').replace(/\s*·\s*/g,'. ').replace(/(\d) h\b/g,'$1 horas').replace(/\s+/g,' ').trim();
  const quitar = ()=> document.querySelectorAll('#lectura .habla').forEach(x=>x.classList.remove('habla'));
  function pintar(){ if(btn) btn.textContent = activa ? '⏹ Parar la voz' : '🔊 Que me lo lea Jasy'; }
  function parar(){ activa=false; corrida++; if(ok) speechSynthesis.cancel(); quitar(); pintar(); }
  function leer(box){
    parar(); activa=true; pintar();
    const yo = corrida, items=[];
    box.querySelectorAll('h2, p').forEach(p=>{
      (limpiar(p.innerText||p.textContent).match(/[^.!?…]+[.!?…]*/g)||[]).forEach(fr=>{ fr=fr.trim(); if(fr.length>1) items.push({p, fr}); });
    });
    let i=0, ant=null;
    const sig = ()=>{
      if(!activa || yo!==corrida) return;
      if(i>=items.length){ parar(); return; }
      const it = items[i++];
      if(it.p!==ant){ quitar(); it.p.classList.add('habla'); it.p.scrollIntoView({behavior:MOV?'smooth':'auto', block:'center'}); ant=it.p; }
      const u = new SpeechSynthesisUtterance(it.fr);
      u.lang = vozSel ? vozSel.lang : 'es-AR'; if(vozSel) u.voice = vozSel; u.rate = .95; u.pitch = 1.05;
      u.onend = ()=>{ if(yo===corrida) sig(); };
      u.onerror = e=>{ if(yo===corrida && !/interrupted|canceled/.test(e.error)) sig(); };
      speechSynthesis.speak(u);
    };
    sig();
  }
  function boton(box){
    parar(); btn=null;
    if(!ok) return;
    btn = document.createElement('button'); btn.type='button'; btn.className='btn sec escuchar';
    btn.onclick = ()=>{ sonido.toque(); activa ? parar() : leer(box); };
    box.querySelector('.sep').after(btn); pintar();
  }
  window.addEventListener('pagehide', parar);
  return {boton, parar};
})();

async function mostrarLectura(pf, sacadas, fecha){
  const T=L.TEMAS[D.tema], TI=L.TIRADAS[D.tirada];
  const preg = ($('#fPreg').value||'').trim().slice(0,160);
  let seed = 0; try{ seed = crypto.getRandomValues(new Uint32Array(1))[0]; }catch(e){ seed = Math.random()*4294967296>>>0; }
  const r = L.leer(pf, D.tema, D.tirada, sacadas, preg, D.mazo===22, {per:D.per, fecha, seed});
  // lo que viaja en el link: sin fecha de nacimiento ni la pregunta (son privadas)
  const datos = {v:1, n:pf.nombre, s:pf.si, nv:pf.nv, ap:pf.ap, t:D.tema, r:D.tirada, z:D.mazo, p:D.per,
    f:`${fecha.getFullYear()}${String(fecha.getMonth()+1).padStart(2,'0')}${String(fecha.getDate()).padStart(2,'0')}`,
    c:sacadas.map(t=>t.c.id+(t.inv?'i':'')).join('.'), k:seed};
  ultima = {pf, sacadas, r, T, TI, datos, img:null};
  const box = cajaLectura(r, T, TI, 'Tu lectura');
  sonido.revelar(5);
  box.scrollIntoView({behavior:MOV?'smooth':'auto', block:'start'});
  const ps=[...box.querySelectorAll('p')];
  for(const p of ps){ p.classList.add('ve'); await espera(MOV?520:0); }
  $('#finBtns').classList.remove('oculto');
}

/* ---------- compartir: imagen para estados de WhatsApp + link a la lectura ---------- */
function b64url(str){ return btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function desdeB64url(b){ b=b.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='='; return new TextDecoder().decode(Uint8Array.from(atob(b), ch=>ch.charCodeAt(0))); }
function linkDe(datos){
  const base = /^https:/.test(location.protocol) && !/localhost|127\.0\.0\.1/.test(location.hostname) ? location.origin+location.pathname : 'https://juegospy.com/tarot/';
  return base + '?l=' + b64url(JSON.stringify(datos));
}
function textoDe(u){
  const {pf, T, r} = u;
  return `🔮 ${pf.nombre?`La lectura de Tarot de ${pf.nombre}`:'Mi lectura de Tarot'} · ${T.e} ${T.t}${r.cuando?` · ${L.cap(r.cuando)}`:''}\n${r.arq?`${r.arq.e} ${r.arq.t}\n`:''}✨ ${r.resumen}\n\nMirá la lectura completa y tirá tus cartas:`;
}
function cargarImg(svg){
  return new Promise((ok,mal)=>{ const im=new Image(); im.onload=()=>ok(im); im.onerror=mal; im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); });
}
function partir(ctx, txt, ancho){
  const out=[]; let lin='';
  for(const w of txt.split(/\s+/)){ const p = lin ? lin+' '+w : w; if(ctx.measureText(p).width>ancho && lin){ out.push(lin); lin=w; } else lin=p; }
  if(lin) out.push(lin); return out;
}
async function hacerImagen(u){
  const W=1080, H=1920, cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const x=cv.getContext('2d'), {pf, sacadas, r, T, TI} = u;
  try{ await Promise.all(['700 40px Cinzel','italic 500 40px "Cormorant Garamond"','600 40px "Cormorant Garamond"'].map(f=>document.fonts.load(f))); }catch(e){}
  const CIN='Cinzel,Georgia,serif', COR='"Cormorant Garamond",Georgia,serif', G='#f2c14e', GL='#ffe9a8', SU='#c9bce8';
  // fondo: noche, brillo violeta y estrellas
  let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#090522'); g.addColorStop(.45,'#24135a'); g.addColorStop(1,'#080420');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  g=x.createRadialGradient(W/2,820,40,W/2,820,760); g.addColorStop(0,'rgba(150,100,255,.35)'); g.addColorStop(1,'rgba(150,100,255,0)');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  let sem=u.datos.k||7; const rr=()=>((sem=Math.imul(sem^sem>>>15,2246822507)+0x6D2B79F5|0)>>>0)/4294967296;
  for(let i=0;i<260;i++){ x.globalAlpha=.25+rr()*.75; x.fillStyle=rr()<.15?GL:'#fff'; x.beginPath(); x.arc(rr()*W, rr()*H, rr()*2.2+.5, 0, 6.283); x.fill(); }
  x.globalAlpha=1;
  try{ const nd = await cargarImg(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${G}" stroke-width=".3">${nanduti(50,50,48,5,36)}</g></svg>`);
    x.globalAlpha=.16; x.drawImage(nd, W/2-500, 300, 1000, 1000); x.globalAlpha=1; }catch(e){}
  // marco
  x.strokeStyle='rgba(242,193,78,.55)'; x.lineWidth=3; x.strokeRect(34,34,W-68,H-68);
  x.strokeStyle='rgba(242,193,78,.25)'; x.lineWidth=1.5; x.strokeRect(48,48,W-96,H-96);
  x.textAlign='center'; x.textBaseline='alphabetic';
  // título
  x.shadowColor='rgba(242,193,78,.6)'; x.shadowBlur=24;
  x.fillStyle=GL; x.font=`700 70px ${CIN}`; x.fillText('TAROT JASY', W/2, 150);
  x.shadowBlur=0;
  x.fillStyle=G; x.font=`700 28px ${CIN}`; x.fillText('✦  ✦  ✦', W/2, 196);
  x.fillStyle='#fff'; x.font=`italic 500 54px ${COR}`;
  x.fillText(pf.nombre ? `La lectura de ${pf.nombre}` : 'Mi lectura de las cartas', W/2, 268);
  x.fillStyle=GL; x.font=`600 40px ${COR}`;
  let y=326;
  for(const l of partir(x, `${T.e} ${T.t}${r.cuando?` · ${L.cap(r.cuando)}`:''}`, W-160)){ x.fillText(l, W/2, y); y+=46; }
  x.fillStyle=SU; x.font=`500 34px ${COR}`; x.fillText(`${pf.signo.s}︎ ${pf.signo.n} · Nº de vida ${pf.nv}`, W/2, y+2); y+=40;
  // cartas
  const N=sacadas.length, cw = N===1?350:N===3?290:174, gap = N===5?16:32, ch=cw*1.7;
  const tot = N*cw+(N-1)*gap, x0=(W-tot)/2, top=y+64;
  const ims = await Promise.all(sacadas.map(t=>cargarImg(frenteSVG(t.c)).catch(()=>null)));
  sacadas.forEach((t,k)=>{
    const cx = x0+k*(cw+gap);
    x.fillStyle=G; x.font=`700 ${N===5?19:24}px ${CIN}`;
    const lab = partir(x, r.pos[k].n.toUpperCase(), cw+gap-6);
    lab.forEach((l,i)=>x.fillText(l, cx+cw/2, top-14-(lab.length-1-i)*(N===5?22:28)));
    x.save(); x.shadowColor='rgba(242,193,78,.55)'; x.shadowBlur=30;
    x.fillStyle='#0b0820'; x.fillRect(cx+4, top+4, cw-8, ch-8); x.restore();
    if(ims[k]){
      x.save();
      if(t.inv){ x.translate(cx+cw/2, top+ch/2); x.rotate(Math.PI); x.drawImage(ims[k], -cw/2, -ch/2, cw, ch); }
      else x.drawImage(ims[k], cx, top, cw, ch);
      x.restore();
    }
    x.fillStyle='#fff'; x.font=`600 ${N===5?25:31}px ${COR}`;
    const nm = partir(x, t.c.nombre, cw+gap-6); let ny=top+ch+(N===5?32:40);
    nm.forEach(l=>{ x.fillText(l, cx+cw/2, ny); ny+=N===5?27:33; });
    if(t.inv){ x.fillStyle='#ff9d8a'; x.font=`italic 500 ${N===5?22:27}px ${COR}`; x.fillText('invertida', cx+cw/2, ny); }
  });
  // el mensaje de Jasy y la suerte, centrados entre las cartas y el pie
  const ini = top+ch+(N===5?110:120), fin = H-280;
  const tit = r.arq ? `${r.arq.e} ${r.arq.t}` : '', txt = r.arq ? r.arq.txt : r.cierre;
  x.font=`italic 500 42px ${COR}`;
  const lin = partir(x, txt, W-220).slice(0, 7);
  const alto = lin.length*52+40, total = (tit?56:0) + alto + 70;
  y = ini + Math.max(0, (fin-ini-total)/2) + (tit?56:0) + 46;
  if(tit){ x.fillStyle=G; x.font=`700 32px ${CIN}`; x.fillText(tit, W/2, y-84); }
  x.fillStyle='rgba(242,193,78,.09)'; x.strokeStyle='rgba(242,193,78,.45)'; x.lineWidth=2;
  if(x.roundRect){ x.beginPath(); x.roundRect(80, y-56, W-160, alto, 28); x.fill(); x.stroke(); } else { x.fillRect(80, y-56, W-160, alto); x.strokeRect(80, y-56, W-160, alto); }
  x.fillStyle=GL; x.font=`italic 500 42px ${COR}`; lin.forEach((l,i)=>x.fillText(l, W/2, y+i*52)); y += alto - 10;
  x.fillStyle=SU; x.font=`500 34px ${COR}`;
  x.fillText(`Número de la suerte ${r.numSuerte} · Color ${r.color}`, W/2, y+24);
  // pie
  x.fillStyle='#fff'; x.font=`italic 500 42px ${COR}`; x.fillText('¿Y a vos qué te dicen las cartas?', W/2, H-200);
  x.shadowColor='rgba(242,193,78,.6)'; x.shadowBlur=18; x.fillStyle=G; x.font=`700 56px ${CIN}`; x.fillText('juegospy.com/tarot', W/2, H-122); x.shadowBlur=0;
  x.fillStyle='rgba(200,190,230,.45)'; x.font=`500 24px ${COR}`; x.fillText('Solo un juego de entretenimiento', W/2, H-74);
  return new Promise(ok=>cv.toBlob(ok, 'image/png'));
}

$('#btnCompartir').onclick = async ()=>{
  if(!ultima) return;
  sonido.toque();
  const u = ultima, link = linkDe(u.datos), texto = textoDe(u);
  $('#modalIn').innerHTML = `<h3>Compartí tu lectura</h3><p class="otra">Preparando la imagen…</p>`;
  $('#modal').classList.add('on');
  if(!u.img){ try{ u.img = await hacerImagen(u); }catch(e){ u.img=null; } }
  if(ultima!==u || !$('#modal').classList.contains('on')) return;
  const archivo = u.img ? new File([u.img], 'tarot-jasy.png', {type:'image/png'}) : null;
  const puedeArchivo = !!(archivo && navigator.canShare && navigator.canShare({files:[archivo]}));
  const urlImg = u.img ? URL.createObjectURL(u.img) : '';
  $('#modalIn').innerHTML = `<h3>Compartí tu lectura</h3>
    ${u.img?`<img class="prev" src="${urlImg}" alt="Imagen de tu lectura">`:''}
    <p class="otra">Subila a tu estado de WhatsApp o mandala a un grupo. Con el link, quien lo abra ve tu lectura completa ✦</p>
    <div class="acciones">
      ${puedeArchivo?`<button class="btn" id="shImg">📲 Compartir imagen</button>`:''}
      ${u.img?`<button class="btn${puedeArchivo?' sec':''}" id="shBaja">⬇️ Guardar imagen</button>`:''}
      <button class="btn sec" id="shLink">🔗 ${navigator.share?'Compartir link':'Copiar link'}</button>
    </div>
    <button class="btn sec" id="cerrarModal" style="margin-top:12px">Cerrar</button>`;
  $('#cerrarModal').onclick = cerrarModal;
  if(puedeArchivo) $('#shImg').onclick = async ()=>{
    try{ await navigator.share({files:[archivo], title:'Tarot Jasy', text:texto+'\n'+link}); }
    catch(e){ if(!e || e.name!=='AbortError') toast('No se pudo compartir 😕 Probá guardando la imagen'); }
  };
  if(u.img) $('#shBaja').onclick = ()=>{
    const a=document.createElement('a'); a.href=urlImg; a.download='tarot-jasy.png'; document.body.appendChild(a); a.click(); a.remove();
    toast('Imagen guardada ✦ Ya la podés subir a tu estado');
  };
  $('#shLink').onclick = async ()=>{
    try{ if(navigator.share){ await navigator.share({title:'Mi lectura de Tarot Jasy', text:texto, url:link}); return; } }
    catch(e){ if(e && e.name==='AbortError') return; }
    try{ await navigator.clipboard.writeText(texto+'\n'+link); toast('Link copiado ✦ Pegalo donde quieras'); }
    catch(e){ toast('No se pudo copiar 😕'); }
  };
};

/* ---------- ver la lectura que alguien compartió ---------- */
function verModo(on){
  document.getElementById('app').classList.toggle('ver', on);
  $('#verCab').classList.toggle('oculto', !on); $('#verBtns').classList.toggle('oculto', !on);
}
function abrirCompartida(){
  let o; try{ const q = new URLSearchParams(location.search).get('l'); if(!q) return false; o = JSON.parse(desdeB64url(q)); }catch(e){ return false; }
  if(!o || !L.TEMAS[o.t] || !L.TIRADAS[o.r] || !L.PERIODOS[o.p]) return false;
  const sacadas = String(o.c||'').split('.').map(s=>{ const c = MAZO.find(m=>m.id===s.replace(/i$/,'')); return c && {c, inv:/i$/.test(s)}; });
  if(sacadas.length!==+o.r || sacadas.some(t=>!t)) return false;
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(o.f||''); const fecha = m ? new Date(+m[1], +m[2]-1, +m[3]) : new Date();
  const pf = L.perfilDe({n:o.n, s:o.s, nv:o.nv, ap:o.ap, anio:fecha.getFullYear()}), T = L.TEMAS[o.t];
  const TI = {...L.TIRADAS[o.r]};
  const r = L.leer(pf, o.t, +o.r, sacadas, '', o.z===22, {per:o.p, fecha, seed:o.k>>>0});
  TI.pos = r.pos;
  verModo(true);
  $('#verCab').innerHTML = `<h2>${pf.nombre?`🔮 La lectura de ${L.esc(pf.nombre)}`:'🔮 Una lectura de Tarot Jasy'}</h2><p>${T.e} ${T.t}${r.cuando?` · ${L.cap(r.cuando)}`:''}</p>`;
  chips(pf, T, o.p);
  $('#msg').innerHTML = pf.nombre ? `Las cartas de ${L.esc(pf.nombre)} ✦` : 'Las cartas ya hablaron ✦';
  $('#zonaMazo').classList.add('chica');
  const tir = $('#tirada'); tir.innerHTML=''; tir.className='t'+o.r+' ya';
  sacadas.forEach((t,k)=>{
    const s=document.createElement('div'); s.className='slot ok vuelta'+(t.inv?' inv':'');
    s.innerHTML = `<div class="pl">${r.pos[k].n}</div><div class="carta" role="button" tabindex="0" aria-label="${t.c.nombre}"><div class="giro"><div class="cara dorso">${dorso()}</div><div class="cara frente"><div class="rot">${frenteSVG(t.c)}</div></div></div></div><div class="nm">${t.c.nombre}${t.inv?'<i>invertida</i>':''}</div>`;
    const c=s.querySelector('.carta'); c.onclick=()=>detalle(t, r.pos[k].n); c.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); detalle(t, r.pos[k].n); } };
    tir.appendChild(s);
  });
  const box = cajaLectura(r, T, TI, pf.nombre ? `La lectura de ${L.esc(pf.nombre)}` : 'La lectura');
  box.querySelectorAll('p').forEach(p=>p.classList.add('ve'));
  $('#finBtns').classList.add('oculto');
  ir('pMesa');
  document.title = (pf.nombre ? `La lectura de ${pf.nombre}` : 'Una lectura') + ' · Tarot Jasy';
  return true;
}
$('#btnMia').onclick = ()=>{
  sonido.toque(); verModo(false);
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
  document.title = 'Tarot Jasy: lectura de cartas del Tarot online gratis | Juegos PY';
  $('#tirada').innerHTML=''; $('#lectura').innerHTML=''; $('#zonaMazo').classList.remove('chica');
  ir('pInicio');
};

$('#btnOtra').onclick = ()=>{ sonido.toque(); window.scrollTo({top:0, behavior:MOV?'smooth':'auto'}); ritual(); };
$('#btnNueva').onclick = ()=>{ corrida++; sonido.toque(); ir('pInicio'); };

/* ---------- cielo estrellado ---------- */
(function cielo(){
  const cv=$('#cielo'), ctx=cv.getContext('2d'); let W,H,est=[],fugaz=null,dpr=1;
  function tam(){ dpr=Math.min(2,devicePixelRatio||1); W=cv.width=innerWidth*dpr; H=cv.height=innerHeight*dpr;
    const n=Math.round(Math.min(220, innerWidth*innerHeight/5000));
    est=[...Array(n)].map(()=>({x:Math.random()*W,y:Math.random()*H,r:(Math.random()*1.2+.3)*dpr,f:Math.random()*6.28,v:.5+Math.random()*1.6,g:Math.random()<.12})); }
  tam(); addEventListener('resize', tam);
  function cuadro(t){
    if(document.hidden){ requestAnimationFrame(cuadro); return; }
    ctx.clearRect(0,0,W,H);
    for(const s of est){
      const a = MOV ? .35+.65*Math.abs(Math.sin(s.f+t/1000*s.v*.6)) : .7;
      ctx.globalAlpha=a; ctx.fillStyle=s.g?'#ffe9a8':'#ffffff';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.283); ctx.fill();
    }
    if(MOV){
      if(!fugaz && Math.random()<0.0025) fugaz={x:Math.random()*W*.8,y:Math.random()*H*.4,vx:(6+Math.random()*4)*dpr,vy:(2+Math.random()*2)*dpr,v:1};
      if(fugaz){
        const g=ctx.createLinearGradient(fugaz.x,fugaz.y,fugaz.x-fugaz.vx*12,fugaz.y-fugaz.vy*12);
        g.addColorStop(0,'rgba(255,240,200,'+fugaz.v+')'); g.addColorStop(1,'rgba(255,240,200,0)');
        ctx.globalAlpha=1; ctx.strokeStyle=g; ctx.lineWidth=1.6*dpr; ctx.beginPath(); ctx.moveTo(fugaz.x,fugaz.y); ctx.lineTo(fugaz.x-fugaz.vx*12,fugaz.y-fugaz.vy*12); ctx.stroke();
        fugaz.x+=fugaz.vx; fugaz.y+=fugaz.vy; fugaz.v-=.012; if(fugaz.v<=0) fugaz=null;
      }
    }
    ctx.globalAlpha=1;
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
})();

/* ---------- sonido: música ambiente suave + efectos (todo sintetizado) ---------- */
const sonido = (function(){
  let ctx=null, master=null, musica=null, on=true, timer=null;
  try{ on = localStorage.getItem('tar_musica')!=='0'; }catch(e){}
  const btn = $('#btnSnd');
  function pintar(){ btn.textContent = on?'🎵':'🔇'; btn.title = on?'Silenciar la música':'Activar la música'; }
  pintar();
  function crear(){
    if(ctx) return true;
    try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return false; }
    master = ctx.createGain(); master.gain.value = on?1:0;
    // eco suave
    const del = ctx.createDelay(1.5); del.delayTime.value=.42; const fb=ctx.createGain(); fb.gain.value=.38; const wet=ctx.createGain(); wet.gain.value=.35;
    del.connect(fb); fb.connect(del); del.connect(wet); wet.connect(ctx.destination);
    master.connect(ctx.destination); master.connect(del);
    return true;
  }
  // colchón de acordes que cambia despacio
  const ACORDES = [[110,164.81,220,261.63],[87.31,130.81,174.61,261.63],[98,146.83,196,246.94],[82.41,123.47,164.81,246.94]];
  function arrancarMusica(){
    if(musica || !ctx) return;
    const out = ctx.createGain(); out.gain.value=0; out.connect(master);
    out.gain.setTargetAtTime(.055, ctx.currentTime, 3);
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=700; lp.Q.value=.6; lp.connect(out);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value=.06; lg.gain.value=320; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const osc = ACORDES[0].map((fq,i)=>{ const o=ctx.createOscillator(); o.type=i%2?'triangle':'sine'; o.frequency.value=fq; o.detune.value=(i-1.5)*6;
      const g=ctx.createGain(); g.gain.value=i===0?.5:.32; o.connect(g); g.connect(lp); o.start(); return o; });
    let ac=0;
    const cambiar = ()=>{ ac=(ac+1)%ACORDES.length; osc.forEach((o,i)=>o.frequency.setTargetAtTime(ACORDES[ac][i], ctx.currentTime, 1.8)); };
    const cada = setInterval(cambiar, 11000);
    // campanitas sueltas (pentatónica menor de La)
    const NOTAS=[440,523.25,587.33,659.25,783.99,880,1046.5];
    const campana = ()=>{ if(musica){ campanita(NOTAS[Math.floor(Math.random()*NOTAS.length)], .022, 3.5); timer=setTimeout(campana, 2500+Math.random()*5000); } };
    musica = {out, osc, lfo, cada};
    timer = setTimeout(campana, 2000);
  }
  function campanita(fq, vol, dur, cuando=0){
    if(!ctx) return;
    const t=ctx.currentTime+cuando, o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine'; o.frequency.value=fq; o2.type='sine'; o2.frequency.value=fq*2.76;
    const g2=ctx.createGain(); g2.gain.value=.25; o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t+dur+.05); o2.stop(t+dur+.05);
  }
  function ruido(dur, fq, vol, cuando=0, q=1.2, barrido){
    if(!ctx) return;
    const t=ctx.currentTime+cuando, n=Math.floor(ctx.sampleRate*dur), buf=ctx.createBuffer(1,n,ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const s=ctx.createBufferSource(); s.buffer=buf; const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=fq; f.Q.value=q;
    if(barrido) f.frequency.exponentialRampToValueAtTime(barrido, t+dur);
    const g=ctx.createGain(); g.gain.value=vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  return {
    activar(){ if(!crear()) return; if(ctx.state==='suspended') ctx.resume(); if(on) arrancarMusica(); },
    alternar(){
      on=!on; try{ localStorage.setItem('tar_musica', on?'1':'0'); }catch(e){}
      if(crear()){ if(ctx.state==='suspended') ctx.resume(); master.gain.setTargetAtTime(on?1:0, ctx.currentTime, .15); if(on) arrancarMusica(); }
      pintar();
    },
    toque(){ if(ctx&&on) campanita(880,.03,.8); },
    barajar(s){ if(!ctx||!on) return; const n=Math.round(10*s)+3; for(let i=0;i<n;i++) ruido(.035, 2600+Math.random()*1800, .16, i*.045+Math.random()*.02, 1.5); },
    repartir(){ if(ctx&&on) ruido(.28, 900, .22, 0, .8, 3500); },
    revelar(k){ if(!ctx||!on) return; const base=[523.25,659.25,783.99,880,1046.5,659.25][k%6]; campanita(base,.05,2.2); campanita(base*1.5,.03,2.4,.09); campanita(base*2,.018,2.6,.18); }
  };
})();
$('#btnSnd').onclick = ()=>sonido.alternar();
// el primer toque en la página habilita el audio (los navegadores lo exigen)
addEventListener('pointerdown', function primero(){ sonido.activar(); removeEventListener('pointerdown', primero); }, {once:true});

abrirCompartida();

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
