import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuthState } from '@/hooks/useAuthState';
// Removed ComprehensiveNFTDataService - using direct services for better performance
import { nftLifecycleService, OffchainNFT, OnchainNFT } from '@/services/NFTLifecycleService';
import offChainStakingService from '@/services/EnhancedStakingService';
import improvedOnchainStakingService from '@/services/ImprovedOnchainStakingService';
import optimizedCIDPoolBurnService from '@/services/OptimizedCIDPoolBurnService';
import { nftCountTrackingService } from '@/services/NFTCountTrackingService';
import { toast } from 'sonner';

// Enhanced NFT interface for context - optimized standalone interface
export interface ContextNFT {
  id: string;
  name: string;
  description?: string;
  image: string;
  rarity: string;
  attributes?: any[];
  status: 'offchain' | 'onchain';
  isStaked: boolean;
  stakingSource: 'none' | 'offchain' | 'onchain';
  dailyReward: number;
  wallet_address: string;
  // Additional metadata
  ipfs_hash?: string;
  metadata_uri?: string;
  tokenId?: string;
  contractAddress?: string;
  claimed_at?: string;
  staked_at?: string;
  // Onchain-specific properties
  transactionHash?: string;
  metadataURI?: string;
  claimed_blockchain?: string;
  // Real-time sync properties
  stakeTimestamp?: number;
  lastUpdated?: number;
  optimisticUpdate?: boolean;
  // Claiming status
  claimingStatus?: 'claiming' | 'completed' | 'failed';
  // PRESERVE ORIGINAL BLOCKCHAIN METADATA - Don't let database overwrite this
  originalBlockchainMetadata?: {
    name: string;
    image: string;
    rarity: string;
    tokenId?: string;
    contractAddress?: string;
    metadataURI?: string;
  };
}

interface NFTContextState {
  // Auth State
  isAuthenticated: boolean;
  walletAddress: string | null;
  
  // NFT Data
  allNFTs: ContextNFT[];
  offchainNFTs: OffchainNFT[];
  onchainNFTs: OnchainNFT[];
  
  // Filtered Views
  availableNFTs: ContextNFT[]; // For burning/claiming
  stakableNFTs: ContextNFT[];  // For staking
  stakedNFTs: ContextNFT[];    // Currently staked
  
  // States
  isLoading: boolean;
  isInitialized: boolean;
  lastUpdated: Date | null;
  
  // Streaming Loading States
  isLoadingMore: boolean;
  hasMoreToLoad: boolean;
  loadingProgress: {
    offchain: boolean;
    comprehensive: boolean;
    onchain: boolean;
    staking: boolean;
    total: number;
    completed: number;
  };
  
  // Actions
  loadNFTData: () => Promise<void>;
  refreshNFTs: () => Promise<void>;
  forceReloadNFTs: () => Promise<void>;
  ensureNFTsLoaded: () => Promise<void>;
  syncStakingStatus: () => Promise<void>;
  
  // Optimistic Updates
  updateNFTOptimistically: (nftId: string, updates: Partial<ContextNFT>) => void;
  batchUpdateNFTs: (updates: Array<{id: string, changes: Partial<ContextNFT>}>) => void;
  optimisticStake: (nftIds: string[], stakingSource?: 'offchain' | 'onchain') => void;
  optimisticUnstake: (nftIds: string[]) => void;
  optimisticBurn: (nftIds: string[], newNFT?: ContextNFT) => void;
  optimisticClaimStart: (nftId: string) => void;
  optimisticClaim: (nftId: string) => void;
  
  // Claiming Functions
  handleSuccessfulClaim: (offchainNftId: string, onchainNft: ContextNFT) => void;
  revertOptimisticUpdate: () => void;
  clearOptimisticUpdates: () => void;
  
  // NFT Count Sync
  syncNFTCountsToBackend: () => Promise<void>;
}

const NFTContext = createContext<NFTContextState | undefined>(undefined);

export const useNFTContext = () => {
  const context = useContext(NFTContext);
  if (!context) {
    throw new Error('useNFTContext must be used within an NFTProvider');
  }
  return context;
};

interface NFTProviderProps {
  children: React.ReactNode;
}

export const NFTProvider: React.FC<NFTProviderProps> = ({ children }) => {
  const { walletAddress, isAuthenticated } = useAuthState();
  
  // Core State - Initialize with proper loading state
  const [allNFTs, setAllNFTs] = useState<ContextNFT[]>([]);
  const [offchainNFTs, setOffchainNFTs] = useState<OffchainNFT[]>([]);
  const [onchainNFTs, setOnchainNFTs] = useState<OnchainNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true to prevent flash of old content
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [backupState, setBackupState] = useState<ContextNFT[]>([]);
  
  // STREAMING LOADING: Show NFTs as they load individually
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreToLoad, setHasMoreToLoad] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({
    offchain: false,
    comprehensive: false,
    onchain: false,
    staking: false,
    total: 4,
    completed: 0
  });
  
  // PERFORMANCE: Cache to prevent unnecessary reloads
  const [lastWalletAddress, setLastWalletAddress] = useState<string | null>(null);
  const [cacheExpiry, setCacheExpiry] = useState<Date | null>(null);
  const [hasOptimisticUpdates, setHasOptimisticUpdates] = useState(false);

  // Computed values
  const availableNFTs = allNFTs.filter(nft => !nft.isStaked);
  const stakableNFTs = allNFTs.filter(nft => !nft.isStaked);
  const stakedNFTs = allNFTs.filter(nft => nft.isStaked);

  // Sync NFT counts to backend for leaderboard
  const syncNFTCountsToBackend = useCallback(async () => {
    if (!walletAddress || !isAuthenticated) {
      return;
    }

    try {
      const result = await nftCountTrackingService.updateUserNFTCounts(walletAddress);
      
      if (!result) {
        console.warn('NFT count sync returned null');
      }
    } catch (error) {
      console.error('Failed to sync NFT counts:', error);
    }
  }, [walletAddress, isAuthenticated]);

  // Main loading function with progressive streaming
  const loadNFTData = useCallback(async (): Promise<void> => {
    if (!walletAddress) {
      setAllNFTs([]);
      setOffchainNFTs([]);
      setOnchainNFTs([]);
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    setIsLoading(true);
    setLoadingProgress({ offchain: false, comprehensive: false, onchain: false, staking: false, total: 4, completed: 0 });

    try {
      // 1. Load offchain NFTs first (fastest)
      const offchainData = await nftLifecycleService.loadOffchainNFTs(walletAddress);
      
      if (offchainData && offchainData.length > 0) {
        // Include all offchain NFTs (including staked ones)
        const activeOffchainNFTs = offchainData.filter(nft => 
          nft.status === 'offchain' || nft.status === 'claiming'
        );
        
        
        if (activeOffchainNFTs.length > 0) {
          const contextNFTs: ContextNFT[] = activeOffchainNFTs.map(nft => ({
            ...nft,
            status: 'offchain' as const,
            isStaked: nft.isStaked || false,
            stakingSource: nft.isStaked ? 'offchain' as const : 'none' as const,
            dailyReward: offChainStakingService.getDailyRewardForRarity(nft.rarity)
          }));
          
          setAllNFTs(contextNFTs);
          setOffchainNFTs(activeOffchainNFTs);
        }
      }
      setLoadingProgress(prev => ({ ...prev, offchain: true, completed: prev.completed + 1 }));

      // 2. Load onchain NFTs (this may take longer)
      console.log('⛓️ [NFTContext] Loading onchain NFTs...');
      setLoadingProgress(prev => ({ ...prev, onchain: false, completed: 1 })); // Show onchain loading started
      
      try {
        console.log('🔍 [NFTContext] Calling nftLifecycleService.loadOnchainNFTs...');
        const onchainData = await nftLifecycleService.loadOnchainNFTs(walletAddress);
        console.log('🔍 [NFTContext] loadOnchainNFTs returned:', onchainData);
        
        if (onchainData && onchainData.length > 0) {
          console.log(`✅ [NFTContext] Loaded ${onchainData.length} onchain NFTs:`, onchainData.map(nft => `${nft.id} (${nft.name})`));
          setOnchainNFTs(onchainData);
          
          // Add new onchain NFTs to context - PRESERVE ORIGINAL BLOCKCHAIN METADATA
          setAllNFTs(currentNFTs => {
            // Convert onchain NFTs to context format with proper reward calculation
            // Filter out reward tracking entries from UI display
            const newOnchainNFTs = onchainData
              .filter(nft => 
                !currentNFTs.some(existing => existing.id === nft.id) &&
                !nft.id.includes('onchain_reward_') &&
                nft.status !== 'reward_tracking'
              )
              .map(nft => ({
                ...nft,
                status: 'onchain' as const,
                stakingSource: nft.isStaked ? 'onchain' as const : 'none' as const,
                dailyReward: offChainStakingService.getDailyRewardForRarity(nft.rarity),
                isStaked: nft.isStaked || false,
                stakeTimestamp: nft.stakeTimestamp,
                // PRESERVE ORIGINAL BLOCKCHAIN METADATA - Don't let database overwrite this
                originalBlockchainMetadata: {
                  name: nft.name,
                  image: nft.image,
                  rarity: nft.rarity,
                  tokenId: nft.tokenId,
                  contractAddress: nft.contractAddress,
                  metadataURI: nft.metadataURI
                }
              }));
            
            if (newOnchainNFTs.length > 0) {
              console.log(`📊 [NFTContext] Added ${newOnchainNFTs.length} new onchain NFTs to context with preserved blockchain metadata:`, newOnchainNFTs.map(nft => `${nft.id} (${nft.name})`));
              return [...currentNFTs, ...newOnchainNFTs];
            }
            return currentNFTs;
          });
        } else {
          console.log('📊 [NFTContext] No onchain NFTs found - this could mean:');
          console.log('  - Wallet has no NFTs on blockchain');
          console.log('  - Blockchain connection failed');
          console.log('  - Contract address is incorrect');
          console.log('  - RPC endpoints are not responding');
        }
      } catch (error) {
        console.error('❌ [NFTContext] Failed to load onchain NFTs:', error);
        console.error('❌ [NFTContext] Error details:', {
          message: error.message,
          stack: error.stack,
          walletAddress
        });
      }
      
      setLoadingProgress(prev => ({ ...prev, onchain: true, completed: prev.completed + 1 }));

      // Set cache and complete loading
      const cacheExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      setCacheExpiry(cacheExpiry);
      setLastWalletAddress(walletAddress);
      setHasOptimisticUpdates(false);
      
    } catch (error) {
      console.error('❌ [NFTContext] Failed to load NFT data:', error);
      toast.error('Failed to load NFT data');
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
      setLastUpdated(new Date());
      setLoadingProgress(prev => ({ ...prev, completed: prev.total }));
      
      // Sync NFT counts to backend after loading
      if (walletAddress && isAuthenticated) {
        setTimeout(() => {
          syncNFTCountsToBackend();
        }, 2000); // Delay to ensure all data is loaded
      }
    }
  }, [walletAddress, isAuthenticated, syncNFTCountsToBackend]);

  // Optimistic Updates
  const optimisticStake = useCallback((nftIds: string[], stakingSource: 'offchain' | 'onchain' = 'offchain') => {
    console.log('🔄 [NFTContext] Optimistic stake:', nftIds, 'source:', stakingSource);
    setBackupState([...allNFTs]);
    setHasOptimisticUpdates(true);
    
    // Import the reward calculation function
    const getDailyRewardForRarity = (rarity: string): number => {
      const rewards: Record<string, number> = {
        'common': 0.1,
        'rare': 0.4,
        'legendary': 1.0,
        'platinum': 2.5,
        'silver': 8.0,
        'gold': 30.0
      };
      return rewards[rarity.toLowerCase()] || 0.1;
    };
    
    setAllNFTs(prev => prev.map(nft => 
      nftIds.includes(nft.id) 
        ? { 
            ...nft, 
            isStaked: true, 
            stakingSource: stakingSource, 
            stakeTimestamp: Date.now(),
            dailyReward: getDailyRewardForRarity(nft.rarity)
          }
        : nft
    ));
  }, [allNFTs]);

  const optimisticUnstake = useCallback((nftIds: string[]) => {
    console.log('🔄 [NFTContext] Optimistic unstake:', nftIds);
    setBackupState([...allNFTs]);
    setHasOptimisticUpdates(true);
    
    setAllNFTs(prev => prev.map(nft => 
      nftIds.includes(nft.id) 
        ? { ...nft, isStaked: false, stakingSource: 'none' as const, stakeTimestamp: undefined }
        : nft
    ));
  }, [allNFTs]);

  const optimisticClaimStart = useCallback((nftId: string) => {
    console.log('🔄 [NFTContext] Starting claim (showing claiming status):', nftId);
    setBackupState([...allNFTs]);
    
    setAllNFTs(prev => prev.map(nft => 
      nft.id === nftId 
        ? { 
            ...nft, 
            status: 'offchain' as const, // Keep as offchain during claiming
            claimingStatus: 'claiming', // Add separate claiming status
            optimisticUpdate: true 
          }
        : nft
    ));
  }, [allNFTs]);

  const optimisticClaim = useCallback((nftId: string) => {
    console.log('🔄 [NFTContext] Optimistic claim completed - removing offchain NFT:', nftId);
    setAllNFTs(prev => prev.filter(nft => nft.id !== nftId));
    setOffchainNFTs(prev => prev.filter(nft => nft.id !== nftId));
    // Don't trigger any reloads - the NFT is now claimed and should disappear from offchain list
    console.log('✅ [NFTContext] NFT successfully removed from offchain collection');
  }, []);

  const optimisticBurn = useCallback((nftIds: string[], newNFT?: ContextNFT) => {
    console.log('🔄 [NFTContext] Optimistic burn:', nftIds, newNFT);
    setBackupState([...allNFTs]);
    
    setAllNFTs(prev => {
      let updated = prev.filter(nft => !nftIds.includes(nft.id));
      if (newNFT) {
        updated.push(newNFT);
      }
      return updated;
    });
  }, [allNFTs]);

  const updateNFTOptimistically = useCallback((nftId: string, updates: Partial<ContextNFT>) => {
    console.log('🔄 [NFTContext] Optimistic update for NFT:', nftId, updates);
    setBackupState([...allNFTs]);
    setHasOptimisticUpdates(true);
    
    setAllNFTs(prev => prev.map(nft => 
      nft.id === nftId 
        ? { ...nft, ...updates, lastUpdated: Date.now(), optimisticUpdate: true }
        : nft
    ));
  }, [allNFTs]);

  const batchUpdateNFTs = useCallback((updates: Array<{id: string, changes: Partial<ContextNFT>}>) => {
    console.log('🔄 [NFTContext] Batch optimistic updates:', updates);
    setBackupState([...allNFTs]);
    setHasOptimisticUpdates(true);
    
    setAllNFTs(prev => prev.map(nft => {
      const update = updates.find(u => u.id === nft.id);
      return update 
        ? { ...nft, ...update.changes, lastUpdated: Date.now(), optimisticUpdate: true }
        : nft;
    }));
  }, [allNFTs]);

  const revertOptimisticUpdate = useCallback(() => {
    console.log('🔄 [NFTContext] Reverting optimistic update');
    if (backupState.length > 0) {
      setAllNFTs(backupState);
      setBackupState([]);
      setHasOptimisticUpdates(false);
    }
  }, [backupState]);

  const clearOptimisticUpdates = useCallback(() => {
    console.log('✅ [NFTContext] Clearing optimistic updates flag');
    setBackupState([]);
    setHasOptimisticUpdates(false);
  }, []);

  const handleSuccessfulClaim = useCallback((offchainNftId: string, onchainNft: ContextNFT) => {
    console.log('✅ [NFTContext] Successful claim - updating NFT states');
    console.log('📝 [NFTContext] Removing offchain NFT:', offchainNftId);
    console.log('➕ [NFTContext] Adding onchain NFT:', onchainNft);
    
    setAllNFTs(prev => {
      // Remove the offchain NFT and add the onchain NFT
      const filtered = prev.filter(nft => nft.id !== offchainNftId);
      return [...filtered, onchainNft];
    });
    
    setOffchainNFTs(prev => prev.filter(nft => nft.id !== offchainNftId));
    
    // Add to onchain NFTs if it has blockchain data
    if (onchainNft.tokenId && onchainNft.transactionHash) {
      // Convert ContextNFT to OnchainNFT format
      const onchainNFTData: OnchainNFT = {
        id: onchainNft.id,
        name: onchainNft.name,
        description: onchainNft.description || '',
        image: onchainNft.image,
        rarity: onchainNft.rarity,
        attributes: onchainNft.attributes || [],
        tokenId: onchainNft.tokenId,
        transactionHash: onchainNft.transactionHash,
        contractAddress: onchainNft.contractAddress || '',
        metadataURI: onchainNft.metadataURI || onchainNft.metadata_uri || '',
        wallet_address: onchainNft.wallet_address,
        claimed_at: onchainNft.claimed_at || new Date().toISOString(),
        claimed_blockchain: onchainNft.claimed_blockchain || 'polygon',
        status: 'onchain' as const
      };
      
      setOnchainNFTs(prev => [...prev, onchainNFTData]);
      console.log('✅ [NFTContext] Onchain NFT added to onchain collection');
    }
    
    console.log('✅ [NFTContext] Claim completed - NFT moved from offchain to onchain');
  }, []);

  // Auto-loading when authentication changes
  useEffect(() => {
    const authCheckTimeout = setTimeout(() => {
      console.log('🔄 [NFTContext] Auth check:', { walletAddress, isAuthenticated, lastWalletAddress });
      
      if (isAuthenticated && walletAddress) {
        const walletChanged = lastWalletAddress !== walletAddress;
        const hasNoData = allNFTs.length === 0 && !isInitialized;
        const cacheExpired = cacheExpiry && Date.now() > cacheExpiry.getTime();
        const needsReload = walletChanged || hasNoData || cacheExpired;
        
        if (needsReload) {
          console.log('🔄 [NFTContext] Loading NFT data...');
          
          if (walletChanged) {
            console.log('🔄 [NFTContext] Wallet changed, clearing old data');
            setAllNFTs([]);
            setOffchainNFTs([]);
            setOnchainNFTs([]);
            setCacheExpiry(null);
          }
          
          setIsLoading(true);
          setLastWalletAddress(walletAddress);
          loadNFTData().catch(error => {
            console.error('❌ [NFTContext] Failed to load NFT data:', error);
            setIsLoading(false);
            setIsInitialized(true);
          });
        } else {
          console.log('⚡ [NFTContext] Skipping reload - data already loaded');
          if (allNFTs.length > 0) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        }
      } else if (!isAuthenticated && lastWalletAddress) {
        console.log('🔄 [NFTContext] User logged out, clearing NFT data...');
        setAllNFTs([]);
        setOffchainNFTs([]);
        setOnchainNFTs([]);
        setLastWalletAddress(null);
        setCacheExpiry(null);
        setIsLoading(false);
        setIsInitialized(true);
      }
    }, 500);
    
    return () => clearTimeout(authCheckTimeout);
  }, [walletAddress, isAuthenticated, lastWalletAddress, allNFTs.length, isInitialized, cacheExpiry, loadNFTData]);

  // Force reload function
  const forceReloadNFTs = useCallback(async () => {
    console.log('🔄 [NFTContext] Force reloading NFTs...');
    setIsLoading(true);
    setIsInitialized(false);
    setAllNFTs([]);
    setOffchainNFTs([]);
    setOnchainNFTs([]);
    setCacheExpiry(null);
    setBackupState([]);
    setHasOptimisticUpdates(false);
    
    // Clear cache
    sessionStorage.removeItem('nft_cache');
    sessionStorage.removeItem('nft_cache_wallet');
    sessionStorage.removeItem('nft_cache_expiry');
    
    await loadNFTData();
  }, [loadNFTData]);

  // Ensure NFTs loaded function
  const ensureNFTsLoaded = useCallback(async () => {
    if (!isAuthenticated || !walletAddress) {
      console.log('⚠️ [NFTContext] Cannot load NFTs - not authenticated');
      return;
    }

    const hasData = allNFTs.length > 0;
    const isCurrentlyLoading = isLoading;
    
    console.log('🔍 [NFTContext] Ensuring NFTs loaded:', { 
      hasData, 
      isCurrentlyLoading, 
      isInitialized,
      walletAddress: walletAddress.slice(0, 8) + '...'
    });

    if (!hasData && !isCurrentlyLoading && !isInitialized) {
      console.log('🚀 [NFTContext] No data found, triggering load...');
      setIsLoading(true);
      await loadNFTData();
    }
  }, [isAuthenticated, walletAddress, allNFTs.length, isLoading, isInitialized, loadNFTData]);

  // Debounced refresh function
  const refreshNFTs = useCallback(async () => {
    console.log('🔄 [NFTContext] Refreshing NFTs...');
    setCacheExpiry(null);
    setHasOptimisticUpdates(false); // Don't set to true to avoid triggering auto-reload
    await loadNFTData();
  }, [loadNFTData]);

  // Sync staking status function
  const syncStakingStatus = useCallback(async () => {
    if (!walletAddress || !isAuthenticated || allNFTs.length === 0) {
      return;
    }
    
    // Implementation would go here
  }, [walletAddress, isAuthenticated, allNFTs.length]);


  const contextValue: NFTContextState = {
    // Auth State
    isAuthenticated,
    walletAddress,
    
    // Data
    allNFTs,
    offchainNFTs,
    onchainNFTs,
    
    // Filtered Views
    availableNFTs,
    stakableNFTs,
    stakedNFTs,
    
    // States
    isLoading,
    isInitialized,
    lastUpdated,
    
    // Streaming Loading States
    isLoadingMore,
    hasMoreToLoad,
    loadingProgress,
    
    // Actions
    loadNFTData,
    refreshNFTs,
    forceReloadNFTs,
    ensureNFTsLoaded,
    syncStakingStatus,
    
    // Optimistic Updates
    updateNFTOptimistically,
    batchUpdateNFTs,
    optimisticStake,
    optimisticUnstake,
    optimisticBurn,
    optimisticClaimStart,
    optimisticClaim,
    
    // Claiming Functions
    handleSuccessfulClaim,
    revertOptimisticUpdate,
    clearOptimisticUpdates,
    
    // NFT Count Sync
    syncNFTCountsToBackend,
  };

  return (
    <NFTContext.Provider value={contextValue}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTProvider;
