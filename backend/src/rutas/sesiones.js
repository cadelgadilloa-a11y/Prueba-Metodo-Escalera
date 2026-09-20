import { Router } from 'express';
import { z } from 'zod';
import { db, obtenerOCrearParticipante, idInsertado } from '../db/index.js';
import { analizarTexto } from '../servicios/analizador.js';
import { calcularMetricas } from '../evaluacion/metricas.js';

export const rutasSesiones = Router();

const CrearSesion = z.object({
  nombre: z.string().min(2).max(120),
  ocupacion: z.string().max(200).optional(),
  fase: z.enum(['pre', 'post']),
  tema: z.string().max(300).optional(),
  modo: z.enum(['ciego', 'visible', 'practica']).default('ciego')
});

// POST /api/sesiones — abre una sesión de escritura.
rutasSesiones.post('/', (req, res) => {
  const parseado = CrearSesion.safeParse(req.body);
  if (!parseado.success){
    return res.status(400).json({ error: 'Datos inválidos', detalle: parseado.error.issues });
  }
  const { nombre, ocupacion, fase, tema, modo } = parseado.data;

  const participante = obtenerOCrearParticipante({ nombre, ocupacion });

  const existente = db.prepare(
    'SELECT * FROM sesiones WHERE participante_id = ? AND fase = ?'
  ).get(participante.id, fase);

  if (existente && existente.estado === 'entregada'){
    return res.status(409).json({
      error: `${participante.codigo} ya entregó la fase "${fase}".`,
      sesionId: existente.id
    });
  }

  if (existente){
    db.prepare('UPDATE sesiones SET tema = ?, modo = ? WHERE id = ?').run(tema || null, modo, existente.id);
    return res.json({ sesionId: existente.id, codigo: participante.codigo, reanudada: true });
  }

  const info = db.prepare(
    'INSERT INTO sesiones (participante_id, fase, tema, modo) VALUES (?, ?, ?, ?)'
  ).run(participante.id, fase, tema || null, modo);

  res.status(201).json({ sesionId: idInsertado(info), codigo: participante.codigo, reanudada: false });
});

// PATCH /api/sesiones/:id/borrador — autosave. Guarda un snapshot del proceso.
rutasSesiones.patch('/:id/borrador', (req, res) => {
  const sesion = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(req.params.id);
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (sesion.estado === 'entregada') return res.status(409).json({ error: 'La sesión ya fue entregada' });

  const { texto = '', segundos = 0 } = req.body || {};
  const palabras = calcularMetricas(texto).recuento.palabras;

  db.prepare(
    'INSERT INTO borradores (sesion_id, segundos, palabras, texto) VALUES (?, ?, ?, ?)'
  ).run(sesion.id, Number(segundos) || 0, palabras, texto);

  res.json({ guardado: true, palabras });
});

// POST /api/sesiones/:id/analizar — análisis parcial (Capa 1 + Capa 2).
rutasSesiones.post('/:id/analizar', async (req, res, next) => {
  try {
    const sesion = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(req.params.id);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    const { texto = '' } = req.body || {};
    const resultado = await analizarTexto({
      sesionId: sesion.id,
      texto,
      tema: sesion.tema,
      tipo: 'parcial'
    });

    // En modo ciego se analiza y se guarda, pero no se devuelve el juicio:
    // mostrarlo convertiría la retroalimentación en parte de la intervención
    // y contaminaría la comparación pre/post.
    if (sesion.modo === 'ciego'){
      return res.json({
        modo: 'ciego',
        registrado: true,
        recuento: resultado.metricas?.recuento ?? null
      });
    }

    res.json(resultado);
  } catch (err){
    if (err.name === 'AbortError') return res.status(499).json({ error: 'Análisis cancelado por uno más reciente' });
    next(err);
  }
});

// POST /api/sesiones/:id/entregar — cierra la sesión y califica.
rutasSesiones.post('/:id/entregar', async (req, res, next) => {
  try {
    const sesion = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(req.params.id);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (sesion.estado === 'entregada') return res.status(409).json({ error: 'La sesión ya fue entregada' });

    const { texto = '', segundos = 0 } = req.body || {};

    db.prepare(`
      UPDATE sesiones
         SET estado = 'entregada', entregada_en = datetime('now'),
             segundos_redaccion = ?, texto_final = ?
       WHERE id = ?
    `).run(Number(segundos) || 0, texto, sesion.id);

    const resultado = await analizarTexto({
      sesionId: sesion.id,
      texto,
      tema: sesion.tema,
      tipo: 'final'
    });

    res.json(resultado);
  } catch (err){
    next(err);
  }
});

// GET /api/sesiones/:id — estado de una sesión.
rutasSesiones.get('/:id', (req, res) => {
  const sesion = db.prepare(`
    SELECT s.*, p.codigo
      FROM sesiones s JOIN participantes p ON p.id = s.participante_id
     WHERE s.id = ?
  `).get(req.params.id);
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

  const analisis = db.prepare(
    'SELECT id, tipo, creado_en, palabras, nota_global, error FROM analisis WHERE sesion_id = ? ORDER BY id'
  ).all(sesion.id);

  res.json({ ...sesion, analisis });
});
