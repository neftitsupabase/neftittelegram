import { enhancedReferralService } from './EnhancedReferralService';

export class AutoReferralProcessor {
  /**
   * Process pending referral after project completion
   * This should be called whenever a user completes a project
   */
  static async processAfterProjectCompletion(walletAddress: string): Promise<void> {
    try {
      // Check for pending referral data in localStorage
      const pendingReferrer = localStorage.getItem('pending_referrer_wallet');
      const pendingCode = localStorage.getItem('pending_referral_code');

      if (!pendingReferrer || !pendingCode) {
        console.log('No pending referral found for user:', walletAddress);
        return;
      }

      console.log('🎯 Checking referral eligibility after project completion:', {
        referrer: pendingReferrer,
        referred: walletAddress,
        code: pendingCode
      });

      // Check if user is now eligible (completed 2 projects)
      const eligibility = await enhancedReferralService.checkReferralEligibility(walletAddress);
      
      if (!eligibility.eligible) {
        console.log(`User not yet eligible. Completed: ${eligibility.completed_projects}/2 projects`);
        return;
      }

      console.log('✅ User is now eligible! Processing referral...');

      // Process the referral
      const result = await enhancedReferralService.processReferralWithValidation(
        pendingReferrer,
        walletAddress
      );

      if (result.success) {
        console.log('🎉 Referral processed successfully after project completion!');
        
        // Clean up pending referral data
        localStorage.removeItem('pending_referrer_wallet');
        localStorage.removeItem('pending_referral_code');
        
        // Show success notification
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('referral-processed', {
            detail: {
              success: true,
              neftReward: result.neft_reward,
              referrer: pendingReferrer
            }
          }));
        }
      } else {
        console.error('❌ Failed to process referral:', result.error);
      }
    } catch (error) {
      console.error('💥 Error in auto referral processing:', error);
    }
  }

  /**
   * Check if user has pending referral
   */
  static hasPendingReferral(): boolean {
    const pendingReferrer = localStorage.getItem('pending_referrer_wallet');
    const pendingCode = localStorage.getItem('pending_referral_code');
    return !!(pendingReferrer && pendingCode);
  }
}

export default AutoReferralProcessor;
