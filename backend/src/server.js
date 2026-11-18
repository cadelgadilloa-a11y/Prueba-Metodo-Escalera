import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { rutasSesiones } from './rutas/sesiones.js';
import { rutasDatos } from './rutas/datos.js';
import { RUBRICA_VERSION, PESOS_CONFIRMADOS } from './evaluacion/rubrica.js';
import { iniciarCola, estadoCola } from './servicios/cola.js';

const app = express();

// En la nube (Railway, Render) el backend está detrás de un proxy. Sin esto
// todas las peticiones parecen venir de la misma IP y el límite de 60/min se
// aplicaría a todos los participantes juntos, no a cada uno.
app.set('trust proxy', 1);

app.use(cors({ origin: config.origenPermitido }));
app.use(express.json({ limit: '1mb' }));

// Freno para no agotar el free tier del proveedor de IA de golpe.
app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Espera un momento.' }
}));

app.get('/api/salud', (_req, res) => {
  res.json({
    ok: true,
    proveedorIA: config.ia.proveedor,
    rubricaVersion: RUBRICA_VERSION,
    pesosConfirmados: PESOS_CONFIRMADOS,
    modelo: config.ia.proveedor === 'gemini' ? config.ia.gemini.modelo : null,
    cola: estadoCola()
  });
});

app.use('/api/sesiones', rutasSesiones);
app.use('/api', rutasDatos);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno', detalle: err.message });
});

app.listen(config.puerto, () => {
  iniciarCola();
  console.log(`\n  Backend de la prueba de redacción`);
  console.log(`  http://localhost:${config.puerto}`);
  console.log(`  Proveedor de IA : ${config.ia.proveedor}`);
  console.log(`  Rúbrica         : ${RUBRICA_VERSION}`);
  if (!PESOS_CONFIRMADOS){
    console.log(`\n  AVISO: los pesos de la rúbrica son un supuesto (20% por dimensión).`);
    console.log(`  Confírmalos antes de aplicar la prueba a participantes reales.\n`);
  }
});
