import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function fixMaxSupply() {
  console.log("🔧 Fixing contract maximum supply...");

  try {
    const provider = new ethers.providers.JsonRpcProvider("https://rpc-amoy.polygon.technology/");
    const signer = new ethers.Wallet(process.env.VITE_PRIVATE_KEY, provider);
    
    const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
      clientId: process.env.VITE_THIRDWEB_CLIENT_ID,
    });

    const contractAddress = "0x8252451036797413e75338E70d294e9ed753AE64";
    const contract = await sdk.getContract(contractAddress);
    
    console.log("Contract:", contractAddress);
    console.log("Wallet:", await signer.getAddress());

    // Check current state
    const totalSupply = await contract.call("totalSupply");
    const maxSupply = await contract.call("maxTotalSupply");
    console.log(`Current supply: ${totalSupply}/${maxSupply}`);
    
    if (parseInt(maxSupply) === 0) {
      console.log("🔧 Setting max supply to 10000...");
      
      const tx = await contract.call("setMaxTotalSupply", ["10000"], {
        gasLimit: 300000,
        maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei")
      });
      
      console.log("✅ Max supply updated!");
      console.log("🔗 TX:", tx.receipt.transactionHash);
    } else {
      console.log("✅ Max supply already set:", maxSupply.toString());
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

fixMaxSupply();
