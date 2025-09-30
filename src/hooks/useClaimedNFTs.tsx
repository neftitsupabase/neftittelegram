import { useState, useEffect, useCallback } from 'react';
import nftClaimDisplayService from '../services/NFTClaimDisplayService';

interface ClaimedNFT {
  id: string;
  nft_id: string;
  wallet_address: string;
  transaction_hash: string;
  token_id: string;
  contract_address: string;
  claimed_blockchain: string;
  claimed_at: string;
  metadata_uri?: string;
  metamask_compatible?: boolean;
}

interface ClaimedNFTStats {
  total_claims: number;
  unique_contracts: number;
  latest_claim: string | null;
  metamask_compatible_count: number;
}

interface UseClaimedNFTsReturn {
  claimedNFTs: ClaimedNFT[];
  stats: ClaimedNFTStats | null;
  isLoading: boolean;
  error: string | null;
  refreshClaims: () => Promise<void>;
}

export const useClaimedNFTs = (walletAddress?: string): UseClaimedNFTsReturn => {
  const [claimedNFTs, setClaimedNFTs] = useState<ClaimedNFT[]>([]);
  const [stats, setStats] = useState<ClaimedNFTStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClaimedNFTs = useCallback(async () => {
    if (!walletAddress) {
      setClaimedNFTs([]);
      setStats(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Refreshing claimed NFTs for:', walletAddress);
      
      // Load claimed NFTs from service
      const claims = await nftClaimDisplayService.getClaimedNFTs(walletAddress);
      setClaimedNFTs(claims);

      // Calculate stats
      const uniqueContracts = new Set(claims.map(claim => claim.contract_address)).size;
      const metamaskCompatibleCount = claims.filter(claim => claim.metamask_compatible).length;
      const latestClaim = claims.length > 0 ? claims[0].claimed_at : null;

      const calculatedStats: ClaimedNFTStats = {
        total_claims: claims.length,
        unique_contracts: uniqueContracts,
        latest_claim: latestClaim,
        metamask_compatible_count: metamaskCompatibleCount
      };

      setStats(calculatedStats);
      console.log('✅ Refreshed', claims.length, 'claimed NFTs');

    } catch (error: any) {
      console.error('❌ Failed to load claimed NFTs:', error);
      setError(error.message || 'Failed to load claimed NFTs');
      setClaimedNFTs([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const refreshClaims = useCallback(async () => {
    await loadClaimedNFTs();
  }, [loadClaimedNFTs]);

  // Load claimed NFTs when wallet address changes
  useEffect(() => {
    loadClaimedNFTs();
  }, [loadClaimedNFTs]);

  return {
    claimedNFTs,
    stats,
    isLoading,
    error,
    refreshClaims
  };
};
