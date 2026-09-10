/* =========================================================
   PRUEBA DE REDACCIÓN — versión base
   Sin cálculo de puntajes, sin llamadas a APIs.
   ========================================================= */

// ---------- DOM refs ----------
const topicSelect      = document.getElementById('topicSelect');
const customTopic      = document.getElementById('customTopic');
const promptDisplay    = document.getElementById('promptDisplay');
const phaseSelect      = document.getElementById('phaseSelect');

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
const confirmTopic       = document.getElementById('confirmTopic');
const confirmTime        = document.getElementById('confirmTime');
const confirmWords       = document.getElementById('confirmWords');
const confirmParagraphs  = document.getElementById('confirmParagraphs');
const downloadBtn        = document.getElementById('downloadBtn');
const retryBtn           = document.getElementById('retryBtn');
const compareBtn         = document.getElementById('compareBtn');
const comparisonSection  = document.getElementById('comparison');
const comparisonBody     = document.getElementById('comparisonBody');

const draftBanner       = document.getElementById('draftBanner');
const draftResumeBtn    = document.getElementById('draftResumeBtn');
const draftDiscardBtn   = document.getElementById('draftDiscardBtn');

const themeToggle       = document.getElementById('themeToggle');

// ---------- Config ----------
const TARGET_MIN = 220;
const TARGET_MAX = 300;
const DRAFT_KEY = 'prueba_redaccion_draft_v1';
const THEME_KEY = 'prueba_redaccion_theme_v1';
const SUBMISSIONS_KEY = 'prueba_redaccion_submissions_v1'; // { pre: {...}, post: {...} }

// ---------- Timer state ----------
let seconds = 0;
let timerInterval = null;
let hasStarted = false;
let isPaused = false;

function formatTime(totalSeconds){
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// idempotente: no-op si ya está corriendo
function startTimer(){
  if (hasStarted) return;
  hasStarted = true;
  pauseBtn.disabled = false;
  timerInterval = setInterval(() => {
    seconds++;
    timerEl.textContent = formatTime(seconds);
    saveDraft();
  }, 1000);
}

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
      saveDraft();
    }, 1000);
    pauseBtn.textContent = 'Pausar';
  }
}

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
  clearDraft();
}

// ---------- Draft autosave (localStorage) ----------
// try/catch en cada llamada: localStorage puede fallar (modo privado,
// cuota llena, entorno sin soporte) y no debe romper el resto de la página.
function saveDraft(){
  try {
    const payload = {
      topicSelectValue: topicSelect.value,
      customTopicValue: customTopic.value,
      promptText: promptDisplay.textContent,
      text: editor.value,
      seconds
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('No se pudo guardar el borrador:', err);
  }
}

function loadDraft(){
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('No se pudo leer el borrador guardado:', err);
    return null;
  }
}

function clearDraft(){
  try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* no-op */ }
}

function resumeFromDraft(draft){
  topicSelect.value = draft.topicSelectValue || '';
  customTopic.hidden = draft.topicSelectValue !== '__custom__';
  customTopic.value = draft.customTopicValue || '';
  promptDisplay.textContent = draft.promptText || 'Elige un tema arriba para comenzar.';
  editor.value = draft.text || '';
  updateLiveCounters();

  seconds = Number(draft.seconds) || 0;
  timerEl.textContent = formatTime(seconds);
  if (editor.value.trim().length > 0){
    hasStarted = true;
    pauseBtn.disabled = false;
    timerInterval = setInterval(() => {
      seconds++;
      timerEl.textContent = formatTime(seconds);
      saveDraft();
    }, 1000);
  }
}

draftResumeBtn.addEventListener('click', () => {
  const draft = loadDraft();
  draftBanner.hidden = true;
  if (draft) resumeFromDraft(draft);
});

draftDiscardBtn.addEventListener('click', () => {
  clearDraft();
  draftBanner.hidden = true;
});

// ---------- Pre/post comparison (localStorage) ----------
// NOTA: esto es un almacenamiento local temporal para poder ver la
// comparación mientras el grupo 3 no tenga listo el backend + BD real.
// Solo guarda el último intento de cada fase, y solo en este navegador.
function loadSubmissions(){
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function saveSubmissionForPhase(phase, data){
  const all = loadSubmissions();
  all[phase] = data;
  try { localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(all)); } catch (err) { /* no-op */ }
}

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

// ---------- Topic select ----------
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

// ---------- Counters ----------
// regex: solo secuencias de letras (con tildes/ñ), sin dígitos ni puntuación
function getWords(text){
  const matches = text.trim().match(/[a-záéíóúüñ]+/gi);
  return matches ? matches : [];
}

// párrafo = bloque separado por línea en blanco (\n\s*\n)
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

  submitBtn.disabled = words.length < 30;
}

editor.addEventListener('input', () => {
  if (!hasStarted && editor.value.trim().length > 0){
    startTimer();
  }
  updateLiveCounters();
  saveDraft();
});

pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetAll);

// ---------- Submit ----------
let lastSubmission = null; // usado por downloadBtn

submitBtn.addEventListener('click', () => {
  clearInterval(timerInterval);

  const text = editor.value;
  const words = getWords(text);
  const paragraphs = getParagraphs(text);

  lastSubmission = {
    phase: phaseSelect.value,
    topic: promptDisplay.textContent,
    text,
    words: words.length,
    paragraphs: paragraphs.length,
    time: formatTime(seconds)
  };

  confirmTopic.textContent = lastSubmission.topic;
  confirmTime.textContent = lastSubmission.time;
  confirmWords.textContent = `${lastSubmission.words} palabras`;
  confirmParagraphs.textContent = `${lastSubmission.paragraphs} párrafos`;

  saveSubmissionForPhase(phaseSelect.value, lastSubmission);

  confirmation.hidden = false;
  confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
  clearDraft(); // ya se entregó, no tiene sentido seguir ofreciéndolo para restaurar
});

retryBtn.addEventListener('click', () => {
  confirmation.hidden = true;
  resetAll();
  editor.focus();
});

// ---------- Download ----------
// Blob + <a download> + URL.createObjectURL; sin dependencias externas
downloadBtn.addEventListener('click', () => {
  if (!lastSubmission) return;

  const lines = [
    'TEXTO DE PRUEBA DE REDACCIÓN',
    '='.repeat(40),
    `Fecha: ${new Date().toLocaleString('es-CO')}`,
    `Tema: ${lastSubmission.topic}`,
    `Tiempo de redacción: ${lastSubmission.time}`,
    `Palabras: ${lastSubmission.words} | Párrafos: ${lastSubmission.paragraphs}`,
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

// ---------- Theme toggle ----------
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
}

function loadTheme(){
  try { return localStorage.getItem(THEME_KEY); } catch (err) { return null; }
}

function saveTheme(theme){
  try { localStorage.setItem(THEME_KEY, theme); } catch (err) { /* no-op */ }
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  saveTheme(next);
});

// ---------- Init ----------
updateLiveCounters();

// tema: localStorage > prefers-color-scheme del sistema > 'dark' por defecto
const savedTheme = loadTheme();
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
applyTheme(savedTheme || (prefersLight ? 'light' : 'dark'));

// Si hay un borrador con texto no vacío, ofrece restaurarlo antes de
// que el usuario empiece a escribir (evita pisar un intento a medias
// si se recargó la página por accidente).
const existingDraft = loadDraft();
if (existingDraft && existingDraft.text && existingDraft.text.trim().length > 0){
  draftBanner.hidden = false;
}
