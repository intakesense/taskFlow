import { useState } from 'react';
import { toast } from 'sonner';
import type { LoginFormData } from '@taskflow/core';
import { LoginView } from '@taskflow/features';
import { useAuthStore } from '@/stores/auth';

export function LoginPage() {
  const { signIn, signInWithGoogle } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleEmailSignIn = async (data: LoginFormData) => {
    const { error } = await signIn(data.email, data.password);

    if (error) {
      toast.error(error.message || 'Failed to sign in');
    } else {
      toast.success('Welcome back!');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message || 'Failed to start Google sign-in');
      } else {
        toast.info('Complete sign-in in your browser');
      }
    } catch {
      toast.error('Failed to open browser');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <LoginView
      onEmailSignIn={handleEmailSignIn}
      onGoogleSignIn={handleGoogleSignIn}
      isGoogleLoading={isGoogleLoading}
    />
  );
}
