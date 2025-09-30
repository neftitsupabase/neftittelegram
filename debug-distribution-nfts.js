// Debug script to check NFT distribution data
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugDistributionData() {
  console.log('🔍 Debugging NFT Distribution Data...\n');

  try {
    // 1. Check if nft_cid_distribution_log table exists and has data
    console.log('1. Checking nft_cid_distribution_log table...');
    const { data: distributionData, error: distError } = await supabase
      .from('nft_cid_distribution_log')
      .select('*')
      .limit(10);

    if (distError) {
      console.error('❌ Error querying distribution log:', distError);
    } else {
      console.log(`✅ Found ${distributionData?.length || 0} records in distribution log`);
      if (distributionData && distributionData.length > 0) {
        console.log('📋 Sample records:', distributionData.slice(0, 3));
      }
    }

    // 2. Check nft_cid_pools table
    console.log('\n2. Checking nft_cid_pools table...');
    const { data: poolsData, error: poolsError } = await supabase
      .from('nft_cid_pools')
      .select('*')
      .limit(5);

    if (poolsError) {
      console.error('❌ Error querying CID pools:', poolsError);
    } else {
      console.log(`✅ Found ${poolsData?.length || 0} records in CID pools`);
      if (poolsData && poolsData.length > 0) {
        console.log('📋 Sample pools:', poolsData.slice(0, 2));
      }
    }

    // 3. Test the exact query used by EnhancedIPFSBurnService
    console.log('\n3. Testing EnhancedIPFSBurnService query...');
    const testWallet = 'test_wallet_address'; // Replace with actual wallet if you have one
    
    const { data: testQuery, error: testError } = await supabase
      .from('nft_cid_distribution_log')
      .select(`
        nft_id,
        rarity,
        cid,
        distributed_at,
        nft_cid_pools!inner(
          image_url,
          metadata_cid
        )
      `)
      .eq('wallet_address', testWallet.toLowerCase())
      .order('distributed_at', { ascending: false });

    if (testError) {
      console.error('❌ Error with service query:', testError);
    } else {
      console.log(`✅ Service query returned ${testQuery?.length || 0} NFTs for wallet: ${testWallet}`);
      if (testQuery && testQuery.length > 0) {
        console.log('📋 Query result structure:', testQuery[0]);
      }
    }

    // 4. Check for any wallet addresses in the system
    console.log('\n4. Checking existing wallet addresses...');
    const { data: wallets, error: walletsError } = await supabase
      .from('nft_cid_distribution_log')
      .select('wallet_address')
      .limit(10);

    if (walletsError) {
      console.error('❌ Error querying wallets:', walletsError);
    } else {
      const uniqueWallets = [...new Set(wallets?.map(w => w.wallet_address) || [])];
      console.log(`✅ Found ${uniqueWallets.length} unique wallet addresses:`);
      uniqueWallets.forEach(wallet => console.log(`  - ${wallet}`));
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugDistributionData();
