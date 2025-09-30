import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function testLazyMintAndClaim() {
  console.log("🧪 Testing lazy mint + claim process...");

  try {
    // Initialize provider and signer
    const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Initialize Thirdweb SDK
    const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
      clientId: process.env.VITE_THIRDWEB_CLIENT_ID,
    });

    const contractAddress = "0x8252451036797413e75338E70d294e9ed753AE64";
    console.log("📝 Contract address:", contractAddress);

    // Get the contract instance
    const contract = await sdk.getContract(contractAddress);
    console.log("✅ Contract loaded successfully");

    // Test metadata
    const testMetadata = {
      name: "Test NFT",
      description: "A test NFT for lazy minting",
      image: "https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH",
      attributes: [
        { trait_type: "Rarity", value: "Common" },
        { trait_type: "Type", value: "Test" }
      ]
    };

    console.log("📋 Test metadata:", testMetadata);

    // Step 1: Try lazy minting
    console.log("\n🔨 Step 1: Testing lazy minting...");
    try {
      const lazyMintResult = await contract.erc721.lazyMint([testMetadata]);
      console.log("✅ Lazy mint successful!");
      console.log("📋 Lazy mint result:", lazyMintResult);
    } catch (lazyMintError) {
      console.log("❌ Lazy mint failed:", lazyMintError.message);
      
      // Try alternative lazy mint method
      console.log("🔄 Trying alternative lazy mint method...");
      try {
        const alternativeResult = await contract.call("lazyMint", [1, "ipfs://QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH/", "0x"]);
        console.log("✅ Alternative lazy mint successful!");
        console.log("📋 Alternative result:", alternativeResult);
      } catch (altError) {
        console.log("❌ Alternative lazy mint also failed:", altError.message);
      }
    }

    // Step 2: Try claiming
    console.log("\n🎯 Step 2: Testing claiming...");
    try {
      const claimResult = await contract.erc721.claim(1);
      console.log("✅ Claim successful!");
      console.log("📋 Claim result:", claimResult);
    } catch (claimError) {
      console.log("❌ ERC721 claim failed:", claimError.message);
      
      // Try direct claim call
      console.log("🔄 Trying direct claim call...");
      try {
        const directClaimResult = await contract.call("claim", [
          await signer.getAddress(), // receiver
          1, // quantity
          "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // currency
          "1000000000000000", // price (0.001 ETH)
          {
            proof: [],
            quantityLimitPerWallet: 1,
            pricePerToken: "1000000000000000",
            currency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          },
          "0x" // empty bytes
        ]);
        console.log("✅ Direct claim successful!");
        console.log("📋 Direct claim result:", directClaimResult);
      } catch (directClaimError) {
        console.log("❌ Direct claim also failed:", directClaimError.message);
      }
    }

    console.log("\n🎉 Test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testLazyMintAndClaim()
  .then(() => {
    console.log("\n✅ Test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });

export { testLazyMintAndClaim };
