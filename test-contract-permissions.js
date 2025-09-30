import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";

async function testContractPermissions() {
  try {
    console.log("🔍 Testing contract permissions...");
    
    // Initialize SDK
    const sdk = new ThirdwebSDK(PolygonAmoyTestnet, {
      clientId: "your-client-id",
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

    // Check contract roles and permissions
    console.log("\n🔐 Contract Roles Check:");
    
    try {
      // Check if contract has roles
      const hasRoles = !!contract.roles;
      console.log("- Has roles:", hasRoles);
      
      if (hasRoles) {
        // Get all roles
        const roles = await contract.roles.getAll();
        console.log("- Available roles:", roles);
        
        // Check specific roles
        const lazyMintRole = await contract.roles.get("lazy-mint");
        console.log("- Lazy mint role holders:", lazyMintRole);
        
        const minterRole = await contract.roles.get("minter");
        console.log("- Minter role holders:", minterRole);
        
        const adminRole = await contract.roles.get("admin");
        console.log("- Admin role holders:", adminRole);
      }
    } catch (error) {
      console.log("❌ Could not check roles:", error.message);
    }

    // Check contract owner
    console.log("\n👑 Contract Owner Check:");
    try {
      const owner = await contract.owner();
      console.log("- Contract owner:", owner);
    } catch (error) {
      console.log("❌ Could not get owner:", error.message);
    }

    // Check if user can mint
    const userAddress = "0x6f342509037b5876c845B7a14775622d534fbc03";
    console.log("\n👤 User Permission Check:");
    console.log("- User address:", userAddress);
    
    try {
      // Check if user has lazy mint role
      if (contract.roles) {
        const hasLazyMintRole = await contract.roles.has("lazy-mint", userAddress);
        console.log("- Has lazy-mint role:", hasLazyMintRole);
        
        const hasMinterRole = await contract.roles.has("minter", userAddress);
        console.log("- Has minter role:", hasMinterRole);
      }
    } catch (error) {
      console.log("❌ Could not check user roles:", error.message);
    }

    // Check claim conditions
    console.log("\n⚙️ Claim Conditions Check:");
    try {
      const claimConditions = await contract.erc721.claimConditions.getActive();
      console.log("- Active claim conditions:", claimConditions);
      
      // Check if user can claim
      const canClaim = await contract.erc721.claimConditions.canClaim(1, userAddress);
      console.log("- Can user claim 1 NFT:", canClaim);
    } catch (error) {
      console.log("❌ Could not check claim conditions:", error.message);
    }

    console.log("\n🎉 Contract permissions test complete!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testContractPermissions();
