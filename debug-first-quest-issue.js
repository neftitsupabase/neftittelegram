// Debug script to investigate first_quest achievement issue
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://heacehinqihfexxrbwdr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYWNlaGlucWloZmV4eHJid2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMTMyMTMsImV4cCI6MjA2Njc4OTIxM30.9jBZljJ_uS1M2gX9u3Ao_7amPwGtI9myTrdK7cBK7-4";
const client = createClient(supabaseUrl, supabaseKey);

const walletAddress = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

async function debugFirstQuestIssue() {
  console.log('🔍 Debugging first_quest achievement issue...\n');
  
  try {
    // 1. Check if user achievements are initialized
    console.log('1️⃣ Checking user achievements initialization...');
    const { data: userAchievements, error: userError } = await client
      .from('user_achievements')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('achievement_key', 'first_quest');
    
    if (userError) {
      console.error('❌ Error fetching user achievements:', userError);
      return;
    }
    
    if (!userAchievements || userAchievements.length === 0) {
      console.log('❌ first_quest achievement NOT initialized for user');
      console.log('🔧 Attempting to initialize user achievements...');
      
      const { data: initResult, error: initError } = await client.rpc('initialize_user_achievements', {
        user_wallet: walletAddress
      });
      
      if (initError) {
        console.error('❌ Failed to initialize achievements:', initError);
        return;
      }
      
      console.log('✅ Achievements initialized:', initResult);
    } else {
      console.log('✅ first_quest achievement found:');
      console.log('   Status:', userAchievements[0].status);
      console.log('   Progress:', userAchievements[0].progress);
      console.log('   Required:', userAchievements[0].required_count);
      console.log('   Updated:', userAchievements[0].updated_at);
    }
    
    // 2. Check achievements master table
    console.log('\n2️⃣ Checking achievements_master table...');
    const { data: masterData, error: masterError } = await client
      .from('achievements_master')
      .select('*')
      .eq('achievement_key', 'first_quest');
    
    if (masterError) {
      console.error('❌ Error fetching master achievement:', masterError);
    } else if (!masterData || masterData.length === 0) {
      console.log('❌ first_quest NOT found in achievements_master table!');
    } else {
      console.log('✅ first_quest master data:');
      console.log('   Title:', masterData[0].title);
      console.log('   Required Count:', masterData[0].required_count);
      console.log('   Category:', masterData[0].category);
    }
    
    // 3. Test update_achievement_progress function directly
    console.log('\n3️⃣ Testing update_achievement_progress function...');
    const { data: updateResult, error: updateError } = await client.rpc('update_achievement_progress', {
      user_wallet: walletAddress,
      achievement_key_param: 'first_quest',
      progress_increment: 1
    });
    
    if (updateError) {
      console.error('❌ Error calling update_achievement_progress:', updateError);
    } else {
      console.log('✅ update_achievement_progress result:');
      console.log('   Success:', updateResult?.[0]?.success);
      console.log('   Message:', updateResult?.[0]?.message);
      console.log('   Completed:', updateResult?.[0]?.achievement_completed);
      console.log('   New Progress:', updateResult?.[0]?.new_progress);
      console.log('   Required:', updateResult?.[0]?.required_count);
      console.log('   Old Status:', updateResult?.[0]?.old_status);
      console.log('   New Status:', updateResult?.[0]?.new_status);
    }
    
    // 4. Check final state
    console.log('\n4️⃣ Checking final achievement state...');
    const { data: finalState, error: finalError } = await client
      .from('user_achievements')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('achievement_key', 'first_quest');
    
    if (finalError) {
      console.error('❌ Error fetching final state:', finalError);
    } else if (finalState && finalState.length > 0) {
      console.log('✅ Final first_quest state:');
      console.log('   Status:', finalState[0].status);
      console.log('   Progress:', finalState[0].progress);
      console.log('   Required:', finalState[0].required_count);
      console.log('   Updated:', finalState[0].updated_at);
      
      if (finalState[0].status === 'completed') {
        console.log('🎉 Achievement is now COMPLETED!');
      } else if (finalState[0].status === 'in_progress') {
        console.log('⏳ Achievement is IN PROGRESS');
      } else {
        console.log('🔒 Achievement is still LOCKED');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugFirstQuestIssue();
