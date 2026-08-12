import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAppContext } from '@/context/AppContext';

type Options = {
  /** When true, do not redirect unauthenticated users (guest browse). */
  allowGuest?: boolean;
};

/**
 * Redirects unauthenticated users to the login screen.
 * Use in tab layouts and protected stack screens.
 * Pass allowGuest to permit marketplace / cart browsing without an account.
 */
export function useAuthGuard(options: Options = {}) {
  const { allowGuest = false } = options;
  const { state, isHydrated } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !state.isAuthenticated && !allowGuest) {
      router.replace('/login');
    }
  }, [isHydrated, state.isAuthenticated, allowGuest, router]);

  return {
    isReady: isHydrated && (state.isAuthenticated || allowGuest),
    isHydrated,
    isAuthenticated: state.isAuthenticated,
  };
}
