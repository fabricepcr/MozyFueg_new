// src/lib/orderSound.js
// Aviso de nuevo pedido: fuerte, fiable y a prueba de suspensiones del navegador.

let audioCtx = null;
let masterGain = null;
let keepAliveOsc = null;
let loopTimer = null;   // sentinel — non-null while a ding is "pending dismiss"
let maxDurationTimer = null;
let watchdogTimer = null;
let listenersReady = false;
let ready = false;

const listeners = new Set();

// 🔊 Volumen del aviso.
const ALERT_GAIN = 1.4;

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
    // Do not create an AudioContext before a real user gesture. Browsers block
    // that attempt and report noisy autoplay errors in the console.
    if (audioCtx && document.visibilityState === 'visible') ensureRunning();
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

}

/* ---------------- Sonido ---------------- */

// Single bell-like "ding": sine wave, fast attack, long exponential decay.
async function playDing() {
  try {
    const ok = await ensureRunning();
    if (!ok) return;

    const ctx = audioCtx;
    const now = ctx.currentTime + 0.03;

    // Two partials for a richer bell tone
    const partials = [
      { freq: 1047, gain: 0.9, decay: 1.4 },  // C6 — fundamental
      { freq: 2093, gain: 0.35, decay: 0.7 }, // C7 — overtone
    ];

    partials.forEach(({ freq, gain, decay }) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + 0.008); // sharp attack
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + decay + 0.05);
      osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (_) {} };
    });
  } catch (_) {}
}

// Plays a single ding once per new-order event; loopTimer acts as a sentinel
// so rapid duplicate events don't stack up.
export function startSoundLoop() {
  if (loopTimer) return;
  playDing();
  loopTimer = 1; // sentinel — cleared by stopSoundLoop
}

export function stopSoundLoop() {
  loopTimer = null;
  if (maxDurationTimer) { clearTimeout(maxDurationTimer); maxDurationTimer = null; }
}

export async function testSound() {
  await unlockSound();
  await playDing();
}
