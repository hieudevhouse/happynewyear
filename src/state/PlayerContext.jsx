import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getPlayerReward } from './playerSession.js';
import { createPlayerRefreshController } from './playerRefresh.js';
import { startStatusPolling } from './statusPolling.js';

const PlayerContext = createContext(null);
const emptyPlayer = () => ({ code: '', name: '', status: 'available', opened: [], rewards: [] });

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(emptyPlayer);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [statusRefreshError, setStatusRefreshError] = useState('');
  const request = useRef(null);
  const playerRef = useRef(player);
  const sync = useRef(null);
  if (!sync.current) {
    sync.current = createPlayerRefreshController({
      getPlayer: () => playerRef.current,
      applyPlayer: nextPlayer => {
        playerRef.current = nextPlayer;
        setPlayer(nextPlayer);
      },
      fetchPlayer: async signal => (await api('/player/session', { signal })).player
    });
  }

  const retrySession = useCallback(async () => {
    request.current?.abort();
    const token = sync.current.invalidate();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setSessionError('');
    try {
      const result = await api('/player/session', { signal: controller.signal });
      if (!controller.signal.aborted) sync.current.apply(result.player || emptyPlayer(), token);
    } catch (error) {
      if (!controller.signal.aborted && sync.current.isCurrent(token)) {
        setSessionError(error.status ? error.message : 'Không kết nối được máy chủ. Vui lòng thử lại.');
      }
    } finally {
      if (!controller.signal.aborted && sync.current.isCurrent(token)) setLoading(false);
    }
  }, []);

  useEffect(() => {
    retrySession();
    return () => {
      request.current?.abort();
      sync.current.invalidate();
    };
  }, [retrySession]);

  const start = useCallback(async code => {
    request.current?.abort();
    const token = sync.current.invalidate();
    // A failed code submission must not leave an aborted session load spinning.
    setLoading(false);
    const result = await api('/player/start', { method: 'POST', body: { code: code.trim().toUpperCase() } });
    if (sync.current.commit(result.player, token)) {
      setLoading(false);
      setStatusRefreshError('');
    }
    return result.player;
  }, []);

  const setName = useCallback(async name => {
    const activeCode = playerRef.current.code;
    const token = sync.current.invalidate();
    const result = await api('/player/name', { method: 'PATCH', body: { name: name.trim() } });
    sync.current.commit(result.player, token, activeCode);
    return result.player;
  }, []);

  const receive = useCallback(async index => {
    const activeCode = playerRef.current.code;
    const token = sync.current.invalidate();
    try {
      const result = await api(`/player/envelopes/${index}/open`, { method: 'POST' });
      sync.current.commit(result.player, token, activeCode);
      return getPlayerReward({ rewards: [result.reward] }, index);
    } catch (error) {
      // Another tab may have consumed this code while this page was still open.
      const latest = error.details?.player;
      if (latest?.code === activeCode) sync.current.commit(latest, token, activeCode);
      throw error;
    }
  }, []);

  const saveRedemption = useCallback(async payload => {
    const activeCode = playerRef.current.code;
    const token = sync.current.invalidate();
    try {
      const result = await api('/player/redemption', { method: 'POST', body: payload });
      if (sync.current.commit(result.player, token, activeCode)) setStatusRefreshError('');
      return result.player;
    } catch (error) {
      const latest = error.details?.player;
      if (latest?.code === activeCode) sync.current.commit(latest, token, activeCode);
      throw error;
    }
  }, []);

  const refreshPlayer = useCallback(async options => {
    const nextPlayer = await sync.current.refresh(options);
    setStatusRefreshError('');
    return nextPlayer;
  }, []);

  useEffect(() => {
    if (loading || !player.code || player.redemption?.method !== 'bank' || player.redemption.status !== 'pending') return;
    return startStatusPolling({
      refresh: refreshPlayer,
      onError: error => setStatusRefreshError(error.message || 'Chưa cập nhật được trạng thái chuyển tiền.')
    });
  }, [loading, player.code, player.redemption?.method, player.redemption?.status, refreshPlayer]);

  return <PlayerContext.Provider value={{ player, loading, sessionError, statusRefreshError, retrySession, start, setName, receive, saveRedemption, refreshPlayer }}>
    {children}
  </PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('PlayerProvider is required');
  return context;
}
