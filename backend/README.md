# Backend — Prueba de redacción (Investigación 3)

Analiza y califica textos de participantes aplicando los criterios del documento
**FpI III**. Pensado para correr en `localhost` durante la aplicación del estudio.

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env     # en Windows: copy .env.example .env
npm start
```

Arranca en `http://localhost:3000`. Verificar con `GET /api/salud`.

Por defecto usa el proveedor **`simulado`**, que no hace ninguna llamada de red.
Todo el sistema funciona de punta a punta sin configurar Gemini.

Para usar Gemini de verdad, en `.env`:

```
IA_PROVEEDOR=gemini
GEMINI_API_KEY=...
```

## Cómo se califica

La evaluación ocurre en **dos capas**, y esa separación es deliberada.

**Capa 1 — determinista** (`src/evaluacion/metricas.js`). Todo lo que se puede
contar con código: longitud de oraciones, conectores, palabras comodín,
densidad léxica, gerundios, voz pasiva, errores mecánicos de puntuación.
Es instantánea, gratis y **reproducible**: cualquiera puede recalcular estos
números y obtener exactamente los mismos. Cuatro de los trece parámetros se
califican aquí, sin IA.

**Capa 2 — juicio** (`src/ia/`). Los nueve parámetros restantes requieren
interpretación: si un conector es pertinente, si hay progresión temática, si el
texto converge en una tesis. La IA recibe las mediciones de la Capa 1 como
evidencia ya calculada, así que no tiene que contar: solo juzga.

Si la IA falla o devuelve algo que no valida contra el esquema, **no se inventa
una nota**: la sesión queda marcada como `revision_manual`.

## Reglas que no se pueden romper

Son decisiones metodológicas, no técnicas. Cambiarlas invalida el estudio.

1. **La IA nunca sabe si el texto es pre-test o post-test.** Si lo supiera,
   tendería a inflar la nota del post y el hallazgo central quedaría sesgado.
2. **La IA nunca recibe el nombre del participante**, solo su código (`P-017`).
   El nombre vive únicamente en la tabla `participantes`.
3. **`temperature: 0`.** Sin esto la misma redacción saca notas distintas en
   cada llamada y el estudio deja de ser replicable.
4. **Cada calificación guarda su trazabilidad**: versión de rúbrica, versión de
   prompt, proveedor, modelo y temperatura. Sin eso la nota no es defendible.
5. **La rúbrica no se cambia a mitad del estudio.** Si cambia, sube
   `RUBRICA_VERSION` y los datos de antes dejan de ser comparables con los de
   después. El endpoint de comparación avisa cuando detecta versiones distintas.

## Modos de sesión

El modo decide si el participante ve el análisis mientras escribe.

| Modo | Qué pasa |
|---|---|
| `ciego` (por defecto) | Se analiza y se guarda, pero no se le muestra nada. No contamina la comparación pre/post. |
| `visible` | El participante ve el análisis en vivo. Válido solo si se aplica igual en ambas fases. |
| `practica` | Ensayo, no cuenta para el estudio. |

Si la IA da retroalimentación mientras la persona escribe, esa retroalimentación
se vuelve parte de la intervención: ya no se mide el método, sino el método más
un tutor de IA. Por eso el default es `ciego`.

## Endpoints

```
GET    /api/salud
GET    /api/rubrica

POST   /api/sesiones                      abre sesión (nombre, fase, tema, modo)
GET    /api/sesiones/:id
PATCH  /api/sesiones/:id/borrador         autosave (snapshot del proceso)
POST   /api/sesiones/:id/analizar         análisis parcial
POST   /api/sesiones/:id/entregar         cierra y califica
GET    /api/sesiones/:id/proceso          snapshots del borrador

GET    /api/participantes/:codigo/comparar   pre vs post
GET    /api/export.csv                       para SPSS / R / Excel
```

La comparación pre/post se resuelve **en el servidor**. El `localStorage` del
front no podía hacerlo: si el post-test se hacía en otro computador, se perdía.

Los snapshots de `borradores` son datos de **proceso** (pausas, reescrituras, en
qué momento aparece la conclusión). Para una investigación sobre método de
escritura pueden valer más que la nota final.

## La rúbrica

`src/evaluacion/rubrica.js` es **el instrumento de medición**, expresado como
datos: dimensiones, pesos y descriptores. El prompt, el esquema de validación y
las columnas del CSV se generan a partir de ese archivo. Cambiar de rúbrica es
editar un archivo, sin tocar código.

Trece parámetros en cinco dimensiones, tomados de la sección "Síntesis de
parámetros" del PDF.

## Pendientes antes de aplicar la prueba real

Están marcados en el código con `SUPUESTO` y `DERIVADO`.

- [ ] **Pesos de las dimensiones.** El PDF solo asigna peso explícito a Sintaxis
      (20%). Se repartió 20% a cada una de las cinco. Confirmar.
      (`PESOS_CONFIRMADOS = false` en `rubrica.js`; el servidor lo avisa al arrancar.)
- [ ] **Descriptores de nivel.** El PDF define *qué* medir, no *qué cuenta como
      bueno*. Los descriptores 1/3/5 se redactaron a partir de la prosa del
      documento. Validar con el director.
- [ ] **Cortes numéricos** marcados `DERIVADO` en `metricas.js` (los marcados
      `FUENTE:PDF` sí son literales: rango 15-30, límite 45, objetivo 80% de voz activa).
- [ ] **Escala del texto.** El PDF está escrito para textos académicos extensos
      (habla de capítulos, secciones, hipótesis, marco teórico). La app pide una
      cuartilla de 220-300 palabras. Dos parámetros se reinterpretaron a nivel de
      párrafo (`adaptadoACuartilla: true`). Decidir si la consigna al participante
      debe pedir explícitamente registro académico.
- [ ] **Ortografía.** No aparece entre los parámetros del PDF, y el front
      desactiva el corrector a propósito. Confirmar si se evalúa o no.

## Estructura

```
src/
├── server.js              Express, CORS, rate limit
├── config.js              lee .env
├── db/
│   ├── schema.sql         participantes, sesiones, borradores, analisis
│   └── index.js
├── evaluacion/
│   ├── rubrica.js         ← el instrumento: 13 parámetros, pesos, descriptores
│   ├── metricas.js        ← Capa 1 determinista
│   ├── esquema.js         validación estricta de la respuesta de la IA
│   └── prompt.js          prompt versionado
├── ia/
│   ├── index.js           selector de proveedor
│   ├── simulado.js        sin red, para desarrollar
│   └── gemini.js          structured output
├── servicios/
│   └── analizador.js      orquesta capas, caché, cancelación, trazabilidad
└── rutas/
    ├── sesiones.js
    └── datos.js           comparación y export CSV
```
