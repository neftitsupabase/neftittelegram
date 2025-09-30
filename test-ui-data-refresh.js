// Test script to verify UI data refresh issue
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://heacehinqihfexxrbwdr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYWNlaGlucWloZmV4eHJid2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMTMyMTMsImV4cCI6MjA2Njc4OTIxM30.9jBZljJ_uS1M2gX9u3Ao_7amPwGtI9myTrdK7cBK7-4";
const client = createClient(supabaseUrl, supabaseKey);

const walletAddress = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

async function testUIDataRefresh() {
  console.log('🔍 Testing UI data refresh issue...\n');
  
  try {
    // 1. Check direct database query
    console.log('1️⃣ Direct database query:');
    const { data: directData, error: directError } = await client
      .from('user_achievements')
      .select('achievement_key, status, current_progress')
      .eq('wallet_address', walletAddress)
      .in('achievement_key', ['first_quest', 'quest_master', 'quest_legend']);
    
    if (directError) {
      console.error('❌ Direct query error:', directError);
    } else {
      console.log('✅ Direct database results:');
      directData.forEach(achievement => {
        console.log(`   ${achievement.achievement_key}: ${achievement.status} (progress: ${achievement.current_progress})`);
      });
    }
    
    // 2. Check RPC function (what UI uses)
    console.log('\n2️⃣ RPC function query (what UI uses):');
    const { data: rpcData, error: rpcError } = await client.rpc('get_user_achievements', {
      user_wallet: walletAddress,
      category_filter: null
    });
    
    if (rpcError) {
      console.error('❌ RPC query error:', rpcError);
    } else {
      console.log('✅ RPC function results:');
      const questAchievements = rpcData.filter(a => 
        ['first_quest', 'quest_master', 'quest_legend'].includes(a.achievement_key)
      );
      
      questAchievements.forEach(achievement => {
        console.log(`   ${achievement.achievement_key}: ${achievement.status} (progress: ${achievement.current_progress})`);
      });
      
      // Check if there's a mismatch
      const inProgressCount = questAchievements.filter(a => a.status === 'in_progress').length;
      console.log(`\n📊 Summary: ${inProgressCount} achievements showing as 'in_progress' in RPC function`);
    }
    
    // 3. Test refresh by calling update function again
    console.log('\n3️⃣ Testing refresh by calling update function:');
    const { data: updateResult, error: updateError } = await client.rpc('update_achievement_progress', {
      user_wallet: walletAddress,
      achievement_key_param: 'first_quest',
      progress_increment: 0  // No increment, just refresh
    });
    
    if (updateError) {
      console.error('❌ Update function error:', updateError);
    } else {
      console.log('✅ Update function result:', updateResult);
    }
    
    // 4. Check RPC function again after refresh
    console.log('\n4️⃣ RPC function after refresh:');
    const { data: refreshedData, error: refreshError } = await client.rpc('get_user_achievements', {
      user_wallet: walletAddress,
      category_filter: null
    });
    
    if (refreshError) {
      console.error('❌ Refreshed query error:', refreshError);
    } else {
      const refreshedQuests = refreshedData.filter(a => 
        ['first_quest', 'quest_master', 'quest_legend'].includes(a.achievement_key)
      );
      
      refreshedQuests.forEach(achievement => {
        console.log(`   ${achievement.achievement_key}: ${achievement.status} (progress: ${achievement.current_progress})`);
      });
      
      const refreshedInProgress = refreshedQuests.filter(a => a.status === 'in_progress').length;
      console.log(`\n📊 After refresh: ${refreshedInProgress} achievements showing as 'in_progress'`);
    }
    
  } catch (error) {
    console.error('❌ Test script error:', error);
  }
}

testUIDataRefresh();
