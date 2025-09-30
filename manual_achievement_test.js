// ============================================================================
// MANUAL ACHIEVEMENT TEST - TRIGGER PROGRESS TO VERIFY TRACKING
// Run this in browser console to manually test achievement progress
// ============================================================================

// Test wallet address (replace with actual wallet)
const TEST_WALLET = '0x1234567890123456789012345678901234567890';

async function testAchievementTracking() {
  console.log('🧪 MANUAL ACHIEVEMENT TRACKING TEST\n');
  
  try {
    // Import services (adjust path as needed)
    const { default: achievementsService } = await import('./src/services/AchievementsService.js');
    
    console.log('1️⃣ Getting initial achievement state...');
    const initialState = await achievementsService.getUserAchievements(TEST_WALLET);
    console.log(`Initial locked achievements: ${initialState.filter(a => a.status === 'locked').length}`);
    
    // Test Quest Achievement
    console.log('\n2️⃣ Testing Quest Achievement (first_quest)...');
    await achievementsService.updateQuestAchievements(TEST_WALLET, 'task_complete', 1);
    
    // Test Burn Achievement  
    console.log('\n3️⃣ Testing Burn Achievement (first_burn)...');
    await achievementsService.updateBurnAchievements(TEST_WALLET, 'all', 1);
    
    // Test Social Achievement
    console.log('\n4️⃣ Testing Social Achievement (social_starter)...');
    await achievementsService.updateSocialAchievements(TEST_WALLET, 'share', 1);
    
    // Test Referral Achievement
    console.log('\n5️⃣ Testing Referral Achievement (first_referral)...');
    await achievementsService.updateSocialAchievements(TEST_WALLET, 'referral', 1);
    
    // Test Staking Achievement
    console.log('\n6️⃣ Testing Staking Achievement (first_stake)...');
    await achievementsService.updateStakingAchievements(TEST_WALLET, 'stake', 1);
    
    // Test Check-in Achievement
    console.log('\n7️⃣ Testing Check-in Achievement (daily_visitor)...');
    await achievementsService.updateCheckinAchievements(TEST_WALLET, 7);
    
    // Get final state
    console.log('\n8️⃣ Getting final achievement state...');
    const finalState = await achievementsService.getUserAchievements(TEST_WALLET);
    
    const completed = finalState.filter(a => a.status === 'completed');
    const inProgress = finalState.filter(a => a.status === 'in_progress');
    const locked = finalState.filter(a => a.status === 'locked');
    
    console.log('\n🎉 FINAL RESULTS:');
    console.log(`✅ Completed: ${completed.length}`);
    console.log(`⏳ In Progress: ${inProgress.length}`);
    console.log(`🔒 Locked: ${locked.length}`);
    
    if (completed.length > 0) {
      console.log('\n🏆 Completed Achievements:');
      completed.forEach(ach => {
        console.log(`  - ${ach.title}: ${ach.current_progress}/${ach.required_count} (${ach.neft_reward} NEFT, ${ach.xp_reward} XP)`);
      });
    }
    
    console.log('\n✅ Achievement tracking test complete!');
    console.log('🔄 Refresh the achievements page to see updated states.');
    
  } catch (error) {
    console.error('❌ Achievement test failed:', error);
  }
}

// Auto-run the test
testAchievementTracking();
