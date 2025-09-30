import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ConfettiButton } from "@/components/magicui/confetti";
import confetti from "canvas-confetti";
import {
  Flame,
  ArrowRight,
  Check,
  Crown,
  Filter,
  X,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
  Grid,
  List,
  SlidersHorizontal,
  Sliders,
  Search,
  Diamond,
  Info,
  Loader2,
  RefreshCw,
  Lock,
  Cloud,
  Link,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import "@/styles/fonts.css";
import { MainNav } from "@/components/layout/MainNav";
import { useAuthState } from "@/hooks/useAuthState";
import { useNFTContext } from "@/contexts/NFTContext";
import { useNFTOperations } from "@/hooks/useNFTOperations";
import { useEnsureNFTsLoaded } from "@/hooks/useEnsureNFTsLoaded";
import optimizedCIDPoolBurnService from "@/services/OptimizedCIDPoolBurnService";
import enhancedHybridBurnService from "@/services/EnhancedHybridBurnService";
import { NFTData } from "@/services/HybridIPFSService";
import { nftLifecycleService, OffchainNFT, OnchainNFT } from "@/services/NFTLifecycleService";
import ProgressiveNFTImage from "@/components/ui/ProgressiveNFTImage";
import { getIPFSUrl, extractIPFSHash } from "@/config/ipfsConfig";
import { getWalletSupabaseClient } from "@/lib/supabaseClientManager";

// Type for NFTs with staking status
interface NFTDataWithStaking extends NFTData {
  isStaked?: boolean;
  status?: 'offchain' | 'onchain' | 'claiming';
}
import campaignRewardsService from "@/services/CampaignRewardsService";
import burnChanceService, { BurnChanceStatus } from "@/services/BurnChanceService";
import onChainBurnService, { GasEstimate } from "@/services/OnChainBurnService";

// Use NFTDataWithStaking from Enhanced IPFS Burn service
type NFT = NFTDataWithStaking;

// Define a BurnStep type to use for the state
type BurnStep = "select" | "confirm" | "burning" | "success" | "complete";

interface BurnRule {
  minRarity: string;
  maxRarity: string;
  requiredAmount: number;
  tier: string;
  resultingNFT: {
    rarity: string;
    tier: string;
    image: string;
    name: string;
  };
}

// Get burn rules from Optimized CID Pool Burn service
const getBurnRules = () => optimizedCIDPoolBurnService.getBurnRules();



const BurnPage = () => {
  // Authentication state
  const { isAuthenticated, walletAddress, isLoading: authLoading } = useAuthState();
  
  // Ensure NFTs are loaded when page mounts
  const { isLoading: nftAutoLoading, hasNFTs } = useEnsureNFTsLoaded();

  // NFT Context - centralized NFT management
  const { 
    allNFTs, 
    availableNFTs, 
    isLoading: isLoadingNFTsContext,
    isInitialized: nftContextInitialized,
    // Streaming loading states
    isLoadingMore,
    hasMoreToLoad,
    loadingProgress
  } = useNFTContext();
  
  // NFT Operations with optimistic updates
  const { burnNFTs } = useNFTOperations();
  

  // UI state (no more local NFT state)
  const [selectedNFTs, setSelectedNFTs] = useState<NFT[]>([]);
  const [burnStep, setBurnStep] = useState<BurnStep>("select");
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [burnProgress, setBurnProgress] = useState(0);
  const controls = useAnimation();
  const [burnChance, setBurnChance] = useState(100);
  const [showStatsPreview, setShowStatsPreview] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nftTab, setNftTab] = useState<'offchain' | 'onchain'>('offchain');
  const [isBurnModalOpen, setIsBurnModalOpen] = useState(false);
  const [burnModalStep, setBurnModalStep] = useState<1 | 2 | 3>(1);
  const [isBurning, setIsBurning] = useState(false);
  const [burnedNFT, setBurnedNFT] = useState<any>(null);
  const [burnChanceData, setBurnChanceData] = useState<BurnChanceStatus | null>(null);
  const [isLoadingBurnChance, setIsLoadingBurnChance] = useState<boolean>(false);
  
  // Hybrid burn system state
  const [burnMethod, setBurnMethod] = useState<'onchain' | 'offchain'>('offchain');
  const [isOnChainAvailable, setIsOnChainAvailable] = useState(false);
  const [isCheckingOnChain, setIsCheckingOnChain] = useState(true);

  // Loading states (removed isLoadingNFTs - using context)
  const [isSeeding, setIsSeeding] = useState(false);

  // IPFS configuration check
  const [ipfsConfigured, setIpfsConfigured] = useState(false);
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
  

  // Check IPFS configuration and on-chain availability on mount
  useEffect(() => {
    setIpfsConfigured(optimizedCIDPoolBurnService.isConfigured());
    checkOnChainAvailability();
  }, []);

  // Check on-chain burning availability
  const checkOnChainAvailability = async () => {
    setIsCheckingOnChain(true);
    try {
      const available = await enhancedHybridBurnService.isOnChainAvailable();
      setIsOnChainAvailable(available);
      console.log('On-chain burning availability:', available);
    } catch (error) {
      console.error('Error checking on-chain availability:', error);
      setIsOnChainAvailable(false);
    } finally {
      setIsCheckingOnChain(false);
    }
  };

  // Load burn chance status when authenticated (NFTs handled by context)
  useEffect(() => {
    if (isAuthenticated && walletAddress && !authLoading && nftContextInitialized) {
      loadBurnChanceStatus();
    }
  }, [isAuthenticated, walletAddress, authLoading, nftContextInitialized]);

  // Refresh quest progress when page gains focus (user might have completed campaigns)
  useEffect(() => {
    const handleFocus = () => {
      if (isAuthenticated && walletAddress && !authLoading) {
        loadBurnChanceStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated, walletAddress, authLoading]);

  // Load burn chance status from database using new burn chance service
  const loadBurnChanceStatus = async () => {
    if (!walletAddress) return;

    setIsLoadingBurnChance(true);
    try {
      console.log(`Loading burn chance status for wallet: ${walletAddress}`);

      // Get burn chance status using the new service
      const status = await burnChanceService.getBurnChanceStatus(walletAddress);
      setBurnChanceData(status);

      console.log(`Burn chance status loaded:`, status);

    } catch (error) {
      console.error('Error loading burn chance status:', error);
      setBurnChanceData(null);
    } finally {
      setIsLoadingBurnChance(false);
    }
  };

  // NFTs are now loaded by NFTContext - no need for separate loading function



  // Social share handler
  const handleShareOnX = () => {
    const message = "🔥 I just forged a Platinum NFT by burning 5 Common NFTs on NEFTIT! #NFT #NEFTIT";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`);
  };

  // Enhanced burning animation with particle effects
  const animateBurning = async () => {
    setBurnStep("burning");
    for (let i = 0; i <= 100; i += 10) {
      setBurnProgress(i);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setBurnStep("success");
  };

  // While isBurning via IPFS flow, simulate progress so UI reflects action
  useEffect(() => {
    let intervalId: number | undefined;
    if (isBurning) {
      setBurnProgress(0);
      intervalId = window.setInterval(() => {
        setBurnProgress((prev) => (prev < 90 ? prev + 5 : prev));
      }, 250);
    } else {
      // reset when not burning
      setBurnProgress(0);
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [isBurning]);

  // Calculate burn success chance
  const calculateBurnChance = (nfts: NFT[]) => {
    if (nfts.length === 0) return 100;
    // Hard-coded success rates for now, can be updated with actual rates from rules
    return 100; // All burns have 100% success rate for now
  };

  // Effect to update burn chance when selected NFTs change
  useEffect(() => {
    setBurnChance(calculateBurnChance(selectedNFTs));
  }, [selectedNFTs]);

  // Enhanced filtered NFTs function to include search (using context NFTs)
  const getFilteredNFTs = () => {
    let filtered = allNFTs;

    // Apply rarity filter
    if (selectedFilter !== "All") {
      filtered = filtered.filter((nft) => nft.rarity === selectedFilter);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (nft) =>
          nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          nft.rarity.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (nft.description && nft.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return filtered;
  };

// ...
  // Handler for selecting an NFT
  const handleSelectNFT = (nft: NFT) => {
    // Prevent selecting staked NFTs
    if (nft.isStaked) {
      toast.error("Cannot select staked NFTs for burning. Unstake the NFT first.");
      return;
    }

    // Check if this NFT is already selected
    const isSelected = selectedNFTs.some((selected) => selected.id === nft.id);

    if (isSelected) {
      // Remove from selection
      setSelectedNFTs(
        selectedNFTs.filter((selected) => selected.id !== nft.id)
      );
    } else {
      // Check we're not exceeding 5 NFTs and they are of the same rarity
      if (selectedNFTs.length < 5) {
        if (
          selectedNFTs.length === 0 ||
          selectedNFTs[0].rarity.toLowerCase() === nft.rarity.toLowerCase()
        ) {
          setSelectedNFTs([...selectedNFTs, nft]);
        } else {
          console.log('🚨 Rarity mismatch detected:', {
            selectedRarity: selectedNFTs[0].rarity,
            newNFTRarity: nft.rarity,
            selectedRarityLower: selectedNFTs[0].rarity.toLowerCase(),
            newNFTRarityLower: nft.rarity.toLowerCase(),
            selectedNFTStatus: selectedNFTs[0].status,
            newNFTStatus: nft.status
          });
          toast.error("You can only select NFTs of the same rarity");
        }
      } else {
        toast.error("You can select up to 5 NFTs");
      }
    }
  };

  // Calculate total burn value
  const getTotalBurnValue = () => {
    if (selectedNFTs.length === 0) return 0;
    return selectedNFTs.reduce((total, nft) => total + nft.burnValue, 0);
  };

  // Get the rule that would apply to the selected NFTs (memoized for performance)
  const applicableRule = useMemo(() => {
    if (selectedNFTs.length === 0) return null;
    
    const burnRules = getBurnRules();
    const rarityGroups = selectedNFTs.reduce((groups, nft) => {
      // Use lowercase to match burn rules format
      const finalRarity = nft.rarity.toLowerCase();
      groups[finalRarity] = (groups[finalRarity] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);

    console.log('🔍 Burn rule detection:', {
      selectedNFTs: selectedNFTs.map(nft => ({ name: nft.name, rarity: nft.rarity })),
      rarityGroups,
      availableBurnRules: burnRules.map(rule => ({ 
        minRarity: rule.minRarity, 
        requiredAmount: rule.requiredAmount, 
        resultingRarity: rule.resultingNFT.rarity 
      }))
    });

    // Find matching burn rule
    const matchingRule = burnRules.find((rule) => {
      const minRarity = rule.minRarity.toLowerCase();
      const rarityCount = rarityGroups[minRarity] || 0;
      // Check exact match and single rarity type
      return rarityCount === rule.requiredAmount && 
             Object.keys(rarityGroups).length === 1 &&
             rarityGroups[minRarity] === rule.requiredAmount;
    });
    
    console.log('🎯 Found matching rule:', matchingRule);
    return matchingRule;
  }, [selectedNFTs]);

  // Get preview of result NFT from CID pool (memoized)
  const [previewResultNFT, setPreviewResultNFT] = useState<any>(null);
  
  // Fetch preview NFT from CID pool when applicable rule changes
  useEffect(() => {
    const fetchPreviewNFT = async () => {
      if (!applicableRule || !walletAddress) {
        setPreviewResultNFT(null);
        return;
      }

      try {
        const rarity = applicableRule.resultingNFT.rarity.toLowerCase();
        console.log('🔍 Fetching preview NFT for rarity:', rarity);
        
        // Get a preview NFT from CID pool (without marking as distributed)
        const { data: cidPoolNFT, error } = await getWalletSupabaseClient(walletAddress)
          .from('nft_cid_pools')
          .select('*')
          .eq('rarity', rarity)
          .eq('is_distributed', false)
          .limit(1)
          .single();

        if (error || !cidPoolNFT) {
          console.log('⚠️ No preview NFT found in CID pool for rarity:', rarity);
          setPreviewResultNFT({
            name: `NEFTIT ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} NFT`,
            rarity: rarity,
            image: null // Will show placeholder
          });
          return;
        }

        // Create preview NFT object
        const previewNFT = {
          name: cidPoolNFT.name || `NEFTIT ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} NFT`,
          description: cidPoolNFT.description || '',
          image: cidPoolNFT.image_url || getIPFSUrl(cidPoolNFT.cid),
          rarity: rarity,
          ipfs_hash: cidPoolNFT.cid,
          metadata_uri: getIPFSUrl(cidPoolNFT.metadata_cid),
          attributes: cidPoolNFT.attributes || []
        };

        console.log('✅ Preview NFT fetched:', previewNFT);
        setPreviewResultNFT(previewNFT);
      } catch (error) {
        console.error('❌ Error fetching preview NFT:', error);
        setPreviewResultNFT(null);
      }
    };

    fetchPreviewNFT();
  }, [applicableRule, walletAddress]);

  // Handle the burn action
  const handleBurn = () => {
    setBurnModalStep(2);
  };

  // Confirm the burn and start animation
  const confirmBurn = () => {
    animateBurning();
  };

  // Execute smart hybrid burn using NFT operations hook
  const handleBurnNFTs = async () => {
    if (!walletAddress || selectedNFTs.length === 0) return;

    setIsBurning(true);
    
    try {
      console.log('🚀 Starting burn using NFT operations hook...');
      console.log('Selected NFTs:', selectedNFTs.map(nft => ({ id: nft.id, status: nft.status, rarity: nft.rarity })));

      // Check burn chance availability first
      if (!burnChanceData || burnChanceData.available_burn_chances <= 0) {
        toast.error('No burn chances available. Complete more projects to earn burn chances.');
        setBurnProgress(0);
        return;
      }

      // Check if any selected NFTs are staked
      const stakedNFTs = selectedNFTs.filter(nft => 
        nft.id.includes('staked_') || nft.isStaked === true
      );
      
      if (stakedNFTs.length > 0) {
        toast.error(`Cannot burn staked NFTs. Please unstake ${stakedNFTs.length} NFT(s) first.`);
        setBurnProgress(0);
        return;
      }

      // Use the NFT operations hook for burning with optimistic updates
      const nftIds = selectedNFTs.map(nft => nft.id);
      const result = await burnNFTs(nftIds);

      if (result.success && result.data) {
        setBurnProgress(100);
        
        // Refresh burn chance status immediately after using it
        await loadBurnChanceStatus();

        // Clear selected NFTs
        setSelectedNFTs([]);

        // Set burned NFT for modal display (extract from result data)
        setBurnedNFT(result.data.resultNFT || result.data);

        // Move to success step
        setBurnModalStep(3);

        // Success message and confetti
        const resultNFT = result.data.resultNFT || result.data;
        toast.success(`Successfully burned ${selectedNFTs.length} NFTs and created ${resultNFT.name || 'new NFT'}!`);

        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        toast.error(result.message || 'Failed to burn NFTs');
        setBurnProgress(0);
      }
    } catch (error) {
      console.error('Error burning NFTs:', error);
      toast.error('Failed to burn NFTs: ' + (error as Error).message);
      setBurnProgress(0);
    } finally {
      setIsBurning(false);
    }
  };

  // Check if burn is possible
  const canBurn = () => {
    // Must have burn chances available
    if (!burnChanceData || burnChanceData.available_burn_chances === 0) {
      return false;
    }
    
    // Must have NFTs selected
    if (selectedNFTs.length === 0) {
      return false;
    }
    
    // Must have a valid burn rule for selected NFTs
    if (!applicableRule) {
      return false;
    }
    
    // Must have enough NFTs for the rule
    return selectedNFTs.length >= applicableRule.requiredAmount;
  };

  // Get styling based on rarity
  const getRarityStyles = (rarity: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> =
    {
      Common: {
        bg: "bg-gray-700",
        text: "text-gray-300",
        border: "border-gray-600",
      },
      Rare: {
        bg: "bg-blue-800/30",
        text: "text-sky-400",
        border: "border-sky-700",
      },
      Legendary: {
        bg: "bg-amber-800/30",
        text: "text-amber-400",
        border: "border-amber-700",
      },
      Silver: {
        bg: "bg-slate-500/20",
        text: "text-slate-300",
        border: "border-slate-400",
      },
      Gold: {
        bg: "bg-yellow-700/30",
        text: "text-yellow-300",
        border: "border-yellow-600",
      },
      Platinum: {
        bg: "bg-indigo-800/20",
        text: "text-indigo-300",
        border: "border-indigo-700",
      },
    };

    return (
      colors[rarity] || {
        bg: "bg-gray-700",
        text: "text-gray-300",
        border: "border-gray-600",
      }
    );
  };

  // Get the applicable rule for an NFT
  const getRuleForNFT = (nft: NFT): BurnRule | null => {
    const burnRules = getBurnRules();
    return burnRules.find(
      (rule) => rule.minRarity === nft.rarity && rule.maxRarity === nft.rarity
    ) || null;
  };

  // Get how many more NFTs are needed to burn (memoized)
  const moreNeeded = useMemo(() => {
    if (!applicableRule) return 0;
    return Math.max(0, applicableRule.requiredAmount - selectedNFTs.length);
  }, [applicableRule, selectedNFTs.length]);

  // Check if step is active
  const isStepActive = (step: BurnStep) => {
    return burnStep === step;
  };

  // Open modal when burn button is clicked
  const openBurnModal = () => {
    setBurnModalStep(1);
    setIsBurnModalOpen(true);
  };
  // Close modal and reset
  const closeBurnModal = () => {
    setIsBurnModalOpen(false);
    setBurnModalStep(1);
    setIsBurning(false);
    setBurnedNFT(null);
    setBurnStep("select");
    setSelectedNFTs([]);
  };

  // Mobile/Tablet: toggle for showing sidebar content (stats + actions + how it works)
  const [showMobileInfo, setShowMobileInfo] = useState(false);

  // Reusable sidebar content (stats + progress + burn button + how it works)
  
  const renderSidebarContent = () => (
    <div className="bg-[#121021]  rounded-xl p-4 sm:p-0">
      {/* Summary and action buttons below */}
      <Button
          className="lg:hidden w-full rounded-md shadow-lg bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold px-4 py-3 flex items-center gap-2 border-0 ring-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          onClick={() => setShowMobileInfo((v) => !v)}
          aria-label={showMobileInfo ? "Hide burn info" : "Show burn info"}
        >
          <span className="text-sm">{showMobileInfo ? 'Hide Burn Info' : 'Show Burn Info'}</span>
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
      <div className="mb-4 p-3 rounded-lg bg-[#1b1930] flex flex-col gap-2">
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94A3B8]">Selected</span>
          <span className="text-sm font-bold text-[#5D43EF]">{selectedNFTs.length}</span>
        </div>
        
      </div>

      {/* Progress */}
      <div className="mb-3">
        {isBurning ? (
          <>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#94A3B8]">Burning...</span>
              <span className="font-medium text-indigo-300">{burnProgress}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={burnProgress} className="h-2 flex-1 [&>[role=progressbar]]:bg-[#5062d5] bg-white/5" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="p-1 rounded hover:bg-white/5" aria-label="Burning info">
                      <Info className="w-4 h-4 text-[#94A3B8]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">Your NFTs are being burned. This may take a few seconds.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-xs text-[#94A3B8]">Burn Chances</span>
              <span className={cn("font-medium", burnChanceData && burnChanceData.available_burn_chances > 0 ? "text-white" : "text-[#94A3B8]") }>
                {isLoadingBurnChance ? "Loading..." : `${burnChanceData?.available_burn_chances || 0}/${(burnChanceData?.available_burn_chances || 0) + (burnChanceData?.used_burn_chances || 0)}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={burnChanceData?.progress_percentage || 0}
                className={cn(
                  "h-2 flex-1",
                  burnChanceData && burnChanceData.available_burn_chances > 0
                    ? "[&>[role=progressbar]]:bg-green-500 bg-green-900/20"
                    : "[&>[role=progressbar]]:bg-[#5d43ef] bg-[#1b1930]"
                )}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-[#5d43ef]/10"
                      aria-label="Refresh burn chance status"
                      onClick={loadBurnChanceStatus}
                      disabled={isLoadingBurnChance}
                    >
                      <RefreshCw className={cn("w-4 h-4 text-[#94A3B8]", isLoadingBurnChance && "animate-spin")} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">
                    Click to refresh burn chance status
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="p-1 rounded hover:bg-[#5d43ef]/10" aria-label="Burn chance info">
                      <Info className="w-4 h-4 text-[#94A3B8]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">
                    <div className="max-w-xs text-xs leading-relaxed">
                      {burnChanceData && burnChanceData.available_burn_chances > 0 ? (
                        <>
                          🔥 Burn chances available! You can now burn NFTs.
                          <br />
                          Available: {burnChanceData.available_burn_chances} | Used: {burnChanceData.used_burn_chances}
                          <br />
                          <span className="text-[#94A3B8]">Complete 2 campaigns to earn 1 burn chance</span>
                          <br />
                          <span className="text-[#94A3B8]">Progress: {burnChanceData?.projects_completed_count || 0}/{burnChanceData?.projects_required || 2} campaigns</span>
                        </>
                      ) : (
                        <>
                          Complete 2 campaigns (all tasks) in the Discover page to earn 1 burn chance.
                          <br />
                          <span className="font-medium text-white">Progress: {burnChanceData?.projects_completed_count || 0}/{burnChanceData?.projects_required || 2} campaigns</span>
                          <br />
                          <span className="text-[#94A3B8]">Each burn chance allows you to burn 1 NFT</span>
                        </>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        )}
      </div>

      <Button
        className={cn(
          "w-full font-bold py-2 rounded-lg mt-4 flex items-center justify-center gap-2",
          !canBurn()
            ? "bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)] text-gray-300 cursor-not-allowed"
            : "bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/80 hover:via-[#5d43ef]/60 hover:to-[rgb(155,160,235)] text-white"
        )}
        disabled={!canBurn()}
        onClick={openBurnModal}
        title={!canBurn() ? "Select NFTs and ensure you have burn chances available" : ""}
      >
        {!burnChanceData || burnChanceData.available_burn_chances === 0 ? (
          <>
            <AlertCircle className="w-5 h-5" /> Projects Required
          </>
        ) : selectedNFTs.length === 0 ? (
          <>
            <Flame className="w-5 h-5" /> Select NFTs to Burn
          </>
        ) : !applicableRule ? (
          <>
            <AlertCircle className="w-5 h-5" /> Invalid Selection
          </>
        ) : (
          <>
            <Flame className="w-5 h-5" /> Burn Selected ({selectedNFTs.length})
          </>
        )}
      </Button>

      <div className="mt-4 p-4 rounded-xl bg-[#1b1930] shadow-lg flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-5 h-5 text-[#5D43EF]" />
          <span className="text-base font-bold text-white">How Burn Works</span>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed mb-1">
          Select NFTs of the same rarity and use the burn system to upgrade your collection. Burn combos are dynamic and may change based on your selection. For more details, check the FAQ or contact support.
        </p>

        <div className="mt-1 w-full">
          <div className="text-xs text-[#94A3B8] leading-relaxed">
            <div className="font-bold text-white mb-1">Burn Rules:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <span className="font-semibold text-[#94A3B8]">5 Common</span> → 1 <span className="font-semibold text-indigo-300">Platinum</span>
              </li>
              <li>
                <span className="font-semibold text-[#94A3B8]">3 Rare</span> → 1 <span className="font-semibold text-indigo-300">Platinum</span>
              </li>
              <li>
                <span className="font-semibold text-[#94A3B8]">2 Legendary</span> → 1 <span className="font-semibold text-indigo-300">Platinum</span>
              </li>
              <li>
                <span className="font-semibold text-indigo-300">5 Platinum</span> → 1 <span className="font-semibold text-white/80">Silver</span>
              </li>
              <li>
                <span className="font-semibold text-white/80">5 Silver</span> → 1 <span className="font-semibold text-yellow-300">Gold</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  );

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-lg font-sora text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication required message
  if (!isAuthenticated || !walletAddress) {
    return (
      <div className="min-h-screen bg-[#0B0A14]">
        <MainNav />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold font-sora mb-4 text-white">Authentication Required</h2>
            <p className="text-[#94A3B8] mb-6">Please connect your wallet to access the burn functionality.</p>
            <Button
              onClick={() => window.location.href = '/auth'}
              className="bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 px-6 rounded-lg"
            >
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0A14] font-sora">
      {/* Dark Background */}
      <div className="fixed inset-0 bg-[#0B0A14]" />

      <MainNav />

      <main className="container relative mx-auto px-3 sm:px-4 md:px-6 pt-0 mt-0 pb-10 md:pb-16 space-y-4 md:space-y-6">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold font-sora tracking-tight text-white mt-0 pt-0 mb-2 text-left">Burn NFTs</h1>
            <p className="text-sm sm:text-base font-sora text-[#94A3B8] mt-1 mb-8 text-left">
              Transform your NFTs through strategic burning. Combine common treasures to forge legendary artifacts.
            </p>
          </div>
          {/* Section 1: Your NFTs with Tabs */}
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-semibold text-white">
                  Your Collection ({allNFTs.length} NFTs)
                  {/* {(isLoadingNFTsContext || !loadingProgress.onchain) && (
                    <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading your on-chain NFTs… This may take a few moments. Please ensure your wallet is connected.
                    </span>
                  )} */}
                  {!ipfsConfigured && (
                    <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                      IPFS Not Configured
                    </span>
                  )}
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
                      <div
                        key={nft.id}
                        className={cn(
                          "relative rounded-2xl bg-[#0B0A14] border border-[#5d43ef] shadow-lg backdrop-blur-xl p-0 flex flex-col items-stretch transition-transform group",
                          isSelected ? "ring-2 ring-[#5D43EF] border-[#5D43EF]" : "",
                          isStaked ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.025] hover:shadow-2xl cursor-pointer"
                        )}
                        onClick={() => !isStaked && handleSelectNFT(nft)}
                      >
                        {/* NFT Image fills card */}
                        <div className="relative w-full aspect-square bg-[#0B0A14] rounded-t-2xl overflow-hidden flex items-center justify-center">
                          <ProgressiveNFTImage 
                            src={nft.image || ''}
                            ipfsHash={nft.ipfs_hash || extractIPFSHash(nft.image || '') || undefined}
                            alt={nft.name} 
                            className={cn("w-full h-full object-cover transition-transform duration-300", !isStaked && "group-hover:scale-105")} 
                          />

                          {/* Staked Lock Overlay */}
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
                              <span className={cn('px-3 py-1  rounded-xl  text-xs font-bold shadow', getRarityStyles(nft.rarity).bg, getRarityStyles(nft.rarity).text)}>{nft.rarity}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {/* Mobile/Tablet: inline sidebar content when toggled */}
            
              <div className={cn(
                  "lg:hidden fixed bottom-0 left-0 w-full z-50 transition-all duration-500 ease-in-out bg-[#121021] rounded-t-xl shadow-xl overflow-hidden",
                  showMobileInfo ? "h-[400px]" : "h-[60px]" // collapsed = only button visible
                )}>
                {renderSidebarContent()}
              </div>
          
            {/* Section 2: Burn Combos Sidebar */}
            <aside className="hidden lg:block w-full lg:w-80 flex-shrink-0 mt-0 lg:mt-[58px]">
              {renderSidebarContent()}
            </aside>
          </div>
        </div>

      </main>
    
      {/* Burn Modal */}
      <Dialog open={isBurnModalOpen} onOpenChange={setIsBurnModalOpen}>
        <DialogContent className="max-w-lg w-full p-0 overflow-visible bg-gradient-to-b from-[#0b0a14]/60 via-[#0b0a14] to-[#5d43ef]/40">
          {/* Close button is already in DialogContent */}
          {burnModalStep === 1 && (
            <div className="p-6 pt-8 sm:p-8 flex flex-col items-center">
              <DialogHeader className="w-full">
                <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">You're burning these NFTs to forge something powerful.</DialogTitle>
                <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                  Select NFTs you want to burn and confirm the transformation.
                </DialogDescription>
              </DialogHeader>
              <div className="w-full flex flex-wrap justify-center gap-3 mb-4 sm:mb-6 max-w-xs sm:max-w-sm mx-auto">
                {selectedNFTs.map((nft) => (
                  <div key={nft.id} className="flex flex-col items-center">
                    <div className="w-24 h-28 sm:w-30 sm:h-36 rounded-xl overflow-hidden border-2 border-[#5d43ef] bg-[#181a20] relative">
                      <ProgressiveNFTImage 
                        src={
                          nft.image?.startsWith('http') 
                            ? nft.image 
                            : nft.image?.startsWith('/api/ipfs/') 
                              ? nft.image 
                              : getIPFSUrl(nft.image || '')
                        }
                        fallbackUrls={(nft as any).fallback_images || []}
                        ipfsHash={nft.ipfs_hash || extractIPFSHash(nft.image || '') || undefined}
                        alt={nft.name} 
                        className="w-full h-full object-cover" 
                      />
                      <div
                        className="absolute bottom-0 left-0 w-full bg-[#0B0A14] text-white text-[8px] sm:text-[10px] font-sora px-1 py-0.5 text-center truncate whitespace-nowrap overflow-hidden"
                        title={nft.name}
                      >
                        {nft.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-full flex flex-col items-center mb-6">
                <div className="text-base font-sora text-white font-semibold mb-1">Burn Rule</div>
                <div className="text-sm font-sora text-indigo-300 bg-[#181a20] rounded-lg px-4 py-2 border border-[#5d43ef]/40">
                  {applicableRule ? (
                    <>
                      {applicableRule.requiredAmount} {applicableRule.minRarity.charAt(0).toUpperCase() + applicableRule.minRarity.slice(1)} 
                      <span className="mx-1">→</span> 
                      1 {applicableRule.resultingNFT.rarity.charAt(0).toUpperCase() + applicableRule.resultingNFT.rarity.slice(1)}
                    </>
                  ) : (
                    "No applicable rule found"
                  )}
                </div>
              </div>
              <DialogFooter className="w-full flex flex-col gap-2">
                <Button
                  className="w-26 ml-auto bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-lg"
                  onClick={() => setBurnModalStep(2)}
                >
                  Next <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </DialogFooter>
            </div>
          )}
          {burnModalStep === 2 && (
            <div className="p-6 pt-8 sm:p-8 flex flex-col items-center">
              <DialogHeader className="w-full">
                <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">
                  You'll get: 1 {applicableRule ? 
                    applicableRule.resultingNFT.rarity.charAt(0).toUpperCase() + applicableRule.resultingNFT.rarity.slice(1) 
                    : 'Unknown'} NFT
                </DialogTitle>
              </DialogHeader>
              <div className="w-full flex flex-col items-center mb-4">
                <div className="relative flex items-center justify-center mb-2">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0.7 }}
                    animate={{ scale: [0.95, 1.05, 1], opacity: [0.7, 1, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse" }}
                    className="absolute z-0 w-36 h-36 sm:w-44 sm:h-44 rounded-2xl bg-gradient-to-br from-indigo-400/30 via-indigo-600/20 to-indigo-900/10 blur-2xl"
                  />
                  <div className="relative z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-2 border-indigo-400 shadow-lg bg-[#181a20] flex items-center justify-center">
                    {previewResultNFT?.image ? (
                      <ProgressiveNFTImage
                        src={
                          previewResultNFT.image?.startsWith('http') 
                            ? previewResultNFT.image 
                            : previewResultNFT.image?.startsWith('/api/ipfs/') 
                              ? previewResultNFT.image 
                              : getIPFSUrl(previewResultNFT.image || '')
                        }
                        fallbackUrls={(previewResultNFT as any).fallback_images || []}
                        ipfsHash={previewResultNFT.ipfs_hash || extractIPFSHash(previewResultNFT.image || '') || undefined}
                        alt={previewResultNFT.name}
                        className={isBurning ? "blur-sm grayscale object-cover w-full h-full" : "object-cover w-full h-full"}
                      />
                    ) : (
                      <div className="text-center text-[#5d43ef]">
                        <div className="w-16 h-16 mx-auto mb-2 opacity-50">
                          <svg fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-sm font-semibold">
                          {applicableRule ? 
                            applicableRule.resultingNFT.rarity.charAt(0).toUpperCase() + applicableRule.resultingNFT.rarity.slice(1) 
                            : 'Result'} NFT
                        </div>
                      </div>
                    )}
                    <Sparkles className="absolute -top-3 -right-3 w-8 h-8 text-indigo-300 animate-pulse" />
                  </div>
                </div>
                <div className="text-base font-sora text-white font-semibold mb-1 mt-2">
                  {applicableRule ? 
                    applicableRule.resultingNFT.rarity.charAt(0).toUpperCase() + applicableRule.resultingNFT.rarity.slice(1) 
                    : 'Result'} NFT
                </div>
                <div className="text-sm text-[#94A3B8] font-sora mb-2">Burn to complete the transformation.</div>
              </div>
              <DialogFooter className="w-full flex flex-col gap-2">
                <Button
                  className="w-24 mx-auto bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2"
                  onClick={handleBurnNFTs}
                  disabled={isBurning}
                >
                  {isBurning ? (
                    <span className="flex items-center"><Flame className="w-5 h-5 animate-bounce mr-2" />Burning...</span>
                  ) : (
                    <><Flame className="w-5 h-5" /> Burn </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
          {burnModalStep === 3 && (
            <div className="p-6 pt-8 sm:p-8 flex flex-col items-center">
              <DialogHeader className="w-full">
                <DialogTitle className="text-center text-2xl font-bold font-sora text-white mb-2">Congratulations 🎉</DialogTitle>
                <DialogDescription className="text-center text-[#94A3B8] mb-4 font-sora">
                  You forged a <span className="text-indigo-300 font-bold">NEFTINUM Platinum</span>
                </DialogDescription>
              </DialogHeader>
              <motion.div
                initial={{ scale: 0.9, opacity: 0.7 }}
                animate={{ scale: [0.9, 1.1, 1], opacity: [0.7, 1, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse" }}
                className="relative flex items-center justify-center mb-4"
              >
                <div className="absolute z-0 w-36 h-36 sm:w-44 sm:h-44 rounded-2xl bg-gradient-to-br from-indigo-400/30 via-indigo-600/20 to-indigo-900/10 blur-2xl animate-pulse" />
                <div className="relative z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-2 border-indigo-400 shadow-lg bg-[#181a20] flex items-center justify-center">
                  <img
                    src={burnedNFT?.image}
                    alt={burnedNFT?.name}
                    className="object-cover w-full h-full"
                  />
                  <Sparkles className="absolute -top-3 -right-3 w-8 h-8 text-indigo-300 animate-pulse" />
                </div>
              </motion.div>
              <div className="text-base font-sora text-white font-semibold mb-1 mt-2">Platinum NFT</div>
              <div className="text-sm text-[#94A3B8] font-sora mb-4">Share your win with your friends!</div>
              <div className="flex flex-col sm:flex-row gap-2 w-full justify-center mb-2">
                <Button
                  variant="outline"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto border-indigo-400 text-indigo-300 hover:bg-indigo-900/20"
                  onClick={handleShareOnX}
                >
                  <img src="/icons/x-social-media-round-icon.png" alt="X" className="w-5 h-5" /> Share your win on X
                </Button>
              </div>
              <DialogFooter className="w-full flex flex-col gap-2 mt-2">
                <Button
                  className="w-44 mx-auto bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold py-2 rounded-lg"
                  onClick={closeBurnModal}
                >
                  Back to Collection
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BurnPage;