import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { toast } from "react-hot-toast";
// Note: Using simplified gas estimation to avoid ethers import complexities

export interface BurnResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: string;
}

export interface GasEstimate {
  estimatedGas: string;
  gasPriceGwei: string;
  estimatedCostMatic: string;
  estimatedCostUsd?: string;
}

export class OnChainBurnService {
  private sdk: ThirdwebSDK;
  private contractAddress: string;

  constructor() {
    // Initialize SDK with Polygon Amoy testnet
    this.sdk = new ThirdwebSDK(PolygonAmoyTestnet, {
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
      readonlySettings: {
        rpcUrl: "https://rpc-amoy.polygon.technology",
        chainId: 80002,
      },
    });

    // Get contract address from .env
    this.contractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || "0x8252451036797413e75338E70d294e9ed753AE64";
  }

  /**
   * Connect to MetaMask wallet
   */
  private async connectToMetaMask(): Promise<boolean> {
    try {
      console.log("🔗 Connecting to MetaMask for on-chain burning...");
      
      if (!window.ethereum) {
        console.error("MetaMask not detected");
        return false;
      }

      // Request account access first
      console.log("🔐 Requesting MetaMask account access...");
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Use thirdweb's built-in wallet connection
      const signer = await this.sdk.getSigner();
      
      // Update the SDK with the signer
      this.sdk.updateSignerOrProvider(signer);
      
      const address = await signer.getAddress();
      console.log("✅ MetaMask connected to OnChainBurnService");
      console.log("🔗 Connected wallet address:", address);
      return true;
    } catch (error) {
      console.error("❌ Failed to connect MetaMask:", error);
      return false;
    }
  }

  /**
   * Estimate gas cost for burning NFTs
   */
  async estimateBurnGas(tokenIds: string[]): Promise<GasEstimate | null> {
    try {
      console.log("⛽ Estimating gas for burning NFTs:", tokenIds);

      // Connect to MetaMask
      const connected = await this.connectToMetaMask();
      if (!connected) {
        throw new Error("Failed to connect to MetaMask");
      }

      // Get contract instance
      const contract = await this.sdk.getContract(this.contractAddress);

      // Simplified gas estimation (avoiding complex ethers imports)
      const estimatedGas = tokenIds.length === 1 ? "150000" : `${150000 * tokenIds.length}`;
      const gasPriceGwei = "30"; // Polygon typically uses around 30 Gwei
      const estimatedCostMatic = (parseInt(estimatedGas) * parseInt(gasPriceGwei) / 1000000000).toFixed(6);

      console.log("💰 Gas estimation:", {
        estimatedGas,
        gasPriceGwei,
        estimatedCostMatic
      });

      return {
        estimatedGas,
        gasPriceGwei,
        estimatedCostMatic,
      };
    } catch (error) {
      console.error("❌ Gas estimation failed:", error);
      return null;
    }
  }

  /**
   * Burn NFT on-chain
   */
  async burnNFT(tokenId: string, walletAddress: string): Promise<BurnResult> {
    try {
      console.log("🔥 Starting on-chain burn for token ID:", tokenId);
      console.log("👤 Wallet:", walletAddress);

      // Connect to MetaMask
      const connected = await this.connectToMetaMask();
      if (!connected) {
        return { success: false, error: "Failed to connect to MetaMask" };
      }

      // Get contract instance
      const contract = await this.sdk.getContract(this.contractAddress);
      console.log("✅ Contract connected:", this.contractAddress);

      let burnResult;

      try {
        // Method 1: Try direct burn function
        console.log("Method 1: Trying direct burn function...");
        burnResult = await contract.call("burn", [tokenId]);
        console.log("✅ Direct burn successful!");
      } catch (burnError) {
        console.log("Direct burn failed, trying transfer to burn address...", burnError.message);
        
        try {
          // Method 2: Transfer to burn address
          console.log("Method 2: Transferring to burn address...");
          const burnAddress = "0x000000000000000000000000000000000000dEaD";
          burnResult = await contract.erc721.transfer(burnAddress, tokenId);
          console.log("✅ Transfer to burn address successful!");
        } catch (transferError) {
          console.log("Transfer to burn address failed:", transferError.message);
          throw new Error(`All burn methods failed. Burn: ${burnError.message}, Transfer: ${transferError.message}`);
        }
      }

      const transactionHash = burnResult.receipt?.transactionHash || "";
      const gasUsed = burnResult.receipt?.gasUsed?.toString() || "";
      
      console.log("✅ On-chain burn completed!");
      console.log(`🔗 Transaction Hash: ${transactionHash}`);
      console.log(`⛽ Gas Used: ${gasUsed}`);

      toast.success(`NFT burned on-chain successfully!`);

      return {
        success: true,
        transactionHash,
        gasUsed
      };

    } catch (error: any) {
      console.error("❌ On-chain burn failed:", error);
      
      const errorMessage = error.message || "Failed to burn NFT on-chain";
      toast.error(errorMessage);
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Burn multiple NFTs on-chain
   */
  async burnMultipleNFTs(tokenIds: string[], walletAddress: string): Promise<BurnResult> {
    try {
      console.log("🔥 Starting batch on-chain burn for token IDs:", tokenIds);
      console.log("👤 Wallet:", walletAddress);

      // Connect to MetaMask
      const connected = await this.connectToMetaMask();
      if (!connected) {
        return { success: false, error: "Failed to connect to MetaMask" };
      }

      // Get contract instance
      const contract = await this.sdk.getContract(this.contractAddress);

      let burnResult;

      try {
        // Try batch burn if available
        console.log("Trying batch burn...");
        burnResult = await contract.call("burnBatch", [tokenIds]);
        console.log("✅ Batch burn successful!");
      } catch (batchError) {
        console.log("Batch burn failed, doing individual burns...", batchError.message);
        
        // Fallback: burn individually
        const results = [];
        for (const tokenId of tokenIds) {
          const result = await this.burnNFT(tokenId, walletAddress);
          results.push(result);
        }
        
        const allSuccessful = results.every(r => r.success);
        if (allSuccessful) {
          return {
            success: true,
            transactionHash: results.map(r => r.transactionHash).join(', '),
            gasUsed: results.map(r => r.gasUsed).join(', ')
          };
        } else {
          throw new Error("Some burns failed in batch");
        }
      }

      const transactionHash = burnResult.receipt?.transactionHash || "";
      const gasUsed = burnResult.receipt?.gasUsed?.toString() || "";

      toast.success(`${tokenIds.length} NFTs burned on-chain successfully!`);

      return {
        success: true,
        transactionHash,
        gasUsed
      };

    } catch (error: any) {
      console.error("❌ Batch on-chain burn failed:", error);
      
      const errorMessage = error.message || "Failed to burn NFTs on-chain";
      toast.error(errorMessage);
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if NFT exists on-chain and can be burned
   */
  async canBurnOnChain(tokenId: string, walletAddress: string): Promise<boolean> {
    try {
      const contract = await this.sdk.getContract(this.contractAddress);
      
      // Check if token exists and is owned by the user
      const owner = await contract.erc721.ownerOf(tokenId);
      return owner.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
      console.log(`Token ${tokenId} not found on-chain or not owned by user`);
      return false;
    }
  }
}

// Export singleton instance
export const onChainBurnService = new OnChainBurnService();
export default onChainBurnService;
