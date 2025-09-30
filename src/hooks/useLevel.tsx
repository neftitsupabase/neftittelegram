import { useState, useEffect } from 'react';
import LevelService, { LevelInfo } from '@/services/LevelService';
import userBalanceService from '@/services/UserBalanceService';

interface UseLevelReturn {
  levelInfo: LevelInfo | null;
  loading: boolean;
  error: string | null;
  refreshLevel: () => Promise<void>;
}

export const useLevel = (walletAddress: string | null): UseLevelReturn => {
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLevelInfo = async () => {
    if (!walletAddress) {
      setLevelInfo(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user balance which includes total_xp_earned
      const balance = await userBalanceService.getUserBalance(walletAddress);
      
      // Calculate level info based on total XP
      const calculatedLevelInfo = LevelService.calculateLevelInfo(balance.total_xp_earned);
      
      setLevelInfo(calculatedLevelInfo);
    } catch (err) {
      console.error('Error fetching level info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch level info');
      setLevelInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshLevel = async () => {
    await fetchLevelInfo();
  };

  useEffect(() => {
    fetchLevelInfo();
  }, [walletAddress]);

  return {
    levelInfo,
    loading,
    error,
    refreshLevel
  };
};
