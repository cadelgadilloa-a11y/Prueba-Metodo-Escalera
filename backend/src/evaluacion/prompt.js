// Construcción del prompt que recibe la IA.
//
// Reglas que NO se pueden romper sin invalidar el estudio:
//  1. La IA nunca sabe si el texto es de pre-test o de post-test. Si lo supiera,
//     tendería a inflar la nota del post y el hallazgo central quedaría sesgado.
//  2. La IA nunca recibe el nombre del participante. Solo un código (P-017).
//  3. PROMPT_VERSION se guarda con cada calificación. Si cambia el prompt,
//     cambia la versión: sin eso no se puede replicar el resultado.

import { DIMENSIONES, PARAMETROS_IA, ESCALA } from './rubrica.js';

export const PROMPT_VERSION = 'v1-2026-09-18';

function renderizarRubrica(){
  const bloques = [];
  for (const dim of DIMENSIONES){
    const parametrosIA = dim.parametros.filter(p => p.capa === 'ia' || p.capa === 'mixta');
    if (parametrosIA.length === 0) continue;

    bloques.push(`### ${dim.nombre}`);
    for (const p of parametrosIA){
      bloques.push(
        `\n**${p.id}** — ${p.nombre}\n` +
        `Criterio: ${p.fuente}\n` +
        `  ${ESCALA.min} = ${p.descriptores[1]}\n` +
        `  3 = ${p.descriptores[3]}\n` +
        `  ${ESCALA.max} = ${p.descriptores[5]}`
      );
    }
    bloques.push('');
  }
  return bloques.join('\n');
}

// Esta parte es idéntica en todas las llamadas. Va primero a propósito: es lo
// que permite que el proveedor la sirva desde caché y abarate cada llamada.
export const INSTRUCCIONES_BASE = `Eres un evaluador de redacción académica en español. Calificas textos aplicando una rúbrica fija, sin desviarte de ella.

Reglas de calificación:
- Usa exclusivamente los criterios de la rúbrica. No agregues criterios propios.
- Puntúa cada parámetro de ${ESCALA.min} a ${ESCALA.max} usando los descriptores como ancla. Los valores 2 y 4 son intermedios entre los descriptores vecinos.
- Toda justificación debe apoyarse en el texto evaluado, citando fragmentos literales en "evidencia".
- No premies ni castigues la postura ideológica del autor, solo la calidad de la redacción.
- No consideres la extensión total del texto como criterio: no está en la rúbrica.
- Si un parámetro no se puede evaluar porque el texto es demasiado breve, asigna 1 y explícalo en la justificación.
- Responde únicamente con el JSON del esquema. Sin texto adicional.

RÚBRICA

${renderizarRubrica()}`;

// Formatea las métricas deterministas como evidencia objetiva para la IA.
// La IA no tiene que contar: ya contamos nosotros. Ella juzga.
function renderizarEvidencia(m){
  const lineas = [];

  lineas.push(`- Recuento: ${m.recuento.palabras} palabras, ${m.recuento.oraciones} oraciones, ${m.recuento.parrafos} párrafos.`);

  lineas.push(`- Extensión oracional: promedio ${m.extension.promedio} palabras (desviación ${m.extension.desviacion}). ` +
    `${m.extension.enRango} de ${m.extension.longitudes.length} oraciones dentro del rango óptimo 15-30. ` +
    `${m.extension.excedenLimite} superan las 45 palabras.`);

  if (m.conectores.inventario.length){
    const detalle = m.conectores.inventario.map(c => `${c.conector} (${c.tipo}, x${c.veces})`).join('; ');
    lineas.push(`- Conectores detectados: ${detalle}.`);
  } else {
    lineas.push('- Conectores detectados: ninguno.');
  }
  lineas.push(`- ${m.conectores.oracionesQueAbrenConConector} oraciones abren con conector; racha consecutiva máxima: ${m.conectores.rachaMaximaAperturas}.`);

  lineas.push(`- Voz: ${m.voz.oracionesConPasiva} oraciones contienen construcción pasiva o impersonal ` +
    `(ratio de voz activa ${(m.voz.ratioActiva * 100).toFixed(0)}%, objetivo 80%).`);
  if (m.voz.pasivasPerifrasticas.length){
    lineas.push(`  Pasivas perifrásticas: ${m.voz.pasivasPerifrasticas.map(p => `"${p.expresion}"`).join(', ')}.`);
  }

  if (m.gerundios.total){
    const detalle = m.gerundios.hallazgos
      .map(h => `"${h.gerundio}"${h.sospecha ? ` [${h.sospecha}]` : ''}`)
      .join(', ');
    lineas.push(`- Gerundios: ${detalle}. Verifica si cada uno expresa simultaneidad o modo.`);
  } else {
    lineas.push('- Gerundios: ninguno.');
  }

  lineas.push(`- Densidad informativa: ${(m.densidad.ratioDensidad * 100).toFixed(0)}% de palabras con carga semántica; ` +
    `diversidad léxica ${(m.densidad.diversidadLexica * 100).toFixed(0)}%.`);

  if (m.precisionLexica.totalComodines){
    lineas.push(`- Palabras comodín: ${Object.entries(m.precisionLexica.comodines).map(([p, n]) => `${p} (x${n})`).join(', ')}.`);
  }
  if (m.precisionLexica.perifrasis.length){
    lineas.push(`- Perífrasis: ${m.precisionLexica.perifrasis.map(p => `"${p.expresion}" -> ${p.sugerencia}`).join('; ')}.`);
  }

  if (m.terminosClave.length){
    lineas.push(`- Términos repetidos (candidatos a término clave): ${m.terminosClave.map(t => `${t.termino} (x${t.veces})`).join(', ')}.`);
  }

  if (m.progresion.solapamientoPromedio !== null){
    lineas.push(`- Solapamiento léxico entre párrafos consecutivos: ${m.progresion.transiciones.map(t => t.solapamiento).join(', ')} ` +
      `(promedio ${m.progresion.solapamientoPromedio}). Valores muy bajos sugieren párrafos desconectados.`);
  }

  if (m.puntuacion.total){
    const tipos = {};
    for (const e of m.puntuacion.errores) tipos[e.tipo] = (tipos[e.tipo] || 0) + 1;
    lineas.push(`- Errores mecánicos de puntuación: ${Object.entries(tipos).map(([t, n]) => `${t} (x${n})`).join(', ')}.`);
  } else {
    lineas.push('- Errores mecánicos de puntuación: ninguno.');
  }

  return lineas.join('\n');
}

export function construirPrompt({ texto, tema, metricas }){
  const partesVariables = `TEMA ASIGNADO: ${tema || '(no especificado)'}

MEDICIONES OBJETIVAS YA CALCULADAS
Estas cifras fueron calculadas por el sistema. Son correctas: no las recalcules,
úsalas como evidencia. Tu trabajo es el juicio que ellas no pueden dar.

${renderizarEvidencia(metricas)}

TEXTO A EVALUAR
"""
${texto}
"""

Evalúa ahora los siguientes parámetros: ${PARAMETROS_IA.map(p => p.id).join(', ')}.`;

  return { instrucciones: INSTRUCCIONES_BASE, contenido: partesVariables };
}
