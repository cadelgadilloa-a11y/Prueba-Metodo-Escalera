// CAPA 1 — Métricas deterministas.
//
// Todo lo que se puede medir con código, sin IA. Es instantáneo, gratis y
// —lo más importante para la investigación— reproducible: cualquiera puede
// recalcular estos números y obtener exactamente los mismos.
//
// Los umbrales marcados FUENTE:PDF vienen literalmente del documento FpI III.
// Los marcados DERIVADO son cortes propuestos por nosotros para traducir una
// medición continua a la escala 1-5; son los que hay que validar con el director.

// ---------------------------------------------------------------------------
// Listas léxicas
// ---------------------------------------------------------------------------

// FUENTE:PDF — "palabras comodín o vagamente definidas (cosa, tema, aspecto,
// hacer o tener)". Se añaden flexiones y algunos comodines clásicos del español.
const PALABRAS_COMODIN = new Set([
  'cosa', 'cosas', 'algo', 'tema', 'temas', 'aspecto', 'aspectos',
  'hacer', 'hace', 'hacen', 'hizo', 'hicieron', 'haciendo', 'hecho',
  'tener', 'tiene', 'tienen', 'tuvo', 'tuvieron', 'teniendo',
  'poner', 'pone', 'ponen', 'puso', 'dar', 'da', 'dan', 'dio',
  'bueno', 'buena', 'buenos', 'buenas', 'malo', 'mala', 'malos', 'malas',
  'mucho', 'mucha', 'muchos', 'muchas', 'bastante', 'demasiado',
  'gente', 'personas', 'elemento', 'elementos', 'factor', 'factores'
]);

// FUENTE:PDF — "sustituir construcciones perifrásticas por verbos con fuerte
// valor semántico".
const PERIFRASIS = [
  { patron: /poner\s+de\s+manifiesto/gi, sugerencia: 'evidenciar' },
  { patron: /realizar\s+un\s+an[áa]lisis/gi, sugerencia: 'analizar' },
  { patron: /llevar\s+a\s+cabo/gi, sugerencia: 'ejecutar / realizar' },
  { patron: /hacer\s+referencia\s+a/gi, sugerencia: 'referir / aludir a' },
  { patron: /dar\s+lugar\s+a/gi, sugerencia: 'originar / provocar' },
  { patron: /tomar\s+en\s+consideraci[óo]n/gi, sugerencia: 'considerar' },
  { patron: /hacer\s+[ée]nfasis\s+en/gi, sugerencia: 'enfatizar' },
  { patron: /tener\s+en\s+cuenta/gi, sugerencia: 'considerar' }
];

// Palabras funcionales: artículos, preposiciones, conjunciones, pronombres,
// auxiliares. Todo lo que NO esté aquí cuenta como palabra con carga semántica.
const PALABRAS_FUNCIONALES = new Set([
  'el','la','los','las','un','una','unos','unas','lo','al','del',
  'de','a','ante','bajo','con','contra','desde','durante','en','entre','hacia',
  'hasta','mediante','para','por','según','sin','sobre','tras',
  'y','e','ni','o','u','pero','sino','aunque','porque','pues','que','si','como',
  'cuando','donde','mientras','cual','cuales','quien','quienes','cuyo','cuya',
  'yo','tú','él','ella','ellos','ellas','nosotros','nosotras','ustedes','usted',
  'me','te','se','nos','les','le','su','sus','mi','mis','tu','tus','nuestro',
  'nuestra','nuestros','nuestras','este','esta','estos','estas','ese','esa',
  'esos','esas','aquel','aquella','aquellos','aquellas','esto','eso','aquello',
  'ser','es','son','era','eran','fue','fueron','sea','sean','siendo','sido',
  'estar','está','están','estaba','estaban','estuvo','estuvieron','estado',
  'haber','ha','han','había','habían','hay','hubo','haya','hayan','habiendo',
  'más','menos','muy','también','tampoco','ya','aún','todavía','solo','sólo',
  'no','sí','todo','toda','todos','todas','otro','otra','otros','otras',
  'mismo','misma','mismos','mismas','tan','tanto','cada','algún','alguna',
  'alguno','algunos','algunas','ningún','ninguna','ninguno'
]);

// FUENTE:PDF — categorías de marcadores nombradas en "Uso guiado de conectores".
const CONECTORES = {
  adversativos: ['no obstante','sin embargo','en cambio','por el contrario','ahora bien','aun así','pese a ello','a pesar de ello','pero','aunque'],
  causales: ['puesto que','dado que','ya que','debido a','porque','en razón de','a causa de'],
  consecutivos: ['por consiguiente','en consecuencia','por lo tanto','por ende','de ahí que','así pues','por tanto'],
  aditivos: ['asimismo','además','igualmente','por otra parte','de igual modo','del mismo modo','también'],
  explicativos: ['es decir','esto es','en otras palabras','dicho de otro modo','a saber'],
  ejemplificativos: ['por ejemplo','en particular','concretamente','en concreto','tal como'],
  ordenadores: ['en primer lugar','en segundo lugar','finalmente','por último','en última instancia','para concluir','en síntesis']
};

const TODOS_LOS_CONECTORES = Object.entries(CONECTORES)
  .flatMap(([tipo, lista]) => lista.map(c => ({ conector: c, tipo })))
  // Los más largos primero, para que "no obstante" gane sobre "no".
  .sort((a, b) => b.conector.length - a.conector.length);

// ---------------------------------------------------------------------------
// Segmentación
// ---------------------------------------------------------------------------

const ABREVIATURAS = /\b(Dr|Dra|Sr|Sra|Srta|Ing|Lic|Mg|PhD|etc|p\.?\s?ej|vs|núm|pág|págs|fig|op\.?\s?cit)\.$/i;

export function segmentarParrafos(texto){
  return texto.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

export function segmentarOraciones(texto){
  // Protege decimales (3.5) y abreviaturas antes de cortar.
  const protegido = texto.replace(/(\d)\.(\d)/g, '$1<PUNTO>$2');
  const crudas = protegido.split(/(?<=[.!?…])\s+/);

  const oraciones = [];
  let acumulado = '';
  for (const cruda of crudas){
    const fragmento = (acumulado ? acumulado + ' ' : '') + cruda;
    if (ABREVIATURAS.test(fragmento.trim())){
      acumulado = fragmento; // la siguiente parte pertenece a esta misma oración
      continue;
    }
    acumulado = '';
    const limpia = fragmento.replace(/<PUNTO>/g, '.').trim();
    if (limpia) oraciones.push(limpia);
  }
  if (acumulado) oraciones.push(acumulado.replace(/<PUNTO>/g, '.').trim());
  return oraciones;
}

export function extraerPalabras(texto){
  const encontradas = texto.toLowerCase().match(/[a-záéíóúüñ]+(?:-[a-záéíóúüñ]+)?/gi);
  return encontradas || [];
}

// ---------------------------------------------------------------------------
// Parámetros deterministas
// ---------------------------------------------------------------------------

// Parámetro: Índice de precisión léxica
function medirPrecisionLexica(palabras, texto){
  const encontradas = palabras.filter(p => PALABRAS_COMODIN.has(p));
  const conteo = {};
  for (const p of encontradas) conteo[p] = (conteo[p] || 0) + 1;

  const perifrasisHalladas = [];
  for (const { patron, sugerencia } of PERIFRASIS){
    const coincidencias = texto.match(patron);
    if (coincidencias){
      perifrasisHalladas.push({ expresion: coincidencias[0].toLowerCase(), veces: coincidencias.length, sugerencia });
    }
  }

  return {
    comodines: conteo,
    totalComodines: encontradas.length,
    ratioComodines: palabras.length ? encontradas.length / palabras.length : 0,
    perifrasis: perifrasisHalladas
  };
}

// Parámetro: Ratio de densidad informativa
function medirDensidad(palabras){
  const contenido = palabras.filter(p => !PALABRAS_FUNCIONALES.has(p));
  const unicas = new Set(contenido);
  return {
    totalPalabras: palabras.length,
    palabrasContenido: contenido.length,
    ratioDensidad: palabras.length ? contenido.length / palabras.length : 0,
    // Type-Token Ratio sobre palabras de contenido: diversidad léxica.
    diversidadLexica: contenido.length ? unicas.size / contenido.length : 0
  };
}

// Parámetros: Mapeo de conectores + Umbral de saturación conectiva
function medirConectores(oraciones, texto){
  const textoMin = texto.toLowerCase();
  const porTipo = {};
  const inventario = [];

  for (const { conector, tipo } of TODOS_LOS_CONECTORES){
    const patron = new RegExp(`(^|[^a-záéíóúüñ])${conector.replace(/ /g, '\\s+')}([^a-záéíóúüñ]|$)`, 'gi');
    const veces = (textoMin.match(patron) || []).length;
    if (veces > 0){
      porTipo[tipo] = (porTipo[tipo] || 0) + veces;
      inventario.push({ conector, tipo, veces });
    }
  }

  // Oraciones que ABREN con un marcador — es lo que el PDF penaliza.
  const abrenConConector = oraciones.map(o => {
    const inicio = o.toLowerCase().replace(/^[¿¡"'(\s]+/, '');
    return TODOS_LOS_CONECTORES.some(({ conector }) => inicio.startsWith(conector));
  });

  // Racha más larga de oraciones consecutivas que abren con conector.
  let rachaMaxima = 0, rachaActual = 0;
  for (const abre of abrenConConector){
    rachaActual = abre ? rachaActual + 1 : 0;
    if (rachaActual > rachaMaxima) rachaMaxima = rachaActual;
  }

  const totalAperturas = abrenConConector.filter(Boolean).length;

  return {
    inventario,
    porTipo,
    tiposDistintos: Object.keys(porTipo).length,
    totalConectores: inventario.reduce((a, c) => a + c.veces, 0),
    oracionesQueAbrenConConector: totalAperturas,
    ratioAperturas: oraciones.length ? totalAperturas / oraciones.length : 0,
    rachaMaximaAperturas: rachaMaxima
  };
}

// Parámetro: Control de extensión oracional
// FUENTE:PDF — rango óptimo 15-30 palabras; penalización sobre 45.
function medirExtension(oraciones){
  const longitudes = oraciones.map(o => extraerPalabras(o).length).filter(n => n > 0);
  if (longitudes.length === 0){
    return { longitudes: [], promedio: 0, enRango: 0, cercanas: 0, ratioEnRango: 0, indiceCalibracion: 0, excedenLimite: 0, oracionesLargas: [], desviacion: 0 };
  }

  const promedio = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;
  const varianza = longitudes.reduce((a, n) => a + (n - promedio) ** 2, 0) / longitudes.length;
  const enRango = longitudes.filter(n => n >= 15 && n <= 30).length;
  // El PDF fija la penalización automática solo para las oraciones de más de
  // 45 palabras. Quedarse corto no está penalizado: la brevedad tiene "fuerza
  // categórica ideal para enunciar tesis principales". Por eso las oraciones
  // apenas fuera del rango cuentan a medias en vez de contar como error.
  const cercanas = longitudes.filter(n => (n >= 11 && n < 15) || (n > 30 && n <= 38)).length;
  const excedenLimite = longitudes.filter(n => n > 45).length;

  const oracionesLargas = oraciones
    .map((o, i) => ({ indice: i, palabras: longitudes[i], fragmento: o.slice(0, 90) + (o.length > 90 ? '…' : '') }))
    .filter(o => o.palabras > 45);

  return {
    longitudes,
    promedio: Number(promedio.toFixed(1)),
    desviacion: Number(Math.sqrt(varianza).toFixed(1)),
    enRango,
    cercanas,
    ratioEnRango: enRango / longitudes.length,
    indiceCalibracion: (enRango + 0.5 * cercanas) / longitudes.length,
    excedenLimite,
    oracionesLargas
  };
}

// Parámetro: Ratio voz activa vs. pasiva
// Heurístico: detecta la forma, no comprueba sintaxis real. Por eso el
// parámetro es 'mixta' — la IA valida si cada pasiva está justificada.
const PASIVA_PERIFRASTICA = /\b(fue|fueron|es|son|será|serán|sería|serían|ha sido|han sido|había sido|habían sido|siendo)\s+([a-záéíóúñ]+(?:ado|ada|ados|adas|ido|ida|idos|idas|to|ta|tos|tas|cho|cha))\b/gi;
const PASIVA_REFLEJA = /\bse\s+([a-záéíóúñ]+(?:ó|aron|ieron|a|an|e|en|aba|aban|ía|ían))\b/gi;

function medirVoz(oraciones){
  const pasivasPerifrasticas = [];
  const pasivasReflejas = [];

  oraciones.forEach((oracion, indice) => {
    for (const m of oracion.matchAll(PASIVA_PERIFRASTICA)){
      pasivasPerifrasticas.push({ indice, expresion: m[0], fragmento: oracion.slice(0, 90) });
    }
    for (const m of oracion.matchAll(PASIVA_REFLEJA)){
      pasivasReflejas.push({ indice, expresion: m[0], fragmento: oracion.slice(0, 90) });
    }
  });

  const indicesConPasiva = new Set([...pasivasPerifrasticas, ...pasivasReflejas].map(p => p.indice));
  const total = oraciones.length || 1;

  return {
    pasivasPerifrasticas,
    pasivasReflejas,
    oracionesConPasiva: indicesConPasiva.size,
    ratioActiva: (total - indicesConPasiva.size) / total,
    objetivoActiva: 0.80 // FUENTE:PDF
  };
}

// Parámetro: Filtro estricto de gerundios
const GERUNDIO = /\b([a-záéíóúñ]+(?:ando|iendo|yendo))\b/gi;
const GERUNDIOS_LEGITIMOS = new Set(['siendo','estando','habiendo','teniendo','dependiendo','incluyendo']);

function medirGerundios(oraciones){
  const hallazgos = [];

  oraciones.forEach((oracion, indice) => {
    for (const m of oracion.matchAll(GERUNDIO)){
      const gerundio = m[1].toLowerCase();
      const posicion = m.index;
      const antes = oracion.slice(Math.max(0, posicion - 40), posicion);

      // Sospecha de POSTERIORIDAD: gerundio tras coma, cerrando la oración.
      // FUENTE:PDF — "aplicó la encuesta resultando en un alto porcentaje".
      const trasComa = /,\s*$/.test(antes);
      const restoTrasGerundio = oracion.slice(posicion + m[1].length);
      const cercaDelFinal = restoTrasGerundio.length < oracion.length * 0.35;

      // Sospecha de ADJETIVO ESPECIFICADO: determinante + sustantivo + gerundio.
      // FUENTE:PDF — "un maletín conteniendo documentos".
      const trasSustantivo = /\b(el|la|los|las|un|una|unos|unas)\s+[a-záéíóúñ]+\s*$/i.test(antes);

      let sospecha = null;
      if (trasComa && cercaDelFinal) sospecha = 'posible_posterioridad';
      else if (trasSustantivo) sospecha = 'posible_adjetivo_especificado';

      hallazgos.push({
        indice,
        gerundio,
        sospecha,
        legitimoProbable: GERUNDIOS_LEGITIMOS.has(gerundio) && !sospecha,
        fragmento: oracion.slice(Math.max(0, posicion - 45), posicion + m[1].length + 30).trim()
      });
    }
  });

  return {
    hallazgos,
    total: hallazgos.length,
    sospechosos: hallazgos.filter(h => h.sospecha !== null).length
  };
}

// Parámetro: Concordancia y puntuación (solo la parte mecánica)
function medirPuntuacion(texto, parrafos){
  const errores = [];
  const registrar = (tipo, detalle, muestra) => errores.push({ tipo, detalle, muestra });

  for (const m of texto.matchAll(/\s+([,;:.])/g)){
    registrar('espacio_antes_de_signo', `Espacio antes de "${m[1]}"`, texto.slice(Math.max(0, m.index - 25), m.index + 12).trim());
  }
  for (const m of texto.matchAll(/([,;:])(?=[^\s\d])/g)){
    registrar('falta_espacio_despues', `Falta espacio después de "${m[1]}"`, texto.slice(Math.max(0, m.index - 20), m.index + 20).trim());
  }
  for (const m of texto.matchAll(/\.(?=[A-ZÁÉÍÓÚÑa-záéíóúñ])/g)){
    registrar('falta_espacio_tras_punto', 'Falta espacio después del punto', texto.slice(Math.max(0, m.index - 20), m.index + 20).trim());
  }
  for (const m of texto.matchAll(/ {2,}/g)){
    registrar('espacio_doble', 'Dos o más espacios seguidos', texto.slice(Math.max(0, m.index - 20), m.index + 20).trim());
  }

  const cierresPregunta = (texto.match(/\?/g) || []).length;
  const aperturasPregunta = (texto.match(/¿/g) || []).length;
  if (cierresPregunta > aperturasPregunta){
    registrar('falta_apertura_interrogacion', `${cierresPregunta - aperturasPregunta} signo(s) "?" sin su "¿"`, null);
  }
  const cierresExclam = (texto.match(/!/g) || []).length;
  const aperturasExclam = (texto.match(/¡/g) || []).length;
  if (cierresExclam > aperturasExclam){
    registrar('falta_apertura_exclamacion', `${cierresExclam - aperturasExclam} signo(s) "!" sin su "¡"`, null);
  }

  parrafos.forEach((p, i) => {
    if (!/[.!?…]["')]?$/.test(p.trim())){
      registrar('parrafo_sin_cierre', `El párrafo ${i + 1} no termina en signo de puntuación`, p.slice(-45));
    }
  });

  return { errores, total: errores.length };
}

// Parámetro: Progresión temática — proxy determinista.
// Mide el solapamiento de vocabulario de contenido entre párrafos consecutivos.
// Un solapamiento muy bajo sugiere párrafos desconectados. La IA decide.
function medirProgresion(parrafos){
  if (parrafos.length < 2) return { transiciones: [], solapamientoPromedio: null };

  const contenidoDe = p => new Set(extraerPalabras(p).filter(w => !PALABRAS_FUNCIONALES.has(w) && w.length > 3));

  const transiciones = [];
  for (let i = 1; i < parrafos.length; i++){
    const a = contenidoDe(parrafos[i - 1]);
    const b = contenidoDe(parrafos[i]);
    const comunes = [...b].filter(w => a.has(w));
    const union = new Set([...a, ...b]);
    transiciones.push({
      de: i - 1,
      a: i,
      solapamiento: union.size ? Number((comunes.length / union.size).toFixed(3)) : 0,
      terminosCompartidos: comunes.slice(0, 8)
    });
  }

  const promedio = transiciones.reduce((s, t) => s + t.solapamiento, 0) / transiciones.length;
  return { transiciones, solapamientoPromedio: Number(promedio.toFixed(3)) };
}

// Candidatos a término clave, para que la IA verifique consistencia terminológica.
function extraerTerminosClave(palabras){
  const conteo = {};
  for (const p of palabras){
    if (PALABRAS_FUNCIONALES.has(p) || PALABRAS_COMODIN.has(p) || p.length < 5) continue;
    conteo[p] = (conteo[p] || 0) + 1;
  }
  return Object.entries(conteo)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([termino, veces]) => ({ termino, veces }));
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

export function calcularMetricas(texto){
  const parrafos = segmentarParrafos(texto);
  const oraciones = segmentarOraciones(texto);
  const palabras = extraerPalabras(texto);

  return {
    recuento: {
      palabras: palabras.length,
      oraciones: oraciones.length,
      parrafos: parrafos.length
    },
    precisionLexica: medirPrecisionLexica(palabras, texto),
    densidad: medirDensidad(palabras),
    conectores: medirConectores(oraciones, texto),
    extension: medirExtension(oraciones),
    voz: medirVoz(oraciones),
    gerundios: medirGerundios(oraciones),
    puntuacion: medirPuntuacion(texto, parrafos),
    progresion: medirProgresion(parrafos),
    terminosClave: extraerTerminosClave(palabras)
  };
}

// ---------------------------------------------------------------------------
// Traducción de métricas a la escala 1-5
// ---------------------------------------------------------------------------
// Solo para los cuatro parámetros puramente deterministas. Los demás los
// puntúa la IA usando estas métricas como evidencia.
//
// DERIVADO: los cortes de abajo son nuestros, no del PDF (salvo el rango
// 15-30 / >45 de extensión oracional, que sí es literal). Son el punto a
// validar con el director antes de aplicar la prueba real.

function escalonar(valor, cortes){
  // cortes: [[umbral, puntaje], ...] de mejor a peor.
  for (const [umbral, puntaje] of cortes){
    if (valor <= umbral) return puntaje;
  }
  return 1;
}

export function puntuarDeterministas(metricas){
  const { precisionLexica, densidad, conectores, extension } = metricas;

  // Precisión léxica: cuanto menor el ratio de comodines, mejor.
  const penalizacionPerifrasis = Math.min(1, precisionLexica.perifrasis.length * 0.5);
  const precision = Math.max(1, Math.round(
    escalonar(precisionLexica.ratioComodines, [[0.010, 5], [0.020, 4], [0.035, 3], [0.050, 2]]) - penalizacionPerifrasis
  ));

  // Densidad informativa: cuanto mayor la proporción de palabras con carga, mejor.
  const d = densidad.ratioDensidad;
  const densidadPuntaje = d >= 0.58 ? 5 : d >= 0.53 ? 4 : d >= 0.48 ? 3 : d >= 0.43 ? 2 : 1;

  // Saturación conectiva: penaliza el exceso de aperturas y las rachas.
  let saturacion = escalonar(conectores.ratioAperturas, [[0.30, 5], [0.40, 4], [0.55, 3], [0.70, 2]]);
  if (conectores.rachaMaximaAperturas >= 3) saturacion -= 1;
  if (conectores.rachaMaximaAperturas >= 5) saturacion -= 1;
  saturacion = Math.max(1, saturacion);

  // Extensión oracional: FUENTE:PDF para el rango 15-30 y el límite de 45.
  // El índice da crédito completo al rango óptimo y medio a las cercanas.
  const r = extension.indiceCalibracion;
  let extensionPuntaje = r >= 0.75 ? 5 : r >= 0.60 ? 4 : r >= 0.45 ? 3 : r >= 0.30 ? 2 : 1;
  // La única penalización automática que el documento exige: FUENTE:PDF.
  if (extension.excedenLimite > 0) extensionPuntaje -= 1;
  if (extension.excedenLimite >= 3) extensionPuntaje -= 1;
  extensionPuntaje = Math.max(1, extensionPuntaje);

  return {
    precision_lexica: precision,
    densidad_informativa: densidadPuntaje,
    saturacion_conectiva: saturacion,
    extension_oracional: extensionPuntaje
  };
}
