import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { SupabaseClient } from '@supabase/supabase-js';
import activityTrackingService from './ActivityTrackingService';
import achievementsService from './AchievementsService';

export interface ReferralEligibility {
  eligible: boolean;
  completed_projects: number;
  required_projects: number;
  remaining_projects: number;
  reason?: string;
}

export interface ReferralProcessResult {
  success: boolean;
  error?: string;
  neft_reward?: number;
  completed_projects?: number;
  required_projects?: number;
}

export class EnhancedReferralService {
  private supabase: SupabaseClient;
  private clientCache: Map<string, SupabaseClient> = new Map();

  constructor() {
    this.supabase = getSupabaseClient();
  }

  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    if (this.clientCache.has(walletAddress)) {
      return this.clientCache.get(walletAddress)!;
    }

    const client = getWalletSupabaseClient(walletAddress);
    this.clientCache.set(walletAddress, client);
    return client;
  }

  /**
   * Check if user is eligible for referral processing
   * Must have completed 2 projects with 100% completion
   */
  async checkReferralEligibility(walletAddress: string): Promise<ReferralEligibility> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);
      const { data, error } = await client.rpc('check_referral_eligibility', {
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('Error checking referral eligibility:', error);
        throw error;
      }

      return data as ReferralEligibility;
    } catch (error) {
      console.error('Error in checkReferralEligibility:', error);
      return {
        eligible: false,
        completed_projects: 0,
        required_projects: 2,
        remaining_projects: 2,
        reason: 'Error checking eligibility'
      };
    }
  }

  /**
   * Process referral with project completion validation
   */
  async processReferralWithValidation(
    referrerWallet: string, 
    referredWallet: string
  ): Promise<ReferralProcessResult> {
    try {
      const client = this.createClientWithWalletHeader(referrerWallet);
      const { data, error } = await client.rpc('process_referral_with_validation', {
        p_referrer_wallet: referrerWallet,
        p_referred_wallet: referredWallet,
        p_neft_reward: 5
      });

      if (error) {
        throw error;
      }

      if (data && data.success === true) {
        // Log activity asynchronously
        setTimeout(async () => {
          try {
            if (activityTrackingService && typeof activityTrackingService.logActivity === 'function') {
              await activityTrackingService.logActivity(referrerWallet, {
                activityType: 'claim',
                title: 'Successful Referral',
                description: `Successfully referred a new user who completed 2 projects`,
                details: `Referred wallet: ${referredWallet.slice(0, 6)}...${referredWallet.slice(-4)}`,
                neftReward: data.neft_reward,
                metadata: {
                  referred_wallet: referredWallet,
                  reward_amount: data.neft_reward,
                  completed_projects: data.completed_projects,
                  action: 'referral_success'
                }
              });
            }
          } catch (activityError) {
            console.error('Failed to log referral activity:', activityError);
          }
        }, 100);

        // Update achievements asynchronously
        setTimeout(async () => {
          try {
            if (achievementsService && typeof achievementsService.updateSocialAchievements === 'function') {
              await achievementsService.updateSocialAchievements(referrerWallet, 'referral', 1);
            }
          } catch (achievementError) {
            console.error('Failed to update referral achievements:', achievementError);
          }
        }, 200);

        return {
          success: true,
          neft_reward: data.neft_reward,
          completed_projects: data.completed_projects
        };
      } else {
        return {
          success: false,
          error: data.error,
          completed_projects: data.completed_projects,
          required_projects: data.required_projects
        };
      }
    } catch (error) {
      console.error('Error processing referral with validation:', error);
      return {
        success: false,
        error: error.message || 'Failed to process referral'
      };
    }
  }

  /**
   * Check if user should trigger referral processing
   * Called after project completion with referrer info
   */
  async checkAndProcessPendingReferral(walletAddress: string, pendingReferrer?: string): Promise<boolean> {
    try {
      if (!pendingReferrer) {
        return false;
      }

      // Check eligibility
      const eligibility = await this.checkReferralEligibility(walletAddress);
      
      if (!eligibility.eligible) {
        console.log(`User not yet eligible for referral processing. Completed: ${eligibility.completed_projects}/2 projects`);
        return false;
      }

      // Process the referral
      const result = await this.processReferralWithValidation(pendingReferrer, walletAddress);
      
      if (result.success) {
        console.log('✅ Referral processed successfully after project completion');
        return true;
      } else {
        console.error('❌ Failed to process pending referral:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error checking pending referral:', error);
      return false;
    }
  }

  destroy(): void {
    this.clientCache.clear();
  }
}

export const enhancedReferralService = new EnhancedReferralService();
