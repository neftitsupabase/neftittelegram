// Test script for new cumulative reward tracking system
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testRewardTracking() {
  console.log('🧪 Testing Cumulative Reward Tracking System...\n');
  
  // Test wallet address (replace with actual staked wallet)
  const testWallet = '0x1234567890123456789012345678901234567890'; // Replace with real wallet
  
  try {
    // 1. Test get_user_staking_summary with new fields
    console.log('1️⃣ Testing staking summary...');
    const { data: summary, error: summaryError } = await supabase
      .rpc('get_user_staking_summary', { user_wallet: testWallet });
    
    if (summaryError) {
      console.error('❌ Summary error:', summaryError);
    } else {
      console.log('✅ Summary result:', JSON.stringify(summary, null, 2));
      console.log(`   - Unclaimed rewards: ${summary.unclaimed_rewards}`);
      console.log(`   - NFT pending: ${summary.nft_pending_rewards}`);
      console.log(`   - Token pending: ${summary.token_pending_rewards}\n`);
    }

    // 2. Test manual reward generation
    console.log('2️⃣ Testing manual reward generation...');
    const { data: genResult, error: genError } = await supabase
      .rpc('generate_daily_staking_rewards');
    
    if (genError) {
      console.error('❌ Generation error:', genError);
    } else {
      console.log('✅ Generation result:', genResult);
    }

    // 3. Check staking_rewards table structure
    console.log('3️⃣ Checking staking_rewards table...');
    const { data: rewards, error: rewardsError } = await supabase
      .from('staking_rewards')
      .select('*')
      .eq('wallet_address', testWallet)
      .limit(3);
    
    if (rewardsError) {
      console.error('❌ Rewards query error:', rewardsError);
    } else {
      console.log('✅ Recent rewards:', JSON.stringify(rewards, null, 2));
    }

    // 4. Test separate claim functions
    console.log('4️⃣ Testing separate claim functions...');
    
    // Test NFT claim (will fail if no rewards, but should show function exists)
    const { data: nftClaim, error: nftError } = await supabase
      .rpc('claim_nft_rewards', { user_wallet: testWallet });
    
    if (nftError) {
      console.log('ℹ️ NFT claim (expected if no rewards):', nftError.message);
    } else {
      console.log('✅ NFT claim result:', nftClaim);
    }

    // Test token claim
    const { data: tokenClaim, error: tokenError } = await supabase
      .rpc('claim_token_rewards', { user_wallet: testWallet });
    
    if (tokenError) {
      console.log('ℹ️ Token claim (expected if no rewards):', tokenError.message);
    } else {
      console.log('✅ Token claim result:', tokenClaim);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRewardTracking().then(() => {
  console.log('\n🎯 Test completed!');
  process.exit(0);
}).catch(console.error);
