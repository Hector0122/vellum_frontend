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
    requestPasswordReset,
    confirmPasswordReset,
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

  const handleRequestPasswordReset = useCallback(
    async (email: string) => {
      await requestPasswordReset(email);
    },
    [requestPasswordReset],
  );

  const handleConfirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      await confirmPasswordReset(email, code, newPassword);
    },
    [confirmPasswordReset],
  );

  return {
    user,
    isAuthenticated,
    loading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    requestPasswordReset: handleRequestPasswordReset,
    confirmPasswordReset: handleConfirmPasswordReset,
    loadSession,
  };
}
