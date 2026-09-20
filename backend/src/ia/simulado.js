// Proveedor simulado: no hace ninguna llamada de red.
//
// Devuelve un análisis con la forma EXACTA del esquema, derivando los puntajes
// de las métricas deterministas. Sirve para construir y probar todo el sistema
// —rutas, base de datos, comparación pre/post, front-end— sin gastar cuota y
// sin depender de que la IA esté configurada.
//
// Los puntajes que produce son plausibles pero NO son una evaluación real.
// Nunca debe usarse para calificar a un participante del estudio.

import { PARAMETROS_IA } from '../evaluacion/rubrica.js';

function puntajePlausible(parametroId, m){
  switch (parametroId){
    case 'conectores_logicos':
      if (m.conectores.totalConectores === 0) return 1;
      return Math.min(5, 2 + m.conectores.tiposDistintos);

    case 'voz_activa':
      return m.voz.ratioActiva >= 0.80 ? 5 : m.voz.ratioActiva >= 0.65 ? 4 : m.voz.ratioActiva >= 0.5 ? 3 : 2;

    case 'gerundios':
      if (m.gerundios.sospechosos >= 2) return 1;
      if (m.gerundios.sospechosos === 1) return 3;
      return 5;

    case 'puntuacion_concordancia':
      if (m.puntuacion.total === 0) return 5;
      return m.puntuacion.total <= 2 ? 4 : m.puntuacion.total <= 5 ? 3 : 2;

    case 'variedad_oracional':
      return m.extension.desviacion >= 8 ? 5 : m.extension.desviacion >= 5 ? 4 : m.extension.desviacion >= 3 ? 3 : 2;

    case 'estructura_textual':
      return m.recuento.parrafos >= 3 ? 4 : m.recuento.parrafos === 2 ? 3 : 2;

    case 'coherencia_global': {
      const s = m.progresion.solapamientoPromedio;
      if (s === null) return 2;
      return s >= 0.12 ? 5 : s >= 0.08 ? 4 : s >= 0.04 ? 3 : 2;
    }

    default:
      return 3;
  }
}

export async function analizar({ metricas }){
  const parametros = {};
  for (const p of PARAMETROS_IA){
    parametros[p.id] = {
      puntaje: puntajePlausible(p.id, metricas),
      justificacion: `[SIMULADO] Puntaje derivado de las métricas deterministas, no de una evaluación real del parámetro "${p.nombre}".`,
      evidencia: []
    };
  }

  return {
    respuesta: {
      parametros,
      fortalezas: ['[SIMULADO] Sin evaluación real de fortalezas.'],
      mejoras: ['[SIMULADO] Sin evaluación real de mejoras.']
    },
    meta: {
      proveedor: 'simulado',
      modelo: 'simulado',
      temperatura: null,
      tokensEntrada: null,
      tokensSalida: null,
      crudo: null
    }
  };
}
