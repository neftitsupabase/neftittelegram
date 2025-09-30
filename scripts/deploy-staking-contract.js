const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { ethers } = require("ethers");

async function deployStakingContract() {
  try {
    console.log("🚀 Starting NFT Staking contract deployment on Polygon Amoy...");

    // Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(process.env.VITE_AMOY_RPC_URL);
    const wallet = new ethers.Wallet(process.env.VITE_PRIVATE_KEY, provider);
    
    console.log("👤 Deploying from wallet:", wallet.address);
    
    // Initialize Thirdweb SDK
    const sdk = ThirdwebSDK.fromPrivateKey(process.env.VITE_PRIVATE_KEY, "polygon-amoy", {
      clientId: process.env.VITE_THIRDWEB_CLIENT_ID,
    });

    // Deploy NFT Staking contract
    console.log("📄 Deploying NFT Staking contract...");
    
    const stakingContractAddress = await sdk.deployer.deployNFTStake({
      name: "NEFTIT NFT Staking",
      description: "Stake your NEFTIT NFTs to earn rewards",
      image: "https://gateway.pinata.cloud/ipfs/QmYourImageHash", // Replace with actual image
      
      // Contract parameters
      stakingTokenAddress: process.env.VITE_NFT_CLAIM_CONTRACT_ADDRESS, // NFT contract to stake
      rewardTokenAddress: "0x0000000000000000000000000000000000000000", // Native token (MATIC)
      rewardsPerUnitTime: ethers.utils.parseEther("0.1"), // 0.1 MATIC per time unit
      timeUnit: 86400, // 1 day in seconds
      
      // Admin settings
      primary_sale_recipient: wallet.address,
      platform_fee_basis_points: "0",
      platform_fee_recipient: wallet.address,
    });

    console.log("✅ NFT Staking contract deployed!");
    console.log("📍 Contract Address:", stakingContractAddress);
    console.log("🔗 View on PolygonScan:", `https://amoy.polygonscan.com/address/${stakingContractAddress}`);
    
    // Update environment variable
    console.log("\n📝 Add this to your .env file:");
    console.log(`VITE_STAKING_CONTRACT_ADDRESS=${stakingContractAddress}`);
    
    return stakingContractAddress;

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

// Run deployment
if (require.main === module) {
  deployStakingContract()
    .then((address) => {
      console.log("\n🎉 Deployment completed successfully!");
      console.log("Contract Address:", address);
    })
    .catch((error) => {
      console.error("💥 Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { deployStakingContract };
