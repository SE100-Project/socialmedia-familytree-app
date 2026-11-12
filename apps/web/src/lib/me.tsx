import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, onAuthChange } from './api';

export type Me = {
  id: string;
  role?: string;
  profile?: unknown | null;
};

type MeContextValue = { user: Me | null; loading: boolean };
const MeContext = createContext<MeContextValue>({ user: null, loading: true });

export function MeProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      setLoading(true);
      api<Me>('/auth/me').then((me) => active && setUser(me)).catch(() => active && setUser(null)).finally(() => active && setLoading(false));
    };
    const unsubscribe = onAuthChange(refresh);
    refresh();
    return () => { active = false; unsubscribe(); };
  }, []);

  return <MeContext.Provider value={{ user, loading }}>{children}</MeContext.Provider>;
}

export function useMe() { return useContext(MeContext); }
