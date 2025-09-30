const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

/**
 * Node.js compatible emergency NFT recovery script
 * This version properly handles environment variables and provides better debugging
 */

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

console.log('🚨 EMERGENCY NFT DATA RECOVERY STARTED (Node.js Version)');
console.log('=========================================================');

// Check environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Environment check:');
console.log(`- Supabase URL: ${supabaseUrl ? 'Found' : 'Missing'}`);
console.log(`- Supabase Key: ${supabaseKey ? 'Found (length: ' + supabaseKey.length + ')' : 'Missing'}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Your wallet address
const WALLET_ADDRESS = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4';

console.log(`🔍 Processing wallet: ${WALLET_ADDRESS}`);

/**
 * Test Supabase connection
 */
async function testConnection() {
  console.log('\n🔌 Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
    console.log('✅ Supabase connection successful');
    return true;
  } catch (err) {
    console.error('❌ Connection error:', err);
    return false;
  }
}

/**
 * Check what tables exist and what data we have
 */
async function inspectDatabase() {
  console.log('\n🔍 Inspecting database for recovery sources...');
  
  const tables = [
    'nft_cid_distribution_log',
    'nft_claims', 
    'nft_cid_pools',
    'user_activity',
    'nft_cid_distribution_log_backup'
  ];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', WALLET_ADDRESS.toLowerCase());
      
      if (error) {
        console.log(`❌ Table '${table}': ${error.message}`);
      } else {
        console.log(`✅ Table '${table}': ${count || 0} records for wallet`);
      }
    } catch (err) {
      console.log(`❌ Table '${table}': ${err.message}`);
    }
  }
}

/**
 * Recover from nft_claims table
 */
async function recoverFromClaims() {
  console.log('\n🔄 Attempting recovery from nft_claims table...');
  
  try {
    const { data: claims, error } = await supabase
      .from('nft_claims')
      .select('*')
      .eq('wallet_address', WALLET_ADDRESS.toLowerCase());
    
    if (error) {
      console.error('❌ Error querying claims:', error);
      return [];
    }
    
    console.log(`📋 Found ${claims?.length || 0} claims for wallet`);
    
    if (claims && claims.length > 0) {
      console.log('Claims data sample:', claims[0]);
    }
    
    return claims || [];
  } catch (err) {
    console.error('❌ Claims recovery error:', err);
    return [];
  }
}

/**
 * Check current NFT distribution log
 */
async function checkCurrentNFTs() {
  console.log('\n📊 Checking current NFTs in distribution log...');
  
  try {
    const { data: nfts, error } = await supabase
      .from('nft_cid_distribution_log')
      .select('*')
      .eq('wallet_address', WALLET_ADDRESS.toLowerCase());
    
    if (error) {
      console.error('❌ Error querying distribution log:', error);
      return [];
    }
    
    console.log(`📋 Found ${nfts?.length || 0} NFTs in distribution log`);
    
    if (nfts && nfts.length > 0) {
      console.log('Sample NFT:', nfts[0]);
    }
    
    return nfts || [];
  } catch (err) {
    console.error('❌ Distribution log error:', err);
    return [];
  }
}

/**
 * Attempt to recover NFT data
 */
async function attemptRecovery(claims) {
  if (!claims || claims.length === 0) {
    console.log('⚠️ No claims data found to recover from');
    return;
  }
  
  console.log('\n🔄 Attempting to restore NFT data...');
  
  for (const claim of claims) {
    try {
      console.log(`\nProcessing claim: ${claim.nft_id}`);
      
      // Check if already exists
      const { data: existing } = await supabase
        .from('nft_cid_distribution_log')
        .select('nft_id')
        .eq('nft_id', claim.nft_id)
        .eq('wallet_address', WALLET_ADDRESS.toLowerCase())
        .single();
      
      if (existing) {
        console.log(`  ⏭️ NFT ${claim.nft_id} already exists, skipping`);
        continue;
      }
      
      // Try to get metadata from pools
      const { data: poolData } = await supabase
        .from('nft_cid_pools')
        .select('*')
        .ilike('name', `%${claim.nft_id.slice(-8)}%`)
        .limit(1);
      
      const pool = poolData?.[0];
      
      // Prepare recovery data
      const recoveryData = {
        nft_id: claim.nft_id,
        wallet_address: WALLET_ADDRESS.toLowerCase(),
        rarity: claim.rarity || 'Common',
        cid: pool?.cid || pool?.metadata_cid || claim.cid,
        distributed_at: claim.claimed_at || claim.created_at,
        recovered: true,
        recovered_from: 'claims_table',
        recovered_at: new Date().toISOString()
      };
      
      console.log(`  📝 Recovery data:`, recoveryData);
      
      // Insert recovered data
      const { error: insertError } = await supabase
        .from('nft_cid_distribution_log')
        .insert(recoveryData);
      
      if (insertError) {
        console.error(`  ❌ Failed to restore ${claim.nft_id}:`, insertError);
      } else {
        console.log(`  ✅ Successfully restored ${claim.nft_id}`);
      }
      
    } catch (err) {
      console.error(`  ❌ Error processing claim ${claim.nft_id}:`, err);
    }
  }
}

/**
 * Main recovery function
 */
async function runRecovery() {
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot proceed without database connection');
      return;
    }
    
    // Inspect database
    await inspectDatabase();
    
    // Check current state
    const currentNFTs = await checkCurrentNFTs();
    
    // Get claims data
    const claims = await recoverFromClaims();
    
    // Attempt recovery
    await attemptRecovery(claims);
    
    // Final verification
    console.log('\n🔍 Final verification...');
    const finalNFTs = await checkCurrentNFTs();
    
    console.log('\n🎉 RECOVERY PROCESS COMPLETE!');
    console.log('==============================');
    console.log(`Initial NFTs: ${currentNFTs.length}`);
    console.log(`Claims found: ${claims.length}`);
    console.log(`Final NFTs: ${finalNFTs.length}`);
    console.log(`Recovered: ${finalNFTs.length - currentNFTs.length}`);
    
  } catch (error) {
    console.error('❌ RECOVERY FAILED:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the recovery
runRecovery().then(() => {
  console.log('\n✅ Script execution completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
