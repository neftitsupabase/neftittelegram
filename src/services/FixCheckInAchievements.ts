// Fix check-in achievements that were incorrectly marked as completed
// This service resets them to the correct progress values

import { getSupabaseClient } from '../lib/supabaseClientManager';

export class FixCheckInAchievements {
  
  static async resetCheckInAchievements(walletAddress: string): Promise<void> {
    try {
      console.log(`🔧 Resetting check-in achievements for wallet: ${walletAddress}`);
      
      const client = getSupabaseClient();
      
      // Reset daily_visitor to 1/7 progress
      const { error: dailyVisitorError } = await client
        .from('user_achievements')
        .update({
          current_progress: 1,
          status: 'in_progress',
          completed_at: null,
          claimed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .eq('achievement_key', 'daily_visitor')
        .eq('status', 'completed');

      if (dailyVisitorError) {
        console.error('❌ Error resetting daily_visitor:', dailyVisitorError);
      } else {
        console.log('✅ Reset daily_visitor to 1/7 progress');
      }

      // Reset dedicated_user to 1/30 progress
      const { error: dedicatedUserError } = await client
        .from('user_achievements')
        .update({
          current_progress: 1,
          status: 'in_progress',
          completed_at: null,
          claimed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .eq('achievement_key', 'dedicated_user')
        .eq('status', 'completed');

      if (dedicatedUserError) {
        console.error('❌ Error resetting dedicated_user:', dedicatedUserError);
      } else {
        console.log('✅ Reset dedicated_user to 1/30 progress');
      }

      console.log('🎯 Check-in achievements reset completed');
      
    } catch (error) {
      console.error('❌ Error in resetCheckInAchievements:', error);
    }
  }

  // Verify the achievements are correctly set
  static async verifyCheckInAchievements(walletAddress: string): Promise<void> {
    try {
      const client = getSupabaseClient();
      
      const { data, error } = await client
        .from('user_achievements')
        .select(`
          achievement_key,
          current_progress,
          status,
          achievements_master!inner(target_value)
        `)
        .eq('wallet_address', walletAddress)
        .in('achievement_key', ['daily_visitor', 'dedicated_user']);

      if (error) {
        console.error('❌ Error verifying achievements:', error);
        return;
      }

      console.log('📊 Current check-in achievement status:');
      data?.forEach(achievement => {
        // Fix: achievements_master is an array, get the first element
        const masterData = Array.isArray(achievement.achievements_master) 
          ? achievement.achievements_master[0] 
          : achievement.achievements_master;
        const targetValue = masterData?.target_value || 1;
        const percentage = Math.round((achievement.current_progress / targetValue) * 100);
        console.log(`  ${achievement.achievement_key}: ${achievement.current_progress}/${targetValue} (${percentage}%) - ${achievement.status}`);
      });
      
    } catch (error) {
      console.error('❌ Error verifying achievements:', error);
    }
  }
}

export default FixCheckInAchievements;
