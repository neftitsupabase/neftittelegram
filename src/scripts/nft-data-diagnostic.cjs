const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Test different wallet address formats
const WALLET_ADDRESS = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4';
const WALLET_FORMATS = [
  WALLET_ADDRESS,
  WALLET_ADDRESS.toLowerCase(),
  WALLET_ADDRESS.toUpperCase(),
  WALLET_ADDRESS.slice(2), // without 0x
  WALLET_ADDRESS.slice(2).toLowerCase(),
  WALLET_ADDRESS.slice(2).toUpperCase()
];

console.log('🔍 COMPREHENSIVE NFT DATA DIAGNOSTIC');
console.log('====================================');
console.log(`Target wallet: ${WALLET_ADDRESS}`);
console.log(`Testing formats: ${WALLET_FORMATS.length} variations`);

/**
 * Search for any traces of the wallet address across all tables
 */
async function searchAllTables() {
  console.log('\n📊 Searching across all tables for wallet traces...');
  
  const tables = [
    'users',
    'nft_cid_distribution_log',
    'nft_claims',
    'nft_cid_pools',
    'user_activity',
    'nft_cid_distribution_log_backup',
    'staking_summary',
    'user_nft_stakes',
    'campaign_tasks',
    'user_task_completions',
    'user_balances'
  ];
  
  for (const table of tables) {
    console.log(`\n🔍 Searching table: ${table}`);
    
    for (const walletFormat of WALLET_FORMATS) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .ilike('wallet_address', walletFormat);
        
        if (!error && count > 0) {
          console.log(`  ✅ Found ${count} records with wallet format: ${walletFormat}`);
          if (data && data.length > 0) {
            console.log(`  📋 Sample record:`, data[0]);
          }
        }
      } catch (err) {
        // Table might not exist or have wallet_address column
      }
    }
    
    // Also try searching in any text/json columns that might contain the wallet
    try {
      const { data: anyMatch, error } = await supabase
        .from(table)
        .select('*')
        .or(WALLET_FORMATS.map(w => `metadata.cs.${w},data.cs.${w},details.cs.${w}`).join(','))
        .limit(5);
      
      if (!error && anyMatch && anyMatch.length > 0) {
        console.log(`  🎯 Found wallet in metadata/data fields: ${anyMatch.length} records`);
        console.log(`  📋 Sample:`, anyMatch[0]);
      }
    } catch (err) {
      // Ignore errors for tables without these columns
    }
  }
}

/**
 * Search for any NFT-related data regardless of wallet
 */
async function searchNFTData() {
  console.log('\n🎨 Searching for any NFT data (regardless of wallet)...');
  
  try {
    // Check nft_cid_distribution_log for any records
    const { data: allNFTs, error: nftError, count: nftCount } = await supabase
      .from('nft_cid_distribution_log')
      .select('*', { count: 'exact' })
      .limit(10);
    
    console.log(`📊 Total NFTs in distribution log: ${nftCount || 0}`);
    if (allNFTs && allNFTs.length > 0) {
      console.log('📋 Sample NFT records:');
      allNFTs.slice(0, 3).forEach((nft, i) => {
        console.log(`  ${i + 1}. Wallet: ${nft.wallet_address}, NFT: ${nft.nft_id}, Rarity: ${nft.rarity}`);
      });
    }
    
    // Check nft_claims for any records
    const { data: allClaims, error: claimError, count: claimCount } = await supabase
      .from('nft_claims')
      .select('*', { count: 'exact' })
      .limit(10);
    
    console.log(`📊 Total claims: ${claimCount || 0}`);
    if (allClaims && allClaims.length > 0) {
      console.log('📋 Sample claim records:');
      allClaims.slice(0, 3).forEach((claim, i) => {
        console.log(`  ${i + 1}. Wallet: ${claim.wallet_address}, NFT: ${claim.nft_id}, Claimed: ${claim.claimed_at}`);
      });
    }
    
    // Check user_activity for NFT-related activities
    const { data: activities, error: actError, count: actCount } = await supabase
      .from('user_activity')
      .select('*', { count: 'exact' })
      .ilike('activity_type', '%nft%')
      .limit(10);
    
    console.log(`📊 NFT-related activities: ${actCount || 0}`);
    if (activities && activities.length > 0) {
      console.log('📋 Sample activity records:');
      activities.slice(0, 3).forEach((act, i) => {
        console.log(`  ${i + 1}. Wallet: ${act.wallet_address}, Type: ${act.activity_type}, Date: ${act.created_at}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error searching NFT data:', err);
  }
}

/**
 * Check for similar wallet addresses
 */
async function findSimilarWallets() {
  console.log('\n🔍 Searching for similar wallet addresses...');
  
  const shortWallet = WALLET_ADDRESS.slice(-8); // Last 8 characters
  const prefix = WALLET_ADDRESS.slice(0, 10); // First 10 characters
  
  try {
    // Search for wallets with similar endings
    const { data: similarEnd, error } = await supabase
      .from('users')
      .select('wallet_address')
      .ilike('wallet_address', `%${shortWallet}`)
      .limit(10);
    
    if (similarEnd && similarEnd.length > 0) {
      console.log('🎯 Found wallets with similar endings:');
      similarEnd.forEach(user => console.log(`  - ${user.wallet_address}`));
    }
    
    // Search for wallets with similar prefixes
    const { data: similarStart, error: startError } = await supabase
      .from('users')
      .select('wallet_address')
      .ilike('wallet_address', `${prefix}%`)
      .limit(10);
    
    if (similarStart && similarStart.length > 0) {
      console.log('🎯 Found wallets with similar prefixes:');
      similarStart.forEach(user => console.log(`  - ${user.wallet_address}`));
    }
    
  } catch (err) {
    console.error('❌ Error searching similar wallets:', err);
  }
}

/**
 * Check user existence and profile
 */
async function checkUserProfile() {
  console.log('\n👤 Checking user profile...');
  
  for (const walletFormat of WALLET_FORMATS) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletFormat)
        .single();
      
      if (!error && user) {
        console.log(`✅ Found user profile with format: ${walletFormat}`);
        console.log('📋 User data:', {
          id: user.id,
          wallet_address: user.wallet_address,
          display_name: user.display_name,
          created_at: user.created_at,
          last_login: user.last_login
        });
        return user;
      }
    } catch (err) {
      // Continue to next format
    }
  }
  
  console.log('❌ No user profile found for any wallet format');
  return null;
}

/**
 * Main diagnostic function
 */
async function runDiagnostic() {
  try {
    // Test connection
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('❌ Database connection failed:', error);
      return;
    }
    
    console.log('✅ Database connection successful');
    
    // Run all diagnostics
    await checkUserProfile();
    await searchAllTables();
    await searchNFTData();
    await findSimilarWallets();
    
    console.log('\n🎉 DIAGNOSTIC COMPLETE!');
    console.log('=======================');
    console.log('If no data was found, the NFT data may have been:');
    console.log('1. Completely deleted from all tables');
    console.log('2. Associated with a different wallet address');
    console.log('3. Never existed in the first place');
    console.log('4. Stored in a different database or environment');
    
  } catch (error) {
    console.error('❌ DIAGNOSTIC FAILED:', error);
  }
}

// Run the diagnostic
runDiagnostic().then(() => {
  console.log('\n✅ Diagnostic completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Diagnostic failed:', err);
  process.exit(1);
});
