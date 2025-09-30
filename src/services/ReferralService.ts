import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { SupabaseClient } from '@supabase/supabase-js';
import activityTrackingService from './ActivityTrackingService';
import achievementsService from './AchievementsService';
import userBalanceService from './UserBalanceService';

export interface ReferralData {
  code: string;
  link: string;
  count: number;
  rewards: number;
}

export interface ReferralReward {
  id: string;
  referrer_wallet: string;
  referred_wallet: string;
  referral_code: string;
  neft_reward: number
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

export interface LeaderboardEntry {
  wallet_address: string;
  referral_count: number;
  total_rewards: number;
  rank: number;
}

export class ReferralService {
  private supabase: SupabaseClient;
  private clientCache: Map<string, SupabaseClient> = new Map();

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Create Supabase client with wallet address header for RLS
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    if (this.clientCache.has(walletAddress)) {
      return this.clientCache.get(walletAddress)!;
    }

    const client = getWalletSupabaseClient(walletAddress);
    this.clientCache.set(walletAddress, client);
    return client;
  }

  // Collision-resistant referral code
  private generateReferralCode(): string {
    const randomPart = crypto.randomUUID().split('-')[0].toUpperCase();
    return `NEFT-${randomPart}`;
  }

  // Get user referral data using RPC (low egress)
  async getReferralData(walletAddress: string): Promise<ReferralData> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);

      // Single RPC call to get or create profile with aggregates
      const { data, error } = await client.rpc('get_or_create_referral_profile', {
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('Error fetching referral profile:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to get referral profile');
      }

      const profile = data[0];
      const baseUrl = window.location.origin;

      return {
        code: profile.referral_code,
        link: `${baseUrl}/invite/${profile.referral_code}`,
        count: profile.total_referrals || 0,
        rewards: profile.total_neft_earned || 0
      };
    } catch (error) {
      console.error('Error in getReferralData:', error);
      throw error;
    }
  }

  // Calculate flat reward per referral
  private calculateFlatReward(): { neftReward: number } {
    return {
      neftReward: 5, // Flat 5 NEFT per referral
    };
  }

  // Process a referral using atomic RPC (low egress)
  async processReferral(referrerWallet: string, referredWallet: string): Promise<boolean> {
    try {
      const client = this.createClientWithWalletHeader(referrerWallet);
      const rewardInfo = this.calculateFlatReward();

      const { data: rpcData, error } = await client.rpc('process_referral', {
        p_referrer_wallet: referrerWallet,
        p_referred_wallet: referredWallet,
        p_neft_reward: rewardInfo.neftReward
      });

      if (error) {
        throw error;
      }



      // Check the success status from the RPC function response
      if (rpcData && typeof rpcData === 'object' && rpcData.success === true) {
        // Log activity asynchronously to prevent blocking

        setTimeout(async () => {
          try {
            if (activityTrackingService && typeof activityTrackingService.logActivity === 'function') {
              await activityTrackingService.logActivity(referrerWallet, {
                activityType: 'claim',
                title: 'Successful Referral',
                description: `Successfully referred a new user`,
                details: `Referred wallet: ${referredWallet.slice(0, 6)}...${referredWallet.slice(-4)}`,
                neftReward: rewardInfo.neftReward,
                metadata: {
                  referred_wallet: referredWallet,
                  reward_amount: rewardInfo.neftReward,
                  action: 'referral_success'
                }
              });
            }
          } catch (activityError) {
            // Silent fail - don't block referral processing
          }
        }, 100);

        // Update achievements asynchronously
        setTimeout(async () => {
          try {
            if (achievementsService && typeof achievementsService.updateSocialAchievements === 'function') {
              await achievementsService.updateSocialAchievements(referrerWallet, 'referral', 1);
            }
          } catch (achievementError) {
            // Silent fail - don't block referral processing
          }
        }, 200);

        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  // Get referral history
  async getReferralHistory(walletAddress: string): Promise<ReferralReward[]> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);
      const { data, error } = await client
        .from('referral_rewards')
        .select('*')
        .eq('referrer_wallet', walletAddress)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching referral history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getReferralHistory:', error);
      return [];
    }
  }

  // Debug function to list all referral codes
  async getAllReferralCodes(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_referrals')
        .select('referral_code, wallet_address');

      if (error) {
        console.error('❌ Error fetching referral codes:', error);
        return [];
      }

      console.log('📋 All referral codes in database:');
      const codes = data?.map(item => {
        console.log(`  - Code: ${item.referral_code}, Wallet: ${item.wallet_address}`);
        return item.referral_code;
      }) || [];

      console.log(`📊 Total codes found: ${codes.length}`);
      return codes;
    } catch (error) {
      console.error('💥 Error in getAllReferralCodes:', error);
      return [];
    }
  }

  // Validate referral code using RPC (low egress)
  async validateReferralCode(code: string): Promise<{ valid: boolean; referrerWallet?: string }> {
    try {
      console.log('🔍 Validating referral code:', code);

      const { data, error } = await this.supabase.rpc('validate_referral_code', {
        p_code: code
      });

      console.log('📊 Validation RPC result:', { data, error });

      if (error || !data || data.length === 0) {
        console.log('📝 No valid referral code found');
        return { valid: false };
      }

      const result = data[0];
      console.log('✅ Referral code validated successfully:', result.wallet_address);
      return {
        valid: result.is_valid,
        referrerWallet: result.wallet_address
      };
    } catch (error) {
      console.error('💥 Unexpected error validating referral code:', error);
      return { valid: false };
    }
  }

  // Get referral leaderboard using RPC (low egress)
  async getReferralLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_referral_leaderboard', {
        p_limit: limit
      });

      if (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
      }

      return data?.map((entry: any) => ({
        wallet_address: entry.wallet_address,
        referral_count: entry.total_referrals,
        total_rewards: entry.total_neft_earned,
        rank: entry.rank
      })) || [];
    } catch (error) {
      console.error('Error in getReferralLeaderboard:', error);
      return [];
    }
  }

  // Update referral stats using RPC (XP removed, low egress)
  async updateReferralStats(walletAddress: string, neftReward: number): Promise<boolean> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);
      const { error } = await client.rpc('update_referral_stats', {
        p_wallet_address: walletAddress,
        p_neft_reward: neftReward
      });

      if (error) {
        console.error('Error updating referral stats:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in updateReferralStats:', error);
      return false;
    }
  }

  // Get flat reward information
  getFlatReward(): { neftReward: number } {
    return {
      neftReward: 5  // Flat 5 NEFT per referral
    };
  }

  // Clean up cached clients
  destroy(): void {
    this.clientCache.clear();
  }

  // Test method to verify activity tracking and achievements integration
  async testServicesIntegration(walletAddress: string): Promise<void> {
    console.log('🧪 Testing services integration for wallet:', walletAddress);

    // Test ActivityTrackingService - removed duplicate activity logging

    // Test AchievementsService
    try {
      console.log('🏆 Testing AchievementsService...');
      await achievementsService.updateSocialAchievements(walletAddress, 'referral', 1);
      console.log('✅ AchievementsService test successful');
    } catch (error) {
      console.error('❌ AchievementsService test failed:', error);
    }
  }
}

// Export singleton instance
export const referralService = new ReferralService();
