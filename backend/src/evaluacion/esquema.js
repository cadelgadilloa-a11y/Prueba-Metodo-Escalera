// Contrato de salida de la IA.
//
// El esquema se genera a partir de la rúbrica: si se agrega un parámetro en
// rubrica.js, aquí aparece solo. La IA está obligada a devolver exactamente
// esta forma; si no valida, no se inventa una nota (ver analizador.js).

import { z } from 'zod';
import { PARAMETROS_IA, ESCALA } from './rubrica.js';

const EvaluacionParametro = z.object({
  puntaje: z.number().int().min(ESCALA.min).max(ESCALA.max),
  justificacion: z.string().min(10).max(400),
  // Fragmentos textuales del escrito que sustentan el puntaje. Sin esto no se
  // puede auditar la calificación ni mostrarle al participante qué mirar.
  evidencia: z.array(z.string()).max(3).default([])
});

export const EsquemaAnalisis = z.object({
  parametros: z.object(
    Object.fromEntries(PARAMETROS_IA.map(p => [p.id, EvaluacionParametro]))
  ),
  fortalezas: z.array(z.string()).max(3).default([]),
  mejoras: z.array(z.string()).max(3).default([])
});

// Mismo esquema traducido a JSON Schema, que es lo que espera la API de Gemini
// en responseSchema. Se genera del mismo sitio para que nunca se desincronicen.
export function esquemaJsonParaGemini(){
  const propiedadesParametro = {
    type: 'OBJECT',
    properties: {
      puntaje: { type: 'INTEGER', description: `Puntaje de ${ESCALA.min} a ${ESCALA.max}` },
      justificacion: { type: 'STRING', description: 'Una o dos frases explicando el puntaje' },
      evidencia: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'Hasta 3 fragmentos literales del texto que sustentan el puntaje'
      }
    },
    required: ['puntaje', 'justificacion', 'evidencia']
  };

  return {
    type: 'OBJECT',
    properties: {
      parametros: {
        type: 'OBJECT',
        properties: Object.fromEntries(PARAMETROS_IA.map(p => [p.id, propiedadesParametro])),
        required: PARAMETROS_IA.map(p => p.id)
      },
      fortalezas: { type: 'ARRAY', items: { type: 'STRING' } },
      mejoras: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: ['parametros', 'fortalezas', 'mejoras']
  };
}
