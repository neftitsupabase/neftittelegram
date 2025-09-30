// ============================================================================
// TEST ACHIEVEMENT PROGRESS TRACKING
// Manually trigger achievement progress to test state transitions
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_WALLET = '0x1234567890123456789012345678901234567890';

async function testAchievementProgress() {
  console.log('🧪 Testing Achievement Progress Tracking...\n');

  try {
    // 1. Initialize achievements for test wallet
    console.log('1️⃣ Initializing achievements...');
    const { data: initData, error: initError } = await supabase.rpc('initialize_user_achievements', {
      user_wallet: TEST_WALLET
    });
    console.log('Init result:', initData, initError);

    // 2. Get initial state
    console.log('\n2️⃣ Getting initial achievement state...');
    const { data: initialState, error: initialError } = await supabase.rpc('get_user_achievements', {
      user_wallet: TEST_WALLET,
      category_filter: null
    });
    console.log('Initial achievements:', initialState?.slice(0, 3));

    // 3. Manually update progress for "first_quest" achievement
    console.log('\n3️⃣ Updating progress for first_quest...');
    const { data: progressData, error: progressError } = await supabase.rpc('update_achievement_progress', {
      user_wallet: TEST_WALLET,
      achievement_key_param: 'first_quest',
      progress_increment: 1
    });
    console.log('Progress update result:', progressData, progressError);

    // 4. Get updated state
    console.log('\n4️⃣ Getting updated achievement state...');
    const { data: updatedState, error: updatedError } = await supabase.rpc('get_user_achievements', {
      user_wallet: TEST_WALLET,
      category_filter: null
    });
    
    if (updatedState && Array.isArray(updatedState)) {
      const firstQuest = updatedState.find(ach => ach.achievement_key === 'first_quest');
      console.log('First Quest achievement:', firstQuest);
      
      console.log('\n📊 Status Summary:');
      const statusCounts = updatedState.reduce((acc, ach) => {
        acc[ach.status] = (acc[ach.status] || 0) + 1;
        return acc;
      }, {});
      console.log('Status distribution:', statusCounts);
    }

    // 5. Test burn achievement
    console.log('\n5️⃣ Testing burn achievement...');
    const { data: burnData, error: burnError } = await supabase.rpc('update_achievement_progress', {
      user_wallet: TEST_WALLET,
      achievement_key_param: 'first_burn',
      progress_increment: 1
    });
    console.log('Burn progress result:', burnData, burnError);

    // 6. Final state check
    console.log('\n6️⃣ Final achievement state...');
    const { data: finalState, error: finalError } = await supabase.rpc('get_user_achievements', {
      user_wallet: TEST_WALLET,
      category_filter: null
    });
    
    if (finalState && Array.isArray(finalState)) {
      const completed = finalState.filter(ach => ach.status === 'completed');
      const inProgress = finalState.filter(ach => ach.status === 'in_progress');
      const locked = finalState.filter(ach => ach.status === 'locked');
      
      console.log(`✅ Completed: ${completed.length}`);
      console.log(`⏳ In Progress: ${inProgress.length}`);
      console.log(`🔒 Locked: ${locked.length}`);
      
      if (completed.length > 0) {
        console.log('\n🎉 Completed achievements:');
        completed.forEach(ach => {
          console.log(`  - ${ach.title}: ${ach.current_progress}/${ach.required_count}`);
        });
      }
    }

    console.log('\n✅ Test Complete!');

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

// Run the test
testAchievementProgress().catch(console.error);
