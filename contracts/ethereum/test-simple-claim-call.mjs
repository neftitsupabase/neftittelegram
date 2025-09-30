import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function testSimpleClaimCall() {
  try {
    console.log("🧪 Testing simplified claim call...");

    const sdk = ThirdwebSDK.fromPrivateKey(
      process.env.PRIVATE_KEY,
      PolygonAmoyTestnet,
      { clientId: process.env.VITE_THIRDWEB_CLIENT_ID }
    );

    const contractAddress = "0x8252451036797413e75338E70d294e9ed753AE64";
    const testWallet = "0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4";
    
    console.log("Contract:", contractAddress);
    console.log("Target Wallet:", testWallet);

    const contract = await sdk.getContract(contractAddress);
    
    // Check the claim function signature
    console.log("\n📋 Checking claim function signature...");
    const abi = contract.abi;
    const claimFunction = abi.find(func => func.name === 'claim');
    if (claimFunction) {
      console.log("Claim function inputs:");
      claimFunction.inputs.forEach((input, i) => {
        console.log(`  ${i}: ${input.type} ${input.name}`);
      });
    }

    // Try the simplest possible claim call
    console.log("\n🚀 Testing minimal claim call...");
    
    // Create allowlist proof structure
    const allowlistProof = {
      proof: [],
      quantityLimitPerWallet: 0,
      pricePerToken: 0,
      currency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    };

    const tx = await contract.call("claim", [
      testWallet, // _receiver
      1, // _quantity  
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // _currency
      0, // _pricePerToken
      allowlistProof, // _allowlistProof
      "0x" // _data
    ], {
      gasLimit: 500000,
      maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei")
    });
    
    console.log("✅ Claim successful!");
    console.log("Transaction Hash:", tx.receipt.transactionHash);
    console.log("Explorer:", `https://amoy.polygonscan.com/tx/${tx.receipt.transactionHash}`);
    
    // Get token ID from events
    const receipt = tx.receipt;
    const transferEvent = receipt.logs.find(log => 
      log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    );
    
    if (transferEvent && transferEvent.topics[3]) {
      const tokenId = parseInt(transferEvent.topics[3], 16);
      console.log("Token ID:", tokenId);
    }

    console.log("\n🎉 SUCCESS! NFT claimed successfully using direct contract call!");

  } catch (error) {
    console.error("❌ Claim failed:", error.message);
    
    // Try alternative approach with different parameter structure
    console.log("\n🔄 Trying alternative parameter structure...");
    
    try {
      const contract = await sdk.getContract(contractAddress);
      
      const tx2 = await contract.call("claim", [
        testWallet, // _receiver
        1, // _quantity  
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // _currency
        ethers.utils.parseUnits("0", "ether"), // _pricePerToken as BigNumber
        {
          proof: [],
          quantityLimitPerWallet: ethers.utils.parseUnits("0", 0),
          pricePerToken: ethers.utils.parseUnits("0", "ether"),
          currency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        }, // _allowlistProof
        "0x" // _data
      ], {
        gasLimit: 500000,
        maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei")
      });
      
      console.log("✅ Alternative approach successful!");
      console.log("Transaction Hash:", tx2.receipt.transactionHash);
      
    } catch (altError) {
      console.error("❌ Alternative approach also failed:", altError.message);
    }
  }
}

testSimpleClaimCall();
