import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Flame, Filter, Zap, ChevronDown, Sparkles, Clock, TrendingUp, HelpCircle, DollarSign, CoinsIcon, Cloud, Link, Lock, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MainNav } from "@/components/layout/MainNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import confetti from "canvas-confetti";
import { useAuthState } from "@/hooks/useAuthState";
import { useNFTContext } from "@/contexts/NFTContext";
import { useNFTOperations } from '@/hooks/useNFTOperations';
import { useTokenOperations } from '@/hooks/useTokenOperations';
import ProgressiveNFTImage from '@/components/ui/ProgressiveNFTImage';
import { getIPFSUrl, extractIPFSHash } from '@/config/ipfsConfig';
import { useEnsureNFTsLoaded } from '@/hooks/useEnsureNFTsLoaded';
import optimizedCIDPoolBurnService from "@/services/OptimizedCIDPoolBurnService";
import offChainStakingService from "@/services/EnhancedStakingService";
import improvedOnchainStakingService from '../services/ImprovedOnchainStakingService';
import { StakedNFT, StakedTokens, StakingReward, StakingSummary, StakingResponse } from "@/types/staking";
import { NFTData } from "@/services/HybridIPFSService";
import { nftLifecycleService, OffchainNFT, OnchainNFT } from "@/services/NFTLifecycleService";
import { comprehensiveNFTDataService, ComprehensiveNFTData } from "@/services/ComprehensiveNFTDataService";
import userBalanceService from "@/services/UserBalanceService";
// Enhanced StakingNFT interface with comprehensive data support
interface StakingNFT extends NFTData {
  dailyReward: number;
  isStaked?: boolean;
  onChain?: boolean;
  claimed?: boolean;
  stakingSource?: 'none' | 'offchain' | 'onchain';
  staked_at?: string;
  tokenId?: string;
  contractAddress?: string;
  claimed_at?: string;
  status?: 'offchain' | 'onchain' | 'claimed';
}


const getRarityStyles = (rarity: string) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    Common: {
      bg: "bg-yellow-200",
      text: "text-black",
      border: "border-black-800",
    },
    Rare: {
      bg: "bg-blue-400",
      text: "text-black",
      border: "border-black-800",
    },
    Legendary: {
      bg: "bg-green-300",
      text: "text-black",
      border: "border-black-800",
    },
  };
  return (
    colors[rarity] || {
      bg: "bg-gray-800",
      text: "text-text-secondary",
      border: "border-gray-700",
    }
  );
};

const StakingPage = () => {
  // Authentication state
  const { isAuthenticated, walletAddress, isLoading: authLoading } = useAuthState();
  
  // Ensure NFTs are loaded when page mounts
  const { isLoading: nftAutoLoading, hasNFTs } = useEnsureNFTsLoaded();
  
  // NFT Context - centralized NFT management
  const { 
    allNFTs, 
    stakableNFTs, 
    stakedNFTs, 
    isLoading: isLoadingNFTsContext,
    isInitialized: nftContextInitialized,
    // Streaming loading states
    isLoadingMore,
    hasMoreToLoad,
    loadingProgress
  } = useNFTContext();
  
  // NFT Operations with optimistic updates
  const { stakeNFTs, unstakeNFTs, checkApprovalStatus, approveStakingContract } = useNFTOperations();
  
  // Token Operations
  const { stakeTokens, unstakeTokens } = useTokenOperations();

  // Local UI state (no more NFT loading - handled by context)
  const [selectedNFTs, setSelectedNFTs] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Approval state for onchain staking
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // Staking backend state
  const [stakingSummary, setStakingSummary] = useState<StakingSummary>({
    staked_nfts_count: 0,
    staked_tokens_amount: 0,
    total_pending_rewards: 0,
    nft_pending_rewards: 0,
    token_pending_rewards: 0,
    daily_nft_rewards: 0,
    daily_token_rewards: 0
  });
  const [stakedNFTsData, setStakedNFTsData] = useState<StakedNFT[]>([]);
  const [stakedTokensData, setStakedTokensData] = useState<StakedTokens[]>([]);
  const [pendingRewards, setPendingRewards] = useState<StakingReward[]>([]);
  const [isLoadingStaking, setIsLoadingStaking] = useState(false);

  // Token staking state
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAPR] = useState(20);

  // NFT button state helpers

  // Available NEFT from user balance service (correct source of truth)
  const [availableNEFT, setAvailableNEFT] = useState<number>(0);
  const [userBalance, setUserBalance] = useState<any>(null);
  
  // Separate loading states for better UX
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingStakingData, setIsLoadingStakingData] = useState(false);

  // 24-hour timer states for reward claims
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<{ nft: number; token: number }>({ nft: 0, token: 0 });
  const [canClaimNFTRewards, setCanClaimNFTRewards] = useState(false);
  const [canClaimTokenRewards, setCanClaimTokenRewards] = useState(false);

  // UI state
  const [tab, setTab] = useState("nfts");
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [stakeModalStep, setStakeModalStep] = useState<1 | 2>(1);
  const [isStaking, setIsStaking] = useState(false);
  const [isTokenStakeModalOpen, setIsTokenStakeModalOpen] = useState(false);
  const [tokenStakeModalStep, setTokenStakeModalStep] = useState<1 | 2>(1);
  const [isTokenStaking, setIsTokenStaking] = useState(false);
  const [lastStakedAmount, setLastStakedAmount] = useState(0);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isTokenUnstakeModalOpen, setIsTokenUnstakeModalOpen] = useState(false);
  const [tokenUnstakeModalStep, setTokenUnstakeModalStep] = useState<1 | 2>(1);
  const [lastUnstakedAmount, setLastUnstakedAmount] = useState(0);
  const [isUnstakeModalOpen, setIsUnstakeModalOpen] = useState(false);
  const [unstakeModalStep, setUnstakeModalStep] = useState<1 | 2>(1);
  const [showMobileInfo, setShowMobileInfo] = useState(false);
  const toastId = useRef<string | number | null>(null)
  const wasLoadingRef = useRef<boolean>(false);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Removed preventBackendOverride - handled by NFT context

  useEffect(() => {
    // Derive a stable boolean for loading state
    const isOnchainStillLoading = Boolean(isLoadingNFTsContext || !loadingProgress?.onchain);

    // Only act on transitions (edge-triggered), not on every render/update
    if (isOnchainStillLoading && !wasLoadingRef.current) {
      // Cancel any pending dismiss to prevent flicker
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
      // Entering loading state: show toast if not already shown
      if (!toastId.current) {
        toastId.current = toast.loading(
          "Loading your on-chain NFTs… This may take a few moments. Please ensure your wallet is connected."
        );
      }
      wasLoadingRef.current = true;
    } else if (!isOnchainStillLoading && wasLoadingRef.current) {
      // Exiting loading state: dismiss toast once
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      dismissTimeoutRef.current = setTimeout(() => {
        if (toastId.current) {
          toast.dismiss(toastId.current);
          toastId.current = null;
        }
        dismissTimeoutRef.current = null;
      }, 250);
      wasLoadingRef.current = false;
    }
  }, [isLoadingNFTsContext, loadingProgress?.onchain])

  // Cleanup on unmount to avoid dangling timeout/toast
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
      if (toastId.current) {
        toast.dismiss(toastId.current);
        toastId.current = null;
      }
    };
  }, [])


  // Check approval status on wallet connection
  useEffect(() => {
    const checkApproval = async () => {
      if (!walletAddress) {
        setIsApproved(false);
        return;
      }
      
      setIsCheckingApproval(true);
      try {
        const approved = await checkApprovalStatus();
        setIsApproved(approved);
        console.log('🔍 [Staking] Approval status checked:', approved);
      } catch (error) {
        console.error('❌ [Staking] Error checking approval:', error);
        setIsApproved(false);
      } finally {
        setIsCheckingApproval(false);
      }
    };

    checkApproval();
  }, [walletAddress, checkApprovalStatus]);

  // Handle approval for onchain staking
  const handleApproveStaking = async () => {
    if (!walletAddress) return;
    
    setIsApproving(true);
    try {
      const result = await approveStakingContract();
      if (result.success) {
        setIsApproved(true);
        toast.success('✅ Approval successful! You can now stake NFTs onchain.');
      }
    } catch (error) {
      console.error('❌ [Staking] Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  // Onchain availability state
  const [isOnChainAvailable, setIsOnChainAvailable] = useState(false);

  // Check on-chain availability on component mount
  useEffect(() => {
    const checkOnChainAvailability = async () => {
      try {
        console.log('🔍 Checking onchain availability...');
        const available = await improvedOnchainStakingService.isOnChainAvailable();
        setIsOnChainAvailable(available);
        console.log('⛓️ On-chain staking available:', available);
        
        if (!available) {
          console.warn('❌ Onchain staking not available - onchain NFTs will not be fetched');
        }
      } catch (error) {
        console.error('❌ Error checking on-chain availability:', error);
        setIsOnChainAvailable(false);
      }
    };

    checkOnChainAvailability();
  }, []);

  // Load balance and staking data when authenticated (NFTs handled by context) - OPTIMIZED
  useEffect(() => {
    if (isAuthenticated && walletAddress && !authLoading && nftContextInitialized) {
      console.log('⚡ [Staking] Loading balance and staking data in parallel');
      
      loadBalanceData();
      loadStakingData();
    } else {
      // Reset to default when not authenticated
      setAvailableNEFT(0);
      setUserBalance(null);
      setTimeUntilNextClaim({ nft: 0, token: 0 });
      setCanClaimNFTRewards(false);
      setCanClaimTokenRewards(false);
    }
  }, [isAuthenticated, walletAddress, authLoading, nftContextInitialized]);

  // 24-hour countdown timer effect
  useEffect(() => {
    if (!stakedNFTsData.length && !stakedTokensData.length) return;

    const updateCountdown = () => {
      const now = Date.now();
      let nftTimeRemaining = 0;
      let tokenTimeRemaining = 0;

      // Check NFT staking time (24 hours from stake time)
      if (stakedNFTsData.length > 0) {
        const oldestNFTStake = stakedNFTsData.reduce((oldest, current) => 
          new Date(current.staked_at) < new Date(oldest.staked_at) ? current : oldest
        );
        const nftStakeTime = new Date(oldestNFTStake.staked_at).getTime();
        const nft24HoursLater = nftStakeTime + (24 * 60 * 60 * 1000);
        nftTimeRemaining = Math.max(0, nft24HoursLater - now);
      }

      // Check Token staking time (24 hours from stake time)
      if (stakedTokensData.length > 0) {
        const oldestTokenStake = stakedTokensData.reduce((oldest, current) => 
          new Date(current.staked_at) < new Date(oldest.staked_at) ? current : oldest
        );
        const tokenStakeTime = new Date(oldestTokenStake.staked_at).getTime();
        const token24HoursLater = tokenStakeTime + (24 * 60 * 60 * 1000);
        tokenTimeRemaining = Math.max(0, token24HoursLater - now);
      }

      setTimeUntilNextClaim({ nft: nftTimeRemaining, token: tokenTimeRemaining });
      // Only allow claiming if there are actual pending rewards (> 0.01 NEFT minimum)
      setCanClaimNFTRewards(stakingSummary.nft_pending_rewards > 0.01);
      setCanClaimTokenRewards(stakingSummary.token_pending_rewards > 0.01);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [stakedNFTsData, stakedTokensData, stakingSummary]);

  // NFTs are now loaded by NFTContext - no need for separate loading function

  // Open modal when stake button is clicked
  const openStakeModal = () => {
    setStakeModalStep(1);
    setIsStakeModalOpen(true);
  };
  // Close modal and reset
  const closeStakeModal = () => {
    setIsStakeModalOpen(false);
    setStakeModalStep(1);
    setIsStaking(false);
    setSelectedNFTs([]);
  };

  // Open modal when unstake button is clicked
  const openUnstakeModal = () => {
    setUnstakeModalStep(1);
    setIsUnstakeModalOpen(true);
  };
  // Close unstake modal and reset
  const closeUnstakeModal = () => {
    setIsUnstakeModalOpen(false);
    setUnstakeModalStep(1);
    setIsUnstaking(false);
    setSelectedNFTs([]);
  };

  // Step 2: Stake NFT action with optimistic updates via NFTContext
  const handleStakeNFTs = async () => {
    if (selectedNFTs.length === 0) return;

    setIsStaking(true);

    try {
      console.log('🚀 Starting NFT staking with optimistic updates:', selectedNFTs.map(nft => nft.id));
      
      // Use NFT operations hook for optimistic updates
      const result = await stakeNFTs(selectedNFTs.map(nft => nft.id));

      if (result.success) {
        // Optimistic updates handled by NFTContext - NO DATA RELOAD NEEDED
        // Clear selected NFTs and show success
        setSelectedNFTs([]);
        setStakeModalStep(2);
        
        // Don't reload data - keep the optimistic update
        console.log('🎯 [Staking] Keeping optimistic update - not reloading data');
        
        // Notify MainNav to refresh balances
        window.dispatchEvent(new CustomEvent('nft-staked'));
        
        toast.success(result.message);
      } else {
        console.log('  ❌ Staking failed:', result.message);
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error staking NFT:', error);
      toast.error('Failed to stake NFT. Please try again.');
    } finally {
      setIsStaking(false);
    }
  };

  // Unstake NFTs function with optimistic updates via NFTContext
  const handleUnstakeNFTs = async () => {
    if (selectedNFTs.length === 0) return;

    setIsUnstaking(true);

    try {
      console.log('🚀 Starting NFT unstaking with optimistic updates:', selectedNFTs.map(nft => nft.id));
      
      // Use NFT operations hook for optimistic updates
      const result = await unstakeNFTs(selectedNFTs.map(nft => nft.id));

      if (result.success) {
        // Optimistic updates handled by NFTContext - NO DATA RELOAD NEEDED
        // Clear selected NFTs and show success
        setSelectedNFTs([]);
        setUnstakeModalStep(2);
        
        // Don't reload data - keep the optimistic update
        console.log('🎯 [Staking] Keeping optimistic update - not reloading data');
        
        // Notify MainNav to refresh balances
        window.dispatchEvent(new CustomEvent('nft-unstaked'));
      } else {
        console.log('  ❌ Unstaking failed:', result.message);
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error unstaking NFT:', error);
      toast.error('Failed to unstake NFT. Please try again.');
    } finally {
      setIsUnstaking(false);
    }
  };

  // Calculate total daily reward using correct reward system
  const totalDailyReward = selectedNFTs.reduce((sum, nft) => {
    // Use the NFT's dailyReward if available, otherwise calculate from rarity using the correct reward system
    const dailyReward = nft.dailyReward || offChainStakingService.getDailyRewardForRarity(nft.rarity);
    return sum + dailyReward;
  }, 0);

  // Fast balance loading function
  const loadBalanceData = async () => {
    if (!walletAddress) return;

    setIsLoadingBalance(true);
    try {
      console.log('💰 Loading balance data for wallet:', walletAddress);
      
      const userBalanceData = await userBalanceService.getUserBalance(walletAddress);
      setUserBalance(userBalanceData);
      setAvailableNEFT(userBalanceData.available_neft || 0);
      
      console.log('💰 Balance loaded:', {
        available_neft: userBalanceData.available_neft,
        staked_neft: userBalanceData.staked_neft,
        total_neft_claimed: userBalanceData.total_neft_claimed
      });
    } catch (error) {
      console.error('❌ Error loading balance data:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Calculate optimistic daily rewards from currently staked NFTs (for smooth UI)
  const calculateOptimisticDailyRewards = () => {
    return allNFTs
      .filter(nft => nft.isStaked)
      .reduce((sum, nft) => {
        const dailyReward = nft.dailyReward || offChainStakingService.getDailyRewardForRarity(nft.rarity);
        return sum + dailyReward;
      }, 0);
  };

  // Load comprehensive staking data from backend with error handling
  const loadStakingData = async () => {
    if (!walletAddress) return;

    setIsLoadingStaking(true);
    try {
      console.log('🔄 Loading comprehensive staking data for wallet:', walletAddress);
      
      // Force clear any cached data to ensure fresh database values
      console.log('🔄 Forcing fresh data load to prevent UI/database mismatch');

      // Get comprehensive staking summary including recovered NFTs
      const comprehensiveSummary = await comprehensiveNFTDataService.getComprehensiveStakingSummary(walletAddress);
      console.log('📊 Comprehensive staking summary:', comprehensiveSummary);
      
      // Get traditional staking summary for compatibility
      const summary = await offChainStakingService.getUserStakingSummary(walletAddress);
      setStakingSummary(summary);
      console.log('📊 Traditional staking summary loaded:', summary);
      
      // Debug: Log pending rewards specifically
      console.log('🔍 DEBUG: Pending rewards from summary:', {
        nft_pending_rewards: summary.nft_pending_rewards,
        token_pending_rewards: summary.token_pending_rewards,
        total_pending_rewards: summary.total_pending_rewards
      });
      
      // Validation: Warn if UI shows rewards but database has none
      if (summary.total_pending_rewards === 0) {
        console.log('⚠️ VALIDATION: Database shows 0 pending rewards - UI should not show claimable amounts');
      } else {
        console.log('✅ VALIDATION: Database shows pending rewards:', summary.total_pending_rewards);
      }

      // Note: availableNEFT is set by loadBalanceData() from user balance service
      // Do NOT overwrite it with staked_tokens_amount (which is already staked, not available)
      console.log('💰 Staked tokens amount from summary:', summary.staked_tokens_amount || 0);

      // ENHANCED ERROR HANDLING: Load staked NFTs with separate onchain/offchain handling
      let allStakedNFTs: (StakedNFT & { blockchain_metadata?: any })[] = [];
      
      try {
        // Get staked NFTs from offchain service (database) - ONLY for reward tracking, NOT for display metadata
        const offchainStakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
        
        // Filter to only include truly offchain staked NFTs (not onchain ones tracked in database)
        const pureOffchainStakedNFTs = offchainStakedNFTs.filter(stakedNft => 
          !stakedNft.nft_id?.toString().startsWith('onchain_') &&
          !stakedNft.nft_id?.toString().startsWith('blockchain_') &&
          !stakedNft.nft_id?.toString().startsWith('reward_tracker_') &&
          !stakedNft.id?.toString().startsWith('reward_tracker_') &&
          stakedNft.stakingSource !== 'onchain' &&
          stakedNft.name !== 'REWARD_TRACKER_ONLY'
        );
        
        allStakedNFTs = [...pureOffchainStakedNFTs];
        console.log('📊 Pure offchain staked NFTs loaded from database:', pureOffchainStakedNFTs.length);
        console.log('📊 Filtered out onchain NFTs from database to preserve blockchain metadata');
      } catch (offchainError) {
        console.error('❌ Failed to load offchain staked NFTs:', offchainError);
        // Don't return - continue to try onchain
      }
      
      // Add onchain staked NFTs if available - FETCH DIRECTLY FROM BLOCKCHAIN OR FALLBACK TO DATABASE
      console.log('🔍 Debug: isOnChainAvailable =', isOnChainAvailable, 'walletAddress =', walletAddress);
      
      // ENHANCED FALLBACK: Try blockchain first, then fallback to database with metadata enrichment
      try {
        console.log('⛓️ FORCE: Attempting to fetch onchain staked NFTs from blockchain...');
        console.log('⛓️ FORCE: Using ImprovedOnchainStakingService for wallet:', walletAddress);
        const onchainStakedNFTs = await improvedOnchainStakingService.getDetailedOnchainStakedNFTs(walletAddress);
        console.log('📊 FORCE: Onchain staked NFTs loaded from blockchain:', onchainStakedNFTs.length);
        console.log('📊 FORCE: Onchain staked NFTs data:', onchainStakedNFTs);
        
        if (onchainStakedNFTs.length > 0) {
          console.log('✅ FORCE: Found onchain staked NFTs, proceeding with processing...');
          
          // Add each onchain staked NFT to the list
          for (const onchainNFT of onchainStakedNFTs) {
            try {
              // Check if this NFT is already in offchain staked list (avoid duplicates)
              const existingOffchain = allStakedNFTs.find(nft => 
                nft.nft_id === onchainNFT.tokenId || 
                nft.nft_id === `onchain_${onchainNFT.tokenId}` ||
                nft.id === onchainNFT.tokenId ||
                nft.id === `onchain_${onchainNFT.tokenId}`
              );
              
              if (existingOffchain) {
                // Mark existing offchain NFT as also onchain
                existingOffchain.onChain = true;
                existingOffchain.stakingSource = 'onchain';
                console.log(`✅ FORCE: NFT ${onchainNFT.tokenId} found in both offchain and onchain - marked as onchain`);
                continue;
              }
              
              // CRITICAL FIX: Find the original NFT from NFTContext to preserve blockchain metadata
              const originalNFT = allNFTs.find(nft => 
                nft.tokenId === onchainNFT.tokenId || 
                nft.id === `onchain_${onchainNFT.tokenId}` ||
                nft.id === onchainNFT.tokenId
              );
              
              // Add onchain NFT with PRESERVED blockchain metadata (not database data)
              allStakedNFTs.push({
                id: `blockchain_${onchainNFT.tokenId}`,
                nft_id: onchainNFT.tokenId,
                wallet_address: walletAddress,
                nft_rarity: originalNFT?.rarity || onchainNFT.rarity,
                staked_at: onchainNFT.stakedAt,
                daily_reward: onchainNFT.dailyReward,
                last_reward_claim: onchainNFT.stakedAt,
                total_rewards_earned: 0,
                onchain: true,
                onChain: true,
                stakingSource: 'onchain',
                // Store ORIGINAL blockchain metadata for UI display (not database metadata)
                blockchain_metadata: {
                  name: originalNFT?.name || onchainNFT.name,
                  image: originalNFT?.image || onchainNFT.image,
                  rarity: originalNFT?.rarity || onchainNFT.rarity,
                  tokenId: onchainNFT.tokenId,
                  // Additional metadata preservation
                  description: originalNFT?.description || '',
                  attributes: originalNFT?.attributes || [],
                  ipfs_hash: originalNFT?.ipfs_hash || '',
                  metadata_uri: originalNFT?.metadata_uri || ''
                }
              });
              console.log(`✅ FORCE: Added onchain staked NFT with preserved metadata: ${originalNFT?.name || onchainNFT.name} (${onchainNFT.tokenId})`);
            } catch (nftError) {
              console.error(`❌ FORCE: Error processing onchain NFT ${onchainNFT.tokenId}:`, nftError);
            }
          }
          
          console.log(`✅ FORCE: Processed ${onchainStakedNFTs.length} onchain staked NFTs from blockchain`);
        } else {
          console.log('ℹ️ FORCE: No onchain staked NFTs found for wallet:', walletAddress);
        }
      } catch (forceError) {
        console.warn('⚠️ FORCE: Could not fetch onchain staked NFTs from blockchain:', forceError);
        
        // FALLBACK: When blockchain fails, try to recover onchain staked NFTs from database with metadata enrichment
        console.log('🔄 FALLBACK: Blockchain failed, attempting to recover onchain staked NFTs from database...');
        try {
          // Get ALL staked NFTs from database (including onchain ones tracked for rewards)
          const allDatabaseStakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
          console.log('📊 FALLBACK: Retrieved all database staked NFTs:', allDatabaseStakedNFTs.length);
          
          // Filter for onchain staked NFTs that we filtered out earlier
          const onchainDatabaseNFTs = allDatabaseStakedNFTs.filter(stakedNft => 
            stakedNft.nft_id?.toString().startsWith('onchain_') ||
            stakedNft.nft_id?.toString().startsWith('blockchain_') ||
            stakedNft.stakingSource === 'onchain' ||
            stakedNft.name === 'REWARD_TRACKER_ONLY'
          );
          
          console.log('📊 FALLBACK: Found onchain NFTs in database:', onchainDatabaseNFTs.length);
          
          if (onchainDatabaseNFTs.length > 0) {
            console.log('✅ FALLBACK: Processing onchain NFTs from database with metadata enrichment...');
            
            for (const dbStakedNFT of onchainDatabaseNFTs) {
              try {
                // Extract tokenId from database entry
                let tokenId = dbStakedNFT.nft_id;
                if (tokenId?.startsWith('onchain_')) {
                  tokenId = tokenId.replace('onchain_', '');
                } else if (tokenId?.startsWith('blockchain_')) {
                  tokenId = tokenId.replace('blockchain_', '');
                }
                
                console.log(`🔍 FALLBACK: Processing database onchain NFT with tokenId: ${tokenId}`);
                
                // Find the original NFT from NFTContext to get proper metadata
                const originalNFT = allNFTs.find(nft => 
                  nft.tokenId === tokenId || 
                  nft.id === `onchain_${tokenId}` ||
                  nft.id === tokenId ||
                  nft.name?.includes(`#${tokenId}`)
                );
                
                console.log(`🔍 FALLBACK: Found original NFT for ${tokenId}:`, originalNFT ? 'YES' : 'NO');
                
                // Check if already added to avoid duplicates
                const existingNFT = allStakedNFTs.find(nft => 
                  nft.nft_id === tokenId || 
                  nft.nft_id === `onchain_${tokenId}` ||
                  nft.id === tokenId ||
                  nft.id === `onchain_${tokenId}`
                );
                
                if (existingNFT) {
                  console.log(`⚠️ FALLBACK: NFT ${tokenId} already exists, skipping`);
                  continue;
                }
                
                // Add onchain NFT with enriched metadata from NFTContext
                const enrichedStakedNFT = {
                  id: `fallback_onchain_${tokenId}`,
                  nft_id: tokenId,
                  wallet_address: walletAddress,
                  nft_rarity: originalNFT?.rarity || dbStakedNFT.nft_rarity || 'common',
                  staked_at: dbStakedNFT.staked_at,
                  daily_reward: dbStakedNFT.daily_reward || 0,
                  last_reward_claim: dbStakedNFT.last_reward_claim,
                  total_rewards_earned: dbStakedNFT.total_rewards_earned || 0,
                  onchain: true,
                  onChain: true,
                  stakingSource: 'onchain' as const,
                  name: originalNFT?.name || `Onchain NFT #${tokenId}`,
                  // Store ENRICHED blockchain metadata from NFTContext
                  blockchain_metadata: {
                    name: originalNFT?.name || `Onchain NFT #${tokenId}`,
                    image: originalNFT?.image || '',
                    rarity: originalNFT?.rarity || dbStakedNFT.nft_rarity || 'common',
                    tokenId: tokenId
                  }
                };
                
                allStakedNFTs.push(enrichedStakedNFT);
                console.log(`✅ FALLBACK: Added enriched onchain NFT: ${enrichedStakedNFT.blockchain_metadata.name} (${tokenId})`);
                
              } catch (enrichError) {
                console.error(`❌ FALLBACK: Error enriching onchain NFT:`, enrichError);
              }
            }
            
            console.log(`✅ FALLBACK: Successfully recovered ${onchainDatabaseNFTs.length} onchain staked NFTs from database`);
          } else {
            console.log('ℹ️ FALLBACK: No onchain staked NFTs found in database either');
          }
          
        } catch (fallbackError) {
          console.error('❌ FALLBACK: Database fallback also failed:', fallbackError);
        }
      }
      
      // ORIGINAL LOGIC: Also try with isOnChainAvailable flag for compatibility
      if (isOnChainAvailable) {
        try {
          console.log('⛓️ Fetching onchain staked NFTs directly from blockchain...');
          const onchainStakedNFTs = await improvedOnchainStakingService.getDetailedOnchainStakedNFTs(walletAddress);
          console.log('📊 Onchain staked NFTs loaded from blockchain:', onchainStakedNFTs.length);
          console.log('📊 Onchain staked NFTs data:', onchainStakedNFTs);
          
          if (onchainStakedNFTs.length === 0) {
            console.log('ℹ️ No onchain staked NFTs found for wallet:', walletAddress);
          }
          
          // Add each onchain staked NFT to the list
          for (const onchainNFT of onchainStakedNFTs) {
            try {
              // Check if this NFT is already in offchain staked list (avoid duplicates)
              const existingOffchain = allStakedNFTs.find(nft => 
                nft.nft_id === onchainNFT.tokenId || 
                nft.nft_id === `onchain_${onchainNFT.tokenId}` ||
                nft.id === onchainNFT.tokenId ||
                nft.id === `onchain_${onchainNFT.tokenId}`
              );
              
              if (existingOffchain) {
                // Mark existing offchain NFT as also onchain
                existingOffchain.onChain = true;
                existingOffchain.stakingSource = 'onchain';
                console.log(`✅ NFT ${onchainNFT.tokenId} found in both offchain and onchain - marked as onchain`);
                continue;
              }
              
              // CRITICAL FIX: Find the original NFT from NFTContext to preserve blockchain metadata
              const originalNFT2 = allNFTs.find(nft => 
                nft.tokenId === onchainNFT.tokenId || 
                nft.id === `onchain_${onchainNFT.tokenId}` ||
                nft.id === onchainNFT.tokenId
              );
              
              // Add onchain NFT with PRESERVED blockchain metadata (not database data)
              allStakedNFTs.push({
                id: `blockchain_${onchainNFT.tokenId}`,
                nft_id: onchainNFT.tokenId,
                wallet_address: walletAddress,
                nft_rarity: originalNFT2?.rarity || onchainNFT.rarity,
                staked_at: onchainNFT.stakedAt,
                daily_reward: onchainNFT.dailyReward,
                last_reward_claim: onchainNFT.stakedAt,
                total_rewards_earned: 0,
                onchain: true,
                onChain: true,
                stakingSource: 'onchain',
                // Store ORIGINAL blockchain metadata for UI display (not database metadata)
                blockchain_metadata: {
                  name: originalNFT2?.name || onchainNFT.name,
                  image: originalNFT2?.image || onchainNFT.image,
                  rarity: originalNFT2?.rarity || onchainNFT.rarity,
                  tokenId: onchainNFT.tokenId,
                  // Additional metadata preservation
                  description: originalNFT2?.description || '',
                  attributes: originalNFT2?.attributes || [],
                  ipfs_hash: originalNFT2?.ipfs_hash || '',
                  metadata_uri: originalNFT2?.metadata_uri || ''
                }
              });
              console.log(`✅ Added onchain staked NFT with preserved metadata: ${originalNFT2?.name || onchainNFT.name} (${onchainNFT.tokenId})`);
            } catch (nftError) {
              console.error(`❌ Error processing onchain NFT ${onchainNFT.tokenId}:`, nftError);
            }
          }
          
          console.log(`✅ Processed ${onchainStakedNFTs.length} onchain staked NFTs from blockchain`);
        } catch (onchainError) {
          console.warn('⚠️ Could not fetch onchain staked NFTs from blockchain:', onchainError);
          // Continue with offchain data only
        }
      }
      
      setStakedNFTsData(allStakedNFTs);
      console.log('🎨 Combined staked NFTs:', allStakedNFTs);
      console.log('🎨 Final stakedNFTsData length:', allStakedNFTs.length);
      console.log('🎨 Final stakedNFTsData IDs:', allStakedNFTs.map(nft => ({ id: nft.id, nft_id: nft.nft_id, stakingSource: nft.stakingSource })));
      
      // DEBUG: Log metadata preservation for onchain staked NFTs
      const onchainStakedNFTs = allStakedNFTs.filter(nft => nft.stakingSource === 'onchain');
      if (onchainStakedNFTs.length > 0) {
        console.log('🔍 DEBUG: Onchain staked NFTs metadata preservation:');
        onchainStakedNFTs.forEach(nft => {
          console.log(`  📊 NFT ${nft.nft_id}:`, {
            name: nft.blockchain_metadata?.name || 'NO NAME',
            image: nft.blockchain_metadata?.image || 'NO IMAGE',
            rarity: nft.blockchain_metadata?.rarity || 'NO RARITY',
            hasMetadata: !!nft.blockchain_metadata
          });
        });
      }

      // Get staked tokens (still offchain only)
      let stakedTokens: any[] = [];
      try {
        stakedTokens = await offChainStakingService.getStakedTokens(walletAddress);
        setStakedTokensData(stakedTokens);
      } catch (tokenError) {
        console.error('❌ Failed to load staked tokens:', tokenError);
        setStakedTokensData([]);
      }

      // CRITICAL FIX: Update NFT Context with preserved blockchain metadata for onchain staked NFTs
      if (allStakedNFTs.length > 0) {
        console.log('🔄 Updating NFT staking status with preserved blockchain metadata...');
        
        // For each onchain staked NFT, ensure the NFTContext uses the original blockchain metadata
        allStakedNFTs.forEach(stakedNFT => {
          if (stakedNFT.stakingSource === 'onchain' && stakedNFT.blockchain_metadata) {
            // Find the NFT in context and update it with preserved metadata
            const contextNFT = allNFTs.find(nft => 
              nft.tokenId === stakedNFT.nft_id || 
              nft.id === `onchain_${stakedNFT.nft_id}` ||
              nft.id === stakedNFT.nft_id
            );
            
            if (contextNFT) {
              // Preserve the original blockchain metadata
              contextNFT.name = stakedNFT.blockchain_metadata.name;
              contextNFT.image = stakedNFT.blockchain_metadata.image;
              contextNFT.rarity = stakedNFT.blockchain_metadata.rarity;
              contextNFT.isStaked = true;
              contextNFT.stakingSource = 'onchain';
              
              console.log(`✅ Preserved blockchain metadata for staked NFT: ${contextNFT.name} (${stakedNFT.nft_id})`);
            }
          }
        });
        
        updateNFTStakingStatus(allStakedNFTs);
      } else if (summary.staked_nfts_count === 0) {
        updateNFTStakingStatus(allStakedNFTs);
      } else {
        console.warn('⚠️ Skipping NFT status update - no staked NFTs data and summary indicates staked NFTs exist');
        console.warn('⚠️ This prevents NFT disappearance due to data loading issues');
        console.log('📊 Comprehensive summary shows:', comprehensiveSummary);
      }

      console.log('🕐 Staked NFTs with timestamps:', allStakedNFTs.map(nft => ({
        id: nft.id,
        nft_id: nft.nft_id,
        staked_at: nft.staked_at
      })));
      console.log('🕐 Staked Tokens with timestamps:', stakedTokens.map(token => ({
        id: token.id,
        amount: token.amount,
        staked_at: token.staked_at
      })));

    } catch (error) {
      console.error('Error loading staking data:', error);
      toast.error('Failed to load staking data');
    } finally {
      setIsLoadingStakingData(false);
      setIsLoadingStaking(false);
    }
  };

  // Update NFT staking status based on staked NFTs data with safety checks
  const updateNFTStakingStatus = (stakedNFTs: StakedNFT[]) => {
    // CRITICAL FIX: Only use Supabase data for REWARD TRACKING, not for NFT display metadata
    // Onchain staked NFTs should preserve their original blockchain metadata
    console.log('🔍 DEBUG: updateNFTStakingStatus called with:', stakedNFTs?.length, 'staked NFTs');
    console.log('ℹ️ IMPORTANT: This function should ONLY update staking status, NOT overwrite NFT metadata');
    console.log('ℹ️ Onchain staked NFTs must preserve their original blockchain metadata from NFTContext');
    
    // The NFT Context already handles staking status updates with optimistic updates
    // This function is now primarily for reward tracking synchronization
    // DO NOT overwrite original NFT metadata with database data
  };

  // Claim NFT rewards only
  const handleClaimNFTRewards = async () => {
    const minClaimableAmount = 0.01;
    
    if (stakingSummary.nft_pending_rewards < minClaimableAmount) {
      toast.error(`Minimum ${minClaimableAmount} NEFT required for NFT rewards. Current: ${stakingSummary.nft_pending_rewards.toFixed(8)} NEFT`);
      return;
    }

    setIsClaiming(true);

    try {
      const result = await offChainStakingService.claimNFTRewards(walletAddress!);

      if (result.success) {
        await loadBalanceData();
        loadStakingData(); // No await - runs in background
        window.dispatchEvent(new CustomEvent('nft-rewards-claimed'));
        toast.success(`Successfully claimed ${result.data?.nft_rewards_claimed || stakingSummary.nft_pending_rewards.toFixed(4)} NEFT from NFT rewards!`);
        launchConfetti();
      } else {
        toast.error(result.message || 'Failed to claim NFT rewards');
      }
    } catch (error) {
      console.error('Error claiming NFT rewards:', error);
      toast.error('Failed to claim NFT rewards. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Claim token rewards only
  const handleClaimTokenRewards = async () => {
    const minClaimableAmount = 0.01;
    
    if (stakingSummary.token_pending_rewards < minClaimableAmount) {
      toast.error(`Minimum ${minClaimableAmount} NEFT required for token rewards. Current: ${stakingSummary.token_pending_rewards.toFixed(8)} NEFT`);
      return;
    }

    setIsClaiming(true);

    try {
      const result = await offChainStakingService.claimTokenRewards(walletAddress!);

      if (result.success) {
        await loadBalanceData();
        loadStakingData(); // No await - runs in background
        window.dispatchEvent(new CustomEvent('token-rewards-claimed'));
        toast.success(`Successfully claimed ${result.data?.token_rewards_claimed || stakingSummary.token_pending_rewards.toFixed(4)} NEFT from token rewards!`);
        launchConfetti();
      } else {
        toast.error(result.message || 'Failed to claim token rewards');
      }
    } catch (error) {
      console.error('Error claiming token rewards:', error);
      toast.error('Failed to claim token rewards. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };


  // Enhanced claim all rewards functionality with proper validation
  const handleClaimAllRewards = async () => {
    const minClaimableAmount = 0.01;
    if (stakingSummary.total_pending_rewards < minClaimableAmount) {
      toast.error(`Minimum ${minClaimableAmount} NEFT required to claim rewards. Current: ${stakingSummary.total_pending_rewards.toFixed(8)} NEFT`);
      return;
    }

    setIsClaiming(true);

    try {
      const result = await offChainStakingService.claimRewards(walletAddress!);

      if (result.success) {
        await loadStakingData();
        window.dispatchEvent(new CustomEvent('rewards-claimed'));

        toast.success(`Successfully claimed ${result.data?.total_claimed || stakingSummary.total_pending_rewards.toFixed(2)} NEFT from all staking rewards!`);
        launchConfetti();
      } else {
        toast.error(result.message || 'Failed to claim all rewards');
      }
    } catch (error) {
      console.error('Error claiming all rewards:', error);
      toast.error('Failed to claim all rewards. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle token unstaking functionality - OPTIMIZED
  const handleUnstakeTokens = async () => {
    if (stakingSummary.staked_tokens_amount === 0) {
      toast.error('No staked tokens found. You need to stake tokens first.');
      return;
    }

    if (!tokenAmount || Number(tokenAmount) <= 0) {
      toast.error('Please enter a valid unstake amount.');
      return;
    }

    const unstakeAmountNum = Number(tokenAmount);
    if (unstakeAmountNum > stakingSummary.staked_tokens_amount) {
      toast.error(`Cannot unstake more than your staked amount (${stakingSummary.staked_tokens_amount} NEFT).`);
      return;
    }

    setIsUnstaking(true);
    setLastUnstakedAmount(unstakeAmountNum);

    // OPTIMISTIC UPDATE: Update UI immediately for better UX
    const originalAvailableNEFT = availableNEFT;
    const originalStakedAmount = stakingSummary.staked_tokens_amount;
    const originalDailyRewards = stakingSummary.daily_token_rewards;
    
    // Update UI optimistically
    setAvailableNEFT(prev => prev + unstakeAmountNum);
    setStakingSummary(prev => ({
      ...prev,
      staked_tokens_amount: prev.staked_tokens_amount - unstakeAmountNum,
      daily_token_rewards: Math.max(0, prev.daily_token_rewards - ((unstakeAmountNum * 20 / 100) / 365))
    }));

    try {
      // Get staked tokens data for ID (simplified - no complex validation)
      const stakedTokens = await offChainStakingService.getStakedTokens(walletAddress!);
      
      if (!stakedTokens || stakedTokens.length === 0) {
        // Revert optimistic updates
        setAvailableNEFT(originalAvailableNEFT);
        setStakingSummary(prev => ({
          ...prev,
          staked_tokens_amount: originalStakedAmount,
          daily_token_rewards: originalDailyRewards
        }));
        toast.error('No staked tokens found. Please refresh and try again.');
        return;
      }

      // Use the first available staking position (simplified logic)
      const selectedStaking = stakedTokens[0];

      // Call the unstakeTokens method with partial amount support
      const result = await offChainStakingService.unstakeTokens(
        walletAddress!,
        selectedStaking.id,
        unstakeAmountNum
      );

      if (result.success) {
        // SUCCESS: Keep optimistic updates and clear input
        setTokenAmount("");
        
        // Background operations (non-blocking)
        Promise.all([
          // Emit balance update events
          userBalanceService.emitBalanceUpdateEvent(walletAddress!),
          // Notify MainNav to refresh balances
          new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('tokens-unstaked'));
            resolve(true);
          })
        ]).catch(console.error);

        setTokenUnstakeModalStep(2);
        launchConfetti();
        toast.success(result.message || `Successfully unstaked ${unstakeAmountNum} NEFT`);
      } else {
        // FAILURE: Revert optimistic updates
        setAvailableNEFT(originalAvailableNEFT);
        setStakingSummary(prev => ({
          ...prev,
          staked_tokens_amount: originalStakedAmount,
          daily_token_rewards: originalDailyRewards
        }));
        toast.error(result.message || 'Failed to unstake tokens');
      }
    } catch (error) {
      console.error('Error unstaking tokens:', error);
      
      // FAILURE: Revert optimistic updates
      setAvailableNEFT(originalAvailableNEFT);
      setStakingSummary(prev => ({
        ...prev,
        staked_tokens_amount: originalStakedAmount,
        daily_token_rewards: originalDailyRewards
      }));
      toast.error('Failed to unstake tokens. Please try again.');
    } finally {
      setIsUnstaking(false);
    }
  };

  // Helper functions to check NFT states
  const hasStakedNFTs = selectedNFTs.some(nft => nft.isStaked);
  const hasUnstakedNFTs = selectedNFTs.some(nft => !nft.isStaked);
  const allSelectedNFTsStaked = selectedNFTs.length > 0 && selectedNFTs.every(nft => nft.isStaked);
  const allSelectedNFTsUnstaked = selectedNFTs.length > 0 && selectedNFTs.every(nft => !nft.isStaked);

  // Helper function to format time remaining
  const formatTimeRemaining = (milliseconds: number): string => {
    if (milliseconds <= 0) return "Ready to claim!";
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Tooltip text for NFT cards
  const getTooltipText = (nft: any) => {
    const dailyReward = nft.dailyReward || offChainStakingService.getDailyRewardForRarity(nft.rarity);
    return `Earns ${dailyReward} NEFT/day | Unstake anytime`;
  };

  const getFilteredNFTs = () => {
    // Use NFT context data instead of local state
    let filtered = allNFTs; // All NFTs are now either offchain or onchain
    // let filtered = nfts;
    if (selectedFilter !== "All") {
      filtered = filtered.filter((nft) => nft.rarity === selectedFilter);
    }
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (nft) =>
          nft.name.toLowerCase().includes(query) ||
          nft.rarity.toLowerCase().includes(query)
      );
    }
    return filtered;
  };

  const handleSelectNFT = (nft: any) => {
    const isSelected = selectedNFTs.some((selected) => selected.id === nft.id);
    const isStaked = nft.isStaked || nft.id.includes('staked_');
    
    if (isSelected) {
      // Deselect the currently selected NFT
      setSelectedNFTs(selectedNFTs.filter((selected) => selected.id !== nft.id));
      toast.info(`${nft.name} deselected`);
    } else {
      if (selectedNFTs.length >= 1) {
        // Auto-deselect previous NFT and select the new one
        const previousNFT = selectedNFTs[0];
        const previousIsStaked = previousNFT.isStaked || previousNFT.id.includes('staked_');
        setSelectedNFTs([nft]);
        
        if (isStaked) {
          toast.info(`Switched selection to ${nft.name} for unstaking`);
        } else {
          toast.info(`Only 1 NFT can be selected at a time. Switched selection from ${previousNFT.name} to ${nft.name} for staking`);
        }
      } else {
        // Select the NFT (first selection)
        setSelectedNFTs([nft]);
        
        if (isStaked) {
          toast.success(`${nft.name} selected for unstaking`);
        } else {
          toast.success(`${nft.name} selected for staking`);
        }
      }
    }
  };

  const handleStakeTokens = async () => {
    if (!tokenAmount || Number(tokenAmount) <= 0) return;

    const stakeAmount = Number(tokenAmount);
    
    // OPTIMISTIC UPDATE: Update UI immediately for better UX
    const originalAvailableNEFT = availableNEFT;
    const originalStakedAmount = stakingSummary.staked_tokens_amount;
    
    // Update UI optimistically
    setAvailableNEFT(prev => prev - stakeAmount);
    setStakingSummary(prev => ({
      ...prev,
      staked_tokens_amount: prev.staked_tokens_amount + stakeAmount,
      daily_token_rewards: prev.daily_token_rewards + ((stakeAmount * 20 / 100) / 365)
    }));

    try {
      const result = await offChainStakingService.stakeTokens(walletAddress!, stakeAmount);

      if (result.success) {
        // SUCCESS: Keep optimistic updates and clear input
        setTokenAmount("");

        // Background operations (non-blocking)
        Promise.all([
          userBalanceService.emitBalanceUpdateEvent(walletAddress!),
          new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('tokens-staked'));
            resolve(true);
          })
        ]).catch(console.error);

        toast.success(result.message);
      } else {
        // FAILURE: Revert optimistic updates
        setAvailableNEFT(originalAvailableNEFT);
        setStakingSummary(prev => ({
          ...prev,
          staked_tokens_amount: originalStakedAmount,
          daily_token_rewards: prev.daily_token_rewards - ((stakeAmount * 20 / 100) / 365)
        }));
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error staking tokens:', error);
      
      // FAILURE: Revert optimistic updates
      setAvailableNEFT(originalAvailableNEFT);
      setStakingSummary(prev => ({
        ...prev,
        staked_tokens_amount: originalStakedAmount,
        daily_token_rewards: prev.daily_token_rewards - ((stakeAmount * 20 / 100) / 365)
      }));
      toast.error('Failed to stake tokens. Please try again.');
    }
  };



  // Calculate estimated daily rewards for NEFT token staking
  const estimatedTokenDailyReward = tokenAmount && Number(tokenAmount) > 0
    ? ((Number(tokenAmount) * tokenAPR / 100) / 365).toFixed(2)
    : "0.00";

  // Open token stake modal
  const openTokenStakeModal = () => {
    setTokenStakeModalStep(1);
    setIsTokenStakeModalOpen(true);
  };
  // Close token stake modal
  const closeTokenStakeModal = () => {
    setIsTokenStakeModalOpen(false);
    setTokenStakeModalStep(1);
    setIsTokenStaking(false);
  };
  // Open/Close token UNSTAKE modal
  const openTokenUnstakeModal = () => {
    setTokenUnstakeModalStep(1);
    setIsTokenUnstakeModalOpen(true);
  };
  const closeTokenUnstakeModal = () => {
    setIsTokenUnstakeModalOpen(false);
    setTokenUnstakeModalStep(1);
    setIsUnstaking(false);
  };
  // Confirm token stake with backend integration - OPTIMIZED
  const handleConfirmTokenStake = async () => {
    if (!tokenAmount || Number(tokenAmount) <= 0) return;

    const stakeAmount = Number(tokenAmount);
    setIsTokenStaking(true);
    setLastStakedAmount(stakeAmount);

    // OPTIMISTIC UPDATE: Update UI immediately for better UX
    const originalAvailableNEFT = availableNEFT;
    const originalStakedAmount = stakingSummary.staked_tokens_amount;
    
    // Update UI optimistically
    setAvailableNEFT(prev => prev - stakeAmount);
    setStakingSummary(prev => ({
      ...prev,
      staked_tokens_amount: prev.staked_tokens_amount + stakeAmount,
      daily_token_rewards: prev.daily_token_rewards + ((stakeAmount * 20 / 100) / 365)
    }));

    try {
      const result = await offChainStakingService.stakeTokens(walletAddress!, stakeAmount);

      if (result.success) {
        // SUCCESS: Keep optimistic updates and clear input
        setTokenAmount("");
        
        // Background operations (non-blocking)
        Promise.all([
          // Emit balance update events
          userBalanceService.emitBalanceUpdateEvent(walletAddress!),
          // Notify MainNav to refresh balances
          new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('tokens-staked'));
            resolve(true);
          })
        ]).catch(console.error);

        setTokenStakeModalStep(2);
        launchConfetti();
        toast.success(result.message);
      } else {
        // FAILURE: Revert optimistic updates
        setAvailableNEFT(originalAvailableNEFT);
        setStakingSummary(prev => ({
          ...prev,
          staked_tokens_amount: originalStakedAmount,
          daily_token_rewards: prev.daily_token_rewards - ((stakeAmount * 20 / 100) / 365)
        }));
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error staking tokens:', error);
      
      // FAILURE: Revert optimistic updates
      setAvailableNEFT(originalAvailableNEFT);
      setStakingSummary(prev => ({
        ...prev,
        staked_tokens_amount: originalStakedAmount,
        daily_token_rewards: prev.daily_token_rewards - ((stakeAmount * 20 / 100) / 365)
      }));
      toast.error('Failed to stake tokens. Please try again.');
    } finally {
      setIsTokenStaking(false);
    }
  };

  const launchConfetti = () => {
    const count = 120;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 999999,
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 4,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 0.8,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const renderSidebarContent = () => (
    <div className="bg-[#121021] rounded-xl p-4 sm:p-0">
      <Button
          type="button"
          onClick={() => setShowMobileInfo(!showMobileInfo)}
          aria-pressed={showMobileInfo}
          aria-label={showMobileInfo ? 'Hide staking panel' : 'Show staking panel'}
          className="lg:hidden w-full rounded-md shadow-lg bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-semibold flex items-center gap-2 select-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
        >
          <span className="text-sm">{showMobileInfo ? 'Hide Stake Info' : 'Show Stake Info'}</span>
          <span className={cn('transition-transform', showMobileInfo ? 'rotate-180' : '')}>▲</span>
        </Button>
        <div
          className={cn(
            "flex-1 overflow-y-auto p-4 transition-opacity duration-300 lg:opacity-100 lg:pointer-events-auto max-h-[350px] lg:max-h-none",
            showMobileInfo ? "opacity-100" : "opacity-0 pointer-events-none"
          )} style={{
             WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain"
           }}
        >
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-[#1b1930] mb-4">
        <TabsTrigger value="nfts" className="data-[state=active]:bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)]">Stake NFTs</TabsTrigger>
        <TabsTrigger value="tokens" className="data-[state=active]:bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)]">Stake NEFT</TabsTrigger>
      </TabsList>
      <TabsContent value="nfts" className="space-y-4">
        <div className="mb-2 p-3 rounded-lg bg-[#1b1930] border border-[#2D3748]/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#94A3B8]">Total NFTs</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{getFilteredNFTs().length}</span>
              {(isLoadingNFTsContext || !loadingProgress.onchain) && (
                <div className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-[#5D43EF]" />
                  <span className="text-xs text-[#94A3B8]">Loading onchain...</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between"><span className="text-xs text-[#94A3B8]">Selected</span><span className="text-sm font-bold text-[#5d43ef]/80">{selectedNFTs.length}</span></div>
          
          <div>
            <div className="mb-4 mt-4">
              <h4 className="text-sm font-semibold text-[#5d43ef]/80 mb-2">Selected NFTs</h4>
              {selectedNFTs.length === 0 ? (
                <span className="text-xs text-[#94A3B8]">No NFTs selected</span>
              ) : (
                <ul className="space-y-1">
                  {selectedNFTs.map(nft => (
                    <li key={nft.id} className="flex items-center gap-2 text-xs text-white">
                      <ProgressiveNFTImage 
                          src={nft.image || ''}
                          ipfsHash={nft.ipfs_hash || extractIPFSHash(nft.image || '') || undefined}
                          alt={nft.name} className="w-6 h-6 rounded" />
                      <span>{nft.name}</span>
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-[#23272f]">{nft.rarity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        
        {/* Approval Status Indicator for Onchain Staking - Only show if onchain NFTs selected */}
        {/* {isOnChainAvailable && selectedNFTs.some(nft => nft.status === 'onchain') && (
          <div className="flex items-center justify-center mt-3 mb-2">
            {isCheckingApproval ? (
              <div className="flex items-center text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Checking approval status...
              </div>
            ) : isApproved ? (
              <div className="flex items-center text-sm text-green-400">
                <Check className="w-4 h-4 mr-2" />
                Contract approved for onchain staking
              </div>
            ) : (
              <div className="flex items-center text-sm text-yellow-400">
                <Lock className="w-4 h-4 mr-2" />
                Approval required for onchain staking
              </div>
            )}
          </div>
        )} */}

        <div className="flex gap-2 justify-center mt-2">
          <Button
            className="w-full bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)] text-white font-bold py-2 rounded-lg flex items-center justify-center"
            disabled={selectedNFTs.length === 0 || !allSelectedNFTsUnstaked}
            onClick={openStakeModal}
          >
            Stake NFT
          </Button>
          <Button
            className="w-full bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)] text-white font-bold py-2 rounded-lg flex items-center justify-center"
            disabled={selectedNFTs.length === 0 || !allSelectedNFTsStaked || isUnstaking}
            onClick={openUnstakeModal}
          >
            {isUnstaking ? (
              <span className="flex items-center"><CoinsIcon className="w-5 h-5 animate-bounce mr-2" />Unstaking...</span>
            ) : (
              <>Unstake NFT</>
            )}
          </Button>
        </div>
        <div className="mb-2 p-3 rounded-lg bg-[#1b1930] border border-[#2D3748]/40 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2 font-semibold text-white">Your Staked NFT</div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Staked NFT</span><span className="font-medium">{stakedNFTs.length} NFT</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Daily Rewards</span><span className="text-[#5d43ef]">{calculateOptimisticDailyRewards().toFixed(2)} NEFT</span></div>
          {/* Always show pending rewards section for staked NFTs */}
          {stakedNFTs.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Pending Rewards</span>
              {stakingSummary.nft_pending_rewards > 0 ? (
                <span className="text-[#5d43ef]">{stakingSummary.nft_pending_rewards.toFixed(4)} NEFT</span>
              ) : (
                <span className="text-gray-500">No rewards yet - rewards generate daily</span>
              )}
            </div>
          )}
          {timeUntilNextClaim.nft > 0 && (
            <div className="flex justify-between text-sm"><span className="text-gray-400">Next Claim In</span><span className="text-yellow-400 flex items-center"><Clock className="w-3 h-3 mr-1" />{formatTimeRemaining(timeUntilNextClaim.nft)}</span></div>
          )}
          
          <div className="flex gap-2 mt-2">
            <Button
              className="flex-1 bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleClaimNFTRewards}
              disabled={stakingSummary.nft_pending_rewards <= 0.01 || isLoadingStaking || isClaiming}
            >
              {isLoadingStaking ? 'Loading...' : 
               isClaiming ? 'Claiming...' :
               stakingSummary.nft_pending_rewards > 0.01 ? `Claim ${stakingSummary.nft_pending_rewards.toFixed(4)} NEFT` : 
               'No NFT Rewards Available'}
            </Button>
          </div>
        </div>
        <div className="mt-6 p-4 rounded-xl bg-[#1b1930] border border-[#2D3748]/40 shadow-lg flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-[#5d43ef]" />Reward Preview</div>
          <div className="flex justify-between gap-2 text-sm"><span className="text-gray-400">Common NFT</span><span className="text-[#5d43ef]">0.1 NEFT/day</span></div>
          <div className="flex justify-between gap-2 text-sm"><span className="text-gray-400">Rare NFT</span><span className="text-[#5d43ef]">0.4 NEFT/day</span></div>
          <div className="flex justify-between gap-2 text-sm"><span className="text-gray-400">Legendary NFT</span><span className="text-[#5d43ef]">1.0 NEFT/day</span></div>
          <div className="flex justify-between gap-2 text-sm"><span className="text-gray-400">Platinum NFT</span><span className="text-[#5d43ef]">2.5 NEFT/day</span></div>
          <div className="flex justify-between gap-2 text-sm"><span className="text-gray-400">Silver NFT</span><span className="text-[#5d43ef]">8 NEFT/day</span></div>
          <div className="flex justify-between gap-2 text-sm"><span className="text-gray-400">Gold NFT</span><span className="text-[#5d43ef]">30 NEFT/day</span></div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1"><CoinsIcon className="w-5 h-5 text-[#5d43ef]" /><span className="text-base font-bold text-white">How Staking Works</span></div>
          <p className="text-xs text-[#94A3B8] leading-relaxed mb-1">Stake your NEFT tokens or NFTs to earn daily rewards and grow your loyalty status. Rewards are calculated daily and can be claimed anytime.</p>
        </div>
      </TabsContent>
      <TabsContent value="tokens" className="space-y-4">
        <div className="mb-2 p-3 rounded-lg bg-[#1b1930] border border-[#2D3748]/40 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2 font-semibold text-white"><TrendingUp className="w-5 h-5 text-blue-500" />Token Staking</div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Available NEFT</span>
            {isLoadingBalance ? (
              <div className="animate-pulse bg-gray-600/50 h-6 w-16 rounded"></div>
            ) : (
              <span className="text-xl font-bold">{availableNEFT}</span>
            )}
          </div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Current APR</span><span className="text-xl font-bold text-[#5d43ef]">{tokenAPR}%</span></div>
          <div className="space-y-2 mt-2">
            <label className="text-sm text-gray-400">Amount</label>
            <input type="number" placeholder="Enter NEFT amount" value={tokenAmount} onChange={e => setTokenAmount(e.target.value)} className="bg-[#1b1930] border border-gray-600 rounded px-3 py-2 w-full text-white" />
          </div>

          <div className="flex gap-2 justify-center mt-2">
            <Button className="flex-1 bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)]" onClick={openTokenStakeModal} disabled={!tokenAmount || Number(tokenAmount) <= 0 || Number(tokenAmount) > availableNEFT}>Stake Tokens</Button>
            <Button className="flex-1 bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)]" onClick={openTokenUnstakeModal} disabled={stakingSummary.staked_tokens_amount === 0 || !tokenAmount || Number(tokenAmount) <= 0 || Number(tokenAmount) > stakingSummary.staked_tokens_amount || isUnstaking}>
              {isUnstaking ? (
                <span className="flex items-center"><CoinsIcon className="w-5 h-5 animate-bounce mr-2" />Unstaking...</span>
              ) : (
                <>Unstake Tokens</>
              )}
            </Button>
          </div>
        </div>
        <div className="mb-2 p-3 rounded-lg bg-[#1b1930] border border-[#2D3748]/40 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2 font-semibold text-white">Your Staked Tokens</div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Staked Amount</span>
            {isLoadingBalance ? (
              <div className="animate-pulse bg-gray-600/50 h-5 w-20 rounded"></div>
            ) : (
              <span className="font-medium">{(userBalance?.staked_neft || stakingSummary.staked_tokens_amount).toLocaleString()} NEFT</span>
            )}
          </div>

          <div className="flex justify-between text-sm"><span className="text-gray-400">Daily Rewards</span><span className="text-[#5d43ef]">{stakingSummary.daily_token_rewards.toFixed(2)} NEFT</span></div>
          
          {/* Only show pending rewards if there are actual rewards */}
          {stakingSummary.token_pending_rewards > 0 && (
            <div className="flex justify-between text-sm"><span className="text-gray-400">Pending Rewards</span><span className="text-[#5d43ef]">{stakingSummary.token_pending_rewards.toFixed(4)} NEFT</span></div>
          )}
          {stakingSummary.token_pending_rewards === 0 && stakingSummary.staked_tokens_amount > 0 && (
            <div className="flex justify-between text-sm"><span className="text-gray-400">Pending Rewards</span><span className="text-gray-500">No rewards yet - rewards generate daily</span></div>
          )}
          {timeUntilNextClaim.token > 0 && (
            <div className="flex justify-between text-sm"><span className="text-gray-400">Next Claim In</span><span className="text-yellow-400 flex items-center"><Clock className="w-3 h-3 mr-1" />{formatTimeRemaining(timeUntilNextClaim.token)}</span></div>
          )}
          
          <div className="flex gap-2 mt-2">
            <Button
              className="flex-1 bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleClaimTokenRewards}
              disabled={stakingSummary.token_pending_rewards <= 0.01 || isLoadingStaking || isClaiming}
            >
              {isLoadingStaking ? 'Loading...' : 
               isClaiming ? 'Claiming...' :
               stakingSummary.token_pending_rewards > 0.01 ? `Claim ${stakingSummary.token_pending_rewards.toFixed(4)} NEFT` : 
               'No Token Rewards Available'}
            </Button>
          </div>
        </div>
        <div className="mt-6 p-4 rounded-xl bg-[#1b1930] border border-[#2D3748]/40 shadow-lg flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 mb-1"><CoinsIcon className="w-5 h-5 text-[#5d43ef]" /><span className="text-base font-bold text-white">How Staking Works</span></div>
          <p className="text-xs text-[#94A3B8] leading-relaxed mb-1">Stake your NEFT tokens or NFTs to earn daily rewards and grow your loyalty status. Rewards are calculated daily and can be claimed anytime.</p>
        </div>
      </TabsContent>
    </Tabs>
    </div>
  </div> 

  )

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#0b0a14] font-sora">
  <div className="fixed inset-0 bg-[#0b0a14]" />
  <MainNav />
  <main className="container relative mx-auto px-3 sm:px-4 md:px-6 pt-0 mt-0 pb-10 md:pb-16 space-y-4 md:space-y-6">
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start gap-6 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2 text-left">Stake NFTs</h1>
            <p className="text-sm sm:text-base text-[#94A3B8] max-w-2xl text-left">
              Stake your NFTs to earn daily NEFT rewards and boost your loyalty status.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-white">
              Your Collection ({getFilteredNFTs().length} NFTs)
              {/* {(isLoadingNFTsContext || !loadingProgress.onchain) && (
                <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading your on-chain NFTs… This may take a few moments. Please ensure your wallet is connected.
                </span>
              )} */}
            </h2>
          </div>
          
          {/* STREAMING LOADING INDICATOR */}
          {isLoadingMore && (
            <div className="mb-4 flex items-center justify-center p-3 bg-[#0B0A14]/50 border border-[#5d43ef]/20 rounded-xl">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <div className="w-4 h-4 border-2 border-[#5d43ef] border-t-transparent rounded-full animate-spin"></div>
                Loading more NFTs...
              </div>
            </div>
          )}
          <div className={getFilteredNFTs().length === 0 && !isLoadingNFTsContext ? "flex justify-center mt-32" : "grid grid-cols-2 md:grid-cols-3 gap-6"}>
                {isLoadingNFTsContext && (
                  // Loading state
                  Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="relative rounded-2xl bg-[#0B0A14] border border-[#5d43ef]/30 shadow-lg backdrop-blur-xl p-0 flex flex-col items-stretch animate-pulse">
                      <div className="relative w-full aspect-square bg-gray-700 rounded-t-2xl"></div>
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))

                )} 
                    {getFilteredNFTs().length === 0 && !isLoadingNFTsContext && (
                  <div className="text-center">
                              <div className="w-24 h-24 bg-[#5d43ef]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg
                                  className="w-12 h-12 text-[#5d43ef]"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                              <h3 className="text-xl font-medium text-white mb-2">
                                No NFTs Yet
                              </h3>
                              <p className="text-gray-400">
                                Complete your first campaign to unlock your first NFT!
                              </p>
                            </div>
                    )}
                    
                    {getFilteredNFTs().length > 0 && !isLoadingNFTsContext && (
                      getFilteredNFTs().map((nft) => {
                      const isSelected = selectedNFTs.some(sel => sel.id === nft.id);
                      const isStaked = nft.isStaked;
                      return (
                        <Tooltip key={nft.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "relative rounded-2xl bg-[#0B0A14] border border-[#5d43ef] shadow-lg backdrop-blur-xl p-0 flex flex-col items-stretch transition-transform group hover:scale-[1.025] hover:shadow-2xl cursor-pointer",
                                isSelected ? "ring-2 ring-[#0b0a14] border-[#5d43ef] border-[3px]" : ""
                              )}
                              onClick={() => handleSelectNFT(nft)}
                            >
                              {/* NFT Image fills card */}
                              <div className="relative w-full aspect-square bg-[#0B0A14] rounded-t-2xl overflow-hidden flex items-center justify-center">
                                <ProgressiveNFTImage 
                                  src={nft.image || ''}
                                  ipfsHash={nft.ipfs_hash || extractIPFSHash(nft.image || '') || undefined}
                                  alt={nft.name} 
                                  className={`w-full h-full object-cover transition-transform duration-300 ${!isStaked && "group-hover:scale-105"}`} 
                                />

                                {/* Staked Lock Overlay - Same as MyNFTs */}
                                {isStaked && (
                                  <div className="absolute inset-0 bg-gradient-to-br from-[#5d43ef]/80 via-[#5d43ef]/60 to-[#0b0a14]/80 flex items-center justify-center backdrop-blur-sm">
                                    <div className="bg-gradient-to-r from-[#5d43ef] to-[#a7acec] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg border border-white/20">
                                      <Lock className="w-4 h-4" />
                                      STAKED
                                    </div>
                                  </div>
                                )}

                                {/* Status Badge */}
                                <div className="absolute top-2 left-2 z-10">
                                  {/* Chain Status Badge Only */}
                                  {nft.status === 'offchain' ? (
                                    <div className="bg-purple-900/80 text-purple-300 rounded-full px-3 py-1 text-xs font-medium cursor-default">
                                      Offchain
                                    </div>
                                  ) : (
                                    <div className="bg-emerald-900/80 text-emerald-300 rounded-full px-3 py-1 text-xs font-medium cursor-default">
                                      Onchain
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* NFT Info */}
                              <div className="flex-1 flex flex-col justify-between py-2 lg:py-4 px-[5px]">
                                <div className="mb-2 flex flex-col items-center justify-center lg:flex-row lg:justify-between gap-2 sm:gap-0">
                                  <div className="text-sm sm:text-base font-bold text-white text-center sm:text-left">{nft.name}</div>
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={cn('px-3 py-1 rounded-xl text-xs font-bold shadow', getRarityStyles(nft.rarity).bg, getRarityStyles(nft.rarity).text)}>{nft.rarity}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent variant="glass">{getTooltipText(nft)}</TooltipContent>
                        </Tooltip>
                      );
                    })
                    )}
              </div>
              </div>
              <aside className="hidden lg:block w-full lg:w-80 flex-shrink-0 mt-0 lg:mt-[52px]">
                {renderSidebarContent()}
              </aside>
              
              <div className={cn(
                  "lg:hidden fixed bottom-0 left-0 w-full z-50 transition-all duration-500 ease-in-out bg-[#121021] rounded-t-xl shadow-xl overflow-hidden",
                  showMobileInfo ? "h-[400px]" : "h-[60px]" // collapsed = only button visible
                )}>
                  {renderSidebarContent()}
                </div>
              </div>
          </div>


        </main>
        {/* Staking Modal (NFT) */}
        <Dialog open={isStakeModalOpen} onOpenChange={setIsStakeModalOpen}>
          <DialogContent variant="glass" className="max-w-lg w-full p-0 overflow-visible">
            {stakeModalStep === 1 && (
              <div className="p-6 pt-8 sm:p-8 flex flex-col items-center bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
                <DialogHeader className="w-full mb-4">
                  <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Stake these NFTs?</DialogTitle>
                  <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                    You’re staking these NFTs to earn daily NEFT rewards and unlock loyalty benefits.
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full flex flex-wrap justify-center gap-3 mb-4 sm:mb-6">
                  {selectedNFTs.map((nft) => (
                    <div key={nft.id} className="flex flex-col items-center">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-[#5d43ef] bg-[#181a20]">
                        <ProgressiveNFTImage 
                          src={nft.image || ''}
                          ipfsHash={nft.ipfs_hash || extractIPFSHash(nft.image || '') || undefined}
                          alt={nft.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="mt-1 text-xs text-white font-sora">{nft.name}</span>
                    </div>
                  ))}
                </div>
                <div className="w-full flex flex-col items-center mb-6">
                  <div className="text-base font-sora text-white font-semibold mb-2">Rewards</div>
                  <div className="text-sm font-sora text-indigo-300 bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#5d43ef]/40">
                    You’ll earn {totalDailyReward} NEFT/day ({selectedNFTs.map(nft => `${nft.dailyReward}`).join(' + ')})
                  </div>
                </div>
                <DialogFooter>
                  {/* Show approval button ONLY for onchain NFTs if not approved */}
                  {isOnChainAvailable && !isApproved && !isCheckingApproval && selectedNFTs.some(nft => nft.status === 'onchain') ? (
                    <div className="w-full flex flex-col items-center space-y-3">
                      <div className="text-sm text-[#5d43ef] text-center mb-2">
                        First-time onchain staking requires approval
                      </div>
                      <Button
                        className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                        onClick={handleApproveStaking}
                        disabled={isApproving}
                      >
                        {isApproving ? (
                          <span className="flex items-center"><Loader2 className="w-5 h-5 animate-spin mr-2" />Approving...</span>
                        ) : (
                          <span className="flex items-center">Approve Contract</span>
                        )}
                      </Button>
                      <div className="text-xs text-gray-400 text-center">
                        This is a one-time approval for all future onchain staking
                      </div>
                    </div>
                  ) : (
                    /* Show stake button if approved or checking approval */
                    <Button
                      className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                      onClick={handleStakeNFTs}
                      disabled={isStaking || isCheckingApproval}
                    >
                      {isCheckingApproval ? (
                        <span className="flex items-center"><Loader2 className="w-5 h-5 animate-spin mr-2" />Checking...</span>
                      ) : isStaking ? (
                        <span className="flex items-center"><CoinsIcon className="w-5 h-5 animate-bounce mr-2" />Staking...</span>
                      ) : (
                        <span className="flex items-center">
                          {isApproved && isOnChainAvailable && <Check className="w-4 h-4 mr-2 text-white"/>}
                          Confirm Stake
                        </span>
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )}
            {stakeModalStep === 2 && (
              <div className="p-6 pt-8 sm:p-8 flex flex-col items-center bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
                <DialogHeader className="w-full">
                  <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Staked Successfully!</DialogTitle>
                  <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                    Congrats! Your NFTs are now earning rewards 🎉
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full flex flex-wrap justify-center gap-3 mb-4 sm:mb-6">
                  {selectedNFTs.map((nft) => (
                    <div key={nft.id} className="flex flex-col items-center">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-green-400 bg-[#181a20] flex items-center justify-center relative">
                        <ProgressiveNFTImage 
                          src={nft.image || ''}
                          ipfsHash={nft.ipfs_hash || extractIPFSHash(nft.image || '') || undefined}
                          alt={nft.name} className="w-full h-full object-cover opacity-80" />
                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold bg-green-900 text-green-400">Staked</span>
                      </div>
                      <span className="mt-1 text-xs text-white font-sora">{nft.name}</span>
                    </div>
                  ))}
                </div>
                <div className="w-full flex flex-col items-center mb-6">
                  <div className="text-base font-sora text-white font-semibold mb-1">Earnings Preview</div>
                  <div className="text-sm font-sora text-indigo-300 bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#5d43ef]/40 mb-2">
                    Expected Daily Earnings: {totalDailyReward} NEFT<br />Next Claim: 24h later
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                    onClick={closeStakeModal}
                  >
                    Back to Collection
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Token Unstake Modal */}
        <Dialog open={isTokenUnstakeModalOpen} onOpenChange={setIsTokenUnstakeModalOpen}>
          <DialogContent variant="glass" className="max-w-lg w-full p-0 overflow-visible">
            {tokenUnstakeModalStep === 1 && (
              <div className="p-6 pt-8 sm:p-8 flex flex-col items-center bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
                <DialogHeader className="w-full mb-4">
                  <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Confirm NEFT Unstake</DialogTitle>
                  <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                    You're about to unstake <span className="text-[#a7acec] font-bold">{Number(tokenAmount) || 0} NEFT</span> from your staked balance.
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full flex flex-col gap-3 mb-6">
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#5d43ef]/40">
                    <span className="text-sm text-white font-sora">Currently Staked</span>
                    <span className="text-sm text-indigo-300 font-bold font-sora">{stakingSummary.staked_tokens_amount.toLocaleString()} NEFT</span>
                  </div>
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#5d43ef]/40">
                    <span className="text-sm text-white font-sora">Remaining After Unstake</span>
                    <span className="text-sm text-indigo-300 font-bold font-sora">{Math.max(0, stakingSummary.staked_tokens_amount - (Number(tokenAmount) || 0)).toLocaleString()} NEFT</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                    onClick={handleUnstakeTokens}
                    disabled={isUnstaking || !tokenAmount || Number(tokenAmount) <= 0 || Number(tokenAmount) > stakingSummary.staked_tokens_amount}
                  >
                    {isUnstaking ? (
                      <span className="flex items-center"><CoinsIcon className="w-5 h-5 animate-bounce mr-2" />Unstaking...</span>
                    ) : (
                      <>Confirm Unstake</>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
            {tokenUnstakeModalStep === 2 && (
              <div className="p-6 pt-8 sm:p-8 flex flex-col items-center bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
                <DialogHeader className="w-full mb-4">
                  <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Unstaked Successfully!</DialogTitle>
                  <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                    <span className="text-white font-bold">You’ve unstaked: {lastUnstakedAmount} NEFT</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full flex items-center justify-center mt-2 mb-4">
                  <span className="inline-block bg-gradient-to-r from-[#5d43ef] to-[#a7acec] text-white font-bold px-4 py-2 rounded-full text-base shadow">Tokens returned to your balance</span>
                </div>
                <DialogFooter>
                  <Button
                    className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                    onClick={closeTokenUnstakeModal}
                  >
                    View My Balance
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Unstake Modal (NFT) */}
        <Dialog open={isUnstakeModalOpen} onOpenChange={setIsUnstakeModalOpen}>
          <DialogContent variant="glass" className="max-w-lg w-full p-0 overflow-visible">
            {unstakeModalStep === 1 && (
              <div className="p-6 pt-8 sm:p-8 flex flex-col items-center bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
                <DialogHeader className="w-full mb-4">
                  <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Unstake these NFTs?</DialogTitle>
                  <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                    You’re about to unstake your NFTs. You will stop earning daily rewards immediately.
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full flex flex-wrap justify-center gap-3 mb-4 sm:mb-6">
                  {selectedNFTs.map((nft) => (
                    <div key={nft.id} className="flex flex-col items-center">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-[#5d43ef] bg-[#181a20]">
                        <ProgressiveNFTImage 
                          src={nft.image || ''}
                          ipfsHash={nft.ipfs_hash || extractIPFSHash(nft.image || '') || undefined}
                          alt={nft.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="mt-1 text-xs text-white font-sora">{nft.name}</span>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                    onClick={handleUnstakeNFTs}
                    disabled={isUnstaking}
                  >
                    {isUnstaking ? (
                      <span className="flex items-center"><CoinsIcon className="w-5 h-5 animate-bounce mr-2" />Unstaking...</span>
                    ) : (
                      <>Confirm Unstake</>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
            {unstakeModalStep === 2 && (
              <div className="p-6 pt-8 sm:p-8 flex flex-col items-center bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
                <DialogHeader className="w-full">
                  <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Unstaked Successfully!</DialogTitle>
                  <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                    Your NFT is now unstaked. You can stake again anytime.
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full flex flex-wrap justify-center gap-3 mb-4 sm:mb-6">
                  {selectedNFTs.map((nft) => (
                    <div key={nft.id} className="flex flex-col items-center">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-yellow-400 bg-[#181a20] flex items-center justify-center relative">
                        <ProgressiveNFTImage 
                          src={nft.image || ''}
                          ipfsHash={nft.ipfs_hash || extractIPFSHash(nft.image || '') || undefined}
                          alt={nft.name} className="w-full h-full object-cover opacity-80" />
                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-900 text-yellow-400">Unstaked</span>
                      </div>
                      <span className="mt-1 text-xs text-white font-sora">{nft.name}</span>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                    onClick={closeUnstakeModal}
                  >
                    Back to Collection
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>  
        </Dialog>
        {/* Token Staking Modal */}
        <Dialog open={isTokenStakeModalOpen} onOpenChange={setIsTokenStakeModalOpen}>
          <DialogContent variant="glass" className="max-w-lg w-full p-0 overflow-visible">
            {tokenStakeModalStep === 1 && (
              <div className="p-6 pt-8 sm:p-8 flex flex-col items-center bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
                <DialogHeader className="w-full mb-4">
                  <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Confirm NEFT Staking</DialogTitle>
                  <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                    You're about to stake <span className="text-[#a7acec] font-bold">{tokenAmount || 0} NEFT</span> at <span className="text-[#5d43ef] font-bold">{tokenAPR}% APR</span>.
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full flex flex-col gap-3 mb-6">
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#5d43ef]/40">
                    <span className="text-sm text-white font-sora">Estimated Daily Rewards</span>
                    <span className="text-sm text-indigo-300 font-bold font-sora">{estimatedTokenDailyReward} NEFT</span>
                  </div>
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#5d43ef]/40">
                    <span className="text-sm text-white font-sora">Unstake Anytime</span>
                    <span className="text-green-400 font-bold text-lg">Yes</span>
                  </div>
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#5d43ef]/40">
                    <span className="text-sm text-white font-sora">Rewards Claimable</span>
                    <span className="text-green-400 font-bold text-lg">Anytime</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                    onClick={handleConfirmTokenStake}
                    disabled={isTokenStaking || !tokenAmount || Number(tokenAmount) <= 0 || Number(tokenAmount) > availableNEFT}
                  >
                    {isTokenStaking ? (
                      <span className="flex items-center"><CoinsIcon className="w-5 h-5 animate-bounce mr-2" />Staking...</span>
                    ) : (
                      <>Confirm Stake</>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
            {tokenStakeModalStep === 2 && (
              <div className="p-6 pt-8 sm:p-8 flex flex-col items-center bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
                <DialogHeader className="w-full mb-4">
                  <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Staked Successfully!</DialogTitle>
                  <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                    <span className="text-white font-bold">You’ve staked: {lastStakedAmount} NEFT</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full flex flex-col gap-3 mb-6">
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-[#5d43ef]/40">
                    <span className="text-sm text-white font-sora">Estimated Daily Rewards</span>
                    <span className="text-sm text-indigo-300 font-bold font-sora">{((lastStakedAmount * tokenAPR / 100) / 365).toFixed(2)} NEFT</span>
                  </div>
                  <div className="flex items-center justify-center mt-4 mb-2">
                    <span className="inline-block bg-gradient-to-r from-[#5d43ef] to-[#a7acec] text-white font-bold px-4 py-2 rounded-full text-base shadow">Welcome to the Loyalty Pool 🚀</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    className="w-[200px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-md"
                    onClick={closeTokenStakeModal}
                  >
                    View My Rewards
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default StakingPage;
