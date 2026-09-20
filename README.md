# Prueba de Redacción — Método Escalera

Instrumento de captura y evaluación de textos para un estudio con diseño
**pre-test / post-test** sobre el método escalera, en el marco de Investigación 3.

El participante escribe un texto tipo cuartilla (220–300 palabras) sobre un tema
asignado. El sistema mide su redacción contra una rúbrica de 11 parámetros y
compara el resultado antes y después de la intervención.

## Cómo está armado

```
index.html · api.js · script.js · styles.css    front-end, sin build ni dependencias
backend/                                         Node 22 + Express + SQLite + Gemini
FpI III.pdf                                      documento fuente de la rúbrica
```

## Puesta en marcha

**1. Backend**

```bash
cd backend
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

Edita `backend/.env` y pon tu API key de Gemini (se obtiene gratis en
`aistudio.google.com/apikey`):

```
IA_PROVEEDOR=gemini
GEMINI_API_KEY=tu_key
```

Luego:

```bash
npm start
```

Sin key también funciona: con `IA_PROVEEDOR=simulado` el sistema corre completo
sin hacer ninguna llamada de red, útil para desarrollar.

**2. Front-end**

Tiene que servirse por HTTP. Si abres `index.html` con doble clic, el navegador
usa `file://` y CORS bloquea todas las peticiones al backend.

Lo más simple es la extensión **Live Server** de VS Code, que sirve en
`http://localhost:5500` — justo el origen que el backend permite por defecto. Si
usas otro puerto, ajústalo en `ORIGEN_PERMITIDO` dentro de `backend/.env`.

Si arriba a la izquierda aparece *"Servidor conectado"*, está todo listo.

## Cómo se evalúa

La calificación ocurre en dos capas:

- **Determinista** — longitud de oraciones, conectores, palabras comodín,
  densidad léxica, gerundios, voz pasiva, errores de puntuación. Lo calcula
  código, no IA: es instantáneo, gratis y cualquiera puede recalcularlo y
  obtener el mismo número.
- **Juicio** — coherencia, estructura, pertinencia de los conectores. Ahí sí
  interviene el modelo de lenguaje, que recibe las mediciones de la primera capa
  como evidencia ya calculada.

Si la IA falla o devuelve algo inválido, el sistema **no inventa una nota**: deja
la sesión marcada para revisión manual.

Los detalles de la rúbrica, los endpoints y las reglas metodológicas están en
[`backend/README.md`](backend/README.md).

## Modos de sesión

El modo decide si el participante ve el análisis mientras escribe:

- **`ciego`** (por defecto) — se analiza y se guarda, pero no se le muestra nada.
- **`visible`** — ve el análisis en vivo.
- **`practica`** — ensayo, no cuenta para el estudio.

El default es `ciego` a propósito: si la IA le da retroalimentación mientras
escribe, esa retroalimentación pasa a ser parte de la intervención y la
comparación pre/post deja de medir solo el método.

## Sobre los datos

La base de datos (`backend/datos/`) contiene nombres y textos de participantes, y
está excluida del repositorio. Lo que se manda a la IA nunca incluye el nombre:
solo un código (`P-017`).

## Limitación del diseño

Es un diseño de un solo grupo: cada persona se compara consigo misma antes y
después. Sin grupo de control, la mejora observada incluye el efecto de haber
practicado escribiendo dos veces, que no se puede separar del efecto del método.
