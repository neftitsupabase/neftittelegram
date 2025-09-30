/**
 * Manual NFT Distribution Script
 * Distributes specific NFT rarity to a specific user
 */

import { lowEgressManualNFTService } from './src/services/LowEgressManualNFTService.js';

async function executeManualDistribution() {
  try {
    console.log('🚀 Starting Manual NFT Distribution...');
    
    // Distribution parameters
    const projectId = 'b5f6da7b-53b8-4bf7-9464-2def2bab609a';
    const userWallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';
    const rarity = 'common';
    
    console.log(`📋 Distribution Details:`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   User Wallet: ${userWallet}`);
    console.log(`   Rarity: ${rarity}`);
    console.log('');
    
    // Step 1: Preview the project distribution
    console.log('📊 Step 1: Previewing project distribution...');
    try {
      const preview = await lowEgressManualNFTService.previewDistribution(projectId);
      console.log(`✅ Project found: ${preview.project.title}`);
      console.log(`   Collection: ${preview.project.collection_name}`);
      console.log(`   Completers: ${preview.completer_count}`);
      console.log(`   Total Tasks: ${preview.total_tasks}`);
      console.log('');
    } catch (previewError) {
      console.log(`⚠️  Preview failed (continuing anyway): ${previewError.message}`);
      console.log('');
    }
    
    // Step 2: Create user-rarity assignment
    console.log('🎯 Step 2: Creating user-rarity assignment...');
    const userRarityAssignments = [
      {
        wallet_address: userWallet,
        rarity: rarity
      }
    ];
    
    console.log(`✅ Assignment created for ${userWallet} -> ${rarity}`);
    console.log('');
    
    // Step 3: Execute manual rarity distribution
    console.log('🚀 Step 3: Executing manual NFT distribution...');
    const result = await lowEgressManualNFTService.executeManualRarityDistribution(
      projectId,
      userRarityAssignments
    );
    
    // Step 4: Display results
    console.log('');
    console.log('📊 DISTRIBUTION RESULTS:');
    console.log('========================');
    
    if (result.success) {
      console.log(`✅ SUCCESS: ${result.message}`);
      console.log(`📦 NFTs Distributed: ${result.distributed_nfts}`);
      console.log('');
      
      console.log('🎯 Distribution Details:');
      result.distributions.forEach((dist, index) => {
        console.log(`   ${index + 1}. Wallet: ${dist.wallet_address}`);
        console.log(`      Rarity: ${dist.rarity}`);
        console.log(`      NFT ID: ${dist.nft_id}`);
        console.log(`      Image: ${dist.image}`);
        console.log('');
      });
      
      console.log('📈 Distribution Stats:');
      console.log(`   Common: ${result.distribution_stats.common}`);
      console.log(`   Rare: ${result.distribution_stats.rare}`);
      console.log(`   Legendary: ${result.distribution_stats.legendary}`);
      console.log(`   Total: ${result.distribution_stats.total}`);
      console.log('');
      
      console.log('🏆 Project Info:');
      console.log(`   Title: ${result.project_info.title}`);
      console.log(`   Collection: ${result.project_info.collection_name}`);
      console.log('');
      
      console.log('🎉 NFT DISTRIBUTION COMPLETED SUCCESSFULLY!');
      console.log('The user can now see their NFT in the burn page.');
      
    } else {
      console.log(`❌ FAILED: ${result.message}`);
      console.log('');
      console.log('🔍 Troubleshooting:');
      console.log('1. Check if project ID exists');
      console.log('2. Verify user wallet address format');
      console.log('3. Ensure project has NFT images configured');
      console.log('4. Check database permissions');
    }
    
  } catch (error) {
    console.error('❌ Distribution Error:', error);
    console.log('');
    console.log('🔍 Error Details:');
    console.log(`   Message: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
}

// Execute the distribution
executeManualDistribution()
  .then(() => {
    console.log('🏁 Script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
