

// ---------- DOM refs ----------
const topicSelect      = document.getElementById('topicSelect');
const customTopic      = document.getElementById('customTopic');
const promptDisplay    = document.getElementById('promptDisplay');

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

// ---------- Config ----------
const TARGET_MIN = 220;
const TARGET_MAX = 300;

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
}

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

  confirmation.hidden = false;
  confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

// ---------- Init ----------
updateLiveCounters();
