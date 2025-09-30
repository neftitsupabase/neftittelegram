import { SupabaseClient } from '@supabase/supabase-js';
import { NFTData } from './HybridIPFSService';
import activityTrackingService from './ActivityTrackingService';
import achievementsService from './AchievementsService';
import userBalanceService from './UserBalanceService';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';

// Interface definitions
interface StakedNFT {
  id: string;
  wallet_address: string;
  nft_id: string;
  nft_rarity: string;
  daily_reward: number;
  staked_at: string;
  last_reward_calculated: string;
}

interface StakedTokens {
  id: string;
  wallet_address: string;
  amount: number;
  apr_rate: number;
  daily_reward: number;
  staked_at: string;
  last_reward_calculated: string;
}

interface StakingReward {
  id: string;
  wallet_address: string;
  reward_type: 'nft_staking' | 'token_staking';
  source_id: string;
  reward_amount: number;
  reward_date: string;
  is_claimed: boolean;
  claimed_at?: string;
  created_at: string;
}

interface StakingHistory {
  id: string;
  wallet_address: string;
  action_type: 'stake_nft' | 'unstake_nft' | 'stake_tokens' | 'unstake_tokens' | 'claim_rewards';
  asset_type: 'nft' | 'tokens';
  asset_id?: string;
  amount?: number;
  transaction_hash?: string;
  created_at: string;
}

interface StakingSummary {
  staked_nfts_count: number;
  staked_tokens_amount: number;
  total_pending_rewards: number;
  daily_nft_rewards: number;
  daily_token_rewards: number;
}

class StakingService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Create Supabase client with wallet address header for RLS
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

  // Daily reward calculation based on rarity
  private getDailyReward(rarity: string): number {
    const rewardRates: Record<string, number> = {
      'Common': 0.1,
      'Rare': 0.4,
      'Legendary': 1.0,
      'Platinum': 2.5,
      'Silver': 8,
      'Gold': 30
    };
    return rewardRates[rarity] || 0.1;
  }

  // Calculate daily token reward based on amount and APR
  private calculateTokenDailyReward(amount: number, aprRate: number = 20): number {
    return (amount * aprRate / 100) / 365;
  }

  // Get user's staking summary (optimized single query)
  async getUserStakingSummary(walletAddress: string): Promise<StakingSummary> {
    try {
      console.log(`Getting staking summary for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('get_user_staking_summary_enhanced', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('Error getting staking summary from RPC:', error);
        // Fallback to individual queries if RPC function fails
        return await this.getUserStakingSummaryFallback(walletAddress);
      }

      // Parse the JSON response from the database function
      let parsedData;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (parseError) {
          console.error('Error parsing staking summary JSON:', parseError);
          return await this.getUserStakingSummaryFallback(walletAddress);
        }
      } else {
        parsedData = data;
      }

      // Ensure all required fields are present with proper types
      const result: StakingSummary = {
        staked_nfts_count: parseInt(parsedData?.staked_nfts_count || '0'),
        staked_tokens_amount: parseFloat(parsedData?.staked_tokens_amount || '0'),
        total_pending_rewards: parseFloat(parsedData?.total_pending_rewards || '0'),
        daily_nft_rewards: parseFloat(parsedData?.daily_nft_rewards || '0'),
        daily_token_rewards: parseFloat(parsedData?.daily_token_rewards || '0')
      };

      console.log('Staking summary retrieved successfully:', result);
      return result;
    } catch (error) {
      console.error('Error in getUserStakingSummary:', error);
      // Always fallback to ensure we return valid data
      return await this.getUserStakingSummaryFallback(walletAddress);
    }
  }

  // Fallback method for getting staking summary
  private async getUserStakingSummaryFallback(walletAddress: string): Promise<StakingSummary> {
    try {
      console.log(`Using fallback method for staking summary: ${walletAddress}`);
      const client = this.createClientWithWalletHeader(walletAddress);

      // Get staked NFTs count and rewards
      const { data: stakedNFTs, error: nftError } = await client
        .from('staked_nfts')
        .select('daily_reward')
        .eq('wallet_address', walletAddress);

      if (nftError) {
        console.error('Error fetching staked NFTs:', nftError);
      }

      // Get staked tokens amount and rewards
      const { data: stakedTokens, error: tokenError } = await client
        .from('staked_tokens')
        .select('amount, daily_reward')
        .eq('wallet_address', walletAddress);

      if (tokenError) {
        console.error('Error fetching staked tokens:', tokenError);
      }

      // Get pending rewards
      const { data: pendingRewards, error: rewardError } = await client
        .from('staking_rewards')
        .select('reward_amount')
        .eq('wallet_address', walletAddress)
        .eq('is_claimed', false);

      if (rewardError) {
        console.error('Error fetching pending rewards:', rewardError);
      }

      // Calculate summary with proper error handling
      const summary: StakingSummary = {
        staked_nfts_count: stakedNFTs?.length || 0,
        staked_tokens_amount: stakedTokens?.reduce((sum, token) => {
          const amount = parseFloat(token.amount?.toString() || '0');
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0) || 0,
        total_pending_rewards: pendingRewards?.reduce((sum, reward) => {
          const amount = parseFloat(reward.reward_amount?.toString() || '0');
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0) || 0,
        daily_nft_rewards: stakedNFTs?.reduce((sum, nft) => {
          const reward = parseFloat(nft.daily_reward?.toString() || '0');
          return sum + (isNaN(reward) ? 0 : reward);
        }, 0) || 0,
        daily_token_rewards: stakedTokens?.reduce((sum, token) => {
          const reward = parseFloat(token.daily_reward?.toString() || '0');
          return sum + (isNaN(reward) ? 0 : reward);
        }, 0) || 0
      };

      console.log('Fallback staking summary calculated:', summary);
      return summary;
    } catch (error) {
      console.error('Error in getUserStakingSummaryFallback:', error);
      // Return default values if everything fails
      return {
        staked_nfts_count: 0,
        staked_tokens_amount: 0,
        total_pending_rewards: 0,
        daily_nft_rewards: 0,
        daily_token_rewards: 0
      };
    }
  }

  // Get user's staked NFTs
  async getStakedNFTs(walletAddress: string): Promise<StakedNFT[]> {
    try {
      console.log(`Getting staked NFTs for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client
        .from('staked_nfts')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('staked_at', { ascending: false });

      if (error) {
        console.error('Error getting staked NFTs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getStakedNFTs:', error);
      return [];
    }
  }

  // Get user's staked tokens
  async getStakedTokens(walletAddress: string): Promise<StakedTokens[]> {
    try {
      console.log(`Getting staked tokens for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client
        .from('staked_tokens')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('staked_at', { ascending: false });

      if (error) {
        console.error('Error getting staked tokens:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getStakedTokens:', error);
      return [];
    }
  }

  // Stake an NFT
  async stakeNFT(walletAddress: string, nft: NFTData): Promise<{ success: boolean; message: string; data?: StakedNFT }> {
    try {
      console.log(`Staking NFT for wallet: ${walletAddress}, NFT ID: ${nft.id}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      // Check if this specific NFT is already staked
      const { data: nftAlreadyStaked } = await client
        .from('staked_nfts')
        .select('id')
        .eq('wallet_address', walletAddress)
        .eq('nft_id', nft.id);

      if (nftAlreadyStaked && nftAlreadyStaked.length > 0) {
        return {
          success: false,
          message: 'This NFT is already staked.'
        };
      }

      const dailyReward = this.getDailyReward(nft.rarity);

      // Insert staked NFT
      const { data, error } = await client
        .from('staked_nfts')
        .insert({
          wallet_address: walletAddress,
          nft_id: nft.id,
          nft_rarity: nft.rarity,
          daily_reward: dailyReward
        })
        .select()
        .single();

      if (error) {
        console.error('Error staking NFT:', error);
        return {
          success: false,
          message: 'Failed to stake NFT. Please try again.'
        };
      }

      // Record staking history
      await client
        .from('staking_history')
        .insert({
          wallet_address: walletAddress,
          action_type: 'stake_nft',
          asset_type: 'nft',
          asset_id: nft.id
        });

      // Log activity to activity tracker
      try {
        const activityId = await activityTrackingService.logActivity(walletAddress, {
          activityType: 'stake',
          title: `Staked ${nft.name}`,
          description: `Staked ${nft.rarity} NFT: ${nft.name}`,
          details: `Daily reward: ${dailyReward} NEFT`,
          neftReward: 0,
          xpReward: 10,
          metadata: {
            nft_id: nft.id,
            nft_name: nft.name,
            nft_rarity: nft.rarity,
            daily_reward: dailyReward
          }
        });
        console.log('Staking activity logged successfully:', activityId);
      } catch (activityError) {
        console.error('Failed to log staking activity:', activityError);
        // Don't fail the staking operation if activity logging fails
      }

      // Update staking achievements
      try {
        console.log('Updating staking achievements for NFT staking...');
        await achievementsService.updateStakingAchievements(walletAddress, 'stake', 1);
        console.log('NFT staking achievements updated successfully');
      } catch (achievementError) {
        console.error('Failed to update NFT staking achievements:', achievementError);
        // Don't fail the staking operation if achievement update fails
      }

      return {
        success: true,
        message: `Successfully staked ${nft.name}! You'll earn ${dailyReward} NEFT daily.`,
        data
      };
    } catch (error) {
      console.error('Error in stakeNFT:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while staking NFT.'
      };
    }
  }

  // Unstake an NFT
  async unstakeNFT(walletAddress: string, stakedNFTId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`Unstaking NFT for wallet: ${walletAddress}, Staked NFT ID: ${stakedNFTId}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      // Get the staked NFT details before deleting
      const { data: stakedNFT } = await client
        .from('staked_nfts')
        .select('nft_id')
        .eq('id', stakedNFTId)
        .eq('wallet_address', walletAddress)
        .single();

      if (!stakedNFT) {
        return {
          success: false,
          message: 'Staked NFT not found or you do not have permission to unstake it.'
        };
      }

      // Remove from staked NFTs
      const { error } = await client
        .from('staked_nfts')
        .delete()
        .eq('id', stakedNFTId)
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error unstaking NFT:', error);
        return {
          success: false,
          message: 'Failed to unstake NFT. Please try again.'
        };
      }

      // Record unstaking history
      await client
        .from('staking_history')
        .insert({
          wallet_address: walletAddress,
          action_type: 'unstake_nft',
          asset_type: 'nft',
          asset_id: stakedNFT.nft_id
        });

      // Log activity to activity tracker
      try {
        const activityId = await activityTrackingService.logActivity(walletAddress, {
          activityType: 'unstake',
          title: 'Unstaked NFT',
          description: 'Unstaked NFT from staking pool',
          details: `NFT ID: ${stakedNFT.nft_id}`,
          neftReward: 0,
          xpReward: 5,
          metadata: {
            nft_id: stakedNFT.nft_id,
            action: 'unstake_nft'
          }
        });
        console.log('Unstaking activity logged successfully:', activityId);
      } catch (activityError) {
        console.error('Failed to log unstaking activity:', activityError);
        // Don't fail the unstaking operation if activity logging fails
      }

      return {
        success: true,
        message: 'Successfully unstaked NFT!'
      };
    } catch (error) {
      console.error('Error in unstakeNFT:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while unstaking NFT.'
      };
    }
  }

  // Stake tokens
  async stakeTokens(walletAddress: string, amount: number, aprRate: number = 20): Promise<{ success: boolean; message: string; data?: StakedTokens }> {
    try {
      console.log(`Staking tokens for wallet: ${walletAddress}, Amount: ${amount}`);

      if (amount <= 0) {
        return {
          success: false,
          message: 'Amount must be greater than 0.'
        };
      }

      // Check if user has sufficient available balance
      const currentBalance = await userBalanceService.getUserBalance(walletAddress);
      if (currentBalance.available_neft < amount) {
        return {
          success: false,
          message: `Insufficient balance. Available: ${currentBalance.available_neft} NEFT, Required: ${amount} NEFT`
        };
      }

      const client = this.createClientWithWalletHeader(walletAddress);
      const dailyReward = this.calculateTokenDailyReward(amount, aprRate);

      // Insert staked tokens
      const { data, error } = await client
        .from('staked_tokens')
        .insert({
          wallet_address: walletAddress,
          amount: amount,
          apr_rate: aprRate,
          daily_reward: dailyReward
        })
        .select()
        .single();

      if (error) {
        console.error('Error staking tokens:', error);
        return {
          success: false,
          message: 'Failed to stake tokens. Please try again.'
        };
      }

      // Update user balance: move tokens from available to staked
      const balanceUpdateSuccess = await userBalanceService.stakeTokens(
        walletAddress,
        amount,
        'Token Staking'
      );

      if (!balanceUpdateSuccess) {
        // Rollback staking if balance update fails
        await client
          .from('staked_tokens')
          .delete()
          .eq('id', data.id);

        return {
          success: false,
          message: 'Failed to update balance. Staking cancelled.'
        };
      }

      // Record staking history
      await client
        .from('staking_history')
        .insert({
          wallet_address: walletAddress,
          action_type: 'stake_tokens',
          asset_type: 'tokens',
          amount: amount
        });

      // Log activity to activity tracker
      try {
        const activityId = await activityTrackingService.logActivity(walletAddress, {
          activityType: 'stake',
          title: `Staked ${amount} NEFT Tokens`,
          description: `Staked ${amount} NEFT tokens for ${aprRate}% APR`,
          details: `Daily reward: ${dailyReward.toFixed(4)} NEFT`,
          neftReward: 0,
          xpReward: 15,
          metadata: {
            amount: amount,
            apr_rate: aprRate,
            daily_reward: dailyReward,
            action: 'stake_tokens'
          }
        });
        console.log('Token staking activity logged successfully:', activityId);
      } catch (activityError) {
        console.error('Failed to log token staking activity:', activityError);
        // Don't fail the staking operation if activity logging fails
      }

      // Update staking achievements
      try {
        console.log('Updating staking achievements for token staking...');
        await achievementsService.updateStakingAchievements(walletAddress, 'stake', 1);
        console.log('Token staking achievements updated successfully');
      } catch (achievementError) {
        console.error('Failed to update token staking achievements:', achievementError);
        // Don't fail the staking operation if achievement update fails
      }

      // Emit balance update events
      window.dispatchEvent(new CustomEvent('tokens-staked', { detail: { walletAddress, amount } }));
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: `Successfully staked ${amount} NEFT! You'll earn ${dailyReward.toFixed(4)} NEFT daily.`,
        data
      };
    } catch (error) {
      console.error('Error in stakeTokens:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while staking tokens.'
      };
    }
  }

  // Unstake tokens
  async unstakeTokens(walletAddress: string, stakedTokensId: string): Promise<{ success: boolean; message: string; amount?: number }> {
    try {
      console.log(`Unstaking tokens for wallet: ${walletAddress}, Staked Tokens ID: ${stakedTokensId}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      // Get the staked tokens details before deleting
      const { data: stakedTokens } = await client
        .from('staked_tokens')
        .select('amount')
        .eq('id', stakedTokensId)
        .eq('wallet_address', walletAddress)
        .single();

      if (!stakedTokens) {
        return {
          success: false,
          message: 'Staked tokens not found or you do not have permission to unstake them.'
        };
      }

      // Remove from staked tokens
      const { error } = await client
        .from('staked_tokens')
        .delete()
        .eq('id', stakedTokensId)
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error unstaking tokens:', error);
        return {
          success: false,
          message: 'Failed to unstake tokens. Please try again.'
        };
      }

      // Update user balance: move tokens from staked back to available
      const balanceUpdateSuccess = await userBalanceService.unstakeTokens(
        walletAddress,
        stakedTokens.amount,
        'Token Unstaking'
      );

      if (!balanceUpdateSuccess) {
        console.error('Failed to update balance after unstaking, but tokens were unstaked');
        // Don't fail the operation as tokens were already unstaked
      }

      // Record unstaking history
      await client
        .from('staking_history')
        .insert({
          wallet_address: walletAddress,
          action_type: 'unstake_tokens',
          asset_type: 'tokens',
          amount: stakedTokens.amount
        });

      // Log activity to activity tracker
      try {
        const activityId = await activityTrackingService.logActivity(walletAddress, {
          activityType: 'unstake',
          title: `Unstaked ${stakedTokens.amount} NEFT Tokens`,
          description: `Unstaked ${stakedTokens.amount} NEFT tokens from staking pool`,
          details: `Amount unstaked: ${stakedTokens.amount} NEFT`,
          neftReward: 0,
          xpReward: 5,
          metadata: {
            amount: stakedTokens.amount,
            action: 'unstake_tokens'
          }
        });
        console.log('Token unstaking activity logged successfully:', activityId);
      } catch (activityError) {
        console.error('Failed to log token unstaking activity:', activityError);
        // Don't fail the unstaking operation if activity logging fails
      }

      // Emit balance update events
      window.dispatchEvent(new CustomEvent('tokens-unstaked', { detail: { walletAddress, amount: stakedTokens.amount } }));
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      return {
        success: true,
        message: `Successfully unstaked ${stakedTokens.amount} NEFT!`,
        amount: stakedTokens.amount
      };
    } catch (error) {
      console.error('Error in unstakeTokens:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while unstaking tokens.'
      };
    }
  }

  // Get pending rewards
  async getPendingRewards(walletAddress: string): Promise<StakingReward[]> {
    try {
      console.log(`Getting pending rewards for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client
        .from('staking_rewards')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('is_claimed', false)
        .order('reward_date', { ascending: false });

      if (error) {
        console.error('Error getting pending rewards:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPendingRewards:', error);
      return [];
    }
  }

  // Claim rewards
  async claimRewards(walletAddress: string, rewardIds?: string[]): Promise<{ success: boolean; message: string; totalClaimed?: number }> {
    try {
      console.log(`Claiming rewards for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      // Get rewards to claim
      let query = client
        .from('staking_rewards')
        .select('id, reward_amount')
        .eq('wallet_address', walletAddress)
        .eq('is_claimed', false);

      if (rewardIds && rewardIds.length > 0) {
        query = query.in('id', rewardIds);
      }

      const { data: rewardsToClaim, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching rewards to claim:', fetchError);
        return {
          success: false,
          message: 'Failed to fetch rewards. Please try again.'
        };
      }

      if (!rewardsToClaim || rewardsToClaim.length === 0) {
        return {
          success: false,
          message: 'No rewards available to claim.'
        };
      }

      const totalAmount = rewardsToClaim.reduce((sum, reward) => sum + reward.reward_amount, 0);
      const rewardIdsToUpdate = rewardsToClaim.map(reward => reward.id);

      // Mark rewards as claimed
      const { error: updateError } = await client
        .from('staking_rewards')
        .update({
          is_claimed: true,
          claimed_at: new Date().toISOString()
        })
        .in('id', rewardIdsToUpdate);

      if (updateError) {
        console.error('Error claiming rewards:', updateError);
        return {
          success: false,
          message: 'Failed to claim rewards. Please try again.'
        };
      }

      // Record claim history
      await client
        .from('staking_history')
        .insert({
          wallet_address: walletAddress,
          action_type: 'claim_rewards',
          asset_type: 'tokens',
          amount: totalAmount
        });

      return {
        success: true,
        message: `Successfully claimed ${totalAmount.toFixed(4)} NEFT rewards!`,
        totalClaimed: totalAmount
      };
    } catch (error) {
      console.error('Error in claimRewards:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while claiming rewards.'
      };
    }
  }

  // Get staking history
  async getStakingHistory(walletAddress: string, limit: number = 50): Promise<StakingHistory[]> {
    try {
      console.log(`Getting staking history for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client
        .from('staking_history')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting staking history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getStakingHistory:', error);
      return [];
    }
  }

  // Manual reward calculation (for testing or manual triggers)
  async calculateRewards(walletAddress: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`Manually calculating rewards for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { error } = await client.rpc('calculate_daily_rewards');

      if (error) {
        console.error('Error calculating rewards:', error);
        return {
          success: false,
          message: 'Failed to calculate rewards. Please try again.'
        };
      }

      return {
        success: true,
        message: 'Rewards calculated successfully!'
      };
    } catch (error) {
      console.error('Error in calculateRewards:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while calculating rewards.'
      };
    }
  }

  // Get user's available token balance (initial balance - staked tokens)
  async getAvailableTokenBalance(walletAddress: string, initialBalance: number = 10000): Promise<number> {
    try {
      console.log(`Getting available token balance for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      // Get total staked tokens
      const { data: stakedTokens, error } = await client
        .from('staked_tokens')
        .select('amount')
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error getting staked tokens for balance calculation:', error);
        return initialBalance; // Return initial balance if error
      }

      // Calculate total staked amount
      const totalStaked = stakedTokens?.reduce((sum, token) => sum + parseFloat(token.amount.toString()), 0) || 0;

      // Available balance = initial balance - total staked
      const availableBalance = Math.max(0, initialBalance - totalStaked);

      console.log(`Available balance: ${availableBalance} (Initial: ${initialBalance}, Staked: ${totalStaked})`);
      return availableBalance;
    } catch (error) {
      console.error('Error in getAvailableTokenBalance:', error);
      return initialBalance; // Return initial balance if error
    }
  }
}

// Export singleton instance
const stakingService = new StakingService();
export default stakingService;

// Export types for use in components
export type {
  StakedNFT,
  StakedTokens,
  StakingReward,
  StakingHistory,
  StakingSummary
};
