/* =====================================================================
   Tiro Guasu — Campaña cooperativa "Operación Yvy" (hasta 4 jugadores).
   Acá están los 10 niveles (historia, mapas y objetivos) y lo que hace
   la sala del anfitrión en la campaña: mercenarios, torretas, el camión
   blindado, la puerta de la Basílica, el jefe Teju Jagua y el escape.
   Lo cargan todos (los mapas y los textos se usan en cada aparato).
   ===================================================================== */
(function (G) {
  'use strict';
  const W = G.TiroMundo, A = W.ARMAS;
  const r2 = v => Math.round(v * 100) / 100;

  // ---------- números al azar que salen siempre iguales (para que todos vean el mismo mapa) ----------
  const azar = semilla => { let s = semilla >>> 0; return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };

  // ================= MAPAS DE LA CAMPAÑA =================
  // cielo: [fondo, color del piso, textura del piso, color de afuera]
  // suelos: partes del piso pintadas [x0, z0, x1, z1, color, textura]
  const mapa = (id, n, S, pared, conf, extra) => {
    W.MAPAS[id] = () => Object.assign(W.armar(id, n, S, extra, pared), conf, { camp: true });
  };
  const ASFALTO = '#3e4045', VEREDA = '#9a968c', ARENA = '#dcc48e', AGUA = '#2f6f96', TIERRA_ROJA = '#9a4a2a';

  // ---------- 1. Mercado 4 ----------
  mapa('c_mercado4', 'Mercado 4 (Asunción)', 34, 1, {
    cielo: ['#a9cbe0', '#8d8a84', 'baldosa', '#6f6a60'],
    suelos: [[-34, -34, 34, -20, ASFALTO, 'asfalto']],
  }, (b, esc, o) => {
    const rnd = azar(1);
    const X = [-24, -15, -6, 3, 12, 21, 30], Z = [22, 13, 4, -5, -14];
    const techos = [3, 5, 4, 6, 10];
    const carteles = ['CHIPA CALIENTE', 'REMEDIOS YUYOS', 'ROPA BARATA', 'ELECTRÓNICA', 'TERERÉ JEVY', 'CELULARES', 'MANDIOCA', 'BORDADOS ÑANDUTÍ'];
    let k = 0;
    X.forEach((x, i) => Z.forEach((z, j) => {
      if (j === 2 && (i === 2 || i === 3)) return;        // la plaza del medio
      if ((i * 7 + j * 3) % 11 === 5) return;             // algunos huecos más
      k++;
      // cuatro puestos con techo de chapa
      [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].forEach(([a, c], n) => o('puesto_feria', x + a, z + c, { h: 2.3, w: 2.6, d: 2.6, q: n }));
      b(x, z, 6.6, 6.6, 0.12, techos[k % 5], 2.9);
      // lo que venden
      if (k % 3 === 0) o('ropa', x - 1.5, z + 3.6, { w: 1.6, h: 0.9, d: 0.8 });
      else if (k % 3 === 1) { o('televisor', x + 3.6, z - 1, { w: 0.7, h: 0.5, d: 0.5 }); o('televisor', x + 3.6, z - 1, { w: 0.7, h: 0.5, d: 0.5, y: 0.5 }); }
      else o('cajon', x + 3.6, z + 1.2, { w: 1 });
      if (k % 2) o('publi', x, z + 3.35, { w: 5, h: 0.7, d: 0.12, y: 2.2, txt: carteles[k % carteles.length] });
    }));
    // trastos en los pasillos (para cubrirse, sin tapar el paso)
    for (let i = 0; i < 26; i++) {
      const x = X[(rnd() * 6) | 0] + 4.5, z = Z[(rnd() * 5) | 0] + (rnd() - 0.5) * 5;
      o(rnd() < 0.5 ? 'barril' : 'cajon', x, z, rnd() < 0.5 ? { h: 1.1 } : { w: 1 });
    }
    // la plaza del medio
    o('feria', -1.5, 4, { w: 4, h: 1.3, d: 3.8 }); o('estante', -7, 1.5, { w: 3, h: 2.6, d: 0.7 });
    // muro con salidas a la avenida
    [[-34, -21], [-18, 6], [9, 24], [27, 34]].forEach(([x0, x1]) => b((x0 + x1) / 2, -19.5, x1 - x0, 0.8, 3.2, 1));
    o('publi', -6, -19.0, { w: 8, h: 1, d: 0.15, y: 2.2, txt: 'MERCADO 4' });
    // Avenida Pettirossi
    o('publi', 16, -33.4, { w: 10, h: 1.4, d: 0.2, y: 2.5, txt: 'AVDA. PETTIROSSI' });
    o('colectivo', -14, -27, { w: 2.9, h: 3.1, d: 9.5, q: 1 });
    o('auto_azul', 0, -25, { h: 1.5, q: 1 }); o('patrullera', 6, -30, { h: 1.5, q: 1 }); o('auto_rojo', -24, -30, { h: 1.4, q: 3 });
    o('auto', 30, -25, { h: 1.6, q: 1 }); o('barrera', 16, -24, { w: 2.2, h: 1.1, d: 0.7 }); o('barrera', 20, -31, { w: 2.2, h: 1.1, d: 0.7 });
    o('basurero', -30, -22, { h: 1.1 }); o('basurero', 10, -22, { h: 1.1 });
  });

  // ---------- 2. La Costanera ----------
  mapa('c_costanera', 'La Costanera (Asunción)', 36, -1, {
    cielo: ['#f2b98a', ARENA, 'tierra', AGUA],
    suelos: [[-36, -8, 36, 8, ASFALTO, 'asfalto'], [-36, -11, 36, -8, VEREDA, 'baldosa'], [-36, 8, 36, 10, VEREDA, 'baldosa'], [-36, 27, 36, 36, AGUA, 'agua']],
  }, (b, esc, o, oculta) => {
    oculta(0, 27.6, 72, 0.6, 4);                                   // el agua de la bahía
    // edificios del lado de la ciudad
    [-28, -14, 0, 14, 28].forEach((x, i) => o(i % 2 ? 'edificio_alto' : 'edificio', x, -24, { w: 11, h: i % 2 ? 18 : 10, d: 9 }));
    b(0, -13.5, 72, 0.6, 1, 0);                                    // cordón con baranda
    [-34, -20, -6, 8, 22].forEach(x => b(x + 6, -13.5, 2, 0.7, 0.1, 0));
    // palmeras en el cantero del medio
    for (let x = -32; x <= 32; x += 8) o('palmera', x, 0, { h: 6 });
    b(0, 0, 72, 1.2, 0.25, 13);
    // autos abandonados en la avenida (para cubrirse)
    const autos = [['auto_rojo', -24, -4, 1], ['auto_azul', -16, 4, 3], ['patrullera', -6, -5, 1], ['auto', 3, 4.5, 1], ['auto_rojo', 12, -3, 3], ['colectivo', 20, 4, 1], ['auto_azul', 26, -5, 1], ['auto', 32, 3, 3], ['patrullera', -30, 5, 1], ['auto_rojo', 8, -6, 1]];
    autos.forEach(([t, x, z, q]) => o(t, x, z, t === 'colectivo' ? { w: 2.9, h: 3.1, d: 9.5, q } : { h: 1.5, q }));
    // la playa: sombrillas, el cartel y el helicóptero derribado
    [[-28, 16], [-22, 22], [-4, 20], [16, 22], [24, 15], [30, 21]].forEach(([x, z]) => o('sombrilla', x, z, { h: 2.6 }));
    o('publi', -14, 14, { w: 13, h: 2.6, d: 0.8, txt: 'YO ♥ ASUNCIÓN', est: 'letras' });
    o('helicoptero', 6, 18, { w: 10, h: 3.2, d: 11, humo: true });
    [[-30, 12], [-8, 24], [12, 12], [30, 12]].forEach(([x, z]) => o('palmera', x, z, { h: 5.5 }));
    [[18, 9.2], [-10, 9.2], [2, 9.2]].forEach(([x, z]) => o('bolsas', x, z, { w: 3.6, h: 1.1, d: 0.9 }));
  });

  // ---------- 3. Areguá ----------
  mapa('c_aregua', 'Estación de Areguá', 34, 12, {
    cielo: ['#2a3038', '#7a6a55', 'tierra', AGUA],
    suelos: [[-34, -34, -23, 34, AGUA, 'agua'], [-23, -13.5, 34, -10.5, '#5a4a3a', 'madera'], [-23, 3, 34, 11, '#8a7f70', 'tierra']],
  }, (b, esc, o, oculta) => {
    oculta(-23.4, 0, 0.6, 68, 4);                                  // el lago Ypacaraí
    // vías del tren y cerco del lado del norte, con el paso tapado por el vagón
    for (let x = -22; x <= 34; x += 1.5) b(x, -12, 0.25, 3, 0.08, 2);
    b(-4, -12.6, 56, 0.12, 0.12, 0); b(-4, -11.4, 56, 0.12, 0.12, 0);
    [[-23, 19], [31, 34]].forEach(([x0, x1]) => b((x0 + x1) / 2, -15, x1 - x0, 0.5, 2.4, 2));
    o('vagon', 25, -12, { w: 10.4, h: 2.7, d: 2.4, puerta: 'vagon', abre: [11, 0, 0] });
    o('locomotora', 10, -12, { w: 10.4, h: 2.7, d: 2.4 });
    // la estación vieja
    const t = 0.4, h = 3.4;
    b(-8, -6, t, 6, h, 12); b(8, -6, t, 6, h, 12); b(-4.5, -9, 7.4, t, h, 12); b(4.5, -9, 7.4, t, h, 12);
    b(-5, -3, 6, t, h, 12); b(5, -3, 6, t, h, 12); b(0, -6, 16.6, 6.4, 0.25, 1, h);
    b(0, -1.2, 26, 3.2, 0.45, 14); o('publi', 0, -2.75, { w: 6, h: 0.8, d: 0.12, y: 2.4, txt: 'AREGUÁ' });
    o('generador', -12, -6, { w: 2.4, h: 1.5, d: 1.2 });
    o('banco', -3, 0, { w: 2, h: 0.5, d: 0.7 }); o('banco', 4, 0, { w: 2, h: 0.5, d: 0.7 });
    o('farol', -10, -0.5, { h: 3 }); o('farol', 12, -0.5, { h: 3 });
    // calle de los puestos de cerámica y frutillas
    [-16, -8, 0, 8, 16, 24].forEach((x, i) => {
      o(i % 2 ? 'ceramica' : 'puesto_feria', x, 9, i % 2 ? { w: 2.6, h: 1.6, d: 2.2 } : { h: 2.3, w: 2.6, d: 2.6 });
      if (i % 3 === 0) o('feria', x + 3.5, 13, { w: 2.6, h: 1, d: 2.4 });
    });
    // casas y árboles del pueblo
    [[-14, 24], [0, 26], [14, 22], [26, 28], [28, 6]].forEach(([x, z], i) => o('galeria', x, z, { w: 7, h: 5, d: 6, q: i % 2 ? 2 : 0 }));
    [[-18, 16], [6, 16], [20, 14], [-6, 30], [30, -4], [-18, -4]].forEach(([x, z]) => o('lapacho', x, z, { h: 6 }));
    [[-10, 2], [18, 3], [-20, 6]].forEach(([x, z]) => o('barril', x, z, { h: 1.1 }));
  });

  // ---------- 4. Basílica de Caacupé ----------
  mapa('c_caacupe', 'Basílica de Caacupé', 38, 14, {
    cielo: ['#1b2233', '#c9c2b2', 'baldosa', '#46503a'],
    luces: [[-9, 7, -6, '#ffd9a0', 2.2, 34], [9, 7, -6, '#ffd9a0', 2.2, 34]],
    suelos: [[-16, -2, 16, 36, '#d8d0bf', 'baldosa']],
  }, (b, esc, o) => {
    // escalinata y explanada de arriba
    // la explanada de arriba: un escalón largo (los zombis también suben)
    b(0, -7.5, 34, 9, 0.4, 14);
    o('basilica', 0, -24.6, { w: 23, h: 27, d: 25, y: 0.4 });
    o('velas', -3, -10.6, { w: 1, h: 0.6, d: 1, y: 0.4 }); o('velas', 3, -10.6, { w: 1, h: 0.6, d: 1, y: 0.4 });
    // torres/balcones a los costados para los francotiradores
    [-1, 1].forEach(sg => {
      const x = sg * 13;
      b(x, -6, 5, 5, 4.5, 12); b(x, -6, 5.6, 5.6, 0.3, 1, 4.5);
      esc(x, -3.1, 0, 1, 4.5, 2.2, 14);
      o('campana', x, -7, { h: 1, y: 4.8 });
    });
    // la explanada: faroles, bancos, puestitos de los peregrinos
    [[-12, 6], [12, 6], [-12, 20], [12, 20], [0, 32]].forEach(([x, z]) => o('farol', x, z, { h: 3.4 }));
    [[-6, 10], [6, 10], [-6, 24], [6, 24]].forEach(([x, z]) => o('banco', x, z, { w: 2, h: 0.5, d: 0.7 }));
    [[-24, 8], [-24, 16], [24, 8], [24, 16], [-24, 26], [24, 26]].forEach(([x, z], i) => o('puesto_feria', x, z, { h: 2.4, w: 2.6, d: 2.6, q: i % 2 ? 1 : 3 }));
    [[-30, -4], [30, -4], [-30, 32], [30, 32], [-20, 34]].forEach(([x, z]) => o('palmera', x, z, { h: 6 }));
    // el costado y la parte de atrás (por donde se evacúa)
    b(-16.5, -24, 1, 26, 2.2, 12); o('auto', 22, -20, { h: 1.6, q: 0 }); o('colectivo', 28, -30, { w: 2.9, h: 3.1, d: 9.5, q: 1 });
  });

  // ---------- 5. Ciudad del Este y el Puente de la Amistad ----------
  mapa('c_cde', 'Puente de la Amistad (Ciudad del Este)', 38, -1, {
    cielo: ['#b7c9dc', '#8a8a86', 'asfalto', AGUA],
    suelos: [[14, -38, 38, -6, AGUA, 'agua'], [14, 6, 38, 38, AGUA, 'agua'], [14, -6, 38, 6, '#6c6a66', 'asfalto']],
  }, (b, esc, o, oculta) => {
    // el microcentro: manzanas de edificios con carteles luminosos
    const M = [[-26, -24], [-26, -8], [-26, 8], [-26, 24], [-10, -24], [-10, 8], [-10, 24]];
    const tipos = ['edificio', 'galeria', 'edificio_alto', 'edificio'];
    M.forEach(([x, z], i) => {
      const t = tipos[i % 4];
      o(t, x, z, { w: 10, h: t === 'edificio_alto' ? 22 : t === 'galeria' ? 7 : 12, d: 10, q: i % 2 ? 2 : 0 });
      o('neones', x + 5.4, z, { w: 4, h: 2.6, d: 1.2, y: 3.2, q: 1 });
    });
    o('galeria', -10, -8, { w: 8, h: 6, d: 6 });                  // galería del medio, más chica
    // el puente: barandas, agua a los costados y vehículos cruzados
    b(26, -6.2, 24, 0.5, 1.1, 0); b(26, 6.2, 24, 0.5, 1.1, 0);
    oculta(26, -6.8, 24, 0.6, 5); oculta(26, 6.8, 24, 0.6, 5);
    o('publi', 14.5, -7, { w: 7, h: 1.4, d: 0.2, y: 3.6, txt: 'PUENTE DE LA AMISTAD', q: 1 });
    o('semirremolque', 20, -2.4, { w: 2.2, h: 3, d: 8, q: 1 }); o('cisterna', 27, 2.8, { w: 9, h: 3.4, d: 3 });
    o('camion_militar', 33, -2, { w: 2.6, h: 2.8, d: 5.8, q: 1 }); o('auto_rojo', 24, -4.4, { h: 1.4, q: 1 }); o('camion', 31, 4, { h: 2.6, q: 1 });
    // la avenida con tránsito abandonado
    [['auto_azul', 2, -10, 0], ['patrullera', 6, 12, 0], ['auto', -2, 26, 0], ['auto_rojo', 4, -26, 2], ['camion', 8, 22, 2], ['colectivo', -18, 0, 0]].forEach(([t, x, z, q]) => o(t, x, z, t === 'colectivo' ? { w: 2.9, h: 3.1, d: 9.5, q } : t === 'camion' ? { h: 2.6, q } : { h: 1.5, q }));
    [[10, -4], [10, 5], [-2, 2]].forEach(([x, z]) => o('bolsas', x, z, { w: 3.6, h: 1.1, d: 0.9, q: 1 }));
    [[0, -34], [12, -30], [12, 32]].forEach(([x, z]) => o('barril', x, z, { h: 1.1 }));
  });

  // ---------- 6. Represa de Itaipú ----------
  mapa('c_itaipu', 'Represa de Itaipú (Hernandarias)', 34, 0, {
    cielo: ['#06080c', '#5d6268', 'baldosa', '#2a2d31'],
    suelos: [],
  }, (b, esc, o) => {
    // paredes de hormigón: 9 salas con puertas en el medio de cada pared
    const H = 6;
    [-11, 11].forEach(c => {
      [[-34, -13], [-9, 9], [13, 34]].forEach(([a0, a1]) => { b(c, (a0 + a1) / 2 - 0, 1, a1 - a0 - 4, H, 0); b((a0 + a1) / 2, c, a1 - a0 - 4, 1, H, 0); });
    });
    // tabiques en las salas de afuera (pasillos y túneles)
    [[-22, -22, 8, 1], [22, 22, 8, 1], [-22, 22, 1, 8], [22, -22, 1, 8], [-28, 0, 6, 1], [28, 0, 6, 1], [0, 28, 1, 6], [0, -28, 1, 6]].forEach(([x, z, w, d]) => b(x, z, w, d, H, 8));
    // sala de turbinas: cuatro turbinas con caños y tableros
    [[-5, -3], [5, -3], [-5, 4], [5, 4]].forEach(([x, z]) => { b(x, z, 3.4, 3.4, 2.6, 5); b(x, z, 2.4, 2.4, 0.8, 0, 2.6); o('caneria', x, z + 2.6, { w: 1, h: 1, d: 2.4, y: 0 }); });
    o('generador', 0, -8.5, { w: 2.6, h: 1.6, d: 1.3 });
    [[-8, -8], [8, -8], [8, 8]].forEach(([x, z]) => o('tablero', x, z, { h: 1.8 }));
    // luces rojas de emergencia y trastos
    [[-11, -20], [11, 20], [-20, 11], [20, -11], [0, -11], [0, 11], [-11, 0], [11, 0], [-28, 28], [28, -28]].forEach(([x, z]) => o('luz_roja', x, z, { h: 0.3, y: 4.2 }));
    [[-26, 26], [26, -18], [-18, -26], [18, 28], [-30, -8]].forEach(([x, z], i) => o(i % 2 ? 'barril' : 'cajon', x, z, i % 2 ? { h: 1.1 } : { w: 1.1 }));
    [[-28, -20], [24, 26], [30, -30]].forEach(([x, z]) => o('tanque_agua', x, z, { h: 3.4 }));
  });

  // ---------- 7. Reserva del Mbaracayú ----------
  mapa('c_mbaracayu', 'Reserva del Mbaracayú (Canindeyú)', 38, 2, {
    cielo: ['#05080a', TIERRA_ROJA, 'tierra', '#1d3a1a'],
    suelos: [[-38, 0.5, 38, 4, '#2a5a6e', 'agua']],
  }, (b, esc, o) => {
    const rnd = azar(7);
    const libre = (x, z) => {
      const L = [[-30, 30, 7], [20, -20, 8], [-30, -30, 7], [0, 2, 4], [10, -14, 4], [-16, -20, 4], [24, 16, 4]];
      for (const [a, c, r] of L) if (Math.hypot(x - a, z - c) < r) return false;
      // senderos: diagonal y el arroyo
      if (Math.abs(x - z * -1) < 3.5 && x > -32 && x < 26) return false;
      return true;
    };
    for (let i = 0; i < 95; i++) {
      const x = -36 + rnd() * 72, z = -36 + rnd() * 72;
      if (!libre(x, z)) continue;
      const r = rnd();
      if (r < 0.45) o('arbol_selva', x, z, { h: 7 + rnd() * 3, q: (rnd() * 4) | 0 });
      else if (r < 0.65) o('helecho', x, z, { w: 3, h: 1.2, d: 3, q: (rnd() * 4) | 0 });
      else if (r < 0.8) o(rnd() < 0.5 ? 'arbusto' : 'arbustos', x, z, { h: 1.4, q: (rnd() * 4) | 0 });
      else if (r < 0.9) o('roca', x, z, { h: 1 + rnd() * 1.6 });
      else o('tronco', x, z, { w: 3.5, h: 0.9, d: 3.5, q: (rnd() * 4) | 0 });
    }
    // torres de madera de los francotiradores (con escalera)
    [[10, -14], [-16, -20], [24, 16]].forEach(([x, z]) => {
      [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([a, c]) => b(x + a, z + c, 0.3, 0.3, 4, 2));
      b(x, z, 3.4, 3.4, 0.3, 2, 4); esc(x, z + 1.7, 0, 1, 4.3, 1.4, 2);
    });
    // puente colgante sobre el arroyo
    b(-6, 2.2, 2, 5, 0.25, 2, 0.6); o('puente_soga', -6, 2.2, { w: 2, h: 1.2, d: 5, q: 1, y: 0.6 });
    // el helicóptero estrellado
    o('helicoptero', 23, -24, { w: 10, h: 3.2, d: 11, q: 1, humo: true });
    o('cajon', 18, -18, { w: 1.1 }); o('bidon', 17, -21, { h: 1.2 });
  });

  // ---------- 8. Ruinas Jesuíticas de Trinidad ----------
  mapa('c_trinidad', 'Ruinas Jesuíticas de Trinidad (Itapúa)', 36, 1, {
    cielo: ['#e8a27a', '#6f8f4a', 'cesped', '#4f7a3a'],
    suelos: [[-12, -32, 12, -4, '#a56a4e', 'ladrillo'], [-34, 6, 34, 10, '#a56a4e', 'ladrillo'], [-34, 18, 34, 22, '#a56a4e', 'ladrillo']],
  }, (b, esc, o, oculta) => {
    const PI = 1, h = 5;
    // la iglesia en ruinas (paredes con huecos y arcos)
    b(-11, -18, 1, 28, h, PI); b(11, -24, 1, 16, h, PI); b(11, -6.5, 1, 5, h, PI);
    b(-5, -32, 12, 1, h, PI); b(7, -32, 6, 1, h, PI);
    b(-8, -4, 6, 1, h, PI); b(8, -4, 6, 1, h, PI);
    o('arco_piedra', 0, -4, { w: 6, h: 6, d: 1.2 }); oculta(-2.6, -4, 0.8, 1, 6); oculta(2.6, -4, 0.8, 1, 6);
    [[-6, -14], [6, -14], [-6, -22], [6, -22]].forEach(([x, z]) => b(x, z, 1.2, 1.2, 4.2, 14));
    // casas de los indígenas: filas de arcos
    [8, 20].forEach(z => {
      for (let x = -30; x <= 30; x += 6) {
        if (Math.abs(x) < 4) continue;
        o('arco_piedra', x, z, { w: 4.4, h: 4.2, d: 1 }); oculta(x - 1.9, z, 0.6, 1, 4.2); oculta(x + 1.9, z, 0.6, 1, 4.2);
      }
      b(-33, z + 2, 2, 1, 3, PI); b(33, z + 2, 2, 1, 3, PI);
    });
    b(-24, 14, 1, 8, 2.4, PI); b(24, 14, 1, 8, 2.4, PI);
    // el puesto de comunicaciones de la corporación
    o('antena', 18, -16, { h: 6 }); o('parabolica', 22, -22, { h: 2.4 }); o('parabolica', 16, -26, { h: 2 });
    o('generador', 26, -14, { w: 2.4, h: 1.5, d: 1.2 }); o('camion_militar', 26, -28, { h: 2.8 });
    [[-6, -25], [24, 13], [-26, 13]].forEach(([x, z]) => o('terminal', x, z, { w: 1.3, h: 0.7, d: 1.1, y: 0.8 }));
    [[-6, -25], [24, 13], [-26, 13]].forEach(([x, z]) => b(x, z, 1.6, 1.2, 0.8, 11));
    [[-20, -10], [20, 0], [-28, -24], [30, 30], [-30, 30], [9, 28]].forEach(([x, z]) => o('arbol_selva', x, z, { h: 7 }));
    [[14, -8], [-16, -2], [4, 14]].forEach(([x, z]) => o('bolsas', x, z, { w: 3.6, h: 1.1, d: 0.9 }));
  });

  // ---------- 9. Ruta Transchaco ----------
  mapa('c_transchaco', 'Ruta Transchaco (Chaco)', 40, 9, {
    cielo: ['#d7a96a', '#c79b62', 'tierra', '#b88a52'],
    suelos: [[-4, -40, 4, 40, ASFALTO, 'asfalto']],
  }, (b, esc, o) => {
    // estación de servicio fortificada
    [[8, -4], [18, -4], [8, 6], [18, 6]].forEach(([x, z]) => b(x, z, 0.4, 0.4, 4, 7));
    b(13, 1, 12, 12, 0.3, 4, 4);
    o('bidon', 11, -1, { h: 1.5 }); o('bidon', 11, 3, { h: 1.5 }); o('tablero', 15, 1, { h: 1.6 });
    o('galeria', 24, 1, { w: 7, h: 4.5, d: 8, q: 3 }); o('publi', 13, 7.2, { w: 6, h: 1, d: 0.2, y: 4.3, txt: 'ESTACIÓN CHACO' });
    [[7, -8], [7, 10], [19, -8]].forEach(([x, z], i) => o('bolsas', x, z, { w: 3.6, h: 1.1, d: 0.9, q: i === 2 ? 1 : 0 }));
    o('tanque_agua', 28, 12, { h: 5 });
    // estancia abandonada
    b(-24, 14, 10, 0.4, 3, 12); b(-24, 24, 10, 0.4, 3, 12); b(-29, 19, 0.4, 10, 3, 12); b(-19, 16, 0.4, 4, 3, 12); b(-19, 22.5, 0.4, 3, 3, 12);
    // palmares
    const rnd = azar(9);
    for (let i = 0; i < 34; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 30), z = -38 + rnd() * 76; if (x > 5 && x < 30 && z > -12 && z < 14) continue; o('palmera', x, z, { h: 6 + rnd() * 3 }); }
    // bloqueos en la ruta (el camión no pasa hasta despejarlos)
    o('camion_militar', 0, 16, { w: 2.6, h: 2.8, d: 6, q: 1, puerta: 'bloqueo1', abre: [0, -3.2, 0] });
    o('jeep', 0, -18, { h: 2.2, q: 1, puerta: 'bloqueo2', abre: [0, -3, 0] }); o('bolsas', 0, -16.4, { w: 4, h: 1.1, d: 0.9, puerta: 'bloqueo2', abre: [0, -2, 0] });
    // vehículos enemigos con ametralladora
    o('humvee', -8, -24, { h: 2, q: 0 }); o('jeep', 9, 24, { h: 2.2, q: 1 });
    [[-6, 30], [6, -32], [-10, -6]].forEach(([x, z]) => o('auto', x, z, { h: 1.6, q: 1 }));
  });

  // ---------- 10. El Búnker del Acuífero ----------
  mapa('c_bunker', 'El Búnker del Acuífero', 34, 8, {
    cielo: ['#020406', '#5f6670', 'baldosa', '#0a0e12'],
    suelos: [[-34, -34, 34, -1, '#3c3f3a', 'tierra'], [-20, -24, -8, -14, '#2b8fb0', 'agua'], [8, -24, 20, -14, '#2b8fb0', 'agua'], [-6, -34, 6, -28, '#2b8fb0', 'agua']],
  }, (b, esc, o) => {
    // pared entre la sala de control y la caverna, con la compuerta
    b(-19, -1, 30, 1, 8, 8); b(19, -1, 30, 1, 8, 8);
    o('compuerta', 0, -1, { w: 8, h: 7, d: 1, puerta: 'compuerta', abre: [0, 7.2, 0] });
    // sala de control
    [[-20, 20], [20, 20], [-20, 12], [20, 12]].forEach(([x, z]) => o('servidor', x, z, { w: 6, h: 3.2, d: 1.4 }));
    [[-6, 14], [6, 14], [0, 20]].forEach(([x, z]) => { b(x, z, 3, 1.2, 1, 11); o('terminal', x, z, { w: 1, h: 0.6, d: 0.9, y: 1 }); });
    [[-12, 4], [12, 4], [-26, 4], [26, 4], [0, 28]].forEach(([x, z]) => o('cajon', x, z, { w: 1.3 }));
    [[-18, 26], [18, 26]].forEach(([x, z]) => b(x, z, 6, 1, 1.2, 0));
    [[-30, 30], [30, 30], [-30, 2], [30, 2], [0, 2]].forEach(([x, z]) => o('luz_azul', x, z, { h: 0.3, y: 5 }));
    // la caverna del acuífero: rocas, válvulas de agua helada y tableros eléctricos
    const rnd = azar(10);
    for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, r = 26 + rnd() * 5, x = Math.cos(a) * r, z = -17 + Math.sin(a) * 14; if (z > -6 || (Math.abs(x) < 10 && z > -12) || [[-26, -11], [26, -11], [-22, -27], [22, -27]].some(([a, c]) => Math.hypot(x - a, z - c) < 6)) continue; o('roca', x, z, { h: 2 + rnd() * 3 }); }
    [[-26, -12], [26, -12]].forEach(([x, z]) => { o('valvula', x, z, { h: 1.2 }); o('caneria', x, z - 1.8, { w: 1, h: 1, d: 3 }); });
    [[-22, -28], [22, -28]].forEach(([x, z]) => o('tablero', x, z, { h: 1.8 }));
    [[-26, -12], [26, -12], [-22, -28], [22, -28], [0, -31]].forEach(([x, z]) => o('luz_azul', x, z, { h: 0.3, y: 3.2 }));
    // el ascensor de emergencia
    b(-3, -32.5, 0.4, 4, 6, 0); b(3, -32.5, 0.4, 4, 6, 0); b(0, -34.3, 6.4, 0.4, 6, 0); b(0, -32.5, 6.4, 4, 0.3, 0, 6);
    o('publi', 0, -30.2, { w: 4, h: 0.6, d: 0.1, y: 5, txt: 'SALIDA DE EMERGENCIA' });
  });
  W.PROPS.compuerta = { n: [1, 1, 1], c: 8, archivo: false };

  // ================= LOS NIVELES =================
  // fases: llegar (a una zona), aguantar (un tiempo), activar (mantener ✋ en puntos), matar (a los mercenarios),
  // escoltar (el camión), jefe (Teju Jagua) y escapar (antes de que explote)
  const NIVELES = [
    { id: 1, n: 'El Brote', lugar: 'Mercado 4 · Asunción', mapa: 'c_mercado4', inicio: [-28, 28], enemigos: '🧟 Solo zombis',
      historia: 'El caos acaba de empezar. Una corporación extranjera perforó el Acuífero Guaraní y liberó un patógeno ancestral. El escuadrón quedó atrapado en el corazón del Mercado 4: hay que abrirse paso entre los pasillos hasta la Avenida Pettirossi, donde espera el helicóptero de rescate.',
      fases: [
        { tipo: 'llegar', zona: [-1.5, 4, 5], txt: 'Abranse paso hasta la plaza del mercado', z: { cada: 2.4, max: 10 } },
        { tipo: 'llegar', zona: [8, -27, 6], txt: 'Salgan a la Avenida Pettirossi', cp: [3.5, 4], z: { cada: 1.8, max: 12 }, horda: 6 },
        { tipo: 'aguantar', seg: 60, zona: [22, -28, 9], txt: 'Aguanten hasta que llegue el helicóptero', cp: [8, -27], z: { cada: 0.9, max: 18, corre: 0.25 } },
      ], fin: 'El helicóptero aterriza... los sacan de Asunción rumbo a la Costanera. Pero alguien más los estaba mirando.' },
    { id: 2, n: 'Fuego Cruzado', lugar: 'La Costanera · Asunción', mapa: 'c_costanera', inicio: [-31, 0], enemigos: '🪖 Mercenarios + 🧟 Zombis',
      historia: 'El punto de rescate está en la playa de la bahía. Al llegar descubren que los mercenarios de la corporación derribaron el helicóptero para no dejar testigos. Usen los autos abandonados para cubrirse... y cuidado: el ruido de los tiros atrae a los zombis de los barrios.',
      fases: [
        { tipo: 'llegar', zona: [6, 13, 7], txt: 'Lleguen al helicóptero de rescate', z: { cada: 3, max: 6 } },
        { tipo: 'matar', txt: 'Eliminen al escuadrón de mercenarios que lo derribó', cp: [-6, 0], ruidoso: true, aviso: '¡Lo derribaron los mercenarios! Vienen a borrar testigos.',
          m: [['merc', 22, 2], ['merc', 26, -4], ['merc', 18, 13], ['merc', 28, 11], ['escudo', 20, -2.5], ['merc', 31, 5], ['franco', 32, -11], ['merc', 14, 21]], ref: { cada: 16, max: 3, desde: [[35, 0], [35, 12]] }, z: { cada: 2.6, max: 10 } },
        { tipo: 'llegar', zona: [33, -1, 5], txt: 'Sigan por la Costanera hacia el interior', cp: [12, 0], z: { cada: 1.5, max: 14 } },
      ], fin: 'Escapan de Asunción por la ruta. El rastro del brote lleva hacia el interior del país.' },
    { id: 3, n: 'Niebla en la Estación', lugar: 'Areguá', mapa: 'c_aregua', inicio: [-18, 28], noche: true, niebla: ['#3b444d', 3, 24], enemigos: '🧟 Zombis (también los rápidos)',
      historia: 'Escapando hacia el interior, el escuadrón llega a Areguá. Un vagón de carga bloquea la ruta principal junto a la vieja estación del tren. Hay que arrancar el generador eléctrico y aguantar en la oscuridad hasta que el vagón se mueva. El Lago Ypacaraí está cubierto de neblina.',
      fases: [
        { tipo: 'llegar', zona: [0, 0, 6], txt: 'Lleguen a la vieja estación del tren', z: { cada: 2.2, max: 10, corre: 0.3 } },
        { tipo: 'activar', puntos: [[-12, -4.6, 'generador']], seg: 6, txt: 'Arranquen el generador eléctrico (mantené ✋ / E)', cp: [0, 0], z: { cada: 2, max: 10, corre: 0.3 } },
        { tipo: 'aguantar', seg: 90, zona: [0, -2, 13], txt: 'Aguanten cerca de la estación mientras el vagón se mueve', cp: [0, 0], z: { cada: 0.75, max: 18, corre: 0.45 }, horda: 8, abre: 'vagon' },
        { tipo: 'llegar', zona: [25, -24, 6], txt: '¡El paso está abierto! Crucen las vías', cp: [0, -2], z: { cada: 1.2, max: 14, corre: 0.5 } },
      ], fin: 'El vagón se aparta y la ruta queda libre. Más adelante, en Caacupé, alguien pide ayuda por radio.' },
    { id: 4, n: 'El Asedio', lugar: 'Basílica de Caacupé', mapa: 'c_caacupe', inicio: [0, 32], noche: true, luna: 0.3, niebla: ['#0b1020', 8, 85], enemigos: '🧟 Hordas masivas',
      historia: 'Un grupo de civiles se refugió dentro de la Basílica. Hay que organizar la defensa: dos cubren la explanada desde abajo y dos pueden subir a las torres de los costados con el francotirador, mientras se evacúa a la gente por la parte de atrás. Si los zombis rompen la puerta, todo está perdido.',
      fases: [
        { tipo: 'llegar', zona: [0, -6, 7], txt: 'Suban a la explanada de la Basílica', z: { cada: 2, max: 10 } },
        { tipo: 'aguantar', seg: 150, puerta: [0, -10.8, 4200], txt: 'Defiendan la puerta mientras evacúan a la gente', cp: [0, -6], z: { cada: 0.6, max: 20, corre: 0.35 }, horda: 10 },
        { tipo: 'llegar', zona: [30, -32, 6], txt: 'Salgan por atrás de la Basílica', cp: [0, -8], z: { cada: 1, max: 16, corre: 0.4 } },
      ], fin: 'La gente quedó a salvo. Por la radio interceptan una transmisión: la corporación quiere sacar muestras del virus hacia Brasil.' },
    { id: 5, n: 'Guerra en la Frontera', lugar: 'Puente de la Amistad · Ciudad del Este', mapa: 'c_cde', inicio: [-33, 33], enemigos: '⚔️ Guerra de 3 bandos: ustedes, mercenarios y zombis',
      historia: 'La corporación intenta cruzar las muestras del virus a Brasil por el Puente de la Amistad. El microcentro es un caos: mercenarios y zombis se pelean entre ellos. Usen la granada de ruido 📢 (tecla B) para mandar a los zombis contra los mercenarios.',
      fases: [
        { tipo: 'llegar', zona: [11, 0, 6], txt: 'Crucen el microcentro hasta la entrada del puente', m: [['merc', -10, 0], ['merc', 0, 16], ['merc', 4, -14], ['escudo', 8, 4], ['merc', -18, -16], ['merc', 2, 30]], z: { cada: 1.6, max: 14 } },
        { tipo: 'matar', txt: 'Eliminen al convoy de la corporación sobre el puente', cp: [8, 0], m: [['escudo', 22, 0.5], ['merc', 26, -4], ['merc', 29, 4], ['merc', 34, 0], ['franco', 37, -4], ['escudo', 30, 1]], ref: { cada: 18, max: 2, desde: [[37, 0]] }, z: { cada: 2, max: 12 } },
        { tipo: 'activar', puntos: [[33, -4.3, 'camion']], seg: 7, txt: 'Recuperen las muestras del camión militar', cp: [24, 0], z: { cada: 1, max: 16 } },
      ], fin: 'Las muestras están a salvo. En ellas hay un dato clave: el laboratorio secreto se alimenta con energía de Itaipú.' },
    { id: 6, n: 'Apagón', lugar: 'Represa de Itaipú · Hernandarias', mapa: 'c_itaipu', inicio: [-28, 28], noche: true, luna: 0.1, enemigos: '🪖 Mercenarios tácticos + 🧟 zombis en la oscuridad',
      historia: 'La energía del laboratorio secreto se desvía desde la represa. El escuadrón se infiltra para cortar el suministro, pero los mercenarios apagaron las luces del sector: solo quedan las linternas tácticas (F) y las luces rojas de emergencia.',
      fases: [
        { tipo: 'llegar', zona: [0, 9, 5], txt: 'Infíltrense hasta la sala de turbinas', m: [['merc', -20, 2], ['merc', 2, 20], ['escudo', 4, 13]], z: { cada: 2.6, max: 8 } },
        { tipo: 'activar', puntos: [[-8, -9.6, 'tablero'], [8, -9.6, 'tablero'], [8, 9.6, 'tablero']], seg: 5, txt: 'Corten el suministro en los 3 tableros', cp: [0, 9], m: [['merc', 0, -7], ['merc', -6, 7], ['merc', 7, 0], ['escudo', 0, 0]], ref: { cada: 18, max: 3, desde: [[28, -28], [-28, -28]] }, z: { cada: 2, max: 10 } },
        { tipo: 'llegar', zona: [28, -28, 5], txt: 'Escapen por los túneles de mantenimiento', cp: [0, 0], z: { cada: 1.1, max: 16, corre: 0.3 } },
      ], fin: 'El laboratorio se quedó sin energía. Un helicóptero enemigo huyó hacia la selva de Canindeyú... y se estrelló.' },
    { id: 7, n: 'Territorio Hostil', lugar: 'Reserva del Mbaracayú · Canindeyú', mapa: 'c_mbaracayu', inicio: [-30, 30], noche: true, niebla: ['#0b120c', 4, 30], selva: true, enemigos: '🎯 Francotiradores + 🧟 zombis camuflados',
      historia: 'Siguen el rastro del helicóptero enemigo estrellado en la selva para recuperar las coordenadas de la base principal. Tierra roja, arroyos y francotiradores escondidos en torres. De noche se escuchan silbidos raros... dicen que es el Pombero.',
      fases: [
        { tipo: 'llegar', zona: [20, -20, 7], txt: 'Sigan el rastro hasta el helicóptero estrellado', m: [['franco', 10, -14, 4.3], ['franco', -16, -20, 4.3], ['merc', 0, 0], ['merc', 12, -4]], z: { cada: 2.4, max: 10, corre: 0.2 } },
        { tipo: 'activar', puntos: [[19, -21, 'helicoptero']], seg: 7, txt: 'Recuperen las coordenadas de la base', cp: [16, -16], z: { cada: 1.6, max: 12, corre: 0.3 } },
        { tipo: 'llegar', zona: [-30, -30, 6], txt: 'Lleguen al claro de extracción', cp: [16, -16], m: [['franco', 24, 16, 4.3], ['merc', -14, -10], ['merc', -22, -24], ['escudo', -10, -24]], z: { cada: 1.4, max: 14, corre: 0.35 } },
      ], fin: 'Las coordenadas marcan un punto en las ruinas de Trinidad: ahí la corporación tiene un puesto de comunicaciones.' },
    { id: 8, n: 'Ecos de Piedra', lugar: 'Ruinas Jesuíticas de Trinidad · Itapúa', mapa: 'c_trinidad', inicio: [0, 33], enemigos: '🛡️ Mercenarios con escudo + 💥 zombis explosivos',
      historia: 'La corporación instaló un puesto de comunicaciones temporal entre los muros de piedra roja. Hay que hackear las 3 terminales enemigas (como plantar la bomba) mientras resisten los contraataques. Los mercenarios con escudo solo caen por los costados, por atrás o a la cabeza... y los zombis verdes explotan.',
      fases: [
        { tipo: 'activar', puntos: [[-6, -23.6, 'terminal'], [24, 11.6, 'terminal'], [-26, 11.6, 'terminal']], seg: 9, txt: 'Hackeen las 3 terminales enemigas', m: [['escudo', -3, -14], ['merc', 6, -20], ['escudo', 22, 6], ['merc', 27, 15], ['escudo', -24, 6], ['merc', -29, 16]], ref: { cada: 20, max: 3, desde: [[0, -34], [34, 0], [-34, 0]] }, z: { cada: 2.2, max: 12, explosivo: 0.35 } },
        { tipo: 'aguantar', seg: 45, zona: [0, 0, 12], txt: 'Aguanten mientras se descargan los datos', cp: [0, 2], m: [['escudo', 0, -30], ['merc', -30, -4], ['merc', 30, -4]], z: { cada: 0.9, max: 16, explosivo: 0.3 } },
        { tipo: 'llegar', zona: [30, 32, 6], txt: 'Retirada hacia la ruta', cp: [0, 2], z: { cada: 1.2, max: 14, explosivo: 0.3 } },
      ], fin: 'Los datos revelan la ubicación del búnker: en el corazón del Chaco, sobre una caverna del acuífero.' },
    { id: 9, n: 'Furia en el Polvo', lugar: 'Ruta Transchaco · Chaco Paraguayo', mapa: 'c_transchaco', inicio: [0, 38], niebla: ['#c99a5e', 8, 48], polvo: true, enemigos: '🚙 Vehículos enemigos + 🪖 mercenarios + 🧟 zombis del desierto',
      historia: 'Ya saben dónde está el búnker. El escuadrón avanza escoltando un camión blindado por la Transchaco, bajo un sol abrasador y en medio de una tormenta de polvo. Hay que despejar los bloqueos y defender el camión mientras carga combustible.',
      fases: [
        { tipo: 'escoltar', ruta: [[0, 35], [0, 4]], paradas: [{ gate: 'bloqueo1', antes: [0, 20], punto: [4.2, 16] }], txt: 'Escolten el camión blindado hasta la estación de servicio', m: [['merc', -6, 10], ['merc', 8, 20], ['torreta', 9, 24, 2.2], ['merc', -10, 24]], z: { cada: 2.2, max: 10 } },
        { tipo: 'aguantar', seg: 70, defiende: true, txt: 'Defiendan el camión mientras carga combustible', cp: [6, 6], ref: { cada: 15, max: 4, desde: [[-38, -10], [38, 10], [0, -38]] }, z: { cada: 0.9, max: 18, corre: 0.3 } },
        { tipo: 'escoltar', ruta: [[0, 4], [0, -36]], paradas: [{ gate: 'bloqueo2', antes: [0, -13.5], punto: [-4.4, -18] }], txt: 'Último tramo: ¡lleven el camión hasta el búnker!', cp: [0, 2], m: [['torreta', -8, -24, 2], ['escudo', 0, -27], ['merc', 6, -30], ['merc', -6, -31]], z: { cada: 1.5, max: 14 } },
      ], fin: 'El camión llega a la entrada del búnker. Abajo, sobre las aguas cristalinas del acuífero, los espera el comandante.' },
    { id: 10, n: 'El Búnker del Acuífero', lugar: 'Bajo el Chaco · Gran Final', mapa: 'c_bunker', inicio: [0, 30], noche: true, luna: 0.16, niebla: ['#03060a', 4, 34], enemigos: '🎖️ El comandante, su guardia de élite, torretas... y el Proyecto Teju Jagua',
      historia: 'El complejo militar-científico está construido sobre una caverna gigante de aguas cristalinas. Primero hay que vencer al comandante y a su guardia en la sala de control (las torretas se pueden desactivar con ✋). Después... nadie sabe lo que hay detrás de la compuerta.',
      fases: [
        { tipo: 'matar', txt: 'Venzan al comandante, su guardia y las torretas (✋ desactiva las torretas)', m: [['comandante', 0, 6], ['merc', -7, 9], ['merc', 7, 9], ['escudo', -3, 3], ['escudo', 3, 3], ['torreta', -10, 10, 1], ['torreta', 10, 10, 1], ['merc', -24, 8], ['merc', 24, 8]], abre: 'compuerta' },
        { tipo: 'jefe', txt: 'Su piel es antibalas: activen DOS consolas a la vez (válvulas de agua helada o descargas) para dejar al descubierto su punto débil', cp: [0, 4], jefe: [0, -18], aviso: '¡El comandante se inyectó la cepa original! Es el Proyecto Teju Jagua.',
          puntos: [[-26, -10.4, 'valvula'], [26, -10.4, 'valvula'], [-22, -26.4, 'tablero'], [22, -26.4, 'tablero']], seg: 2, z: { cada: 2.6, max: 8 } },
        { tipo: 'escapar', seg: 120, zona: [0, -32, 3.2], txt: '¡Autodestrucción! Corran al ascensor de emergencia', cp: [0, -10], z: { cada: 0.8, max: 16, corre: 0.55 }, aviso: '¡Se activó la autodestrucción del búnker! Tienen 2 minutos.' },
      ], fin: '' },
  ];
  NIVELES.forEach(n => n.fases.forEach(f => { if (!f.cp) f.cp = n.inicio; }));

  // ================= MERCENARIOS =================
  const MT = {
    merc:       { n: 'Mercenario', hp: 120, dmg: 8, cad: 0.12, rafaga: [3, 6], pausa: [0.7, 1.4], mag: 30, rec: 2.3, rango: 48, err: 0.045, vel: 4.2, ideal: 16, react: 0.55, w: 'fusil' },
    franco:     { n: 'Francotirador', hp: 90, dmg: 42, cad: 2.6, rafaga: [1, 1], pausa: [0, 0], mag: 5, rec: 2.8, rango: 140, err: 0.008, vel: 2.6, ideal: 60, react: 0.9, w: 'franco', apunta: 1.5, quieto: true },
    escudo:     { n: 'Mercenario con escudo', hp: 230, dmg: 6, cad: 0.13, rafaga: [3, 5], pausa: [0.9, 1.6], mag: 24, rec: 2.6, rango: 34, err: 0.06, vel: 2.9, ideal: 7, react: 0.6, w: 'subfusil', escudo: true },
    comandante: { n: 'El Comandante', hp: 1200, dmg: 11, cad: 0.1, rafaga: [4, 8], pausa: [0.6, 1.1], mag: 40, rec: 2, rango: 55, err: 0.04, vel: 3.6, ideal: 14, react: 0.4, w: 'fusil', jefe: true },
    torreta:    { n: 'Torreta automática', hp: 520, dmg: 5, cad: 0.1, rafaga: [6, 10], pausa: [0.8, 1.2], mag: 999, rec: 0, rango: 40, err: 0.06, vel: 0, ideal: 0, react: 0.7, w: 'subfusil', fija: true },
  };
  const TIPOS_M = Object.keys(MT);

  // ================= LO QUE HACE LA SALA EN LA CAMPAÑA =================
  function instalar(Room) {
    const P = Room.prototype;
    const vivosH = s => s.humans().filter(p => p.alive);

    P.campStart = function (nivel, sinAviso) {
      nivel = Math.max(0, Math.min(NIVELES.length - 1, nivel | 0));
      const N = NIVELES[nivel];
      this.settings.map = N.mapa; W.reiniciarMapa(N.mapa);
      this.zombis.clear(); this.mercs = new Map(); this.proy = []; this.areas = []; this.ola = null;
      this.camp = { items: new Map(), iVer: 0, nivel, fase: -1, estado: 'juego', gracia: Date.now() + 7000, zT: 2, refT: 0, ruido: 0, puntos: [], camion: null, puerta: null, jefe: null, hasta: 0, prog: 0, refN: 0 };
      this.all({ t: 'cnivel', n: nivel });
      for (const p of this.players.values()) this.respawn(p, true);
      this.campItems();
      this.campFase(0);
      this.broadcastState();
      for (const p of this.players.values()) this.spawnMsg(p);
      if (!sinAviso) this.sys(`🎖️ Nivel ${N.id}: ${N.n} — ${N.lugar}`);
    };
    P.campFase = function (i) {
      const c = this.camp, N = NIVELES[c.nivel], f = N.fases[i];
      c.fase = i; c.f = f; c.prog = 0; c.refN = 0; c.refT = f.ref ? f.ref.cada * 0.6 : 0; c.zT = 1.5;
      c.puntos = (f.puntos || []).map(([x, z, tipo]) => ({ x, z, tipo, prog: 0, ok: 0, cd: 0 }));
      if (f.paradas) c.puntos = f.paradas.map(p => ({ x: p.punto[0], z: p.punto[1], tipo: 'bloqueo', prog: 0, ok: 0, cd: 0, gate: p.gate, antes: p.antes }));
      c.hasta = f.seg && (f.tipo === 'aguantar' || f.tipo === 'escapar') ? 0 : 0;
      c.tiempo = f.seg || 0; c.t = 0;
      c.puerta = f.puerta ? { x: f.puerta[0], z: f.puerta[1], y: 0, hp: f.puerta[2], max: f.puerta[2], esPuerta: true, alive: true } : null;
      if (f.tipo === 'escoltar') {
        if (!c.camion) c.camion = { x: f.ruta[0][0], z: f.ruta[0][1], y: 0, ry: 0, hp: 3200, max: 3200, esCamion: true, alive: true };
        c.camion.i = 1; c.camion.ruta = f.ruta;
      }
      c.guardado = c.camion ? { x: c.camion.x, z: c.camion.z, hp: c.camion.hp } : null;
      if (f.m) f.m.forEach(([t, x, z, y]) => this.nuevoMerc(t, x, z, y || 0, i));
      if (f.jefe) this.nuevoJefe(f.jefe[0], f.jefe[1]);
      if (f.horda) for (let k = 0; k < f.horda; k++) this.campZombi(f.z || {});
      this.all({ t: 'cfase', n: c.nivel, f: i });
      this.sys(`🎯 ${f.txt}`);
      if (f.aviso) this.sys('⚠️ ' + f.aviso);
    };
    P.campReintentar = function () {
      const c = this.camp, f = c.f;
      this.zombis.clear(); this.mercs = new Map(); this.proy = []; this.areas = [];
      if (c.guardado && c.camion) Object.assign(c.camion, c.guardado);
      if (f.tipo === 'escoltar' && c.camion) { c.camion.x = f.ruta[0][0]; c.camion.z = f.ruta[0][1]; }
      c.estado = 'juego'; c.gracia = Date.now() + 4000;
      for (const p of this.players.values()) { p.alive = false; this.respawn(p, true); }
      const i = c.fase; this.campFase(i);
      this.broadcastState();
      for (const p of this.players.values()) this.spawnMsg(p);
    };
    P.campFalla = function (motivo) {
      const c = this.camp; if (c.estado !== 'juego') return;
      c.estado = 'falla'; c.espera = Date.now() + 6000;
      this.all({ t: 'cfalla', motivo });
      this.sys('💀 ' + motivo + ' Reintentan desde el último punto de control...');
    };
    P.campCompleta = function () {
      const c = this.camp, N = NIVELES[c.nivel], f = c.f;
      if (f.abre && W.abrir(this.M, f.abre)) this.all({ t: 'abrir', id: f.abre });
      for (const p of this.players.values()) if (!p.alive) this.respawn(p);
      if (c.fase + 1 < N.fases.length) { this.campFase(c.fase + 1); this.broadcastState(); return; }
      // nivel terminado
      for (const z of this.zombis.values()) if (z.alive && z.tipo === 'teju') z.alive = false;
      if (c.nivel + 1 < NIVELES.length) {
        c.estado = 'fin'; c.espera = Date.now() + 10000;
        this.all({ t: 'cfin', n: c.nivel });
        this.sys(`✅ ¡Nivel ${N.id} completado! ${N.fin}`);
      } else {
        c.estado = 'final'; c.espera = Date.now() + 32000;
        this.zombis.clear(); this.mercs.clear();
        this.all({ t: 'final' });
        this.sys('🧉 ¡Operación Yvy cumplida! El acuífero está a salvo.');
      }
    };

    // ---------- el reloj de la campaña ----------
    P.campTick = function (dt, now) {
      const c = this.camp, f = c.f, M = this.M;
      if (c.estado === 'falla') { if (now >= c.espera) this.campReintentar(); return; }
      if (c.estado === 'fin') { if (now >= c.espera) { const k = c.nivel + 1; this.campStart(k); } return; }
      if (c.estado === 'final') { if (now >= c.espera) this.finish('campana'); return; }
      for (const [id, z] of this.zombis) if (!z.alive && now - z.deadAt > 2500) this.zombis.delete(id);
      for (const [id, m] of this.mercs) if (!m.alive && now - m.deadAt > 4000) this.mercs.delete(id);
      c.ruido = Math.max(0, c.ruido - dt * 1.5);
      const enJuego = now >= c.gracia;
      // zombis que van llegando
      if (enJuego && f.z) {
        c.zT -= dt * (f.ruidoso ? 1 + c.ruido / 12 : 1);
        let vivos = 0; for (const z of this.zombis.values()) if (z.alive && z.tipo !== 'teju') vivos++;
        const mx = Math.round(f.z.max * (0.7 + 0.1 * Math.max(1, this.players.size)));
        if (c.zT <= 0 && vivos < Math.min(mx, 22)) { c.zT = f.z.cada * (0.9 + Math.random() * 0.4); this.campZombi(f.z); }
      }
      // refuerzos de mercenarios
      if (enJuego && f.ref && c.refN < f.ref.max) {
        c.refT -= dt;
        if (c.refT <= 0) { c.refT = f.ref.cada; c.refN++; const d = f.ref.desde[(Math.random() * f.ref.desde.length) | 0]; this.nuevoMerc(Math.random() < 0.25 ? 'escudo' : 'merc', d[0], d[1], 0, c.fase); }
      }
      for (const z of this.zombis.values()) this.zombiTick(z, dt, now);
      for (const m of this.mercs.values()) this.mercTick(m, dt, now);
      this.itemsTick();
      this.proyTick(dt, now); this.areasTick(dt, now);
      if (this.phase !== 'play' || c.estado !== 'juego') return;
      if (c.camion) this.camionTick(dt, now);
      this.objetivoTick(dt, now);
    };
    const enZona = (p, z) => Math.hypot(p.x - z[0], p.z - z[1]) <= z[2];
    // ¿quién está usando (✋) un punto? los humanos que mantienen el botón y los bots que están ahí tranquilos
    P.usandoEn = function (pt, r) {
      let n = 0;
      for (const p of this.players.values()) {
        if (!p.alive || Math.hypot(p.x - pt.x, p.z - pt.z) > r || Math.abs(p.y) > 2.5) continue;
        if (p.bot ? !p.bot.tgt : p.usando) n++;
      }
      return n;
    };
    P.objetivoTick = function (dt, now) {
      const c = this.camp, f = c.f, H = vivosH(this);
      if (this.humans().length && !H.length && !this.players.size) return;
      switch (f.tipo) {
        case 'llegar': case 'escapar': {
          if (H.length && H.every(p => enZona(p, f.zona))) return this.campCompleta();
          if (f.tipo === 'escapar') { c.t += dt; c.prog = c.t / f.seg; if (c.t >= f.seg) { for (const p of this.players.values()) if (p.alive) this.die(p, null, 'derrumbe', false); this.campFalla('El búnker explotó con ustedes adentro.'); } }
          break;
        }
        case 'aguantar': {
          const hay = f.zona ? this.list().some(p => p.alive && enZona(p, f.zona)) : true;
          if (hay) c.t += dt;
          c.prog = c.t / f.seg;
          if (c.puerta && c.puerta.hp <= 0) return this.campFalla('Los zombis rompieron la puerta de la Basílica.');
          if (f.defiende && c.camion && c.camion.hp <= 0) return this.campFalla('Destruyeron el camión blindado.');
          if (c.t >= f.seg) return this.campCompleta();
          break;
        }
        case 'activar': {
          for (const pt of c.puntos) {
            if (pt.ok) continue;
            if (this.usandoEn(pt, 2.6)) pt.prog += dt; else pt.prog = Math.max(0, pt.prog - dt * 0.15);
            if (pt.prog >= f.seg) { pt.ok = now; this.all({ t: 'cpunto', i: c.puntos.indexOf(pt) }); this.sys(`✅ ${c.puntos.filter(q => q.ok).length} de ${c.puntos.length} listos`); }
          }
          c.prog = c.puntos.filter(q => q.ok).length / c.puntos.length;
          if (c.puntos.every(q => q.ok)) return this.campCompleta();
          break;
        }
        case 'matar': {
          // las torretas también se desactivan con ✋
          for (const m of this.mercs.values()) if (m.alive && m.tipo === 'torreta') {
            const n = this.usandoEn(m, 2.4);
            if (n) { m.hack = (m.hack || 0) + dt; if (m.hack >= 3) { const u = [...this.players.values()].find(p => p.alive && Math.hypot(p.x - m.x, p.z - m.z) < 2.4); this.matarMerc(m, u, 'hack', false); } }
            else m.hack = Math.max(0, (m.hack || 0) - dt);
          }
          let quedan = 0, total = 0; for (const m of this.mercs.values()) if (m.fase === c.fase) { total++; if (m.alive) quedan++; }
          c.prog = total ? 1 - quedan / total : 1;
          if (now >= c.gracia && quedan === 0 && c.refN >= (f.ref ? f.ref.max : 0)) return this.campCompleta();
          if (now >= c.gracia && quedan === 0 && f.ref && c.refT > 3) c.refT = 3;
          break;
        }
        case 'escoltar': {
          for (const pt of c.puntos) {
            if (pt.ok) continue;
            if (this.usandoEn(pt, 2.6)) pt.prog += dt; else pt.prog = Math.max(0, pt.prog - dt * 0.2);
            if (pt.prog >= 3) { pt.ok = now; if (W.abrir(this.M, pt.gate)) this.all({ t: 'abrir', id: pt.gate }); this.sys('✅ ¡Bloqueo despejado! El camión puede seguir.'); }
          }
          const k = c.camion; c.prog = k ? (k.i - 1 + (1 - Math.min(1, Math.hypot(k.ruta[k.i] ? k.ruta[k.i][0] - k.x : 0, k.ruta[k.i] ? k.ruta[k.i][1] - k.z : 0) / 40))) / (k.ruta.length - 1) : 0;
          if (k && k.hp <= 0) return this.campFalla('Destruyeron el camión blindado.');
          if (k && k.i >= k.ruta.length) return this.campCompleta();
          break;
        }
        case 'jefe': {
          const J = c.jefe;
          if (!J) break;
          const need = Math.max(1, Math.min(2, H.length));
          for (const pt of c.puntos) {
            if (now < pt.cd) { pt.prog = 0; continue; }
            if (this.usandoEn(pt, 2.6)) pt.prog += dt; else pt.prog = Math.max(0, pt.prog - dt * 0.5);
            if (pt.prog >= f.seg) { pt.prog = 0; pt.ok = now; pt.cd = now + 12000; this.all({ t: 'cpunto', i: c.puntos.indexOf(pt), jefe: 1 }); }
          }
          const recientes = c.puntos.filter(q => q.ok && now - q.ok < 8000);
          if (recientes.length >= need && now > J.expHasta) {
            J.expHasta = now + 10000; recientes.forEach(q => q.ok = 0);
            this.all({ t: 'jefe', ev: 'expuesto', tipo: recientes[0].tipo });
            this.sys('❄️⚡ ¡Teju Jagua quedó al descubierto! ¡Tírenle a la cabeza!');
          }
          c.prog = 1 - Math.max(0, J.hp) / J.max;
          if (!J.alive) { c.jefe = null; this.sys('🏆 ¡Cayó Teju Jagua!'); return this.campCompleta(); }
          break;
        }
      }
    };
    P.campRevisarCaidos = function () {
      const c = this.camp; if (!c || c.estado !== 'juego') return;
      // se pierde solo si no queda nadie en pie (los bots compañeros también cuentan)
      if (this.players.size && !this.list().some(p => p.alive)) this.campFalla('Cayeron todos.');
    };
    // dónde reaparece alguien: al lado de un compañero vivo, o en el último punto de control
    P.campPunto = function (p) {
      const c = this.camp, M = this.M, f = c.f || NIVELES[c.nivel].fases[0];
      const vivos = this.list().filter(q => q !== p && q.alive && !q.bot);
      let base = f.cp.slice();
      if (vivos.length && c.estado === 'juego' && f.tipo !== 'escapar') { const q = vivos[(Math.random() * vivos.length) | 0]; base = [q.x, q.z]; }
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * Math.PI * 2, r = 1 + (k / 40) * 5, x = base[0] + Math.cos(a) * r, z = base[1] + Math.sin(a) * r;
        if (Math.abs(x) > M.S - 0.6 || Math.abs(z) > M.S - 0.6) continue;
        const y = W.piso(M, x, z, 6);
        if (!W.choca(M, x, y + 0.05, z, F_H) && this.enNav(x, z, y)) return [x, y, z];
      }
      return [f.cp[0], W.piso(M, f.cp[0], f.cp[1], 6), f.cp[1]];
    };
    const F_H = W.F.H;
    P.enNav = function (x, z, y) {
      if (y > 0.6) return true;
      const nav = this.M.nav, i = Math.floor(x + nav.S), j = Math.floor(z + nav.S);
      return i >= 0 && j >= 0 && i < nav.N && j < nav.N && !!nav.ok[j * nav.N + i];
    };

    // ---------- zombis de la campaña ----------
    P.campZombi = function (cfg) {
      const c = this.camp, M = this.M, N = c.nivel;
      const vivos = this.list().filter(p => p.alive);
      let best = null, bd = -1;
      for (let i = 0; i < 16; i++) {
        const p = W.puntoLibre(M); let d = 1e9, visto = false;
        for (const q of vivos) { const dd = Math.hypot(q.x - p[0], q.z - p[2]); d = Math.min(d, dd); if (dd < 30 && W.seVe(M, [q.x, q.y + 1.5, q.z], [p[0], 1.2, p[2]])) visto = true; }
        const s = d > 16 ? (visto ? d * 0.3 : d + 40) : d * 0.1;
        if (d < 55 && s > bd) { bd = s; best = p; }
      }
      if (!best) best = W.puntoLibre(M);
      const r = Math.random();
      let tipo = 'zombi';
      if (cfg.explosivo && r < cfg.explosivo) tipo = 'explosivo';
      else if (N >= 1 && r > 0.82) tipo = 'gordo'; else if (N >= 2 && r > 0.7) tipo = 'brazo'; else if (r > 0.62 && r < 0.68) tipo = 'medio';
      const z = this.zombiEn(tipo, best, 1 + 0.07 * N, Math.random() < (cfg.corre || 0.1));
      return z;
    };

    // ---------- mercenarios ----------
    P.nuevoMerc = function (tipo, x, z, y, fase) {
      const T = MT[tipo] || MT.merc, M = this.M, k = 0.7 + 0.12 * Math.max(1, this.players.size);
      const id = 'm' + (++this.zc);
      if (!T.fija && y < 0.5) { const p = this.libreCerca(x, z); x = p[0]; z = p[1]; }
      const m = { id, merc: true, tipo, x, y: y || 0, z, ry: 0, rx: 0, hp: T.hp * k, max: T.hp * k, alive: true, crouch: false, estado: 0, fase,
        tgt: null, vista: 0, lookT: Math.random() * 0.3, next: 0, rafaga: 0, ammo: T.mag, recT: 0, puesto: [x, z], ultimo: null, pathT: 0, paso: null, apuntaT: 0,
        alto: tipo === 'torreta' ? 1.15 : undefined, ancho: tipo === 'torreta' ? 0.6 : undefined, cabR: tipo === 'torreta' ? 0.32 : undefined,
        s: { x, y: y || 0, z, vx: 0, vy: 0, vz: 0, ground: true, crouch: false, slideT: 0 }, agT: 2 + Math.random() * 3, granT: 6 + Math.random() * 6, humoT: 10 };
      this.mercs.set(id, m);
      return m;
    };
    P.libreCerca = function (x, z) {
      const M = this.M;
      for (let k = 0; k < 30; k++) {
        const a = Math.random() * Math.PI * 2, r = (k / 30) * 4, xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r;
        if (Math.abs(xx) > M.S - 0.6 || Math.abs(zz) > M.S - 0.6) continue;
        if (!W.choca(M, xx, 0.05, zz, F_H) && this.enNav(xx, zz, 0)) return [xx, zz];
      }
      return [x, z];
    };
    // humo de las granadas de humo del comandante: tapa la vista de mercenarios y torretas
    P.humoEntre = function (a, b) {
      for (const h of this.areas) {
        if (h.tipo !== 'humo') continue;
        const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
        const t = Math.max(0, Math.min(L, ((h.x - a[0]) * dx + (h.z - a[2]) * dz) / L));
        if (Math.hypot(a[0] + dx / L * t - h.x, a[2] + dz / L * t - h.z) < h.r) return true;
      }
      return false;
    };
    P.mercTick = function (m, dt, now) {
      if (!m.alive) return;
      const T = MT[m.tipo], M = this.M, c = this.camp;
      const ojo = [m.x, m.y + (m.tipo === 'torreta' ? 0.75 : m.crouch ? 0.95 : 1.5), m.z];
      if (now < c.gracia) return;
      // elegir a quién tirarle: jugadores, zombis cerca (pelean entre ellos) o el camión
      m.lookT -= dt;
      if (m.lookT <= 0) {
        m.lookT = 0.25 + Math.random() * 0.1;
        let best = null, bs = 1e9;
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const d = Math.hypot(p.x - m.x, p.z - m.z); if (d > T.rango) continue;
          const b = [p.x, p.y + (p.crouch ? 0.8 : 1.3), p.z];
          if (W.seVe(M, ojo, b) && !this.humoEntre(ojo, b) && d < bs) { bs = d; best = p; }
        }
        for (const z of this.zombis.values()) {
          if (!z.alive || z.tipo === 'teju') continue;
          const d = Math.hypot(z.x - m.x, z.z - m.z); if (d > Math.min(T.rango, 26)) continue;
          const s = d < 7 ? d * 0.6 : d * 1.35;
          if (s < bs && W.seVe(M, ojo, [z.x, z.y + 1.1, z.z])) { bs = s; best = z; }
        }
        if (!best && c.camion && c.camion.hp > 0 && m.tipo !== 'franco') { const k = c.camion, d = Math.hypot(k.x - m.x, k.z - m.z); if (d < T.rango * 0.8 && W.seVe(M, ojo, [k.x, 1.5, k.z])) best = k; }
        if (best !== m.tgt) { m.tgt = best; m.vista = 0; m.apuntaT = 0; }
        if (best && !best.zombi && !best.esCamion) m.ultimo = [best.x, best.z];
      }
      const q = m.tgt;
      if (q && (!q.alive || (q.esCamion && q.hp <= 0))) m.tgt = null;
      // recargar
      if (m.recT > 0) { m.recT -= dt; m.estado = 3; if (m.recT <= 0) m.ammo = T.mag; }
      let mx = 0, mz = 0, quiere = m.ry, quiereRx = 0;
      if (m.tgt) {
        const t = m.tgt; m.vista += dt;
        const ty = t.esCamion ? 1.5 : t.zombi ? t.y + (t.alto || 1.7) * 0.6 : t.y + (t.crouch ? 0.8 : 1.25);
        const dx = t.x - ojo[0], dy = ty - ojo[1], dz = t.z - ojo[2], L = Math.hypot(dx, dz) || 1;
        quiere = Math.atan2(-dx, -dz); quiereRx = Math.atan2(dy, L);
        if (!T.fija && !T.quieto) {
          const fw = L > T.ideal + 5 ? 1 : L < T.ideal - 4 ? -0.6 : 0;
          m.agT -= dt; if (m.agT <= 0) { m.agT = 1.5 + Math.random() * 2.5; m.lado = Math.random() < 0.5 ? -1 : 1; m.agachado = Math.random() < 0.4; }
          const st = T.escudo ? 0.25 : 0.7;
          mx = dx / L * fw + dz / L * (m.lado || 1) * st; mz = dz / L * fw - dx / L * (m.lado || 1) * st;
          if (fw > 0 && L > 8) { m.pathT -= dt; if (m.pathT <= 0 || !m.paso) { m.pathT = 0.5; m.paso = W.rumbo(M, m.x, m.z, t.x, t.z); } if (m.paso) { const ex = m.paso[0] - m.x, ez = m.paso[1] - m.z, l = Math.hypot(ex, ez) || 1; mx = ex / l; mz = ez / l; } }
        }
        // tirar
        let dr = quiere - m.ry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
        if (m.recT <= 0 && m.vista > T.react && Math.abs(dr) < 0.2) {
          if (T.apunta) {
            m.apuntaT += dt; m.estado = 1;
            if (m.apuntaT >= T.apunta) { m.apuntaT = 0; this.mercTiro(m, T, ojo, t, ty); if (--m.ammo <= 0) m.recT = T.rec; }
          } else if (now >= m.next) {
            this.mercTiro(m, T, ojo, t, ty); m.estado = 4;
            if (--m.ammo <= 0) { m.recT = T.rec; m.rafaga = 0; }
            if (++m.rafaga >= (m.rafMax || (m.rafMax = T.rafaga[0] + ((Math.random() * (T.rafaga[1] - T.rafaga[0] + 1)) | 0)))) { m.rafaga = 0; m.rafMax = 0; m.next = now + (T.pausa[0] + Math.random() * (T.pausa[1] - T.pausa[0])) * 1000; }
            else m.next = now + T.cad * 1000;
          }
        }
        // el comandante tira granadas y humo
        if (m.tipo === 'comandante' && !t.zombi) {
          m.granT -= dt; m.humoT -= dt;
          if (m.granT <= 0 && L > 6 && L < 22) { m.granT = 9 + Math.random() * 5; this.lanzar('granada', [m.x, m.y + 1.5, m.z], this.lob([m.x, m.y + 1.5, m.z], [t.x, t.y, t.z], 0.6), m); this.all({ t: 'tira', id: m.id, tipo: 'granada' }); }
          if (m.humoT <= 0 && m.hp < m.max * 0.7) { m.humoT = 16; this.lanzar('humo', [m.x, m.y + 1.5, m.z], this.lob([m.x, m.y + 1.5, m.z], [m.x + dx / L * 6, 0, m.z + dz / L * 6], 0.6), m); }
        }
      } else {
        m.estado = m.recT > 0 ? 3 : 0;
        // sin nadie a la vista: van a buscar a los jugadores (o vuelven a su puesto)
        if (!T.fija && !T.quieto) {
          let meta = m.ultimo;
          if (!meta) { const H = this.list().filter(p => p.alive); if (H.length && Math.random() < 0.004) { const h = H[(Math.random() * H.length) | 0]; m.ultimo = [h.x, h.z]; } meta = m.puesto; }
          if (meta && Math.hypot(meta[0] - m.x, meta[1] - m.z) > 1.5) {
            m.pathT -= dt; if (m.pathT <= 0 || !m.paso) { m.pathT = 0.5; m.paso = W.rumbo(M, m.x, m.z, meta[0], meta[1]); }
            if (m.paso) { const ex = m.paso[0] - m.x, ez = m.paso[1] - m.z, l = Math.hypot(ex, ez) || 1; mx = ex / l * 0.7; mz = ez / l * 0.7; quiere = Math.atan2(-ex, -ez); }
          } else if (meta === m.ultimo) m.ultimo = null;
        }
      }
      // girar
      let dr = quiere - m.ry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
      const giro = (T.fija ? 2.4 : 4.5) * dt; m.ry += Math.max(-giro, Math.min(giro, dr)); m.rx += Math.max(-giro, Math.min(giro, quiereRx - m.rx));
      if (T.fija) return;
      // agacharse para cubrirse (recargando o de a ratos)
      const agacha = m.recT > 0 || (m.tgt && m.agachado && !T.escudo);
      const L = Math.hypot(mx, mz), k = T.vel / W.F.SPEED * (agacha ? 0.55 : 1);
      if (L > 1) { mx /= L; mz /= L; }
      const s = m.s, ox = s.x, oz = s.z;
      W.mover(M, s, { mx: mx * k, mz: mz * k, jump: false, crouch: agacha, aim: false }, dt);
      W.liberar(M, s);
      if (L > 0.3 && Math.hypot(s.x - ox, s.z - oz) < dt * 0.4) { m.trabado = (m.trabado || 0) + dt; if (m.trabado > 0.6) { m.trabado = 0; m.paso = null; m.lado = -(m.lado || 1); if (s.ground) s.vy = W.F.JUMP * 0.8; } } else m.trabado = 0;
      m.x = s.x; m.y = s.y; m.z = s.z; m.crouch = s.crouch;
    };
    P.mercTiro = function (m, T, ojo, t, ty) {
      const M = this.M, dx = t.x - ojo[0], dy = ty - ojo[1], dz = t.z - ojo[2], L = Math.hypot(dx, dy, dz) || 1;
      const d0 = [dx / L, dy / L, dz / L];
      const mov = t.zombi || t.esCamion ? 0.8 : 1 + Math.min(1, Math.hypot(t.vx || 0, t.vz || 0) / 6);
      const d = W.desvio(d0, T.err * (m.crouch ? 0.8 : 1) * (0.6 + Math.min(1, L / 30)) * mov);
      const tw = W.rayMundo(M, ojo, d, T.rango + 6);
      const cuerpos = [];
      for (const p of this.players.values()) if (p.alive) cuerpos.push(p);
      for (const z of this.zombis.values()) if (z.alive) cuerpos.push(z);
      const h = W.rayCuerpos(cuerpos, ojo, d, tw);
      let fin = h ? h.t : tw;
      if (t.esCamion && !h && Math.random() < 0.7) { t.hp -= T.dmg * 0.5; fin = L; }
      this.all({ t: 'fx', id: m.id, w: T.w, o: ojo.map(r2), e: [[r2(ojo[0] + d[0] * fin), r2(ojo[1] + d[1] * fin), r2(ojo[2] + d[2] * fin)]] });
      if (this.camp) this.camp.ruido += 0.6;
      if (h) {
        const q = this.players.get(h.id) || this.zombis.get(h.id);
        if (q) { const caida = L > T.rango * 0.6 && T.w !== 'franco' ? 0.7 : 1; this.hurt(q, T.dmg * (h.head ? 1.7 : 1) * caida, m, h.head, T.w); }
      }
    };
    P.matarMerc = function (m, a, w, head) {
      if (!m.alive) return;
      m.alive = false; m.deadAt = Date.now(); m.estado = 2;
      this.campDrop(m);
      if (a && !a.zombi && !a.merc && a.k != null) { a.k++; a.streak++; }
      this.all({ t: 'kill', a: a ? a.id : null, v: m.id, w: w === 'hack' ? 'hack' : w, h: !!head, s: a && a.streak ? a.streak : 0, vn: MT[m.tipo].n });
      if (m.tipo === 'comandante') this.sys('🎖️ ¡Cayó el comandante!');
      this.broadcastState();
    };

    // ---------- el camión blindado ----------
    P.camionTick = function (dt, now) {
      const k = this.camp.camion, f = this.camp.f;
      if (f.tipo !== 'escoltar' || k.i >= k.ruta.length) return;
      const H = this.list().filter(p => p.alive);
      const cerca = H.some(p => !p.bot && Math.hypot(p.x - k.x, p.z - k.z) < 14) || (!this.humans().some(p => p.alive) && H.length);
      let amenaza = false; for (const z of this.zombis.values()) if (z.alive && Math.hypot(z.x - k.x, z.z - k.z) < 4) amenaza = true;
      // bloqueo todavía cerrado adelante
      const bloq = this.camp.puntos.find(pt => !pt.ok && Math.hypot(pt.antes[0] - k.x, pt.antes[1] - k.z) < 1.2);
      k.parado = !cerca || amenaza || !!bloq;
      if (k.parado) return;
      const meta = k.ruta[k.i], dx = meta[0] - k.x, dz = meta[1] - k.z, d = Math.hypot(dx, dz);
      const v = 2.6 * dt;
      // no pasarse de un bloqueo
      const prox = this.camp.puntos.find(pt => !pt.ok);
      if (prox) { const da = Math.hypot(prox.antes[0] - k.x, prox.antes[1] - k.z); if (da < v + 0.05 && (prox.antes[1] - k.z) * dz >= 0) { k.x = prox.antes[0]; k.z = prox.antes[1]; return; } }
      if (d <= v) { k.x = meta[0]; k.z = meta[1]; k.i++; return; }
      k.x += dx / d * v; k.z += dz / d * v; k.ry = Math.atan2(-dx, -dz);
    };

    // ---------- el jefe: Proyecto Teju Jagua ----------
    P.nuevoJefe = function (x, z) {
      const n = Math.max(1, this.players.size), hp = 5200 * (0.55 + 0.18 * n);
      const j = this.zombiEn('teju', [x, 0, z], 1, false);
      j.hp = j.max = hp; j.alto = 4.4; j.ancho = 1.25; j.cabR = 0.8; j.expHasta = 0;
      j.golpeT = 1.5; j.cargaT = 6; j.acidoT = 5; j.rugeT = 18; j.carga = 0;
      this.camp.jefe = j;
    };
    P.tejuTick = function (z, dt, now) {
      if (!z.alive) return;
      const M = this.M, s = z.s;
      if (now < z.expHasta) { z.estado = 4; W.mover(M, s, { mx: 0, mz: 0, jump: false, crouch: false, aim: false }, dt); z.x = s.x; z.y = s.y; z.z = s.z; return; }
      let t = null, bd = 1e9;
      for (const p of this.players.values()) if (p.alive) { const d = Math.hypot(p.x - z.x, p.z - z.z); if (d < bd) { bd = d; t = p; } }
      if (!t) { z.estado = 0; return; }
      const dx = t.x - z.x, dz = t.z - z.z, d = Math.hypot(dx, dz) || 1, furia = z.hp < z.max * 0.4;
      let mx = 0, mz = 0;
      if (z.carga > 0) {
        z.carga -= dt; z.estado = 5;
        mx = z.cdir[0] * 1.8; mz = z.cdir[1] * 1.8;
        for (const p of this.players.values()) if (p.alive && !z.pegados.has(p.id) && Math.hypot(p.x - z.x, p.z - z.z) < 2.6) { z.pegados.add(p.id); this.danarJugador(p, 34, z, 'zombi', now, z); }
      } else if (d < 4.4) {
        z.estado = 1; z.ry = Math.atan2(-dx, -dz);
        z.golpeT -= dt;
        if (z.golpeT <= 0) {
          z.golpeT = furia ? 1.3 : 1.8;
          this.all({ t: 'jefe', ev: 'golpe', x: r2(z.x), z: r2(z.z) });
          for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - z.x, p.z - z.z) < 4.8) this.danarJugador(p, 26, z, 'zombi', now, z);
          for (const m of this.mercs.values()) if (m.alive && Math.hypot(m.x - z.x, m.z - z.z) < 4.8) this.hurt(m, 60, z, false, 'zombi');
        }
      } else {
        z.estado = 0;
        z.pathT -= dt; if (z.pathT <= 0 || !z.paso) { z.pathT = 0.4; z.paso = W.rumbo(M, z.x, z.z, t.x, t.z); }
        const g = z.paso || [t.x, t.z], ex = g[0] - z.x, ez = g[1] - z.z, l = Math.hypot(ex, ez) || 1, k = (furia ? 3.6 : 2.6) / W.F.SPEED;
        mx = ex / l * k; mz = ez / l * k;
        let dr = Math.atan2(-ex, -ez) - z.ry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
        z.ry += Math.max(-3 * dt, Math.min(3 * dt, dr));
        // embestida
        z.cargaT -= dt;
        if (z.cargaT <= 0 && d > 7 && d < 26) { z.cargaT = furia ? 7 : 10; z.carga = 1.25; z.cdir = [dx / d, dz / d]; z.pegados = new Set(); z.ry = Math.atan2(-dx, -dz); this.all({ t: 'jefe', ev: 'carga' }); }
      }
      // ácido en abanico y rugido que llama a más zombis
      z.acidoT -= dt;
      if (z.acidoT <= 0 && d > 5 && d < 30) {
        z.acidoT = furia ? 4.5 : 6.5;
        const boca = [z.x, z.y + 3.8, z.z];
        for (let i = -1; i <= 1; i++) this.lanzar('acido', boca, this.lob(boca, [t.x + dz / d * i * 2.5, t.y + 0.3, t.z - dx / d * i * 2.5], 0.5), z);
        this.all({ t: 'escupe', id: z.id });
      }
      z.rugeT -= dt;
      if (z.rugeT <= 0) { z.rugeT = furia ? 16 : 22; this.all({ t: 'jefe', ev: 'ruge' }); for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; this.zombiEn('zombi', [z.x + Math.cos(a) * 6, 0, z.z + Math.sin(a) * 6], 1.6, Math.random() < 0.5); } }
      W.mover(M, s, { mx, mz, jump: false, crouch: false, aim: false }, dt);
      W.liberar(M, s);
      z.x = s.x; z.y = s.y; z.z = s.z; z.vel = Math.hypot(mx, mz) * W.F.SPEED;
    };

    // ---------- a quién persigue cada zombi en la campaña ----------
    P.campZObj = function (z) {
      const c = this.camp;
      // granada de ruido: van todos para ahí
      for (const a of this.areas) if (a.tipo === 'ruido' && Math.hypot(a.x - z.x, a.z - z.z) < 42) {
        if (Math.hypot(a.x - z.x, a.z - z.z) > 3) return { x: a.x, y: 0, z: a.z, alive: true, ruido: true };
        let t = null, bd = 9;
        for (const m of this.mercs.values()) if (m.alive && m.tipo !== 'torreta') { const d = Math.hypot(m.x - z.x, m.z - z.z); if (d < bd) { bd = d; t = m; } }
        for (const p of this.players.values()) if (p.alive) { const d = Math.hypot(p.x - z.x, p.z - z.z); if (d < bd) { bd = d; t = p; } }
        if (t) return t;
      }
      let t = null, bd = 1e9;
      for (const p of this.players.values()) if (p.alive) { const d = Math.hypot(p.x - z.x, p.z - z.z) + Math.abs(p.y - z.y) * 2; if (d < bd) { bd = d; t = p; } }
      for (const m of this.mercs.values()) if (m.alive && m.tipo !== 'torreta') { const d = Math.hypot(m.x - z.x, m.z - z.z) * 1.15; if (d < bd) { bd = d; t = m; } }
      if (c.camion && c.camion.hp > 0) { const d = Math.hypot(c.camion.x - z.x, c.camion.z - z.z); if (d < Math.min(bd, 12)) { bd = d; t = c.camion; } }
      if (c.puerta && c.puerta.hp > 0) { const d = Math.hypot(c.puerta.x - z.x, c.puerta.z - z.z); if (bd > 7 || d < bd) t = c.puerta; }
      return t;
    };
    P.campMorder = function (t, z, now) {
      if (t.ruido) return;
      if (t.esPuerta || t.esCamion) { t.hp -= z.dmg * (t.esPuerta ? 0.6 : 1); this.all({ t: 'muerde', id: z.id }); return; }
      if (t.merc) { this.hurt(t, z.dmg * 1.5, z, false, 'zombi'); this.all({ t: 'muerde', id: z.id }); }
    };
    // el zombi verde que explota
    P.zExplota = function (z) {
      if (z.exploto) return; z.exploto = true;
      z.alive = false; z.deadAt = Date.now(); z.estado = 2;
      this.all({ t: 'boom', x: r2(z.x), y: r2(z.y + 0.6), z: r2(z.z), verde: 1 });
      this.danoArea(z.x, z.y + 0.6, z.z, 4.5, 55, z, 'explosivo', true);
    };
    P.danoArea = function (x, y, z, r, max, dueno, w, aJugadores) {
      const now = Date.now();
      for (const q of this.zombis.values()) { if (!q.alive || q === dueno) continue; const d = Math.hypot(q.x - x, q.y + 0.8 - y, q.z - z); if (d < r) this.hurt(q, max * 2 * (1 - d / r), dueno, false, w); }
      for (const m of this.mercs.values()) { if (!m.alive) continue; const d = Math.hypot(m.x - x, m.y + 0.9 - y, m.z - z); if (d < r) this.hurt(m, max * 1.6 * (1 - d / r), dueno, false, w); }
      if (aJugadores) for (const p of this.players.values()) { if (!p.alive) continue; const d = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z); if (d < r && W.seVe(this.M, [x, y + 0.2, z], [p.x, p.y + 1, p.z])) this.danarJugador(p, max * (1 - d / r * 0.6), dueno && dueno.zombi ? dueno : null, w, now, { x, z }); }
      const c = this.camp; if (c && c.camion && Math.hypot(c.camion.x - x, c.camion.z - z) < r + 1.5) c.camion.hp -= max;
    };

    // ---------- dificultad: mochila, botiquines y cosas tiradas en el suelo ----------
    // fácil: como siempre (balas sin fin y la vida se cura sola)
    // normal: balas contadas (hasta 3 cargadores de cada arma), granadas y molotov hasta 3, botiquines hasta 2;
    //         la vida no se cura sola: hay que encontrar botiquines
    // difícil: igual, pero con muy pocas cosas en el suelo; sin balas queda el cuchillo
    const KIT = { normal: { prim: 1, pis: 1, gr: 1, mo: 0, bq: 1 }, dificil: { prim: 0, pis: 0, gr: 0, mo: 0, bq: 0 } };
    const CANT = { normal: { balas: 13, botiquin: 5, granada: 4, molotov: 3 }, dificil: { balas: 6, botiquin: 2, granada: 1, molotov: 1 } };
    const TIPOS_I = ['balas', 'botiquin', 'granada', 'molotov'];
    P.difCamp = function () { return this.camp && this.settings.dif && this.settings.dif !== 'facil' ? this.settings.dif : null; };
    P.campKit = function (p) {
      const d = this.difCamp(); if (!d || p.bot) { p.res = null; p.botiq = 0; return; }
      const k = KIT[d];
      p.res = { [p.prim]: A[p.prim].mag * k.prim, pistola: A.pistola.mag * k.pis };
      p.granadas = k.gr; p.molotov = k.mo; p.botiq = k.bq;
    };
    P.campItems = function () {
      const c = this.camp, d = this.difCamp(), M = this.M; c.items = new Map(); c.vuelven = []; c.iVer = (c.iVer || 0) + 1;
      if (!d) return;
      const N = NIVELES[c.nivel], cps = N.fases.map(f => f.cp);
      for (const tipo of TIPOS_I) {
        for (let i = 0; i < CANT[d][tipo]; i++) {
          let p;
          // la mitad cerca de los puntos de control (para poder seguir), el resto repartido
          if (i % 2 === 0) { const cp = cps[(i / 2) % cps.length | 0]; const q = this.libreCerca(cp[0] + (Math.random() - 0.5) * 10, cp[1] + (Math.random() - 0.5) * 10); p = [q[0], 0, q[1]]; }
          else p = W.puntoLibre(M);
          this.nuevoItem(tipo, p[0], p[2], true);
        }
      }
    };
    P.nuevoItem = function (tipo, x, z, fijo) {
      const c = this.camp; if (!c.items) c.items = new Map();
      const id = 'i' + (++this.pc); c.items.set(id, { id, tipo, x, y: W.piso(this.M, x, z, 1.5), z, fijo: !!fijo }); c.iVer = (c.iVer || 0) + 1;
    };
    // lo que dejan los enemigos al caer
    P.campDrop = function (e) {
      const d = this.difCamp(); if (!d) return;
      const r = Math.random(), dif = d === 'dificil';
      if (e.merc) {
        if (e.tipo === 'torreta') return;
        if (e.tipo === 'comandante') { this.nuevoItem('botiquin', e.x + 0.6, e.z); this.nuevoItem('balas', e.x - 0.6, e.z); return; }
        if (r < (dif ? 0.35 : 0.6)) this.nuevoItem('balas', e.x, e.z);
        else if (r < (dif ? 0.4 : 0.7)) this.nuevoItem(Math.random() < 0.5 ? 'granada' : 'botiquin', e.x, e.z);
      } else if (e.tipo !== 'teju' && e.tipo !== 'explosivo') {
        if (r < (dif ? 0.03 : 0.06)) this.nuevoItem('balas', e.x, e.z);
        else if (r < (dif ? 0.04 : 0.085)) this.nuevoItem('botiquin', e.x, e.z);
      }
    };
    P.itemsTick = function () {
      const c = this.camp;
      if (c.vuelven && c.vuelven.length) { const now = Date.now(); c.vuelven = c.vuelven.filter(v => { if (now < v.at) return true; this.nuevoItem(v.tipo, v.x, v.z, true); return false; }); }
      if (!c.items || !c.items.size) return;
      for (const p of this.players.values()) {
        if (!p.alive || p.bot || !p.res) continue;
        for (const it of c.items.values()) {
          if (Math.hypot(it.x - p.x, it.z - p.z) > 1.4 || Math.abs(it.y - p.y) > 1.6) continue;
          let ok = false;
          if (it.tipo === 'balas') {
            for (const w of [p.prim, 'pistola']) { const cap = A[w].mag * 3, v = p.res[w] | 0; if (v < cap) { p.res[w] = Math.min(cap, v + A[w].mag); ok = true; } }
          } else if (it.tipo === 'botiquin') { if ((p.botiq | 0) < 2) { p.botiq = (p.botiq | 0) + 1; ok = true; } }
          else if (it.tipo === 'granada') { if ((p.granadas | 0) < 3) { p.granadas++; ok = true; } }
          else if (it.tipo === 'molotov') { if ((p.molotov | 0) < 3) { p.molotov++; ok = true; } }
          if (!ok) continue;
          c.items.delete(it.id); c.iVer++;
          if (it.fijo && it.tipo === 'balas' && this.difCamp() === 'normal') (c.vuelven = c.vuelven || []).push({ tipo: 'balas', x: it.x, z: it.z, at: Date.now() + 120000 });
          this.to(p.id, { t: 'item', tipo: it.tipo, res: p.res });
          this.broadcastState();
          break;
        }
      }
    };
    P.recargo = function (p, m) {
      if (!p.res || !A[m.w] || m.w === 'cuchillo') return;
      p.res[m.w] = Math.max(0, (p.res[m.w] | 0) - Math.max(0, Math.min(A[m.w].mag, m.n | 0)));
    };
    P.curar = function (p) {
      if (!p.alive || !p.res || (p.botiq | 0) <= 0 || p.hp >= 100) return;
      p.botiq--; p.hp = Math.min(100, p.hp + 60);
      this.to(p.id, { t: 'curado', hp: Math.round(p.hp) });
      this.broadcastState();
    };

    // ---------- adónde van los bots compañeros ----------
    P.campMeta = function (p) {
      const c = this.camp, f = c.f; if (!f) return [p.x, p.z];
      const H = this.humans().filter(q => q.alive);
      const lejos = H.length && H.every(q => Math.hypot(q.x - p.x, q.z - p.z) > 20);
      const cerca = pts => { let b = null, bd = 1e9; for (const q of pts) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; b = q; } } return b; };
      if (f.tipo === 'jefe') {
        const bots = this.list().filter(q => q.bot && q.alive), i = bots.indexOf(p);
        const libres = c.puntos.filter(q => Date.now() >= q.cd);
        if (i >= 0 && i < 2 && libres.length) { const q = libres[i % libres.length]; return [q.x, q.z]; }
        if (c.jefe) { const a = Math.random() * 6.28; return [c.jefe.x + Math.cos(a) * 10, c.jefe.z + Math.sin(a) * 10]; }
      }
      if (lejos) { const q = H[(Math.random() * H.length) | 0]; return [q.x + (Math.random() - 0.5) * 4, q.z + (Math.random() - 0.5) * 4]; }
      if ((f.tipo === 'activar' || f.tipo === 'escoltar') && c.puntos.some(q => !q.ok)) {
        const q = cerca(c.puntos.filter(q => !q.ok));
        if (f.tipo === 'activar' || Math.hypot(c.camion.x - q.antes[0], c.camion.z - q.antes[1]) < 12) return [q.x, q.z];
      }
      if (f.tipo === 'escoltar' && c.camion) return [c.camion.x + (Math.random() - 0.5) * 6, c.camion.z + (Math.random() - 0.5) * 6];
      if (f.tipo === 'aguantar' && c.puerta) return [c.puerta.x + (Math.random() - 0.5) * 8, c.puerta.z + 4 + Math.random() * 4];
      if (f.tipo === 'aguantar' && f.defiende && c.camion) return [c.camion.x + (Math.random() - 0.5) * 8, c.camion.z + (Math.random() - 0.5) * 8];
      if (f.zona) return [f.zona[0] + (Math.random() - 0.5) * f.zona[2], f.zona[1] + (Math.random() - 0.5) * f.zona[2]];
      if (f.tipo === 'matar') { const m = cerca([...this.mercs.values()].filter(m => m.alive)); if (m) return [m.x, m.z]; }
      if (H.length) { const q = H[0]; return [q.x, q.z]; }
      return [p.x, p.z];
    };

    // ---------- lo que se manda a todos 20 veces por segundo ----------
    P.campSnap = function (now) {
      const c = this.camp, f = c.f || {};
      const o = {
        M: [...this.mercs.values()].map(m => [m.id, TIPOS_M.indexOf(m.tipo), r2(m.x), r2(m.y), r2(m.z), r2(m.ry), m.alive ? m.estado : 2, m.crouch ? 1 : 0, r2(m.rx), m.alive ? Math.ceil(m.hp / m.max * 100) : 0, m.hack ? r2(m.hack / 3) : 0]),
        C: [c.nivel, c.fase, r2(c.prog || 0), c.puntos.map(p => p.ok && (f.tipo !== 'jefe' || now - p.ok < 8000) ? -1 : now < p.cd ? -2 : r2(p.prog / (f.tipo === 'escoltar' ? 3 : f.seg || 1))), f.seg ? Math.max(0, Math.ceil(f.seg - c.t)) : 0, c.estado === 'juego' ? 0 : c.estado === 'falla' ? 1 : c.estado === 'fin' ? 2 : 3,
          c.puerta ? Math.max(0, Math.round(c.puerta.hp / c.puerta.max * 100)) : -1, c.jefe ? Math.max(0, Math.round(c.jefe.hp / c.jefe.max * 100)) : -1, c.jefe && now < c.jefe.expHasta ? Math.ceil((c.jefe.expHasta - now) / 1000) : 0],
      };
      if (c.items && (c.iEnv !== c.iVer || now - (c.iT || 0) > 2000)) { c.iEnv = c.iVer; c.iT = now; o.I = [...c.items.values()].map(it => [it.id, TIPOS_I.indexOf(it.tipo), r2(it.x), r2(it.y), r2(it.z)]); }
      if (c.camion) o.K = [r2(c.camion.x), r2(c.camion.z), r2(c.camion.ry), Math.max(0, Math.round(c.camion.hp / c.camion.max * 100)), c.camion.parado ? 1 : 0];
      return o;
    };
  }

  G.TiroCampana = { NIVELES, MT, TIPOS_M, TIPOS_I: ['balas', 'botiquin', 'granada', 'molotov'], instalar };
})(typeof window !== 'undefined' ? window : globalThis);
