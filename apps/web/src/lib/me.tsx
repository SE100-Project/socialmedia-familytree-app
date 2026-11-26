import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken, isMockMode, onAuthChange, setToken } from './api';

export type RoleType = 'CLAN_HEAD' | 'BRANCH_HEAD' | 'TECH_SUPPORT';

export interface UserRole {
  type: RoleType;
  clanId: string;
  branchId: string | null;
}

export interface Me {
  id: string;
  accountCode?: string;
  phone?: string | null;
  email?: string | null;
  status?: string;
  profileId: string | null;
  clanId: string | null;
  profileLinks?: Array<{ clanId: string; profileId: string }>;
  roles: UserRole[];
}

export function isClanHead(user: Me | null): boolean {
  if (!user) return false;
  return user.roles.some((r) => r.type === 'CLAN_HEAD');
}

export function getManagedBranchIds(user: Me | null): string[] {
  if (!user) return [];
  return user.roles
    .filter((r) => r.type === 'BRANCH_HEAD' && Boolean(r.branchId))
    .map((r) => r.branchId as string);
}

export function canManageBranch(user: Me | null, branchId: string | null): boolean {
  if (!user) return false;
  if (isClanHead(user)) return true;
  if (!branchId) return false;
  return user.roles.some((r) => r.type === 'BRANCH_HEAD' && r.branchId === branchId);
}

export function formatRoleLabel(user: Me | null): string {
  if (!user) return 'Khách';
  if (user.roles.some((r) => r.type === 'CLAN_HEAD')) return 'Trưởng họ';
  if (user.roles.some((r) => r.type === 'BRANCH_HEAD')) return 'Trưởng chi';
  if (user.roles.some((r) => r.type === 'TECH_SUPPORT')) return 'Kỹ thuật viên';
  return user.profileId ? 'Thành viên' : 'Chưa liên kết hồ sơ';
}

type MeContextValue = {
  user: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const MeContext = createContext<MeContextValue>({
  user: null,
  loading: true,
  refreshMe: async () => {},
  logout: () => {},
});

export function MeProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    if (!isMockMode() && !getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const me = await api<Me>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthChange(() => {
      void fetchMe();
    });
    void fetchMe();
    return () => {
      unsubscribe();
    };
  }, [fetchMe]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshMe: fetchMe, logout }),
    [user, loading, fetchMe, logout],
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  return useContext(MeContext);
}
