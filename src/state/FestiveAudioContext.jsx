import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createFestiveAudio } from '../lib/festiveAudio';

const FestiveAudioContext = createContext(null);

export function FestiveAudioProvider({ children }) {
  const [enabled, setEnabled] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [playbackState, setPlaybackState] = useState('loading');
  const supported = Boolean(window.Audio);
  const audio = useRef(null);
  const enabledRef = useRef(enabled);
  const playingRef = useRef(false);
  const mounted = useRef(false);
  const playbackAttempt = useRef(0);

  const updatePlaying = useCallback(value => {
    playingRef.current = value;
    if (mounted.current) setPlaying(value);
  }, []);

  const start = useCallback(() => {
    if (!enabledRef.current || document.hidden || !mounted.current) return Promise.resolve(false);
    if (!audio.current) {
      const current = createFestiveAudio({ onPlaybackChange: state => {
        if (audio.current !== current || !mounted.current) return;
        setPlaybackState(state);
        updatePlaying(enabledRef.current && state === 'playing');
      } });
      audio.current = current;
    }
    const current = audio.current;
    const attempt = ++playbackAttempt.current;
    // Keep this synchronous so a trusted gesture can unlock audio when needed.
    return current.start().then(started => {
      if (audio.current !== current || !mounted.current) return false;
      if (!enabledRef.current || document.hidden) {
        current.pause();
        updatePlaying(false);
        return false;
      }
      if (attempt === playbackAttempt.current) {
        updatePlaying(started);
        if (!started) setPlaybackState(state => state === 'loading' ? 'blocked' : state);
      }
      return started;
    }).catch(() => {
      if (attempt === playbackAttempt.current) {
        updatePlaying(false);
        setPlaybackState('error');
      }
      return false;
    });
  }, [updatePlaying]);

  useEffect(() => {
    mounted.current = true;
    const onGesture = event => {
      if (!event.isTrusted || event.target?.closest?.('[data-sound-toggle]') || event.ctrlKey || event.metaKey || event.altKey) return;
      start();
    };
    const onVisibility = () => {
      if (document.hidden) {
        playbackAttempt.current += 1;
        audio.current?.pause();
        updatePlaying(false);
      } else start();
    };
    document.addEventListener('pointerdown', onGesture, { passive: true });
    document.addEventListener('click', onGesture);
    document.addEventListener('keydown', onGesture);
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => {
      mounted.current = false;
      playbackAttempt.current += 1;
      document.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('click', onGesture);
      document.removeEventListener('keydown', onGesture);
      document.removeEventListener('visibilitychange', onVisibility);
      audio.current?.dispose();
      audio.current = null;
    };
  }, [start, updatePlaying]);

  const toggle = useCallback(() => {
    // A blocked play button retries playback instead of turning the music off.
    const next = !(enabledRef.current && playingRef.current);
    enabledRef.current = next;
    setEnabled(next);
    if (next) start();
    else {
      playbackAttempt.current += 1;
      audio.current?.pause();
      updatePlaying(false);
    }
  }, [start, updatePlaying]);

  const playOpening = useCallback(() => {
    if (!enabledRef.current || document.hidden) return;
    // Keyboard activation and a first click directly on a packet also unlock audio.
    start().then(started => {
      if (started && enabledRef.current && !document.hidden) audio.current?.playOpening();
    });
  }, [start]);

  const playReward = useCallback(() => {
    if (enabledRef.current && !document.hidden) audio.current?.playReward();
  }, []);

  return <FestiveAudioContext.Provider value={{ enabled, playing, playbackState, supported, toggle, playOpening, playReward }}>
    {children}
  </FestiveAudioContext.Provider>;
}

export function useFestiveAudio() {
  const context = useContext(FestiveAudioContext);
  if (!context) throw new Error('FestiveAudioProvider is required');
  return context;
}
