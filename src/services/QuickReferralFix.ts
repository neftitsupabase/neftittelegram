import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Quick fix for referral processing using existing database functions
 * This works with the current system without requiring new database deployments
 */
export class QuickReferralFix {
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
   * Check if user has completed 2 projects
   */
  async checkUserProjectCompletion(walletAddress: string): Promise<{
    completed_projects: number;
    eligible: boolean;
  }> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);
      
      // Query user_participations directly
      const { data, error } = await client
        .from('user_participations')
        .select('project_id')
        .eq('wallet_address', walletAddress)
        .eq('completion_percentage', 100);

      if (error) {
        console.error('Error checking project completion:', error);
        return { completed_projects: 0, eligible: false };
      }

      const completed_projects = data?.length || 0;
      console.log(`User ${walletAddress} has completed ${completed_projects} projects`);

      return {
        completed_projects,
        eligible: completed_projects >= 2
      };
    } catch (error) {
      console.error('Error in checkUserProjectCompletion:', error);
      return { completed_projects: 0, eligible: false };
    }
  }

  /**
   * Process referral using existing process_referral function
   * Only if user has completed 2 projects
   */
  async processReferralIfEligible(
    referrerWallet: string, 
    referredWallet: string
  ): Promise<{ success: boolean; message: string; completed_projects?: number }> {
    try {
      // First check if user has completed 2 projects
      const eligibility = await this.checkUserProjectCompletion(referredWallet);
      
      if (!eligibility.eligible) {
        return {
          success: false,
          message: `User must complete 2 projects. Currently completed: ${eligibility.completed_projects}/2`,
          completed_projects: eligibility.completed_projects
        };
      }

      // Check if referral already exists
      const { data: existingReferral } = await this.supabase
        .from('referral_rewards')
        .select('id')
        .eq('referrer_wallet', referrerWallet)
        .eq('referred_wallet', referredWallet)
        .single();

      if (existingReferral) {
        return {
          success: false,
          message: 'Referral already processed'
        };
      }

      // Use existing process_referral function
      const client = this.createClientWithWalletHeader(referrerWallet);
      const { data, error } = await client.rpc('process_referral', {
        p_referrer_wallet: referrerWallet,
        p_referred_wallet: referredWallet,
        p_neft_reward: 5
      });

      if (error) {
        console.error('Error processing referral:', error);
        return {
          success: false,
          message: error.message
        };
      }

      if (data && data.success === true) {
        console.log('✅ Referral processed successfully');
        return {
          success: true,
          message: 'Referral processed successfully! 5 NEFT awarded.',
          completed_projects: eligibility.completed_projects
        };
      } else {
        return {
          success: false,
          message: data?.error || 'Failed to process referral'
        };
      }
    } catch (error) {
      console.error('Error in processReferralIfEligible:', error);
      return {
        success: false,
        message: error.message || 'Error processing referral'
      };
    }
  }

  /**
   * Manual trigger for testing - call this with referrer and referred wallet addresses
   */
  async manualTriggerReferral(referrerWallet: string, referredWallet: string): Promise<void> {
    console.log('🎯 Manual referral trigger started');
    console.log('Referrer:', referrerWallet);
    console.log('Referred:', referredWallet);

    const result = await this.processReferralIfEligible(referrerWallet, referredWallet);
    
    console.log('📊 Referral result:', result);
    
    if (result.success) {
      console.log('✅ SUCCESS: Referral processed and tables updated');
    } else {
      console.log('❌ FAILED:', result.message);
    }
  }
}

export const quickReferralFix = new QuickReferralFix();
