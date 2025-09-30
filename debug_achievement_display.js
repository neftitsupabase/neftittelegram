// ============================================================================
// DEBUG ACHIEVEMENT DISPLAY ISSUE
// Tests why locked achievements in database don't show in UI
// ============================================================================

import achievementsService from './src/services/AchievementsService.js';

const DEBUG_WALLET = '0x1234567890123456789012345678901234567890';

async function debugAchievementDisplay() {
  console.log('🔍 Debugging Achievement Display Issue...\n');

  try {
    // 1. Test database connection and RPC function
    console.log('1️⃣ Testing Database Connection...');
    const testResult = await achievementsService.getUserAchievements(DEBUG_WALLET);
    console.log('Raw getUserAchievements result:', testResult);
    console.log('Type:', typeof testResult);
    console.log('Is Array:', Array.isArray(testResult));
    console.log('Length:', testResult?.length);

    // 2. Test initialization
    console.log('\n2️⃣ Testing Achievement Initialization...');
    const initResult = await achievementsService.initializeUserAchievements(DEBUG_WALLET);
    console.log('Initialization result:', initResult);

    // 3. Get achievements after initialization
    console.log('\n3️⃣ Getting Achievements After Initialization...');
    const achievementsAfterInit = await achievementsService.getUserAchievements(DEBUG_WALLET);
    console.log('Achievements after init:', achievementsAfterInit);

    if (Array.isArray(achievementsAfterInit) && achievementsAfterInit.length > 0) {
      console.log('\n📊 Achievement Details:');
      achievementsAfterInit.forEach((ach, index) => {
        console.log(`${index + 1}. ${ach.title}`);
        console.log(`   Status: ${ach.status}`);
        console.log(`   Progress: ${ach.current_progress}/${ach.required_count}`);
        console.log(`   Progress %: ${ach.progress_percentage}%`);
        console.log(`   Category: ${ach.category}`);
        console.log(`   Claimed: ${ach.claimed_at ? 'Yes' : 'No'}`);
        console.log('');
      });

      // Count by status
      const statusCounts = achievementsAfterInit.reduce((acc, ach) => {
        acc[ach.status] = (acc[ach.status] || 0) + 1;
        return acc;
      }, {});

      console.log('📈 Status Distribution:');
      console.log(`   🔒 Locked: ${statusCounts.locked || 0}`);
      console.log(`   ⏳ In Progress: ${statusCounts.in_progress || 0}`);
      console.log(`   ✅ Completed: ${statusCounts.completed || 0}`);
    } else {
      console.log('❌ No achievements returned or invalid format');
    }

    // 4. Test specific category filtering
    console.log('\n4️⃣ Testing Category Filtering...');
    const questAchievements = await achievementsService.getUserAchievements(DEBUG_WALLET, 'quest');
    console.log('Quest achievements:', questAchievements);

    // 5. Test stats
    console.log('\n5️⃣ Testing Achievement Stats...');
    const stats = await achievementsService.getAchievementStats(DEBUG_WALLET);
    console.log('Achievement stats:', stats);

    // 6. Check if UI filtering is the issue
    console.log('\n6️⃣ Simulating UI Filtering Logic...');
    if (Array.isArray(achievementsAfterInit)) {
      const allCategory = achievementsAfterInit;
      const questCategory = achievementsAfterInit.filter(ach => ach.category === 'quest');
      const burnCategory = achievementsAfterInit.filter(ach => ach.category === 'burn');
      
      console.log(`All category: ${allCategory.length} achievements`);
      console.log(`Quest category: ${questCategory.length} achievements`);
      console.log(`Burn category: ${burnCategory.length} achievements`);
    }

    console.log('\n✅ Debug Complete!');

  } catch (error) {
    console.error('❌ Debug Failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug
debugAchievementDisplay().catch(console.error);
