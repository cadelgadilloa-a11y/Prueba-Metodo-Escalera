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

## Cuando el proveedor de IA falla

El free tier de Gemini devuelve `503 UNAVAILABLE` ("high demand") de forma
intermitente, y esos fallos vienen **en rachas**: medido el 2026-10-01, una
misma petición tenía ~2/3 de éxito, pero cuando fallaba, fallaban también los
5 reintentos del analizador porque ocurren todos dentro de ~44 segundos, o sea
dentro de la misma racha.

Por eso hay dos niveles de reintento:

1. **Inmediato** — 5 intentos con esperas de 2, 5, 12 y 25 s, dentro de la misma
   petición. Resuelve los fallos aislados.
2. **Cola en segundo plano** (`servicios/cola.js`) — cada 90 s busca sesiones en
   `revision_manual` con texto guardado y vuelve a intentarlo, hasta 12 veces
   (~18 min). Esto es lo que cruza el borde de una racha.

El participante entrega, su texto queda guardado al instante, y la pantalla se
actualiza sola cuando la nota sale. `GET /api/salud` reporta el estado de la cola.

Cómo distinguir las causas, que se registran en la columna `error` de `analisis`:

| Código | Significa | Qué hacer |
|---|---|---|
| `503 UNAVAILABLE` | Modelo saturado, en rachas | Nada: la cola reintenta sola |
| `429` con `quotaId` `...PerDay...` | **Cuota diaria agotada** | Esperar el reinicio de cuota. Reintentar no sirve y la cola se detiene sola |
| `429` sin `PerDay` | Límite por minuto | Nada: se reintenta respetando el `retryDelay` del proveedor |
| `404 NOT_FOUND` | Modelo descontinuado | Cambiar `GEMINI_MODELO` |

### El límite del free tier es 20 peticiones al día POR MODELO

Medido el 2026-10-01 contra la API:

```
quotaId:  GenerateRequestsPerDayPerProjectPerModel-FreeTier
limit:    20
model:    gemini-3.5-flash
```

Esto condiciona el plan del estudio, no solo el código. Cada calificación final
es **una** petición, y cada análisis en vivo es **otra**. Con 20 al día:

- Modo `ciego` o `practica` sin análisis en vivo: ~20 entregas al día.
- Modo `visible`: muchas menos, porque cada pausa al escribir gasta una.

Para un estudio de 40 participantes × 2 fases (80 calificaciones) hacen falta
**4 días como mínimo** con un solo modelo, sin margen para reintentos. Opciones:

1. **Repartir la aplicación en varios días**, en modo `ciego`, llevando la cuenta.
2. **Activar facturación** en Google AI Studio. El volumen del estudio cuesta
   centavos, y desaparece el límite de 20/día.
3. **Otro proveedor** con free tier más amplio (p. ej. Groq). Implica escribir un
   adaptador nuevo en `src/ia/`, que es la parte fácil: el resto del sistema no
   cambia.

Lo que **no** sirve es repartir participantes entre modelos distintos para sumar
cuotas: notas producidas por modelos distintos no son comparables entre sí, y eso
destruiría la comparación pre/post.

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
- [x] **Ortografía.** Decidido: no se evalúa, y el corrector del navegador queda
      activo. Debe estar activo por igual en pre-test y post-test.
- [ ] **Fijar el modelo antes del primer participante real.** Ya hubo dos cambios
      forzados (`gemini-2.0-flash` descontinuado, `gemini-3.6-flash` saturado).
      Notas producidas por modelos distintos no son estrictamente comparables; la
      columna `ia_modelo` de `analisis` permite auditarlo.

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
