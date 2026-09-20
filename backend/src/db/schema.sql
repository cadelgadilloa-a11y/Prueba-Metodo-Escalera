-- Esquema de la base de datos del estudio.
--
-- Decisión de diseño: el nombre del participante vive SOLO en la tabla
-- participantes. Todo lo demás lo referencia por codigo (P-001). Lo que se
-- envía a la IA nunca incluye la tabla participantes.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS participantes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT    NOT NULL UNIQUE,      -- P-001, P-002...
  nombre      TEXT    NOT NULL,
  ocupacion   TEXT,
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  participante_id  INTEGER NOT NULL REFERENCES participantes(id),
  fase             TEXT    NOT NULL CHECK (fase IN ('pre','post')),
  tema             TEXT,
  -- 'ciego'    = se analiza pero no se le muestra nada al participante
  -- 'visible'  = el participante ve el análisis en vivo
  -- 'practica' = ensayo, no cuenta para el estudio
  modo             TEXT    NOT NULL DEFAULT 'ciego' CHECK (modo IN ('ciego','visible','practica')),
  estado           TEXT    NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','entregada','revision_manual')),
  iniciada_en      TEXT    NOT NULL DEFAULT (datetime('now')),
  entregada_en     TEXT,
  segundos_redaccion INTEGER,
  texto_final      TEXT,
  UNIQUE (participante_id, fase)
);

-- Autosave del borrador. Es lo que convierte el estudio en datos de PROCESO y
-- no solo de producto: pausas, reescrituras, cuándo aparece la conclusión.
CREATE TABLE IF NOT EXISTS borradores (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id    INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  momento      TEXT    NOT NULL DEFAULT (datetime('now')),
  segundos     INTEGER NOT NULL,
  palabras     INTEGER NOT NULL,
  texto        TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_borradores_sesion ON borradores(sesion_id, momento);

-- Cada calificación producida, parcial o final.
CREATE TABLE IF NOT EXISTS analisis (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id        INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  tipo             TEXT    NOT NULL CHECK (tipo IN ('parcial','final')),
  creado_en        TEXT    NOT NULL DEFAULT (datetime('now')),
  palabras         INTEGER NOT NULL,
  texto_hash       TEXT    NOT NULL,        -- para no re-analizar texto idéntico
  nota_global      INTEGER,
  puntajes_json    TEXT    NOT NULL,        -- puntaje por parámetro
  metricas_json    TEXT    NOT NULL,        -- capa 1 completa
  ia_json          TEXT,                    -- respuesta de la IA ya validada
  -- Trazabilidad: sin estos campos la calificación no es defendible.
  rubrica_version  TEXT    NOT NULL,
  prompt_version   TEXT,
  ia_proveedor     TEXT,
  ia_modelo        TEXT,
  ia_temperatura   REAL,
  tokens_entrada   INTEGER,
  tokens_salida    INTEGER,
  error            TEXT                     -- si la IA falló, queda registrado
);
CREATE INDEX IF NOT EXISTS idx_analisis_sesion ON analisis(sesion_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_analisis_hash ON analisis(sesion_id, texto_hash);
