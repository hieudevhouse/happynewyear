import { createContext, useContext, useEffect, useState } from 'react';
import {
  PLAYER_STORAGE_KEY, createPlayerSession, restorePlayerSession, startPlayerSession, openPlayerEnvelope
} from './playerSession.js';

const PlayerContext = createContext(null);

function loadSession() {
  try { return restorePlayerSession(window.sessionStorage.getItem(PLAYER_STORAGE_KEY)) || createPlayerSession(); }
  catch { return createPlayerSession(); }
}

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(loadSession);
  useEffect(() => {
    try { window.sessionStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player)); }
    catch { /* The flow remains usable if storage is unavailable. */ }
  }, [player]);

  const value = {
    player,
    start: code => setPlayer(current => startPlayerSession(current, code)),
    setName: name => setPlayer(current => ({ ...current, name: name.trim().slice(0, 60) })),
    receive: index => setPlayer(current => openPlayerEnvelope(current, index))
  };
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('PlayerProvider is required');
  return context;
}
