'use strict';
/* =====================================================================
   El Impostor — banco de palabras por categoría.
   Cada palabra trae: una "parecida" (la pista para el impostor o la palabra
   del modo encubierto) y varias palabras relacionadas que usan los bots
   para dar pistas, sospechar y adivinar.
   Formato de cada línea:  Palabra | Parecida | pista, pista, pista…
   ===================================================================== */
const CATS = {
  py:        {n:'Cosas paraguayas', e:'🇵🇾', gen:['tradición','nuestro','orgullo','abuela','campo','guaraní','fiesta','pueblo','historia','típico']},
  comida:    {n:'Comidas y bebidas', e:'🍲', gen:['rico','cocina','plato','sabor','almuerzo','merienda','olla','receta','hambre','mesa']},
  lugar:     {n:'Lugares', e:'📍', gen:['gente','ir','lejos','edificio','visitar','paseo','ciudad','afuera','entrar','grande']},
  animal:    {n:'Animales', e:'🐾', gen:['patas','pelo','salvaje','come','monte','cría','ruido','naturaleza','corre','zoológico']},
  objeto:    {n:'Objetos', e:'🧰', gen:['usar','casa','mano','útil','plástico','guardar','cajón','comprar','metal','herramienta']},
  profesion: {n:'Profesiones', e:'👷', gen:['trabajo','sueldo','uniforme','estudio','oficio','horario','jefe','ayuda','servicio','gente']},
  deporte:   {n:'Deportes y juegos', e:'⚽', gen:['jugar','equipo','ganar','cancha','pelota','partido','entrenar','punto','competir','reglas']},
  natural:   {n:'Naturaleza y clima', e:'🌳', gen:['afuera','cielo','verde','agua','tiempo','campo','calor','frío','planta','aire']},
};
const WORD_SRC = {
py: `Tereré|Mate|guampa,bombilla,yuyo,agua fría,calor,termo,ronda,menta,limón,yerba
Chipa|Mbejú|almidón,queso,anís,horno,Semana Santa,canasta,caliente,mandioca,chipera,rosca
Sopa paraguaya|Chipa guasu|maíz,queso,cebolla,horno,sólida,asado,harina,leche,huevo,cuadrado
Itaipú|Yacyretá|represa,energía,Brasil,río Paraná,turbina,luz,Hernandarias,agua,enorme,binacional
Ñandutí|Ao po'i|tejido,Itauguá,telaraña,colores,encaje,artesanía,hilo,círculo,bordado,mantel
Arpa paraguaya|Guitarra|música,cuerdas,Pájaro Campana,madera,polca,Félix Pérez Cardozo,tocar,instrumento,folclore,dedos
Guarania|Polca paraguaya|música,José Asunción Flores,lenta,canción,India,nostalgia,romántica,orquesta,folclore,melodía
Pombero|Luisón|leyenda,siesta,monte,silbido,mito,tabaco,miel,petiso,noche,susto
Kurupí|Pombero|leyenda,mito,monte,siesta,susto,campo,personaje,feo,cuento,abuela
Mbejú|Chipa|almidón,queso,sartén,mandioca,grasa,desayuno,cocido,redondo,crocante,tortilla
Chipa guasu|Sopa paraguaya|choclo,queso,horno,maíz,cebolla,huevo,fuente,cremoso,asado,leche
Vori vori|Locro|bolitas,caldo,maíz,queso,gallina,invierno,sopa,caliente,harina,olla
Cocido|Mate cocido|yerba,azúcar,quemado,brasa,leche,desayuno,taza,caliente,merienda,chipa
Lapacho|Ybyrá pytã|árbol,flores,rosado,primavera,madera,calles,amarillo,invierno,lindo,té
Guaraní|Castellano|idioma,hablar,jopara,ñe'ẽ,lengua,oficial,palabra,che,nde,escuela
San Juan|Kambá ra'anga|fiesta,junio,fuego,pelota tata,toro candil,juegos,brasas,kure,yerba,saltar
Caacupé|Luque|Virgen,peregrinación,diciembre,basílica,caminar,promesa,cordillera,fe,iglesia,8 de diciembre
Ao po'i|Ñandutí|tela,bordado,Yataity,camisa,algodón,Guairá,blanco,artesanía,hilo,fino
Chamamé|Polca paraguaya|acordeón,baile,música,litoral,sapucai,pareja,Argentina,fiesta,guitarra,folclore
Karu guasu|Asado|comida,mucho,banquete,fiesta,familia,carne,mesa,abundante,comer,invitados
Cerro Corá|Humaitá|batalla,Mariscal López,1870,guerra,Amambay,parque,héroe,historia,1 de marzo,Pedro Juan
Panambí|Mariposa|alas,colores,vuela,flor,insecto,Asunción,jardín,primavera,guaraní,bonita
Jopara|Guaraní|mezcla,idioma,hablar,castellano,palabras,calle,mitad,lengua,mezclado,todos`,
comida: `Asado|Parrillada|carne,brasa,domingo,costilla,parrilla,fuego,chorizo,sal,amigos,carbón
Empanada|Pastel mandi'o|masa,carne,horno,frita,relleno,jamón,queso,mano,doblada,merienda
Milanesa|Escalope|pan rallado,frita,huevo,carne,pollo,limón,puré,napolitana,sándwich,aceite
Pizza|Lomito|masa,queso,horno,porción,tomate,muzzarella,delivery,redonda,italiana,pepperoni
Hamburguesa|Lomito|pan,carne,queso,papas,lechuga,tomate,rápida,mostaza,doble,comida rápida
Mandioca|Batata|raíz,hervida,blanca,almidón,asado,frita,planta,cocinar,tubérculo,campo
Sandía|Melón|verano,roja,semillas,agua,verde,fruta,grande,dulce,rodaja,fresca
Mango|Mamón|fruta,amarillo,árbol,dulce,verano,carozo,jugoso,patio,pelar,lleno
Chicharõ|Chicharrón|cerdo,frito,grasa,crocante,piel,trenzado,asado,salado,carne,picada
Dulce de leche|Leche condensada|leche,azúcar,cuchara,dulce,postre,torta,marrón,frasco,alfajor,untar
Helado|Paleta|frío,crema,verano,cucurucho,palito,sabores,chocolate,vainilla,derretir,heladería
Café|Té|taza,negro,mañana,azúcar,leche,despertar,granos,caliente,cafetera,amargo
Arroz|Fideo|grano,blanco,olla,guiso,comida,agua,sal,plato,cocinar,chino
Pan|Galleta|horno,panadería,harina,mañana,caliente,miga,manteca,sándwich,tostado,levadura
Huevo|Tortilla|gallina,frito,cáscara,yema,clara,duro,desayuno,docena,blanco,romper
Queso Paraguay|Requesón|leche,blanco,chipa,sopa,salado,campo,fresco,vaca,mbejú,rallado
Mbaipy|Polenta|maíz,harina,olla,caldo,pollo,amarillo,cremoso,campo,carne,espeso
Torta|Bizcocho|cumpleaños,velas,crema,horno,dulce,porción,chocolate,fiesta,decorada,harina
Pollo|Gallina|ave,asado,alas,muslo,frito,horno,blanco,pechuga,plumas,carne
Chocolate|Cacao|dulce,marrón,barra,tableta,leche,amargo,regalo,derretir,postre,golosina
Coca-cola|Gaseosa|bebida,burbujas,negra,botella,lata,fría,dulce,gas,hielo,refresco
Cerveza|Vino|bebida,fría,botella,amigos,espuma,alcohol,lata,cebada,rubia,brindis
Ensalada|Verdura|lechuga,tomate,cebolla,aceite,sal,fresca,plato,verde,sana,vinagre`,
lugar: `Escuela|Colegio|maestra,recreo,niños,aula,pizarra,uniforme,mochila,timbre,cuaderno,aprender
Hospital|Sanatorio|médico,enfermos,camilla,emergencia,enfermera,remedio,cama,ambulancia,blanco,sala
Mercado 4|Shopping|compras,puestos,barato,gente,Asunción,verdura,regatear,ropa,ruido,comerciantes
Supermercado|Despensa|carrito,góndola,caja,compras,ofertas,cola,precios,bolsas,leche,changuito
Playa|Río|arena,sol,agua,verano,malla,olas,bronceador,sombrilla,vacaciones,nadar
Cementerio|Iglesia|muertos,tumbas,flores,silencio,cruz,noche,lápida,velas,fantasma,entierro
Aeropuerto|Terminal|aviones,viaje,pasaporte,valija,vuelo,pista,despegar,Luque,embarque,piloto
Terminal de ómnibus|Aeropuerto|colectivo,pasaje,viaje,valija,andén,interior,boletería,espera,parada,chofer
Iglesia|Capilla|misa,cura,cruz,santo,rezar,domingo,campana,bautismo,boda,bancos
Estadio|Cancha|fútbol,hinchas,partido,gol,tribuna,entrada,gradas,Defensores del Chaco,grito,camiseta
Cárcel|Comisaría|presos,rejas,celda,policía,guardia,condena,Tacumbú,delito,encerrado,juez
Banco|Cajero|plata,cuenta,cola,cajero,préstamo,tarjeta,depósito,ventanilla,billetes,seguridad
Farmacia|Hospital|remedios,pastillas,receta,farmacéutico,jarabe,venta,salud,turno,curita,vitaminas
Peluquería|Barbería|corte,pelo,tijera,secador,tintura,espejo,peinado,silla,lavar,flequillo
Gimnasio|Club|pesas,ejercicio,músculos,sudor,entrenador,cinta,fuerza,rutina,máquinas,dieta
Biblioteca|Librería|libros,silencio,leer,estantes,préstamo,estudiar,mesa,bibliotecaria,páginas,biblioteca
Zoológico|Granja|animales,jaulas,leones,visitar,niños,elefante,cuidador,entrada,paseo,mono
Cine|Teatro|película,pantalla,pochoclo,butacas,oscuro,entrada,estreno,sala,3D,actor
Costanera|Plaza|río,caminar,Asunción,paseo,atardecer,bicicleta,correr,orilla,vista,tereré
Chaco|Desierto|calor,menonitas,ruta,lejos,Transchaco,seco,polvo,Filadelfia,guerra,quebracho
Encarnación|Ciudad del Este|carnaval,playa,Itapúa,puente,Posadas,costanera,Perla del Sur,verano,San José,frontera
Ciudad del Este|Encarnación|compras,frontera,Puente de la Amistad,electrónicos,Alto Paraná,Brasil,Foz,comercio,Itaipú,tráfico
Plaza|Parque|bancos,árboles,niños,hamacas,palomas,paseo,pasto,tobogán,fuente,centro`,
animal: `Yacaré|Cocodrilo|río,dientes,escamas,pantano,Chaco,reptil,boca,cuero,peligroso,agua
Jaguareté|Puma|felino,manchas,monte,selva,peligro,tigre,cazador,Chaco,uñas,rugido
Carpincho|Capibara|roedor,río,grande,agua,pasto,tranquilo,ciénaga,gordo,familia,orilla
Tucán|Loro|pico,colores,ave,naranja,selva,frutas,grande,negro,árbol,plumas
Mono|Gorila|banana,árbol,colgarse,cola,selva,trepar,gracioso,zoológico,saltar,peludo
Perro|Gato|ladra,mascota,hueso,cola,fiel,cucha,correa,cachorro,guau,patas
Gato|Perro|maúlla,mascota,bigotes,ronronea,uñas,ratón,miau,siesta,leche,techo
Vaca|Toro|leche,campo,muu,cuernos,pasto,carne,ordeñar,manchas,estancia,ternero
Caballo|Burro|galope,montar,herradura,crin,jinete,relincha,silla,campo,carreta,potro
Gallina|Pato|huevos,cacarea,pico,plumas,gallo,pollito,maíz,gallinero,ave,patio
Serpiente|Lagarto|víbora,veneno,arrastrarse,escamas,mordida,monte,cascabel,larga,lengua,miedo
Ñandú|Avestruz|ave,corre,plumas,Chaco,huevos,patas largas,campo,no vuela,cuello,grande
Tatú|Armadillo|caparazón,cavar,cueva,noche,bolita,monte,escamas,tierra,hormigas,pequeño
Mbói|Serpiente|víbora,guaraní,veneno,monte,arrastrarse,larga,miedo,mordida,campo,escamas
Rana|Sapo|verde,salta,laguna,croa,lluvia,lengua,mosca,anfibio,charco,renacuajo
Elefante|Rinoceronte|trompa,grande,gris,colmillos,orejas,África,pesado,memoria,manada,zoológico
León|Tigre|melena,rey,selva,rugido,África,felino,cazar,manada,garras,zoológico
Abeja|Avispa|miel,picadura,colmena,flores,zumbido,amarilla,reina,panal,polen,insecto
Mosquito|Mosca|picadura,dengue,zumbido,noche,repelente,sangre,verano,ventilador,charco,molesto
Pez|Delfín|agua,nada,escamas,aletas,pescar,río,branquias,acuario,anzuelo,surubí
Loro|Tucán|habla,verde,plumas,pico,repite,jaula,colores,ave,palabras,mascota
Hormiga|Termita|pequeña,fila,hormiguero,trabajo,azúcar,picadura,colonia,tierra,reina,millones
Búho|Lechuza|noche,ojos,sabio,ave,ulula,árbol,cazador,plumas,cabeza gira,oscuridad`,
objeto: `Celular|Tablet|llamar,pantalla,mensajes,batería,WhatsApp,cargador,fotos,táctil,bolsillo,aplicaciones
Guampa|Taza|tereré,bombilla,cuerno,yerba,termo,madera,tomar,ronda,cuero,mate
Termo|Jarra|agua,frío,caliente,tereré,tapa,llevar,hielo,mate,botella,Stanley
Paraguas|Piloto|lluvia,abrir,mojarse,cerrar,mango,tela,tormenta,cubrir,negro,viento
Reloj|Despertador|hora,tiempo,agujas,muñeca,minutos,pila,tic tac,pared,puntual,segundos
Tijera|Cuchillo|cortar,papel,filo,dos hojas,peluquería,manualidades,uñas,pelo,metal,abrir
Llave|Candado|puerta,abrir,cerradura,llavero,auto,casa,perder,metal,cerrar,bolsillo
Espejo|Ventana|reflejo,cara,vidrio,mirarse,baño,peinarse,romper,imagen,maquillaje,pared
Silla|Banco|sentarse,patas,mesa,respaldo,madera,plástico,cuatro,comedor,cómoda,almohadón
Ventilador|Aire acondicionado|calor,aspas,verano,viento,techo,girar,velocidad,enchufe,fresco,ruido
Heladera|Freezer|frío,cocina,hielo,comida,puerta,conservar,leche,eléctrica,blanca,congelado
Televisor|Computadora|pantalla,control remoto,canales,novela,noticias,ver,fútbol,sillón,Netflix,imagen
Mochila|Cartera|espalda,escuela,cuadernos,cierre,llevar,viaje,bolsillos,correas,útiles,carga
Anteojos|Lentes de sol|ver,vista,marco,cristales,óptica,nariz,leer,miope,oculista,graduados
Cepillo de dientes|Peine|dientes,pasta,baño,mañana,cerdas,limpiar,boca,noche,dentista,espuma
Hamaca|Cama|colgar,siesta,descansar,árbol,tela,mecerse,patio,verano,sombra,tejida
Pelota|Globo|redonda,patear,fútbol,jugar,inflar,rebota,cuero,niños,gol,saltar
Vela|Linterna|fuego,luz,cera,cumpleaños,apagón,mecha,iglesia,soplar,derretir,llama
Escoba|Trapeador|barrer,piso,limpiar,polvo,palo,pala,patio,bruja,cerdas,basura
Bicicleta|Moto|pedales,ruedas,cadena,andar,casco,manubrio,frenos,paseo,ejercicio,timbre
Guitarra|Arpa paraguaya|cuerdas,música,tocar,madera,acordes,serenata,púa,canción,fogón,instrumento
Lápiz|Bolígrafo|escribir,dibujar,punta,goma,madera,sacapuntas,papel,escuela,grafito,borrar
Moto|Bicicleta|casco,ruedas,motor,delivery,rápida,nafta,calle,acelerar,ruido,moto taxi`,
profesion: `Médico|Enfermero|hospital,salud,receta,estetoscopio,bata,consulta,paciente,enfermo,curar,doctor
Maestra|Profesor|escuela,alumnos,pizarra,enseñar,clase,tarea,niños,tiza,aula,cuaderno
Policía|Militar|uniforme,patrullera,ladrón,arma,orden,comisaría,silbato,esposas,calle,seguridad
Bombero|Policía|fuego,manguera,incendio,casco,camión,sirena,rescate,agua,valiente,escalera
Chipera|Panadero|chipa,canasta,ruta,ómnibus,vender,caliente,Eusebio Ayala,grito,almidón,mañana
Futbolista|Árbitro|pelota,cancha,gol,camiseta,club,botines,partido,entrenar,hinchas,goleador
Cocinero|Mozo|cocina,ollas,comida,receta,restaurante,gorro,delantal,sabor,cuchillo,chef
Peluquero|Barbero|pelo,tijera,corte,peinado,secador,tintura,peluquería,cliente,espejo,flequillo
Albañil|Carpintero|ladrillo,obra,cemento,construcción,pared,casco,cuchara,mezcla,casa,andamio
Abogado|Juez|ley,juicio,tribunal,defender,cliente,traje,contrato,demanda,justicia,papeles
Dentista|Médico|dientes,muela,boca,consultorio,caries,cepillo,anestesia,sillón,dolor,limpieza
Taxista|Chofer de colectivo|auto,pasajero,calle,viaje,taxímetro,manejar,dirección,Bolt,tráfico,ruta
Agricultor|Ganadero|campo,tierra,semillas,cosecha,tractor,soja,lluvia,sembrar,mandioca,chacra
Payaso|Mago|circo,nariz roja,risa,niños,cumpleaños,peluca,zapatos grandes,globos,maquillaje,chistes
Piloto|Azafata|avión,volar,cabina,aeropuerto,uniforme,viaje,cielo,pasajeros,despegue,capitán
Veterinario|Médico|animales,mascotas,perro,gato,vacuna,clínica,curar,campo,vaca,consulta
Músico|Cantante|instrumento,banda,canción,escenario,tocar,guitarra,ensayo,concierto,notas,arpa
Periodista|Locutor|noticias,micrófono,entrevista,diario,televisión,radio,preguntas,cámara,informar,nota
Carnicero|Cocinero|carne,cuchillo,asado,carnicería,cortes,delantal,vaca,balanza,costilla,picada
Mecánico|Electricista|auto,motor,taller,llave inglesa,aceite,arreglar,grasa,repuestos,rueda,gato
Cantante|Músico|voz,micrófono,canción,escenario,fama,concierto,disco,afinado,público,karaoke
Electricista|Mecánico|cables,luz,enchufe,corriente,ANDE,instalación,peligro,tester,casa,lámpara
Astronauta|Piloto|espacio,cohete,Luna,traje,estrellas,gravedad,nave,planeta,casco,NASA`,
deporte: `Fútbol|Futsal|pelota,gol,cancha,once,arquero,Albirroja,botines,penal,árbitro,Mundial
Vóley|Básquet|red,pelota,saque,remate,arena,playa,bloqueo,seis,mano,punto
Básquet|Vóley|aro,canasta,pelota,alto,triple,rebote,NBA,dribbling,tablero,zapatillas
Tenis|Pádel|raqueta,red,pelota amarilla,saque,cancha,set,Wimbledon,polvo de ladrillo,golpe,raquetazo
Natación|Buceo|agua,piscina,nadar,crol,malla,antiparras,olímpica,carril,brazadas,gorra
Ajedrez|Damas|tablero,rey,reina,jaque mate,piezas,peón,pensar,torre,caballo,blancas
Truco|Escoba de 15|cartas,envido,flor,mentir,pareja,baraja española,quiero,retruco,señas,ancho
Boxeo|Lucha|guantes,ring,golpes,nocaut,round,pelea,cinturón,campana,boxeador,esquina
Ciclismo|Atletismo|bicicleta,pedalear,ruta,casco,carrera,etapa,montaña,velocidad,piernas,vuelta
Karate|Judo|cinturón negro,patada,artes marciales,dojo,kimono,golpe,Japón,defensa,maestro,grito
Rally|Fórmula 1|autos,Transchaco,polvo,velocidad,ruta,copiloto,barro,carrera,motor,curvas
Golf|Mini golf|palo,hoyo,pelota blanca,green,club,swing,campo,bandera,caddie,par
Billar|Pool|taco,bolas,mesa,tiza,troneras,paño verde,bola ocho,golpe,carambola,bar
Dominó|Dados|fichas,puntos,mesa,doble seis,abuelos,pasar,juntar,cerrar,ficha,piezas
Bolos|Billar|pinos,bola,pista,strike,chuza,zapatos,lanzar,carril,diez,tiro
Atletismo|Ciclismo|correr,pista,salto,carrera,maratón,velocidad,lanzamiento,olímpico,meta,zapatillas
Escondidas|Mancha|contar,buscar,niños,juego,piedra libre,esconderse,patio,cerrar ojos,encontrar,correr
Rayuela|Escondidas|tiza,saltar,números,piso,cielo,una pierna,piedrita,cuadros,niñas,patio
Pandorga|Barrilete|viento,hilo,volar,cola,agosto,papel,cielo,cañita,niños,alto
Carrera de embolsados|San Juan|bolsa,saltar,fiesta,niños,San Juan,correr,meta,caer,juego,risa
Pesca|Caza|río,anzuelo,caña,carnada,paciencia,surubí,dorado,lancha,red,orilla`,
natural: `Lluvia|Tormenta|agua,nubes,paraguas,mojado,gotas,charco,cielo,gris,truenos,barro
Tormenta|Lluvia|rayos,truenos,viento,nubes,agua,luz cortada,miedo,granizo,relámpago,cielo
Sol|Luna|calor,día,amarillo,brillo,verano,quemar,cielo,luz,rayos,bronceado
Luna|Sol|noche,cielo,llena,estrellas,lobo,brillo,blanca,cuarto creciente,astronauta,romántica
Arcoíris|Nubes|colores,lluvia,cielo,siete,sol,curva,tesoro,arco,brillante,después
Río Paraguay|Río Paraná|agua,Asunción,barco,costanera,pesca,orilla,bajante,crecida,puerto,corriente
Cataratas del Iguazú|Saltos del Monday|agua,caída,Brasil,Argentina,turismo,ruido,maravilla,arcoíris,selva,enormes
Cerro|Montaña|alto,subir,piedras,vista,cima,caminata,Lambaré,Ñemby,verde,naturaleza
Selva|Bosque|árboles,animales,verde,húmeda,lianas,monos,lluvia,densa,tropical,jaguar
Desierto|Chaco|arena,calor,seco,cactus,camello,dunas,sed,sol,oasis,vacío
Nieve|Hielo|frío,blanca,invierno,muñeco,montaña,copos,esquí,congelada,guantes,nunca
Fuego|Brasa|llama,calor,quemar,humo,leña,fogón,naranja,peligro,fósforo,asado
Viento norte|Calor|calor,polvo,seco,molesto,dolor de cabeza,fuerte,agosto,caliente,remolino,ventana
Helada|Escarcha|frío,invierno,pasto,blanco,mañana,julio,congelado,plantas,campo,abrigo
Flor|Planta|pétalos,perfume,jardín,primavera,rosa,colores,regalo,abeja,maceta,tallo
Árbol|Arbusto|tronco,ramas,hojas,sombra,raíces,madera,alto,nido,plantar,verde
Estrella|Planeta|cielo,noche,brillo,fugaz,deseo,constelación,lejos,luz,cinco puntas,telescopio
Volcán|Montaña|lava,erupción,fuego,cráter,ceniza,montaña,caliente,humo,explosión,roca
Mar|Río|olas,agua salada,playa,azul,barco,peces,Brasil,profundo,horizonte,vacaciones
Laguna|Lago|agua,quieta,patos,orilla,Ypacaraí,pescar,ranas,camalotes,juncos,calma
Lago Ypacaraí|Laguna|San Bernardino,agua,canción,orilla,Areguá,verano,velero,azul,paseo,lago
Isla|Península|agua,rodeada,playa,náufrago,tesoro,barco,palmeras,mar,pequeña,tierra
Tierra colorada|Arena|roja,polvo,camino,barro,campo,Paraguay,lluvia,suelo,ruta,ropa sucia`,
};
// convierte el texto de arriba en una lista: {w, s, c, p:[...]}
const WORDS = [];
for(const c in WORD_SRC) WORD_SRC[c].split('\n').forEach(l=>{
  const [w, s, p] = l.split('|').map(x=>x.trim()); if(!w) return;
  WORDS.push({w, s, c, p:(p||'').split(',').map(x=>x.trim()).filter(Boolean)});
});
// texto "normalizado": sin tildes, minúsculas, sin signos (para comparar palabras)
function norm(t){
  return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’'´`]/g,'').replace(/[^a-z0-9ñ ]/g,' ').replace(/\s+/g,' ').trim();
}
function lev(a, b){
  if(a===b) return 0; if(!a.length) return b.length; if(!b.length) return a.length;
  let prev=Array.from({length:b.length+1}, (_,i)=>i);
  for(let i=1;i<=a.length;i++){ const cur=[i]; for(let j=1;j<=b.length;j++) cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1)); prev=cur; }
  return prev[b.length];
}
// ¿adivinó? acepta sin tildes y con una letra mal en palabras largas
function sameWord(guess, word){
  const g=norm(guess), w=norm(word); if(!g) return false;
  if(g===w) return true;
  const g2=g.replace(/^(el|la|los|las|un|una) /,''), w2=w.replace(/^(el|la|los|las|un|una) /,'');
  if(g2===w2) return true;
  return w2.length>=5 && lev(g2, w2)<=1;
}
// ¿la pista "dice" la palabra secreta? (no vale)
function clueSaysWord(clue, word){
  const c=' '+norm(clue)+' ', w=norm(word);
  if(!w) return false;
  if(c.includes(' '+w+' ')) return true;
  return w.split(' ').some(part=>part.length>=4 && c.includes(' '+part));
}
// ¿la pista tiene que ver con la palabra? (lo usan los bots para sospechar)
function clueFits(clue, entry){
  const c=norm(clue); if(!c || !entry) return false;
  return entry.p.some(x=>{ const n=norm(x); return n===c || (n.length>=4 && (c.includes(n) || n.includes(c) && c.length>=4)); })
    || norm(entry.w).includes(c) && c.length>=4;
}
const findWord = w => WORDS.find(x=>norm(x.w)===norm(w));
