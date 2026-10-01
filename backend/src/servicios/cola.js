// Cola de recalificación en segundo plano.
//
// POR QUÉ EXISTE: el free tier de Gemini devuelve 503 "high demand" de forma
// intermitente, y esos fallos vienen en RACHAS. Medido el 2026-10-01: la misma
// petición tenía ~2/3 de éxito, pero cuando fallaba, fallaban también los 5
// reintentos del analizador porque ocurren todos dentro de ~44 segundos, o sea
// dentro de la misma racha.
//
// Reintentar en minutos en vez de en segundos cruza el borde de la racha. Así
// el participante entrega, su texto queda guardado, y el servidor sigue
// insistiendo hasta conseguir la nota sin que nadie tenga que estar pendiente.

import { db } from '../db/index.js';
import { analizarTexto } from './analizador.js';

const INTERVALO_MS = 90000;   // revisa la cola cada 90 s
const MAX_INTENTOS = 12;      // ~18 min de insistencia antes de rendirse
const POR_RONDA = 2;          // pocas a la vez, para no agravar la saturación

let temporizador = null;
let corriendo = false;

function pendientes(){
  return db.prepare(`
    SELECT id, tema, texto_final, intentos_calificacion
      FROM sesiones
     WHERE estado = 'revision_manual'
       AND texto_final IS NOT NULL
       AND intentos_calificacion < ?
     ORDER BY ultimo_intento_en IS NOT NULL, ultimo_intento_en
     LIMIT ?
  `).all(MAX_INTENTOS, POR_RONDA);
}

async function procesar(){
  if (corriendo) return;
  corriendo = true;

  try {
    const lista = pendientes();
    for (const sesion of lista){
      db.prepare(`
        UPDATE sesiones
           SET intentos_calificacion = intentos_calificacion + 1,
               ultimo_intento_en = datetime('now')
         WHERE id = ?
      `).run(sesion.id);

      try {
        const resultado = await analizarTexto({
          sesionId: sesion.id,
          texto: sesion.texto_final,
          tema: sesion.tema,
          tipo: 'final'
        });

        if (!resultado.error){
          db.prepare("UPDATE sesiones SET estado = 'entregada' WHERE id = ?").run(sesion.id);
          console.log(`[cola] sesión ${sesion.id} calificada: ${resultado.notaGlobal}/100 ` +
                      `(intento ${sesion.intentos_calificacion + 1})`);
        } else {
          console.warn(`[cola] sesión ${sesion.id} sigue fallando ` +
                       `(intento ${sesion.intentos_calificacion + 1}/${MAX_INTENTOS}): ${resultado.causa}`);
        }
      } catch (err){
        console.warn(`[cola] sesión ${sesion.id} lanzó excepción: ${err.message}`);
      }
    }
  } finally {
    corriendo = false;
  }
}

export function iniciarCola(){
  if (temporizador) return;
  temporizador = setInterval(procesar, INTERVALO_MS);
  temporizador.unref?.();   // que no impida cerrar el proceso
  // Primera pasada poco después de arrancar, para recoger lo que quedó
  // pendiente de una sesión anterior del servidor.
  setTimeout(procesar, 8000).unref?.();
  console.log(`[cola] recalificación automática activa: cada ${INTERVALO_MS / 1000} s, hasta ${MAX_INTENTOS} intentos por sesión`);
}

// Estado de la cola, para que el front pueda decir algo honesto al participante.
export function estadoCola(){
  const fila = db.prepare(`
    SELECT COUNT(*) AS n FROM sesiones
     WHERE estado = 'revision_manual' AND texto_final IS NOT NULL
       AND intentos_calificacion < ?
  `).get(MAX_INTENTOS);

  const agotadas = db.prepare(`
    SELECT COUNT(*) AS n FROM sesiones
     WHERE estado = 'revision_manual' AND intentos_calificacion >= ?
  `).get(MAX_INTENTOS);

  return {
    enCola: Number(fila.n),
    agotadas: Number(agotadas.n),
    intervaloSegundos: INTERVALO_MS / 1000,
    maxIntentos: MAX_INTENTOS
  };
}
