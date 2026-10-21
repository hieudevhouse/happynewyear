import { createBackgroundMusic } from './backgroundMusic.js';

const BACKGROUND_URL = new URL('../assets/Tết Đong Đầy.mp3', import.meta.url).href;
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function createFestiveAudio({ onPlaybackChange } = {}) {
  const music = createBackgroundMusic(BACKGROUND_URL, { startAt: 10, volume: 0.28, onPlaybackChange });
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let requested = false;
  let disposed = false;
  let generation = 0;
  const voices = new Map();

  function track(source, nodes) {
    const cleanup = () => {
      if (!voices.delete(source)) return;
      for (const node of nodes) node.disconnect();
    };
    voices.set(source, cleanup);
    source.onended = cleanup;
  }

  function stopVoices() {
    for (const [source, cleanup] of Array.from(voices)) {
      try { source.stop(); } catch { /* The source may have just finished. */ }
      cleanup();
    }
  }

  function tone(midi, time, duration, volume, type = 'sine', endFrequency = null) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency(midi), time);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    }
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + Math.min(0.012, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(master);
    track(oscillator, [oscillator, gain]);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.025);
  }

  function pluck(midi, time, duration = 0.48, volume = 0.075) {
    tone(midi, time, duration, volume, 'triangle');
    tone(midi + 12, time, duration * 0.55, volume * 0.19);
  }

  function bell(midi, time, volume = 0.045, duration = 0.7) {
    tone(midi, time, duration, volume);
    tone(midi + 19, time, duration * 0.5, volume * 0.22);
  }

  function noise(time, duration, volume, cutoff, filterType = 'highpass') {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + Math.min(0.015, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    track(source, [source, filter, gain]);
    source.start(time);
    source.stop(time + duration + 0.02);
  }

  function initialize() {
    if (context) return true;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return false;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;
    return true;
  }

  function start() {
    if (disposed) return Promise.resolve(false);
    requested = true;
    const attempt = generation;
    // Start the MP3 before any async boundary to retain the user's activation.
    const playback = music.start();
    try {
      if (initialize()) {
        const current = context;
        const resume = current.state === 'running' ? Promise.resolve() : current.resume();
        // Effect support must not hold up or prevent background music playback.
        Promise.resolve(resume).then(() => {
          if (disposed || !requested || attempt !== generation || context !== current || current.state !== 'running') return;
          master.gain.cancelScheduledValues(current.currentTime);
          master.gain.setValueAtTime(0.72, current.currentTime);
        }).catch(() => {});
      }
    } catch { /* The MP3 still works if Web Audio effects are unavailable. */ }
    return playback.then(started => !disposed && requested && attempt === generation && started).catch(() => false);
  }

  function pause() {
    requested = false;
    generation += 1;
    music.pause();
    if (master && context?.state !== 'closed') {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
    }
    stopVoices();
  }

  function playOpening() {
    if (!requested || disposed || context?.state !== 'running') return false;
    const now = context.currentTime + 0.005;
    noise(now, 0.15, 0.07, 1800, 'bandpass');
    noise(now + 0.12, 0.22, 0.045, 2800, 'bandpass');
    [74, 78, 81, 86].forEach((note, i) => bell(note, now + 0.2 + i * 0.075, 0.055, 0.5));
    return true;
  }

  function playReward() {
    if (!requested || disposed || context?.state !== 'running') return false;
    const now = context.currentTime + 0.005;
    [74, 78, 81, 86].forEach((note, i) => bell(note, now + i * 0.09, 0.085, 0.9));
    pluck(62, now + 0.27, 0.7, 0.06);
    return true;
  }

  function dispose() {
    if (disposed) return;
    pause();
    disposed = true;
    music.dispose();
    master?.disconnect();
    const previousContext = context;
    context = null;
    master = null;
    if (previousContext && previousContext.state !== 'closed') {
      try { Promise.resolve(previousContext.close()).catch(() => {}); } catch { /* Already closing. */ }
    }
    noiseBuffer = null;
  }

  return { start, pause, playOpening, playReward, dispose };
}
