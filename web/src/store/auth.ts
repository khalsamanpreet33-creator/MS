import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  hasPerm: (perm: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      hasPerm: (perm: string) => {
        const u = get().user;
        if (!u) return false;
        if (u.permissions.includes('system.admin')) return true;
        return u.permissions.includes(perm);
      },
    }),
    {
      name: 'school-erp-auth',
    },
  ),
);