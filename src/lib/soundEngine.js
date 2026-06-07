/**
 * Sound Engine — generates tones via Web Audio API (no external files needed).
 * Handles the browser autoplay policy by queuing sounds until after first user interaction.
 */

let audioCtx = null;
let muted = false;
let volume = 0.5;
let unlocked = false;
let pendingQueue = []; // sounds queued before unlock

function getCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }
  return audioCtx;
}

// Resume context after user interaction (required by browser autoplay policy)
function ensureUnlocked() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => { unlocked = true; });
  } else {
    unlocked = true;
  }
}

// Unlock on ANY user gesture — this is the key fix for browsers blocking autoplay
function setupUnlockListeners() {
  const events = ['click', 'keydown', 'touchstart', 'mousedown'];
  const handler = () => {
    ensureUnlocked();
    // Play any pending sounds
    while (pendingQueue.length > 0) {
      const fn = pendingQueue.shift();
      try { fn(); } catch (e) { console.warn('[soundEngine] pending sound failed:', e); }
    }
    events.forEach(e => document.removeEventListener(e, handler));
  };
  events.forEach(e => document.addEventListener(e, handler, { once: true, passive: true }));
}

setupUnlockListeners();

function playTone({ frequency = 440, type = 'sine', duration = 0.15, vol = null, delay = 0 }) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;

  const actualVol = vol !== null ? vol : volume;

  const doPlay = () => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
      gain.gain.setValueAtTime(actualVol * 0.35, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.05);
    } catch (e) {
      console.warn('[soundEngine] playTone failed:', e);
    }
  };

  // If context is suspended, queue the sound to play after unlock
  if (ctx.state === 'suspended') {
    if (!unlocked) {
      pendingQueue.push(doPlay);
    } else {
      ctx.resume().then(doPlay).catch(() => {});
    }
  } else {
    doPlay();
  }
}

export const soundEngine = {
  setMuted: (val) => { muted = val; },
  setVolume: (val) => { volume = Math.max(0, Math.min(1, val)); },
  getMuted: () => muted,
  getVolume: () => volume,

  loadSettings: () => {
    try {
      muted = JSON.parse(localStorage.getItem('notif_muted') || 'false');
      volume = parseFloat(localStorage.getItem('notif_volume') || '0.5');
    } catch {}
  },

  saveSettings: () => {
    try {
      localStorage.setItem('notif_muted', JSON.stringify(muted));
      localStorage.setItem('notif_volume', String(volume));
    } catch {}
  },

  // ── Sound presets ─────────────────────────────────────────────────────────

  playSale: () => {
    // Two cheerful rising notes — success sound
    playTone({ frequency: 523, type: 'sine', duration: 0.12 });
    playTone({ frequency: 784, type: 'sine', duration: 0.18, delay: 0.12 });
  },

  playInfo: () => {
    // Soft, clean double-tap — two short blips at lower frequency
    playTone({ frequency: 440, type: 'sine', duration: 0.08 });
    playTone({ frequency: 520, type: 'sine', duration: 0.08, delay: 0.1 });
  },

  playWarning: () => {
    // Two lower urgent notes
    playTone({ frequency: 440, type: 'triangle', duration: 0.15 });
    playTone({ frequency: 330, type: 'triangle', duration: 0.25, delay: 0.18 });
  },

  playCritical: () => {
    // Three rapid alert pulses — attention-grabbing
    playTone({ frequency: 880, type: 'sawtooth', duration: 0.1 });
    playTone({ frequency: 880, type: 'sawtooth', duration: 0.1, delay: 0.15 });
    playTone({ frequency: 660, type: 'sawtooth', duration: 0.2, delay: 0.3 });
  },

  playForSeverity: (severity) => {
    if (muted) return;
    if (severity === 'critical') soundEngine.playCritical();
    else if (severity === 'warning') soundEngine.playWarning();
    else soundEngine.playInfo();
  },

  // Test — works even before any real notification
  testSound: (type = 'info') => {
    const wasMuted = muted;
    muted = false;
    ensureUnlocked();
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        soundEngine.playForSeverity(type);
        muted = wasMuted;
      });
    } else {
      soundEngine.playForSeverity(type);
      muted = wasMuted;
    }
  },
};

// Load settings immediately on import
soundEngine.loadSettings();