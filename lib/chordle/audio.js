// Chord definitions — 9 maximally distinct chords chosen for:
//   - Spread across different pitch ranges (low to high)
//   - Different chord qualities: major, minor, dominant 7, diminished,
//     augmented, suspended — so each has a genuinely different character
//   - Minimal note overlap between adjacent chords
//
// Index 1–9 maps exactly to the database values.
//
//   1 = C major      — warm, resolved, "home"
//   2 = A minor      — sad, dark contrast to C major
//   3 = G dominant 7 — tense, "needs to resolve"
//   4 = F major      — warm but higher, clearly different pitch center
//   5 = B diminished — eerie, very distinctive dissonance
//   6 = E minor      — deep and brooding, lowest voiced
//   7 = C augmented  — unsettling, nobody confuses this with anything
//   8 = D sus4       — floating, neither major nor minor
//   9 = A major      — bright and high, clearly distinct from all others
const CHORD_FREQUENCIES = {
    1: [261.63, 329.63, 392.00],       // C major   (C4, E4, G4)
    2: [220.00, 261.63, 329.63],       // A minor   (A3, C4, E4)
    3: [196.00, 246.94, 293.66, 349.23], // G7      (G3, B3, D4, F4)
    4: [174.61, 220.00, 261.63],       // F major   (F3, A3, C4)
    5: [246.94, 293.66, 369.99],       // B dim     (B3, D4, Ab4)
    6: [164.81, 196.00, 246.94],       // E minor   (E3, G3, B3)
    7: [261.63, 329.63, 415.30],       // C aug     (C4, E4, G#4)
    8: [293.66, 392.00, 440.00],       // D sus4    (D4, G4, A4)
    9: [440.00, 554.37, 659.25],       // A major   (A4, C#5, E5) — high and bright
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