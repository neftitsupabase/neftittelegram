import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';

// Types for activity tracking
type ActivityType = 'task' | 'claim' | 'burn' | 'stake' | 'unstake' | 'campaign' | 'daily_claim' | 'achievement' | 'referral';
type ActivityStatus = 'completed' | 'pending' | 'failed';

interface ActivityItem {
  id: string;
  type: ActivityType;
  activity_title: string;
  activity_description?: string;
  details?: string;
  neft_reward: number;
  xp_reward: number;
  nft_reward?: string;
  status: ActivityStatus;
  metadata?: any;
  created_at: string;
}

interface ActivityStats {
  total_activities: number;
  total_tasks_completed: number;
  total_claims: number;
  total_burns: number;
  total_stakes: number;
  total_neft_earned: number;
  total_xp_earned: number;
  last_activity_at?: string;
}

interface LogActivityRequest {
  activityType: ActivityType;
  title: string;
  description?: string;
  details?: string;
  neftReward?: number;
  xpReward?: number;
  nftReward?: string;
  status?: ActivityStatus;
  metadata?: any;
}

class ActivityTrackingService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Create Supabase client with wallet address header for RLS
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

  // Log a new user activity
  async logActivity(walletAddress: string, request: LogActivityRequest): Promise<string | null> {
    try {
      console.log(`🔄 Logging activity for wallet: ${walletAddress}`, request);

      // Supabase configuration is handled by centralized client manager

      // Validate required parameters
      if (!walletAddress || !request.activityType || !request.title) {
        console.error('❌ Missing required parameters for activity logging:', {
          walletAddress: !!walletAddress,
          activityType: !!request.activityType,
          title: !!request.title
        });
        return null;
      }

      const client = this.createClientWithWalletHeader(walletAddress);

      console.log('🔄 Calling Supabase RPC: log_user_activity with params:', {
        user_wallet: walletAddress,
        activity_type_param: request.activityType,
        title: request.title,
        description: request.description || null,
        details_param: request.details || null,
        neft_reward_param: request.neftReward || 0,
        xp_reward_param: request.xpReward || 0,
        nft_reward_param: request.nftReward || null,
        status_param: request.status || 'completed',
        metadata_param: request.metadata || null
      });

      const { data, error } = await client.rpc('log_user_activity', {
        user_wallet: walletAddress,
        activity_type_param: request.activityType,
        title: request.title,
        description: request.description || null,
        details_param: request.details || null,
        neft_reward_param: request.neftReward || 0,
        xp_reward_param: request.xpReward || 0,
        nft_reward_param: request.nftReward || null,
        status_param: request.status || 'completed',
        metadata_param: request.metadata || null
      });

      if (error) {
        console.error('❌ Supabase RPC error in logActivity:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          walletAddress,
          requestData: {
            user_wallet: walletAddress,
            activity_type_param: request.activityType,
            title: request.title,
            description: request.description || null,
            details_param: request.details || null,
            neft_reward_param: request.neftReward || 0,
            xp_reward_param: request.xpReward || 0,
            nft_reward_param: request.nftReward || null,
            status_param: request.status || 'completed',
            metadata_param: request.metadata || null
          }
        });
        throw error; // Throw error instead of returning null to see the actual error
      }

      console.log('✅ Activity logged successfully with ID:', data);
      return data; // Returns the activity ID
    } catch (error) {
      console.error('❌ Unexpected error in logActivity:', error);
      return null;
    }
  }

  // Get user activities with optional filtering
  async getUserActivities(
    walletAddress: string,
    activityType?: ActivityType,
    limit: number = 50,
    offset: number = 0
  ): Promise<ActivityItem[]> {
    try {
      console.log(`Getting activities for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('get_user_activities', {
        user_wallet: walletAddress,
        activity_type_filter: activityType || null,
        limit_count: limit,
        offset_count: offset
      });

      if (error) {
        console.error('Error getting user activities:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserActivities:', error);
      return [];
    }
  }

  // Get user activity statistics
  async getUserActivityStats(walletAddress: string): Promise<ActivityStats> {
    try {
      console.log(`Getting activity stats for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('get_user_activity_statistics', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('Error getting activity stats:', error);
        return {
          total_activities: 0,
          total_tasks_completed: 0,
          total_claims: 0,
          total_burns: 0,
          total_stakes: 0,
          total_neft_earned: 0,
          total_xp_earned: 0
        };
      }

      // RPC function returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;

      return {
        total_activities: parseInt(result?.total_activities || '0'),
        total_tasks_completed: parseInt(result?.total_tasks_completed || '0'),
        total_claims: parseInt(result?.total_claims || '0'),
        total_burns: parseInt(result?.total_burns || '0'),
        total_stakes: parseInt(result?.total_stakes || '0'),
        total_neft_earned: parseFloat(result?.total_neft_earned || '0'),
        total_xp_earned: parseInt(result?.total_xp_earned || '0'),
        last_activity_at: result?.last_activity_at
      };
    } catch (error) {
      console.error('Error in getUserActivityStats:', error);
      return {
        total_activities: 0,
        total_tasks_completed: 0,
        total_claims: 0,
        total_burns: 0,
        total_stakes: 0,
        total_neft_earned: 0,
        total_xp_earned: 0
      };
    }
  }

  // Convenience methods for logging specific activities
  async logTaskCompletion(walletAddress: string, taskName: string, neftReward: number = 0, xpReward: number = 0): Promise<string | null> {
    return this.logActivity(walletAddress, {
      activityType: 'task',
      title: `Completed '${taskName}'`,
      description: `You completed the ${taskName} task and earned rewards.`,
      neftReward,
      xpReward,
      status: 'completed'
    });
  }

  async logNFTClaim(walletAddress: string, nftType: string, nftId?: string): Promise<string | null> {
    return this.logActivity(walletAddress, {
      activityType: 'claim',
      title: `Claimed ${nftType} NFT`,
      description: `You successfully claimed a ${nftType} NFT from the marketplace.`,
      nftReward: nftId ? `${nftType} NFT #${nftId}` : `${nftType} NFT`,
      status: 'completed'
    });
  }

  async logNFTBurn(walletAddress: string, burnedCount: number, burnedType: string, receivedType: string, xpReward: number = 0): Promise<string | null> {
    return this.logActivity(walletAddress, {
      activityType: 'burn',
      title: `Burned ${burnedCount} ${burnedType} NFTs for ${receivedType}`,
      description: `You burned ${burnedCount} ${burnedType} NFTs in exchange for ${receivedType}. This is a great way to upgrade your collection!`,
      xpReward,
      status: 'completed'
    });
  }

  async logStaking(walletAddress: string, itemType: 'NFT' | 'tokens', amount?: number): Promise<string | null> {
    const title = itemType === 'NFT' ? 'Staked NFT' : `Staked ${amount} NEFT tokens`;
    const description = itemType === 'NFT'
      ? 'You staked an NFT to earn daily rewards.'
      : `You staked ${amount} NEFT tokens to earn staking rewards.`;

    return this.logActivity(walletAddress, {
      activityType: 'stake',
      title,
      description,
      status: 'completed'
    });
  }

  async logUnstaking(walletAddress: string, itemType: 'NFT' | 'tokens', amount?: number): Promise<string | null> {
    const title = itemType === 'NFT' ? 'Unstaked NFT' : `Unstaked ${amount} NEFT tokens`;
    const description = itemType === 'NFT'
      ? 'You unstaked an NFT and claimed your rewards.'
      : `You unstaked ${amount} NEFT tokens and claimed your rewards.`;

    return this.logActivity(walletAddress, {
      activityType: 'unstake',
      title,
      description,
      status: 'completed'
    });
  }

  async logCampaignParticipation(walletAddress: string, campaignName: string, neftReward: number = 0, xpReward: number = 0): Promise<string | null> {
    return this.logActivity(walletAddress, {
      activityType: 'campaign',
      title: `Participated in ${campaignName}`,
      description: `You participated in the ${campaignName} campaign and earned rewards.`,
      neftReward,
      xpReward,
      status: 'completed'
    });
  }

  async logDailyClaim(walletAddress: string, streakCount: number, neftReward: number, xpReward: number, nftReward?: string): Promise<string | null> {
    return this.logActivity(walletAddress, {
      activityType: 'daily_claim',
      title: `Daily Claim - Day ${streakCount}`,
      description: `You claimed your daily reward and maintained a ${streakCount}-day streak!`,
      neftReward,
      xpReward,
      nftReward,
      status: 'completed'
    });
  }

  async logAchievementUnlock(walletAddress: string, achievementName: string, neftReward: number = 0, xpReward: number = 0): Promise<string | null> {
    return this.logActivity(walletAddress, {
      activityType: 'achievement',
      title: `Unlocked Achievement: ${achievementName}`,
      description: `You unlocked the ${achievementName} achievement and earned rewards!`,
      neftReward,
      xpReward,
      status: 'completed'
    });
  }
}

// Export singleton instance
const activityTrackingService = new ActivityTrackingService();
export default activityTrackingService;

// Export types for use in components
export type {
  ActivityType,
  ActivityStatus,
  ActivityItem,
  ActivityStats,
  LogActivityRequest
};
