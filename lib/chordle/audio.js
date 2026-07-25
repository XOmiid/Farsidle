// Chord definitions — each chord is an array of frequencies (Hz)
// representing the notes played simultaneously.
// Index 1–9 maps exactly to the database values.
const CHORD_FREQUENCIES = {
    1: [261.63, 329.63, 392.00],       // C major  (C4, E4, G4)
    2: [196.00, 246.94, 293.66],       // G major  (G3, B3, D4)
    3: [174.61, 220.00, 261.63],       // F major  (F3, A3, C4)
    4: [220.00, 261.63, 329.63],       // A minor  (A3, C4, E4)
    5: [146.83, 174.61, 220.00],       // D minor  (D3, F3, A3)
    6: [164.81, 207.65, 246.94],       // E major  (E3, G#3, B3)
    7: [233.08, 293.66, 349.23],       // Bb major (Bb3, D4, F4)
    8: [164.81, 196.00, 246.94],       // E minor  (E3, G3, B3)
    9: [146.83, 185.00, 220.00],       // D major  (D3, F#3, A3)
  };
  
  // Chord display colors — used for the buttons
  export const CHORD_COLORS = {
    1: "#4ade80", // green
    2: "#60a5fa", // blue
    3: "#f97316", // orange
    4: "#c084fc", // purple
    5: "#f43f5e", // red
    6: "#facc15", // yellow
    7: "#2dd4bf", // teal
    8: "#fb923c", // amber
    9: "#a78bfa", // violet
  };
  
  let audioCtx = null;
  
  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  
  // Play a single chord for a given duration
  export function playChord(chordIndex, duration = 1.2) {
    const ctx = getCtx();
    const freqs = CHORD_FREQUENCIES[chordIndex];
    if (!freqs) return;
  
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
  
    // Piano-like envelope: fast attack, medium decay, soft sustain, release
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.25, now + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
    freqs.forEach((freq) => {
      // Fundamental
      const osc = ctx.createOscillator();
      osc.type = "triangle"; // warmer than sine, less harsh than square
      osc.frequency.value = freq;
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + duration);
  
      // Subtle harmonic an octave up for brightness
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2;
      const g2 = ctx.createGain();
      g2.gain.value = 0.15;
      osc2.connect(g2);
      g2.connect(gainNode);
      osc2.start(now);
      osc2.stop(now + duration);
    });
  }
  
  // Play a full sequence with gaps between chords.
  // Returns a promise that resolves when the sequence finishes.
  export function playSequence(chordIndices, onChordStart) {
    return new Promise((resolve) => {
      const GAP = 0.3;       // seconds between chord starts
      const DURATION = 1.0;  // each chord rings for this long
  
      chordIndices.forEach((idx, i) => {
        const delay = i * (DURATION + GAP);
        setTimeout(() => {
          if (onChordStart) onChordStart(idx, i);
          playChord(idx, DURATION);
        }, delay * 1000);
      });
  
      const total = chordIndices.length * (DURATION + GAP) * 1000;
      setTimeout(resolve, total);
    });
  }
  
  // Resume the AudioContext if it was suspended (required by browsers
  // after a user gesture — call this inside any click handler)
  export function resumeAudio() {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }