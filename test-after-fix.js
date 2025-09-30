// Test after deploying the database fix
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testAfterFix() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const client = createClient(supabaseUrl, supabaseKey);
  
  // Use your actual wallet address here
  const yourWallet = '0xYOUR_ACTUAL_WALLET_ADDRESS_HERE';
  
  console.log('🧪 Testing fixed achievement system...');
  
  // 1. Initialize achievements
  const { data: initData, error: initError } = await client.rpc('initialize_user_achievements', {
    user_wallet: yourWallet
  });
  
  if (initError) {
    console.error('❌ Still broken:', initError.message);
    return;
  }
  
  console.log('✅ Achievements initialized');
  
  // 2. Complete first quest
  const { data: questResult, error: questError } = await client.rpc('update_achievement_progress', {
    user_wallet: yourWallet,
    achievement_key_param: 'first_quest',
    progress_increment: 1
  });
  
  if (questError) {
    console.error('❌ Quest completion failed:', questError.message);
    return;
  }
  
  const result = questResult?.[0] || questResult;
  console.log('✅ Quest result:', result);
  
  if (result?.achievement_completed) {
    console.log('🎉 FIRST QUEST COMPLETED!');
    
    // 3. Check activity logging
    setTimeout(async () => {
      const { data: activities } = await client
        .from('user_activities')
        .select('*')
        .eq('wallet_address', yourWallet)
        .eq('activity_type', 'achievement');
      
      console.log('📋 Achievement activities:', activities?.length || 0);
      if (activities?.length > 0) {
        console.log('🎉 ACTIVITY LOGGING WORKING!');
        activities.forEach(a => console.log('- ' + a.activity_title));
      }
    }, 1000);
  }
}

testAfterFix().catch(console.error);
