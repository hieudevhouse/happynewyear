import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getPlayerReward } from './playerSession.js';

const PlayerContext = createContext(null);
const emptyPlayer = () => ({ code: '', name: '', status: 'available', opened: [], rewards: [] });

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(emptyPlayer);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const request = useRef(null);

  const retrySession = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setSessionError('');
    try {
      const result = await api('/player/session', { signal: controller.signal });
      if (!controller.signal.aborted) setPlayer(result.player || emptyPlayer());
    } catch (error) {
      if (!controller.signal.aborted) {
        setSessionError(error.status ? error.message : 'Không kết nối được máy chủ. Vui lòng thử lại.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    retrySession();
    return () => request.current?.abort();
  }, [retrySession]);

  const start = async code => {
    const result = await api('/player/start', { method: 'POST', body: { code: code.trim().toUpperCase() } });
    setPlayer(result.player);
    return result.player;
  };

  const setName = async name => {
    const activeCode = player.code;
    const result = await api('/player/name', { method: 'PATCH', body: { name: name.trim() } });
    setPlayer(current => current.code === activeCode ? result.player : current);
    return result.player;
  };

  const receive = async index => {
    const activeCode = player.code;
    try {
      const result = await api(`/player/envelopes/${index}/open`, { method: 'POST' });
      setPlayer(current => current.code === activeCode ? result.player : current);
      return getPlayerReward({ rewards: [result.reward] }, index);
    } catch (error) {
      // Another tab may have consumed this code while this page was still open.
      const latest = error.details?.player;
      if (latest?.code === activeCode) {
        setPlayer(current => current.code === activeCode ? latest : current);
      }
      throw error;
    }
  };

  return <PlayerContext.Provider value={{ player, loading, sessionError, retrySession, start, setName, receive }}>
    {children}
  </PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('PlayerProvider is required');
  return context;
}
