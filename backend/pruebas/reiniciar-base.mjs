// Borra TODOS los datos del estudio. Solo para probar.
//
// Existe porque al probar se choca constantemente con el 409 "ya entregó esta
// fase": el servidor protege las entregas para que no se sobrescriban, lo cual
// es correcto para el estudio pero incómodo mientras se ensaya.
//
// Pide confirmación explícita a propósito. Con participantes reales, perder
// esta base es perder el estudio.
//
//   node pruebas/reiniciar-base.mjs --si-estoy-seguro

import { db } from '../src/db/index.js';

const confirmado = process.argv.includes('--si-estoy-seguro');

const participantes = db.prepare('SELECT COUNT(*) AS n FROM participantes').get();
const sesiones = db.prepare('SELECT COUNT(*) AS n FROM sesiones').get();
const entregadas = db.prepare("SELECT COUNT(*) AS n FROM sesiones WHERE estado IN ('entregada','revision_manual')").get();

console.log('Contenido actual de la base:');
console.log(`  participantes      : ${participantes.n}`);
console.log(`  sesiones           : ${sesiones.n}`);
console.log(`  de ellas, cerradas : ${entregadas.n}`);

if (!confirmado){
  console.log('\nNo se borró nada.');
  console.log('Para borrar de verdad:  node pruebas/reiniciar-base.mjs --si-estoy-seguro');
  process.exit(0);
}

// El orden importa por las claves foráneas.
db.exec('DELETE FROM analisis');
db.exec('DELETE FROM borradores');
db.exec('DELETE FROM sesiones');
db.exec('DELETE FROM participantes');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('analisis','borradores','sesiones','participantes')");

console.log('\nBase vacía. Los códigos de participante vuelven a empezar en P-001.');
