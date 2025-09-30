import achievementsService from '@/services/AchievementsService';

export class AchievementDebugger {
  static async debugUserAchievements(walletAddress: string) {
    console.log('=== ACHIEVEMENT DEBUGGER ===');
    console.log('Wallet Address:', walletAddress);
    
    try {
      // 1. Initialize achievements
      console.log('\n1. Initializing achievements...');
      const initResult = await achievementsService.initializeUserAchievements(walletAddress);
      console.log('Init result:', initResult);
      
      // 2. Get all achievements
      console.log('\n2. Fetching all achievements...');
      const allAchievements = await achievementsService.getUserAchievements(walletAddress);
      console.log('Total achievements:', allAchievements.length);
      
      // 3. Filter staking achievements
      console.log('\n3. Staking achievements:');
      const stakingAchievements = allAchievements.filter(a => a.category === 'staking');
      stakingAchievements.forEach(achievement => {
        console.log(`- ${achievement.achievement_key}:`);
        console.log(`  Title: ${achievement.title}`);
        console.log(`  Status: ${achievement.status}`);
        console.log(`  Progress: ${achievement.current_progress}/${achievement.required_count}`);
        console.log(`  Progress %: ${achievement.progress_percentage}%`);
        console.log(`  Completed: ${achievement.completed_at || 'Not completed'}`);
        console.log(`  Claimed: ${achievement.claimed_at || 'Not claimed'}`);
        console.log(`  Can Claim: ${achievement.status === 'completed' && !achievement.claimed_at}`);
        console.log('');
      });
      
      // 4. Get achievement stats
      console.log('4. Achievement stats:');
      const stats = await achievementsService.getAchievementStats(walletAddress);
      console.log('Stats:', stats);
      
      return {
        allAchievements,
        stakingAchievements,
        stats,
        canClaimFirstStake: stakingAchievements.find(a => 
          a.achievement_key === 'first_stake' && 
          a.status === 'completed' && 
          !a.claimed_at
        )
      };
      
    } catch (error) {
      console.error('Achievement debugger error:', error);
      return null;
    }
  }
  
  static async testStakingAchievement(walletAddress: string) {
    console.log('\n=== TESTING STAKING ACHIEVEMENT ===');
    
    try {
      // Test updating staking achievement
      console.log('Updating staking achievements...');
      await achievementsService.updateStakingAchievements(walletAddress);
      
      // Check if first_stake is now completed
      console.log('Checking first_stake achievement...');
      const achievements = await achievementsService.getUserAchievements(walletAddress);
      const firstStake = achievements.find(a => a.achievement_key === 'first_stake');
      
      if (firstStake) {
        console.log('First Stake Achievement:');
        console.log(`  Status: ${firstStake.status}`);
        console.log(`  Progress: ${firstStake.current_progress}/${firstStake.required_count}`);
        console.log(`  Can Claim: ${firstStake.status === 'completed' && !firstStake.claimed_at}`);
        
        return firstStake;
      } else {
        console.log('First stake achievement not found!');
        return null;
      }
      
    } catch (error) {
      console.error('Test staking achievement error:', error);
      return null;
    }
  }
  
  static async testClaimAchievement(walletAddress: string, achievementKey: string) {
    console.log(`\n=== TESTING CLAIM ACHIEVEMENT: ${achievementKey} ===`);
    
    try {
      const result = await achievementsService.claimAchievementReward(walletAddress, achievementKey);
      console.log('Claim result:', result);
      
      if (result.success) {
        console.log('✅ Achievement claimed successfully!');
        console.log(`Rewards: ${result.neft_reward} NEFT, ${result.xp_reward} XP`);
      } else {
        console.log('❌ Failed to claim achievement:', result.message);
      }
      
      return result;
      
    } catch (error) {
      console.error('Test claim achievement error:', error);
      return null;
    }
  }
}

// Global debug function for console access
(window as any).debugAchievements = AchievementDebugger.debugUserAchievements;
(window as any).testStakingAchievement = AchievementDebugger.testStakingAchievement;
(window as any).testClaimAchievement = AchievementDebugger.testClaimAchievement;

export default AchievementDebugger;
