/**
 * Burn Chance Service - Project-Based System
 * User gets 1 burn chance after completing ALL tasks in 2 different projects
 * After using burn chance, progress resets and cycle repeats
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';

export interface BurnChanceStatus {
  wallet_address: string;
  projects_completed_count: number;
  projects_required: number;
  progress_percentage: number;
  completed_project_ids: string[];
  available_burn_chances: number;
  used_burn_chances: number;
  can_burn: boolean;
  total_completed_projects: number;
}

export interface BurnChanceResult {
  burn_chance_earned: boolean;
  projects_completed: number;
  projects_required: number;
  message: string;
}

export interface BurnChanceUseResult {
  success: boolean;
  message: string;
}

class BurnChanceService {
  private clientPool: Map<string, SupabaseClient> = new Map();

  /**
   * Get or create Supabase client with wallet authentication
   */
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

  /**
   * Get or create Supabase client with wallet authentication
   */
  private getClient(walletAddress: string): SupabaseClient {
    if (!this.clientPool.has(walletAddress)) {
      this.clientPool.set(walletAddress, this.createClientWithWalletHeader(walletAddress));
    }
    return this.clientPool.get(walletAddress)!;
  }

  /**
   * Check if project completion should award burn chance
   * Call this when a project reaches 100% completion
   */
  async checkProjectCompletion(
    walletAddress: string,
    projectId: string
  ): Promise<BurnChanceResult> {
    try {
      if (!walletAddress || !projectId) {
        throw new Error('Wallet address and project ID are required');
      }

      const client = this.getClient(walletAddress);
      const { data, error } = await client.rpc('trigger_project_completion_check', {
        p_wallet_address: walletAddress,
        p_project_id: projectId
      });

      if (error) {
        console.error('❌ Error checking project completion for burn chance:', error);
        throw new Error(`Failed to check project completion: ${error.message}`);
      }

      const result = data as BurnChanceResult;
      
      if (result.burn_chance_earned) {
        console.log(`🔥 Burn chance earned! User completed ${result.projects_completed} projects`);
      } else {
        console.log(`📊 Progress: ${result.projects_completed}/${result.projects_required} projects completed`);
      }

      return result;

    } catch (error) {
      console.error('❌ Burn chance check service error:', error);
      throw error;
    }
  }

  /**
   * Get user's current burn chance status
   */
  async getBurnChanceStatus(walletAddress: string): Promise<BurnChanceStatus> {
    try {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const client = this.getClient(walletAddress);
      const { data, error } = await client.rpc('get_burn_chance_status', {
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('❌ Error fetching burn chance status:', error);
        throw new Error(`Failed to fetch burn chance status: ${error.message}`);
      }

      const status = data as BurnChanceStatus;
      console.log(`📊 Burn status: ${status.projects_completed_count}/${status.projects_required} projects, ${status.available_burn_chances} chances available`);
      
      return status;

    } catch (error) {
      console.error('❌ Burn chance status service error:', error);
      throw error;
    }
  }

  /**
   * Use a burn chance (when user burns an NFT)
   */
  async useBurnChance(walletAddress: string): Promise<BurnChanceUseResult> {
    try {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const client = this.getClient(walletAddress);
      const { data, error } = await client.rpc('use_burn_chance', {
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('❌ Error using burn chance:', error);
        throw new Error(`Failed to use burn chance: ${error.message}`);
      }

      const result = data as BurnChanceUseResult;
      
      if (result.success) {
        console.log('🔥 Burn chance used successfully');
      } else {
        console.log('❌ No burn chances available');
      }

      return result;

    } catch (error) {
      console.error('❌ Use burn chance service error:', error);
      throw error;
    }
  }

  /**
   * Check if user has available burn chances
   */
  async hasAvailableBurnChances(walletAddress: string): Promise<boolean> {
    try {
      const status = await this.getBurnChanceStatus(walletAddress);
      return status.available_burn_chances > 0;
    } catch (error) {
      console.error('❌ Error checking available burn chances:', error);
      return false;
    }
  }

  /**
   * Get progress towards next burn chance
   */
  async getProgressTowardsNextChance(walletAddress: string): Promise<{
    current: number;
    required: number;
    percentage: number;
    projects_needed: number;
  }> {
    try {
      const status = await this.getBurnChanceStatus(walletAddress);
      const projects_needed = status.projects_required - status.projects_completed_count;
      
      return {
        current: status.projects_completed_count,
        required: status.projects_required,
        percentage: status.progress_percentage,
        projects_needed: Math.max(0, projects_needed)
      };
    } catch (error) {
      console.error('❌ Error getting progress towards next chance:', error);
      return {
        current: 0,
        required: 2,
        percentage: 0,
        projects_needed: 2
      };
    }
  }

  /**
   * Integration helper: Call this from OptimizedCampaignService.completeTask()
   * when a project reaches 100% completion
   */
  async handleProjectCompletion(
    walletAddress: string,
    projectId: string,
    completionPercentage: number
  ): Promise<BurnChanceResult | null> {
    try {
      // Only check for burn chance if project is 100% complete
      if (completionPercentage >= 100) {
        return await this.checkProjectCompletion(walletAddress, projectId);
      }
      return null;
    } catch (error) {
      console.error('❌ Error handling project completion:', error);
      return null;
    }
  }

  /**
   * Clear client pool (for cleanup)
   */
  clearClientPool(): void {
    this.clientPool.clear();
    console.log('🧹 Burn chance service client pool cleared');
  }
}

export const burnChanceService = new BurnChanceService();
export default burnChanceService;
