import { supabase } from '../lib/supabase';
import { nftLifecycleService } from './NFTLifecycleService';
import offChainStakingService from './EnhancedStakingService';
import improvedOnchainStakingService from './ImprovedOnchainStakingService';

export interface ComprehensiveNFTData {
  id: string;
  name: string;
  description?: string;
  image: string;
  rarity: string;
  attributes?: any[];
  status: 'offchain' | 'onchain' | 'claimed';
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
}

/**
 * Comprehensive service to load ALL NFT data without losing any information
 * Handles recovery of deleted NFTs and proper staking status
 */
export class ComprehensiveNFTDataService {
  
  /**
   * Load ALL NFT data for a user - preventing duplicates between offchain and claimed
   */
  async loadAllUserNFTData(walletAddress: string): Promise<ComprehensiveNFTData[]> {
    console.log('🔄 Loading comprehensive NFT data for wallet:', walletAddress);
    
    const allNFTs: ComprehensiveNFTData[] = [];
    
    try {
      // 1. DISABLED: Claimed NFT checking (not needed for basic functionality)
      // const { data: claimedData } = await supabase.from('nft_claim_log').select('nft_id').eq('wallet_address', walletAddress.toLowerCase());
      // const claimedNFTIds = new Set(claimedData?.map(claim => claim.nft_id) || []);
      console.log('⚠️ Claimed NFT checking disabled - loading all NFTs');
      
      // 2. Load offchain NFTs (all active ones)
      const allOffchainNFTs = await this.loadOffchainNFTs(walletAddress);
      allNFTs.push(...allOffchainNFTs);
      console.log(`📦 Loaded ${allOffchainNFTs.length} offchain NFTs`);
      
      // 3. Load onchain NFTs from blockchain (these are the claimed ones)
      const onchainNFTs = await this.loadOnchainNFTs(walletAddress);
      allNFTs.push(...onchainNFTs);
      console.log(`⛓️ Loaded ${onchainNFTs.length} onchain NFTs from blockchain`);
      
      // 4. DISABLED: Staking status enrichment (handled by NFT context)
      // await this.enrichWithStakingStatus(allNFTs, walletAddress);
      console.log('⚠️ Staking status enrichment disabled - handled by NFT context');
      
      // 5. Remove any remaining duplicates (prefer onchain over offchain)
      const deduplicatedNFTs = this.deduplicateNFTs(allNFTs);
      
      console.log(`✅ Total comprehensive NFT data loaded: ${deduplicatedNFTs.length}`);
      return deduplicatedNFTs;
      
    } catch (error) {
      console.error('❌ Error loading comprehensive NFT data:', error);
      return [];
    }
  }
  
  /**
   * Load active offchain NFTs
   */
  private async loadOffchainNFTs(walletAddress: string): Promise<ComprehensiveNFTData[]> {
    try {
      const nftStatus = await nftLifecycleService.getNFTStatus(walletAddress);
      
      return nftStatus.offchainNFTs.map(nft => ({
        id: nft.id,
        name: nft.name,
        description: nft.description,
        image: nft.image,
        rarity: nft.rarity,
        attributes: nft.attributes,
        status: 'offchain' as const,
        isStaked: false, // Will be updated later
        stakingSource: 'none' as const,
        dailyReward: this.getDailyReward(nft.rarity),
        wallet_address: walletAddress,
        ipfs_hash: nft.ipfs_hash,
        metadata_uri: nft.metadata_uri
      }));
    } catch (error) {
      console.error('❌ Error loading offchain NFTs:', error);
      return [];
    }
  }
  
  /**
   * CRITICAL: Load claimed/deleted NFTs from database
   */
  private async loadClaimedNFTs(walletAddress: string): Promise<ComprehensiveNFTData[]> {
    try {
      console.log('🔍 Searching for claimed/deleted NFTs...');
      
      // Get claimed NFT IDs
      const { data: claimedData, error: claimedError } = await supabase
        .from('nft_claims')
        .select('nft_id, claimed_at, claim_type')
        .eq('wallet_address', walletAddress.toLowerCase());
      
      if (claimedError) {
        console.error('❌ Error fetching claimed NFTs:', claimedError);
        return [];
      }
      
      if (!claimedData || claimedData.length === 0) {
        console.log('📭 No claimed NFTs found');
        return [];
      }
      
      console.log(`🔍 Found ${claimedData.length} claimed NFT records`);
      
      // Try to recover original NFT data from various sources
      const recoveredNFTs: ComprehensiveNFTData[] = [];
      
      for (const claim of claimedData) {
        try {
          // Try to get original data from distribution log
          const originalData = await this.getOriginalNFTData(claim.nft_id);
          
          if (originalData) {
            recoveredNFTs.push({
              id: claim.nft_id,
              name: originalData.name,
              description: originalData.description,
              image: originalData.image,
              rarity: originalData.rarity,
              attributes: originalData.attributes,
              status: 'claimed' as const,
              isStaked: false, // Will be updated later
              stakingSource: 'none' as const,
              dailyReward: this.getDailyReward(originalData.rarity),
              wallet_address: walletAddress,
              ipfs_hash: originalData.ipfs_hash,
              claimed_at: claim.claimed_at
            });
          } else {
            // Create placeholder if original data not found
            recoveredNFTs.push({
              id: claim.nft_id,
              name: `Recovered NFT ${claim.nft_id.slice(-8)}`,
              description: 'Recovered NFT - original data may be incomplete',
              image: '/placeholder-nft.png',
              rarity: 'Common',
              attributes: [],
              status: 'claimed' as const,
              isStaked: false,
              stakingSource: 'none' as const,
              dailyReward: this.getDailyReward('Common'),
              wallet_address: walletAddress,
              claimed_at: claim.claimed_at
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not recover data for NFT ${claim.nft_id}:`, error);
        }
      }
      
      console.log(`✅ Recovered ${recoveredNFTs.length} claimed NFTs`);
      return recoveredNFTs;
      
    } catch (error) {
      console.error('❌ Error loading claimed NFTs:', error);
      return [];
    }
  }
  
  /**
   * Load onchain NFTs from blockchain
   */
  private async loadOnchainNFTs(walletAddress: string): Promise<ComprehensiveNFTData[]> {
    try {
      const nftStatus = await nftLifecycleService.getNFTStatus(walletAddress);
      
      return nftStatus.onchainNFTs.map(nft => ({
        id: nft.id,
        name: nft.name,
        description: nft.description,
        image: nft.image,
        rarity: nft.rarity,
        attributes: nft.attributes,
        status: 'onchain' as const,
        isStaked: false, // Will be updated later
        stakingSource: 'none' as const,
        dailyReward: this.getDailyReward(nft.rarity),
        wallet_address: walletAddress,
        tokenId: nft.tokenId,
        contractAddress: nft.contractAddress,
        claimed_at: nft.claimed_at,
        ipfs_hash: nft.ipfs_hash
      }));
    } catch (error) {
      console.error('❌ Error loading onchain NFTs:', error);
      return [];
    }
  }
  
  /**
   * Extract pure numeric token ID from various NFT ID formats
   * Handles: "25", "onchain_25", "blockchain_25", etc.
   */
  private extractTokenId(nftId: string): string | null {
    // If it's already a pure number, return it
    if (/^\d+$/.test(nftId)) {
      return nftId;
    }
    
    // Extract number from prefixed formats
    const match = nftId.match(/(?:onchain_|blockchain_|nft_)?(\d+)$/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Try to extract any number from the string
    const numberMatch = nftId.match(/\d+/);
    if (numberMatch) {
      return numberMatch[0];
    }
    
    return null;
  }

  /**
   * Create comprehensive token ID lookup sets for matching
   */
  private createTokenIdLookups(tokenIds: string[]): {
    pureTokenIds: Set<string>;
    allVariants: Set<string>;
  } {
    const pureTokenIds = new Set<string>();
    const allVariants = new Set<string>();
    
    for (const tokenId of tokenIds) {
      const pureId = this.extractTokenId(tokenId);
      if (pureId) {
        pureTokenIds.add(pureId);
        allVariants.add(pureId);
        allVariants.add(`onchain_${pureId}`);
        allVariants.add(`blockchain_${pureId}`);
        allVariants.add(`nft_${pureId}`);
      }
      // Also add the original ID
      allVariants.add(tokenId);
    }
    
    return { pureTokenIds, allVariants };
  }

  /**
   * Check if an NFT matches any staked token ID (handles all formats)
   */
  private isTokenStaked(nft: ComprehensiveNFTData, stakedTokenLookup: { pureTokenIds: Set<string>; allVariants: Set<string> }): boolean {
    // Direct ID match
    if (stakedTokenLookup.allVariants.has(nft.id)) {
      return true;
    }
    
    // Extract and match pure token ID
    const nftTokenId = this.extractTokenId(nft.id);
    if (nftTokenId && stakedTokenLookup.pureTokenIds.has(nftTokenId)) {
      return true;
    }
    
    // Check tokenId property if available
    if (nft.tokenId) {
      const tokenIdPure = this.extractTokenId(nft.tokenId);
      if (tokenIdPure && stakedTokenLookup.pureTokenIds.has(tokenIdPure)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Enrich NFTs with staking status from both offchain and onchain sources
   */
  private async enrichWithStakingStatus(nfts: ComprehensiveNFTData[], walletAddress: string): Promise<void> {
    try {
      console.log('🔍 Enriching NFTs with staking status...');
      
      // Get offchain staked NFTs
      let offchainStakedNFTs: any[] = [];
      try {
        offchainStakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
        console.log(`📊 Found ${offchainStakedNFTs.length} offchain staked NFTs`);
      } catch (error) {
        console.warn('⚠️ Could not load offchain staked NFTs:', error);
      }
      
      // Get onchain staked NFTs
      let onchainStakedTokens: string[] = [];
      try {
        const onchainStakeInfo = await improvedOnchainStakingService.getStakeInfo(walletAddress);
        onchainStakedTokens = onchainStakeInfo.stakedNFTs;
        console.log(`⛓️ Found ${onchainStakedTokens.length} onchain staked NFTs`);
      } catch (error) {
        console.warn('⚠️ Could not load onchain staked NFTs:', error);
      }
      
      // Create comprehensive lookup sets using new token ID extraction logic
      const offchainStakedIds = new Set(offchainStakedNFTs.map(nft => nft.nft_id));
      const onchainStakedLookup = this.createTokenIdLookups(onchainStakedTokens);
      
      console.log('🔍 Enhanced staking lookup data:', {
        offchainStakedIds: Array.from(offchainStakedIds),
        onchainPureTokenIds: Array.from(onchainStakedLookup.pureTokenIds),
        onchainAllVariants: Array.from(onchainStakedLookup.allVariants),
        originalOnchainTokens: onchainStakedTokens
      });
      
      // Update staking status with enhanced matching
      for (const nft of nfts) {
        if (offchainStakedIds.has(nft.id)) {
          nft.isStaked = true;
          nft.stakingSource = 'offchain';
          
          // Get staking timestamp
          const stakedNFT = offchainStakedNFTs.find(s => s.nft_id === nft.id);
          if (stakedNFT) {
            nft.staked_at = stakedNFT.staked_at;
          }
          console.log(`✅ Marked NFT ${nft.id} as offchain staked`);
        } else if (this.isTokenStaked(nft, onchainStakedLookup)) {
          nft.isStaked = true;
          nft.stakingSource = 'onchain';
          nft.staked_at = new Date().toISOString(); // Approximate
          
          const extractedTokenId = this.extractTokenId(nft.id);
          console.log(`✅ Marked NFT ${nft.id} (extracted tokenId: ${extractedTokenId}) as onchain staked`);
        }
      }
      
      const stakedCount = nfts.filter(nft => nft.isStaked).length;
      console.log(`✅ Updated staking status: ${stakedCount}/${nfts.length} NFTs are staked`);
      
    } catch (error) {
      console.error('❌ Error enriching with staking status:', error);
    }
  }
  
  /**
   * Remove duplicates, preferring onchain over offchain
   */
  private deduplicateNFTs(nfts: ComprehensiveNFTData[]): ComprehensiveNFTData[] {
    const seen = new Map<string, ComprehensiveNFTData>();
    
    for (const nft of nfts) {
      const existing = seen.get(nft.id);
      
      if (!existing) {
        seen.set(nft.id, nft);
      } else {
        // Prefer onchain over offchain/claimed
        if (nft.status === 'onchain' && existing.status !== 'onchain') {
          seen.set(nft.id, nft);
        }
        // Preserve staking status from either source
        if (existing.isStaked && !nft.isStaked) {
          nft.isStaked = true;
          nft.stakingSource = existing.stakingSource;
          nft.staked_at = existing.staked_at;
        }
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Get original NFT data from distribution log (even if marked as claimed)
   */
  private async getOriginalNFTData(nftId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('nft_cid_distribution_log')
        .select(`
          nft_id, 
          rarity, 
          cid,
          distributed_at
        `)
        .eq('nft_id', nftId)
        .single();

      if (!error && data) {
        return {
          id: data.nft_id,
          name: `NEFTIT ${data.rarity?.charAt(0).toUpperCase() + data.rarity?.slice(1)} NFT`,
          description: '',
          image: `https://gateway.pinata.cloud/ipfs/${data.cid}`,
          rarity: data.rarity || 'Common',
          attributes: [],
          ipfs_hash: data.cid
        };
      }

      return null;
    } catch (error) {
      console.warn('⚠️ Could not get original NFT data:', error);
      return null;
    }
  }
  
  /**
   * Calculate daily reward based on rarity
   */
  private getDailyReward(rarity: string): number {
    const rewards: Record<string, number> = {
      'common': 0.1,
      'rare': 0.4,
      'legendary': 1.0,
      'platinum': 2.5,
      'silver': 8.0,
      'gold': 30.0
    };
    
    return rewards[rarity.toLowerCase()] || 0.1;
  }
  
  /**
   * Get comprehensive staking summary
   */
  async getComprehensiveStakingSummary(walletAddress: string): Promise<{
    totalNFTs: number;
    stakedNFTs: number;
    offchainStaked: number;
    onchainStaked: number;
    claimedNFTs: number;
    totalDailyRewards: number;
  }> {
    const allNFTs = await this.loadAllUserNFTData(walletAddress);
    
    const stakedNFTs = allNFTs.filter(nft => nft.isStaked);
    const offchainStaked = stakedNFTs.filter(nft => nft.stakingSource === 'offchain').length;
    const onchainStaked = stakedNFTs.filter(nft => nft.stakingSource === 'onchain').length;
    const claimedNFTs = allNFTs.filter(nft => nft.status === 'claimed').length;
    const totalDailyRewards = stakedNFTs.reduce((sum, nft) => sum + nft.dailyReward, 0);
    
    return {
      totalNFTs: allNFTs.length,
      stakedNFTs: stakedNFTs.length,
      offchainStaked,
      onchainStaked,
      claimedNFTs,
      totalDailyRewards
    };
  }
}

export const comprehensiveNFTDataService = new ComprehensiveNFTDataService();
