// ============================================================
//  Chordle v2 Audio Engine
//  16 chords redesigned to be maximally distinct:
//  - Spread across 4 octave ranges
//  - No shared root notes between chords
//  - Mix of major, minor, 7th, sus, aug, dim
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

// ── CHORD POOL — 16 maximally distinct chords ────────────────────────────
// Organized in 4 registers: bass, low-mid, mid, high
// No two chords share a root note
export const CHORD_POOL = {
  // ── BASS register (80-160Hz root) ──
  1:  { name: "A2 maj",  freqs: [110.00, 138.59, 164.81] },          // A2
  2:  { name: "Bb2 min", freqs: [116.54, 138.59, 174.61] },          // Bb2
  3:  { name: "B2 dim",  freqs: [123.47, 146.83, 174.61] },          // B2
  4:  { name: "C3 aug",  freqs: [130.81, 164.81, 207.65] },          // C3

  // ── LOW-MID register (160-260Hz root) ──
  5:  { name: "D3 maj",  freqs: [146.83, 185.00, 220.00] },          // D3
  6:  { name: "Eb3 min", freqs: [155.56, 185.00, 233.08] },          // Eb3
  7:  { name: "E3 7th",  freqs: [164.81, 207.65, 246.94, 293.66] },  // E3
  8:  { name: "F3 maj",  freqs: [174.61, 220.00, 261.63] },          // F3

  // ── MID register (260-440Hz root) ──
  9:  { name: "G3 maj",  freqs: [196.00, 246.94, 293.66] },          // G3
  10: { name: "Ab3 min", freqs: [207.65, 246.94, 311.13] },          // Ab3
  11: { name: "A3 sus4", freqs: [220.00, 293.33, 330.00] },          // A3
  12: { name: "Bb3 7th", freqs: [233.08, 293.66, 349.23, 415.30] },  // Bb3

  // ── HIGH register (440Hz+ root) ──
  13: { name: "C4 maj",  freqs: [261.63, 329.63, 392.00] },          // C4 middle
  14: { name: "D4 min",  freqs: [293.66, 349.23, 440.00] },          // D4
  15: { name: "E4 maj",  freqs: [329.63, 415.30, 493.88] },          // E4
  16: { name: "G4 min",  freqs: [392.00, 466.16, 587.33] },          // G4
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

// ── GUITAR: Karplus-Strong rendered offline ───────────────────────────────
function karplusStrong(sampleRate, freq, duration) {
  const N = Math.round(sampleRate / freq);
  const totalSamples = Math.ceil(sampleRate * duration);
  const output = new Float32Array(totalSamples);
  const ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  const feedback = 0.996;
  let pos = 0;
  for (let i = 0; i < totalSamples; i++) {
    const next = pos === 0 ? N - 1 : pos - 1;
    output[i] = ring[pos];
    ring[pos] = (ring[pos] + ring[next]) * 0.5 * feedback;
    pos = (pos + 1) % N;
  }
  return output;
}

const guitarBufferCache = {};

async function getGuitarBuffer(ctx, freq, duration) {
  const key = `${Math.round(freq)}_${duration}`;
  if (guitarBufferCache[key]) return guitarBufferCache[key];
  const samples = karplusStrong(ctx.sampleRate, freq, duration);
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);
  guitarBufferCache[key] = buffer;
  return buffer;
}

async function playGuitarChord(chordId) {
  const ctx = getCtx();
  const chord = CHORD_POOL[chordId];
  if (!chord) return;
  const now = ctx.currentTime;
  const duration = 2.5;

  await Promise.all(chord.freqs.map(async (freq, noteIdx) => {
    const strum = noteIdx * 0.055;
    const buffer = await getGuitarBuffer(ctx, freq, duration);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 4000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, now + strum);
    gain.gain.exponentialRampToValueAtTime(0.001, now + strum + duration - 0.1);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now + strum);
  }));
}

// ── PIANO ─────────────────────────────────────────────────────────────────
function playPianoChord(chordId) {
  const ctx = getCtx();
  const chord = CHORD_POOL[chordId];
  if (!chord) return;
  const now = ctx.currentTime;

  chord.freqs.forEach((freq) => {
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.4, now + 0.006);
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
    master.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
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
      osc.connect(g); g.connect(master);
      osc.start(now); osc.stop(now + 3.2);
    });
  });
}

// ── DRUMS ─────────────────────────────────────────────────────────────────
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
    case 1: {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      g.gain.setValueAtTime(1.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g); g.connect(ctx.destination); osc.start(now); osc.stop(now + 0.5);
      break;
    }
    case 2: {
      const noise = createNoise(ctx, 0.25), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 0.7;
      ng.gain.setValueAtTime(0.7, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      noise.connect(bp); bp.connect(ng); ng.connect(ctx.destination); noise.start(now); noise.stop(now + 0.28);
      const osc = ctx.createOscillator(), og = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 180;
      og.gain.setValueAtTime(0.4, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(og); og.connect(ctx.destination); osc.start(now); osc.stop(now + 0.1);
      break;
    }
    case 3: {
      const noise = createNoise(ctx, 0.08), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 9000;
      g.gain.setValueAtTime(0.6, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      noise.connect(hp); hp.connect(g); g.connect(ctx.destination); noise.start(now); noise.stop(now + 0.1);
      break;
    }
    case 4: {
      const noise = createNoise(ctx, 0.5), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 7500;
      g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      noise.connect(hp); hp.connect(g); g.connect(ctx.destination); noise.start(now); noise.stop(now + 0.55);
      break;
    }
    case 5: {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(280, now); osc.frequency.exponentialRampToValueAtTime(140, now + 0.2);
      g.gain.setValueAtTime(0.9, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(g); g.connect(ctx.destination); osc.start(now); osc.stop(now + 0.35);
      break;
    }
    case 6: {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(65, now + 0.25);
      g.gain.setValueAtTime(1.0, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(g); g.connect(ctx.destination); osc.start(now); osc.stop(now + 0.5);
      break;
    }
    case 7: {
      const noise = createNoise(ctx, 1.8), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 4500;
      g.gain.setValueAtTime(0.8, now); g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      noise.connect(hp); hp.connect(g); g.connect(ctx.destination); noise.start(now); noise.stop(now + 1.9);
      break;
    }
    case 8: {
      const osc = ctx.createOscillator(), og = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 650;
      og.gain.setValueAtTime(0.35, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(og); og.connect(ctx.destination); osc.start(now); osc.stop(now + 1.0);
      const noise = createNoise(ctx, 0.25), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 7000; bp.Q.value = 2;
      ng.gain.setValueAtTime(0.18, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      noise.connect(bp); bp.connect(ng); ng.connect(ctx.destination); noise.start(now); noise.stop(now + 0.3);
      break;
    }
    case 9: {
      [0, 0.012, 0.024].forEach((delay) => {
        const noise = createNoise(ctx, 0.08), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
        g.gain.setValueAtTime(0.65, now + delay); g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
        noise.connect(bp); bp.connect(g); g.connect(ctx.destination);
        noise.start(now + delay); noise.stop(now + delay + 0.12);
      });
      break;
    }
  }
}

// ── PUBLIC API ─────────────────────────────────────────────────────────────
export async function playSound(soundId, instrument) {
  resumeAudio();
  if (instrument === 'guitar') await playGuitarChord(soundId);
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
  const cancel = () => { cancelled = true; timers.forEach(clearTimeout); };
  return { promise, cancel };
}