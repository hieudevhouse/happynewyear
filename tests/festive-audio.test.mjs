import assert from 'node:assert/strict';
import test from 'node:test';
import { createFestiveAudio } from '../src/lib/festiveAudio.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mockAudio(t, {
  supported = true,
  mediaSupported = true,
  delayedResume = false,
  delayedPlay = false,
} = {}) {
  const originals = new Map();
  const contexts = [];
  const media = [];
  let audio;

  function replace(name, value) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }

  class AudioParam {
    value = 0;
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
    cancelScheduledValues() {}
  }

  class Node {
    connected = false;
    disconnectCount = 0;
    connect() { this.connected = true; }
    disconnect() { this.connected = false; this.disconnectCount += 1; }
  }

  class Source extends Node {
    frequency = new AudioParam();
    startTimes = [];
    stopTimes = [];
    start(time) { this.startTimes.push(time); }
    stop(time) { this.stopTimes.push(time); }
  }

  class AudioContext {
    state = 'suspended';
    currentTime = 0;
    sampleRate = 8;
    destination = new Node();
    sources = [];
    nodes = [];
    resumes = [];
    closeCount = 0;

    constructor() { contexts.push(this); }
    createGain() {
      const node = new Node();
      node.gain = new AudioParam();
      this.nodes.push(node);
      return node;
    }
    createOscillator() {
      const source = new Source();
      this.sources.push(source);
      return source;
    }
    createBufferSource() { return this.createOscillator(); }
    createBiquadFilter() {
      const node = new Node();
      node.frequency = new AudioParam();
      this.nodes.push(node);
      return node;
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    resume() {
      const request = deferred();
      this.resumes.push(request);
      if (!delayedResume) {
        this.state = 'running';
        request.resolve();
      }
      return request.promise;
    }
    completeResume(index) {
      this.state = 'running';
      this.resumes[index].resolve();
    }
    unlock() {
      this.state = 'running';
      // Browsers release every queued resume promise when a gesture unlocks audio.
      for (const request of this.resumes) request.resolve();
    }
    close() {
      this.closeCount += 1;
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  class MockAudio {
    src = '';
    currentTime = 0;
    duration = 180;
    readyState = 1;
    paused = true;
    loop = false;
    preload = '';
    volume = 1;
    plays = [];
    pauseCount = 0;
    loadCount = 0;
    listeners = new Map();

    constructor(src = '') {
      this.src = src;
      media.push(this);
    }
    play() {
      const request = deferred();
      this.plays.push(request);
      this.paused = false;
      if (!delayedPlay) request.resolve();
      return request.promise;
    }
    pause() {
      this.pauseCount += 1;
      this.paused = true;
    }
    load() { this.loadCount += 1; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    addEventListener(name, listener) {
      const listeners = this.listeners.get(name) || new Set();
      listeners.add(listener);
      this.listeners.set(name, listeners);
    }
    removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
    dispatch(name) {
      for (const listener of this.listeners.get(name) || []) listener();
      this[`on${name}`]?.();
    }
  }

  replace('Audio', mediaSupported ? MockAudio : undefined);
  replace('AudioContext', supported ? AudioContext : undefined);
  replace('webkitAudioContext', undefined);
  audio = createFestiveAudio();
  t.after(() => {
    audio.dispose();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { audio, contexts, media };
}

test('browsers without media or WebAudio safely return silent playback results', async t => {
  const { audio, contexts, media } = mockAudio(t, { supported: false, mediaSupported: false });
  assert.equal(await audio.start(), false);
  assert.equal(audio.playOpening(), false);
  assert.equal(audio.playReward(), false);
  audio.pause();
  audio.dispose();
  assert.equal(await audio.start(), false);
  assert.equal(contexts.length, 0);
  assert.equal(media.length, 0);
});

test('MP3 background skips the first ten seconds without requiring WebAudio', async t => {
  const { audio, contexts, media } = mockAudio(t, { supported: false });
  assert.equal(await audio.start(), true);
  assert.equal(media.length, 1);
  assert.match(decodeURIComponent(media[0].src), /Tết Đong Đầy\.mp3$/u);
  assert.equal(media[0].currentTime, 10);
  assert.equal(media[0].plays.length, 1);
  assert.equal(audio.playOpening(), false);
  assert.equal(audio.playReward(), false);
  assert.equal(contexts.length, 0);

  media[0].currentTime = 42;
  audio.pause();
  assert.equal(media[0].paused, true);
  assert.equal(await audio.start(), true);
  assert.equal(media.length, 1);
  assert.equal(media[0].plays.length, 2);
  assert.equal(media[0].currentTime, 42, 'unmuting continues the current song position');
});

test('a blocked MP3 autoplay attempt can be retried without creating duplicate players', async t => {
  const { audio, media } = mockAudio(t, { delayedPlay: true });
  const blocked = audio.start();
  const player = media[0];
  player.paused = true;
  player.plays[0].reject(new Error('Autoplay requires a user gesture'));
  assert.equal(await blocked, false);
  assert.equal(audio.playOpening(), true, 'running WebAudio effects remain available when MP3 autoplay is blocked');

  const retry = audio.start();
  assert.equal(player.plays.length, 2, 'play is retried synchronously from the next user gesture');
  player.plays[1].resolve();
  assert.equal(await retry, true);
  assert.equal(media.length, 1);
});

test('a trusted gesture retries a pending WebAudio resume while MP3 music can already play', async t => {
  const { audio, contexts, media } = mockAudio(t, { delayedResume: true });
  assert.equal(await audio.start(), true);
  const context = contexts[0];
  assert.equal(context.state, 'suspended');
  assert.equal(context.sources.length, 0);
  assert.equal(audio.playOpening(), false);

  // This second call represents the pointer/keyboard handler's trusted gesture.
  const gesture = audio.start();
  assert.equal(context.resumes.length, 2, 'resume is retried before leaving the gesture handler');
  context.unlock();
  assert.equal(await gesture, true);
  assert.equal(context.sources.length, 0, 'background music does not synthesize oscillator notes');
  assert.equal(await audio.start(), true);
  assert.equal(context.resumes.length, 2, 'running audio requires no further resume attempt');
  assert.equal(media.length, 1);
  assert.equal(audio.playOpening(), true);
});

test('a rejected WebAudio resume leaves MP3 playback available for retrying effects', async t => {
  const { audio, contexts, media } = mockAudio(t, { delayedResume: true });
  assert.equal(await audio.start(), true);
  const context = contexts[0];
  context.resumes[0].reject(new Error('WebAudio requires a user gesture'));
  await Promise.resolve();
  assert.equal(media[0].paused, false);
  assert.equal(audio.playReward(), false);

  const retry = audio.start();
  assert.equal(context.resumes.length, 2);
  context.completeResume(1);
  assert.equal(await retry, true);
  assert.equal(audio.playReward(), true);
});

test('muting pauses MP3 music and stops effects, and playback can resume', async t => {
  const { audio, contexts, media } = mockAudio(t);
  assert.equal(audio.playOpening(), false);
  assert.equal(audio.playReward(), false);
  assert.equal(await audio.start(), true);
  const context = contexts[0];
  assert.equal(context.sources.length, 0);
  assert.equal(audio.playOpening(), true);
  assert.equal(audio.playReward(), true);
  assert.ok(context.sources.length > 0);
  const playingSources = [...context.sources];

  audio.pause();
  assert.equal(media[0].paused, true);
  assert.ok(playingSources.every(source => source.stopTimes.length >= 2 && !source.connected));
  assert.equal(audio.playOpening(), false);
  assert.equal(audio.playReward(), false);
  assert.equal(context.sources.length, playingSources.length);
  assert.equal(await audio.start(), true);
  assert.equal(media[0].plays.length, 2);
  assert.equal(context.sources.length, playingSources.length);

  audio.dispose();
  audio.dispose();
  assert.equal(context.closeCount, 1);
  assert.equal(media[0].paused, true);
  assert.equal(media[0].src, '');
  assert.equal(media[0].loadCount, 1);
  assert.equal(await audio.start(), false);
  assert.equal(audio.playOpening(), false);
});

test('a late WebAudio resume cannot revive muted effects or overwrite newer playback', async t => {
  const { audio, contexts, media } = mockAudio(t, { delayedResume: true });
  assert.equal(await audio.start(), true);
  const context = contexts[0];
  audio.pause();
  assert.equal(await audio.start(), true);
  context.completeResume(1);
  await Promise.resolve();
  context.completeResume(0);
  await Promise.resolve();
  assert.equal(media[0].paused, false);
  assert.equal(audio.playReward(), true);

  audio.pause();
  context.state = 'suspended';
  assert.equal(await audio.start(), true);
  audio.pause();
  context.completeResume(2);
  await Promise.resolve();
  assert.equal(media[0].paused, true);
  assert.equal(audio.playReward(), false);

  context.state = 'suspended';
  assert.equal(await audio.start(), true);
  audio.dispose();
  context.completeResume(3);
  await Promise.resolve();
  assert.equal(audio.playReward(), false);
  assert.equal(context.closeCount, 1);
});

test('late MP3 playback results cannot revive audio after mute or disposal', async t => {
  const { audio, media } = mockAudio(t, { delayedPlay: true });
  const first = audio.start();
  const player = media[0];
  audio.pause();
  player.plays[0].resolve();
  assert.equal(await first, false);
  assert.equal(player.paused, true);
  assert.equal(audio.playOpening(), false);

  const second = audio.start();
  audio.dispose();
  player.plays[1].reject(new Error('Playback aborted by disposal'));
  assert.equal(await second, false);
  assert.equal(player.paused, true);
  assert.equal(player.src, '');
  assert.equal(await audio.start(), false);
});
