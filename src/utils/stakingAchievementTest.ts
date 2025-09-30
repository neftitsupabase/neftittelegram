import achievementsService from '@/services/AchievementsService';

export class StakingAchievementTest {
  static async testManualAchievementUpdate(walletAddress: string) {
    console.log('=== TESTING MANUAL ACHIEVEMENT UPDATE ===');
    console.log('Wallet:', walletAddress);
    
    try {
      // 1. Check current status
      console.log('\n1. Current achievement status:');
      const beforeAchievements = await achievementsService.getUserAchievements(walletAddress);
      const firstStakeBefore = beforeAchievements.find(a => a.achievement_key === 'first_stake');
      
      if (firstStakeBefore) {
        console.log('Before update:');
        console.log(`  Status: ${firstStakeBefore.status}`);
        console.log(`  Progress: ${firstStakeBefore.current_progress}/${firstStakeBefore.required_count}`);
        console.log(`  Can claim: ${firstStakeBefore.status === 'completed' && !firstStakeBefore.claimed_at}`);
      }
      
      // 2. Manually trigger staking achievement update
      console.log('\n2. Manually updating staking achievements...');
      await achievementsService.updateStakingAchievements(walletAddress, 'stake', 1);
      
      // 3. Check status after update
      console.log('\n3. Achievement status after update:');
      const afterAchievements = await achievementsService.getUserAchievements(walletAddress);
      const firstStakeAfter = afterAchievements.find(a => a.achievement_key === 'first_stake');
      
      if (firstStakeAfter) {
        console.log('After update:');
        console.log(`  Status: ${firstStakeAfter.status}`);
        console.log(`  Progress: ${firstStakeAfter.current_progress}/${firstStakeAfter.required_count}`);
        console.log(`  Can claim: ${firstStakeAfter.status === 'completed' && !firstStakeAfter.claimed_at}`);
        
        if (firstStakeAfter.status === 'completed') {
          console.log('✅ Achievement completed! Ready to claim.');
          return { success: true, canClaim: true, achievement: firstStakeAfter };
        } else {
          console.log('❌ Achievement not completed yet.');
          return { success: true, canClaim: false, achievement: firstStakeAfter };
        }
      } else {
        console.log('❌ First stake achievement not found!');
        return { success: false, canClaim: false, achievement: null };
      }
      
    } catch (error) {
      console.error('Test error:', error);
      return { success: false, error, canClaim: false, achievement: null };
    }
  }
  
  static async testDirectProgressUpdate(walletAddress: string) {
    console.log('\n=== TESTING DIRECT PROGRESS UPDATE ===');
    
    try {
      // Directly update the first_stake achievement progress
      console.log('Directly updating first_stake progress...');
      const result = await achievementsService.updateAchievementProgress(walletAddress, 'first_stake', 1);
      
      console.log('Direct update result:', result);
      
      if (result?.achievement_completed) {
        console.log('✅ Achievement completed via direct update!');
        
        // Check the achievement status
        const achievements = await achievementsService.getUserAchievements(walletAddress);
        const firstStake = achievements.find(a => a.achievement_key === 'first_stake');
        
        return { success: true, completed: true, achievement: firstStake };
      } else {
        console.log('❌ Achievement not completed via direct update.');
        return { success: true, completed: false, result };
      }
      
    } catch (error) {
      console.error('Direct update error:', error);
      return { success: false, error };
    }
  }
  
  static async testClaimFlow(walletAddress: string) {
    console.log('\n=== TESTING CLAIM FLOW ===');
    
    try {
      // First ensure the achievement is completed
      await this.testDirectProgressUpdate(walletAddress);
      
      // Try to claim the achievement
      console.log('Attempting to claim first_stake achievement...');
      const claimResult = await achievementsService.claimAchievementReward(walletAddress, 'first_stake');
      
      console.log('Claim result:', claimResult);
      
      if (claimResult.success) {
        console.log('✅ Achievement claimed successfully!');
        console.log(`Rewards: ${claimResult.neft_reward} NEFT, ${claimResult.xp_reward} XP`);
        return { success: true, claimed: true, rewards: claimResult };
      } else {
        console.log('❌ Failed to claim achievement:', claimResult.message);
        return { success: false, claimed: false, message: claimResult.message };
      }
      
    } catch (error) {
      console.error('Claim test error:', error);
      return { success: false, error };
    }
  }
}

// Global functions for console access
(window as any).testManualAchievementUpdate = StakingAchievementTest.testManualAchievementUpdate;
(window as any).testDirectProgressUpdate = StakingAchievementTest.testDirectProgressUpdate;
(window as any).testClaimFlow = StakingAchievementTest.testClaimFlow;

export default StakingAchievementTest;
