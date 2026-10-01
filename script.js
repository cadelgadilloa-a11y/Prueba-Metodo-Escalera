// Referencias a los elementos del HTML
const topicSelect      = document.getElementById('topicSelect');
const customTopic      = document.getElementById('customTopic');
const promptDisplay    = document.getElementById('promptDisplay');
const phaseSelect      = document.getElementById('phaseSelect');
const modeSelect       = document.getElementById('modeSelect');

const studentName       = document.getElementById('studentName');
const studentOccupation = document.getElementById('studentOccupation');
const connStatus        = document.getElementById('connStatus');
const participantCode   = document.getElementById('participantCode');

const editor           = document.getElementById('editor');
const wordCountEl      = document.getElementById('wordCount');
const paragraphCountEl = document.getElementById('paragraphCount');

const timerEl          = document.getElementById('timer');
const pauseBtn         = document.getElementById('pauseBtn');
const resetBtn         = document.getElementById('resetBtn');

const lengthMeter       = document.getElementById('lengthMeter');
const lengthHint        = document.getElementById('lengthHint');

const submitBtn          = document.getElementById('submitBtn');
const confirmation       = document.getElementById('confirmation');
const confirmStudent     = document.getElementById('confirmStudent');
const confirmTopic       = document.getElementById('confirmTopic');
const confirmTime        = document.getElementById('confirmTime');
const confirmWords       = document.getElementById('confirmWords');
const confirmParagraphs  = document.getElementById('confirmParagraphs');
const confirmGrade       = document.getElementById('confirmGrade');
const rubricResults      = document.getElementById('rubricResults');
const retryGradeBtn      = document.getElementById('retryGradeBtn');
const downloadBtn        = document.getElementById('downloadBtn');
const retryBtn           = document.getElementById('retryBtn');
const compareBtn         = document.getElementById('compareBtn');
const comparisonSection  = document.getElementById('comparison');
const comparisonBody     = document.getElementById('comparisonBody');

const themeToggle       = document.getElementById('themeToggle');

// Rango de palabras que debe tener el texto
const TARGET_MIN = 220;
const TARGET_MAX = 300;

// Nombre usado para guardar el tema elegido en el navegador
const THEME_KEY = 'prueba_redaccion_theme_v1';

// Ritmo de la comunicación con el backend
const AUTOSAVE_MS       = 10000;  // guardar borrador cada 10 s
const ANALISIS_ESPERA_MS = 20000; // analizar tras 20 s sin escribir
const ANALISIS_DELTA     = 30;    // ...y solo si crecieron 30 palabras

// Estado del cronómetro
let seconds = 0;
let timerInterval = null;
let hasStarted = false;
let isPaused = false;
let isFinished = false;

// Estado de la sesión en el servidor
let sesionId = null;
let codigoParticipante = null;
let rubricaDef = null;
let creandoSesion = null;      // promesa en curso, para no crear dos sesiones
let textoUltimoGuardado = '';
let palabrasUltimoAnalisis = 0;
let temporizadorAnalisis = null;
let analisisEnVuelo = null;
let falloSesion = null;        // por que no se pudo abrir sesion en el servidor

// Evita que un tema escrito por el participante rompa el HTML al pintarlo.
function esc(texto){
  return String(texto ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function estadoConexion(texto, clase){
  connStatus.textContent = texto;
  connStatus.className = `pill pill--${clase}`;
}

// Convierte segundos a formato "02:35"
function formatTime(totalSeconds){
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Arranca el cronómetro
function startTimer(){
  if (hasStarted || isFinished) return;
  hasStarted = true;
  pauseBtn.disabled = false;
  timerInterval = setInterval(() => {
    seconds++;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

// Pausa o reanuda el cronómetro
function togglePause(){
  if (!hasStarted || isFinished) return;
  isPaused = !isPaused;
  if (isPaused){
    clearInterval(timerInterval);
    pauseBtn.textContent = 'Reanudar';
  } else {
    timerInterval = setInterval(() => {
      seconds++;
      timerEl.textContent = formatTime(seconds);
    }, 1000);
    pauseBtn.textContent = 'Pausar';
  }
}

// Detiene el cronómetro definitivamente (al entregar)
function detenerCronometro(){
  clearInterval(timerInterval);
  isFinished = true;
  pauseBtn.disabled = true;
}

// Reinicia cronómetro, editor y sesión
function resetAll(){
  clearInterval(timerInterval);
  seconds = 0;
  hasStarted = false;
  isPaused = false;
  isFinished = false;
  timerEl.textContent = '00:00';
  pauseBtn.textContent = 'Pausar';
  pauseBtn.disabled = true;
  editor.value = '';

  sesionId = null;
  creandoSesion = null;
  textoUltimoGuardado = '';
  palabrasUltimoAnalisis = 0;
  clearTimeout(temporizadorAnalisis);
  analisisEnVuelo?.abort();
  falloSesion = null;
  clearInterval(sondeoNota);

  rubricResults.hidden = true;
  rubricResults.innerHTML = '';
  retryGradeBtn.hidden = true;
  updateLiveCounters();
}

// ---------------------------------------------------------------------------
// Sesión en el servidor
// ---------------------------------------------------------------------------

function temaActual(){
  if (topicSelect.value === '__custom__') return customTopic.value.trim();
  return topicSelect.value || '';
}

// Crea la sesión la primera vez que hace falta. Si ya hay una en creación,
// devuelve esa misma promesa para no abrir dos sesiones por carrera.
function asegurarSesion(){
  if (sesionId) return Promise.resolve(sesionId);
  if (creandoSesion) return creandoSesion;

  const nombre = studentName.value.trim();
  if (nombre.length < 2) return Promise.resolve(null);

  creandoSesion = API.crearSesion({
    nombre,
    ocupacion: studentOccupation.value.trim() || undefined,
    fase: phaseSelect.value,
    tema: temaActual() || undefined,
    modo: modeSelect.value
  }).then(datos => {
    falloSesion = null;
    sesionId = datos.sesionId;
    codigoParticipante = datos.codigo;
    participantCode.textContent = `Código: ${datos.codigo}`;
    participantCode.hidden = false;
    estadoConexion(datos.reanudada ? 'Sesión reanudada' : 'Sesión iniciada', 'ok');
    return sesionId;
  }).catch(err => {
    creandoSesion = null;
    if (err.status === 409){
      // El participante ya entregó esta fase. No es un fallo de red: el
      // servidor esta protegiendo los datos del estudio para que no se
      // sobrescriba una entrega anterior.
      falloSesion = {
        tipo: 'ya_entregada',
        mensaje: err.message,
        sesionId: err.datos?.sesionId ?? null
      };
      estadoConexion(err.message, 'error');
    } else {
      falloSesion = { tipo: 'sin_conexion', mensaje: err.message };
      estadoConexion('Sin conexión con el servidor — tu texto no se está guardando', 'error');
    }
    return null;
  });

  return creandoSesion;
}

// Muestra la nota de una entrega anterior, para que un 409 no sea un callejón
// sin salida: el texto ya calificado existe, solo hay que ir a buscarlo.
async function mostrarEntregaAnterior(idSesion){
  try {
    const sesion = await API.sesion(idSesion);
    const final = sesion.ultimaFinal;
    if (final?.notaGlobal != null) return `Su nota en esa entrega fue ${final.notaGlobal} / 100.`;
    if (final?.error) return 'Esa entrega quedó pendiente de calificación.';
    return 'Esa entrega no tiene calificación registrada.';
  } catch {
    return '';
  }
}

// Autoguardado periódico. Son los datos de proceso del estudio.
async function autoguardar(){
  if (!sesionId || isFinished) return;
  const texto = editor.value;
  if (texto === textoUltimoGuardado || !texto.trim()) return;

  try {
    await API.guardarBorrador(sesionId, { texto, segundos: seconds });
    textoUltimoGuardado = texto;
  } catch {
    estadoConexion('Falló el autoguardado — revisa el servidor', 'error');
  }
}
setInterval(autoguardar, AUTOSAVE_MS);

// Análisis en vivo. Se dispara tras una pausa al escribir y solo si el texto
// creció lo suficiente: llamar a la IA en cada tecla sería caro e inútil.
function programarAnalisis(){
  clearTimeout(temporizadorAnalisis);
  if (isFinished) return;

  temporizadorAnalisis = setTimeout(async () => {
    const id = await asegurarSesion();
    if (!id) return;

    const palabras = getWords(editor.value).length;
    if (palabras < 30) return;
    if (palabras - palabrasUltimoAnalisis < ANALISIS_DELTA) return;

    analisisEnVuelo?.abort();
    analisisEnVuelo = new AbortController();

    try {
      const resultado = await API.analizar(id, editor.value, analisisEnVuelo.signal);
      palabrasUltimoAnalisis = palabras;

      // En modo ciego el servidor registra pero no devuelve el juicio.
      if (resultado.modo === 'ciego') return;
      if (resultado.suficiente && resultado.puntajes){
        pintarRubrica(resultado, { parcial: true });
      }
    } catch (err){
      if (err.name !== 'AbortError') estadoConexion('Falló el análisis en vivo', 'error');
    }
  }, ANALISIS_ESPERA_MS);
}

// ---------------------------------------------------------------------------
// Tema y contadores
// ---------------------------------------------------------------------------

topicSelect.addEventListener('change', () => {
  if (topicSelect.value === '__custom__'){
    customTopic.hidden = false;
    customTopic.value = '';
    customTopic.focus();
    promptDisplay.textContent = 'Escribe tu propio tema en el campo de arriba.';
  } else if (topicSelect.value){
    customTopic.hidden = true;
    promptDisplay.textContent = topicSelect.value;
  } else {
    customTopic.hidden = true;
    promptDisplay.textContent = 'Elige un tema arriba para comenzar.';
  }
});

customTopic.addEventListener('input', () => {
  promptDisplay.textContent = customTopic.value || 'Escribe tu propio tema en el campo de arriba.';
});

// Cambiar de fase abre una sesión distinta en el servidor. Si se arrastrara el
// texto de la fase anterior se guardaría el mismo escrito en pre y en post, y
// la comparación del estudio quedaría inservible.
phaseSelect.addEventListener('change', () => {
  if (editor.value.trim() && !confirm('Cambiar de fase borra el texto actual y empieza una sesión nueva. ¿Continuar?')){
    phaseSelect.value = phaseSelect.value === 'pre' ? 'post' : 'pre';
    return;
  }
  confirmation.hidden = true;
  comparisonSection.hidden = true;
  resetAll();
  estadoConexion(`Fase: ${phaseSelect.value === 'pre' ? 'Pre-test' : 'Post-test'}`, 'wait');
});

modeSelect.addEventListener('change', () => {
  if (sesionId) estadoConexion('El modo se aplica al iniciar la sesión; reinicia para cambiarlo', 'wait');
});

// Cuenta las palabras del texto. Incluye números: "2025" o "3%" son parte de
// lo que el participante escribió y cuentan para la extensión.
function getWords(text){
  const matches = text.trim().match(/[\wáéíóúüñ]+/gi);
  return matches ? matches : [];
}

function getParagraphs(text){
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

function updateLiveCounters(){
  const text = editor.value;
  const words = getWords(text);
  const paragraphs = getParagraphs(text);

  wordCountEl.textContent = `${words.length} palabra${words.length === 1 ? '' : 's'}`;
  paragraphCountEl.textContent = `${paragraphs.length} párrafo${paragraphs.length === 1 ? '' : 's'}`;

  const pct = Math.min(100, (words.length / TARGET_MAX) * 100);
  lengthMeter.style.width = `${pct}%`;

  if (words.length < TARGET_MIN){
    lengthMeter.style.background = 'var(--red)';
    lengthHint.textContent = `Objetivo: 220–300 palabras · faltan ${TARGET_MIN - words.length}`;
  } else if (words.length <= TARGET_MAX){
    lengthMeter.style.background = 'var(--green)';
    lengthHint.textContent = 'Dentro del rango de una cuartilla.';
  } else {
    lengthMeter.style.background = 'var(--gold)';
    lengthHint.textContent = `Objetivo: 220–300 palabras · ${words.length - TARGET_MAX} de más`;
  }

  submitBtn.disabled = isFinished || words.length < 30 || !studentName.value.trim();
}

studentName.addEventListener('input', updateLiveCounters);

editor.addEventListener('input', () => {
  if (!hasStarted && editor.value.trim().length > 0){
    startTimer();
    asegurarSesion();
  }
  updateLiveCounters();
  programarAnalisis();
});

pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', () => {
  confirmation.hidden = true;
  comparisonSection.hidden = true;
  resetAll();
});

// ---------------------------------------------------------------------------
// Pintado de la rúbrica
// ---------------------------------------------------------------------------

function claseNivel(p){
  if (p >= 4.5) return 'nivel--alto';
  if (p >= 3.5) return 'nivel--medio-alto';
  if (p >= 2.5) return 'nivel--medio';
  if (p >= 1.5) return 'nivel--medio-bajo';
  return 'nivel--bajo';
}

function pintarRubrica(resultado, { parcial = false } = {}){
  if (!rubricaDef){ rubricResults.hidden = true; return; }

  const { puntajes = {}, ia } = resultado;
  const bloques = [];

  if (parcial){
    bloques.push('<p class="rubric__aviso">Análisis parcial mientras escribes. La calificación definitiva se calcula al entregar.</p>');
  }

  for (const dim of rubricaDef.dimensiones){
    const puntuados = dim.parametros.map(p => puntajes[p.id]).filter(v => typeof v === 'number');
    const promedio = puntuados.length
      ? (puntuados.reduce((a, b) => a + b, 0) / puntuados.length)
      : null;

    bloques.push(`
      <section class="rubric__dim">
        <header class="rubric__dim-head">
          <h4>${esc(dim.nombre)}</h4>
          <span class="rubric__peso">${Math.round(dim.peso * 100)}%</span>
          <span class="rubric__prom ${promedio ? claseNivel(promedio) : ''}">${promedio ? promedio.toFixed(1) : '—'} / 5</span>
        </header>
        <ul class="rubric__params">
          ${dim.parametros.map(p => {
            const valor = puntajes[p.id];
            const detalle = ia?.parametros?.[p.id];
            return `
              <li class="rubric__param">
                <div class="rubric__param-head">
                  <span class="rubric__param-name">${esc(p.nombre)}</span>
                  <span class="rubric__chip ${typeof valor === 'number' ? claseNivel(valor) : ''}">${valor ?? '—'}</span>
                </div>
                ${detalle?.justificacion ? `<p class="rubric__just">${esc(detalle.justificacion)}</p>` : ''}
                ${detalle?.evidencia?.length
                  ? `<ul class="rubric__evid">${detalle.evidencia.map(e => `<li>“${esc(e)}”</li>`).join('')}</ul>`
                  : ''}
              </li>`;
          }).join('')}
        </ul>
      </section>`);
  }

  if (ia?.fortalezas?.length){
    bloques.push(`<div class="rubric__notas"><h4>Fortalezas</h4><ul>${ia.fortalezas.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`);
  }
  if (ia?.mejoras?.length){
    bloques.push(`<div class="rubric__notas"><h4>Qué mejorar</h4><ul>${ia.mejoras.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>`);
  }

  rubricResults.innerHTML = bloques.join('');
  rubricResults.hidden = false;
}

// Traduce la causa tecnica del fallo a algo que el participante pueda entender
// y, sobre todo, que le diga si vale la pena reintentar.
function mensajeDeFallo(resultado){
  switch (resultado.causa){
    case 'saturacion':
      return 'El servicio de IA esta saturado ahora mismo. Tu texto YA quedo guardado. '
           + 'El servidor seguira reintentando en segundo plano cada minuto y medio; '
           + 'esta pantalla se actualizara sola cuando salga la nota.';
    case 'cuota':
      return 'Se agoto la cuota diaria del servicio de IA. La calificacion tendra que hacerse mas tarde o a mano.';
    case 'esquema':
      return 'La IA respondio en un formato inesperado. Queda para revision manual.';
    default:
      return 'No se pudo completar la calificacion automatica. Tu texto si quedo guardado.';
  }
}

let sondeoNota = null;

// Mientras la cola del servidor insiste, se consulta la sesion cada 20 s para
// recoger la nota en cuanto exista, sin que el participante tenga que hacer nada.
function iniciarSondeoDeNota(){
  clearInterval(sondeoNota);
  if (!sesionId) return;

  sondeoNota = setInterval(async () => {
    try {
      const sesion = await API.sesion(sesionId);
      // ultimaFinal viene con la calificacion ya guardada: no hay que
      // volver a llamar a la IA para pintarla.
      if (sesion.ultimaFinal?.notaGlobal != null){
        clearInterval(sondeoNota);
        mostrarResultadoFinal(sesion.ultimaFinal);
      }
    } catch { /* el servidor puede estar reiniciando; se reintenta en el proximo ciclo */ }
  }, 20000);
}

// Pinta el resultado de una calificacion final, exitosa o fallida.
function mostrarResultadoFinal(resultado){
  if (resultado.error){
    confirmGrade.textContent = mensajeDeFallo(resultado);
    retryGradeBtn.hidden = !resultado.reintentable;
    if (resultado.reintentable) iniciarSondeoDeNota();
    console.warn('[calificacion]', resultado.error);
  } else {
    clearInterval(sondeoNota);
    confirmGrade.textContent = `${resultado.notaGlobal} / 100`;
    retryGradeBtn.hidden = true;
  }
  pintarRubrica(resultado);
}

// ---------------------------------------------------------------------------
// Entrega
// ---------------------------------------------------------------------------

let lastSubmission = null;

submitBtn.addEventListener('click', async () => {
  // Corta el analisis en vivo ANTES de hacer nada mas. Si un parcial sigue
  // pendiente o en vuelo, puede pisarse con la calificacion final.
  clearTimeout(temporizadorAnalisis);
  analisisEnVuelo?.abort();
  analisisEnVuelo = null;
  isFinished = true;

  const id = await asegurarSesion();
  const text = editor.value;
  const words = getWords(text);
  const paragraphs = getParagraphs(text);

  detenerCronometro();
  submitBtn.disabled = true;

  lastSubmission = {
    student: { name: studentName.value.trim(), occupation: studentOccupation.value.trim() },
    codigo: codigoParticipante,
    phase: phaseSelect.value,
    topic: promptDisplay.textContent,
    text,
    words: words.length,
    paragraphs: paragraphs.length,
    time: formatTime(seconds)
  };

  confirmStudent.textContent = lastSubmission.student.occupation
    ? `${lastSubmission.student.name} (${lastSubmission.student.occupation})`
    : lastSubmission.student.name;
  confirmTopic.textContent = lastSubmission.topic;
  confirmTime.textContent = lastSubmission.time;
  confirmWords.textContent = `${lastSubmission.words} palabras`;
  confirmParagraphs.textContent = `${lastSubmission.paragraphs} párrafos`;
  confirmGrade.textContent = 'Calculando… (puede tardar hasta un minuto)';

  confirmation.hidden = false;
  confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!id){
    if (falloSesion?.tipo === 'ya_entregada'){
      const anterior = falloSesion.sesionId
        ? await mostrarEntregaAnterior(falloSesion.sesionId)
        : '';
      confirmGrade.textContent =
        `${falloSesion.mensaje} ${anterior} ` +
        'No se sobrescribe una entrega anterior. Si quieres volver a medirte, cambia de fase o usa otro nombre; ' +
        'descarga el .txt si necesitas guardar este texto.';
    } else {
      confirmGrade.textContent =
        'No se pudo abrir sesión en el servidor. Revisa que el backend esté corriendo. ' +
        'Descarga el .txt para no perder el texto.';
    }
    return;
  }

  try {
    const resultado = await API.entregar(id, { texto: text, segundos: seconds });
    lastSubmission.nota = resultado.notaGlobal;

    mostrarResultadoFinal(resultado);
  } catch (err){
    confirmGrade.textContent = `No se pudo calificar: ${err.message}`;
  }
});

// Reintenta la calificacion sobre el texto ya entregado, sin reabrir la sesion.
retryGradeBtn.addEventListener('click', async () => {
  if (!sesionId) return;
  retryGradeBtn.disabled = true;
  const etiqueta = retryGradeBtn.textContent;
  retryGradeBtn.textContent = 'Reintentando…';
  confirmGrade.textContent = 'Calculando… (puede tardar hasta un minuto)';

  try {
    const resultado = await API.recalificar(sesionId);
    lastSubmission && (lastSubmission.nota = resultado.notaGlobal);
    mostrarResultadoFinal(resultado);
  } catch (err){
    confirmGrade.textContent = `No se pudo reintentar: ${err.message}`;
  } finally {
    retryGradeBtn.disabled = false;
    retryGradeBtn.textContent = etiqueta;
  }
});

retryBtn.addEventListener('click', () => {
  confirmation.hidden = true;
  comparisonSection.hidden = true;
  resetAll();
  editor.focus();
});

// ---------------------------------------------------------------------------
// Comparación pre/post — ahora la resuelve el servidor, no el localStorage.
// Así funciona aunque las dos fases se hagan en computadores distintos.
// ---------------------------------------------------------------------------

compareBtn.addEventListener('click', async () => {
  comparisonSection.hidden = false;
  comparisonBody.innerHTML = '<p>Consultando…</p>';
  comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const codigo = codigoParticipante;
  if (!codigo){
    comparisonBody.innerHTML = '<p>Todavía no hay una sesión iniciada en el servidor.</p>';
    return;
  }

  try {
    const datos = await API.comparar(codigo);
    const fila = (etiqueta, valorPre, valorPost) =>
      `<div>${esc(etiqueta)}</div><div>${esc(valorPre ?? '—')}</div><div>${esc(valorPost ?? '—')}</div>`;

    if (!datos.pre || !datos.post){
      const faltante = !datos.pre ? 'Pre-test' : 'Post-test';
      comparisonBody.innerHTML = `<p>Falta completar la fase "${esc(faltante)}" de ${esc(codigo)} para poder comparar.</p>`;
      return;
    }

    const deltaNota = datos.delta?.notaGlobal;
    const signo = deltaNota > 0 ? '+' : '';

    comparisonBody.innerHTML = `
      ${datos.advertencia ? `<p class="rubric__aviso">${esc(datos.advertencia)}</p>` : ''}
      <div class="compare-grid">
        <div class="compare-row-header"></div>
        <div class="compare-row-header">Pre-test</div>
        <div class="compare-row-header">Post-test</div>
        ${fila('Nota', datos.pre.notaGlobal, datos.post.notaGlobal)}
        ${fila('Tema', datos.pre.tema, datos.post.tema)}
        ${fila('Tiempo', formatTime(datos.pre.segundos || 0), formatTime(datos.post.segundos || 0))}
        ${fila('Palabras', datos.pre.recuento?.palabras, datos.post.recuento?.palabras)}
        ${fila('Párrafos', datos.pre.recuento?.parrafos, datos.post.recuento?.parrafos)}
      </div>
      ${deltaNota != null ? `<p class="compare-delta">Diferencia: <strong>${signo}${deltaNota} puntos</strong></p>` : ''}
      ${renderDeltaParametros(datos.delta?.porParametro)}
    `;
  } catch (err){
    comparisonBody.innerHTML = `<p>No se pudo consultar la comparación: ${esc(err.message)}</p>`;
  }
});

function renderDeltaParametros(porParametro){
  if (!porParametro || !rubricaDef) return '';
  const nombres = {};
  for (const d of rubricaDef.dimensiones){
    for (const p of d.parametros) nombres[p.id] = p.nombre;
  }
  const items = Object.entries(porParametro).map(([id, delta]) => {
    const signo = delta > 0 ? '+' : '';
    const clase = delta > 0 ? 'delta--sube' : delta < 0 ? 'delta--baja' : 'delta--igual';
    return `<li><span>${esc(nombres[id] || id)}</span><span class="${clase}">${signo}${delta}</span></li>`;
  }).join('');
  return `<div class="rubric__notas"><h4>Cambio por parámetro</h4><ul class="delta-list">${items}</ul></div>`;
}

// ---------------------------------------------------------------------------
// Descarga del texto
// ---------------------------------------------------------------------------

downloadBtn.addEventListener('click', () => {
  if (!lastSubmission) return;

  const lines = [
    'TEXTO DE PRUEBA DE REDACCIÓN',
    '='.repeat(40),
    `Fecha: ${new Date().toLocaleString('es-CO')}`,
    `Participante: ${lastSubmission.student.name}`,
    `Código: ${lastSubmission.codigo || '(sin sesión en el servidor)'}`,
    `Ocupación / estudios: ${lastSubmission.student.occupation || '(no especificado)'}`,
    `Fase: ${lastSubmission.phase === 'pre' ? 'Pre-test' : 'Post-test'}`,
    `Tema: ${lastSubmission.topic}`,
    `Tiempo de redacción: ${lastSubmission.time}`,
    `Palabras: ${lastSubmission.words} | Párrafos: ${lastSubmission.paragraphs}`,
    `Nota: ${confirmGrade.textContent}`,
    '-'.repeat(40),
    '',
    lastSubmission.text
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `texto-redaccion-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ---------------------------------------------------------------------------
// Tema claro / oscuro
// ---------------------------------------------------------------------------

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
}

function loadTheme(){
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

function saveTheme(theme){
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  saveTheme(next);
});

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

updateLiveCounters();

const savedTheme = loadTheme();
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
applyTheme(savedTheme || (prefersLight ? 'light' : 'dark'));

(async () => {
  try {
    const salud = await API.salud();
    rubricaDef = await API.rubrica();
    estadoConexion(
      `Servidor conectado · IA: ${salud.proveedorIA} · rúbrica ${salud.rubricaVersion}`,
      salud.proveedorIA === 'simulado' ? 'wait' : 'ok'
    );
  } catch {
    estadoConexion('Sin conexión con el servidor — arráncalo con "npm start" en backend/', 'error');
  }
})();
