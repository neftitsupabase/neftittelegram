// import { createClient } from '@supabase/supabase-js';
// import achievementsService from './AchievementsService';
// import userBalanceService from './UserBalanceService';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// // Enhanced interfaces for the improved schema
// interface EnhancedUserStreak {
//   current_streak: number;
//   longest_streak: number;
//   total_claims: number;
//   can_claim_today: boolean;
//   last_claim_date: string | null;
//   total_neft_earned: number;
//   total_xp_earned: number;
//   next_milestone_day: number;
//   next_milestone_name: string;
//   streak_started_at: string | null;
// }

// interface EnhancedClaimResult {
//   success: boolean;
//   message: string;
//   streak_count: number;
//   neft_reward: number;
//   xp_reward: number;
//   reward_tier: string;
//   nft_reward: any | null;
//   is_milestone: boolean;
//   total_neft_earned: number;
//   total_xp_earned: number;
// }

// interface MilestoneInfo {
//   milestone_name: string;
//   milestone_description: string;
//   total_neft_reward: number;
//   total_xp_reward: number;
//   nft_reward: any | null;
//   is_special_milestone: boolean;
// }

// interface ClaimHistoryItem {
//   claim_date: string;
//   streak_count: number;
//   total_neft_reward: number;
//   total_xp_reward: number;
//   reward_tier: string;
//   nft_reward: any | null;
//   claimed_at: string;
// }

// interface DailyMilestone {
//   id: string;
//   milestone_day: number;
//   milestone_name: string;
//   milestone_description: string;
//   base_neft_reward: number;
//   bonus_neft_reward: number;
//   base_xp_reward: number;
//   bonus_xp_reward: number;
//   nft_reward: any | null;
//   is_special_milestone: boolean;
//   icon_name: string;
//   color_scheme: string;
// }

// export class EnhancedDailyClaimsService {
//   private createClientWithWalletHeader(walletAddress: string) {
//     return createClient(supabaseUrl, supabaseAnonKey, {
//       global: {
//         headers: {
//           'x-wallet-address': walletAddress,
//         },
//       },
//     });
//   }

//   // Get comprehensive user streak information
//   async getUserStreakInfo(walletAddress: string): Promise<EnhancedUserStreak> {
//     try {
//       console.log(`Getting enhanced streak info for wallet: ${walletAddress}`);
      
//       const client = this.createClientWithWalletHeader(walletAddress);
      
//       const { data, error } = await client.rpc('get_user_streak_info', {
//         user_wallet: walletAddress
//       });

//       if (error) {
//         console.error('Error getting user streak info:', error);
//         throw new Error('Failed to get user streak information');
//       }

//       // RPC function returns array, get first result
//       const result = Array.isArray(data) ? data[0] : data;
      
//       return {
//         current_streak: result.current_streak || 0,
//         longest_streak: result.longest_streak || 0,
//         total_claims: result.total_claims || 0,
//         can_claim_today: result.can_claim_today || false,
//         last_claim_date: result.last_claim_date,
//         total_neft_earned: parseFloat(result.total_neft_earned || '0'),
//         total_xp_earned: result.total_xp_earned || 0,
//         next_milestone_day: result.next_milestone_day || 1,
//         next_milestone_name: result.next_milestone_name || 'First Step',
//         streak_started_at: result.streak_started_at
//       };
//     } catch (error) {
//       console.error('Error in getUserStreakInfo:', error);
//       throw error;
//     }
//   }

//   // Process enhanced daily claim
//   async processDailyClaim(walletAddress: string): Promise<EnhancedClaimResult> {
//     try {
//       console.log(`Processing enhanced daily claim for wallet: ${walletAddress}`);
      
//       const client = this.createClientWithWalletHeader(walletAddress);
      
//       const { data, error } = await client.rpc('process_daily_claim', {
//         user_wallet: walletAddress
//       });

//       if (error) {
//         console.error('Error processing daily claim:', error);
//         return {
//           success: false,
//           message: 'Failed to process daily claim. Please try again.',
//           streak_count: 0,
//           neft_reward: 0,
//           xp_reward: 0,
//           reward_tier: '',
//           nft_reward: null,
//           is_milestone: false,
//           total_neft_earned: 0,
//           total_xp_earned: 0
//         };
//       }

//       // RPC function returns array, get first result
//       const result = Array.isArray(data) ? data[0] : data;
      
//       if (!result.success) {
//         return {
//           success: false,
//           message: result.message || 'Unable to claim daily reward',
//           streak_count: 0,
//           neft_reward: 0,
//           xp_reward: 0,
//           reward_tier: '',
//           nft_reward: null,
//           is_milestone: false,
//           total_neft_earned: 0,
//           total_xp_earned: 0
//         };
//       }

//       console.log('Enhanced daily claim processed successfully:', result);
    
//     const streakCount = parseInt(result.streak_count || '0');
//     const neftReward = parseFloat(result.neft_reward || '0');
//     const xpReward = parseInt(result.xp_reward || '0');
    
//     // CRITICAL FIX: Trigger balance sync via UserBalanceService
//     // This ensures the UI displays correct balance after daily claims
//     try {
//       console.log(`Triggering balance sync for wallet: ${walletAddress}`);
//       await userBalanceService.requestBalanceSync(walletAddress, 'Enhanced Daily Claim');
//       console.log('Enhanced daily claim balance sync triggered successfully');
//     } catch (balanceError) {
//       console.error('Failed to trigger balance sync for enhanced daily claim:', balanceError);
//       // Don't fail the claim operation if balance sync fails
//       // The database function already updated user_balances, this is just a backup
//     }
    
//     // Emit balance update event for UI refresh
//     userBalanceService.emitBalanceUpdateEvent(walletAddress);
    
//     // Update check-in achievements
//     try {
//       console.log('Updating check-in achievements for streak:', streakCount);
//       await achievementsService.updateCheckinAchievements(walletAddress, streakCount);
//       console.log('Check-in achievements updated successfully');
//     } catch (achievementError) {
//       console.error('Failed to update check-in achievements:', achievementError);
//       // Don't fail the daily claim if achievement update fails
//     }  
      
//       return {
//         success: true,
//         message: result.message,
//         streak_count: parseInt(result.streak_count || '0'),
//         neft_reward: parseFloat(result.neft_reward || '0'),
//         xp_reward: parseInt(result.xp_reward || '0'),
//         reward_tier: result.reward_tier,
//         nft_reward: result.nft_reward,
//         is_milestone: result.is_milestone || false,
//         total_neft_earned: parseFloat(result.total_neft_earned || '0'),
//         total_xp_earned: parseInt(result.total_xp_earned || '0')
//       };
//     } catch (error) {
//       console.error('Error in processDailyClaim:', error);
//       return {
//         success: false,
//         message: 'An unexpected error occurred. Please try again.',
//         streak_count: 0,
//         neft_reward: 0,
//         xp_reward: 0,
//         reward_tier: '',
//         nft_reward: null,
//         is_milestone: false,
//         total_neft_earned: 0,
//         total_xp_earned: 0
//       };
//     }
//   }

//   // Get milestone information
//   async getMilestoneInfo(milestoneDay: number): Promise<MilestoneInfo | null> {
//     try {
//       const client = createClient(supabaseUrl, supabaseAnonKey);
      
//       const { data, error } = await client.rpc('get_milestone_info', {
//         milestone_day: milestoneDay
//       });

//       if (error) {
//         console.error('Error getting milestone info:', error);
//         return null;
//       }

//       const result = Array.isArray(data) ? data[0] : data;
      
//       if (!result) return null;

//       return {
//         milestone_name: result.milestone_name,
//         milestone_description: result.milestone_description,
//         total_neft_reward: parseFloat(result.total_neft_reward || '0'),
//         total_xp_reward: parseInt(result.total_xp_reward || '0'),
//         nft_reward: result.nft_reward,
//         is_special_milestone: result.is_special_milestone || false
//       };
//     } catch (error) {
//       console.error('Error in getMilestoneInfo:', error);
//       return null;
//     }
//   }

//   // Get all available milestones
//   async getAllMilestones(): Promise<DailyMilestone[]> {
//     try {
//       const client = createClient(supabaseUrl, supabaseAnonKey);
      
//       const { data, error } = await client
//         .from('daily_claim_milestones')
//         .select('*')
//         .order('milestone_day', { ascending: true });

//       if (error) {
//         console.error('Error getting milestones:', error);
//         return [];
//       }

//       return data || [];
//     } catch (error) {
//       console.error('Error in getAllMilestones:', error);
//       return [];
//     }
//   }

//   // Get user's claim history
//   async getUserClaimHistory(
//     walletAddress: string, 
//     limit: number = 30, 
//     offset: number = 0
//   ): Promise<ClaimHistoryItem[]> {
//     try {
//       console.log(`Getting claim history for wallet: ${walletAddress}`);
      
//       const client = this.createClientWithWalletHeader(walletAddress);
      
//       const { data, error } = await client.rpc('get_user_claim_history', {
//         user_wallet: walletAddress,
//         limit_count: limit,
//         offset_count: offset
//       });

//       if (error) {
//         console.error('Error getting claim history:', error);
//         return [];
//       }

//       return data || [];
//     } catch (error) {
//       console.error('Error in getUserClaimHistory:', error);
//       return [];
//     }
//   }

//   // Get upcoming milestones for a user
//   async getUpcomingMilestones(walletAddress: string, count: number = 5): Promise<DailyMilestone[]> {
//     try {
//       const streakInfo = await this.getUserStreakInfo(walletAddress);
//       const client = createClient(supabaseUrl, supabaseAnonKey);
      
//       const { data, error } = await client
//         .from('daily_claim_milestones')
//         .select('*')
//         .gt('milestone_day', streakInfo.current_streak)
//         .order('milestone_day', { ascending: true })
//         .limit(count);

//       if (error) {
//         console.error('Error getting upcoming milestones:', error);
//         return [];
//       }

//       return data || [];
//     } catch (error) {
//       console.error('Error in getUpcomingMilestones:', error);
//       return [];
//     }
//   }

//   // Calculate potential rewards for next claim
//   async getNextClaimPreview(walletAddress: string): Promise<{
//     next_streak: number;
//     estimated_neft: number;
//     estimated_xp: number;
//     reward_tier: string;
//     is_milestone: boolean;
//     milestone_info?: MilestoneInfo;
//   }> {
//     try {
//       const streakInfo = await this.getUserStreakInfo(walletAddress);
//       const nextStreak = streakInfo.can_claim_today ? streakInfo.current_streak + 1 : streakInfo.current_streak;
      
//       // Check if next claim is a milestone
//       const milestoneInfo = await this.getMilestoneInfo(nextStreak);
      
//       if (milestoneInfo) {
//         return {
//           next_streak: nextStreak,
//           estimated_neft: milestoneInfo.total_neft_reward,
//           estimated_xp: milestoneInfo.total_xp_reward,
//           reward_tier: milestoneInfo.milestone_name,
//           is_milestone: true,
//           milestone_info: milestoneInfo
//         };
//       } else {
//         // Calculate regular daily reward
//         const baseNeft = Math.max(10, 10 + (nextStreak * 1.5));
//         const baseXp = Math.max(5, 5 + Math.floor(nextStreak / 2));
        
//         let tier = 'Daily Starter';
//         if (nextStreak > 60) tier = 'Legendary Streaker';
//         else if (nextStreak > 30) tier = 'Dedicated User';
//         else if (nextStreak > 7) tier = 'Consistent Performer';
//         else if (nextStreak > 1) tier = 'Building Momentum';
        
//         return {
//           next_streak: nextStreak,
//           estimated_neft: baseNeft,
//           estimated_xp: baseXp,
//           reward_tier: tier,
//           is_milestone: false
//         };
//       }
//     } catch (error) {
//       console.error('Error in getNextClaimPreview:', error);
//       return {
//         next_streak: 1,
//         estimated_neft: 10,
//         estimated_xp: 5,
//         reward_tier: 'Daily Starter',
//         is_milestone: false
//       };
//     }
//   }

//   // Get user's milestone progress
//   async getMilestoneProgress(walletAddress: string): Promise<{
//     current_streak: number;
//     next_milestone: DailyMilestone | null;
//     progress_percentage: number;
//     days_until_milestone: number;
//   }> {
//     try {
//       const streakInfo = await this.getUserStreakInfo(walletAddress);
//       const upcomingMilestones = await this.getUpcomingMilestones(walletAddress, 1);
      
//       const nextMilestone = upcomingMilestones[0] || null;
      
//       if (!nextMilestone) {
//         return {
//           current_streak: streakInfo.current_streak,
//           next_milestone: null,
//           progress_percentage: 100,
//           days_until_milestone: 0
//         };
//       }
      
//       const daysUntilMilestone = nextMilestone.milestone_day - streakInfo.current_streak;
//       const progressPercentage = (streakInfo.current_streak / nextMilestone.milestone_day) * 100;
      
//       return {
//         current_streak: streakInfo.current_streak,
//         next_milestone: nextMilestone,
//         progress_percentage: Math.min(progressPercentage, 100),
//         days_until_milestone: Math.max(daysUntilMilestone, 0)
//       };
//     } catch (error) {
//       console.error('Error in getMilestoneProgress:', error);
//       return {
//         current_streak: 0,
//         next_milestone: null,
//         progress_percentage: 0,
//         days_until_milestone: 0
//       };
//     }
//   }
// }

// // Export singleton instance
// export const enhancedDailyClaimsService = new EnhancedDailyClaimsService();
