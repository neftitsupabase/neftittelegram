const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { ethers } = require("ethers");
require('dotenv').config();

/**
 * NEFTIT Thirdweb Contract Deployment Script
 * 
 * Deploys:
 * 1. DropERC721 - For user claiming NFTs
 * 2. StakeERC721 - For NFT staking (rewards handled off-chain via Supabase)

 */

async function deployNeftitContracts() {
  try {
    console.log("🚀 Starting NEFTIT Thirdweb contract deployment...\n");

    // Initialize provider and signer
    const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Initialize Thirdweb SDK
    const sdk = ThirdwebSDK.fromSigner(signer, "polygon-amoy-testnet", {
      clientId: process.env.VITE_THIRDWEB_CLIENT_ID,
    });

    console.log("📋 Deployment Configuration:");
    console.log(`Network: Polygon Amoy Testnet`);
    console.log(`Deployer: ${signer.address}`);
    console.log(`Client ID: ${process.env.VITE_THIRDWEB_CLIENT_ID}\n`);

    // ========================================
    // 1. Deploy NFT Drop Contract (DropERC721)
    // ========================================
    console.log("📦 1. Deploying NFT Drop Contract (DropERC721)...");
    
    const nftDropMetadata = {
      name: "NEFTIT NFT Collection",
      symbol: "NEFTIT",
      description: "Official NEFTIT NFT collection for campaigns and rewards",
      image: "https://your-domain.com/neftit-logo.png", // Update with your logo
      external_link: "https://neftit.xyz",
      seller_fee_basis_points: "500", // 5% royalty
      fee_recipient: signer.address,
      primary_sale_recipient: signer.address,
      platform_fee_basis_points: "0",
      platform_fee_recipient: "0x0000000000000000000000000000000000000000"
    };

    const nftDropAddress = await sdk.deployer.deployBuiltInContract(
      "DropERC721",
      nftDropMetadata
    );

    console.log(`✅ NFT Drop deployed at: ${nftDropAddress}\n`);

    // ========================================
    // 2. Deploy NFT Staking Contract (StakeERC721)
    // ========================================
    console.log("🥩 2. Deploying NFT Staking Contract (StakeERC721)...");
    
    // Since we're using off-chain NEFT rewards via Supabase, we deploy StakeERC721
    // with a dummy reward token (zero address) - rewards handled off-chain
    const stakingMetadata = {
      name: "NEFTIT NFT Staking",
      description: "Stake your NEFTIT NFTs to earn NEFT rewards (handled off-chain)",
      image: "https://neftit.com/staking-logo.png",
      external_link: "https://neftit.xyz",
      
      // Staking configuration for off-chain rewards
      stakingTokenAddress: nftDropAddress, // The NFT contract to stake
      rewardTokenAddress: "0x0000000000000000000000000000000000000000", // No ERC20 token (off-chain rewards)
      rewardsPerUnitTime: "1000000000000000000", // 1 token per second (dummy value, not used)
      timeUnit: "86400", // 1 day in seconds
    };

    const stakingAddress = await sdk.deployer.deployNFTStake(stakingMetadata);
    console.log(`✅ NFT Staking deployed at: ${stakingAddress}`);
    console.log(`ℹ️  Note: Rewards will be calculated and distributed off-chain via Supabase\n`);

    // ========================================
    // 3. Burn Functionality (Hybrid Approach)
    // ========================================
    console.log("🔥 3. Burn functionality will use hybrid approach:");
    console.log("   - On-chain: Transfer to burn address using DropERC721");
    console.log("   - Off-chain: Process burn rules and mint upgrades");
    console.log("   - No custom burn contract needed (using audited Thirdweb contracts only)\n");

    // ========================================
    // 4. Summary and Environment Variables
    // ========================================
    console.log("📋 4. Deployment Summary:");
    console.log(`✅ NFT Drop Contract: ${nftDropAddress}`);
    console.log(`✅ NFT Staking Contract: ${stakingAddress}`);
    console.log(`✅ Burn Address (for hybrid burns): 0x000000000000000000000000000000000000dEaD`);
    console.log("\n🔧 Add these to your .env file:");
    console.log(`VITE_NFT_DROP_ADDRESS=${nftDropAddress}`);
    console.log(`VITE_NFT_STAKING_ADDRESS=${stakingAddress}`);
    console.log(`VITE_BURN_ADDRESS=0x000000000000000000000000000000000000dEaD`);
    
    console.log("\n🎉 All contracts deployed successfully!");
    console.log("🔒 Using only audited Thirdweb contracts for maximum security");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deployNeftitContracts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployNeftitContracts };
