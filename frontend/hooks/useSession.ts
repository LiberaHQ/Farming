'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type SessionUser } from '@/services/api';

export interface SessionState {
  /** undefined while loading. */
  user: SessionUser | null | undefined;
  /** False when the backend or its database can't be reached (guest play still works). */
  online: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

/** Who is signed in, and whether accounts are available right now. */
export function useSession(): SessionState {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const health = await api.health();
      setOnline(health.database);
      setUser(health.database ? (await api.me()).user : null);
    } catch {
      setOnline(false);
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, online, refresh, logout };
}
