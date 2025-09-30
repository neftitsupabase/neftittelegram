// Debug script to check reward claiming and pending rewards
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugClaimIssue() {
  console.log('🔍 Debugging Claim Issue...\n');
  
  // Replace with your actual wallet address
  const testWallet = 'YOUR_WALLET_ADDRESS_HERE'; // Replace this!
  
  try {
    console.log('1️⃣ Checking current staking summary...');
    const { data: beforeSummary, error: beforeError } = await supabase
      .rpc('get_user_staking_summary', { user_wallet: testWallet });
    
    if (beforeError) {
      console.error('❌ Summary error:', beforeError);
      return;
    }
    
    console.log('📊 BEFORE CLAIM Summary:');
    console.log(`   - Total pending: ${beforeSummary.total_pending_rewards}`);
    console.log(`   - NFT pending: ${beforeSummary.nft_pending_rewards}`);
    console.log(`   - Token pending: ${beforeSummary.token_pending_rewards}`);
    console.log(`   - Daily NFT: ${beforeSummary.daily_nft_rewards}`);
    console.log(`   - Daily Token: ${beforeSummary.daily_token_rewards}\n`);

    console.log('2️⃣ Checking staking_rewards table...');
    const { data: rewards, error: rewardsError } = await supabase
      .from('staking_rewards')
      .select('*')
      .eq('wallet_address', testWallet)
      .order('reward_date', { ascending: false })
      .limit(5);
    
    if (rewardsError) {
      console.error('❌ Rewards query error:', rewardsError);
    } else {
      console.log('📋 Recent staking_rewards records:');
      rewards.forEach((reward, i) => {
        console.log(`   ${i+1}. Date: ${reward.reward_date}`);
        console.log(`      NFT: earned=${reward.total_nft_earned || reward.nft_rewards}, claimed=${reward.total_nft_claimed || 0}`);
        console.log(`      Token: earned=${reward.total_token_earned || reward.token_rewards}, claimed=${reward.total_token_claimed || 0}`);
        console.log(`      Claimed flag: ${reward.claimed}`);
      });
    }

    console.log('\n3️⃣ Testing claim function (this might fail if no rewards)...');
    const { data: claimResult, error: claimError } = await supabase
      .rpc('claim_nft_rewards', { user_wallet: testWallet });
    
    if (claimError) {
      console.log('ℹ️ Claim error (expected if no rewards):', claimError.message);
    } else {
      console.log('✅ Claim successful:', claimResult);
      
      // Check summary after claim
      console.log('\n4️⃣ Checking summary after claim...');
      const { data: afterSummary, error: afterError } = await supabase
        .rpc('get_user_staking_summary', { user_wallet: testWallet });
      
      if (!afterError) {
        console.log('📊 AFTER CLAIM Summary:');
        console.log(`   - Total pending: ${afterSummary.total_pending_rewards}`);
        console.log(`   - NFT pending: ${afterSummary.nft_pending_rewards}`);
        console.log(`   - Token pending: ${afterSummary.token_pending_rewards}`);
        console.log(`   - Daily NFT: ${afterSummary.daily_nft_rewards}`);
        console.log(`   - Daily Token: ${afterSummary.daily_token_rewards}`);
        
        // Check if pending rewards decreased
        const nftDifference = beforeSummary.nft_pending_rewards - afterSummary.nft_pending_rewards;
        console.log(`\n🔍 NFT Pending Difference: ${nftDifference} (should be > 0 if claim worked)`);
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

console.log('⚠️  IMPORTANT: Update testWallet variable with your actual wallet address!');
console.log('⚠️  Then run: node debug-claim-issue.js\n');

// Uncomment to run (after setting wallet address)
// debugClaimIssue().then(() => process.exit(0)).catch(console.error);
