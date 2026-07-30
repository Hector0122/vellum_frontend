import { create } from 'zustand';
import { api, getToken, setToken, removeToken } from '@/shared/lib/api';
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

export const useAuthStore = create<AuthState>((set) => ({
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
    } catch {
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
}));
