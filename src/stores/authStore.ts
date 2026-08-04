import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, getToken, setToken, removeToken, isNetworkError } from '@/shared/lib/api';
import type { User } from '@/types';

interface AuthResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

interface MeResponse {
  user: User;
}

interface AuthState {
  user: User | null;
  session: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: false,
      loading: true,

      loadSession: async () => {
        const token = await getToken();

        if (!token) {
          set({ user: null, session: false, loading: false });
          return;
        }

        try {
          const data = await api.get<MeResponse>('/api/auth/me');
          set({ user: data.user, session: true, loading: false });
        } catch (e) {
          if (isNetworkError(e)) {
            // Offline: keep the stored token and the last-known (persisted)
            // user so the app opens into the library with cached/downloaded
            // books instead of forcing a sign-out just because there's no
            // connectivity to re-validate the session.
            set({ session: true, loading: false });
            return;
          }

          await removeToken();
          set({ user: null, session: false, loading: false });
        }
      },

      signIn: async (email: string, password: string) => {
        const data = await api.post<AuthResponse>('/api/auth/signin', {
          email,
          password,
        });

        await setToken(data.tokens.access_token);
        set({ user: data.user, session: true });
      },

      signUp: async (email: string, password: string) => {
        const data = await api.post<AuthResponse>('/api/auth/signup', {
          email,
          password,
        });

        await setToken(data.tokens.access_token);
        set({ user: data.user, session: true });
      },

      signOut: async () => {
        try {
          await api.post('/api/auth/signout');
        } catch {
          // ignore errors on signout
        }
        await removeToken();
        set({ user: null, session: false });
      },

      requestPasswordReset: async (email: string) => {
        await api.post('/api/auth/forgot-password', { email });
      },

      confirmPasswordReset: async (email: string, code: string, newPassword: string) => {
        await api.post('/api/auth/reset-password', { email, code, newPassword });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only cache the user profile; `session`/`loading` are always
      // re-derived by loadSession() on startup.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
