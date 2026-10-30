/* =====================================================================
   Ciudades del Banquero Paraguayo: 22 calles por ciudad, en el orden del tablero
   (2 marrones, 3 celestes, 3 rosas, 3 naranjas, 3 rojas, 3 amarillas, 3 verdes, 2 azules):
   de las de barrio (baratas) a las avenidas principales y el centro (caras).
   Nombres sacados de OpenStreetMap (calles y avenidas reales de cada ciudad).
   Cada calle: [nombre completo, nombre corto para el casillero].
   ===================================================================== */
window.CIUDADES_PY = {
  'san-lorenzo': { n:'San Lorenzo', calles:[
    ['Calle Santos Mendoza','Santos Mendoza'], ['Calle Sargento Silva','Sgto. Silva'],
    ['Calle San Isidro','San Isidro'], ['Calle Teniente Molas','Tte. Molas'], ['Calle Campo Jordán','Campo Jordán'],
    ['Calle Juan Pablo Ocampos','J. P. Ocampos'], ['Calle Rafael Materi','Rafael Materi'], ['Calle 8 de Diciembre','8 de Diciembre'],
    ['Calle Brasil','Brasil'], ['Calle 10 de Agosto','10 de Agosto'], ['Calle Teniente Benítez','Tte. Benítez'],
    ['Calle Pastora Céspedes','Pastora Céspedes'], ['Calle General Eugenio A. Garay','Gral. Garay'], ['Calle Saturio Ríos','Saturio Ríos'],
    ['Avda. Defensores del Chaco','Def. del Chaco'], ['Avda. del Agrónomo','Del Agrónomo'], ['Calle Victorio Curiel','Victorio Curiel'],
    ['Avda. Julia Miranda Cueto','Julia Miranda'], ['Calle De la Victoria','De la Victoria'], ['Avda. Manuel Ortiz Guerrero','Ortiz Guerrero'],
    ['Avda. Avelino Martínez','Avelino Martínez'], ['Avda. Mariscal Estigarribia','Mcal. Estigarribia'] ]},

  'capiata': { n:'Capiatá', calles:[
    ['Calle Porvenir','Porvenir'], ['Calle Amistad','Amistad'],
    ['Calle 15 de Noviembre','15 de Noviembre'], ['Calle Fidel Maíz','Fidel Maíz'], ['Calle Adán Ramírez','Adán Ramírez'],
    ['Calle Curupayty','Curupayty'], ['Calle Rocío','Rocío'], ['Calle San Pedro','San Pedro'],
    ['Calle Virgen del Rosario','Virgen del Rosario'], ['Calle Boquerón','Boquerón'], ['Calle Las Piedras','Las Piedras'],
    ['Calle Estudiantes Capiateños','Est. Capiateños'], ['Calle José Asunción Flores','J. A. Flores'], ['Calle 3 de Febrero','3 de Febrero'],
    ['Calle Fulgencio Cabrera','F. Cabrera'], ['Calle Sgto. Octaviano Maidana','Sgto. Maidana'], ['Calle Rojas Cañada','Rojas Cañada'],
    ['Avda. Coronel Felipe Toledo','Felipe Toledo'], ['Calle Emiliano Gabriaguez','E. Gabriaguez'], ['Avda. Tte. 1° Leonardo Salinas','Leonardo Salinas'],
    ['Avda. Doctor Pedro López Godoy','López Godoy'], ['Ruta Mariscal Estigarribia','Mcal. Estigarribia'] ]},

  'nemby': { n:'Ñemby', calles:[
    ['Calle Primavera','Primavera'], ['Calle Las Mercedes','Las Mercedes'],
    ['Calle Santa Catalina','Santa Catalina'], ['Calle Capitán Bado','Cap. Bado'], ['Calle Teniente Fariña','Tte. Fariña'],
    ['Calle La Lomita','La Lomita'], ['Calle Paso de Patria','Paso de Patria'], ['Calle Ytororó','Ytororó'],
    ['Calle Santa Cecilia','Santa Cecilia'], ['Calle Uruguay','Uruguay'], ['Calle Carlos Antonio López','C. A. López'],
    ['Calle 11 de Setiembre','11 de Setiembre'], ['Calle Santa Librada','Santa Librada'], ['Calle Moisés Bertoni','Moisés Bertoni'],
    ['Avda. Caaguazú','Caaguazú'], ['Avda. Santa Rosa','Santa Rosa'], ['Avda. Cadete de Boquerón','Cad. de Boquerón'],
    ['Calle Victorio Curiel','Victorio Curiel'], ['Calle Bernardino Caballero','B. Caballero'], ['Avda. Pelayo Prats Gill','Prats Gill'],
    ['Avda. Manuel Ortiz Guerrero','Ortiz Guerrero'], ['Acceso Sur (Ruta Mcal. López)','Acceso Sur'] ]},

  'luque': { n:'Luque', calles:[
    ['Calle Puerto Pinasco','Puerto Pinasco'], ['Calle Los Pinos','Los Pinos'],
    ['Calle Valoys Rivarola','V. Rivarola'], ['Calle Leonismo Luqueño','Leonismo Luqueño'], ['Calle Sauce','Sauce'],
    ['Calle Hernandarias','Hernandarias'], ['Calle Coronel Bogado','Cnel. Bogado'], ['Calle Fotógrafos del Chaco','Fotógrafos'],
    ['Calle Sportivo Luqueño','Sportivo Luqueño'], ['Calle Ykua Karanday','Ykua Karanday'], ['Calle Campo Vía','Campo Vía'],
    ['Calle Coronel Martínez','Cnel. Martínez'], ['Calle Nanawa','Nanawa'], ['Calle Wenceslao Martínez','W. Martínez'],
    ['Avda. Las Residentas','Las Residentas'], ['Avda. Humaitá','Humaitá'], ['Calle Cerro Corá','Cerro Corá'],
    ['Avda. Monseñor Ismael Rolón','Mons. Rolón'], ['Calle Fulgencio Yegros','F. Yegros'], ['Calle Capitán Andrés Insfrán','Cap. Insfrán'],
    ['Avda. Gral. Elizardo Aquino','Elizardo Aquino'], ['Avda. Aviador Silvio Pettirossi','Silvio Pettirossi'] ]},

  'fernando-de-la-mora': { n:'Fernando de la Mora', calles:[
    ['Calle Herminio Giménez','Herminio Giménez'], ['Calle Policarpo Cañete','P. Cañete'],
    ['Calle Paz del Chaco','Paz del Chaco'], ['Calle Juan de Salazar','Juan de Salazar'], ['Calle Progreso','Progreso'],
    ['Calle Teniente Enciso','Tte. Enciso'], ['Calle Ytororó','Ytororó'], ["Calle Isla Po'i","Isla Po'i"],
    ['Calle Pitiantuta','Pitiantuta'], ['Calle Boquerón','Boquerón'], ['Calle Ingavi','Ingavi'],
    ['Calle 10 de Julio','10 de Julio'], ['Calle Luis Alberto del Paraná','L. A. del Paraná'], ['Calle Soldado Ovelar','Sdo. Ovelar'],
    ['Avda. Zavala Cué','Zavala Cué'], ['Calle Tte. Alberto Ettiene','Tte. Ettiene'], ['Calle 11 de Setiembre','11 de Setiembre'],
    ['Avda. Madame Elisa Lynch','Madame Lynch'], ['Avda. Santa Teresa','Santa Teresa'], ['Calle Julia Miranda Cueto','Julia Miranda'],
    ['Avda. Defensores del Chaco','Def. del Chaco'], ['Avda. Mariscal López','Mcal. López'] ]},

  'lambare': { n:'Lambaré', calles:[
    ['Calle Cristo Rey','Cristo Rey'], ['Calle Lima','Lima'],
    ['Calle Río Apa','Río Apa'], ['Calle Río Pilcomayo','Río Pilcomayo'], ['Calle Panambí Verá','Panambí Verá'],
    ['Calle Guaraníes','Guaraníes'], ['Calle Los Alpes','Los Alpes'], ['Calle San Rafael','San Rafael'],
    ['Calle Fortín Pirizal','Fortín Pirizal'], ['Calle Patricio Escobar','P. Escobar'], ['Calle Héroes del 70','Héroes del 70'],
    ['Calle Médicos del Chaco','Médicos del Chaco'], ['Avda. Bonifacio Ovando','B. Ovando'], ['Avda. Tape Tuyá','Tape Tuyá'],
    ['Avda. 1° de Marzo','1° de Marzo'], ['Avda. San Isidro','San Isidro'], ['Carretera de López','Carretera de López'],
    ['Avda. Luis María Argaña','L. M. Argaña'], ['Avda. República Argentina','Rep. Argentina'], ['Avda. Cerro Lambaré','Cerro Lambaré'],
    ['Avda. Pedro Bruno Guggiari','P. B. Guggiari'], ['Avda. Cacique Lambaré','Cacique Lambaré'] ]},

  'encarnacion': { n:'Encarnación', calles:[
    ['Calle Cerro Corá','Cerro Corá'], ['Calle Río Paraná','Río Paraná'],
    ['Calle Antequera','Antequera'], ['Calle Curupayty','Curupayty'], ['Calle Lomas Valentinas','Lomas Valentinas'],
    ['Calle Monseñor Wiessen','Mons. Wiessen'], ['Calle Independencia Nacional','Indep. Nacional'], ['Calle General Artigas','Gral. Artigas'],
    ['Avda. San Blas','San Blas'], ['Avda. Ucrania','Ucrania'], ['Avda. Japón','Japón'],
    ['Calle Carlos Antonio López','C. A. López'], ['Calle Mcal. Estigarribia','Mcal. Estigarribia'], ['Avda. Víctor Matiauda','V. Matiauda'],
    ['Avda. Padre Juan Von Winckel','Von Winckel'], ['Avda. Moisés Bertoni','Moisés Bertoni'], ['Calle Mariscal López','Mcal. López'],
    ['Avda. Bernardino Caballero','B. Caballero'], ['Avda. San Roque González','San Roque González'], ['Avda. Dr. Francia','Dr. Francia'],
    ['Avda. Luis Irrazábal','Irrazábal'], ['Costanera República del Paraguay','Costanera'] ]},

  'ciudad-del-este': { n:'Ciudad del Este', calles:[
    ['Calle Pampa Grande','Pampa Grande'], ['Calle Alejo García','Alejo García'],
    ['Calle 2000','Calle 2000'], ['Calle Fortín Toledo','Fortín Toledo'], ['Calle Amambay','Amambay'],
    ['Avda. Yrendy','Yrendy'], ['Avda. Bicentenario','Bicentenario'], ['Calle 12 Monday','12 Monday'],
    ['Avda. Choferes del Chaco','Choferes del Chaco'], ['Avda. Rogelio Benítez','R. Benítez'], ['Avda. Los Yerbales','Los Yerbales'],
    ['Avda. San José','San José'], ['Avda. Itaipú Este','Itaipú Este'], ['Avda. Itaipú Oeste','Itaipú Oeste'],
    ['Avda. Carlos Antonio López','C. A. López'], ['Avda. Capitán del Puerto','Cap. del Puerto'], ['Avda. del Lago','Del Lago'],
    ['Avda. Monseñor Rodríguez','Mons. Rodríguez'], ['Avda. San Blas','San Blas'], ['Avda. Bernardino Caballero','B. Caballero'],
    ['Avda. República del Perú','Rep. del Perú'], ['Avda. Mcal. Francisco Solano López','Mcal. López'] ]},

  'pedro-juan-caballero': { n:'Pedro Juan Caballero', calles:[
    ['Calle Cedro','Cedro'], ['Calle Picuiba','Picuiba'],
    ['Calle Ytororó','Ytororó'], ['Calle Juan de Ayolas','Juan de Ayolas'], ['Calle Rubio Ñu','Rubio Ñu'],
    ['Calle General Genes','Gral. Genes'], ['Calle 15 de Agosto','15 de Agosto'], ['Calle Lomas Valentinas','Lomas Valentinas'],
    ['Calle Natalicio Talavera','N. Talavera'], ['Calle Coronel Martínez','Cnel. Martínez'], ['Calle Teniente Herrero','Tte. Herrero'],
    ['Calle Campeones del 65','Campeones del 65'], ['Calle 12 de Junio','12 de Junio'], ['Calle Naciones Unidas','Naciones Unidas'],
    ['Calle Cerro León','Cerro León'], ['Avda. Mainumby','Mainumby'], ['Avda. Guyra Campana','Guyra Campana'],
    ['Avda. Carlos Domínguez','C. Domínguez'], ['Avda. José Bergés','José Bergés'], ['Avda. Fernando de la Mora','F. de la Mora'],
    ["Avda. Padre Juan José O'Connor","Padre O'Connor"], ['Avda. Dr. José Gaspar R. de Francia','Dr. Francia'] ]},

  'concepcion': { n:'Concepción', calles:[
    ['Calle General Díaz','Gral. Díaz'], ['Calle Yegros','Yegros'],
    ['Calle Curupayty','Curupayty'], ['Calle Cerro Corá','Cerro Corá'], ['Calle 14 de Mayo','14 de Mayo'],
    ['Calle Padre Sarmiento','P. Sarmiento'], ['Calle Don Bosco','Don Bosco'], ['Calle Brasil','Brasil'],
    ['Calle Juan Queirolo Candia','Queirolo Candia'], ['Calle General Garay','Gral. Garay'], ['Calle Colombia','Colombia'],
    ['Calle Mcal. Estigarribia','Mcal. Estigarribia'], ['Calle Eligio Ayala','Eligio Ayala'], ['Avda. Boquerón','Boquerón'],
    ['Avda. Herminio Mendoza','H. Mendoza'], ['Avda. Ibáñez Rojas','Ibáñez Rojas'], ['Calle Gral. Marcial Samaniego','M. Samaniego'],
    ['Avda. Mcal. Francisco Solano López','Mcal. López'], ['Avda. 1° de Marzo','1° de Marzo'], ['Avda. Gral. Bernardino Caballero','B. Caballero'],
    ['Avda. Agustín Fernando de Pinedo','F. de Pinedo'], ['Avda. Presidente Franco','Pdte. Franco'] ]},

  'villarrica': { n:'Villarrica', calles:[
    ['Calle Tacuary','Tacuary'], ['Calle Bahía Negra','Bahía Negra'],
    ['Calle Río Pilcomayo','Río Pilcomayo'], ['Calle Estero Bellaco','Estero Bellaco'], ['Calle Antequera','Antequera'],
    ['Calle Don Bosco','Don Bosco'], ['Calle Cristóbal Colón','C. Colón'], ['Calle Hernandarias','Hernandarias'],
    ['Calle Coronel Bogado','Cnel. Bogado'], ['Calle Presidente Franco','Pdte. Franco'], ['Calle General Genes','Gral. Genes'],
    ['Calle Río Aquidabán','Río Aquidabán'], ['Calle Comuneros','Comuneros'], ['Calle José Bergés','José Bergés'],
    ['Calle 14 de Mayo','14 de Mayo'], ['Calle Benjamín Aceval','B. Aceval'], ['Calle Rivarola','Rivarola'],
    ['Calle Constitución Nacional','Constitución'], ['Calle Mcal. Estigarribia','Mcal. Estigarribia'], ['Avda. España','España'],
    ['Calle Alejo García','Alejo García'], ['Boulevard Yegros','Boulevard Yegros'] ]},

  'mariano-roque-alonso': { n:'Mariano Roque Alonso', calles:[
    ['Calle Pirizal','Pirizal'], ['Calle Chaco Boreal','Chaco Boreal'],
    ['Calle Toledo','Toledo'], ['Calle Ecuador','Ecuador'], ['Calle Galeano','Galeano'],
    ['Calle Gondra','Gondra'], ['Calle Hernandarias','Hernandarias'], ['Calle Saavedra','Saavedra'],
    ['Calle Capitán Hermosilla','Cap. Hermosilla'], ['Calle Ignacio Núñez','Ignacio Núñez'], ['Calle Luis A. de Herrera','L. A. de Herrera'],
    ['Calle Estados Unidos','Estados Unidos'], ['Calle República de Colombia','Rep. de Colombia'], ['Calle Tres de Febrero','3 de Febrero'],
    ['Calle Boquerón','Boquerón'], ['Calle Nanawa','Nanawa'], ['Paseo de Fátima','Paseo de Fátima'],
    ["Avda. Surubi'i","Surubi'i"], ['Avda. Eusebio Ayala','Eusebio Ayala'], ['Avda. General Garay','Gral. Garay'],
    ['Avda. Bernardino Caballero','B. Caballero'], ['Ruta Transchaco','Transchaco'] ]},

  'limpio': { n:'Limpio', calles:[
    ['Calle Siesta Paraguaya','Siesta Paraguaya'], ['Calle Las Mercedes','Las Mercedes'],
    ['Calle Fernando de Magallanes','Magallanes'], ['Calle Óscar Netto','Óscar Netto'], ['Calle San Blas','San Blas'],
    ['Calle 14 de Mayo','14 de Mayo'], ['Calle Boquerón','Boquerón'], ['Calle Fulgencio Yegros','F. Yegros'],
    ['Calle Del Maestro','Del Maestro'], ['Calle 3 de Febrero','3 de Febrero'], ['Calle Carlos Antonio López','C. A. López'],
    ['Calle 8 de Diciembre','8 de Diciembre'], ['Calle Mayas','Mayas'], ['Calle Guillermo Von Grütter','Von Grütter'],
    ['Calle Pedro Melo de Portugal','Melo de Portugal'], ['Calle Tsunesaburo Makiguchi','Makiguchi'], ['Avda. Costa Azul','Costa Azul'],
    ['Avda. San Jerónimo','San Jerónimo'], ['Calle Mcal. Estigarribia','Mcal. Estigarribia'], ['Calle Emigdio Montiel Medina','Montiel Medina'],
    ['Avda. San José','San José'], ['Ruta Transchaco','Transchaco'] ]},

  'aregua': { n:'Areguá', calles:[
    ['Calle Mburucuyá','Mburucuyá'], ['Calle 24 de Mayo','24 de Mayo'],
    ['Calle Estados Unidos','Estados Unidos'], ['Calle Humaitá','Humaitá'], ['Calle Estero Bellaco','Estero Bellaco'],
    ['Calle Hermanas Azules','Hermanas Azules'], ['Calle Adela Speratti','Adela Speratti'], ['Calle Froilán Zárate','F. Zárate'],
    ['Calle Gabriel Casaccia','G. Casaccia'], ['Calle Panchito López','Panchito López'], ['Calle Ricardo Pérez','Ricardo Pérez'],
    ['Calle Manuel Ortiz Guerrero','Ortiz Guerrero'], ['Calle Carlos Antonio López','C. A. López'], ['Calle Dr. Francia','Dr. Francia'],
    ['Calle Fray Luis de Bolaños','Fray Bolaños'], ['Calle Teodoro Librano','T. Librano'], ['Calle Las Residentas','Las Residentas'],
    ['Calle Ntra. Sra. de la Candelaria','La Candelaria'], ['Calle Costa Fleitas','Costa Fleitas'], ['Avda. Mcal. Estigarribia','Mcal. Estigarribia'],
    ['Avda. Gobernador Irala','Gdor. Irala'], ['Avda. Mcal. Francisco Solano López','Mcal. López'] ]},

  'caacupe': { n:'Caacupé', calles:[
    ['Calle El Agricultor','El Agricultor'], ['Calle Pozo de la Virgen','Pozo de la Virgen'],
    ['Calle Luis Ramírez','Luis Ramírez'], ['Calle Justo P. Noguera','J. P. Noguera'], ['Calle Capitán Vallejos','Cap. Vallejos'],
    ['Calle Teniente Aquino','Tte. Aquino'], ['Calle Teniente Fariña','Tte. Fariña'], ['Calle Carlos Morphi','Carlos Morphi'],
    ['Calle 14 de Mayo','14 de Mayo'], ['Calle Asunción Flores','Asunción Flores'], ['Calle Gral. Eduvigis Díaz','Gral. Díaz'],
    ['Calle Alberdi','Alberdi'], ['Calle Juan León Mallorquín','J. L. Mallorquín'], ['Calle Concepción','Concepción'],
    ['Calle Intendente Ortiz','Int. Ortiz'], ['Calle Capitán Domínguez','Cap. Domínguez'], ['Calle Teniente Godoy','Tte. Godoy'],
    ['Calle Del Maestro','Del Maestro'], ['Calle Dr. Venancio Pino','Venancio Pino'], ['Calle Yegros','Yegros'],
    ["Calle Juan E. O'Leary","J. E. O'Leary"], ['Avda. Mcal. Estigarribia','Mcal. Estigarribia'] ]},

  'coronel-oviedo': { n:'Coronel Oviedo', calles:[
    ['Calle Tacuary','Tacuary'], ['Calle Yrendagüé','Yrendagüé'],
    ['Calle Aquidabán','Aquidabán'], ['Calle Nanawa','Nanawa'], ['Calle Panchito López','Panchito López'],
    ['Calle Guairá','Guairá'], ['Calle Villarrica','Villarrica'], ['Calle Ñeembucú','Ñeembucú'],
    ['Calle Humaitá','Humaitá'], ['Calle 12 de Junio','12 de Junio'], ['Calle Boquerón','Boquerón'],
    ['Calle Padre Molas','Padre Molas'], ['Calle Fabián Ojeda','Fabián Ojeda'], ['Calle Cerro Corá','Cerro Corá'],
    ['Calle Lida P. Benítez','Lida Benítez'], ['Calle Ignacio A. Pane','I. A. Pane'], ['Calle Gral. Patricio Escobar','P. Escobar'],
    ['Calle Gral. Bernardino Caballero','B. Caballero'], ['Calle Eugenio A. Garay','Gral. Garay'], ['Calle Héctor R. Duarte','H. R. Duarte'],
    ['Calle Jaime Sanjust','Jaime Sanjust'], ['Ruta Mariscal Estigarribia','Mcal. Estigarribia'] ]},

  'itaugua': { n:'Itauguá', calles:[
    ['Calle Porvenir','Porvenir'], ['Calle Juventud','Juventud'],
    ['Calle Curupayty','Curupayty'], ['Calle Mayor Vera','Mayor Vera'], ['Calle Antolín Irala','Antolín Irala'],
    ['Calle Tejedoras de Ñandutí','Tejedoras'], ['Calle Próceres de Mayo','Próceres de Mayo'], ['Calle Virgen del Rosario','Virgen del Rosario'],
    ['Calle Coronel Martínez','Cnel. Martínez'], ['Calle Fulgencio Yegros','F. Yegros'], ['Calle Genaro Rodríguez','G. Rodríguez'],
    ['Calle Defensores del Chaco','Def. del Chaco'], ['Calle Rodríguez de Francia','Dr. Francia'], ['Calle General Caballero','Gral. Caballero'],
    ['Avda. Lapacho','Lapacho'], ['Calle Tte. Esteban Martínez','E. Martínez'], ['Calle Santa Rosa','Santa Rosa'],
    ['Camino a Potrero','Camino a Potrero'], ['Avda. Japón','Japón'], ['Calle Mariscal López','Mcal. López'],
    ['Calle Gral. Marcial Samaniego','M. Samaniego'], ['Ruta Mariscal Estigarribia','Mcal. Estigarribia'] ]},

  'san-bernardino': { n:'San Bernardino', calles:[
    ['Calle Korochiré','Korochiré'], ['Calle Río Apa','Río Apa'],
    ['Calle Sebastián Elcano','S. Elcano'], ['Calle Magallanes','Magallanes'], ['Calle Colón','Colón'],
    ['Calle Yegros','Yegros'], ['Calle 14 de Mayo','14 de Mayo'], ['Calle Gral. Díaz','Gral. Díaz'],
    ['Calle José Bergés','José Bergés'], ['Calle Naciones Unidas','Naciones Unidas'], ['Calle Cerro Corá','Cerro Corá'],
    ['Calle Emilio Hassler','Emilio Hassler'], ['Calle Domingo Guerrero','D. Guerrero'], ['Calle Roberto Petzoldt','R. Petzoldt'],
    ['Avda. Mbocayá','Mbocayá'], ['Avda. del Bosque','Del Bosque'], ['Avda. Ciervo Cuá','Ciervo Cuá'],
    ['Avda. Luis F. Vache','Luis Vache'], ['Calle Kennedy','Kennedy'], ['Avda. Santiago Otto Schaerer','Otto Schaerer'],
    ['Avda. Mariscal López','Mcal. López'], ['Avda. del Lago','Del Lago'] ]},

  'pilar': { n:'Pilar', calles:[
    ['Calle Yvapovo','Yvapovo'], ['Calle Guapoy','Guapoy'],
    ['Calle Humaitá','Humaitá'], ['Calle Curupayty','Curupayty'], ['Calle San José','San José'],
    ['Calle Ayolas','Ayolas'], ['Calle Tacuary','Tacuary'], ['Calle Mujer Paraguaya','Mujer Paraguaya'],
    ['Calle Palma','Palma'], ['Calle Las Residentas','Las Residentas'], ['Calle Panchito López','Panchito López'],
    ['Calle Alberdi','Alberdi'], ['Calle Fulgencio Yegros','F. Yegros'], ['Calle Pedro Juan Caballero','P. J. Caballero'],
    ['Calle Cerro Corá','Cerro Corá'], ['Calle Capitán Bado','Cap. Bado'], ['Calle Roberto Cabañas','R. Cabañas'],
    ['Calle 14 de Mayo','14 de Mayo'], ['Calle Mcal. Estigarribia','Mcal. Estigarribia'], ['Avda. Mariscal López','Mcal. López'],
    ['Avda. Dr. Francia','Dr. Francia'], ['Avda. Gobernador Irala','Gdor. Irala'] ]},

  'hernandarias': { n:'Hernandarias', calles:[
    ['Calle Jamaica','Jamaica'], ['Calle Bahamas','Bahamas'],
    ['Calle Uruguay','Uruguay'], ['Calle Chile','Chile'], ['Calle Canadá','Canadá'],
    ['Calle Piraverá','Piraverá'], ['Calle Parapití','Parapití'], ['Calle Antequera','Antequera'],
    ['Calle Curupayty','Curupayty'], ['Calle Boquerón','Boquerón'], ['Calle 15 de Agosto','15 de Agosto'],
    ['Calle Iturbe','Iturbe'], ['Calle Alto Paraná','Alto Paraná'], ['Calle Acosta Ñu','Acosta Ñu'],
    ['Avda. Juan B. Flores','J. B. Flores'], ['Avda. César Gianotti','C. Gianotti'], ["Avda. Juan E. O'Leary","J. E. O'Leary"],
    ['Avda. El Mensú','El Mensú'], ['Avda. Brasil','Brasil'], ['Calle Mcal. Francisco Solano López','Mcal. López'],
    ['Avda. Paraná','Paraná'], ['Avda. Dr. Francia','Dr. Francia'] ]},
};
