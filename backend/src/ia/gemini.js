// Proveedor Gemini.
//
// Usa structured output (responseSchema): la API garantiza que la respuesta sea
// un JSON con la forma del esquema. Eso elimina el problema más común de este
// tipo de backend, que es el modelo devolviendo texto suelto o JSON roto.
//
// NOTA: el nombre del modelo y los límites del free tier cambian con el tiempo.
// Verificar en la documentación oficial antes de aplicar la prueba real.

import { config } from '../config.js';
import { esquemaJsonParaGemini } from '../evaluacion/esquema.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function analizar({ prompt, señal }){
  const { apiKey, modelo, temperatura } = config.ia.gemini;

  if (!apiKey){
    throw new Error('Falta GEMINI_API_KEY en el archivo .env');
  }

  const cuerpo = {
    systemInstruction: {
      parts: [{ text: prompt.instrucciones }]
    },
    contents: [
      { role: 'user', parts: [{ text: prompt.contenido }] }
    ],
    generationConfig: {
      temperature: temperatura,
      responseMimeType: 'application/json',
      responseSchema: esquemaJsonParaGemini()
    }
  };

  // Timeout explícito: medido el 2026-09-20, una calificación completa con
  // gemini-3.5-flash puede tardar casi 60 s. Sin techo, una petición colgada
  // bloquearía el turno del participante indefinidamente.
  const porTiempo = AbortSignal.timeout(120000);
  const combinada = señal ? AbortSignal.any([señal, porTiempo]) : porTiempo;

  let res;
  try {
    res = await fetch(`${BASE}/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(cuerpo),
      signal: combinada
    });
  } catch (err){
    // Si quien canceló fue el analizador (texto nuevo), se propaga tal cual.
    if (señal?.aborted) throw err;
    // Un timeout o un fallo de red sí merecen reintento.
    const fallo = new Error(
      err.name === 'TimeoutError'
        ? `Gemini no respondió en 120 s (modelo ${modelo})`
        : `No se pudo contactar a Gemini: ${err.message}`
    );
    fallo.esTransitorio = true;
    throw fallo;
  }

  if (!res.ok){
    const detalle = await res.text().catch(() => '');
    const err = new Error(`Gemini respondió ${res.status}: ${detalle.slice(0, 300)}`);
    err.status = res.status;
    // 429 = cuota agotada.
    err.esCuota = res.status === 429;
    // Errores pasajeros: el modelo saturado (503) o un fallo interno del
    // proveedor. Reintentar unos segundos después suele funcionar, y evita
    // dejar sin nota a un participante por algo que no tiene que ver con él.
    err.esTransitorio = [429, 500, 502, 503, 504].includes(res.status);
    throw err;
  }

  const datos = await res.json();
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!texto){
    const motivo = datos?.candidates?.[0]?.finishReason || 'desconocido';
    throw new Error(`Gemini no devolvió contenido (finishReason: ${motivo})`);
  }

  return {
    respuesta: JSON.parse(texto),
    meta: {
      proveedor: 'gemini',
      modelo,
      temperatura,
      tokensEntrada: datos?.usageMetadata?.promptTokenCount ?? null,
      tokensSalida: datos?.usageMetadata?.candidatesTokenCount ?? null,
      crudo: texto
    }
  };
}
