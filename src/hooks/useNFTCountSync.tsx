import { useEffect, useCallback } from 'react';
import { useAuthState } from './useAuthState';
import { nftCountTrackingService } from '@/services/NFTCountTrackingService';
import { useNFTContext } from '@/contexts/NFTContext';

/**
 * Hook to sync NFT counts with backend tracking
 * Automatically updates counts when NFT operations occur
 */
export const useNFTCountSync = () => {
  const { walletAddress, isAuthenticated } = useAuthState();
  const { allNFTs, isInitialized } = useNFTContext();

  /**
   * Sync current user's NFT counts to backend
   */
  const syncNFTCounts = useCallback(async () => {
    if (!walletAddress || !isAuthenticated) {
      return;
    }

    try {
      console.log('🔄 [NFTCountSync] Syncing NFT counts to backend...');
      await nftCountTrackingService.updateUserNFTCounts(walletAddress);
      console.log('✅ [NFTCountSync] NFT counts synced successfully');
    } catch (error) {
      console.error('❌ [NFTCountSync] Failed to sync NFT counts:', error);
    }
  }, [walletAddress, isAuthenticated]);

  /**
   * Initialize NFT counts for new users
   */
  const initializeUserCounts = useCallback(async () => {
    if (!walletAddress || !isAuthenticated) {
      return;
    }

    try {
      console.log('🆕 [NFTCountSync] Initializing user NFT counts...');
      await nftCountTrackingService.initializeUserCounts(walletAddress);
      console.log('✅ [NFTCountSync] User NFT counts initialized');
    } catch (error) {
      console.error('❌ [NFTCountSync] Failed to initialize user counts:', error);
    }
  }, [walletAddress, isAuthenticated]);

  // Sync counts when NFTs are loaded or changed
  useEffect(() => {
    if (isInitialized && allNFTs.length >= 0) {
      // Debounce the sync to avoid excessive API calls
      const timeoutId = setTimeout(() => {
        syncNFTCounts();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [isInitialized, allNFTs.length, syncNFTCounts]);

  // Initialize counts when user first authenticates
  useEffect(() => {
    if (isAuthenticated && walletAddress) {
      initializeUserCounts();
    }
  }, [isAuthenticated, walletAddress, initializeUserCounts]);

  return {
    syncNFTCounts,
    initializeUserCounts
  };
};

export default useNFTCountSync;
