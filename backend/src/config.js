import 'dotenv/config';
import path from 'node:path';

export const config = {
  puerto: Number(process.env.PORT || 3000),
  origenPermitido: process.env.ORIGEN_PERMITIDO || 'http://localhost:5500',
  dbRuta: path.resolve(process.env.DB_RUTA || './datos/estudio.db'),

  ia: {
    proveedor: process.env.IA_PROVEEDOR || 'simulado',
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      modelo: process.env.GEMINI_MODELO || 'gemini-3.5-flash-lite',
      // temperatura 0: sin esto la misma redacción saca notas distintas
      // en cada llamada y el estudio deja de ser replicable.
      temperatura: 0
    }
  },

  analisis: {
    // Mínimo de palabras para que valga la pena llamar a la IA.
    minimoPalabras: 30,
    // Un análisis en vivo solo se dispara si el texto creció al menos esto
    // desde el último análisis.
    palabrasDeltaMinimo: 30
  }
};
