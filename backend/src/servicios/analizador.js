// Orquestador del análisis: junta la Capa 1 (determinista) con la Capa 2 (IA),
// valida la respuesta y guarda todo con su trazabilidad.

import crypto from 'node:crypto';
import { db, idInsertado } from '../db/index.js';
import { config } from '../config.js';
import { obtenerProveedor } from '../ia/index.js';
import { calcularMetricas, puntuarDeterministas } from '../evaluacion/metricas.js';
import { construirPrompt, PROMPT_VERSION } from '../evaluacion/prompt.js';
import { EsquemaAnalisis } from '../evaluacion/esquema.js';
import { RUBRICA_VERSION, calcularNotaGlobal, DIMENSIONES } from '../evaluacion/rubrica.js';

function hashear(texto){
  return crypto.createHash('sha256').update(texto).digest('hex').slice(0, 16);
}

// Solo una llamada a la IA en vuelo por sesión. Si llega otra, se cancela la
// anterior: el texto ya cambió, su resultado llegaría obsoleto.
const enVuelo = new Map();

const esperar = ms => new Promise(r => setTimeout(r, ms));

// Reintenta los fallos pasajeros del proveedor (503 por saturación, 5xx, 429).
// Un participante no debería quedarse sin nota porque el modelo estaba ocupado
// tres segundos. Los errores permanentes (404 de modelo inexistente, 400 de
// petición mal formada, 401 de key inválida) NO se reintentan: fallan de una.
async function llamarConReintentos(proveedor, argumentos, intentos = 3){
  let ultimoError;
  for (let intento = 1; intento <= intentos; intento++){
    try {
      return await proveedor.analizar(argumentos);
    } catch (err){
      if (err.name === 'AbortError') throw err;
      if (!err.esTransitorio || intento === intentos) throw err;
      ultimoError = err;
      const espera = 1500 * intento; // 1.5 s, luego 3 s
      console.warn(`[ia] intento ${intento}/${intentos} falló (${err.status}); reintentando en ${espera} ms`);
      await esperar(espera);
    }
  }
  throw ultimoError;
}

export async function analizarTexto({ sesionId, texto, tema, tipo = 'parcial' }){
  const metricas = calcularMetricas(texto);
  const puntajesDeterministas = puntuarDeterministas(metricas);
  const textoHash = hashear(texto);

  // Texto idéntico ya analizado: se devuelve lo guardado sin gastar cuota.
  const previo = db.prepare(
    'SELECT * FROM analisis WHERE sesion_id = ? AND texto_hash = ? AND error IS NULL ORDER BY id DESC LIMIT 1'
  ).get(sesionId, textoHash);

  if (previo && tipo === 'parcial'){
    return { ...formatearGuardado(previo), desdeCache: true };
  }

  if (metricas.recuento.palabras < config.analisis.minimoPalabras){
    return {
      suficiente: false,
      metricas,
      mensaje: `Se necesitan al menos ${config.analisis.minimoPalabras} palabras para analizar.`
    };
  }

  // Cancela el análisis anterior de esta misma sesión, si sigue corriendo.
  enVuelo.get(sesionId)?.abort();
  const control = new AbortController();
  enVuelo.set(sesionId, control);

  const proveedor = obtenerProveedor();
  const prompt = construirPrompt({ texto, tema, metricas });

  let resultadoIA = null;
  let errorIA = null;

  try {
    const bruto = await llamarConReintentos(proveedor, { prompt, metricas, señal: control.signal });

    // Validación estricta. Si la IA devolvió algo que no encaja con el esquema,
    // NO se inventa una nota: se marca para revisión manual.
    const validado = EsquemaAnalisis.safeParse(bruto.respuesta);
    if (!validado.success){
      errorIA = `Respuesta de la IA no válida: ${validado.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`;
    } else {
      resultadoIA = { datos: validado.data, meta: bruto.meta };
    }
  } catch (err){
    if (err.name === 'AbortError') throw err;
    errorIA = err.esCuota
      ? `Cuota del proveedor agotada: ${err.message}`
      : `Fallo al llamar a la IA: ${err.message}`;
  } finally {
    if (enVuelo.get(sesionId) === control) enVuelo.delete(sesionId);
  }

  const puntajes = { ...puntajesDeterministas };
  if (resultadoIA){
    for (const [id, evaluacion] of Object.entries(resultadoIA.datos.parametros)){
      puntajes[id] = evaluacion.puntaje;
    }
  }

  // La nota solo existe si TODOS los parámetros tienen puntaje. Una nota
  // calculada a medias sería un dato falso en el estudio.
  const completo = !errorIA && Object.keys(puntajes).length === DIMENSIONES.flatMap(d => d.parametros).length;
  const notaGlobal = completo ? calcularNotaGlobal(puntajes) : null;

  const meta = resultadoIA?.meta || {};
  const info = db.prepare(`
    INSERT INTO analisis (
      sesion_id, tipo, palabras, texto_hash, nota_global,
      puntajes_json, metricas_json, ia_json,
      rubrica_version, prompt_version, ia_proveedor, ia_modelo, ia_temperatura,
      tokens_entrada, tokens_salida, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sesionId, tipo, metricas.recuento.palabras, textoHash, notaGlobal,
    JSON.stringify(puntajes), JSON.stringify(metricas),
    resultadoIA ? JSON.stringify(resultadoIA.datos) : null,
    RUBRICA_VERSION, resultadoIA ? PROMPT_VERSION : null,
    meta.proveedor || proveedor.nombre, meta.modelo || null, meta.temperatura ?? null,
    meta.tokensEntrada ?? null, meta.tokensSalida ?? null,
    errorIA
  );

  if (errorIA && tipo === 'final'){
    db.prepare("UPDATE sesiones SET estado = 'revision_manual' WHERE id = ?").run(sesionId);
  }

  return {
    suficiente: true,
    analisisId: idInsertado(info),
    notaGlobal,
    puntajes,
    metricas,
    ia: resultadoIA?.datos || null,
    error: errorIA,
    trazabilidad: {
      rubricaVersion: RUBRICA_VERSION,
      promptVersion: resultadoIA ? PROMPT_VERSION : null,
      proveedor: meta.proveedor || proveedor.nombre,
      modelo: meta.modelo || null
    }
  };
}

function formatearGuardado(fila){
  return {
    suficiente: true,
    analisisId: fila.id,
    notaGlobal: fila.nota_global,
    puntajes: JSON.parse(fila.puntajes_json),
    metricas: JSON.parse(fila.metricas_json),
    ia: fila.ia_json ? JSON.parse(fila.ia_json) : null,
    error: fila.error,
    trazabilidad: {
      rubricaVersion: fila.rubrica_version,
      promptVersion: fila.prompt_version,
      proveedor: fila.ia_proveedor,
      modelo: fila.ia_modelo
    }
  };
}
