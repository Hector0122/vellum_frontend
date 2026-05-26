import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    loadSession,
  } = useAuthStore();

  const isAuthenticated = session && user !== null;

  const handleSignIn = useCallback(
    async (email: string, password: string) => {
      await signIn(email, password);
    },
    [signIn],
  );

  const handleSignUp = useCallback(
    async (email: string, password: string) => {
      await signUp(email, password);
    },
    [signUp],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const handleResetPassword = useCallback(
    async (email: string) => {
      await resetPassword(email);
    },
    [resetPassword],
  );

  return {
    user,
    isAuthenticated,
    loading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
    loadSession,
  };
}
