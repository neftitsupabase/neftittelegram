import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";

async function testContractCapabilities() {
  try {
    console.log("🔍 Testing contract capabilities...");
    
    // Initialize SDK
    const sdk = new ThirdwebSDK(PolygonAmoyTestnet, {
      clientId: "your-client-id", // Replace with actual client ID if needed
      readonlySettings: {
        rpcUrl: "https://rpc-amoy.polygon.technology",
        chainId: 80002,
      },
    });

    const contractAddress = "0x8252451036797413e75338E70d294e9ed753AE64";
    console.log("📄 Contract Address:", contractAddress);

    // Get contract instance
    const contract = await sdk.getContract(contractAddress);
    console.log("✅ Contract connected");

    // Check contract metadata
    console.log("\n📋 Contract Metadata:");
    try {
      const metadata = await contract.metadata.get();
      console.log("- Name:", metadata.name);
      console.log("- Symbol:", metadata.symbol);
      console.log("- Description:", metadata.description);
    } catch (error) {
      console.log("❌ Could not get metadata:", error.message);
    }

    // Check ERC721 interface
    console.log("\n🔍 ERC721 Interface Check:");
    const hasERC721 = !!contract.erc721;
    console.log("- Has ERC721:", hasERC721);

    if (hasERC721) {
      // Check available methods
      console.log("\n📝 Available ERC721 Methods:");
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(contract.erc721));
      console.log("- Methods:", methods.filter(m => !m.startsWith('_')));

      // Check specific methods
      console.log("\n🔧 Specific Method Checks:");
      console.log("- has createBatch:", !!contract.erc721.createBatch);
      console.log("- has lazyMint:", !!contract.erc721.lazyMint);
      console.log("- has claim:", !!contract.erc721.claim);
      console.log("- has claimConditions:", !!contract.erc721.claimConditions);

      // Test claim conditions
      try {
        console.log("\n⚙️ Claim Conditions:");
        const claimConditions = await contract.erc721.claimConditions.getActive();
        console.log("- Active conditions:", claimConditions);
      } catch (error) {
        console.log("❌ Could not get claim conditions:", error.message);
      }
    }

    // Check direct contract methods
    console.log("\n🔍 Direct Contract Methods:");
    try {
      const contractMethods = await contract.call("lazyMint", [0, "test"], { gasLimit: 100000 });
      console.log("✅ lazyMint method exists");
    } catch (error) {
      console.log("❌ lazyMint method error:", error.message);
    }

    // Test createBatch if available
    if (hasERC721 && contract.erc721.createBatch) {
      console.log("\n🧪 Testing createBatch...");
      try {
        const testMetadata = [{
          name: "Test NFT",
          description: "Test NFT for capability check",
          image: "https://gateway.pinata.cloud/ipfs/QmTestHash",
          attributes: [{ trait_type: "Test", value: "Capability" }]
        }];
        
        const result = await contract.erc721.createBatch(testMetadata);
        console.log("✅ createBatch test successful:", result);
      } catch (error) {
        console.log("❌ createBatch test failed:", error.message);
      }
    }

    console.log("\n🎉 Contract capability test complete!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testContractCapabilities();
