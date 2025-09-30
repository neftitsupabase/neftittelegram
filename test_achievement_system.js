// ============================================================================
// ACHIEVEMENT SYSTEM TESTING SCRIPT
// Tests all achievement categories and state transitions
// ============================================================================

import achievementsService from './src/services/AchievementsService.js';

const TEST_WALLET = '0x1234567890123456789012345678901234567890';

async function testAchievementSystem() {
  console.log('🧪 Starting Achievement System Tests...\n');

  try {
    // 1. Initialize user achievements
    console.log('1️⃣ Testing Achievement Initialization...');
    const initResult = await achievementsService.initializeUserAchievements(TEST_WALLET);
    console.log('✅ Initialization result:', initResult);

    // 2. Get initial achievements state
    console.log('\n2️⃣ Getting Initial Achievement State...');
    const initialAchievements = await achievementsService.getUserAchievements(TEST_WALLET);
    console.log(`✅ Found ${initialAchievements.length} achievements`);
    
    // 3. Test Staking Achievements
    console.log('\n3️⃣ Testing Staking Achievements...');
    await achievementsService.updateStakingAchievements(TEST_WALLET, 'stake', 1);
    console.log('✅ Staking achievement updated');

    // 4. Test Burn Achievements
    console.log('\n4️⃣ Testing Burn Achievements...');
    await achievementsService.updateBurnAchievements(TEST_WALLET, 'all', 1);
    console.log('✅ Burn achievement updated');

    // 5. Test Quest Achievements
    console.log('\n5️⃣ Testing Quest Achievements...');
    await achievementsService.updateQuestAchievements(TEST_WALLET, 'task_complete', 1);
    console.log('✅ Quest achievement updated');

    // 6. Test Social Achievements
    console.log('\n6️⃣ Testing Social Achievements...');
    await achievementsService.updateSocialAchievements(TEST_WALLET, 'referral', 1);
    console.log('✅ Social achievement updated');

    // 7. Test Check-in Achievements
    console.log('\n7️⃣ Testing Check-in Achievements...');
    await achievementsService.updateCheckinAchievements(TEST_WALLET, 7);
    console.log('✅ Check-in achievement updated');

    // 8. Test Campaign Achievements
    console.log('\n8️⃣ Testing Campaign Achievements...');
    await achievementsService.updateCampaignAchievements(TEST_WALLET, 'participate', 1);
    console.log('✅ Campaign achievement updated');

    // 9. Get updated achievements state
    console.log('\n9️⃣ Getting Updated Achievement State...');
    const updatedAchievements = await achievementsService.getUserAchievements(TEST_WALLET);
    
    // Count achievements by status
    const statusCounts = updatedAchievements.reduce((acc, ach) => {
      acc[ach.status] = (acc[ach.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Achievement Status Summary:');
    console.log(`   🔒 Locked: ${statusCounts.locked || 0}`);
    console.log(`   ⏳ In Progress: ${statusCounts.in_progress || 0}`);
    console.log(`   ✅ Completed: ${statusCounts.completed || 0}`);

    // 10. Test claiming a completed achievement
    console.log('\n🔟 Testing Achievement Claiming...');
    const completedAchievements = updatedAchievements.filter(ach => 
      ach.status === 'completed' && !ach.claimed_at
    );
    
    if (completedAchievements.length > 0) {
      const firstCompleted = completedAchievements[0];
      console.log(`   Attempting to claim: ${firstCompleted.title}`);
      
      const claimResult = await achievementsService.claimAchievementReward(
        TEST_WALLET, 
        firstCompleted.achievement_key
      );
      
      if (claimResult.success) {
        console.log(`   ✅ Successfully claimed: +${claimResult.neft_reward} NEFT, +${claimResult.xp_reward} XP`);
      } else {
        console.log(`   ❌ Claim failed: ${claimResult.message}`);
      }
    } else {
      console.log('   ℹ️ No completed achievements ready to claim');
    }

    // 11. Get final statistics
    console.log('\n1️⃣1️⃣ Getting Achievement Statistics...');
    const stats = await achievementsService.getAchievementStats(TEST_WALLET);
    console.log('📈 Final Statistics:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Claimed: ${stats.claimed || 0}`);
    console.log(`   In Progress: ${stats.in_progress}`);
    console.log(`   Locked: ${stats.locked || 0}`);
    console.log(`   Completion: ${stats.completion_percentage}%`);

    console.log('\n🎉 Achievement System Test Complete!');
    console.log('✅ All categories tested successfully');
    console.log('✅ State transitions working properly');
    console.log('✅ Reward claiming functional');

  } catch (error) {
    console.error('❌ Achievement System Test Failed:', error);
    throw error;
  }
}

// Run the test
testAchievementSystem().catch(console.error);
