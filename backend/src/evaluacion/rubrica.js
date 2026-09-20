// Rúbrica de evaluación derivada del documento "FpI III.pdf",
// ajustada a un texto tipo cuartilla (220-300 palabras).
//
// IMPORTANTE PARA LA INVESTIGACIÓN: este archivo es el instrumento de medición.
// Si se cambia después de aplicar la prueba al primer participante, los datos de
// antes y los de después dejan de ser comparables. Cada cambio debe subir
// RUBRICA_VERSION, que se guarda junto a cada calificación en la base de datos.
//
// Cada parámetro declara en qué capa se evalúa:
//   'determinista' -> lo calcula metricas.js con código. Reproducible, gratis, instantáneo.
//   'ia'           -> requiere juicio: lo evalúa el modelo de lenguaje.
//   'mixta'        -> el código detecta candidatos, la IA decide si son correctos.

export const RUBRICA_VERSION = 'fpi3-cuartilla-v2-2026-09-19';

// Escala de cada parámetro. Se usa la misma en todos para poder promediar.
export const ESCALA = { min: 1, max: 5 };

// Pesos: el PDF solo fija peso explícito para Sintaxis ("Peso sugerido: 20%").
// Se mantienen las cinco dimensiones del documento con 20% cada una, lo que
// respeta ese anclaje y reparte el resto de forma pareja.
export const PESOS_CONFIRMADOS = true;

// ---------------------------------------------------------------------------
// AJUSTE A LA CUARTILLA (decidido el 2026-09-19)
//
// El PDF está escrito para textos académicos extensos: habla de capítulos,
// secciones, hipótesis y marco teórico. La prueba pide 220-300 palabras. Se
// retiraron los parámetros que no son evaluables a esa escala y se fusionaron
// los que se solapaban en un texto corto:
//
//   RETIRADO  consistencia_terminologica
//             Exige vocabulario técnico sostenido "a lo largo del escrito" y un
//             marco teórico. En 250 palabras casi no hay términos que puedan
//             volverse inconsistentes.
//
//   RETIRADO  funcion_edificadora
//             Medía "transferibilidad del conocimiento". En un texto de opinión
//             breve se solapa casi por completo con la coherencia global.
//
//   FUSIONADOS  progresion_tematica + coherencia_macroestructural
//             -> estructura_textual + coherencia_global
//             En tres párrafos, "progresión entre párrafos" y "alineación de
//             cada sección con la hipótesis" son casi lo mismo. Se reemplazan
//             por dos parámetros que sí se pueden juzgar en una cuartilla:
//             si hay introducción/desarrollo/conclusión, y si todo converge
//             en una tesis.
//
// Resultado: 13 -> 11 parámetros, todos evaluables en 220-300 palabras.
// ---------------------------------------------------------------------------

export const DIMENSIONES = [
  {
    id: 'lexico',
    nombre: 'Léxico y densidad',
    peso: 0.20,
    parametros: [
      {
        id: 'precision_lexica',
        nombre: 'Índice de precisión léxica',
        capa: 'determinista',
        fuente: 'Detección y penalización automática de palabras comodín o vagamente definidas.',
        descriptores: {
          1: 'Uso frecuente de palabras comodín (cosa, tema, aspecto, hacer, tener). Las afirmaciones quedan vagas.',
          3: 'Algunas palabras comodín, pero las ideas centrales están nombradas con términos propios.',
          5: 'Cada término delimita con exactitud. Verbos con carga semántica en lugar de perífrasis.'
        }
      },
      {
        id: 'densidad_informativa',
        nombre: 'Ratio de densidad informativa',
        capa: 'determinista',
        fuente: 'Proporción de palabras sustantivas/especializadas frente a palabras funcionales de relleno.',
        descriptores: {
          1: 'Explicaciones circulares y rodeos perifrásticos. Baja carga analítica por cláusula.',
          3: 'Densidad aceptable, con algunas redundancias o pleonasmos.',
          5: 'Sin redundancias; concentra la mayor carga analítica en la menor cantidad de cláusulas.'
        }
      }
    ]
  },

  {
    id: 'cohesion',
    nombre: 'Cohesión y pragmática discursiva',
    peso: 0.20,
    parametros: [
      {
        id: 'conectores_logicos',
        nombre: 'Mapeo de conectores lógicos',
        capa: 'mixta',
        fuente: 'Identificación de marcadores (adversativos, causales, consecutivos) y validación de su sentido en la relación inferencial.',
        descriptores: {
          1: 'Ausencia de conectores o uso erróneo que distorsiona la relación lógica entre proposiciones.',
          3: 'Usa conectores correctos pero poco variados; predominan los más genéricos.',
          5: 'Marcadores variados y pertinentes; cada uno explicita con precisión la relación inferencial.'
        }
      },
      {
        id: 'saturacion_conectiva',
        nombre: 'Umbral de saturación conectiva',
        capa: 'determinista',
        fuente: 'Penalizar el exceso repetitivo o forzado de marcadores al inicio de oraciones consecutivas.',
        descriptores: {
          1: 'Inflación conectiva: casi toda oración abre con un marcador, de forma mecánica.',
          3: 'Algunas cadenas de oraciones consecutivas que abren con conector.',
          5: 'Los conectores aparecen solo donde son analíticamente indispensables.'
        }
      }
    ]
  },

  {
    id: 'sintaxis',
    nombre: 'Sintaxis y tipología oracional',
    // Único peso explícito en el documento: "Peso sugerido: 20%".
    peso: 0.20,
    pesoExplicitoEnFuente: true,
    parametros: [
      {
        id: 'variedad_oracional',
        nombre: 'Variedad y equilibrio oracional',
        capa: 'mixta',
        fuente: 'Alternancia entre oraciones simples (para enfatizar tesis) y compuestas subordinadas (para explicaciones complejas).',
        descriptores: {
          1: 'Monotonía sintáctica: todo oraciones cortas yuxtapuestas, o todo cláusulas encadenadas.',
          3: 'Alguna alternancia, pero sin usarla para jerarquizar las ideas.',
          5: 'Alterna con intención: brevedad en las tesis, subordinación en el razonamiento analítico.'
        }
      },
      {
        id: 'extension_oracional',
        nombre: 'Control de extensión oracional',
        capa: 'determinista',
        fuente: 'Rango óptimo de 15 a 30 palabras por período sintáctico; penalización para oraciones superiores a 45 palabras.',
        umbrales: { optimoMin: 15, optimoMax: 30, penalizacionDesde: 46 },
        descriptores: {
          1: 'Predominan oraciones fuera de rango; hay períodos de más de 45 palabras con subordinación encadenada.',
          3: 'La mayoría en rango, con varias oraciones excesivamente largas o telegráficas.',
          5: 'Casi todas entre 15 y 30 palabras; ninguna supera las 45.'
        }
      },
      {
        id: 'voz_activa',
        nombre: 'Ratio voz activa vs. pasiva',
        capa: 'mixta',
        fuente: 'Objetivo de 80% de oraciones en voz activa; marcaje de pasivas para validar si su uso está justificado.',
        umbrales: { objetivoActiva: 0.80 },
        descriptores: {
          1: 'Abuso de pasivas e impersonales que ocultan la agencia sin justificación metodológica.',
          3: 'Mayoría activa, pero con pasivas donde el agente sí era relevante.',
          5: 'Al menos 80% activa; las pasivas que aparecen despersonalizan por necesidad real.'
        }
      }
    ]
  },

  {
    id: 'normativa',
    nombre: 'Normativa gramatical y estilo',
    peso: 0.20,
    parametros: [
      {
        id: 'gerundios',
        nombre: 'Filtro estricto de gerundios',
        capa: 'mixta',
        fuente: 'Detección de gerundios de posterioridad o de función adjetiva especificada; solo se permiten los de simultaneidad o modo.',
        descriptores: {
          1: 'Varios gerundios de posterioridad o adjetivos (ej. "un maletín conteniendo documentos").',
          3: 'Un gerundio mal empleado, o varios legítimos pero acumulados.',
          5: 'Los gerundios expresan solo simultaneidad o modo.'
        }
      },
      {
        id: 'puntuacion_concordancia',
        nombre: 'Concordancia y puntuación',
        capa: 'mixta',
        // El corrector del navegador está activo, pero señala ortografía, no
        // colocación de comas ni concordancia sujeto-verbo. Este parámetro
        // sigue siendo evaluable.
        fuente: 'Verificación de concordancia sujeto-verbo y detección de errores de segmentación, como la coma entre sujeto y verbo.',
        descriptores: {
          1: 'Errores de concordancia o puntuación que alteran el vínculo lógico de la oración.',
          3: 'Errores menores que no impiden la lectura.',
          5: 'Concordancia estricta y puntuación que jerarquiza correctamente los incisos.'
        }
      }
    ]
  },

  {
    id: 'estructura',
    nombre: 'Estructura y coherencia',
    peso: 0.20,
    // Reemplaza a la dimensión "Impacto y propósito académico" del PDF,
    // reinterpretada a escala de cuartilla. Ver la nota de ajuste arriba.
    parametros: [
      {
        id: 'estructura_textual',
        nombre: 'Estructura del texto',
        capa: 'mixta',
        fuente: 'Adaptación a la cuartilla de "coherencia macroestructural": el documento evalúa la alineación de cada sección; aquí se evalúa si el texto distingue introducción, desarrollo y conclusión.',
        adaptadoACuartilla: true,
        descriptores: {
          1: 'Un solo bloque indiferenciado, o partes que no cumplen ninguna función reconocible.',
          3: 'Se distinguen las partes, pero alguna está desbalanceada (conclusión de una frase, introducción que ya argumenta).',
          5: 'Introducción que plantea la tesis, desarrollo que la sostiene y conclusión que sintetiza sin introducir ideas nuevas.'
        }
      },
      {
        id: 'coherencia_global',
        nombre: 'Coherencia global',
        capa: 'ia',
        fuente: 'Fusión de "progresión temática (tema/rema)" y "coherencia macroestructural": que los párrafos converjan en una tesis y que la información nueva se ancle sobre lo ya establecido.',
        adaptadoACuartilla: true,
        descriptores: {
          1: 'Digresiones no justificadas; los párrafos funcionan como compartimentos estancos y no hay tesis identificable.',
          3: 'Hay una tesis reconocible, pero algún párrafo se desvía o salta sin enlazar con lo anterior.',
          5: 'Todo converge en una tesis central y cada párrafo se ancla en lo ya establecido, sin vacíos informativos.'
        }
      }
    ]
  }
];

// Utilidades derivadas, para no repetir recorridos por el árbol.
export const TODOS_LOS_PARAMETROS = DIMENSIONES.flatMap(d =>
  d.parametros.map(p => ({ ...p, dimensionId: d.id, dimensionNombre: d.nombre }))
);

export const PARAMETROS_IA = TODOS_LOS_PARAMETROS.filter(
  p => p.capa === 'ia' || p.capa === 'mixta'
);

export const PARAMETROS_DETERMINISTAS = TODOS_LOS_PARAMETROS.filter(
  p => p.capa === 'determinista' || p.capa === 'mixta'
);

// Convierte puntajes por parámetro (1-5) en la nota global 0-100.
export function calcularNotaGlobal(puntajesPorParametro){
  let nota = 0;
  for (const dim of DIMENSIONES){
    const puntajes = dim.parametros
      .map(p => puntajesPorParametro[p.id])
      .filter(v => typeof v === 'number');
    if (puntajes.length === 0) continue;
    const promedioDim = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;
    // Normaliza de la escala 1-5 a 0-1 y aplica el peso de la dimensión.
    nota += ((promedioDim - ESCALA.min) / (ESCALA.max - ESCALA.min)) * dim.peso;
  }
  return Math.round(nota * 100);
}

// Verificación de integridad: los pesos deben sumar 1.
const sumaPesos = DIMENSIONES.reduce((a, d) => a + d.peso, 0);
if (Math.abs(sumaPesos - 1) > 0.001){
  throw new Error(`Los pesos de la rúbrica suman ${sumaPesos}, deben sumar 1.`);
}
