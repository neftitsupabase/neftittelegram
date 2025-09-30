// Test script to verify NFT minting flow on Polygon Amoy
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CONTRACT_ADDRESS = "0x8252451036797413e75338E70d294e9ed753AE64";
const RPC_URL = process.env.VITE_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/";
const PRIVATE_KEY = process.env.VITE_PRIVATE_KEY;

// Contract ABI for mint function
const contractABI = [
  "function mint(address to, string memory tokenURI, string memory rarity) public returns (uint256)",
  "function hasRole(bytes32 role, address account) public view returns (bool)",
  "function grantRole(bytes32 role, address account) public",
  "function MINTER_ROLE() public view returns (bytes32)",
  "function owner() public view returns (address)"
];

async function testMintingFlow() {
  try {
    console.log("🧪 Testing NFT Minting Flow on Polygon Amoy");
    console.log("=" .repeat(50));

    // 1. Check environment variables
    console.log("1️⃣ Checking environment variables...");
    if (!PRIVATE_KEY) {
      throw new Error("❌ VITE_PRIVATE_KEY not found in environment");
    }
    console.log("✅ Private key found");
    console.log("✅ RPC URL:", RPC_URL);
    console.log("✅ Contract Address:", CONTRACT_ADDRESS);

    // 2. Connect to provider and signer
    console.log("\n2️⃣ Connecting to Polygon Amoy...");
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Check network
    const network = await provider.getNetwork();
    console.log("✅ Connected to network:", network.name, "Chain ID:", network.chainId);
    
    // Check balance
    const balance = await signer.getBalance();
    console.log("✅ Wallet balance:", ethers.utils.formatEther(balance), "MATIC");

    // 3. Connect to contract
    console.log("\n3️⃣ Connecting to NFT contract...");
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
    
    // Check if signer is owner
    try {
      const owner = await contract.owner();
      const signerAddress = await signer.getAddress();
      console.log("✅ Contract owner:", owner);
      console.log("✅ Signer address:", signerAddress);
      console.log("✅ Is owner:", owner.toLowerCase() === signerAddress.toLowerCase());
    } catch (error) {
      console.log("⚠️ Could not check owner:", error.message);
    }

    // 4. Test minting parameters
    console.log("\n4️⃣ Preparing test mint...");
    const testWallet = await signer.getAddress(); // Mint to self for testing
    // Use a simple test URI - the contract doesn't validate URI existence during minting
    const testTokenURI = "ipfs://QmTest123/metadata.json";
    const testRarity = "common";
    
    // Let's also try with a simpler approach - check if contract has any special requirements
    console.log("🔍 Checking contract state...");
    try {
      const currentTokenId = await contract.getCurrentTokenId();
      console.log("✅ Current token ID:", currentTokenId.toString());
    } catch (error) {
      console.log("⚠️ Could not get current token ID:", error.message);
    }
    
    console.log("🎯 Mint parameters:");
    console.log("  - To:", testWallet);
    console.log("  - TokenURI:", testTokenURI);
    console.log("  - Rarity:", testRarity);

    // 5. Get gas price and estimate
    console.log("\n5️⃣ Checking gas requirements...");
    const gasPrice = await provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(120).div(100); // 20% buffer
    
    console.log("✅ Current gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
    console.log("✅ Adjusted gas price:", ethers.utils.formatUnits(adjustedGasPrice, "gwei"), "gwei");

    // Try to estimate gas
    try {
      const gasEstimate = await contract.estimateGas.mint(testWallet, testTokenURI, testRarity);
      console.log("✅ Gas estimate:", gasEstimate.toString());
    } catch (error) {
      console.log("⚠️ Gas estimation failed:", error.message);
    }

    // 6. Test ERC721Drop claim function
    console.log("\n6️⃣ Testing ERC721Drop claim function...");
    
    try {
      // Use the actual ERC721Drop ABI for claim function
      const claimABI = [
        "function claim(address _receiver, uint256 _quantity, address _currency, uint256 _pricePerToken, tuple(bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) _allowlistProof, bytes _data) payable"
      ];

      console.log("🔄 Using ERC721Drop claim function...");
      const claimContract = new ethers.Contract(CONTRACT_ADDRESS, claimABI, signer);
      
      // Prepare claim parameters
      const receiver = testWallet;
      const quantity = 1;
      const currency = ethers.constants.AddressZero; // Native token (MATIC)
      const pricePerToken = 0; // Free claim
      const allowlistProof = {
        proof: [],
        quantityLimitPerWallet: 0,
        pricePerToken: 0,
        currency: ethers.constants.AddressZero
      };
      const data = "0x"; // Empty data

      console.log("🎯 Claim parameters:", {
        receiver,
        quantity,
        currency,
        pricePerToken
      });

      const tx = await claimContract.claim(
        receiver,
        quantity,
        currency,
        pricePerToken,
        allowlistProof,
        data,
        { gasLimit: 500000 }
      );

      console.log("⏳ Claim transaction submitted:", tx.hash);
      const receipt = await tx.wait();
      
      // Extract token ID from logs
      let tokenId;
      if (receipt.logs && receipt.logs.length > 0) {
        const transferLog = receipt.logs.find((log) => log.topics.length === 4);
        if (transferLog) {
          tokenId = ethers.BigNumber.from(transferLog.topics[3]).toString();
        }
      }

      console.log("✅ CLAIM SUCCESSFUL!");
      console.log("🎯 Token ID:", tokenId);
      console.log("📄 Transaction Hash:", receipt.transactionHash);
      console.log("🔗 View on PolygonScan:", `https://amoy.polygonscan.com/tx/${receipt.transactionHash}`);
      
    } catch (error) {
      console.error("❌ Claim failed:", error.message);
      
      // Check if it's a claim condition issue
      if (error.message.includes("DropClaimNotStarted") || error.message.includes("DropNoActiveCondition")) {
        console.log("💡 Hint: The contract may not have active claim conditions set up.");
        console.log("💡 You may need to set up claim conditions in the Thirdweb dashboard first.");
      }
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Full error:", error);
  }
}

// Run the test
testMintingFlow();
