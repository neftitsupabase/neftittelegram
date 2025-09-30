const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const WALLET_ADDRESS = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4';

console.log('🎯 TARGETED NFT RECOVERY');
console.log('========================');
console.log(`Wallet: ${WALLET_ADDRESS}`);

/**
 * Search for ALL claims regardless of wallet format
 */
async function findAllClaims() {
  console.log('\n🔍 Searching for ALL claims in the database...');
  
  try {
    // Get all claims to see the data structure
    const { data: allClaims, error } = await supabase
      .from('nft_claims')
      .select('*')
      .limit(50);
    
    if (error) {
      console.error('❌ Error fetching claims:', error);
      return [];
    }
    
    console.log(`📊 Total claims found: ${allClaims?.length || 0}`);
    
    if (allClaims && allClaims.length > 0) {
      console.log('\n📋 Sample claims structure:');
      allClaims.slice(0, 3).forEach((claim, i) => {
        console.log(`${i + 1}. NFT: ${claim.nft_id}`);
        console.log(`   Wallet: ${claim.wallet_address}`);
        console.log(`   Claimed: ${claim.claimed_at}`);
        console.log(`   All fields:`, Object.keys(claim));
        console.log('');
      });
      
      // Now search for our specific wallet in different formats
      const walletFormats = [
        WALLET_ADDRESS,
        WALLET_ADDRESS.toLowerCase(),
        WALLET_ADDRESS.toUpperCase()
      ];
      
      let matchingClaims = [];
      
      for (const format of walletFormats) {
        const matches = allClaims.filter(claim => 
          claim.wallet_address === format ||
          claim.wallet_address?.toLowerCase() === format.toLowerCase()
        );
        
        if (matches.length > 0) {
          console.log(`✅ Found ${matches.length} claims for wallet format: ${format}`);
          matchingClaims.push(...matches);
        }
      }
      
      // Remove duplicates
      const uniqueClaims = matchingClaims.filter((claim, index, self) => 
        index === self.findIndex(c => c.nft_id === claim.nft_id)
      );
      
      return uniqueClaims;
    }
    
    return [];
  } catch (err) {
    console.error('❌ Error in findAllClaims:', err);
    return [];
  }
}

/**
 * Get NFT metadata from pools
 */
async function getNFTMetadata(nftId) {
  try {
    // Try different search patterns
    const searchPatterns = [
      nftId,
      nftId.slice(-8),
      nftId.slice(-12),
      `%${nftId}%`,
      `%${nftId.slice(-8)}%`
    ];
    
    for (const pattern of searchPatterns) {
      const { data: pools } = await supabase
        .from('nft_cid_pools')
        .select('*')
        .ilike('name', pattern)
        .limit(1);
      
      if (pools && pools.length > 0) {
        return pools[0];
      }
    }
    
    return null;
  } catch (err) {
    console.error(`❌ Error getting metadata for ${nftId}:`, err);
    return null;
  }
}

/**
 * Restore NFT to distribution log
 */
async function restoreNFT(claim) {
  try {
    console.log(`\n🔄 Restoring NFT: ${claim.nft_id}`);
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('nft_cid_distribution_log')
      .select('nft_id')
      .eq('nft_id', claim.nft_id)
      .eq('wallet_address', WALLET_ADDRESS.toLowerCase())
      .single();
    
    if (existing) {
      console.log(`  ⏭️ Already exists, skipping`);
      return false;
    }
    
    // Get metadata
    const metadata = await getNFTMetadata(claim.nft_id);
    
    // Prepare restoration data
    const restoreData = {
      nft_id: claim.nft_id,
      wallet_address: WALLET_ADDRESS.toLowerCase(),
      rarity: claim.rarity || metadata?.rarity || 'Common',
      cid: metadata?.cid || metadata?.metadata_cid || claim.cid,
      distributed_at: claim.claimed_at || claim.created_at || new Date().toISOString(),
      recovered: true,
      recovered_from: 'nft_claims',
      recovered_at: new Date().toISOString()
    };
    
    console.log(`  📝 Restore data:`, restoreData);
    
    // Insert the restored NFT
    const { error: insertError } = await supabase
      .from('nft_cid_distribution_log')
      .insert(restoreData);
    
    if (insertError) {
      console.error(`  ❌ Failed to restore:`, insertError);
      return false;
    }
    
    console.log(`  ✅ Successfully restored!`);
    return true;
    
  } catch (err) {
    console.error(`❌ Error restoring ${claim.nft_id}:`, err);
    return false;
  }
}

/**
 * Check current NFT count
 */
async function getCurrentNFTCount() {
  try {
    const { data, error, count } = await supabase
      .from('nft_cid_distribution_log')
      .select('*', { count: 'exact' })
      .eq('wallet_address', WALLET_ADDRESS.toLowerCase());
    
    if (error) {
      console.error('❌ Error getting current NFT count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (err) {
    console.error('❌ Error in getCurrentNFTCount:', err);
    return 0;
  }
}

/**
 * Main recovery process
 */
async function runTargetedRecovery() {
  try {
    console.log('\n📊 Checking current state...');
    const initialCount = await getCurrentNFTCount();
    console.log(`Current NFTs in distribution log: ${initialCount}`);
    
    console.log('\n🔍 Finding claims to recover...');
    const claims = await findAllClaims();
    
    if (claims.length === 0) {
      console.log('❌ No claims found for recovery');
      return;
    }
    
    console.log(`\n🎯 Found ${claims.length} claims to process:`);
    claims.forEach((claim, i) => {
      console.log(`${i + 1}. ${claim.nft_id} (claimed: ${claim.claimed_at})`);
    });
    
    console.log('\n🔄 Starting recovery process...');
    let recovered = 0;
    
    for (const claim of claims) {
      const success = await restoreNFT(claim);
      if (success) recovered++;
    }
    
    console.log('\n📊 Final verification...');
    const finalCount = await getCurrentNFTCount();
    
    console.log('\n🎉 TARGETED RECOVERY COMPLETE!');
    console.log('==============================');
    console.log(`Initial NFTs: ${initialCount}`);
    console.log(`Claims processed: ${claims.length}`);
    console.log(`Successfully recovered: ${recovered}`);
    console.log(`Final NFT count: ${finalCount}`);
    console.log(`Net recovery: ${finalCount - initialCount}`);
    
    if (recovered > 0) {
      console.log('\n✅ SUCCESS! Your NFTs have been recovered.');
      console.log('You can now check the staking page to see your restored NFTs.');
    } else {
      console.log('\n⚠️ No new NFTs were recovered. They may already exist or have different data.');
    }
    
  } catch (error) {
    console.error('❌ TARGETED RECOVERY FAILED:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the targeted recovery
runTargetedRecovery().then(() => {
  console.log('\n✅ Recovery process completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Recovery process failed:', err);
  process.exit(1);
});
