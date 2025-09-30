import { useState, useEffect } from 'react';
import leaderboardService, { User } from '@/services/LeaderboardService';

interface UseLeaderboardReturn {
  neftLeaderboard: User[];
  nftLeaderboard: User[];
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
  refreshLeaderboards: () => Promise<void>;
}

export const useLeaderboard = (currentUserWallet?: string): UseLeaderboardReturn => {
  const [neftLeaderboard, setNeftLeaderboard] = useState<User[]>([]);
  const [nftLeaderboard, setNftLeaderboard] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboards = async () => {
    try {
      setError(null);
      console.log('Loading leaderboards from Supabase...');

      // Fetch both leaderboards in parallel for efficiency
      const [neftData, nftData] = await Promise.all([
        leaderboardService.getTopNEFTHolders(),
        leaderboardService.getTopNFTHolders(currentUserWallet)
      ]);

      // DEDUPLICATE NFT leaderboard by wallet address (case-insensitive)
      const deduplicatedNftData = nftData.reduce((acc: User[], current: User) => {
        const existingUser = acc.find(user => user.id.toLowerCase() === current.id.toLowerCase());
        if (!existingUser) {
          acc.push(current);
        } else {
          console.warn(`🔍 Duplicate user found in NFT leaderboard: ${current.id} (${current.username})`);
          // Keep the one with higher NFT count or better rank
          if (current.nftCount > existingUser.nftCount || current.rank < existingUser.rank) {
            const index = acc.indexOf(existingUser);
            acc[index] = current;
            console.log(`✅ Replaced duplicate with better entry: ${current.username} (${current.nftCount} NFTs, rank ${current.rank})`);
          }
        }
        return acc;
      }, []);

      // DEDUPLICATE NEFT leaderboard by wallet address (case-insensitive)
      const deduplicatedNeftData = neftData.reduce((acc: User[], current: User) => {
        const existingUser = acc.find(user => user.id.toLowerCase() === current.id.toLowerCase());
        if (!existingUser) {
          acc.push(current);
        } else {
          console.warn(`🔍 Duplicate user found in NEFT leaderboard: ${current.id} (${current.username})`);
          // Keep the one with higher NEFT balance or better rank
          if (current.neftBalance > existingUser.neftBalance || current.rank < existingUser.rank) {
            const index = acc.indexOf(existingUser);
            acc[index] = current;
            console.log(`✅ Replaced duplicate with better entry: ${current.username} (${current.neftBalance} NEFT, rank ${current.rank})`);
          }
        }
        return acc;
      }, []);

      setNeftLeaderboard(deduplicatedNeftData);
      setNftLeaderboard(deduplicatedNftData);

      // Extract current user from NFT leaderboard results (already included)
      if (currentUserWallet) {
        const currentUserFromNFT = deduplicatedNftData.find(user => 
          user.isCurrentUser || user.id.toLowerCase() === currentUserWallet.toLowerCase()
        );
        if (currentUserFromNFT) {
          setCurrentUser(currentUserFromNFT);
        } else {
          // Fallback to NEFT leaderboard
          const userData = await leaderboardService.getCurrentUserNFT(currentUserWallet);
          setCurrentUser(userData);
        }
      }

      console.log(`📊 Leaderboards loaded successfully: ${deduplicatedNftData.length} NFT users, ${deduplicatedNeftData.length} NEFT users`);
    } catch (err) {
      console.error('Error loading leaderboards:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshLeaderboards = async () => {
    await loadLeaderboards();
  };

  // Load data on mount
  useEffect(() => {
    loadLeaderboards();
  }, [currentUserWallet]);

  return {
    neftLeaderboard,
    nftLeaderboard,
    currentUser,
    isLoading,
    error,
    refreshLeaderboards
  };
};
