const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

console.log('🔍 WALLET ACTIVITY FINDER');
console.log('=========================');
console.log('Finding all wallets with NFT activity...\n');

/**
 * Find all wallets with NFT claims
 */
async function findWalletsWithClaims() {
  console.log('📊 Wallets with NFT claims:');
  
  try {
    const { data: claims, error } = await supabase
      .from('nft_claims')
      .select('wallet_address, nft_id, claimed_at')
      .order('claimed_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching claims:', error);
      return;
    }
    
    if (claims && claims.length > 0) {
      const walletGroups = {};
      
      claims.forEach(claim => {
        if (!walletGroups[claim.wallet_address]) {
          walletGroups[claim.wallet_address] = [];
        }
        walletGroups[claim.wallet_address].push(claim);
      });
      
      Object.entries(walletGroups).forEach(([wallet, claimList]) => {
        console.log(`\n🔑 Wallet: ${wallet}`);
        console.log(`   📦 NFTs claimed: ${claimList.length}`);
        console.log(`   📅 Latest claim: ${claimList[0].claimed_at}`);
        console.log(`   🎨 NFTs: ${claimList.map(c => c.nft_id).join(', ')}`);
      });
    } else {
      console.log('   No claims found');
    }
  } catch (err) {
    console.error('❌ Error in findWalletsWithClaims:', err);
  }
}

/**
 * Find all wallets with NFT distributions
 */
async function findWalletsWithDistributions() {
  console.log('\n\n📊 Wallets with NFT distributions:');
  
  try {
    const { data: distributions, error } = await supabase
      .from('nft_cid_distribution_log')
      .select('wallet_address, nft_id, distributed_at, recovered')
      .order('distributed_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching distributions:', error);
      return;
    }
    
    if (distributions && distributions.length > 0) {
      const walletGroups = {};
      
      distributions.forEach(dist => {
        if (!walletGroups[dist.wallet_address]) {
          walletGroups[dist.wallet_address] = [];
        }
        walletGroups[dist.wallet_address].push(dist);
      });
      
      Object.entries(walletGroups).forEach(([wallet, distList]) => {
        const recoveredCount = distList.filter(d => d.recovered).length;
        console.log(`\n🔑 Wallet: ${wallet}`);
        console.log(`   📦 NFTs distributed: ${distList.length}`);
        console.log(`   🔄 Recovered NFTs: ${recoveredCount}`);
        console.log(`   📅 Latest distribution: ${distList[0].distributed_at}`);
        console.log(`   🎨 Sample NFTs: ${distList.slice(0, 3).map(d => d.nft_id).join(', ')}`);
      });
    } else {
      console.log('   No distributions found');
    }
  } catch (err) {
    console.error('❌ Error in findWalletsWithDistributions:', err);
  }
}

/**
 * Find all registered users
 */
async function findAllUsers() {
  console.log('\n\n📊 All registered users:');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('wallet_address, display_name, created_at, last_login')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }
    
    if (users && users.length > 0) {
      users.forEach((user, i) => {
        console.log(`\n${i + 1}. 🔑 Wallet: ${user.wallet_address}`);
        console.log(`   👤 Display name: ${user.display_name}`);
        console.log(`   📅 Registered: ${user.created_at}`);
        console.log(`   🕒 Last login: ${user.last_login}`);
      });
    } else {
      console.log('   No users found');
    }
  } catch (err) {
    console.error('❌ Error in findAllUsers:', err);
  }
}

/**
 * Check for staking activity
 */
async function findStakingActivity() {
  console.log('\n\n📊 Wallets with staking activity:');
  
  try {
    const { data: stakes, error } = await supabase
      .from('user_nft_stakes')
      .select('wallet_address, nft_id, staked_at, is_active')
      .order('staked_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching stakes:', error);
      return;
    }
    
    if (stakes && stakes.length > 0) {
      const walletGroups = {};
      
      stakes.forEach(stake => {
        if (!walletGroups[stake.wallet_address]) {
          walletGroups[stake.wallet_address] = [];
        }
        walletGroups[stake.wallet_address].push(stake);
      });
      
      Object.entries(walletGroups).forEach(([wallet, stakeList]) => {
        const activeStakes = stakeList.filter(s => s.is_active).length;
        console.log(`\n🔑 Wallet: ${wallet}`);
        console.log(`   🥩 Total stakes: ${stakeList.length}`);
        console.log(`   ✅ Active stakes: ${activeStakes}`);
        console.log(`   📅 Latest stake: ${stakeList[0].staked_at}`);
      });
    } else {
      console.log('   No staking activity found');
    }
  } catch (err) {
    console.error('❌ Error in findStakingActivity:', err);
  }
}

/**
 * Main function
 */
async function findAllActivity() {
  try {
    await findWalletsWithClaims();
    await findWalletsWithDistributions();
    await findStakingActivity();
    await findAllUsers();
    
    console.log('\n\n🎯 SUMMARY');
    console.log('==========');
    console.log('Please check the wallet addresses above and let me know:');
    console.log('1. Do you recognize any of these wallet addresses as yours?');
    console.log('2. Have you used multiple wallets with Neftit?');
    console.log('3. Do you want me to recover NFTs for any specific wallet?');
    
  } catch (error) {
    console.error('❌ Activity search failed:', error);
  }
}

// Run the search
findAllActivity().then(() => {
  console.log('\n✅ Activity search completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Activity search failed:', err);
  process.exit(1);
});
