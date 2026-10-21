// Stream the supplied recording instead of decoding the entire song into memory.
export function createBackgroundMusic(src, { startAt = 10, volume = 0.28, onPlaybackChange } = {}) {
  const offset = Number.isFinite(startAt) ? Math.max(0, startAt) : 10;
  const level = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.28;
  let audio = null;
  let requested = false;
  let disposed = false;
  let needsOffset = true;
  let generation = 0;
  let latestRequest = 0;
  let status = null;

  function publish(next) {
    if (disposed || next === status) return;
    status = next;
    try { onPlaybackChange?.(next); } catch { /* Observers cannot interrupt playback. */ }
  }

  function safelyPause(element = audio) {
    try { element?.pause(); } catch { /* Media may already have been released. */ }
  }

  function seekPastIntro() {
    if (!audio || !needsOffset) return true;
    try {
      // Before metadata this sets the default playback start position. Browsers
      // that cannot do that are retried by loadedmetadata, before audio decodes.
      audio.currentTime = offset;
      if (audio.readyState < 1 || Math.abs(audio.currentTime - offset) > 0.05) return false;
      needsOffset = false;
      return true;
    } catch {
      return false;
    }
  }

  function onMetadata() {
    if (disposed || !needsOffset) return;
    if (!seekPastIntro() && requested) onError();
  }

  function onEnded() {
    if (disposed || !requested) return;
    // Native looping restarts at zero, so explicitly seek for every repetition.
    needsOffset = true;
    void start();
  }

  function onError() {
    if (disposed || !requested) return;
    requested = false;
    generation += 1;
    publish('error');
    safelyPause();
  }

  function onPlaying() {
    if (disposed || !requested) {
      safelyPause();
      return;
    }
    if (!seekPastIntro() || audio.muted || audio.paused) {
      onError();
      return;
    }
    publish('playing');
  }

  function onPause() {
    if (disposed || !audio?.paused || status === 'blocked' || status === 'error') return;
    publish('paused');
  }

  function onRejected(error, attempt, request, element) {
    if (!disposed && attempt === generation && request === latestRequest) {
      requested = false;
      publish(error?.name === 'NotAllowedError' ? 'blocked' : 'error');
      safelyPause(element);
    }
    return false;
  }

  function initialize() {
    if (audio) return true;
    if (typeof globalThis.Audio !== 'function') return false;
    let element;
    try {
      element = new globalThis.Audio(src);
      element.preload = 'auto';
      element.loop = false;
      element.volume = level;
      // Ask for audible autoplay directly. Muted autoplay followed by an async
      // unmute can be stopped by browser policy even when play() first resolves.
      element.muted = false;
      element.addEventListener('loadedmetadata', onMetadata);
      element.addEventListener('ended', onEnded);
      element.addEventListener('error', onError);
      element.addEventListener('playing', onPlaying);
      element.addEventListener('pause', onPause);
      audio = element;
      return true;
    } catch {
      safelyPause(element);
      return false;
    }
  }

  function start() {
    if (disposed) return Promise.resolve(false);
    if (!initialize()) {
      publish('error');
      return Promise.resolve(false);
    }
    requested = true;
    const attempt = generation;
    const request = ++latestRequest;
    const element = audio;
    if (element.paused || element.muted || status !== 'playing') publish('loading');
    seekPastIntro();
    // A metadata-ready seek failure must never play the original intro.
    if (needsOffset && element.readyState >= 1) {
      onError();
      return Promise.resolve(false);
    }
    let playback;
    try {
      // Retry inside every gesture, even when an autoplay promise is still pending.
      playback = element.play();
    } catch (error) {
      return Promise.resolve(onRejected(error, attempt, request, element));
    }

    return Promise.resolve(playback).then(() => {
      if (disposed || !requested || attempt !== generation) {
        // A stale completion must never pause playback requested after a pause.
        if (disposed || !requested) safelyPause(element);
        return false;
      }
      if (!seekPastIntro() || element.muted || element.paused) {
        if (request === latestRequest) {
          onError();
        }
        return false;
      }
      if (request === latestRequest) publish('playing');
      return true;
    }).catch(error => onRejected(error, attempt, request, element));
  }

  function pause() {
    requested = false;
    generation += 1;
    publish('paused');
    safelyPause();
  }

  function dispose() {
    if (disposed) return;
    pause();
    disposed = true;
    if (!audio) return;
    audio.removeEventListener('loadedmetadata', onMetadata);
    audio.removeEventListener('ended', onEnded);
    audio.removeEventListener('error', onError);
    audio.removeEventListener('playing', onPlaying);
    audio.removeEventListener('pause', onPause);
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch { /* Some media implementations do not expose resource unloading. */ }
  }

  return { start, pause, dispose };
}
