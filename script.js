
// Referencias a los elementos del HTML
const topicSelect      = document.getElementById('topicSelect');
const customTopic      = document.getElementById('customTopic');
const promptDisplay    = document.getElementById('promptDisplay');
const phaseSelect      = document.getElementById('phaseSelect');

const studentName       = document.getElementById('studentName');
const studentOccupation = document.getElementById('studentOccupation');

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
const downloadBtn        = document.getElementById('downloadBtn');
const retryBtn           = document.getElementById('retryBtn');
const compareBtn         = document.getElementById('compareBtn');
const comparisonSection  = document.getElementById('comparison');
const comparisonBody     = document.getElementById('comparisonBody');

const themeToggle       = document.getElementById('themeToggle');

// Rango de palabras que debe tener el texto
const TARGET_MIN = 220;
const TARGET_MAX = 300;

// Nombres usados para guardar datos en el navegador
const THEME_KEY = 'prueba_redaccion_theme_v1';
const SUBMISSIONS_KEY = 'prueba_redaccion_submissions_v1';

// Estado del cronómetro
let seconds = 0;
let timerInterval = null;
let hasStarted = false;
let isPaused = false;

// Convierte segundos a formato "02:35"
function formatTime(totalSeconds){
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Arranca el cronómetro
function startTimer(){
  if (hasStarted) return;
  hasStarted = true;
  pauseBtn.disabled = false;
  timerInterval = setInterval(() => {
    seconds++;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

// Pausa o reanuda el cronómetro
function togglePause(){
  if (!hasStarted) return;
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

// Reinicia el cronómetro y vacía el editor
function resetAll(){
  clearInterval(timerInterval);
  seconds = 0;
  hasStarted = false;
  isPaused = false;
  timerEl.textContent = '00:00';
  pauseBtn.textContent = 'Pausar';
  pauseBtn.disabled = true;
  editor.value = '';
  updateLiveCounters();
}

// Lee los intentos guardados (pre/post) del navegador
function loadSubmissions(){
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

// Guarda un intento bajo su fase (pre o post)
function saveSubmissionForPhase(phase, data){
  const all = loadSubmissions();
  all[phase] = data;
  try { localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(all)); } catch (err) {}
}

// Muestra la tabla comparando el pre-test con el post-test
function renderComparison(){
  const all = loadSubmissions();
  const pre = all.pre;
  const post = all.post;

  if (!pre || !post){
    const faltante = !pre ? 'Pre-test' : 'Post-test';
    comparisonBody.innerHTML = `<p>Todavía falta completar la fase "${faltante}" en este navegador para poder comparar.</p>`;
  } else {
    comparisonBody.innerHTML = `
      <div class="compare-grid">
        <div class="compare-row-header"></div>
        <div class="compare-row-header">Pre-test</div>
        <div class="compare-row-header">Post-test</div>

        <div>Tema</div><div>${pre.topic}</div><div>${post.topic}</div>
        <div>Tiempo</div><div>${pre.time}</div><div>${post.time}</div>
        <div>Palabras</div><div>${pre.words}</div><div>${post.words}</div>
        <div>Párrafos</div><div>${pre.paragraphs}</div><div>${post.paragraphs}</div>
      </div>
    `;
  }

  comparisonSection.hidden = false;
  comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

compareBtn.addEventListener('click', renderComparison);

// Actualiza el título del tema cuando cambia el selector
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

// Actualiza el título del tema cuando se escribe uno propio
customTopic.addEventListener('input', () => {
  promptDisplay.textContent = customTopic.value || 'Escribe tu propio tema en el campo de arriba.';
});

// Cuenta las palabras del texto
function getWords(text){
  const matches = text.trim().match(/[a-záéíóúüñ]+/gi);
  return matches ? matches : [];
}

// Separa el texto en párrafos
function getParagraphs(text){
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

// Actualiza los contadores, la barra de progreso y si se puede entregar
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

  submitBtn.disabled = words.length < 30 || !studentName.value.trim();
}

studentName.addEventListener('input', updateLiveCounters);

// Arranca el cronómetro al escribir y recalcula los contadores
editor.addEventListener('input', () => {
  if (!hasStarted && editor.value.trim().length > 0){
    startTimer();
  }
  updateLiveCounters();
});

pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetAll);

// Función pendiente de conectar con el backend del grupo 3.
// Hoy solo imprime los datos en consola, no hace ninguna conexión real.
async function sendToBackend(payload){
  console.log('[pendiente de backend] esto es lo que se enviaría:', payload);

  // const res = await fetch('https://<url-del-backend>/api/intentos', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(payload)
  // });
  // const data = await res.json();
  // return data.nota;

  return null;
}

// Guarda los datos de la última entrega
let lastSubmission = null;

// Arma y muestra la entrega al hacer clic en "Entregar"
submitBtn.addEventListener('click', async () => {
  clearInterval(timerInterval);

  const text = editor.value;
  const words = getWords(text);
  const paragraphs = getParagraphs(text);

  lastSubmission = {
    student: {
      name: studentName.value.trim(),
      occupation: studentOccupation.value.trim()
    },
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
  confirmGrade.textContent = 'Pendiente — la calculará el backend cuando esté conectado';

  saveSubmissionForPhase(phaseSelect.value, lastSubmission);

  confirmation.hidden = false;
  confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const nota = await sendToBackend(lastSubmission);
  if (nota !== null && nota !== undefined){
    confirmGrade.textContent = nota;
  }
});

// Vuelve a la pantalla de escritura, vacía
retryBtn.addEventListener('click', () => {
  confirmation.hidden = true;
  resetAll();
  editor.focus();
});

// Descarga el texto entregado como archivo .txt
downloadBtn.addEventListener('click', () => {
  if (!lastSubmission) return;

  const lines = [
    'TEXTO DE PRUEBA DE REDACCIÓN',
    '='.repeat(40),
    `Fecha: ${new Date().toLocaleString('es-CO')}`,
    `Participante: ${lastSubmission.student.name}`,
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

// Cambia entre modo oscuro y modo claro
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
}

// Lee el tema guardado
function loadTheme(){
  try { return localStorage.getItem(THEME_KEY); } catch (err) { return null; }
}

// Guarda el tema elegido
function saveTheme(theme){
  try { localStorage.setItem(THEME_KEY, theme); } catch (err) {}
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  saveTheme(next);
});

// Se ejecuta al cargar la página
updateLiveCounters();

const savedTheme = loadTheme();
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
applyTheme(savedTheme || (prefersLight ? 'light' : 'dark'));