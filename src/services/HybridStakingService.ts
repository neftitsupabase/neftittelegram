/**
 * Hybrid Staking Service - Provides unified interface for both onchain and offchain staking
 * Delegates to appropriate service based on staking method while maintaining unified rewards
 */

import onchainStakingService from './OnchainStakingService';
import offChainStakingService from './EnhancedStakingService';
import { NFTData } from './HybridIPFSService';
import { StakingResponse, StakedNFT } from '../types/staking';
import { toast } from 'sonner';

export type StakingMethod = 'offchain' | 'onchain';

class HybridStakingService {
  /**
   * Check if onchain staking is available
   */
  async isOnChainAvailable(): Promise<boolean> {
    return await onchainStakingService.isOnChainAvailable();
  }

  /**
   * Stake NFT using specified method (onchain or offchain)
   */
  async stakeNFT(walletAddress: string, nft: NFTData, method: StakingMethod = 'offchain'): Promise<StakingResponse> {
    try {
      if (method === 'onchain') {
        console.log(`🔗 Staking NFT ${nft.id} onchain`);
        return await onchainStakingService.stakeNFTOnChain(walletAddress, nft);
      } else {
        console.log(`☁️ Staking NFT ${nft.id} offchain`);
        return await offChainStakingService.stakeNFT(walletAddress, nft);
      }
    } catch (error) {
      console.error(`❌ Hybrid staking failed for ${method}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Staking failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unstake NFT using specified method (onchain or offchain)
   */
  async unstakeNFT(walletAddress: string, tokenId: string, method: StakingMethod = 'offchain'): Promise<StakingResponse> {
    try {
      if (method === 'onchain') {
        console.log(`🔗 Unstaking NFT ${tokenId} from onchain`);
        return await onchainStakingService.unstakeNFTOnChain(walletAddress, tokenId);
      } else {
        console.log(`☁️ Unstaking NFT ${tokenId} from offchain`);
        return await offChainStakingService.unstakeNFT(walletAddress, tokenId);
      }
    } catch (error) {
      console.error(`❌ Hybrid unstaking failed for ${method}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unstaking failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get staked NFTs from both onchain and offchain sources
   */
  async getStakedNFTs(walletAddress: string): Promise<NFTData[]> {
    try {
      const [onchainNFTs, offchainStakedNFTs] = await Promise.all([
        onchainStakingService.getStakedNFTs(walletAddress),
        offChainStakingService.getStakedNFTs(walletAddress)
      ]);

      // Convert StakedNFT[] to NFTData[] for offchain results
      const offchainNFTs: NFTData[] = offchainStakedNFTs.map(stakedNFT => ({
        id: stakedNFT.nft_id,
        name: `NEFTIT ${stakedNFT.nft_rarity.charAt(0).toUpperCase() + stakedNFT.nft_rarity.slice(1)} NFT`,
        description: 'NEFTIT Collection NFT',
        image: '',
        rarity: stakedNFT.nft_rarity,
        wallet_address: stakedNFT.wallet_address || walletAddress,
        ipfs_hash: '',
        pinata_hash: '',
        metadata_uri: '',
        attributes: [
          { trait_type: 'Rarity', value: stakedNFT.nft_rarity.charAt(0).toUpperCase() + stakedNFT.nft_rarity.slice(1) },
          { trait_type: 'Platform', value: 'NEFTIT' },
          { trait_type: 'Status', value: 'Staked Offchain' }
        ],
        created_at: stakedNFT.staked_at
      }));

      // Mark onchain NFTs with onchain attribute
      const markedOnchainNFTs = onchainNFTs.map(nft => ({
        ...nft,
        attributes: [
          ...nft.attributes,
          { trait_type: 'Status', value: 'Staked Onchain' }
        ]
      }));

      // Combine results (avoiding duplicates by token ID)
      const allNFTs = [...markedOnchainNFTs];
      const onchainTokenIds = new Set(onchainNFTs.map(nft => nft.id));
      
      // Add offchain NFTs that aren't already staked onchain
      offchainNFTs.forEach(nft => {
        if (!onchainTokenIds.has(nft.id)) {
          allNFTs.push(nft);
        }
      });

      console.log(`✅ Found ${allNFTs.length} total staked NFTs (${onchainNFTs.length} onchain, ${offchainNFTs.length} offchain)`);
      return allNFTs;

    } catch (error) {
      console.error('❌ Error getting hybrid staked NFTs:', error);
      // Fallback to offchain only
      try {
        const offchainStakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
        return offchainStakedNFTs.map(stakedNFT => ({
          id: stakedNFT.nft_id,
          name: `NEFTIT ${stakedNFT.nft_rarity.charAt(0).toUpperCase() + stakedNFT.nft_rarity.slice(1)} NFT`,
          description: 'NEFTIT Collection NFT',
          image: '',
          rarity: stakedNFT.nft_rarity,
          wallet_address: stakedNFT.wallet_address || walletAddress,
          ipfs_hash: '',
          pinata_hash: '',
          metadata_uri: '',
          attributes: [
            { trait_type: 'Rarity', value: stakedNFT.nft_rarity.charAt(0).toUpperCase() + stakedNFT.nft_rarity.slice(1) },
            { trait_type: 'Platform', value: 'NEFTIT' },
            { trait_type: 'Status', value: 'Staked Offchain' }
          ],
          created_at: stakedNFT.staked_at
        }));
      } catch (fallbackError) {
        console.error('❌ Fallback to offchain also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get staking info including pending rewards (unified from offchain system)
   */
  async getStakeInfo(walletAddress: string): Promise<{ stakedNFTs: string[], pendingRewards: string }> {
    try {
      // Get onchain stake info
      const onchainInfo = await onchainStakingService.getStakeInfo(walletAddress);
      
      // Get offchain staked NFTs
      const offchainStakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
      const offchainTokenIds = offchainStakedNFTs.map(nft => nft.nft_id);

      // Combine token IDs (avoiding duplicates)
      const allTokenIds = [...onchainInfo.stakedNFTs];
      offchainTokenIds.forEach(tokenId => {
        if (!allTokenIds.includes(tokenId)) {
          allTokenIds.push(tokenId);
        }
      });

      // For rewards, we use the offchain system as the unified source
      // This ensures both onchain and offchain staked NFTs earn rewards from the same pool
      return {
        stakedNFTs: allTokenIds,
        pendingRewards: '0' // Rewards are claimed through offchain system
      };

    } catch (error) {
      console.error('❌ Error getting hybrid stake info:', error);
      return { stakedNFTs: [], pendingRewards: '0' };
    }
  }

  /**
   * Claim rewards (always from offchain system for unified rewards)
   */
  async claimRewards(walletAddress: string): Promise<StakingResponse> {
    try {
      console.log('💰 Claiming unified rewards from offchain system');
      return await offChainStakingService.claimNFTRewards(walletAddress);
    } catch (error) {
      console.error('❌ Error claiming hybrid rewards:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Reward claiming failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Create and export the service instance
const hybridStakingService = new HybridStakingService();
export default hybridStakingService;
