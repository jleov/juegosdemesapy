// Cloudflare Pages Function: contraseña para el grabador de cantos (/grabar-g8p3mekgrf/)
// El navegador pide usuario y contraseña; el usuario puede ser cualquiera, la contraseña tiene que ser
// la de la variable secreta GRABADOR_CLAVE del proyecto Pages "juegosdemesapy" (la carga el dueño en Cloudflare).
// Sin esa variable, el grabador queda cerrado para todos.
const enc = new TextEncoder();
const hash = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function claveOk(dada, real) {
  // se comparan los resúmenes y sin cortar antes, para no dar pistas por el tiempo que tarda
  const a = await hash(dada), b = await hash(real);
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

export async function onRequest({ request, env, next }) {
  const real = env.GRABADOR_CLAVE;
  const privado = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  if (!real) return new Response('El grabador está cerrado: falta configurar la contraseña (GRABADOR_CLAVE) en Cloudflare.', { status: 503, headers: { ...privado, 'Content-Type': 'text/plain; charset=utf-8' } });

  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Basic ')) {
    let pass = '';
    try {
      const txt = new TextDecoder().decode(Uint8Array.from(atob(auth.slice(6)), c => c.charCodeAt(0)));
      pass = txt.slice(txt.indexOf(':') + 1);
    } catch (e) {}
    if (pass && await claveOk(pass, real)) {
      const r = await next();
      const res = new Response(r.body, r);
      for (const k in privado) res.headers.set(k, privado[k]);
      return res;
    }
  }
  return new Response('Hace falta la contraseña del grabador.', {
    status: 401,
    headers: { ...privado, 'Content-Type': 'text/plain; charset=utf-8', 'WWW-Authenticate': 'Basic realm="Grabador de cantos", charset="UTF-8"' },
  });
}
