// Se usa el SQLite incorporado de Node (node:sqlite, Node 20.19+ / 22+) en vez
// de better-sqlite3. Motivo: better-sqlite3 es una dependencia nativa que en
// este equipo tardó 14 minutos compilando desde fuente, y en una máquina sin
// las herramientas de compilación de Visual Studio puede fallar del todo. Para
// un instrumento que tiene que arrancar en cualquier computador donde se
// aplique la prueba, cero compilación vale más.
//
// node:sqlite está marcado como experimental: fijar la versión de Node durante
// todo el estudio (este proyecto se desarrolló con Node 22.17).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.dbRuta), { recursive: true });

export const db = new DatabaseSync(config.dbRuta);
db.exec(fs.readFileSync(path.join(aqui, 'schema.sql'), 'utf8'));

// node:sqlite puede devolver lastInsertRowid como BigInt.
export function idInsertado(info){
  return Number(info.lastInsertRowid);
}

// Asigna el siguiente código correlativo (P-001, P-002...).
export function siguienteCodigo(){
  const fila = db.prepare('SELECT COUNT(*) AS n FROM participantes').get();
  return `P-${String(Number(fila.n) + 1).padStart(3, '0')}`;
}

// Busca un participante por nombre normalizado, o lo crea.
// Así el mismo participante en pre y post queda unido aunque escriba el
// nombre con distinta capitalización o espacios.
export function obtenerOCrearParticipante({ nombre, ocupacion }){
  const normalizado = nombre.trim().replace(/\s+/g, ' ');

  const existente = db.prepare(
    "SELECT * FROM participantes WHERE lower(nombre) = lower(?)"
  ).get(normalizado);

  if (existente){
    if (ocupacion && !existente.ocupacion){
      db.prepare('UPDATE participantes SET ocupacion = ? WHERE id = ?').run(ocupacion, existente.id);
    }
    return existente;
  }

  const codigo = siguienteCodigo();
  const info = db.prepare(
    'INSERT INTO participantes (codigo, nombre, ocupacion) VALUES (?, ?, ?)'
  ).run(codigo, normalizado, ocupacion || null);

  return db.prepare('SELECT * FROM participantes WHERE id = ?').get(idInsertado(info));
}
