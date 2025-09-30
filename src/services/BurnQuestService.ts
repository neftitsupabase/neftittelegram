import { SupabaseClient } from '@supabase/supabase-js';
import { CampaignRewardsService } from './CampaignRewardsService';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';

interface QuestProgress {
  completedTasks: number;
  totalTasksRequired: number;
  burnChancesAvailable: number;
  burnChancesUsed: number;
  isQuestComplete: boolean;
  progressPercentage: number;
}

interface BurnChance {
  id: string;
  wallet_address: string;
  earned_at: string;
  used_at?: string;
  source: 'task_completion' | 'campaign_reward';
  task_count_required: number;
  tasks_completed: number;
}

class BurnQuestService {
  private supabase: SupabaseClient;
  private campaignRewardsService: CampaignRewardsService;

  constructor() {
    this.supabase = getSupabaseClient();
    this.campaignRewardsService = new CampaignRewardsService();
  }

  /**
   * Get quest progress for a user
   * @param walletAddress User's wallet address
   * @returns Quest progress information
   */
  async getQuestProgress(walletAddress: string): Promise<QuestProgress> {
    try {
      console.log(`Getting quest progress for wallet: ${walletAddress}`);

      // Get user's task completions
      const { data: taskCompletions, error: taskError } = await this.supabase
        .from('user_task_completions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('completed', true);

      if (taskError) {
        console.error('Error getting task completions:', taskError);
        return this.getDefaultQuestProgress();
      }

      const completedTasks = taskCompletions?.length || 0;

      // Get user's burn chances
      const { data: burnChances, error: burnError } = await this.supabase
        .from('user_burn_chances')
        .select('*')
        .eq('wallet_address', walletAddress);

      if (burnError) {
        console.error('Error getting burn chances:', burnError);
        return this.getDefaultQuestProgress();
      }

      const totalChances = burnChances?.length || 0;
      const usedChances = burnChances?.filter(chance => chance.used_at)?.length || 0;
      const availableChances = totalChances - usedChances;

      // Calculate progress: 2 tasks = 1 burn chance
      const tasksRequiredForNextChance = 2;
      const tasksCompletedSinceLastChance = completedTasks % tasksRequiredForNextChance;
      const progressPercentage = (tasksCompletedSinceLastChance / tasksRequiredForNextChance) * 100;

      const isQuestComplete = availableChances > 0;

      return {
        completedTasks,
        totalTasksRequired: tasksRequiredForNextChance,
        burnChancesAvailable: availableChances,
        burnChancesUsed: usedChances,
        isQuestComplete,
        progressPercentage
      };

    } catch (error) {
      console.error('Error in getQuestProgress:', error);
      return this.getDefaultQuestProgress();
    }
  }

  /**
   * Award a burn chance when user completes required tasks
   * @param walletAddress User's wallet address
   * @param taskCount Number of tasks completed
   * @param source Source of the burn chance
   * @returns Success status
   */
  async awardBurnChance(
    walletAddress: string, 
    taskCount: number, 
    source: 'task_completion' | 'campaign_reward' = 'task_completion'
  ): Promise<boolean> {
    try {
      console.log(`Awarding burn chance to ${walletAddress} for ${taskCount} tasks completed`);

      // Check if user has completed enough tasks for a burn chance
      const progress = await this.getQuestProgress(walletAddress);
      const tasksRequired = 2; // 2 tasks = 1 burn chance

      if (taskCount < tasksRequired) {
        console.log(`Not enough tasks completed. Need ${tasksRequired}, got ${taskCount}`);
        return false;
      }

      // Insert burn chance record
      const { error } = await this.createClientWithWalletHeader(walletAddress)
        .from('user_burn_chances')
        .insert({
          wallet_address: walletAddress,
          earned_at: new Date().toISOString(),
          source,
          task_count_required: tasksRequired,
          tasks_completed: taskCount
        });

      if (error) {
        console.error('Error awarding burn chance:', error);
        return false;
      }

      console.log(`✅ Successfully awarded burn chance to ${walletAddress}`);
      return true;

    } catch (error) {
      console.error('Error in awardBurnChance:', error);
      return false;
    }
  }

  /**
   * Use a burn chance when user burns NFTs
   * @param walletAddress User's wallet address
   * @returns Success status
   */
  async useBurnChance(walletAddress: string): Promise<boolean> {
    try {
      console.log(`Using burn chance for ${walletAddress}`);

      // Get available burn chances
      const { data: burnChances, error: fetchError } = await this.supabase
        .from('user_burn_chances')
        .select('*')
        .eq('wallet_address', walletAddress)
        .is('used_at', null)
        .limit(1);

      if (fetchError) {
        console.error('Error fetching burn chances:', fetchError);
        return false;
      }

      if (!burnChances || burnChances.length === 0) {
        console.log('No available burn chances found');
        return false;
      }

      const burnChance = burnChances[0];

      // Mark burn chance as used
      const { error: updateError } = await this.supabase
        .from('user_burn_chances')
        .update({ used_at: new Date().toISOString() })
        .eq('id', burnChance.id);

      if (updateError) {
        console.error('Error using burn chance:', updateError);
        return false;
      }

      console.log(`✅ Successfully used burn chance for ${walletAddress}`);
      return true;

    } catch (error) {
      console.error('Error in useBurnChance:', error);
      return false;
    }
  }

  /**
   * Check if user can burn NFTs
   * @param walletAddress User's wallet address
   * @returns Whether user can burn
   */
  async canBurn(walletAddress: string): Promise<boolean> {
    try {
      const progress = await this.getQuestProgress(walletAddress);
      return progress.burnChancesAvailable > 0;
    } catch (error) {
      console.error('Error checking burn eligibility:', error);
      return false;
    }
  }

  /**
   * Get burn history for a user
   * @param walletAddress User's wallet address
   * @returns Array of burn chances
   */
  async getBurnHistory(walletAddress: string): Promise<BurnChance[]> {
    try {
      const { data: burnChances, error } = await this.supabase
        .from('user_burn_chances')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('earned_at', { ascending: false });

      if (error) {
        console.error('Error getting burn history:', error);
        return [];
      }

      return burnChances || [];
    } catch (error) {
      console.error('Error in getBurnHistory:', error);
      return [];
    }
  }

  /**
   * Reset quest progress (for testing or admin purposes)
   * @param walletAddress User's wallet address
   * @returns Success status
   */
  async resetQuestProgress(walletAddress: string): Promise<boolean> {
    try {
      console.log(`Resetting quest progress for ${walletAddress}`);

      // Delete all burn chances for the user
      const { error } = await this.supabase
        .from('user_burn_chances')
        .delete()
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error resetting quest progress:', error);
        return false;
      }

      console.log(`✅ Successfully reset quest progress for ${walletAddress}`);
      return true;

    } catch (error) {
      console.error('Error in resetQuestProgress:', error);
      return false;
    }
  }

  /**
   * Get default quest progress for new users
   */
  private getDefaultQuestProgress(): QuestProgress {
    return {
      completedTasks: 0,
      totalTasksRequired: 2,
      burnChancesAvailable: 0,
      burnChancesUsed: 0,
      isQuestComplete: false,
      progressPercentage: 0
    };
  }

  /**
   * Monitor task completions and award burn chances automatically
   * This should be called when a user completes a task
   */
  async onTaskCompleted(walletAddress: string, projectId: string, taskId: string): Promise<void> {
    try {
      console.log(`Task completed: ${walletAddress} - Project: ${projectId} - Task: ${taskId}`);

      // Get current quest progress
      const progress = await this.getQuestProgress(walletAddress);
      
      // Check if user has completed enough tasks for a new burn chance
      const tasksRequired = 2;
      const tasksCompletedSinceLastChance = progress.completedTasks % tasksRequired;
      
      if (tasksCompletedSinceLastChance === 0 && progress.completedTasks > 0) {
        // Award a new burn chance
        await this.awardBurnChance(walletAddress, tasksRequired, 'task_completion');
      }

    } catch (error) {
      console.error('Error in onTaskCompleted:', error);
    }
  }
}

// Export singleton instance
const burnQuestService = new BurnQuestService();
export default burnQuestService;

// Export types
export type {
  QuestProgress,
  BurnChance
};
