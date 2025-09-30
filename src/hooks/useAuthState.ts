import { useState, useEffect, useCallback } from 'react';
import { getAuthStatus, getWalletAddress, getWalletType, isSocialLogin } from '@/utils/authUtils';

interface AuthState {
  isAuthenticated: boolean;
  walletAddress: string | null;
  walletType: string | null;
  isSocialLogin: boolean;
  isLoading: boolean;
}

/**
 * Custom hook for managing authentication state across the application
 * Centralizes the auth state logic to reduce duplication
 */
export const useAuthState = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    walletAddress: null,
    walletType: null,
    isSocialLogin: false,
    isLoading: true,
  });

  // Update state from localStorage
  const updateAuthState = useCallback(() => {
    const isAuthenticated = getAuthStatus();
    const walletAddress = getWalletAddress();
    const walletType = getWalletType();
    const isSocialAuth = isSocialLogin();

    setAuthState({
      isAuthenticated,
      walletAddress,
      walletType,
      isSocialLogin: isSocialAuth,
      isLoading: false,
    });
  }, []);

  // Initialize on mount and listen for changes
  useEffect(() => {
    // Initial state update
    updateAuthState();

    // Listen for auth status changes
    const handleAuthChange = () => {
      updateAuthState();
    };

    // Listen for custom events from our auth utilities
    window.addEventListener('auth-status-changed', handleAuthChange);
    
    // Listen for storage events (for cross-tab synchronization)
    window.addEventListener('storage', (event) => {
      if (event.key === 'isAuthenticated' || 
          event.key === 'walletAddress' || 
          event.key === 'walletType') {
        updateAuthState();
      }
    });
    
    return () => {
      window.removeEventListener('auth-status-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [updateAuthState]);

  return authState;
};

export default useAuthState; 