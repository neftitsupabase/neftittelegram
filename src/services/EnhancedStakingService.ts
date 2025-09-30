import { SupabaseClient } from '@supabase/supabase-js';
import { supabase, createClientWithWalletHeader } from '../lib/supabase';
import { NFTData } from './HybridIPFSService';
import activityTrackingService from './ActivityTrackingService';
import achievementsService from './AchievementsService';
import userBalanceService from './UserBalanceService';
import { StakedNFT, StakedTokens, StakingReward, StakingSummary, StakingResponse } from '../types/staking';

// Types are now imported from centralized types/staking.ts file

class EnhancedStakingService {
  private supabase: SupabaseClient;
  private clientCache = new Map<string, SupabaseClient>();

  constructor() {
    this.supabase = supabase;
  }

  // Create wallet-specific client for RLS with caching to prevent multiple instances
  private createClient(walletAddress: string): SupabaseClient {
    if (!this.clientCache.has(walletAddress)) {
      console.log(`🔧 Creating wallet-specific Supabase client for: ${walletAddress.toLowerCase()}`);
      this.clientCache.set(walletAddress, createClientWithWalletHeader(walletAddress));
    }
    return this.clientCache.get(walletAddress)!;
  }

  // Parse RPC response helper
  private parseRPCResponse(data: any): any {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    return data;
  }

  // Log activity helper
  private async logActivity(walletAddress: string, activity: any): Promise<void> {
    try {
      await activityTrackingService.logActivity(walletAddress, activity);
    } catch (error) {
      console.error('Activity logging failed:', error);
    }
  }

  // Update achievements helper with proper action types
  private async updateStakingAchievements(walletAddress: string, actionType: 'stake' | 'unstake' | 'continuous'): Promise<void> {
    try {
      console.log(`🔒 Updating staking achievements: ${actionType} for wallet: ${walletAddress}`);
      await achievementsService.updateStakingAchievements(walletAddress, actionType, 1);
      console.log(`✅ Staking achievements updated successfully for action: ${actionType}`);
    } catch (error) {
      console.error(`❌ Staking achievement update failed for ${actionType}:`, error);
      // Don't fail the staking operation if achievement update fails
    }
  }

  // Get user staking summary with real-time pending rewards
  async getUserStakingSummary(walletAddress: string): Promise<StakingSummary> {
    try {
      const client = this.createClient(walletAddress);

      const { data, error } = await client.rpc('get_user_staking_summary', {
        user_wallet: walletAddress
      });

      if (error) throw error;

      const result = this.parseRPCResponse(data);
      return this.parseStakingSummary(result);
    } catch (error) {
      console.error('Error getting staking summary:', error);

      // Return empty summary on error
      return {
        staked_nfts_count: 0,
        staked_tokens_amount: 0,
        total_pending_rewards: 0,
        nft_pending_rewards: 0,
        token_pending_rewards: 0,
        daily_nft_rewards: 0,
        daily_token_rewards: 0
      };
    }
  }

  // Helper to parse staking summary consistently with source tracking
  private parseStakingSummary(result: any): StakingSummary {
    return {
      staked_nfts_count: parseInt(result.staked_nfts_count) || 0,
      onchain_nfts_count: parseInt(result.onchain_nfts_count) || 0,
      offchain_nfts_count: parseInt(result.offchain_nfts_count) || 0,
      staked_tokens_amount: parseFloat(result.staked_tokens_amount) || 0,
      total_pending_rewards: parseFloat(result.total_pending_rewards) || 0,
      nft_pending_rewards: parseFloat(result.nft_pending_rewards) || 0,
      token_pending_rewards: parseFloat(result.token_pending_rewards) || 0,
      daily_nft_rewards: parseFloat(result.daily_nft_rewards) || 0,
      daily_token_rewards: parseFloat(result.daily_token_rewards) || 0
    };
  }

  // REMOVED: autoGenerateRewards - not needed with real-time calculation

  // Get staked NFTs with source tracking using proper RPC function (bypasses RLS)
  async getStakedNFTs(walletAddress: string): Promise<StakedNFT[]> {
    try {
      console.log('🔍 DEBUG: getStakedNFTs called with wallet:', walletAddress);
      const client = this.createClient(walletAddress);

      // Use new RPC function with staking source information
      console.log('🔍 DEBUG: Calling get_staked_nfts_with_source RPC function...');
      const { data, error } = await client.rpc('get_staked_nfts_with_source', {
        user_wallet: walletAddress
      });

      console.log('🔍 DEBUG: RPC response - data:', data);
      console.log('🔍 DEBUG: RPC response - error:', error);

      if (error) {
        console.error('❌ RPC Error in getStakedNFTs:', error);
        throw error;
      }

      // Parse the JSON response and preserve actual staking source (no defaults)
      const stakedNFTs = Array.isArray(data) ? data.map((nft: any) => ({
        ...nft,
        staking_source: nft.staking_source, // Keep actual value (could be NULL)
        stakingSource: nft.staking_source // Legacy compatibility
      })) : [];

      console.log('🎨 getStakedNFTs with source tracking result:', stakedNFTs);
      console.log('🔍 DEBUG: Returning array of length:', stakedNFTs.length);
      return stakedNFTs;
    } catch (error) {
      console.error('❌ Error getting staked NFTs via RPC:', error);
      console.error('❌ Error details:', error);
      return [];
    }
  }

  // Get staked tokens using proper RPC function (bypasses RLS)
  async getStakedTokens(walletAddress: string): Promise<StakedTokens[]> {
    try {
      const client = this.createClient(walletAddress);

      // Use dedicated RPC function that bypasses RLS
      const { data, error } = await client.rpc('get_staked_tokens', {
        user_wallet: walletAddress
      });

      if (error) throw error;

      // Parse the JSON response
      const stakedTokens = Array.isArray(data) ? data : [];

      console.log('🪙 getStakedTokens via RPC:', stakedTokens);
      return stakedTokens;
    } catch (error) {
      console.error('Error getting staked tokens via RPC:', error);
      return [];
    }
  }

  // LOW EGRESS SYSTEM: Pending rewards are pre-calculated in staking_rewards table
  // by generate_daily_staking_rewards() batch job (24-hour cycles)

  // Helper to normalize rarity values to match database constraints
  private normalizeRarity(rarity: string): string {
    if (!rarity) return 'Common'; // Only use Common as last resort

    // Convert to proper case format expected by database
    const normalized = rarity.toLowerCase().trim();
    switch (normalized) {
      case 'common': return 'Common';
      case 'rare': return 'Rare';
      case 'legendary': return 'Legendary';
      case 'platinum': return 'Platinum';
      case 'silver': return 'Silver';
      case 'gold': return 'Gold';
      // Handle additional common variations
      case 'epic': return 'Legendary'; // Map Epic to Legendary
      case 'ultra rare': return 'Legendary';
      case 'super rare': return 'Rare';
      default:
        // PRESERVE ACTUAL RARITY - Don't default to Common for unknown values
        console.log(`🎨 Preserving unknown rarity: ${rarity}`);
        return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase(); // Capitalize first letter
    }
  }

  // Get daily reward preview for NFT rarity (unified for both onchain/offchain)
  getDailyRewardForRarity(rarity: string): number {
    if (!rarity) {
      console.log(`🎨 Empty rarity provided - using Common tier rewards (0.1 NEFT)`);
      return 0.1;
    }
    
    // For onchain NFTs, handle exact case-sensitive matching first
    const exactMatch = rarity.trim();
    switch (exactMatch) {
      case 'Common': case 'common': return 0.1;
      case 'Rare': case 'rare': return 0.4;
      case 'Legendary': case 'legendary': case 'Legend': case 'legend': return 1.0;
      case 'Platinum': case 'platinum': return 2.5;
      case 'Silver': case 'silver': return 8.0;
      case 'Gold': case 'gold': return 30.0;
    }
    
    // Fallback to normalized matching for offchain NFTs
    const normalizedRarity = this.normalizeRarity(rarity);
    switch (normalizedRarity) {
      case 'Common': return 0.1;
      case 'Rare': return 0.4;
      case 'Legendary': return 1.0;
      case 'Platinum': return 2.5;
      case 'Silver': return 8.0;
      case 'Gold': return 30.0;
      default: 
        // For truly unknown rarities, use a reasonable default
        console.log(`🎨 Unknown rarity '${rarity}' (normalized: '${normalizedRarity}') - using Rare tier rewards (0.4 NEFT)`);
        return 0.4; // Default to Rare tier instead of Common for unknown rarities
    }
  }

  // LIGHTWEIGHT: Register onchain NFT for rewards using existing stakeNFT with minimal data
  async registerOnchainNFTForRewards(
    walletAddress: string, 
    tokenId: string, 
    rarity: string, 
    transactionHash: string
  ): Promise<StakingResponse> {
    try {
      console.log(`🏆 [EnhancedStaking] Registering onchain NFT ${tokenId} for rewards (lightweight)`);
      
      // CRITICAL FIX: Create reward tracking entry that doesn't overwrite original NFT metadata
      // Use a completely separate ID that won't conflict with UI display
      const minimalNFT = {
        id: `reward_tracker_${tokenId}_${Date.now()}`, // Unique ID that won't conflict with UI
        name: `REWARD_TRACKER_ONLY`, // Special name that won't be displayed in UI
        description: 'Internal reward tracking - not for UI display',
        image: '', // Empty - not needed for rewards
        rarity: rarity,
        attributes: [],
        tokenId: tokenId,
        transactionHash: transactionHash,
        contractAddress: '', // Not needed for reward calculation
        metadataURI: '',
        wallet_address: walletAddress,
        claimed_at: new Date().toISOString(),
        claimed_blockchain: 'polygon',
        status: 'reward_tracking' as any, // Special status to exclude from UI
        fallback_images: [],
        ipfs_hash: '',
        // Mark this as internal tracking only
        internal_tracking_only: true
      };

      // Use existing stakeNFT function with 'onchain' source
      const result = await this.stakeNFT(walletAddress, minimalNFT, 'onchain', transactionHash);
      
      if (result.success) {
        console.log(`✅ [EnhancedStaking] Onchain NFT ${tokenId} registered for rewards (lightweight)`);
      }
      
      return result;
    } catch (error) {
      console.error('Error registering onchain NFT for rewards:', error);
      return {
        success: false,
        message: 'Failed to register onchain NFT for rewards',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // LIGHTWEIGHT: Unregister onchain NFT from rewards using existing unstakeNFT
  async unregisterOnchainNFTFromRewards(
    walletAddress: string, 
    tokenId: string
  ): Promise<StakingResponse> {
    try {
      console.log(`🏆 [EnhancedStaking] Unregistering onchain NFT ${tokenId} from rewards`);
      
      // Use the reward tracking ID format
      const rewardTrackingId = `onchain_reward_${tokenId}`;
      
      // Use existing unstakeNFT function
      const result = await this.unstakeNFT(walletAddress, rewardTrackingId);
      
      if (result.success) {
        console.log(`✅ [EnhancedStaking] Onchain NFT ${tokenId} unregistered from rewards`);
      }
      
      return result;
    } catch (error) {
      console.error('Error unregistering onchain NFT from rewards:', error);
      return {
        success: false,
        message: 'Failed to unregister onchain NFT from rewards',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get reward preview for multiple NFTs
  getRewardPreview(nfts: NFTData[]): { nft: NFTData; dailyReward: number }[] {
    return nfts.map(nft => ({
      nft,
      dailyReward: this.getDailyRewardForRarity(nft.rarity)
    }));
  }

  // Calculate total daily rewards for NFTs
  calculateTotalDailyRewards(nfts: NFTData[]): number {
    return nfts.reduce((total, nft) => {
      return total + this.getDailyRewardForRarity(nft.rarity);
    }, 0);
  }

  // Stake NFT with staking source tracking - OPTIMIZED (1 RPC call)
  async stakeNFT(
    walletAddress: string, 
    nft: NFTData, 
    stakingSource: 'offchain' | 'onchain' = 'offchain',
    transactionHash?: string
  ): Promise<StakingResponse> {
    try {
      const client = this.createClient(walletAddress);

      // 🔥 CRITICAL FIX: Preserve original rarity for onchain NFTs
      // Only normalize for offchain NFTs that might have inconsistent rarity values
      let finalRarity: string;
      
      if (stakingSource === 'onchain') {
        // For onchain NFTs, preserve the exact rarity from blockchain metadata
        finalRarity = nft.rarity;
        console.log(`🎨 ONCHAIN NFT: Preserving exact blockchain rarity: ${finalRarity}`);
      } else {
        // For offchain NFTs, apply normalization to handle variations
        finalRarity = this.normalizeRarity(nft.rarity);
        console.log(`🎨 OFFCHAIN NFT: Normalized rarity from ${nft.rarity} to ${finalRarity}`);
      }
      
      const expectedDailyReward = this.getDailyRewardForRarity(finalRarity);

      console.log(`🎨 Staking NFT: ${nft.name}, Source: ${stakingSource}, Final Rarity: ${finalRarity}, Expected Daily Reward: ${expectedDailyReward} NEFT`);

      const { data, error } = await client.rpc('stake_nft_with_source', {
        user_wallet: walletAddress,
        p_nft_id: nft.id, // 🔥 FIXED: Use p_nft_id to match database function parameter
        nft_rarity: finalRarity, // 🎯 Use finalRarity instead of normalizedRarity
        staking_source: stakingSource,
        transaction_hash: transactionHash || null
      });

      if (error) throw error;

      const result = this.parseRPCResponse(data);

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'NFT staking failed.',
          error: result.error
        };
      }

      // Log activity and update achievements
      await this.logActivity(walletAddress, {
        activityType: 'stake',
        title: `Staked ${nft.name} (${stakingSource})`,
        description: `Staked ${finalRarity} NFT: ${nft.name} via ${stakingSource} staking`,
        details: `Daily reward: ${result.daily_reward} NEFT, Source: ${stakingSource}, Actual Rarity: ${finalRarity}`,
        metadata: { 
          nft_id: nft.id, 
          nft_rarity: finalRarity, // 🎯 Use finalRarity for accurate logging
          original_rarity: nft.rarity, // Keep original for reference
          daily_reward: result.daily_reward,
          staking_source: stakingSource,
          transaction_hash: transactionHash
        }
      });

      await this.updateStakingAchievements(walletAddress, 'stake');
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: result.message,
        data: { 
          daily_reward: result.daily_reward,
          staking_source: stakingSource,
          transaction_hash: transactionHash,
          // UI UPDATE DATA - Everything needed for immediate UI refresh
          nftId: nft.id,
          stakingSource: stakingSource,
          isStaked: true,
          stakedAt: new Date().toISOString(),
          // Signal UI to update immediately
          immediateUpdate: {
            action: 'stake',
            nftId: nft.id,
            stakingSource: stakingSource,
            showLockOverlay: true,
            updateStakingCount: true
          }
        }
      };
    } catch (error) {
      console.error('Error staking NFT:', error);
      return {
        success: false,
        message: 'Failed to stake NFT. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Unstake NFT - OPTIMIZED (1 RPC call)
  async unstakeNFT(walletAddress: string, nftId: string): Promise<StakingResponse> {
    try {
      const client = this.createClient(walletAddress);

      console.log(`🔄 Attempting to unstake NFT: ${nftId} for wallet: ${walletAddress}`);

      // Call unstake_nft RPC function directly with NFT ID (not UUID)
      // This function will DELETE the staking record completely
      const { data, error } = await client.rpc('unstake_nft', {
        user_wallet: walletAddress,
        p_nft_id: nftId  // Use p_nft_id to match fixed database function
      });

      if (error) {
        console.error('❌ RPC Error in unstakeNFT:', error);
        throw error;
      }

      const result = this.parseRPCResponse(data);

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'NFT unstaking failed.',
          error: result.error
        };
      }

      // Log activity and update achievements
      await this.logActivity(walletAddress, {
        activityType: 'unstake',
        title: `Unstaked NFT`,
        description: `Unstaked NFT from staking pool`,
        details: `NFT ID: ${result.nft_id}`,
        metadata: { nft_id: result.nft_id }
      });

      await this.updateStakingAchievements(walletAddress, 'unstake');
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: result.message,
        data: { 
          nft_id: result.nft_id,
          // UI UPDATE DATA - Everything needed for immediate UI refresh
          nftId: nftId,
          stakingSource: 'offchain',
          isStaked: false,
          unstakedAt: new Date().toISOString(),
          // Signal UI to update immediately
          immediateUpdate: {
            action: 'unstake',
            nftId: nftId,
            stakingSource: 'offchain',
            showLockOverlay: false,
            updateStakingCount: true,
            removeLockOverlay: true
          }
        }
      };
    } catch (error) {
      console.error('Error unstaking NFT:', error);
      return {
        success: false,
        message: 'Failed to unstake NFT. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Stake tokens - OPTIMIZED (1 RPC call)
  async stakeTokens(walletAddress: string, amount: number, aprRate: number = 20): Promise<StakingResponse> {
    try {
      if (amount <= 0) {
        return { success: false, message: 'Amount must be greater than 0.' };
      }

      const client = this.createClient(walletAddress);

      const { data, error } = await client.rpc('stake_neft_tokens', {
        user_wallet: walletAddress,
        stake_amount: amount,
        apr_rate: aprRate
      });

      if (error) throw error;

      const result = this.parseRPCResponse(data);

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Token staking failed.',
          error: result.error
        };
      }

      // Log activity and update achievements
      await this.logActivity(walletAddress, {
        activityType: 'stake',
        title: `Staked ${amount} NEFT Tokens`,
        description: `Staked ${amount} NEFT tokens for ${aprRate}% APR`,
        details: `Daily reward: ${result.daily_reward} NEFT`,
        metadata: { amount, apr_rate: aprRate, daily_reward: result.daily_reward }
      });

      await this.updateStakingAchievements(walletAddress, 'stake');
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: result.message,
        data: {
          staked_id: result.staked_id,
          amount: result.amount,
          daily_reward: result.daily_reward
        }
      };
    } catch (error) {
      console.error('Error staking tokens:', error);
      return {
        success: false,
        message: 'Failed to stake tokens. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Unstake tokens - OPTIMIZED (1 RPC call)
  async unstakeTokens(walletAddress: string, stakedTokensId: string, unstakeAmount?: number): Promise<StakingResponse> {
    try {
      const client = this.createClient(walletAddress);

      const { data, error } = await client.rpc('unstake_neft_tokens', {
        user_wallet: walletAddress,
        staked_tokens_id: stakedTokensId,
        unstake_amount: unstakeAmount || null
      });

      if (error) throw error;

      const result = this.parseRPCResponse(data);

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Token unstaking failed.',
          error: result.error
        };
      }

      // Log activity and update achievements
      await this.logActivity(walletAddress, {
        activityType: 'unstake',
        title: `Unstaked ${unstakeAmount} NEFT Tokens`,
        description: `Unstaked ${unstakeAmount} NEFT tokens from staking pool`,
        details: `Amount unstaked: ${unstakeAmount} NEFT`,
        metadata: { amount: unstakeAmount, remaining_staked: result.remaining_staked }
      });

      await this.updateStakingAchievements(walletAddress, 'unstake');
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: result.message,
        data: {
          unstaked_amount: result.unstaked_amount,
          remaining_staked: result.remaining_staked
        }
      };
    } catch (error) {
      console.error('Error unstaking tokens:', error);
      return {
        success: false,
        message: 'Failed to unstake tokens. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Claim NFT rewards only
  async claimNFTRewards(walletAddress: string): Promise<StakingResponse> {
    try {
      const client = this.createClient(walletAddress);

      const { data, error } = await client.rpc('claim_nft_rewards_supabase_safe', {
        user_wallet: walletAddress
      });

      if (error) throw error;

      const result = this.parseRPCResponse(data);

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'NFT reward claiming failed.',
          error: result.error
        };
      }

      // Log activity
      await this.logActivity(walletAddress, {
        activityType: 'claim',
        title: `Claimed NFT Staking Rewards`,
        description: `Claimed ${result.nft_rewards_claimed || result.total_claimed} NEFT from NFT staking rewards`,
        details: `NFT Rewards: ${result.nft_rewards_claimed || result.total_claimed} NEFT`,
        metadata: {
          total_claimed: result.total_claimed,
          nft_rewards: result.nft_rewards_claimed || result.total_claimed,
          reward_type: 'nft_staking'
        }
      });

      // Emit balance update event
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: result.message,
        data: {
          total_claimed: result.total_claimed,
          nft_rewards_claimed: result.nft_rewards_claimed || result.total_claimed,
          reward_type: 'nft'
        }
      };
    } catch (error) {
      console.error('Error claiming NFT rewards:', error);
      return {
        success: false,
        message: 'Failed to claim NFT rewards',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Claim token rewards only
  async claimTokenRewards(walletAddress: string): Promise<StakingResponse> {
    try {
      const client = this.createClient(walletAddress);

      const { data, error } = await client.rpc('claim_token_rewards_supabase_safe', {
        user_wallet: walletAddress
      });

      if (error) throw error;

      const result = this.parseRPCResponse(data);

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Token reward claiming failed.',
          error: result.error
        };
      }

      // Log activity
      await this.logActivity(walletAddress, {
        activityType: 'claim',
        title: `Claimed Token Staking Rewards`,
        description: `Claimed ${result.token_rewards_claimed || result.total_claimed} NEFT from token staking rewards`,
        details: `Token Rewards: ${result.token_rewards_claimed || result.total_claimed} NEFT`,
        metadata: {
          total_claimed: result.total_claimed,
          token_rewards: result.token_rewards_claimed || result.total_claimed,
          reward_type: 'token_staking'
        }
      });

      // Emit balance update event
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: result.message,
        data: {
          total_claimed: result.total_claimed,
          token_rewards_claimed: result.token_rewards_claimed || result.total_claimed,
          reward_type: 'token'
        }
      };
    } catch (error) {
      console.error('Error claiming token rewards:', error);
      return {
        success: false,
        message: 'Failed to claim token rewards',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Legacy function for backward compatibility - now claims all rewards
  async claimRewards(walletAddress: string): Promise<StakingResponse> {
    try {
      const client = this.createClient(walletAddress);

      const { data, error } = await client.rpc('claim_all_staking_rewards', {
        user_wallet: walletAddress
      });

      if (error) throw error;

      const result = this.parseRPCResponse(data);

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Reward claiming failed.',
          error: result.error
        };
      }

      // Log activity
      await this.logActivity(walletAddress, {
        activityType: 'claim',
        title: `Claimed All Staking Rewards`,
        description: `Claimed ${result.total_claimed} NEFT from staking rewards`,
        details: `NFT: ${result.nft_rewards_claimed} NEFT, Tokens: ${result.token_rewards_claimed} NEFT`,
        metadata: {
          total_claimed: result.total_claimed,
          nft_rewards: result.nft_rewards_claimed,
          token_rewards: result.token_rewards_claimed
        }
      });

      // Emit balance update event
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: result.message,
        data: {
          total_claimed: result.total_claimed,
          nft_rewards_claimed: result.nft_rewards_claimed,
          token_rewards_claimed: result.token_rewards_claimed
        }
      };
    } catch (error) {
      console.error('Error claiming all rewards:', error);
      return {
        success: false,
        message: 'Failed to claim rewards',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Create and export the service instance
const enhancedStakingService = new EnhancedStakingService();
export default enhancedStakingService;
