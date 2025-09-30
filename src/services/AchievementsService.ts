import { SupabaseClient } from '@supabase/supabase-js';
import activityTrackingService from './ActivityTrackingService';
import userBalanceService from './UserBalanceService';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';

// Types for achievements - FRESH SYSTEM
type AchievementCategory = 'quest' | 'burn' | 'referral' | 'checkin' | 'staking';
type AchievementStatus = 'locked' | 'in_progress' | 'completed' | 'claimed';

interface Achievement {
  achievement_key: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon?: string;
  color: string;
  neft_reward: number;
  xp_reward: number;
  required_count: number;
  current_progress: number;
  status: AchievementStatus;
  completed_at?: string;
  claimed_at?: string;
  progress_percentage: number;
}

interface ClaimRewardResult {
  success: boolean;
  message: string;
  neft_reward?: number;
  xp_reward?: number;
}

interface ProgressUpdateResult {
  achievement_completed: boolean;
  new_progress: number;
  required_count: number;
}

class AchievementsService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Create Supabase client with wallet address header for RLS (no caching to avoid stale data)
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

  // FRESH SYSTEM: Get user achievements with minimal egress
  async getUserAchievements(walletAddress: string, category?: AchievementCategory): Promise<Achievement[]> {
    try {
      console.log(`🎯 FRESH: Getting achievements for wallet: ${walletAddress}, category: ${category || 'all'}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      // ULTRA LOW EGRESS: Single function call that checks ALL user activity
      const { data, error } = await client.rpc('get_user_achievement_status', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('❌ Error getting achievement status:', error);
        return [];
      }

      // Parse JSON response
      let achievements: Achievement[] = [];
      if (typeof data === 'string') {
        try {
          achievements = JSON.parse(data);
        } catch (parseError) {
          console.error('❌ Error parsing achievements JSON:', parseError);
          return [];
        }
      } else if (Array.isArray(data)) {
        achievements = data;
      }

      // Filter by category if specified
      if (category) {
        achievements = achievements.filter(a => a.category === category);
      }

      console.log(`✅ FRESH: Loaded ${achievements.length} achievements`);
      const completed = achievements.filter(a => a.status === 'completed');
      const claimed = achievements.filter(a => a.status === 'claimed');
      console.log(`🏆 ${completed.length} completed, 💰 ${claimed.length} claimed`);

      return achievements;
    } catch (error) {
      console.error('❌ Error in getUserAchievements:', error);
      return [];
    }
  }

  // Update achievement progress with proper state transitions
  async updateAchievementProgress(
    walletAddress: string,
    achievementKey: string,
    progressIncrement: number = 1
  ): Promise<ProgressUpdateResult | null> {
    try {
      console.log(`🔄 Updating achievement progress: ${achievementKey} for wallet: ${walletAddress}, increment: ${progressIncrement}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('update_achievement_progress', {
        user_wallet: walletAddress,
        achievement_key_param: achievementKey,
        progress_increment: progressIncrement
      });

      if (error) {
        console.error('❌ Error updating achievement progress:', error);
        return null;
      }

      // RPC function returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;
      const newProgress = parseInt(result?.new_progress || '0');
      const achievementCompleted = result?.achievement_completed === true;
      
      // Get the target value from achievements master for logging
      let requiredCount = 0;
      if (achievementKey === 'daily_visitor') {
        requiredCount = 7;
      } else if (achievementKey === 'dedicated_user') {
        requiredCount = 30;
      } else {
        // For other achievements, we'll need to fetch from master table
        // For now, use a default or fetch separately
        requiredCount = 1;
      }

      // Log state transition information with ACTUAL database values
      console.log(`📊 RAW DATABASE RESPONSE: ${JSON.stringify(result)}`);
      console.log(`📊 PARSED VALUES: newProgress=${newProgress}, completed=${achievementCompleted}, requiredCount=${requiredCount}`);
      
      if (newProgress === 1 && progressIncrement === 1) {
        console.log(`🔓 Achievement ${achievementKey} transitioned from LOCKED → IN_PROGRESS (${newProgress}/${requiredCount})`);
      } else if (achievementCompleted) {
        console.log(`🏆 Achievement ${achievementKey} transitioned to COMPLETED (${newProgress}/${requiredCount})`);
      } else {
        console.log(`⏫ Achievement ${achievementKey} progress updated: ${newProgress}/${requiredCount}`);
      }

      // AUTOMATIC PROGRESSIVE UNLOCKING - Trigger when achievements complete
      if (achievementCompleted) {
        await this.handleProgressiveUnlocking(walletAddress, achievementKey);
      }

      return {
        achievement_completed: achievementCompleted,
        new_progress: newProgress,
        required_count: requiredCount
      };
    } catch (error) {
      console.error('❌ Error in updateAchievementProgress:', error);
      return null;
    }
  }

  // Set absolute achievement progress (for streak-based achievements)
  async setAchievementProgress(
    walletAddress: string,
    achievementKey: string,
    absoluteProgress: number
  ): Promise<ProgressUpdateResult | null> {
    try {
      console.log(`🎯 Setting absolute achievement progress: ${achievementKey} for wallet: ${walletAddress}, progress: ${absoluteProgress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      // Direct database update to set absolute progress
      const { data, error } = await client.rpc('set_achievement_absolute_progress', {
        user_wallet: walletAddress,
        achievement_key_param: achievementKey,
        absolute_progress: absoluteProgress
      });

      if (error) {
        console.error('❌ Error setting absolute achievement progress:', error);
        // Fallback to increment-based approach
        return await this.setAchievementProgressFallback(walletAddress, achievementKey, absoluteProgress);
      }

      const result = Array.isArray(data) ? data[0] : data;
      console.log(`✅ Set ${achievementKey} absolute progress: ${result?.new_progress}/${result?.required_count}`);

      return {
        achievement_completed: result?.achievement_completed || false,
        new_progress: result?.new_progress || absoluteProgress,
        required_count: result?.required_count || (achievementKey === 'daily_visitor' ? 7 : achievementKey === 'dedicated_user' ? 30 : 1)
      };
    } catch (error) {
      console.error('❌ Error in setAchievementProgress:', error);
      return await this.setAchievementProgressFallback(walletAddress, achievementKey, absoluteProgress);
    }
  }

  // Fallback method using increment-based approach
  private async setAchievementProgressFallback(
    walletAddress: string,
    achievementKey: string,
    absoluteProgress: number
  ): Promise<ProgressUpdateResult | null> {
    try {
      console.log(`🔄 Using fallback method for ${achievementKey}`);
      
      // First get current progress to calculate the increment needed
      const achievements = await this.getUserAchievements(walletAddress);
      const currentAchievement = achievements.find(a => a.achievement_key === achievementKey);
      const currentProgress = currentAchievement?.current_progress || 0;
      
      // Calculate the increment needed to reach the absolute progress
      const progressIncrement = absoluteProgress - currentProgress;
      
      if (progressIncrement <= 0) {
        console.log(`⚠️ No progress update needed for ${achievementKey}: current=${currentProgress}, target=${absoluteProgress}`);
        return {
          achievement_completed: false,
          new_progress: currentProgress,
          required_count: achievementKey === 'daily_visitor' ? 7 : achievementKey === 'dedicated_user' ? 30 : 1
        };
      }

      // Use the existing updateAchievementProgress method with the calculated increment
      return await this.updateAchievementProgress(walletAddress, achievementKey, progressIncrement);
    } catch (error) {
      console.error('❌ Error in setAchievementProgressFallback:', error);
      return null;
    }
  }

  // Handle automatic progressive unlocking when base achievements complete
  private async handleProgressiveUnlocking(walletAddress: string, completedAchievementKey: string): Promise<void> {
    try {
      console.log(`🔓 Handling progressive unlocking for completed achievement: ${completedAchievementKey}`);
      
      // Define progressive achievement mappings
      const progressiveMap: Record<string, string[]> = {
        'first_quest': ['quest_master', 'quest_legend'],
        'first_burn': ['burn_enthusiast', 'burn_master'],
        'first_stake': ['staking_pro'],
        'campaign_participant': ['campaign_champion'],
        'daily_visitor': ['dedicated_user']
      };

      const relatedAchievements = progressiveMap[completedAchievementKey];
      if (!relatedAchievements || relatedAchievements.length === 0) {
        console.log(`No progressive achievements to unlock for: ${completedAchievementKey}`);
        return;
      }

      console.log(`🎯 Unlocking ${relatedAchievements.length} related achievements: ${relatedAchievements.join(', ')}`);

      // Unlock each related achievement by incrementing progress by 0 (locked → in_progress without adding progress)
      for (const achievementKey of relatedAchievements) {
        try {
          console.log(`🔓 Auto-unlocking: ${achievementKey}`);
          const result = await this.updateAchievementProgress(walletAddress, achievementKey, 0);
          
          if (result) {
            console.log(`✅ ${achievementKey} unlocked: ${result.new_progress}/${result.required_count} progress`);
          } else {
            console.log(`⚠️ Failed to unlock ${achievementKey} - no result returned`);
          }
        } catch (error) {
          console.error(`❌ Error unlocking ${achievementKey}:`, error);
          // Continue with other achievements even if one fails
        }
      }

    } catch (error) {
      console.error('❌ Error in handleProgressiveUnlocking:', error);
      // Don't throw error to prevent blocking main achievement update
    }
  }

  // Claim achievement reward
  async claimAchievementReward(walletAddress: string, achievementKey: string): Promise<ClaimRewardResult> {
    try {
      console.log(`Claiming achievement reward: ${achievementKey} for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      // FRESH SYSTEM: Use new claim function
      const { data, error } = await client.rpc('claim_achievement', {
        user_wallet: walletAddress,
        achievement_key_param: achievementKey
      });

      console.log('Claim achievement response:', { data, error });

      if (error) {
        console.error('Error claiming achievement reward:', error);
        return {
          success: false,
          message: 'Failed to claim achievement reward. Please try again.'
        };
      }

      // RPC function returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;

      if (!result?.success) {
        return {
          success: false,
          message: result?.message || 'Achievement reward could not be claimed.'
        };
      }

      const neftReward = parseFloat(result.neft_reward || '0');
      const xpReward = parseInt(result.xp_reward || '0');

      // After a successful claim, the database function already added rewards to user balance
      // We just need to emit balance update event for UI refresh
      try {
        console.log(`Achievement reward already added to balance by database function: ${neftReward} NEFT, ${xpReward} XP`);
        
        // Emit balance update event for UI refresh
        userBalanceService.emitBalanceUpdateEvent(walletAddress);

        await activityTrackingService.logActivity(walletAddress, {
          activityType: 'achievement',
          title: `Achievement Reward Claimed: ${achievementKey}`,
          description: `Claimed reward for completing the achievement.`,
          details: `Earned ${neftReward} NEFT and ${xpReward} XP }`,
          neftReward,
          xpReward,
          metadata: {
            achievement_key: achievementKey,
            claim_type: 'achievement_reward'
          }
        });
        console.log('Achievement claim activity logged successfully');
      } catch (error) {
        console.error('Error during post-claim operations (sync/log):', error);
        // Do not fail the entire operation if these fail.
      }

      return {
        success: result?.success === true,
        message: result?.message || 'Achievement reward claimed',
        neft_reward: parseFloat(result?.neft_reward || '0'),
        xp_reward: parseInt(result?.xp_reward || '0'),
      };
    } catch (error) {
      console.error('Error in claimAchievementReward:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while claiming achievement reward.'
      };
    }
  }

  // Initialize achievements for a user
  async initializeUserAchievements(walletAddress: string): Promise<number> {
    try {
      console.log(`Initializing achievements for wallet: ${walletAddress}`);
      
      const client = this.createClientWithWalletHeader(walletAddress);
      
      const { data, error } = await client.rpc('initialize_user_achievements', {
        user_wallet: walletAddress
      });

      if (error) {
        // 409 means achievements already exist - this is not an error
        if (error.code === '409' || error.message?.includes('already exist')) {
          console.log('✅ User achievements already initialized');
          return 0; // Return success, achievements already exist
        }
        console.error('Error initializing user achievements:', error);
        return 0;
      }

      const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
      console.log(`✅ Initialized ${count} achievements for wallet: ${walletAddress}`);
      
      // CRITICAL FIX: Reset incorrectly completed check-in achievements
      await this.fixIncorrectCheckInAchievements(walletAddress);
      
      return count;
    } catch (error) {
      console.error('Error in initializeUserAchievements:', error);
      return 0;
    }
  }

  // Fix incorrectly completed check-in achievements
  private async fixIncorrectCheckInAchievements(walletAddress: string): Promise<void> {
    try {
      console.log(`🔧 Fixing incorrectly completed check-in achievements for: ${walletAddress}`);
      
      const client = this.createClientWithWalletHeader(walletAddress);
      
      // Reset daily_visitor if it's incorrectly completed
      const { error: dailyVisitorError } = await client
        .from('user_achievements')
        .update({
          current_progress: 1,
          status: 'in_progress',
          completed_at: null,
          claimed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .eq('achievement_key', 'daily_visitor')
        .eq('status', 'completed');

      if (!dailyVisitorError) {
        console.log('✅ Reset daily_visitor to 1/7 progress');
      }

      // Reset dedicated_user if it's incorrectly completed
      const { error: dedicatedUserError } = await client
        .from('user_achievements')
        .update({
          current_progress: 1,
          status: 'in_progress',
          completed_at: null,
          claimed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .eq('achievement_key', 'dedicated_user')
        .eq('status', 'completed');

      if (!dedicatedUserError) {
        console.log('✅ Reset dedicated_user to 1/30 progress');
      }

    } catch (error) {
      console.error('❌ Error fixing check-in achievements:', error);
    }
  }

  // Get achievement statistics
  // FRESH SYSTEM: Get achievement stats from loaded achievements (no extra egress)
  async getAchievementStats(walletAddress: string): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    completionPercentage: number;
  }> {
    try {
      // Get achievements using the efficient single call
      const achievements = await this.getUserAchievements(walletAddress);
      
      const total = achievements.length;
      const completed = achievements.filter(a => a.status === 'completed' || a.status === 'claimed').length;
      const inProgress = achievements.filter(a => a.status === 'in_progress').length;
      const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      console.log(`📊 FRESH: Stats for ${walletAddress}: ${completed}/${total} (${completionPercentage}%)`);

      return {
        total,
        completed,
        inProgress,
        completionPercentage
      };
    } catch (error) {
      console.error('❌ Error in getAchievementStats:', error);
      return { total: 0, completed: 0, inProgress: 0, completionPercentage: 0 };
    }
  }



  // Real-time achievement tracking based on user activities

  // Track staking achievements with proper state transitions
  async updateStakingAchievements(walletAddress: string, actionType: 'stake' | 'unstake' | 'continuous', count: number = 1): Promise<void> {
    try {
      console.log(`🔒 Tracking staking achievements for wallet: ${walletAddress}, action: ${actionType}, count: ${count}`);

      // Auto-initialize achievements if they don't exist
      await this.initializeUserAchievements(walletAddress);

      if (actionType === 'stake') {
        // Update first_stake achievement (locked → in_progress → completed)
        const firstStakeResult = await this.updateAchievementProgress(walletAddress, 'first_stake', count);
        if (firstStakeResult?.achievement_completed) {
          console.log('🎉 First Stake achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'first_stake', 'First Stake', 250, 125);
          
          // Trigger progressive unlocking
          await this.handleProgressiveUnlocking(walletAddress, 'first_stake');
        } else if (firstStakeResult?.new_progress === 1) {
          console.log('🔓 First Stake achievement now IN_PROGRESS');
        }
        // When first_stake completes, automatically unlock staking_pro
        console.log('🔓 Auto-unlocking staking_pro for progressive tracking...');
        await this.updateAchievementProgress(walletAddress, 'staking_pro', 1); // Start with 1 progress to unlock
      }

      if (actionType === 'continuous') {
        // Check for staking_pro achievement (30 days continuous staking)
        await this.checkStakingProAchievement(walletAddress);
      }

    } catch (error) {
      console.error('❌ Error updating staking achievements:', error);
      // Don't throw error to prevent service failures
    }
  }

  // Track burn achievements with proper state transitions
  async updateBurnAchievements(walletAddress: string, actionType: 'first' | 'multiple' | 'all', burnCount: number = 1): Promise<void> {
    try {
      console.log(`🔥 Tracking burn achievements for wallet: ${walletAddress}, action: ${actionType}, burn count: ${burnCount}`);

      // Auto-initialize achievements if they don't exist
      await this.initializeUserAchievements(walletAddress);

      if (actionType === 'first') {
        // Update first_burn achievement (locked → completed)
        const firstBurnResult = await this.updateAchievementProgress(walletAddress, 'first_burn', burnCount);
        if (firstBurnResult?.achievement_completed) {
          console.log('🎉 First Burn achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'first_burn', 'First Burn', 200, 100);
          
          // Trigger progressive unlocking
          await this.handleProgressiveUnlocking(walletAddress, 'first_burn');
        }
      }

      if (actionType === 'multiple' || actionType === 'all') {
        // Update burn_enthusiast achievement (25 burns) - locked → in_progress → completed
        const enthusiastResult = await this.updateAchievementProgress(walletAddress, 'burn_enthusiast', burnCount);
        if (enthusiastResult?.achievement_completed) {
          console.log('🎉 Burn Enthusiast achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'burn_enthusiast', 'Burn Enthusiast', 750, 375);
        } else if (enthusiastResult?.new_progress === burnCount && enthusiastResult.new_progress > 0) {
          console.log(`🔓 Burn Enthusiast achievement now IN_PROGRESS (${enthusiastResult.new_progress}/${enthusiastResult.required_count})`);
        }

        // Update burn_master achievement (100 burns) - locked → in_progress → completed
        const masterResult = await this.updateAchievementProgress(walletAddress, 'burn_master', burnCount);
        if (masterResult?.achievement_completed) {
          console.log('🎉 Burn Master achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'burn_master', 'Burn Master', 3000, 1500);
        } else if (masterResult?.new_progress === burnCount && masterResult.new_progress > 0) {
          console.log(`🔓 Burn Master achievement now IN_PROGRESS (${masterResult.new_progress}/${masterResult.required_count})`);
        }
      }

    } catch (error) {
      console.error('❌ Error updating burn achievements:', error);
      // Don't throw error to prevent service failures
    }
  }

  // Track quest achievements with proper state transitions
  async updateQuestAchievements(walletAddress: string, actionType: 'task_complete' | 'project_complete' | 'all', questCount: number = 1): Promise<void> {
    try {
      console.log(`🏆 Tracking quest achievements for wallet: ${walletAddress}, action: ${actionType}, quest count: ${questCount}`);

      // Auto-initialize achievements if they don't exist
      await this.initializeUserAchievements(walletAddress);

      if (actionType === 'task_complete' || actionType === 'all') {
        // Update first_quest achievement (Complete your first campaign task)
        const firstQuestResult = await this.updateAchievementProgress(walletAddress, 'first_quest', questCount);
        console.log('🔍 DEBUG - First Quest Result:', firstQuestResult);
        if (firstQuestResult?.achievement_completed) {
          console.log('🎉 First Quest achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'first_quest', 'First Quest', 100, 50);
          
          // Trigger progressive unlocking
          await this.handleProgressiveUnlocking(walletAddress, 'first_quest');
          
          // Emit achievement update event for UI refresh
          window.dispatchEvent(new CustomEvent('achievementUpdated', { 
            detail: { walletAddress, achievementKey: 'first_quest', completed: true } 
          }));
        }
      }

      if (actionType === 'project_complete' || actionType === 'all') {
        // Update quest_master achievement (Complete 10 different projects)
        const masterResult = await this.updateAchievementProgress(walletAddress, 'quest_master', questCount);
        console.log('🔍 DEBUG - Quest Master Result:', masterResult);
        if (masterResult?.achievement_completed) {
          console.log('🎉 Quest Master achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'quest_master', 'Quest Master', 500, 250);
        } else if (masterResult?.new_progress > 0) {
          console.log(`⏫ Quest Master progress: ${masterResult.new_progress}/10 projects`);
        }

        // Update quest_legend achievement (Complete 50 different projects)
        const legendResult = await this.updateAchievementProgress(walletAddress, 'quest_legend', questCount);
        if (legendResult?.achievement_completed) {
          console.log('🎉 Quest Legend achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'quest_legend', 'Quest Legend', 2000, 1000);
        } else if (legendResult?.new_progress > 0) {
          console.log(`⏫ Quest Legend progress: ${legendResult.new_progress}/50 projects`);
        }
      }

    } catch (error) {
      console.error('❌ Error updating quest achievements:', error);
      // Don't throw error to prevent service failures
    }
  }

  // Track social achievements
  async updateSocialAchievements(walletAddress: string, actionType: 'share' | 'referral', count: number = 1): Promise<void> {
    try {
      console.log(`📢 Tracking social achievements for wallet: ${walletAddress}, action: ${actionType}, count: ${count}`);

      // Auto-initialize achievements if they don't exist
      await this.initializeUserAchievements(walletAddress);

      if (actionType === 'share') {
        // Update social_starter achievement
        const socialResult = await this.updateAchievementProgress(walletAddress, 'social_starter', count);
        if (socialResult?.achievement_completed) {
          console.log('📢 Social Starter achievement completed!');
          await this.logAchievementCompletion(walletAddress, 'social_starter', 'Social Starter', 100, 50);
        }
      }

      if (actionType === 'referral') {
        // Update first_referral achievement (1 referral)
        const firstReferralResult = await this.updateAchievementProgress(walletAddress, 'first_referral', count);
        if (firstReferralResult?.achievement_completed) {
          console.log('🎉 First Referral achievement completed!');
          await this.logAchievementCompletion(walletAddress, 'first_referral', 'First Referral', 25, 250);
        }

        // Update referral_champion achievement (10 referrals) 
        const championResult = await this.updateAchievementProgress(walletAddress, 'referral_champion', count);
        if (championResult?.achievement_completed) {
          console.log('👑 Referral Champion achievement completed!');
          await this.logAchievementCompletion(walletAddress, 'referral_champion', 'Referral Champion', 150, 1500);
        }
      }

    } catch (error) {
      console.error('Error updating social achievements:', error);
      throw error;
    }
  }

  // Track check-in achievements
  async updateCheckinAchievements(walletAddress: string, consecutiveDays: number): Promise<void> {
    try {
      console.log(`📅 Tracking check-in achievements for wallet: ${walletAddress}, consecutive days: ${consecutiveDays}`);

      // Auto-initialize achievements if they don't exist
      await this.initializeUserAchievements(walletAddress);

      // Update daily_visitor achievement (7 days)
      const dailyResult = await this.updateAchievementProgress(walletAddress, 'daily_visitor', consecutiveDays >= 7 ? 1 : 0);
      if (dailyResult?.achievement_completed) {
        console.log('📅 Daily Visitor achievement COMPLETED!');
        await this.logAchievementCompletion(walletAddress, 'daily_visitor', 'Daily Visitor', 150, 75);
        
        // Trigger progressive unlocking
        await this.handleProgressiveUnlocking(walletAddress, 'daily_visitor');
      } else if (consecutiveDays > 0 && consecutiveDays < 7) {
        console.log(`⏫ Daily Visitor progress: ${consecutiveDays}/7 days`);
      }

      // Update dedicated_user achievement (30 days) - always track progress
      const dedicatedResult = await this.updateAchievementProgress(walletAddress, 'dedicated_user', consecutiveDays >= 30 ? 1 : 0);
      if (dedicatedResult?.achievement_completed) {
        console.log('🏅 Dedicated User achievement COMPLETED!');
        await this.logAchievementCompletion(walletAddress, 'dedicated_user', 'Dedicated User', 1500, 750);
      } else if (consecutiveDays >= 7 && consecutiveDays < 30) {
        console.log(`⏫ Dedicated User progress: ${consecutiveDays}/30 days`);
      }

    } catch (error) {
      console.error('Error updating check-in achievements:', error);
      // Don't throw error to prevent service failures
    }
  }

  // Track campaign achievements with proper state transitions
  async updateCampaignAchievements(walletAddress: string, actionType: 'participate' | 'win' | 'all', count: number = 1): Promise<void> {
    try {
      console.log(`🚩 Tracking campaign achievements for wallet: ${walletAddress}, action: ${actionType}, count: ${count}`);

      // Auto-initialize achievements if they don't exist
      await this.initializeUserAchievements(walletAddress);

      if (actionType === 'participate' || actionType === 'all') {
        // Update campaign_participant achievement (locked → completed)
        const participantResult = await this.updateAchievementProgress(walletAddress, 'campaign_participant', count);
        console.log('🔍 DEBUG - Campaign Participant Result:', participantResult);
        if (participantResult?.achievement_completed) {
          console.log('🎉 Campaign Participant achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'campaign_participant', 'Campaign Participant', 400, 200);
          
          // Trigger progressive unlocking
          await this.handleProgressiveUnlocking(walletAddress, 'campaign_participant');
        }  
        // When campaign_participant completes, automatically unlock campaign_champion
        console.log('🔓 Auto-unlocking campaign_champion for progressive tracking...');
        await this.updateAchievementProgress(walletAddress, 'campaign_champion', 1); // Start with 1 progress to unlock
      }
        
      if (actionType === 'win' || actionType === 'all') {
        // Update campaign_champion achievement (5 wins) - locked → in_progress → completed
        const championResult = await this.updateAchievementProgress(walletAddress, 'campaign_champion', count);
        console.log('🔍 DEBUG - Campaign Champion Result:', championResult);
        if (championResult?.achievement_completed) {
          console.log('🎉 Campaign Champion achievement COMPLETED!');
          await this.logAchievementCompletion(walletAddress, 'campaign_champion', 'Campaign Champion', 1000, 500);
        } else if (championResult?.new_progress > 0) {
          console.log(`⏫ Campaign Champion progress: ${championResult.new_progress}/${championResult.required_count}`);
        }
      }

    } catch (error) {
      console.error('❌ Error updating campaign achievements:', error);
      // Don't throw error to prevent service failures
    }
  }

  // Helper method to check staking pro achievement (30 days continuous)
  private async checkStakingProAchievement(walletAddress: string): Promise<void> {
    try {
      // This would need to check actual staking duration from database
      // For now, we'll implement the basic structure
      console.log('Checking staking pro achievement for continuous staking...');

      // TODO: Implement actual check for 30 days continuous staking
      // This would query the staking history and check for continuous staking period

    } catch (error) {
      console.error('Error checking staking pro achievement:', error);
    }
  }

  // Helper method to log achievement completion (WITHOUT adding rewards)
  private async logAchievementCompletion(
    walletAddress: string,
    achievementKey: string,
    achievementTitle: string,
    neftReward: number,
    xpReward: number
  ): Promise<void> {
    try {
      console.log(`📝 Logging achievement completion: ${achievementTitle} for ${walletAddress}`);
      
      // Use existing ActivityTrackingService (restore original approach)
      await activityTrackingService.logActivity(
        walletAddress,
        {
          activityType: 'achievement',
          title: `Achievement Unlocked: ${achievementTitle}`,
          description: `Completed the ${achievementTitle} achievement`,
          details: `Ready to claim ${neftReward} NEFT and ${xpReward} XP`,
          neftReward: 0, // Don't auto-add rewards
          xpReward: 0, // Don't auto-add rewards
          status: 'completed',
          metadata: {
            achievement_key: achievementKey,
            achievement_type: 'completion',
            neft_reward: neftReward,
            xp_reward: xpReward
          }
        }
      );
      
      console.log(`✅ Achievement completion logged successfully`);
    } catch (error) {
      console.error('❌ Error logging achievement completion:', error);
      // Don't throw - achievement completion should not fail due to logging issues
    }
  }

  // FRESH SYSTEM: Get achievements by category (removed social)
  getAchievementCategories(): Array<{ id: AchievementCategory | 'all', label: string }> {
    return [
      { id: 'all', label: 'All' },
      { id: 'quest', label: 'Quests' },
      { id: 'burn', label: 'NFT Burning' },
      { id: 'referral', label: 'Referrals' },
      { id: 'checkin', label: 'Check-ins' },
      { id: 'staking', label: 'Staking' }
    ];
  }
}

// Export singleton instance
const achievementsService = new AchievementsService();
export default achievementsService;

// Export types for use in components
export type {
  AchievementCategory,
  AchievementStatus,
  Achievement,
  ClaimRewardResult,
  ProgressUpdateResult
};
