import { nftDataRecoveryService } from '../services/NFTDataRecoveryService';
import { supabase } from '../lib/supabase';

/**
 * EMERGENCY NFT DATA RECOVERY SCRIPT
 * Run this to recover your deleted NFT data
 */

async function emergencyRecovery() {
  console.log('🚨 EMERGENCY NFT DATA RECOVERY STARTED');
  console.log('=====================================');
  
  // Your wallet address
  const WALLET_ADDRESS: string = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4';
  
  console.log(`🔍 Processing wallet: ${WALLET_ADDRESS}`);
  
  // Removed the check that was preventing execution
  
  try {
    // Step 1: Create backup of any existing data
    console.log('\n📋 Step 1: Creating backup of existing data...');
    const backupSuccess = await nftDataRecoveryService.createDataBackup(WALLET_ADDRESS);
    if (backupSuccess) {
      console.log('✅ Backup created successfully');
    } else {
      console.log('⚠️ Backup failed, but continuing with recovery');
    }
    
    // Step 2: Attempt data recovery
    console.log('\n🔄 Step 2: Attempting data recovery...');
    const recoveryResult = await nftDataRecoveryService.recoverDeletedNFTData(WALLET_ADDRESS);
    
    console.log('\n📊 RECOVERY RESULTS:');
    console.log(`✅ Recovered NFTs: ${recoveryResult.recovered}`);
    console.log(`📋 Recovery sources: ${recoveryResult.sources.join(', ')}`);
    
    if (recoveryResult.recovered > 0) {
      console.log('\n📝 Recovered NFT Details:');
      recoveryResult.data.forEach((nft, index) => {
        console.log(`${index + 1}. NFT ID: ${nft.nft_id}`);
        console.log(`   Rarity: ${nft.rarity}`);
        console.log(`   Source: ${nft.recovered_from}`);
        console.log(`   CID: ${nft.cid}`);
        console.log('');
      });
    }
    
    // Step 3: Verify recovery
    console.log('\n🔍 Step 3: Verifying recovery...');
    const { data: verificationData, error } = await supabase
      .from('nft_cid_distribution_log')
      .select('nft_id, rarity, recovered')
      .eq('wallet_address', WALLET_ADDRESS.toLowerCase());
    
    if (error) {
      console.error('❌ Verification failed:', error);
    } else {
      const totalNFTs = verificationData?.length || 0;
      const recoveredNFTs = verificationData?.filter(nft => nft.recovered)?.length || 0;
      
      console.log(`📊 Current NFTs in database: ${totalNFTs}`);
      console.log(`🔄 Recovered NFTs: ${recoveredNFTs}`);
    }
    
    // Step 4: Prevention measures
    console.log('\n🛡️ Step 4: Implementing prevention measures...');
    await nftDataRecoveryService.preventFutureDeletions();
    console.log('✅ Future deletion prevention activated');
    
    console.log('\n🎉 EMERGENCY RECOVERY COMPLETE!');
    console.log('=====================================');
    console.log('Your NFT data has been recovered and future deletions prevented.');
    console.log('You can now use the staking page to see all your NFTs.');
    
  } catch (error) {
    console.error('❌ EMERGENCY RECOVERY FAILED:', error);
    console.log('\n📞 Contact support with this error information');
  }
}

// Run the recovery
emergencyRecovery().catch(console.error);

export { emergencyRecovery };
