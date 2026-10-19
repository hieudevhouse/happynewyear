import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    api('/auth/me', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setAdmin(data.admin); })
      .catch(() => { if (!controller.signal.aborted) setAdmin(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const expired = () => setAdmin(null);
    window.addEventListener('lm:unauthorized', expired);
    return () => { controller.abort(); window.removeEventListener('lm:unauthorized', expired); };
  }, []);

  async function login(username, password) {
    const data = await api('/auth/login', { method: 'POST', body: { username, password } });
    setAdmin(data.admin);
    return data.admin;
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setAdmin(null);
  }
  return <AdminContext.Provider value={{ admin, loading, login, logout }}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('AdminProvider is required');
  return context;
}
