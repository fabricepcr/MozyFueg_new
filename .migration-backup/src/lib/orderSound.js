// src/lib/orderSound.js
// Aviso de nuevo pedido: fuerte, fiable y a prueba de suspensiones del navegador.

let audioCtx = null;
let masterGain = null;
let keepAliveOsc = null;
let loopTimer = null;
let maxDurationTimer = null;
let watchdogTimer = null;
let listenersReady = false;
let ready = false;

const listeners = new Set();

// 🔊 Volumen del aviso. NO subir de ~1.8: por encima satura y suena "roto".
const ALERT_GAIN = 1.6;
const MAX_DURATION_MS = 30000;  // tope: 30 s sonando
const LOOP_INTERVAL_MS = 1600;

/* ---------------- Estado ---------------- */

function setReady(value) {
  if (ready === value) return;
  ready = value;
  listeners.forEach((fn) => { try { fn(ready); } catch (_) {} });
}

export function onSoundStateChange(fn) {
  listeners.add(fn);
  try { fn(ready); } catch (_) {}
  return () => listeners.delete(fn);
}

export function isSoundReady() {
  return ready && audioCtx?.state === 'running';
}

/* ---------------- Contexto de audio ---------------- */

function getCtx() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = ALERT_GAIN;
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

// Oscilador mudo permanente: mantiene el contexto vivo tras horas abierto.
function startKeepAlive() {
  try {
    const ctx = getCtx();
    if (!ctx || keepAliveOsc) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    osc.frequency.value = 20;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    keepAliveOsc = osc;
  } catch (_) {}
}

// Reanuda el contexto y ESPERA a que esté corriendo de verdad.
async function ensureRunning() {
  const ctx = getCtx();
  if (!ctx) return false;
  if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
    try {
      await ctx.resume(); // ← LA CLAVE: antes no se esperaba y las notas se programaban en un tiempo ya pasado
    } catch (_) {
      setReady(false);
      return false;
    }
  }
  const ok = ctx.state === 'running';
  setReady(ok);
  if (ok) startKeepAlive();
  return ok;
}

/* ---------------- Desbloqueo + vigilancia ---------------- */

export async function unlockSound() {
  try {
    const ok = await ensureRunning();
    if (!ok) return false;
    const ctx = audioCtx;
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    return true;
  } catch (_) {
    return false;
  }
}

// Engancha listeners globales UNA vez. Llamar al montar el panel.
export function initSound() {
  if (listenersReady) return;
  listenersReady = true;

  const onGesture = () => { unlockSound(); };
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((ev) => {
    window.addEventListener(ev, onGesture, { passive: true });
  });

  const onWake = () => {
    if (document.visibilityState === 'visible') ensureRunning();
  };
  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('focus', onWake);

  // Watchdog: cada 5 s comprueba que el contexto sigue vivo.
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    const ctx = audioCtx;
    if (!ctx) return;
    if (ctx.state !== 'running') {
      ensureRunning();
    } else {
      setReady(true);
      startKeepAlive();
    }
  }, 5000);

  ensureRunning();
}

/* ---------------- Sonido ---------------- */

async function playChime() {
  try {
    const ok = await ensureRunning();
    if (!ok) return;

    const ctx = audioCtx;
    const now = ctx.currentTime + 0.03; // se lee DESPUÉS del resume

    const notes = [
      { freq: 880, start: 0.0,  dur: 0.35 },
      { freq: 660, start: 0.32, dur: 0.50 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const t0 = now + start;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.8, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
      osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (_) {} };
    });
  } catch (_) {}
}

export function startSoundLoop() {
  if (loopTimer) return;
  playChime();
  loopTimer = setInterval(playChime, LOOP_INTERVAL_MS);
  if (maxDurationTimer) clearTimeout(maxDurationTimer);
  maxDurationTimer = setTimeout(() => { stopSoundLoop(); }, MAX_DURATION_MS);
}

export function stopSoundLoop() {
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  if (maxDurationTimer) { clearTimeout(maxDurationTimer); maxDurationTimer = null; }
}

export async function testSound() {
  await unlockSound();
  await playChime();
}
