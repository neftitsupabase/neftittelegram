import { SupabaseClient } from '@supabase/supabase-js';
import { Gift, Calendar, Clock, Trophy, Star, BadgeCheck, Flame } from 'lucide-react';
import activityTrackingService from './ActivityTrackingService';
import achievementsService from './AchievementsService';
import userBalanceService from './UserBalanceService';
import FixCheckInAchievements from './FixCheckInAchievements';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';

// Types for daily claims
interface DailyClaim {
  id: string;
  wallet_address: string;
  claim_date: string;
  streak_count: number;
  neft_reward: number;
  xp_reward: number;
  nft_reward?: string;
  reward_tier: string;
  claimed_at: string;
}

interface UserStreak {
  current_streak: number;
  longest_streak: number;
  total_claims: number;
  can_claim_today: boolean;
  last_claim_date?: string;
}

interface ClaimResult {
  success: boolean;
  message: string;
  streak_count?: number;
  neft_reward?: number;
  xp_reward?: number;
  reward_tier?: string;
  nft_reward?: string;
}

interface RewardTier {
  day: number;
  name: string;
  description: string;
  reward: string;
  icon: string;
  color: string;
  isSpecial?: boolean;
}

class DailyClaimsService {
  private supabase: SupabaseClient;
  private static clientPool = new Map<string, SupabaseClient>();
  private static milestoneCache: RewardTier[] | null = null;
  private static milestonesCacheTime: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Use centralized client manager
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

  // Clear client pool on logout
  static clearClientPool(walletAddress?: string): void {
    if (walletAddress) {
      DailyClaimsService.clientPool.delete(walletAddress);
    } else {
      DailyClaimsService.clientPool.clear();
    }
  }

  // Get user's current streak information
  async getUserStreakInfo(walletAddress: string): Promise<UserStreak> {
    try {
      console.log(`Getting streak info for wallet: ${walletAddress}`);

      // Supabase configuration is handled by centralized client manager

      const client = this.createClientWithWalletHeader(walletAddress);
      console.log('Calling Supabase RPC: get_user_streak_info with wallet:', walletAddress);

      const { data, error } = await client.rpc('get_user_streak_info', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('Supabase RPC error in getUserStreakInfo:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('Raw Supabase response:', data);

      // RPC function returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;
      console.log('Processed result:', result);

      const streakInfo = {
        current_streak: parseInt(result?.current_streak || '0'),
        longest_streak: parseInt(result?.longest_streak || '0'),
        total_claims: parseInt(result?.total_claims || '0'),
        can_claim_today: result?.can_claim_today === true,
        last_claim_date: result?.last_claim_date
      };

      console.log('Returning streak info:', streakInfo);
      return streakInfo;
    } catch (error) {
      console.error('Error in getUserStreakInfo:', error);
      // Re-throw the error so the component can handle it properly
      throw error;
    }
  }

  // Process daily claim
  async processDailyClaim(walletAddress: string): Promise<ClaimResult> {
    try {
      console.log(`Processing daily claim for wallet: ${walletAddress}`);

      // CRITICAL FIX: Initialize user balance record for new users before processing claim
      // This prevents null constraint violations in user_balances table
      try {
        await userBalanceService.initializeUserBalance(walletAddress);
        console.log('User balance initialization completed');
      } catch (initError) {
        console.error('Warning: Failed to initialize user balance, continuing with claim:', initError);
        // Continue with claim processing even if initialization fails
      }

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('process_daily_claim', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('=== DAILY CLAIM ERROR DETAILS ===');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('Error Details:', error.details);
        console.error('Error Hint:', error.hint);
        console.error('Full Error Object:', JSON.stringify(error, null, 2));
        console.error('================================');
        return {
          success: false,
          message: error.message || 'Failed to process daily claim. Please try again.'
        };
      }

      // RPC function returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;

      if (!result.success) {
        return {
          success: false,
          message: result.message || 'Unable to claim daily reward'
        };
      }

      console.log('Daily claim processed successfully:', result);

      const streakCount = parseInt(result.streak_count || '0');
      const neftReward = parseFloat(result.neft_reward || '0');
      const xpReward = parseInt(result.xp_reward || '0');

      // Database triggers handle balance updates automatically
      // No manual balance update needed to avoid double rewards
      console.log(`Daily claim processed: ${neftReward} NEFT, ${xpReward} XP - Database triggers will update balance`);

      // CRITICAL FIX: The database function already adds rewards to user balance
      // We just need to emit balance update event for UI refresh
      try {
        console.log(`Daily claim rewards already added to balance by database function: ${neftReward} NEFT, ${xpReward} XP`);
        
        // CRITICAL FIX: Emit balance update event WITHOUT reward amounts
        // The database already added the rewards, we just need to refresh the UI
        userBalanceService.emitBalanceUpdateEvent(walletAddress);
      } catch (balanceError) {
        console.error('Failed to emit balance update event:', balanceError);
        // Don't fail the claim operation if balance update fails
      }

      // LOW EGRESS: Skip achievement updates during daily claim to reduce database calls
      // Achievements will be updated separately when user visits achievements page
      console.log(`🎯 Daily claim completed - achievements will be updated on next visit to reduce egress`);

      // CRITICAL FIX: Log daily claim activity for activity tracking
      try {
        console.log(`📝 Logging daily claim activity for streak ${streakCount}`);
        await activityTrackingService.logDailyClaim(
          walletAddress, 
          streakCount, 
          neftReward, 
          xpReward, 
          result.nft_reward
        );
        console.log(`✅ Daily claim activity logged successfully`);
      } catch (activityError) {
        console.error('❌ Failed to log daily claim activity:', activityError);
        // Don't fail the claim operation if activity logging fails
      }

      return {
        success: true,
        message: result.message,
        streak_count: streakCount,
        neft_reward: neftReward,
        xp_reward: xpReward,
        reward_tier: result.reward_tier,
        nft_reward: result.nft_reward
      };
    } catch (error) {
      console.error('Error in processDailyClaim:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while claiming daily reward.'
      };
    }
  }

  // Get user's daily claim history
  async getUserClaimHistory(walletAddress: string, limit: number = 30): Promise<DailyClaim[]> {
    try {
      console.log(`Getting claim history for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client
        .from('daily_claims')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('claim_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting claim history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserClaimHistory:', error);
      return [];
    }
  }

  // LOW EGRESS: Get reward tiers from cached database data
  async getRewardTiers(): Promise<RewardTier[]> {
    try {
      // Check cache first
      const now = Date.now();
      if (DailyClaimsService.milestoneCache &&
        (now - DailyClaimsService.milestonesCacheTime) < DailyClaimsService.CACHE_DURATION) {
        console.log('[LOW EGRESS] Using cached milestone data');
        return DailyClaimsService.milestoneCache;
      }

      console.log('[LOW EGRESS] Fetching milestone data from database');
      const client = getSupabaseClient();

      const { data, error } = await client.rpc('get_all_milestones_cached');

      if (error) {
        console.error('Error getting cached milestones:', error);
        return this.getFallbackRewardTiers();
      }

      const milestones = data || [];

      // Cache the result
      DailyClaimsService.milestoneCache = milestones;
      DailyClaimsService.milestonesCacheTime = now;

      return milestones;
    } catch (error) {
      console.error('Error in getRewardTiers:', error);
      return this.getFallbackRewardTiers();
    }
  }

  // Calculate progressive reward for a given streak day (EXACT MATCH with database function)
  static calculateProgressiveReward(streakDay: number): { neft: number; xp: number; tier: string; cycleDay: number } {
    const cycleDay = ((streakDay - 1) % 7) + 1;

    // EXACT MATCH with calculate_progressive_daily_reward function in database
    switch (cycleDay) {
      case 1: return { neft: 5, xp: 5, tier: 'Day 1 - Fresh Start', cycleDay };
      case 2: return { neft: 8, xp: 8, tier: 'Day 2 - Building Momentum', cycleDay };
      case 3: return { neft: 12, xp: 12, tier: 'Day 3 - Getting Stronger', cycleDay };
      case 4: return { neft: 17, xp: 17, tier: 'Day 4 - Steady Progress', cycleDay };
      case 5: return { neft: 22, xp: 22, tier: 'Day 5 - Consistent Effort', cycleDay };
      case 6: return { neft: 30, xp: 30, tier: 'Day 6 - Almost There', cycleDay };
      case 7: return { neft: 35, xp: 35, tier: 'Day 7 - Weekly Champion', cycleDay };
      default: return { neft: 5, xp: 5, tier: 'Day 1 - Fresh Start', cycleDay: 1 };
    }
  }

  // Fallback reward tiers for new progressive system (7-day cycle)
  private getFallbackRewardTiers(): RewardTier[] {
    return [
      {
        day: 1,
        name: "Fresh Start",
        description: "Day 1 of your streak",
        reward: "5 NEFT + 5 XP",
        icon: "Gift",
        color: "from-blue-600 to-blue-400"
      },
      {
        day: 2,
        name: "Building Momentum",
        description: "Day 2 - Keep it going!",
        reward: "8 NEFT + 8 XP",
        icon: "Star",
        color: "from-green-600 to-green-400"
      },
      {
        day: 3,
        name: "Getting Stronger",
        description: "Day 3 - Steady progress",
        reward: "12 NEFT + 12 XP",
        icon: "Clock",
        color: "from-yellow-600 to-yellow-400"
      },
      {
        day: 4,
        name: "Steady Progress",
        description: "Day 4 - Halfway there!",
        reward: "17 NEFT + 17 XP",
        icon: "Calendar",
        color: "from-orange-600 to-orange-400"
      },
      {
        day: 5,
        name: "Consistent Effort",
        description: "Day 5 - Almost at the peak",
        reward: "22 NEFT + 22 XP",
        icon: "Trophy",
        color: "from-purple-600 to-purple-400"
      },
      {
        day: 6,
        name: "Almost There",
        description: "Day 6 - One more day to weekly peak",
        reward: "30 NEFT + 30 XP",
        icon: "BadgeCheck",
        color: "from-pink-600 to-pink-400"
      },
      {
        day: 7,
        name: "Weekly Champion",
        description: "Day 7 - Maximum weekly reward!",
        reward: "35 NEFT + 35 XP",
        icon: "Flame",
        color: "from-red-600 to-red-400",
        isSpecial: true
      }
    ];
  }

  // LOW EGRESS: Single comprehensive dashboard data call
  async getDashboardData(walletAddress: string): Promise<any> {
    try {
      console.log(`[LOW EGRESS] Getting complete dashboard data for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('get_daily_claim_dashboard', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('Error getting dashboard data:', error);
        // Fallback to basic streak info if dashboard function fails
        console.log('Falling back to basic streak info...');
        const basicInfo = await this.getUserStreakInfo(walletAddress);
        return {
          current_streak: basicInfo.current_streak,
          longest_streak: basicInfo.longest_streak,
          total_claims: basicInfo.total_claims,
          can_claim_today: basicInfo.can_claim_today,
          last_claim_date: basicInfo.last_claim_date,
          total_neft_earned: 0,
          total_xp_earned: 0,
          streak_started_at: null,
          next_streak: basicInfo.current_streak + 1,
          next_neft_reward: 0,
          next_xp_reward: 0,
          next_reward_tier: 'Daily Starter',
          next_is_milestone: false,
          upcoming_milestones: [],
          recent_claims: [],
          hours_until_next_claim: 0,
          minutes_until_next_claim: 0
        };
      }

      const result = Array.isArray(data) ? data[0] : data;
      console.log('Dashboard result:', result);

      return {
        current_streak: parseInt(result?.current_streak || '0'),
        longest_streak: parseInt(result?.longest_streak || '0'),
        total_claims: parseInt(result?.total_claims || '0'),
        can_claim_today: result?.can_claim_today === true,
        last_claim_date: result?.last_claim_date,
        total_neft_earned: parseFloat(result?.total_neft_earned || '0'),
        total_xp_earned: parseInt(result?.total_xp_earned || '0'),
        streak_started_at: result?.streak_started_at,
        next_streak: parseInt(result?.next_streak || '1'),
        next_neft_reward: parseFloat(result?.next_neft_reward || '0'),
        next_xp_reward: parseInt(result?.next_xp_reward || '0'),
        next_reward_tier: result?.next_reward_tier || 'Daily Starter',
        next_is_milestone: result?.next_is_milestone === true,
        upcoming_milestones: result?.upcoming_milestones || [],
        recent_claims: result?.recent_claims || [],
        hours_until_next_claim: parseInt(result?.hours_until_next_claim || '0'),
        minutes_until_next_claim: parseInt(result?.minutes_until_next_claim || '0')
      };
    } catch (error) {
      console.error('Error in getDashboardData:', error);
      throw error;
    }
  }

  // LOW EGRESS: Fast eligibility check using optimized RPC
  async canClaimToday(walletAddress: string): Promise<boolean> {
    try {
      console.log(`[LOW EGRESS] Fast eligibility check for wallet: ${walletAddress}`);

      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('can_claim_daily_reward_fast', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('Error in fast eligibility check:', error);
        // Fallback to legacy method
        return this.canClaimTodayLegacy(walletAddress);
      }

      return data === true;
    } catch (error) {
      console.error('Error in canClaimToday:', error);
      return false;
    }
  }

  // Legacy eligibility check (fallback)
  private async canClaimTodayLegacy(walletAddress: string): Promise<boolean> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client
        .from('daily_claims')
        .select('claim_date')
        .eq('wallet_address', walletAddress)
        .eq('claim_date', new Date().toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
        console.error('Error checking claim eligibility:', error);
        return false;
      }

      // If no record found for today, user can claim
      return !data;
    } catch (error) {
      console.error('Error in canClaimTodayLegacy:', error);
      return false;
    }
  }

  // LOW EGRESS: Optimized claim processing with complete state return
  // async processOptimizedDailyClaim(walletAddress: string): Promise<any> {
  //   try {
  //     console.log(`[LOW EGRESS] Processing optimized daily claim for wallet: ${walletAddress}`);

  //     const client = this.createClientWithWalletHeader(walletAddress);

  //     const { data, error } = await client.rpc('process_daily_claim_optimized', {
  //       user_wallet: walletAddress
  //     });

  //     if (error) {
  //       console.error('Error in optimized daily claim:', error);
  //       throw new Error(`Optimized claim error: ${error.message}`);
  //     }

  //     const result = Array.isArray(data) ? data[0] : data;

  //     if (!result.success) {
  //       return {
  //         success: false,
  //         message: result.message || 'Unable to claim daily reward'
  //       };
  //     }

  //     const streakCount = parseInt(result.streak_count || '0');
  //     const neftReward = parseFloat(result.neft_reward || '0');
  //     const xpReward = parseInt(result.xp_reward || '0');

  //     // CRITICAL FIX: Only trigger balance sync to prevent interference
  //     // Activity logging and achievement updates interfere with balance sync at database level
  //     // Based on testing: any form of activity logging or achievement updates breaks balance sync
  //     try {
  //       console.log('Triggering balance sync for optimized daily claim...');
  //       await userBalanceService.requestBalanceSync(walletAddress, 'Optimized Daily Claim');
  //       console.log('Balance sync completed successfully');
  //     } catch (balanceError) {
  //       console.error('Balance sync failed:', balanceError);
  //       // Don't fail the claim operation if balance sync fails
  //     }

  //     // DISABLED: Activity logging and achievement updates
  //     // These cause database/service layer conflicts that interfere with balance calculations
  //     // Even with Promise.allSettled() async handling, the interference occurs at DB level
  //     console.log('Activity logging and achievement updates disabled to prevent balance sync interference');

  //     // Emit balance update event for UI refresh
  //     userBalanceService.emitBalanceUpdateEvent(walletAddress);

  //     return {
  //       success: true,
  //       message: result.message,
  //       streak_count: streakCount,
  //       neft_reward: neftReward,
  //       xp_reward: xpReward,
  //       reward_tier: result.reward_tier,
  //       nft_reward: result.nft_reward,
  //       is_milestone: result.is_milestone,
  //       total_neft_earned: parseFloat(result.total_neft_earned || '0'),
  //       total_xp_earned: parseInt(result.total_xp_earned || '0'),
  //       // Complete updated state from optimized RPC
  //       updated_streak_info: result.updated_streak_info,
  //       next_claim_preview: result.next_claim_preview,
  //       upcoming_milestones: result.upcoming_milestones
  //     };
  //   } catch (error) {
  //     console.error('Error in processOptimizedDailyClaim:', error);
  //     throw error;
  //   }
  // }
}

// Export singleton instance
const dailyClaimsService = new DailyClaimsService();
export default dailyClaimsService;

// Export types for use in components
export type {
  DailyClaim,
  UserStreak,
  ClaimResult,
  RewardTier
};
