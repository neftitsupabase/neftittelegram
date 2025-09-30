import { useState, useEffect } from 'react';
import { optimizedUserService } from '@/services/OptimizedUserService';

interface UseOptimizedUserReturn {
  profile: any;
  balance: any;
  dashboard: any;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOptimizedUser(walletAddress: string | null): UseOptimizedUserReturn {
  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUserData = async () => {
    if (!walletAddress) {
      setProfile(null);
      setBalance(null);
      setDashboard(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load all user data in parallel for efficiency
      const [profileData, balanceData, dashboardData] = await Promise.all([
        optimizedUserService.getUserProfile(walletAddress),
        optimizedUserService.getUserBalance(walletAddress),
        optimizedUserService.getUserDashboard(walletAddress)
      ]);

      setProfile(profileData);
      setBalance(balanceData);
      setDashboard(dashboardData);
    } catch (err) {
      console.error('Error loading user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (walletAddress) {
      // Clear cache and reload
      optimizedUserService.clearUserCache(walletAddress);
      await loadUserData();
    }
  };

  useEffect(() => {
    loadUserData();
  }, [walletAddress]);

  return {
    profile,
    balance,
    dashboard,
    loading,
    error,
    refresh
  };
}
