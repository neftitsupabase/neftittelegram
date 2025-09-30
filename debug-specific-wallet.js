// Debug script for specific wallet NFT loading issue
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugSpecificWallet() {
  const walletAddress = '0x5bedd9f1415b8eb1f669aac68b0fd9106b265071';
  console.log(`🔍 Debugging wallet: ${walletAddress}\n`);

  try {
    // 1. Check distribution log for this wallet
    console.log('1. Checking distribution log...');
    const { data: distData, error: distError } = await supabase
      .from('nft_cid_distribution_log')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase());

    if (distError) {
      console.error('❌ Distribution log error:', distError);
      return;
    }

    console.log(`✅ Found ${distData?.length || 0} NFTs in distribution log:`);
    distData?.forEach((nft, i) => {
      console.log(`  ${i + 1}. CID: ${nft.cid}, Rarity: ${nft.rarity}, NFT ID: ${nft.nft_id}`);
    });

    if (!distData || distData.length === 0) {
      console.log('❌ No NFTs found for this wallet in distribution log');
      return;
    }

    // 2. Check if CIDs exist in pools table
    console.log('\n2. Checking CID pools for matching CIDs...');
    const cids = distData.map(nft => nft.cid);
    
    const { data: poolsData, error: poolsError } = await supabase
      .from('nft_cid_pools')
      .select('*')
      .in('cid', cids);

    if (poolsError) {
      console.error('❌ Pools query error:', poolsError);
    } else {
      console.log(`✅ Found ${poolsData?.length || 0} matching CIDs in pools table:`);
    }
    
    // Test 2: Check wallet balance
    try {
      const balance = await nftContract.methods.balanceOf(walletAddress).call();
      console.log('💰 NFT Balance:', balance.toString());
      
      if (balance > 0) {
        // If wallet has NFTs, try to get token IDs
        for (let i = 0; i < Math.min(balance, 5); i++) {
          try {
            const tokenId = await nftContract.methods.tokenOfOwnerByIndex(walletAddress, i).call();
            console.log(`🎯 Token ${i}:`, tokenId.toString());
          } catch (e) {
            console.log(`❌ Could not get token ${i}:`, e.message);
          }
        }
      }
    } catch (error) {
      console.log('❌ Balance check failed:', error.message);
    }
    
    // Test 3: Check staking contract configuration
    try {
      const stakingToken = await stakingContract.methods.stakingToken().call();
      console.log('🎯 Staking contract expects NFTs from:', stakingToken);
      console.log('✅ Contract addresses match:', stakingToken.toLowerCase() === nftContractAddress.toLowerCase());
    } catch (error) {
      console.log('❌ Staking token check failed:', error.message);
    }
    
    // Test 4: Try getStakeInfo with different address formats
    const addressFormats = [
      walletAddress,
      walletAddress.toLowerCase(),
      web3.utils.toChecksumAddress(walletAddress)
    ];
    
    for (const addr of addressFormats) {
      try {
        console.log(`🧪 Testing getStakeInfo with address format: ${addr}`);
        const stakeInfo = await stakingContract.methods.getStakeInfo(addr).call();
        console.log('✅ getStakeInfo success:', stakeInfo);
        break; // If one works, we're good
      } catch (error) {
        console.log(`❌ getStakeInfo failed for ${addr}:`, error.message);
      }
    }
    
    // Test 5: Try calling other staking contract functions
    try {
      const rewardToken = await stakingContract.methods.rewardToken().call();
      console.log('💰 Reward token:', rewardToken);
    } catch (error) {
      console.log('❌ Reward token check failed:', error.message);
    }
    
    // Test 6: Check if there's a simpler function that works
    try {
      if (stakingContract.methods.stakersArray) {
        const stakersCount = await stakingContract.methods.stakersArray(0).call();
        console.log('👥 First staker:', stakersCount);
      }
    } catch (error) {
      console.log('❌ Stakers array check failed:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

debugSpecificWallet();
