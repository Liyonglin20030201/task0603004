import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@study-platform/shared';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '@study-platform/shared';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: TOKEN_KEY,
    }
  )
);
