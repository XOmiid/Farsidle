let context;
const active = new Set();
export async function unlockAudio() {
  context ??= new (window.AudioContext || window.webkitAudioContext)();
  await context.resume();
}
function connect(source, gain, start, duration) {
  source.connect(gain);
  gain.connect(context.destination);
  source.start(start);
  source.stop(start + duration);
  active.add(source);
  source.onended = () => {
    active.delete(source);
    source.disconnect();
    gain.disconnect();
  };
}
function percussion(voice) {
  const now = context.currentTime;
  if ([0, 4, 5, 7].includes(voice)) {
    const osc = context.createOscillator(),
      gain = context.createGain();
    const frequency = [130, 0, 0, 0, 290, 140, 0, 800][voice];
    osc.type = voice === 7 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(voice === 0 ? 35 : frequency * 0.5, now + 0.2);
    gain.gain.setValueAtTime(0.23, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    connect(osc, gain, now, 0.5);
  }
  if (voice === 0 || voice === 4 || voice === 5) return;
  const duration = [0.2, 0.2, 0.08, 0.5, 0.2, 0.2, 1, 0.35, 0.14][voice];
  const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    ),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource(),
    gain = context.createGain(),
    filter = context.createBiquadFilter();
  source.buffer = buffer;
  filter.type = voice === 1 || voice === 8 ? 'bandpass' : 'highpass';
  filter.frequency.value = voice === 1 ? 1800 : voice === 8 ? 1100 : voice === 6 ? 4200 : 7000;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.17, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.start(now);
  source.stop(now + duration);
  active.add(source);
  source.onended = () => {
    active.delete(source);
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}
export async function sound(notes, instrument = 0, voice = 0) {
  await unlockAudio();
  if (instrument === 2) {
    percussion(voice);
    return;
  }
  const now = context.currentTime;
  for (const [i, note] of notes.entries()) {
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = instrument === 0 ? 'triangle' : 'sine';
    oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
    const start = now + (instrument === 0 ? i * 0.045 : 0);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22 / notes.length, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
    connect(oscillator, gain, start, 0.85);
  }
}
export function stopAudio() {
  for (const source of active) {
    try {
      source.stop();
    } catch {}
  }
  active.clear();
}
