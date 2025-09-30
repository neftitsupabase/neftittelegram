import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';

export interface SocialTask {
  id: string;
  name: string;
  description: string;
  url: string;
  verificationMethod: 'redirect' | 'manual';
  achievementKey: string;
}

export interface TaskCompletionResult {
  success: boolean;
  message: string;
  taskCompleted: boolean;
}

class SocialVerificationService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Define available social tasks
  private socialTasks: SocialTask[] = [
    {
      id: 'follow_x',
      name: 'Follow X',
      description: 'Follow us on X (Twitter)',
      url: 'https://twitter.com/neftit_official', // Replace with actual Twitter URL
      verificationMethod: 'redirect',
      achievementKey: 'follow_x'
    },
    {
      id: 'join_discord',
      name: 'Join Discord',
      description: 'Join our Discord server',
      url: 'https://discord.gg/neftit', // Replace with actual Discord invite URL
      verificationMethod: 'redirect',
      achievementKey: 'join_discord'
    },
    {
      id: 'join_telegram',
      name: 'Join Telegram',
      description: 'Join our Telegram channel',
      url: 'https://t.me/neftit_official', // Replace with actual Telegram URL
      verificationMethod: 'redirect',
      achievementKey: 'join_telegram'
    }
  ];

  // Get social task by achievement key
  getSocialTask(achievementKey: string): SocialTask | undefined {
    return this.socialTasks.find(task => task.achievementKey === achievementKey);
  }

  // Complete a social task (redirect user to social platform)
  async completeTask(walletAddress: string, achievementKey: string): Promise<TaskCompletionResult> {
    try {
      const task = this.getSocialTask(achievementKey);
      if (!task) {
        return {
          success: false,
          message: 'Task not found',
          taskCompleted: false
        };
      }

      // Store task completion attempt in localStorage for verification
      const completionData = {
        walletAddress,
        achievementKey,
        timestamp: Date.now(),
        taskUrl: task.url
      };
      
      localStorage.setItem(`social_task_${achievementKey}_${walletAddress}`, JSON.stringify(completionData));

      // Open social platform in new tab
      window.open(task.url, '_blank');

      // Mark task as attempted (user will need to verify completion)
      return {
        success: true,
        message: `Redirected to ${task.name}. Please complete the task and return to verify.`,
        taskCompleted: false
      };

    } catch (error) {
      console.error('Error completing social task:', error);
      return {
        success: false,
        message: 'Failed to complete task. Please try again.',
        taskCompleted: false
      };
    }
  }

  // Verify task completion (user clicks to confirm they completed the task)
  async verifyTaskCompletion(walletAddress: string, achievementKey: string): Promise<TaskCompletionResult> {
    try {
      const task = this.getSocialTask(achievementKey);
      if (!task) {
        return {
          success: false,
          message: 'Task not found',
          taskCompleted: false
        };
      }

      // Check if task was attempted
      const completionData = localStorage.getItem(`social_task_${achievementKey}_${walletAddress}`);
      if (!completionData) {
        return {
          success: false,
          message: 'Please complete the task first by clicking the social link.',
          taskCompleted: false
        };
      }

      const data = JSON.parse(completionData);
      const timeSinceAttempt = Date.now() - data.timestamp;
      
      // Require at least 5 seconds between task attempt and verification (to ensure user had time to complete)
      if (timeSinceAttempt < 5000) {
        return {
          success: false,
          message: 'Please wait a moment after completing the task before verifying.',
          taskCompleted: false
        };
      }

      // Mark task as completed in localStorage
      const verificationData = {
        ...data,
        verified: true,
        verifiedAt: Date.now()
      };
      
      localStorage.setItem(`social_task_${achievementKey}_${walletAddress}`, JSON.stringify(verificationData));

      // Store completion in existing user_achievements table by updating progress
      await this.markTaskAsCompleted(walletAddress, achievementKey);

      return {
        success: true,
        message: `${task.name} task completed! You can now claim your reward.`,
        taskCompleted: true
      };

    } catch (error) {
      console.error('Error verifying social task:', error);
      return {
        success: false,
        message: 'Failed to verify task completion. Please try again.',
        taskCompleted: false
      };
    }
  }

  // Check if task is completed by checking user_achievements table
  async isTaskCompleted(walletAddress: string, achievementKey: string): Promise<boolean> {
    try {
      // Check localStorage first for immediate feedback
      const completionData = localStorage.getItem(`social_task_${achievementKey}_${walletAddress}`);
      if (completionData) {
        const data = JSON.parse(completionData);
        if (data.verified) {
          return true;
        }
      }

      // Check user_achievements table to see if achievement is in progress or completed
      const client = this.createClientWithWalletHeader(walletAddress);
      const { data, error } = await client
        .from('user_achievements')
        .select('status, current_progress')
        .eq('wallet_address', walletAddress)
        .eq('achievement_key', achievementKey)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking task completion:', error);
        return false;
      }

      // Task is completed if achievement has progress > 0 or is completed
      return data && (data.current_progress > 0 || data.status === 'completed');
    } catch (error) {
      console.error('Error checking task completion:', error);
      return false;
    }
  }

  // Create Supabase client with wallet address header for RLS
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

  // Mark task as completed in user_achievements table
  private async markTaskAsCompleted(walletAddress: string, achievementKey: string): Promise<void> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);
      
      // Update the achievement to in_progress status with progress = 1
      // This will trigger the achievement system to mark it as completed
      const { error } = await client
        .from('user_achievements')
        .update({
          status: 'in_progress',
          current_progress: 1,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .eq('achievement_key', achievementKey);

      if (error) {
        console.error('Error marking task as completed:', error);
      }
    } catch (error) {
      console.error('Error marking task as completed:', error);
    }
  }

  // Get all social tasks
  getAllSocialTasks(): SocialTask[] {
    return this.socialTasks;
  }
}

// Export singleton instance
const socialVerificationService = new SocialVerificationService();
export default socialVerificationService;
