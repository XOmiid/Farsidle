// ============================================================
//  Chordle v2 Audio Engine
//  Three genuinely different synthesis approaches:
//  - Guitar: Karplus-Strong plucked string algorithm
//  - Piano: Harmonic oscillators with piano-like envelope
//  - Drums: Noise/frequency synthesis for 9 drum kit sounds
// ============================================================

let audioCtx = null;

export function resumeAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// ── CHORD POOL (16 chords, 9 picked per night) ───────────────────────────
// Frequencies for guitar and piano — musically distinct chords
// Each chord = array of [root, third, fifth] frequencies in Hz
export const CHORD_POOL = {
  1:  { name: "C maj",  freqs: [261.63, 329.63, 392.00] },
  2:  { name: "G maj",  freqs: [196.00, 246.94, 293.66] },
  3:  { name: "D maj",  freqs: [146.83, 185.00, 220.00] },
  4:  { name: "A min",  freqs: [220.00, 261.63, 329.63] },
  5:  { name: "E min",  freqs: [164.81, 196.00, 246.94] },
  6:  { name: "F maj",  freqs: [174.61, 220.00, 261.63] },
  7:  { name: "B dim",  freqs: [246.94, 293.66, 369.99] },
  8:  { name: "C aug",  freqs: [261.63, 329.63, 415.30] },
  9:  { name: "D sus4", freqs: [293.66, 392.00, 440.00] },
  10: { name: "A maj",  freqs: [440.00, 554.37, 659.25] },
  11: { name: "Bb maj", freqs: [233.08, 293.66, 349.23] },
  12: { name: "G min",  freqs: [196.00, 233.08, 293.66] },
  13: { name: "E maj",  freqs: [164.81, 207.65, 246.94] },
  14: { name: "D min",  freqs: [146.83, 174.61, 220.00] },
  15: { name: "C7",     freqs: [261.63, 329.63, 392.00, 466.16] },
  16: { name: "F min",  freqs: [174.61, 207.65, 261.63] },
};

// ── DRUM KIT (9 sounds, fixed) ────────────────────────────────────────────
export const DRUM_KIT = {
  1: { name: "Kick",       color: "#ef4444" },
  2: { name: "Snare",      color: "#f97316" },
  3: { name: "Hi-Hat C",   color: "#eab308" },
  4: { name: "Hi-Hat O",   color: "#84cc16" },
  5: { name: "Tom High",   color: "#22c55e" },
  6: { name: "Tom Low",    color: "#06b6d4" },
  7: { name: "Crash",      color: "#6366f1" },
  8: { name: "Ride",       color: "#a855f7" },
  9: { name: "Clap",       color: "#ec4899" },
};

// ── GUITAR: Karplus-Strong plucked string ─────────────────────────────────
function playGuitarChord(chordId) {
  const ctx = getCtx();
  const chord = CHORD_POOL[chordId];
  if (!chord) return;

  const now = ctx.currentTime;
  const duration = 2.0;

  chord.freqs.forEach((freq, noteIdx) => {
    const delay = noteIdx * 0.04; // slight strum effect

    // Karplus-Strong: noise burst fed into a delay line with feedback
    const bufferSize = Math.round(ctx.sampleRate / freq);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    // Delay node simulates string resonance
    const delayNode = ctx.createDelay();
    delayNode.delayTime.value = 1 / freq;

    // Lowpass filter simulates string damping
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq * 3;

    // Feedback gain (< 1 for decay)
    const feedback = ctx.createGain();
    feedback.gain.value = 0.97;

    // Output gain with envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.3, now + delay);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);

    source.connect(delayNode);
    delayNode.connect(filter);
    filter.connect(feedback);
    feedback.connect(delayNode);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(now + delay);
    source.stop(now + delay + 0.1); // burst is short, resonance carries on
  });
}

// ── PIANO: Harmonic oscillators with realistic piano envelope ─────────────
function playPianoChord(chordId) {
  const ctx = getCtx();
  const chord = CHORD_POOL[chordId];
  if (!chord) return;

  const now = ctx.currentTime;

  chord.freqs.forEach((freq) => {
    const master = ctx.createGain();
    master.connect(ctx.destination);

    // Piano envelope: very fast attack, sharp initial decay, long sustain decay
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.4, now + 0.008);   // fast attack
    master.gain.exponentialRampToValueAtTime(0.15, now + 0.1); // initial drop
    master.gain.exponentialRampToValueAtTime(0.001, now + 2.5); // long decay

    // Fundamental
    [1, 2, 3, 4].forEach((harmonic, i) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * harmonic;
      // Each harmonic quieter and decays faster
      oscGain.gain.value = [0.6, 0.2, 0.08, 0.03][i];
      osc.connect(oscGain);
      oscGain.connect(master);
      osc.start(now);
      osc.stop(now + 3.0);
    });
  });
}

// ── DRUMS: 9 distinct synthesized drum sounds ─────────────────────────────
function playDrum(drumId) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  switch (drumId) {
    case 1: { // Kick — sine sweep from high to low + noise thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.5);
      break;
    }
    case 2: { // Snare — noise burst + tone
      const bufSize = ctx.sampleRate * 0.1;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 3000;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(now); src.stop(now + 0.25);
      break;
    }
    case 3: { // Hi-Hat Closed — short noise burst, highpass
      const bufSize = ctx.sampleRate * 0.05;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 8000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(now); src.stop(now + 0.08);
      break;
    }
    case 4: { // Hi-Hat Open — longer noise, highpass
      const bufSize = ctx.sampleRate * 0.4;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 7000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(now); src.stop(now + 0.5);
      break;
    }
    case 5: { // Tom High — mid sine sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.4);
      break;
    }
    case 6: { // Tom Low — low sine sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);
      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.5);
      break;
    }
    case 7: { // Crash cymbal — wide noise, slow decay
      const bufSize = ctx.sampleRate * 1.5;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 5000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(now); src.stop(now + 1.8);
      break;
    }
    case 8: { // Ride cymbal — metallic tone + noise
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 600;
      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(oscGain); oscGain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 1.0);

      const bufSize = ctx.sampleRate * 0.3;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 6000;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      src.connect(filter); filter.connect(noiseGain); noiseGain.connect(ctx.destination);
      src.start(now); src.stop(now + 0.4);
      break;
    }
    case 9: { // Clap — layered noise bursts
      [0, 0.01, 0.02].forEach((delay) => {
        const bufSize = ctx.sampleRate * 0.05;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1200;
        filter.Q.value = 0.8;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start(now + delay); src.stop(now + delay + 0.15);
      });
      break;
    }
  }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────

export function playSound(soundId, instrument) {
  resumeAudio();
  if (instrument === "guitar") playGuitarChord(soundId);
  else if (instrument === "piano") playPianoChord(soundId);
  else if (instrument === "drums") playDrum(soundId);
}

export function playSequence(sequence, instrument) {
  const GAP = instrument === "drums" ? 0.6 : 1.3;
  const timers = [];
  let cancelled = false;

  const promise = new Promise((resolve) => {
    sequence.forEach((id, i) => {
      const t = setTimeout(() => {
        if (!cancelled) playSound(id, instrument);
      }, i * GAP * 1000);
      timers.push(t);
    });
    const total = sequence.length * GAP * 1000;
    const finalTimer = setTimeout(resolve, total);
    timers.push(finalTimer);
  });

  const cancel = () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };

  return { promise, cancel };
}

// Colors for the 9 nightly-selected chord buttons (guitar/piano)
export const CHORD_COLORS = [
  "#4ade80", "#60a5fa", "#f97316", "#c084fc",
  "#f43f5e", "#facc15", "#2dd4bf", "#fb923c", "#a78bfa"
];