import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuthState } from '@/hooks/useAuthState';
// Removed ComprehensiveNFTDataService - using direct services for better performance
import { nftLifecycleService, OffchainNFT, OnchainNFT } from '@/services/NFTLifecycleService';
import offChainStakingService from '@/services/EnhancedStakingService';
import improvedOnchainStakingService from '@/services/ImprovedOnchainStakingService';
import optimizedCIDPoolBurnService from '@/services/OptimizedCIDPoolBurnService';
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
}

interface NFTContextState {
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
  
  // Loading States
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
  
  // Revert Functions (for failed operations)
  revertOptimisticUpdate: (nftId?: string) => void;
  clearOptimisticUpdates: () => void;
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

  // PERSISTENT STORAGE: Load cached data on mount to prevent flash
  useEffect(() => {
    console.log('🔄 [NFTContext] Component mounted, checking for cached data...');
    
    // Try to load from sessionStorage first (survives page refresh)
    const cachedData = sessionStorage.getItem('nft_cache');
    const cachedWallet = sessionStorage.getItem('nft_cache_wallet');
    const cachedExpiry = sessionStorage.getItem('nft_cache_expiry');
    
    if (cachedData && cachedWallet && cachedExpiry) {
      const expiry = new Date(cachedExpiry);
      const now = new Date();
      
      if (now < expiry && cachedWallet === walletAddress) {
        console.log('⚡ [NFTContext] Loading from cache, no network request needed');
        try {
          const parsed = JSON.parse(cachedData);
          setAllNFTs(parsed.allNFTs || []);
          setOffchainNFTs(parsed.offchainNFTs || []);
          setOnchainNFTs(parsed.onchainNFTs || []);
          setIsLoading(false);
          setIsInitialized(true);
          setLastUpdated(new Date(parsed.lastUpdated));
          setCacheExpiry(expiry);
          setLastWalletAddress(cachedWallet);
          return; // Skip loading if cache is valid
        } catch (error) {
          console.warn('⚠️ [NFTContext] Failed to parse cached data:', error);
        }
      }
    }
    
    // If no valid cache, start with clean state
    setIsLoading(true);
    setIsInitialized(false);
  }, []); // Only run on mount

  // Computed filtered views
  const availableNFTs = allNFTs.filter(nft => 
    !nft.isStaked
  );
  
  const stakableNFTs = allNFTs.filter(nft => 
    !nft.isStaked
  );
  
  const stakedNFTs = allNFTs.filter(nft => nft.isStaked);

  // Main loading function with progressive streaming
  const loadNFTData = useCallback(async (): Promise<void> => {
    if (!walletAddress) {
      console.log('❌ [NFTContext] No wallet address provided');
      setAllNFTs([]);
      setOffchainNFTs([]);
      setOnchainNFTs([]);
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    // Set loading timeout to prevent infinite loading
    const loadingTimeoutId = setTimeout(() => {
      console.warn('⚠️ [NFTContext] Loading timeout reached, forcing completion');
      setIsLoading(false);
      setIsInitialized(true);
    }, 15000); // 15 second timeout

    // Prevent multiple simultaneous loads with timeout safety
    if (isLoading) {
      console.log('⏳ [NFTContext] Already loading, checking if stuck...');
      
      // Check if loading has been stuck for too long (more than 10 seconds)
      const loadingStartKey = `loading_start_${walletAddress}`;
      const loadingStart = parseInt(sessionStorage.getItem(loadingStartKey) || '0');
      const now = Date.now();
      
      if (loadingStart && (now - loadingStart) > 10000) {
        console.warn('⚠️ [NFTContext] Loading stuck for 10+ seconds, forcing reset and reload...');
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMoreToLoad(false);
        sessionStorage.removeItem(loadingStartKey);
        // Continue with loading - don't return early
      } else {
        // Set loading start time if not set
        if (!loadingStart) {
          sessionStorage.setItem(loadingStartKey, now.toString());
        }
        console.log('⏳ [NFTContext] Loading in progress, waiting...');
        return;
      }
    }
    
    // PERFORMANCE: Smart cache validation - only reload when necessary
    const now = new Date();
    const isCacheValid = cacheExpiry && now < cacheExpiry && 
                        lastWalletAddress === walletAddress && 
                        allNFTs.length > 0;
                        
    // Allow optimistic updates to work with cache (don't invalidate cache for UI updates)
    const shouldSkipReload = isCacheValid && !hasOptimisticUpdates;
                        
    if (shouldSkipReload) {
      console.log('⚡ [NFTContext] Using cached data, skipping network reload...');
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }
    
    // If we have optimistic updates, just sync staking status instead of full reload
    if (isCacheValid && hasOptimisticUpdates) {
      console.log('⚡ [NFTContext] Cache valid but has optimistic updates, syncing staking status only...');
      syncStakingStatus();
      setHasOptimisticUpdates(false);
      return;
    }

    console.log('🔄 [NFTContext] Starting streaming NFT data load...');
    
    // Track loading start time
    const loadingStartKey = `loading_start_${walletAddress}`;
    sessionStorage.setItem(loadingStartKey, Date.now().toString());
    
    setIsLoading(true);
    setIsLoadingMore(true);
    setHasMoreToLoad(true);
    
    // Only clear existing NFTs if we don't have cached data
    if (!cacheExpiry || new Date() > cacheExpiry) {
      setAllNFTs([]);
    }
    
    // Safety timeout to prevent stuck loading state
    const loadingTimeout = setTimeout(() => {
      console.warn('⚠️ [NFTContext] Loading timeout reached, forcing loading to false');
      setIsLoading(false);
      setIsLoadingMore(false);
      setHasMoreToLoad(false);
    }, 30000); // 30 second timeout
    
    try {

    // 🚀 PROGRESSIVE STREAMING: Load and display NFTs as they become available
    console.log('📊 [NFTContext] Starting progressive streaming load...');
    
    // STREAMING LOADING: Load offchain NFTs first (fastest)
    console.log('🔄 [NFTContext] Loading offchain NFTs...');
    const offchainData = await nftLifecycleService.getOffchainNFTs(walletAddress);
    console.log(`📊 [NFTContext] Offchain NFTs loaded:`, offchainData);
    
    if (offchainData && offchainData.length > 0) {
      // Filter out claimed NFTs (status !== 'claimed' and status !== 'onchain')
      const activeOffchainNFTs = offchainData.filter(nft => 
        nft.status === 'offchain' || nft.status === 'claiming'
      );
      
      console.log(`✅ [NFTContext] Loaded ${activeOffchainNFTs.length} active offchain NFTs (filtered out ${offchainData.length - activeOffchainNFTs.length} claimed)`);
      
      if (activeOffchainNFTs.length > 0) {
        // Convert and show active offchain NFTs immediately
        const contextNFTs: ContextNFT[] = activeOffchainNFTs.map(nft => ({
          ...nft,
          status: 'offchain' as const,
          isStaked: nft.isStaked || false,
          stakingSource: nft.isStaked ? 'offchain' as const : 'none' as const,
          dailyReward: offChainStakingService.getDailyRewardForRarity(nft.rarity)
        }));
          nft.status === 'offchain' || nft.status === 'claiming'
        );
        
        console.log(`✅ [NFTContext] Loaded ${activeOffchainNFTs.length} active offchain NFTs (filtered out ${offchainData.length - activeOffchainNFTs.length} claimed)`);
        
        if (activeOffchainNFTs.length > 0) {
          // Convert and show active offchain NFTs immediately
          const contextNFTs: ContextNFT[] = activeOffchainNFTs.map(nft => ({
            ...nft,
            status: 'offchain' as const,
            isStaked: nft.isStaked || false,
            stakingSource: nft.isStaked ? 'offchain' as const : 'none' as const,
            dailyReward: offChainStakingService.getDailyRewardForRarity(nft.rarity)
          }));
          
          setAllNFTs(contextNFTs);
          setOffchainNFTs(activeOffchainNFTs);
          setIsLoading(false); // Show UI immediately with offchain NFTs
          setIsInitialized(true); // Mark as initialized
          console.log('⚡ [NFTContext] UI updated with active offchain NFTs!');
        }
        
        setLoadingProgress(prev => ({ ...prev, offchain: true, completed: prev.completed + 1 }));
      } else {
        console.log('📭 [NFTContext] No offchain NFTs found...');
        setLoadingProgress(prev => ({ ...prev, offchain: true, completed: prev.completed + 1 }));
      }
    } catch (error) {
      console.warn('⚠️ [NFTContext] Offchain loading failed:', error);
      setLoadingProgress(prev => ({ ...prev, offchain: true, completed: prev.completed + 1 }));
    }

      // 2️⃣ SECOND: Load onchain NFTs from blockchain (in background)
      console.log('⛓️ [NFTContext] Loading onchain NFTs from blockchain...');
      try {
        const onchainData = await nftLifecycleService.loadOnchainNFTs(walletAddress);
        if (onchainData && onchainData.length > 0) {
          console.log(`✅ [NFTContext] Loaded ${onchainData.length} onchain NFTs!`);
          
          // Add onchain NFTs to existing collection (no duplicates)
          const onchainContextNFTs: ContextNFT[] = onchainData.map(nft => ({
            id: nft.id,
            name: nft.name,
            description: nft.description,
            image: nft.image,
            rarity: nft.rarity,
            attributes: nft.attributes,
            status: 'onchain' as const,
            isStaked: nft.isStaked || false,
            stakingSource: nft.isStaked ? 'onchain' as const : 'none' as const,
            dailyReward: offChainStakingService.getDailyRewardForRarity(nft.rarity),
            wallet_address: nft.wallet_address,
            // Optional onchain-specific properties
            ipfs_hash: nft.ipfs_hash,
            metadata_uri: nft.metadataURI,
            tokenId: nft.tokenId,
            contractAddress: nft.contractAddress,
            claimed_at: nft.claimed_at,
            stakeTimestamp: nft.stakeTimestamp
          }));
          
          // Merge with existing NFTs, avoiding duplicates by ID
          setAllNFTs(prev => {
            const existingIds = new Set(prev.map(nft => nft.id));
            const newOnchainNFTs = onchainContextNFTs.filter(nft => !existingIds.has(nft.id));
            
            if (newOnchainNFTs.length > 0) {
              console.log(`⚡ [NFTContext] Added ${newOnchainNFTs.length} new onchain NFTs (filtered ${onchainContextNFTs.length - newOnchainNFTs.length} duplicates)`);
              return [...prev, ...newOnchainNFTs];
            }
            return prev;
          });
          
          setOnchainNFTs(onchainData);
          setLoadingProgress(prev => ({ ...prev, onchain: true, completed: prev.completed + 1 }));
        }
      } catch (error) {
        console.warn('⚠️ [NFTContext] Onchain NFTs failed:', error);
        setLoadingProgress(prev => ({ ...prev, onchain: true, completed: prev.completed + 1 }));
      }

      // 3️⃣ THIRD: Load blockchain NFTs in parallel (slower ~3-5s)
      console.log('⛓️ [NFTContext] Loading blockchain NFTs in background...');
      const blockchainPromises = [
        nftLifecycleService.loadOnchainNFTs(walletAddress).catch(err => {
          console.warn('⚠️ Onchain NFTs failed:', err);
          return [];
        }),
        offChainStakingService.getStakedNFTs(walletAddress).catch(err => {
          console.warn('⚠️ Staked NFTs failed:', err);
          return [];
        })
      ];

      // Load blockchain data and update UI as each completes
      const blockchainResults = await Promise.allSettled(blockchainPromises);
      const [onchainResult, stakedResult] = blockchainResults;
      
      let onchainData: OnchainNFT[] = [];
      let allStakedNFTs: any[] = [];
      
      if (onchainResult.status === 'fulfilled') {
        onchainData = onchainResult.value;
        if (onchainData.length > 0) {
          console.log(`✅ [NFTContext] Loaded ${onchainData.length} onchain NFTs - updating UI!`);
          setOnchainNFTs(onchainData);
          
          // Add new onchain NFTs
          setAllNFTs(currentNFTs => {
            const existingIds = new Set(currentNFTs.map(nft => nft.id));
            const newOnchainNFTs: ContextNFT[] = onchainData
              .filter(nft => !existingIds.has(nft.id))
              .map(nft => ({
                ...nft,
                status: 'onchain' as const,
                stakingSource: 'onchain' as const,
                dailyReward: offChainStakingService.getDailyRewardForRarity(nft.rarity),
                isStaked: nft.isStaked || false,
                stakeTimestamp: nft.stakeTimestamp
              }));
            
            if (newOnchainNFTs.length > 0) {
              console.log(`⚡ [NFTContext] Added ${newOnchainNFTs.length} new onchain NFTs!`);
              return [...currentNFTs, ...newOnchainNFTs];
            }
            return currentNFTs;
          });
          
          setLoadingProgress(prev => ({ ...prev, onchain: true, completed: prev.completed + 1 }));
        }
      }
      
      if (stakedResult.status === 'fulfilled') {
        allStakedNFTs = stakedResult.value;
        console.log(`✅ [NFTContext] Loaded ${allStakedNFTs.length} staked NFTs - updating staking status!`);
      }

      // 4️⃣ FOURTH: Load detailed onchain staked NFTs (slowest ~5-8s)
      console.log('🔒 [NFTContext] Loading detailed onchain staked NFTs in background...');
      let onchainStakedNFTs: any[] = [];
      try {
        onchainStakedNFTs = await improvedOnchainStakingService.getDetailedOnchainStakedNFTs(walletAddress);
        if (onchainStakedNFTs.length > 0) {
          console.log(`✅ [NFTContext] Loaded ${onchainStakedNFTs.length} onchain staked NFTs - final update!`);
        }
      } catch (error) {
        console.warn('⚠️ [NFTContext] Onchain staked NFTs failed:', error);
      }
      
      console.log('📊 [NFTContext] Loaded all data:', {
        comprehensive: 0, // Skipped ComprehensiveNFTDataService
        offchain: 0, // Loaded in step 1
        onchain: onchainData.length,
        staked: allStakedNFTs.length,
        onchainStaked: onchainStakedNFTs.length
      });
      
      // DEBUG: Check current NFT state
      console.log('🔍 [NFTContext] Current NFT state:', {
        totalNFTs: allNFTs.length,
        availableNFTs: allNFTs.filter(nft => !nft.isStaked).length,
        stakedNFTs: allNFTs.filter(nft => nft.isStaked).length
      });
      
      // DEBUG: Check onchain staked NFTs from blockchain
      console.log('🔍 [NFTContext] Onchain staked NFTs from blockchain:', onchainStakedNFTs.length);
      if (onchainStakedNFTs.length > 0) {
        console.log('🔍 [NFTContext] Blockchain staked NFT IDs:', onchainStakedNFTs.map(nft => ({ id: nft.id, tokenId: nft.tokenId, name: nft.name })));
      }
      
      // DEBUG: Check onchain NFT data
      console.log('🔍 [NFTContext] Onchain NFTs loaded:', onchainData.length);
      console.log('🔍 [NFTContext] All NFTs in context:', allNFTs.slice(0, 3));
      console.log('🔍 [NFTContext] Onchain NFTs in context:', 
        allNFTs.filter(nft => nft.status === 'onchain').length
      );
      
      // OPTIMIZED: Create staked NFT lookup map for O(1) performance
      const stakedNFTMap = new Map();
      const allStakedNFTIds = new Set();
      
      // Process database staked NFTs (offchain)
      allStakedNFTs.forEach(stakedNFT => {
        const ids = [stakedNFT.id, stakedNFT.nft_id, stakedNFT.nft_id?.toString()].filter(Boolean);
        
        ids.forEach(id => {
          allStakedNFTIds.add(id);
          stakedNFTMap.set(id, stakedNFT);
          
          // Handle onchain variants only if needed
          if (typeof id === 'string') {
            if (id.startsWith('onchain_')) {
              const numericId = id.replace('onchain_', '');
              allStakedNFTIds.add(numericId);
              allStakedNFTIds.add(`blockchain_${numericId}`);
              allStakedNFTIds.add(`staked_${numericId}`); // Add staked_ variant
              stakedNFTMap.set(numericId, stakedNFT);
              stakedNFTMap.set(`blockchain_${numericId}`, stakedNFT);
              stakedNFTMap.set(`staked_${numericId}`, stakedNFT); // Add staked_ variant
            } else if (id.startsWith('staked_')) {
              const numericId = id.replace('staked_', '');
              allStakedNFTIds.add(numericId);
              allStakedNFTIds.add(`onchain_${numericId}`);
              allStakedNFTIds.add(`blockchain_${numericId}`);
              stakedNFTMap.set(numericId, stakedNFT);
              stakedNFTMap.set(`onchain_${numericId}`, stakedNFT);
              stakedNFTMap.set(`blockchain_${numericId}`, stakedNFT);
            } else if (/^\d+$/.test(id)) {
              allStakedNFTIds.add(`onchain_${id}`);
              allStakedNFTIds.add(`blockchain_${id}`);
              allStakedNFTIds.add(`staked_${id}`); // Add staked_ variant
              stakedNFTMap.set(`onchain_${id}`, stakedNFT);
              stakedNFTMap.set(`blockchain_${id}`, stakedNFT);
              stakedNFTMap.set(`staked_${id}`, stakedNFT); // Add staked_ variant
            }
          }
        });
      });

      // Process onchain staked NFTs from blockchain
      console.log('🔄 [NFTContext] Processing onchain staked NFTs...');
      onchainStakedNFTs.forEach(stakedNFT => {
        // Create consistent ID formats for onchain staked NFTs
        const ids = [
          stakedNFT.id,
          stakedNFT.tokenId?.toString(),
          `onchain_${stakedNFT.tokenId}`,
          `blockchain_${stakedNFT.tokenId}`,
          `staked_${stakedNFT.tokenId}`
        ].filter(Boolean);
        
        ids.forEach(id => {
          allStakedNFTIds.add(id);
          stakedNFTMap.set(id, {
            ...stakedNFT,
            staking_source: 'onchain',
            stakingSource: 'onchain'
          });
        });
        
        console.log(`🔒 [NFTContext] Added onchain staked NFT: ${stakedNFT.tokenId} with IDs:`, ids);
      });

      console.log('🔄 [NFTContext] Final staked NFT IDs:', Array.from(allStakedNFTIds));

      // PROGRESSIVE LOADING COMPLETE: All NFTs have been loaded via streaming
      console.log('✅ [NFTContext] Progressive loading completed - all sources loaded');
      
      // Ensure context is marked as initialized even if no NFTs found
      if (!isInitialized) {
        setIsInitialized(true);
        console.log('✅ [NFTContext] Marked as initialized (no NFTs found but loading complete)');
      }
      const now = new Date();
      setLastUpdated(now);
      setIsInitialized(true);
      
      // PERSISTENT STORAGE: Cache data to sessionStorage for instant loading
      const cacheData = {
        allNFTs: allNFTs,
        offchainNFTs: offchainNFTs,
        onchainNFTs: onchainNFTs,
        lastUpdated: now.toISOString()
      };
      
      const cacheExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes cache
      
      try {
        sessionStorage.setItem('nft_cache', JSON.stringify(cacheData));
        sessionStorage.setItem('nft_cache_wallet', walletAddress);
        sessionStorage.setItem('nft_cache_expiry', cacheExpiry.toISOString());
        console.log('💾 [NFTContext] Data cached to sessionStorage for instant loading');
      } catch (error) {
        console.warn('⚠️ [NFTContext] Failed to cache data:', error);
      }
      
          // Trigger staking status sync after initial load to ensure lock overlays show
      console.log('🔄 [NFTContext] Triggering staking status sync after initial load...');
      setTimeout(() => syncStakingStatus(), 2000); // Increased delay to prevent rapid calls
      
      // PERFORMANCE: Set cache for 10 minutes (extended for better UX)
      setLastWalletAddress(walletAddress);
      setCacheExpiry(cacheExpiry);
      setHasOptimisticUpdates(false);
      
      // STREAMING LOADING: Complete
      setIsLoadingMore(false);
      setHasMoreToLoad(false);

      console.log('✅ [NFTContext] Progressive loading completed:', {
        total: allNFTs.length,
        available: allNFTs.filter(n => !n.isStaked).length,
        staked: allNFTs.filter(n => n.isStaked).length,
        onchain: onchainData.length,
        onchainInContext: allNFTs.filter(n => n.status === 'onchain').length,
        offchainInContext: allNFTs.filter(n => n.status === 'offchain').length
      });
      
      // DEBUG: Show final onchain staked NFTs
      const finalOnchainStaked = allNFTs.filter(n => n.status === 'onchain' && n.isStaked);
      console.log('🔍 [NFTContext] Final onchain staked NFTs:', finalOnchainStaked.length);
      if (finalOnchainStaked.length > 0) {
        console.log('🔍 [NFTContext] Final onchain staked NFT details:', 
          finalOnchainStaked.map(n => ({ id: n.id, name: n.name, isStaked: n.isStaked, stakingSource: n.stakingSource }))
        );
      }
      
      // DEBUG: Show onchain NFTs in final result
      const onchainInFinal = allNFTs.filter(n => n.status === 'onchain');
      console.log('🔍 [NFTContext] Final onchain NFTs:', onchainInFinal.map(n => ({ id: n.id, name: n.name, status: n.status })));

    } catch (error) {
      console.error('❌ [NFTContext] Failed to load NFT data:', error);
      
      // Don't show error toast for blockchain failures (common issue)
      if (!error.message?.includes('tokenOfOwnerByIndex') && !error.message?.includes('RPC Error')) {
        toast.error('Failed to load NFT data');
      }
      
      // Try to load from cache as fallback
      const cachedData = sessionStorage.getItem('nft_cache');
      const cachedWallet = sessionStorage.getItem('nft_cache_wallet');
      
      if (cachedData && cachedWallet === walletAddress) {
        console.log('🔄 [NFTContext] Loading from cache as fallback...');
        try {
          const parsed = JSON.parse(cachedData);
          setAllNFTs(parsed.allNFTs || []);
          setOffchainNFTs(parsed.offchainNFTs || []);
          setOnchainNFTs(parsed.onchainNFTs || []);
          setIsInitialized(true);
          console.log('✅ [NFTContext] Fallback cache load successful');
        } catch (cacheError) {
          console.warn('⚠️ [NFTContext] Cache fallback failed:', cacheError);
        }
      }
    } finally {
      clearTimeout(loadingTimeoutId);
      
      // Clear loading start time tracker
      const loadingStartKey = `loading_start_${walletAddress}`;
      sessionStorage.removeItem(loadingStartKey);
      
      setIsLoading(false);
      
      // Reset streaming loading states
      setIsLoadingMore(false);
      setHasMoreToLoad(false);
    }
  }, [walletAddress, isAuthenticated]);

  // Force reload function (bypasses all throttling)
  const forceReloadNFTs = useCallback(async () => {
    console.log('🔄 [NFTContext] FORCE RELOAD - Bypassing all throttling...');
    
    // Clear all throttling and cache
    const loadingStartKey = `loading_start_${walletAddress}`;
    const lastRefreshKey = `last_refresh_${walletAddress}`;
    sessionStorage.removeItem(loadingStartKey);
    sessionStorage.removeItem(lastRefreshKey);
    sessionStorage.removeItem('nft_cache');
    sessionStorage.removeItem('nft_cache_wallet');
    sessionStorage.removeItem('nft_cache_expiry');
    
    // Reset all states
    setIsLoading(false);
    setCacheExpiry(null);
    setHasOptimisticUpdates(false);
    
    // Force fresh load
    await loadNFTData();
  }, [walletAddress, loadNFTData]);

  // Debounced refresh to prevent excessive calls
  const refreshNFTsDebounced = useCallback(async () => {
    const now = Date.now();
    const lastRefreshKey = `last_refresh_${walletAddress}`;
    const lastRefresh = parseInt(sessionStorage.getItem(lastRefreshKey) || '0');
    
    if (now - lastRefresh < 10000) { // 10 second throttle for full refresh
      console.log('⚡ [NFTContext] Refresh throttled, skipping...');
      return;
    }
    
    sessionStorage.setItem(lastRefreshKey, now.toString());
    console.log('🔄 [NFTContext] Full refresh requested...');
    
    // Clear cache to force fresh load
    setCacheExpiry(null);
    setHasOptimisticUpdates(true);
    await loadNFTData();
  }, [walletAddress, loadNFTData]);

  // Lightweight staking status sync (no full reload)
  const syncStakingStatus = useCallback(async () => {
    if (!walletAddress || !isAuthenticated || allNFTs.length === 0) {
      return;
    }

    // Throttle sync calls to prevent excessive API usage
    const now = Date.now();
    const lastSyncKey = `last_sync_${walletAddress}`;
    const lastSync = parseInt(sessionStorage.getItem(lastSyncKey) || '0');
    
    if (now - lastSync < 5000) { // 5 second throttle
      console.log('⚡ [NFTContext] Sync throttled, skipping...');
      return;
    }
    
    sessionStorage.setItem(lastSyncKey, now.toString());

    try {
      console.log('🔄 [NFTContext] Syncing staking status without full reload...');
      
      // Get fresh staking data from backend (single optimized call)
      const stakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
      console.log('📊 [NFTContext] Fresh staking data:', stakedNFTs.length, 'staked NFTs');
      
      // Create staking lookup maps for O(1) performance
      const stakedNFTIds = new Set<string>();
      const stakedNFTMap = new Map<string, any>();
      
      stakedNFTs.forEach(stakedNFT => {
        const ids = [stakedNFT.id, stakedNFT.nft_id, stakedNFT.nft_id?.toString()].filter(Boolean);
        ids.forEach(id => {
          stakedNFTIds.add(id);
          stakedNFTMap.set(id, stakedNFT);
          
          // Handle onchain variants
          if (typeof id === 'string') {
            if (id.startsWith('onchain_')) {
              const numericId = id.replace('onchain_', '');
              stakedNFTIds.add(numericId);
              stakedNFTIds.add(`staked_${numericId}`);
              stakedNFTMap.set(numericId, stakedNFT);
              stakedNFTMap.set(`staked_${numericId}`, stakedNFT);
            } else if (/^\d+$/.test(id)) {
              stakedNFTIds.add(`onchain_${id}`);
              stakedNFTIds.add(`staked_${id}`);
              stakedNFTMap.set(`onchain_${id}`, stakedNFT);
              stakedNFTMap.set(`staked_${id}`, stakedNFT);
            }
          }
        });
      });
      
      // SAFETY CHECK: Don't overwrite optimistic updates if backend returns empty data
      if (stakedNFTs.length === 0 && hasOptimisticUpdates) {
        console.log('⚠️ [NFTContext] Backend returned empty staked NFTs but we have optimistic updates - skipping sync to preserve UI state');
        return;
      }

      // Update existing NFTs with fresh staking status (no reload!)
      setAllNFTs(prevNFTs => {
        console.log('🔍 [NFTContext] Current NFT IDs in context:', prevNFTs.map(nft => ({ id: nft.id, name: nft.name, isStaked: nft.isStaked })));
        console.log('🔍 [NFTContext] Staked NFT IDs from backend:', Array.from(stakedNFTIds));
        
        const updatedNFTs = prevNFTs.map(nft => {
          const isStaked = stakedNFTIds.has(nft.id);
          const stakedRecord = stakedNFTMap.get(nft.id);
          const stakingSource = isStaked ? (stakedRecord?.staking_source || 'offchain') : 'none';
          
          // Debug each NFT matching
          console.log(`🔍 [NFTContext] Checking NFT ${nft.id} (${nft.name}): stakedNFTIds.has(${nft.id}) = ${isStaked}`);
          
          // Only update if staking status changed
          if (nft.isStaked !== isStaked || nft.stakingSource !== stakingSource) {
            console.log(`🔄 [NFTContext] Updated staking status for ${nft.id}: ${nft.isStaked} → ${isStaked}`);
            return {
              ...nft,
              isStaked,
              stakingSource,
              stakeTimestamp: isStaked ? (stakedRecord?.staked_at || nft.stakeTimestamp) : undefined
            };
          }
          
          return nft; // No change needed
        });
        
        return updatedNFTs;
      });
      
      console.log('✅ [NFTContext] Staking status synced without reload');
      
    } catch (error) {
      console.error('❌ [NFTContext] Failed to sync staking status:', error);
    }
  }, [walletAddress, isAuthenticated, allNFTs.length]);

  // Optimistic Updates
  const optimisticStake = useCallback((nftIds: string[], stakingSource: 'offchain' | 'onchain' = 'offchain') => {
    console.log('🔄 [NFTContext] Optimistic stake:', nftIds, 'source:', stakingSource);
    setBackupState([...allNFTs]); // Backup current state
    setHasOptimisticUpdates(true); // Mark that we have optimistic updates
    
    setAllNFTs(prev => prev.map(nft => 
      nftIds.includes(nft.id) 
        ? { ...nft, isStaked: true, stakingSource: stakingSource, stakeTimestamp: Date.now() }
        : nft
    ));
  }, [allNFTs]);

  const optimisticUnstake = useCallback((nftIds: string[]) => {
    console.log('🔄 [NFTContext] Optimistic unstake:', nftIds);
    setBackupState([...allNFTs]); // Backup current state
    setHasOptimisticUpdates(true); // Mark that we have optimistic updates
    
    setAllNFTs(prev => prev.map(nft => 
      nftIds.includes(nft.id) 
        ? { ...nft, isStaked: false, stakingSource: 'none' as const, stakeTimestamp: undefined }
        : nft
    ));
  }, [allNFTs]);

  // Add optimistic claiming status (during transaction)
  const optimisticClaimStart = useCallback((nftId: string) => {
    console.log('🔄 [NFTContext] Starting claim (showing claiming status):', nftId);
    setBackupState([...allNFTs]); // Backup current state
    
    setAllNFTs(prev => prev.map(nft => 
      nft.id === nftId 
        ? { ...nft, status: 'claiming' as any, claiming: true, claimingMessage: 'Waiting for blockchain confirmation...' }
        : nft
    ));
  }, [allNFTs]);

  const optimisticClaim = useCallback((nftId: string) => {
    console.log('🔄 [NFTContext] Optimistic claim completed - removing offchain, will add onchain version:', nftId);
    
    // Remove the offchain version immediately (it's now onchain)
    setAllNFTs(prev => prev.filter(nft => nft.id !== nftId));
    setOffchainNFTs(prev => prev.filter(nft => nft.id !== nftId));
    
    // The onchain version will be loaded by the next refresh/sync
    console.log('✅ [NFTContext] Offchain NFT removed after successful claim. Onchain version will appear on next sync.');
  }, []);

  // Add function to handle successful claim with onchain NFT data
  const handleSuccessfulClaim = useCallback((offchainNftId: string, onchainNft: ContextNFT) => {
    console.log('🎉 [NFTContext] Claim successful - replacing offchain with onchain NFT:', { offchainNftId, onchainNft });
    
    setAllNFTs(prev => {
      // Remove offchain version and add onchain version
      const withoutOffchain = prev.filter(nft => nft.id !== offchainNftId);
      return [...withoutOffchain, onchainNft];
    });
    
    setOffchainNFTs(prev => prev.filter(nft => nft.id !== offchainNftId));
    setOnchainNFTs(prev => [...prev, onchainNft as unknown as OnchainNFT]);
    
    clearOptimisticUpdates();
  }, []);

  const optimisticBurn = useCallback((nftIds: string[], newNFT?: ContextNFT) => {
    console.log('🔄 [NFTContext] Optimistic burn:', nftIds, newNFT);
    setBackupState([...allNFTs]); // Backup current state
    
    setAllNFTs(prev => {
      // Remove burned NFTs
      let updated = prev.filter(nft => !nftIds.includes(nft.id));
      
      // Add new NFT if provided
      if (newNFT) {
        updated.push(newNFT);
      }
      
      return updated;
    });
  }, [allNFTs]);

  // Generic optimistic update function
  const updateNFTOptimistically = useCallback((nftId: string, updates: Partial<ContextNFT>) => {
    console.log('🔄 [NFTContext] Optimistic update for NFT:', nftId, updates);
    setBackupState([...allNFTs]); // Backup current state
    setHasOptimisticUpdates(true);
    
    setAllNFTs(prev => prev.map(nft => 
      nft.id === nftId 
        ? { ...nft, ...updates, lastUpdated: Date.now(), optimisticUpdate: true }
        : nft
    ));
  }, [allNFTs]);

  // Batch update multiple NFTs
  const batchUpdateNFTs = useCallback((updates: Array<{id: string, changes: Partial<ContextNFT>}>) => {
    console.log('🔄 [NFTContext] Batch optimistic updates:', updates);
    setBackupState([...allNFTs]); // Backup current state
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

  // STABLE INITIALIZATION: Prevent auth state flipping
  useEffect(() => {
    // Add delay to prevent rapid auth state changes
    const authCheckTimeout = setTimeout(() => {
      console.log('🔄 [NFTContext] Stable auth check:', { walletAddress, isAuthenticated, lastWalletAddress });
      
      if (isAuthenticated && walletAddress) {
        // PERFORMANCE: Only reload if wallet actually changed or no data exists
        const walletChanged = lastWalletAddress !== walletAddress;
        const hasNoData = allNFTs.length === 0 && !isInitialized;
        const cacheExpired = cacheExpiry && Date.now() > cacheExpiry.getTime();
        const needsReload = walletChanged || hasNoData || cacheExpired;
        
        console.log('🔍 [NFTContext] Loading conditions:', { 
          walletChanged, 
          hasNoData, 
          cacheExpired,
          allNFTsCount: allNFTs.length,
          isInitialized,
          needsReload 
        });
        
        if (needsReload) {
          console.log('🔄 [NFTContext] Loading NFT data:', { walletChanged, hasNoData, needsReload });
          
          // Only clear data if wallet changed, not on every auth state change
          if (walletChanged) {
            console.log('🔄 [NFTContext] Wallet changed, clearing old data');
            setAllNFTs([]);
            setOffchainNFTs([]);
            setOnchainNFTs([]);
            setCacheExpiry(null); // Invalidate cache for new wallet
            // Clear old wallet cache
            sessionStorage.removeItem('nft_cache');
            sessionStorage.removeItem('nft_cache_wallet');
            sessionStorage.removeItem('nft_cache_expiry');
          }
          
          setIsLoading(true);
          setLastWalletAddress(walletAddress);
          loadNFTData().catch(error => {
            console.error('❌ [NFTContext] Failed to load NFT data:', error);
            setIsLoading(false);
            setIsInitialized(true);
          });
        } else {
          console.log('⚡ [NFTContext] Skipping reload - data already loaded for this wallet');
          // Ensure loading state is false if we have data
          if (allNFTs.length > 0) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        }
      } else if (!isAuthenticated && lastWalletAddress) {
        // Only clear data when actually logging out (not temporary auth state changes)
        console.log('🔄 [NFTContext] User logged out, clearing NFT data...');
        setAllNFTs([]);
        setOffchainNFTs([]);
        setOnchainNFTs([]);
        setLastWalletAddress(null);
        setCacheExpiry(null);
        setIsLoading(false);
        setIsInitialized(true);
        // Clear cache
        sessionStorage.removeItem('nft_cache');
        sessionStorage.removeItem('nft_cache_wallet');
        sessionStorage.removeItem('nft_cache_expiry');
      }
    }, 500); // 500ms delay to prevent rapid auth state changes
    
    return () => clearTimeout(authCheckTimeout);
  }, [walletAddress, isAuthenticated]);


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
    } else if (hasData) {
      console.log('✅ [NFTContext] NFTs already loaded');
    } else {
      console.log('⏳ [NFTContext] Loading already in progress');
    }
  }, [isAuthenticated, walletAddress, allNFTs.length, isLoading, isInitialized, loadNFTData]);

  // Listen for recovery events to refresh data
  useEffect(() => {
    const handleRecoveryEvent = () => {
      console.log('🔄 [NFTContext] Recovery event received, using debounced refresh...');
      refreshNFTsDebounced(); // Use debounced refresh instead of direct loadNFTData
    };

    window.addEventListener('nft-staking-recovered', handleRecoveryEvent);
    return () => window.removeEventListener('nft-staking-recovered', handleRecoveryEvent);
  }, [refreshNFTsDebounced]);

  // DEBUG: Expose debug functions to window for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).forceReloadNFTs = forceReloadNFTs;
      (window as any).debugNFTContext = () => {
        console.log('🔍 [NFTContext] Debug State:', {
          allNFTs: allNFTs.length,
          isLoading,
          isInitialized,
          walletAddress,
          lastWalletAddress,
          cacheExpiry,
          hasOptimisticUpdates,
          loadingProgress
        });
      };
      console.log('🔧 [NFTContext] Debug: window.forceReloadNFTs() and window.debugNFTContext() available');
    }
  }, [forceReloadNFTs, allNFTs.length, isLoading, isInitialized, walletAddress, lastWalletAddress, cacheExpiry, hasOptimisticUpdates, loadingProgress]);

  const contextValue: NFTContextState = {
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
    refreshNFTs: refreshNFTsDebounced,
    syncStakingStatus,
    forceReloadNFTs,
    ensureNFTsLoaded,
    
    // Optimistic Updates
    updateNFTOptimistically,
    batchUpdateNFTs,
    optimisticStake,
    optimisticUnstake,
    optimisticClaimStart,
    optimisticClaim,
    optimisticBurn,
    
    // Claiming Functions
    handleSuccessfulClaim,
    
    // Revert Functions
    revertOptimisticUpdate,
    clearOptimisticUpdates
  };

  return (
    <NFTContext.Provider value={contextValue}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTProvider;
