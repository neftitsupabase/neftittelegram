/**
 * Optimized Campaign Service for Low Egress Integration
 * Designed for Discover, ProjectDetails, and NFTTaskList components
 */

import { getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { SupabaseClient } from '@supabase/supabase-js';
import { burnChanceService } from './BurnChanceService';
import achievementsService from './AchievementsService';
import { enhancedReferralService } from './EnhancedReferralService';

// Types matching the database schema
export interface Project {
  id: string;
  title: string;
  description?: string;
  collection_name: string;
  image_url?: string;
  banner_url?: string;
  reward_amount: number;
  reward_currency?: string;
  xp_reward: number;
  max_participants?: number;
  current_participants?: number;
  category: string;
  subcategory?: string;
  blockchain?: string;
  network?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  is_featured?: boolean;
  is_offchain?: boolean;
  total_supply?: number;
  level_requirement?: number;
  usd_value?: number;
  target_chain?: string;
  claim_status?: string;
  task_status?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  owner?: string;
  rarity_distribution?: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  metadata?: any;
  status?: 'active' | 'ended' | 'upcoming';
  seconds_remaining?: number;
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  type: 'twitter_follow' | 'twitter_retweet' | 'twitter_post' | 'discord_join' | 'discord_role' | 'telegram_join' | 'visit_website' | 'quiz';
  action_url?: string;
  discord_user_id?: string;
  discord_guild_id?: string;
  required_role_id?: string;
  telegram_channel_id?: string;
  website_url?: string;
  quiz_questions?: any[];
  quiz_passing_score?: number;
  twitter_username?: string;
  twitter_tweet_id?: string;
  is_active: boolean;
  sort_order: number;
}

export interface UserParticipation {
  joined_at: string;
  completed_tasks_count: number;
  total_tasks_count: number;
  completion_percentage: number;
  rewards_claimed: boolean;
  claimed_at?: string;
}

export interface UserTaskCompletion {
  completed: boolean;
  completed_at?: string;
  verification_data?: any;
}

export interface ProjectDetails {
  project: Project;
  tasks: ProjectTask[];
  user_participation?: UserParticipation;
  user_completions: Record<string, UserTaskCompletion>;
}

export interface ProjectsDashboard {
  projects: Project[];
  stats: {
    total_projects: number;
    active_projects: number;
    featured_projects: number;
  };
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

class OptimizedCampaignService {
  private clientPool: Map<string, SupabaseClient> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  /**
   * Get or create Supabase client with wallet authentication
   */
  private getClient(walletAddress?: string): SupabaseClient {
    if (!walletAddress) {
      // Use default client for public operations
      const cacheKey = 'default';
      if (!this.clientPool.has(cacheKey)) {
        this.clientPool.set(cacheKey, getWalletSupabaseClient(''));
      }
      return this.clientPool.get(cacheKey)!;
    }

    // Use wallet-specific client for authenticated operations
    if (!this.clientPool.has(walletAddress)) {
      this.clientPool.set(walletAddress, getWalletSupabaseClient(walletAddress));
    }
    return this.clientPool.get(walletAddress)!;
  }

  /**
   * Get cached data if available and not expired
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data as T;
    }
    return null;
  }

  /**
   * Set cached data
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Validate user stats data structure
   */
  private isValidUserStats(data: any): data is {
    total_participations: number;
    completed_projects: number;
    active_participations: number;
    rewards_claimed_count: number;
    average_completion: number;
    participations: any[];
  } {
    return data &&
      typeof data === 'object' &&
      typeof data.total_participations === 'number' &&
      typeof data.completed_projects === 'number' &&
      typeof data.active_participations === 'number' &&
      typeof data.rewards_claimed_count === 'number' &&
      typeof data.average_completion === 'number' &&
      Array.isArray(data.participations) &&
      // Ensure all properties exist (not undefined)
      data.total_participations !== undefined &&
      data.completed_projects !== undefined &&
      data.active_participations !== undefined &&
      data.rewards_claimed_count !== undefined &&
      data.average_completion !== undefined &&
      data.participations !== undefined;
  }

  /**
   * Get projects dashboard for Discover page
   * Single RPC call with caching
   */
  async getProjectsDashboard(
    category: string = 'all',
    searchQuery: string = '',
    limit: number = 50,
    offset: number = 0
  ): Promise<ProjectsDashboard> {
    try {
      const cacheKey = `dashboard_${category}_${searchQuery}_${limit}_${offset}`;
      const cached = this.getCachedData<ProjectsDashboard>(cacheKey);
      if (cached) {
        console.log('📦 Using cached projects dashboard');
        return cached;
      }

      const client = this.getClient();
      const { data, error } = await client.rpc('get_projects_dashboard', {
        p_category: category,
        p_search_query: searchQuery,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('❌ Error fetching projects dashboard:', error);
        throw new Error(`Failed to fetch projects: ${error.message}`);
      }

      const result = data as ProjectsDashboard;
      this.setCachedData(cacheKey, result);

      console.log(`✅ Fetched ${result.projects.length} projects from dashboard`);
      return result;

    } catch (error) {
      console.error('❌ Campaign service error:', error);
      throw error;
    }
  }

  /**
   * Get project details for ProjectDetails page
   * Single RPC call with user-specific data
   */
  async getProjectDetails(
    projectId: string,
    walletAddress?: string
  ): Promise<ProjectDetails> {
    try {
      const cacheKey = `project_${projectId}_${walletAddress || 'anonymous'}`;
      const cached = this.getCachedData<ProjectDetails>(cacheKey);
      if (cached) {
        console.log('📦 Using cached project details');
        return cached;
      }

      const client = this.getClient(walletAddress);
      const { data, error } = await client.rpc('get_project_details', {
        p_project_id: projectId,
        p_wallet_address: walletAddress || null
      });

      if (error) {
        console.error('❌ Error fetching project details:', error);
        throw new Error(`Failed to fetch project details: ${error.message}`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result = data as ProjectDetails;

      // Cache for shorter duration if user-specific data
      const cacheDuration = walletAddress ? 2 * 60 * 1000 : this.CACHE_DURATION; // 2 min for user data
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

      console.log(`✅ Fetched project details for ${projectId}`);
      return result;

    } catch (error) {
      console.error('❌ Project details service error:', error);
      throw error;
    }
  }

  /**
   * Complete a project task
   * Single RPC call with participation update
   */
  async completeTask(
    walletAddress: string,
    projectId: string,
    taskId: string,
    verificationData: any = {}
  ): Promise<{ success: boolean; error?: string; completed_tasks_count?: number; total_tasks_count?: number; completion_percentage?: number }> {
    try {
      if (!walletAddress) {
        throw new Error('Wallet address is required to complete tasks');
      }

      const client = this.getClient(walletAddress);
      const { data, error } = await client.rpc('complete_project_task', {
        p_wallet_address: walletAddress,
        p_project_id: projectId,
        p_task_id: taskId,
        p_verification_data: verificationData
      });

      if (error) {
        console.error('❌ Error completing task:', error);
        return { success: false, error: error.message };
      }

      // Clear related cache entries
      this.cache.delete(`project_${projectId}_${walletAddress}`);
      this.cache.delete(`user_stats_${walletAddress}`);

      // Update first_quest achievement for task completion (only once)
      try {
        console.log('🏆 Updating first quest achievement for task completion...');
        await achievementsService.updateQuestAchievements(walletAddress, 'task_complete', 1);
        console.log('✅ First quest achievement updated for task completion');
      } catch (achievementError) {
        console.error('❌ Failed to update first quest achievement:', achievementError);
        // Don't fail the task completion if achievement update fails
      }

      // Update campaign participant achievement for EVERY task completion
      try {
        console.log('🚩 Updating campaign participant achievement for task completion...');
        await achievementsService.updateCampaignAchievements(walletAddress, 'all', 1);
        console.log('✅ All campaign achievements updated for progression tracking');
      } catch (achievementError) {
        console.error('❌ Failed to update campaign participant achievement:', achievementError);
        // Don't fail the task completion if achievement update fails
      }

      // Check if project is fully completed and award burn chance
      if (data.completion_percentage === 100) {
        try {
          const burnResult = await burnChanceService.checkProjectCompletion(walletAddress, projectId);
          if (burnResult.burn_chance_earned) {
            console.log(`🔥 Burn chance earned! User completed project ${projectId}`);
            // Add burn chance info to response
            data.burn_chance_earned = true;
            data.burn_chance_message = burnResult.message;
          }
        } catch (error) {
          console.error('❌ Error checking burn chance:', error);
          // Don't fail the task completion if burn chance check fails
        }

        // Update quest_master and quest_legend achievements for project completion
        try {
          console.log('🏆 Updating quest master/legend achievements for project completion...');
          await achievementsService.updateQuestAchievements(walletAddress, 'project_complete', 1);
          console.log('✅ Quest master/legend achievements updated for project completion');
        } catch (achievementError) {
          console.error('❌ Failed to update quest master/legend achievements:', achievementError);
          // Don't fail the task completion if achievement update fails
        }

        // Update campaign achievements for project completion (campaign champion progress)
        try {
          console.log('🏆 Updating campaign champion achievement for project completion...');
          await achievementsService.updateCampaignAchievements(walletAddress, 'win', 1);
          console.log('✅ Campaign champion achievement updated successfully');
        } catch (achievementError) {
          console.error('❌ Failed to update campaign champion achievement:', achievementError);
          // Don't fail the task completion if achievement update fails
        }

        // Check and process pending referral after project completion
        try {
          console.log('🎯 Checking for pending referral after project completion...');
          
          // Import and use the AutoReferralProcessor
          const { default: AutoReferralProcessor } = await import('./AutoReferralProcessor');
          await AutoReferralProcessor.processAfterProjectCompletion(walletAddress);
        } catch (referralError) {
          console.error('❌ Failed to process pending referral:', referralError);
          // Don't fail the task completion if referral processing fails
        }
      }

      console.log(`✅ Task ${taskId} completed for project ${projectId}`);
      return data;

    } catch (error) {
      console.error('❌ Task completion service error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user project statistics
   * Single RPC call for user dashboard
   */
  async getUserProjectStats(walletAddress: string): Promise<{
    total_participations: number;
    completed_projects: number;
    active_participations: number;
    rewards_claimed_count: number;
    average_completion: number;
    participations: any[];
  }> {
    try {
      const cacheKey = `user_stats_${walletAddress}`;
      const cached = this.getCachedData(cacheKey);
      if (cached && this.isValidUserStats(cached)) {
        console.log('📦 Using cached user stats');
        return cached;
      }

      const client = this.getClient(walletAddress);
      const { data, error } = await client.rpc('get_user_project_stats', {
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('❌ Error fetching user stats:', error);
        throw new Error(`Failed to fetch user stats: ${error.message}`);
      }

      // Ensure data has the expected structure
      const userStats = data || {
        total_participations: 0,
        completed_projects: 0,
        active_participations: 0,
        rewards_claimed_count: 0,
        average_completion: 0,
        participations: []
      };

      // Validate the data structure
      if (!this.isValidUserStats(userStats)) {
        console.warn('⚠️ Invalid user stats structure, using defaults');
        return {
          total_participations: 0,
          completed_projects: 0,
          active_participations: 0,
          rewards_claimed_count: 0,
          average_completion: 0,
          participations: []
        };
      }

      this.setCachedData(cacheKey, userStats);
      console.log(`✅ Fetched user stats for ${walletAddress}`);
      return userStats;

    } catch (error) {
      console.error('❌ User stats service error:', error);
      // Return default structure instead of throwing
      return {
        total_participations: 0,
        completed_projects: 0,
        active_participations: 0,
        rewards_claimed_count: 0,
        average_completion: 0,
        participations: []
      };
    }
  }

  /**
   * Search projects with advanced filters
   * Single RPC call with full-text search
   */
  async searchProjects(
    query: string,
    category: string = 'all',
    status: string = 'all',
    sortBy: string = 'relevance',
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    results: Project[];
    total_count: number;
    has_more: boolean;
  }> {
    try {
      const cacheKey = `search_${query}_${category}_${status}_${sortBy}_${limit}_${offset}`;
      const cached = this.getCachedData<{
        results: Project[];
        total_count: number;
        has_more: boolean;
      }>(cacheKey);
      if (cached) {
        console.log('📦 Using cached search results');
        return cached;
      }

      const client = this.getClient();
      const { data, error } = await client.rpc('search_projects', {
        p_query: query,
        p_category: category,
        p_status: status,
        p_sort_by: sortBy,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('❌ Error searching projects:', error);
        throw new Error(`Failed to search projects: ${error.message}`);
      }

      this.setCachedData(cacheKey, data);
      console.log(`✅ Search completed: ${data.results.length} results`);
      return data;

    } catch (error) {
      console.error('❌ Search service error:', error);
      throw error;
    }
  }

  /**
   * Clear cache for specific keys or all cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`🧹 Cleared ${keysToDelete.length} cache entries matching "${pattern}"`);
    } else {
      this.cache.clear();
      console.log('🧹 Cleared all cache');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Preload popular projects (can be called on app initialization)
   */
  async preloadPopularProjects(): Promise<void> {
    try {
      console.log('🚀 Preloading popular projects...');

      // Preload featured projects
      await this.getProjectsDashboard('featured', '', 20, 0);

      // Preload active projects
      await this.getProjectsDashboard('all', '', 20, 0);

      console.log('✅ Popular projects preloaded');
    } catch (error) {
      console.error('❌ Error preloading projects:', error);
    }
  }
}

export const optimizedCampaignService = new OptimizedCampaignService();
export default optimizedCampaignService;
