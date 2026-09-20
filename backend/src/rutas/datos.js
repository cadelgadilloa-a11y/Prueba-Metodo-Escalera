// Rutas de lectura: comparación pre/post y exportación para análisis estadístico.

import { Router } from 'express';
import { db } from '../db/index.js';
import { DIMENSIONES, TODOS_LOS_PARAMETROS, RUBRICA_VERSION, PESOS_CONFIRMADOS } from '../evaluacion/rubrica.js';

export const rutasDatos = Router();

// GET /api/rubrica — el front la usa para dibujar los resultados sin duplicar
// la definición de dimensiones y pesos.
rutasDatos.get('/rubrica', (_req, res) => {
  res.json({ version: RUBRICA_VERSION, pesosConfirmados: PESOS_CONFIRMADOS, dimensiones: DIMENSIONES });
});

function analisisFinalDe(sesionId){
  return db.prepare(
    "SELECT * FROM analisis WHERE sesion_id = ? AND tipo = 'final' ORDER BY id DESC LIMIT 1"
  ).get(sesionId);
}

// GET /api/participantes/:codigo/comparar — pre vs post, desde el servidor.
// Esto es lo que el localStorage del front no puede hacer: si el pre-test se
// hizo en otro computador, ahí se perdía.
rutasDatos.get('/participantes/:codigo/comparar', (req, res) => {
  const participante = db.prepare('SELECT * FROM participantes WHERE codigo = ?').get(req.params.codigo);
  if (!participante) return res.status(404).json({ error: 'Participante no encontrado' });

  const sesiones = db.prepare(
    'SELECT * FROM sesiones WHERE participante_id = ?'
  ).all(participante.id);

  const porFase = {};
  for (const fase of ['pre', 'post']){
    const sesion = sesiones.find(s => s.fase === fase);
    if (!sesion || sesion.estado !== 'entregada'){ porFase[fase] = null; continue; }

    const analisis = analisisFinalDe(sesion.id);
    porFase[fase] = {
      sesionId: sesion.id,
      tema: sesion.tema,
      segundos: sesion.segundos_redaccion,
      entregadaEn: sesion.entregada_en,
      notaGlobal: analisis?.nota_global ?? null,
      puntajes: analisis?.puntajes_json ? JSON.parse(analisis.puntajes_json) : null,
      recuento: analisis?.metricas_json ? JSON.parse(analisis.metricas_json).recuento : null,
      rubricaVersion: analisis?.rubrica_version ?? null
    };
  }

  // Aviso metodológico: comparar notas producidas con rúbricas distintas no es válido.
  const versiones = [porFase.pre?.rubricaVersion, porFase.post?.rubricaVersion].filter(Boolean);
  const mismaRubrica = versiones.length < 2 || versiones[0] === versiones[1];

  let delta = null;
  if (porFase.pre?.notaGlobal != null && porFase.post?.notaGlobal != null){
    delta = {
      notaGlobal: porFase.post.notaGlobal - porFase.pre.notaGlobal,
      porParametro: Object.fromEntries(
        TODOS_LOS_PARAMETROS
          .filter(p => porFase.pre.puntajes?.[p.id] != null && porFase.post.puntajes?.[p.id] != null)
          .map(p => [p.id, porFase.post.puntajes[p.id] - porFase.pre.puntajes[p.id]])
      )
    };
  }

  res.json({
    participante: { codigo: participante.codigo, ocupacion: participante.ocupacion },
    pre: porFase.pre,
    post: porFase.post,
    delta,
    advertencia: mismaRubrica ? null : 'Las dos fases se calificaron con versiones distintas de la rúbrica. No son comparables.'
  });
});

// GET /api/export.csv — una fila por sesión cerrada, lista para SPSS o R.
// Incluye las que quedaron en 'revision_manual': si la IA falló, esa sesión
// SIGUE siendo un dato del estudio (el texto existe y las métricas
// deterministas se calcularon). Excluirla haría desaparecer participantes de
// la muestra sin dejar rastro. La columna `estado` y la columna `error` dicen
// cuáles necesitan calificación a mano.
rutasDatos.get('/export.csv', (_req, res) => {
  const filas = db.prepare(`
    SELECT p.codigo, p.ocupacion, s.fase, s.tema, s.modo, s.estado,
           s.segundos_redaccion, s.entregada_en,
           a.nota_global, a.palabras, a.puntajes_json,
           a.metricas_json, a.rubrica_version, a.prompt_version,
           a.ia_proveedor, a.ia_modelo, a.error
      FROM sesiones s
      JOIN participantes p ON p.id = s.participante_id
      LEFT JOIN analisis a ON a.id = (
        SELECT id FROM analisis WHERE sesion_id = s.id AND tipo = 'final' ORDER BY id DESC LIMIT 1
      )
     WHERE s.estado IN ('entregada', 'revision_manual')
     ORDER BY p.codigo, s.fase
  `).all();

  const columnasParametro = TODOS_LOS_PARAMETROS.map(p => p.id);
  const encabezado = [
    'codigo','ocupacion','fase','tema','modo','estado','segundos','entregada_en',
    'nota_global','palabras','oraciones','parrafos',
    ...columnasParametro,
    'ratio_activa','promedio_oracion','densidad','rubrica_version','prompt_version',
    'ia_proveedor','ia_modelo','error'
  ];

  const escapar = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lineas = [encabezado.join(',')];
  for (const f of filas){
    const puntajes = f.puntajes_json ? JSON.parse(f.puntajes_json) : {};
    const metricas = f.metricas_json ? JSON.parse(f.metricas_json) : null;

    lineas.push([
      f.codigo, f.ocupacion, f.fase, f.tema, f.modo, f.estado, f.segundos_redaccion, f.entregada_en,
      f.nota_global, f.palabras,
      metricas?.recuento.oraciones, metricas?.recuento.parrafos,
      ...columnasParametro.map(id => puntajes[id] ?? ''),
      metricas ? metricas.voz.ratioActiva.toFixed(3) : '',
      metricas ? metricas.extension.promedio : '',
      metricas ? metricas.densidad.ratioDensidad.toFixed(3) : '',
      f.rubrica_version, f.prompt_version, f.ia_proveedor, f.ia_modelo, f.error
    ].map(escapar).join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="estudio-escalera.csv"');
  // BOM para que Excel en Windows respete los acentos.
  res.send('﻿' + lineas.join('\n'));
});

// GET /api/sesiones/:id/proceso — snapshots del borrador (datos de proceso).
rutasDatos.get('/sesiones/:id/proceso', (req, res) => {
  const filas = db.prepare(
    'SELECT momento, segundos, palabras FROM borradores WHERE sesion_id = ? ORDER BY id'
  ).all(req.params.id);
  res.json({ snapshots: filas });
});
