// ============================================================
//  Chordle v2 Audio Engine — reliable cross-browser synthesis
//  Guitar: harmonic oscillators with guitar-like timbre
//  Piano: harmonic oscillators with piano-like timbre  
//  Drums: noise/sweep synthesis for 9 kit sounds
// ============================================================

let audioCtx = null;

export function resumeAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export const CHORD_POOL = {
  1:  { freqs: [261.63, 329.63, 392.00] },  // C maj
  2:  { freqs: [196.00, 246.94, 293.66] },  // G maj
  3:  { freqs: [146.83, 185.00, 220.00] },  // D maj
  4:  { freqs: [220.00, 261.63, 329.63] },  // A min
  5:  { freqs: [164.81, 196.00, 246.94] },  // E min
  6:  { freqs: [174.61, 220.00, 261.63] },  // F maj
  7:  { freqs: [246.94, 293.66, 369.99] },  // B dim
  8:  { freqs: [261.63, 329.63, 415.30] },  // C aug
  9:  { freqs: [293.66, 392.00, 440.00] },  // D sus4
  10: { freqs: [440.00, 554.37, 659.25] },  // A maj high
  11: { freqs: [233.08, 293.66, 349.23] },  // Bb maj
  12: { freqs: [196.00, 233.08, 293.66] },  // G min
  13: { freqs: [164.81, 207.65, 246.94] },  // E maj
  14: { freqs: [146.83, 174.61, 220.00] },  // D min
  15: { freqs: [261.63, 329.63, 392.00, 466.16] }, // C7
  16: { freqs: [174.61, 207.65, 261.63] },  // F min
};

export const DRUM_KIT = {
  1: { name: 'Kick',     color: '#ef4444' },
  2: { name: 'Snare',    color: '#f97316' },
  3: { name: 'Hi-Hat C', color: '#eab308' },
  4: { name: 'Hi-Hat O', color: '#84cc16' },
  5: { name: 'Tom Hi',   color: '#22c55e' },
  6: { name: 'Tom Lo',   color: '#06b6d4' },
  7: { name: 'Crash',    color: '#6366f1' },
  8: { name: 'Ride',     color: '#a855f7' },
  9: { name: 'Clap',     color: '#ec4899' },
};

export const CHORD_COLORS = [
  '#4ade80','#60a5fa','#f97316','#c084fc',
  '#f43f5e','#facc15','#2dd4bf','#fb923c','#a78bfa',
];

// ── GUITAR: harmonic oscillators with guitar-like timbre ──────────────────
// Guitar character: strong odd harmonics, faster decay than piano,
// slight frequency detuning between notes for natural shimmer,
// more midrange presence
function playGuitarChord(chordId) {
  const ctx = getCtx();
  const chord = CHORD_POOL[chordId];
  if (!chord) return;
  const now = ctx.currentTime;

  chord.freqs.forEach((freq, noteIdx) => {
    const strum = noteIdx * 0.06; // strum delay

    // Master gain with guitar envelope
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0, now + strum);
    master.gain.linearRampToValueAtTime(0.35, now + strum + 0.01);  // sharp attack
    master.gain.exponentialRampToValueAtTime(0.12, now + strum + 0.08); // fast initial drop
    master.gain.exponentialRampToValueAtTime(0.001, now + strum + 1.2);  // decay

    // Slight detuning for natural guitar character
    const detune = (noteIdx - 1) * 4; // cents

    // Harmonics with guitar-like weighting (odd harmonics prominent)
    const harmonics = [
      { mult: 1,   gain: 0.5,  type: 'sawtooth' },
      { mult: 2,   gain: 0.15, type: 'sine' },
      { mult: 3,   gain: 0.25, type: 'sine' },  // strong 3rd harmonic
      { mult: 4,   gain: 0.05, type: 'sine' },
      { mult: 5,   gain: 0.12, type: 'sine' },  // strong 5th harmonic
    ];

    harmonics.forEach(({ mult, gain: hGain, type }) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      // Midrange boost — guitar body resonance
      const bodyFilter = ctx.createBiquadFilter();
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.value = 800;
      bodyFilter.gain.value = 4;
      bodyFilter.Q.value = 1;

      osc.type = type;
      osc.frequency.value = freq * mult;
      osc.detune.value = detune;
      oscGain.gain.value = hGain;

      osc.connect(oscGain);
      oscGain.connect(bodyFilter);
      bodyFilter.connect(master);
      osc.start(now + strum);
      osc.stop(now + strum + 1.5);
    });
  });
}

// ── PIANO: clean harmonics with piano envelope ────────────────────────────
function playPianoChord(chordId) {
  const ctx = getCtx();
  const chord = CHORD_POOL[chordId];
  if (!chord) return;
  const now = ctx.currentTime;

  chord.freqs.forEach((freq) => {
    const master = ctx.createGain();
    master.connect(ctx.destination);

    // Piano envelope: very fast attack, sharp drop, long sustain decay
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.4, now + 0.006);
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
    master.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

    // Pure sine harmonics — cleaner than guitar
    [
      { mult: 1, gain: 0.6 },
      { mult: 2, gain: 0.18 },
      { mult: 3, gain: 0.07 },
      { mult: 4, gain: 0.03 },
    ].forEach(({ mult, gain: hGain }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      g.gain.value = hGain;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 3.2);
    });
  });
}

// ── DRUMS: 9 reliable synthesized sounds ──────────────────────────────────
function createNoise(ctx, duration) {
  const bufSize = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function playDrum(drumId) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  switch (drumId) {
    case 1: { // Kick — sine sweep 150→40Hz
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      g.gain.setValueAtTime(1.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.5);
      break;
    }
    case 2: { // Snare — bandpass noise + tone layer
      // Noise layer
      const noise = createNoise(ctx, 0.25);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 0.7;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.7, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      noise.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
      noise.start(now); noise.stop(now + 0.28);
      // Tone layer
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 180;
      og.gain.setValueAtTime(0.4, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(og); og.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.1);
      break;
    }
    case 3: { // Hi-Hat Closed — short highpass noise
      const noise = createNoise(ctx, 0.08);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 9000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.6, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      noise.connect(hp); hp.connect(g); g.connect(ctx.destination);
      noise.start(now); noise.stop(now + 0.1);
      break;
    }
    case 4: { // Hi-Hat Open — longer highpass noise
      const noise = createNoise(ctx, 0.5);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 7500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      noise.connect(hp); hp.connect(g); g.connect(ctx.destination);
      noise.start(now); noise.stop(now + 0.55);
      break;
    }
    case 5: { // Tom High — mid sine sweep 280→140Hz
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.2);
      g.gain.setValueAtTime(0.9, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.35);
      break;
    }
    case 6: { // Tom Low — low sine sweep 150→65Hz
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.25);
      g.gain.setValueAtTime(1.0, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.5);
      break;
    }
    case 7: { // Crash — wide highpass noise, slow decay
      const noise = createNoise(ctx, 1.8);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 4500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.8, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      noise.connect(hp); hp.connect(g); g.connect(ctx.destination);
      noise.start(now); noise.stop(now + 1.9);
      break;
    }
    case 8: { // Ride — metallic triangle tone + brief noise
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 650;
      og.gain.setValueAtTime(0.35, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(og); og.connect(ctx.destination);
      osc.start(now); osc.stop(now + 1.0);
      // Add shimmer
      const noise = createNoise(ctx, 0.25);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 7000; bp.Q.value = 2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.18, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      noise.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
      noise.start(now); noise.stop(now + 0.3);
      break;
    }
    case 9: { // Clap — 3 staggered noise bursts
      [0, 0.012, 0.024].forEach((delay) => {
        const noise = createNoise(ctx, 0.08);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.65, now + delay);
        g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
        noise.connect(bp); bp.connect(g); g.connect(ctx.destination);
        noise.start(now + delay); noise.stop(now + delay + 0.12);
      });
      break;
    }
  }
}

// ── PUBLIC API ─────────────────────────────────────────────────────────────

export function playSound(soundId, instrument) {
  resumeAudio();
  if (instrument === 'guitar') playGuitarChord(soundId);
  else if (instrument === 'piano') playPianoChord(soundId);
  else if (instrument === 'drums') playDrum(soundId);
}

export function playSequence(sequence, instrument) {
  const GAP = instrument === 'drums' ? 0.65 : 1.4;
  const timers = [];
  let cancelled = false;

  const promise = new Promise((resolve) => {
    sequence.forEach((id, i) => {
      const t = setTimeout(() => {
        if (!cancelled) playSound(id, instrument);
      }, i * GAP * 1000);
      timers.push(t);
    });
    const finalTimer = setTimeout(resolve, sequence.length * GAP * 1000);
    timers.push(finalTimer);
  });

  const cancel = () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };

  return { promise, cancel };
}