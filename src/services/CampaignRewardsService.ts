import { SupabaseClient } from '@supabase/supabase-js';
import activityTrackingService from './ActivityTrackingService';
import achievementsService from './AchievementsService';
import userBalanceService from './UserBalanceService';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';

// Types for campaign rewards
interface CampaignRewardClaim {
  id: string;
  wallet_address: string;
  project_id: string;
  neft_reward: number;
  xp_reward: number;
  claimed_at: string;
}

interface UserBalance {
  total_neft: number;
  total_xp: number;
}

interface ClaimRewardRequest {
  projectId: string;
  neftReward: number;
  xpReward: number;
}

interface ClaimRewardResponse {
  success: boolean;
  message: string;
  data?: CampaignRewardClaim;
}

class CampaignRewardsService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Create Supabase client with wallet address header for RLS
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

  //Check if user can claim rewards for a specific project (uses existing RPC)
  async canClaimProjectReward(walletAddress: string, projectId: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking claim eligibility:`);
      console.log(`  Wallet: ${walletAddress}`);
      console.log(`  Project: ${projectId}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('can_claim_project_reward', {
        user_wallet: walletAddress,
        proj_id: projectId
      });

      if (error) {
        console.error('❌ RPC Error:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        console.error('❌ Error hint:', error.hint);
        return false;
      }

      console.log(`✅ RPC Response:`, data);
      console.log(`✅ Data type:`, typeof data);
      console.log(`✅ Can claim:`, data === true);

      // If function returns false, let's understand why
      if (data === false) {
        console.log('⚠️ Function returned false - checking reasons...');

        // Check if claim record exists
        const { data: claimData, error: claimError } = await client
          .from('campaign_reward_claims')
          .select('*')
          .eq('wallet_address', walletAddress)
          .eq('project_id', projectId);

        if (!claimError && claimData) {
          console.log(`📋 Claim records found:`, claimData.length);
          if (claimData.length > 0) {
            console.log(`📋 Claim record:`, claimData[0]);
          }
        }

        // Check task completions
        const { data: taskData, error: taskError } = await client
          .from('user_task_completions')
          .select('*')
          .eq('wallet_address', walletAddress)
          .eq('project_id', projectId)
          .eq('completed', true);

        if (!taskError && taskData) {
          console.log(`📋 Completed tasks:`, taskData.length);
        }
      }

      return data === true;
    } catch (error) {
      console.error('❌ Exception in canClaimProjectReward:', error);
      return false;
    }
  }

  //Get detailed claim status for a specific project
  async getClaimStatus(walletAddress: string, projectId: string): Promise<{
    can_claim: boolean;
    already_claimed: boolean;
    all_tasks_completed: boolean;
    completed_tasks: number;
    total_tasks: number;
    completion_percentage: number;
  }> {
    try {
      console.log(`Getting detailed claim status for project: ${projectId}, wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('can_claim_project_reward_enhanced', {
        user_wallet: walletAddress,
        proj_id: projectId
      });

      if (error) {
        console.error('Error getting claim status:', error);
        return {
          can_claim: false,
          already_claimed: false,
          all_tasks_completed: false,
          completed_tasks: 0,
          total_tasks: 0,
          completion_percentage: 0
        };
      }

      return {
        can_claim: data?.can_claim || false,
        already_claimed: data?.already_claimed || false,
        all_tasks_completed: data?.all_tasks_completed || false,
        completed_tasks: data?.completed_tasks || 0,
        total_tasks: data?.total_tasks || 0,
        completion_percentage: data?.completion_percentage || 0
      };
    } catch (error) {
      console.error('Error in getClaimStatus:', error);
      return {
        can_claim: false,
        already_claimed: false,
        all_tasks_completed: false,
        completed_tasks: 0,
        total_tasks: 0,
        completion_percentage: 0
      };
    }
  }

  // Claim campaign rewards for a project
  async claimCampaignReward(
    walletAddress: string,
    request: ClaimRewardRequest
  ): Promise<ClaimRewardResponse> {
    try {
      console.log(`Claiming campaign reward for wallet: ${walletAddress}, project: ${request.projectId}`);

      // First check if user can claim using existing function
      const canClaim = await this.canClaimProjectReward(walletAddress, request.projectId);
      if (!canClaim) {
        return {
          success: false,
          message: 'You have already claimed rewards for this project.'
        };
      }

      const client = this.createClientWithWalletHeader(walletAddress);

      // Insert reward claim
      const { data, error } = await client
        .from('campaign_reward_claims')
        .insert({
          wallet_address: walletAddress,
          project_id: request.projectId,
          neft_reward: request.neftReward,
          xp_reward: request.xpReward
        })
        .select()
        .single();

      if (error) {
        console.error('Error claiming campaign reward:', error);
        return {
          success: false,
          message: 'Failed to claim rewards. Please try again.'
        };
      }

      console.log('Campaign reward claimed successfully:', data);

      // CRITICAL FIX: Trigger balance sync via UserBalanceService
      //This ensures the UI displays correct balance after campaign reward claims
      try {
        console.log(`Triggering balance sync for wallet: ${walletAddress}`);
        await userBalanceService.requestBalanceSync(walletAddress, 'Campaign Reward Claim');
        console.log('Campaign reward balance sync triggered successfully');
      } catch (balanceError) {
        console.error('Failed to trigger balance sync for campaign reward:', balanceError);
        // Don't fail the claim operation if balance sync fails
        // The database function should handle the update, this is just a backup
      }

      // Emit balance update event for UI refresh
      userBalanceService.emitBalanceUpdateEvent(walletAddress);

      // Log campaign reward activity
      try {
        const activityId = await activityTrackingService.logActivity(walletAddress, {
          activityType: 'campaign',
          title: 'Campaign Reward Claimed',
          description: `Claimed rewards from campaign project: ${request.projectId}`,
          details: `Rewards: ${request.neftReward} NEFT, ${request.xpReward} XP`,
          neftReward: request.neftReward,
          xpReward: request.xpReward,
          metadata: {
            project_id: request.projectId,
            neft_reward: request.neftReward,
            xp_reward: request.xpReward,
            claim_id: data.id
          }
        });
        console.log('Campaign reward activity logged successfully:', activityId);
      } catch (activityError) {
        console.error('Failed to log campaign reward activity:', activityError);
      }

      // Update campaign achievements
      try {
        console.log('Updating campaign achievements...');
        await achievementsService.updateCampaignAchievements(walletAddress, 'participate', 1);
        console.log('Campaign achievements updated successfully');
      } catch (achievementError) {
        console.error('Failed to update campaign achievements:', achievementError);
        // Don't fail the claim operation if achievement update fails
      }

      return {
        success: true,
        message: `Successfully claimed ${request.neftReward} NEFT and ${request.xpReward} XP!`,
        data: data
      };
    } catch (error) {
      console.error('Error in claimCampaignReward:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while claiming rewards.'
      };
    }
  }

  // Get user's total balances (NEFT + XP from all campaigns)
  async getUserTotalBalances(walletAddress: string): Promise<UserBalance> {
    try {
      console.log(`Getting total balances for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('get_user_total_balances', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('Error getting user total balances:', error);
        return { total_neft: 0, total_xp: 0 };
      }

      // RPC function returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;

      return {
        total_neft: parseFloat(result?.total_neft || '0'),
        total_xp: parseInt(result?.total_xp || '0')
      };
    } catch (error) {
      console.error('Error in getUserTotalBalances:', error);
      return { total_neft: 0, total_xp: 0 };
    }
  }

  // Get user's claimed rewards history
  async getUserClaimedRewards(walletAddress: string): Promise<CampaignRewardClaim[]> {
    try {
      console.log(`Getting claimed rewards history for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client
        .from('campaign_reward_claims')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('claimed_at', { ascending: false });

      if (error) {
        console.error('Error getting claimed rewards:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserClaimedRewards:', error);
      return [];
    }
  }

  // Get available NEFT tokens for staking (uses UserBalanceService - no redundant calculations)
  async getAvailableNEFTForStaking(walletAddress: string): Promise<number> {
    try {
      console.log(`Getting available NEFT for staking from UserBalanceService, wallet: ${walletAddress}`);

      // Use UserBalanceService which reads from user_balances.available_neft
      // This already accounts for all NEFT sources minus staked amounts
      const userBalanceService = (await import('./UserBalanceService')).default;
      const balance = await userBalanceService.getUserBalance(walletAddress);

      console.log(`Available NEFT from UserBalanceService:`, {
        available_neft: balance.available_neft,
        total_neft_claimed: balance.total_neft_claimed,
        wallet: walletAddress
      });

      return Math.max(0, balance.available_neft || 0);
    } catch (error) {
      console.error('Error in getAvailableNEFTForStaking:', error);
      return 0; // Return 0 if unable to fetch balance
    }
  }
}

// Export singleton instance
const campaignRewardsService = new CampaignRewardsService();
export default campaignRewardsService;

// Export types for use in components
export type {
  CampaignRewardClaim,
  UserBalance,
  ClaimRewardRequest,
  ClaimRewardResponse
};
