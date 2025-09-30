import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { ethers } from "ethers";

export class DirectNFTMintService {
  private contractAddress: string;
  private clientId: string;

  constructor() {
    this.contractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || "0x8252451036797413e75338E70d294e9ed753AE64";
    this.clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;
  }

  /**
   * Directly mint NFT to user's wallet using MetaMask
   * No claim conditions needed - just direct minting
   */
  async mintNFTToWallet(nftData: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
    ipfs_cid?: string;
  }): Promise<{
    success: boolean;
    transactionHash?: string;
    tokenId?: string;
    error?: string;
  }> {
    try {
      // Check if MetaMask is available
      if (!window.ethereum) {
        throw new Error("MetaMask not detected. Please install MetaMask.");
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer from MetaMask
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      console.log("🎯 Direct minting NFT to:", userAddress);

      // Create SDK with MetaMask signer
      const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
        clientId: this.clientId,
      });

      // Get contract instance
      const contract = await sdk.getContract(this.contractAddress);

      // Prepare metadata
      const metadata = {
        name: nftData.name,
        description: nftData.description,
        image: nftData.image,
        attributes: nftData.attributes || [],
        // Add IPFS CID as attribute if available
        ...(nftData.ipfs_cid && {
          external_url: `https://ipfs.io/ipfs/${nftData.ipfs_cid}`,
          ipfs_cid: nftData.ipfs_cid
        })
      };

      console.log("📝 Minting with metadata:", metadata);

      // Direct mint using mintTo function (bypasses claim conditions)
      const tx = await contract.call("mintTo", [userAddress, metadata], {
        gasLimit: 500000,
        maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei")
      });

      console.log("✅ NFT minted successfully!");
      console.log("Transaction hash:", tx.receipt.transactionHash);

      // Get the token ID from the transaction receipt
      const tokenId = await this.getTokenIdFromTransaction(contract, tx.receipt.transactionHash);

      return {
        success: true,
        transactionHash: tx.receipt.transactionHash,
        tokenId: tokenId?.toString()
      };

    } catch (error: any) {
      console.error("❌ Direct minting failed:", error);
      
      let errorMessage = "Failed to mint NFT";
      if (error.message.includes("user rejected")) {
        errorMessage = "Transaction was rejected by user";
      } else if (error.message.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas fees";
      } else if (error.message.includes("execution reverted")) {
        errorMessage = "Transaction failed - contract execution reverted";
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Alternative method using ERC721 mintTo if the contract supports it
   */
  async mintNFTDirect(nftData: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
    ipfs_cid?: string;
  }): Promise<{
    success: boolean;
    transactionHash?: string;
    tokenId?: string;
    error?: string;
  }> {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not detected");
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
        clientId: this.clientId,
      });

      const contract = await sdk.getContract(this.contractAddress);

      // Try using the NFT collection's mint method
      const metadata = {
        name: nftData.name,
        description: nftData.description,
        image: nftData.image,
        attributes: nftData.attributes || [],
        ...(nftData.ipfs_cid && {
          external_url: `https://ipfs.io/ipfs/${nftData.ipfs_cid}`,
          ipfs_cid: nftData.ipfs_cid
        })
      };

      console.log("🚀 Using NFT collection mint method");

      // Use the NFT collection's mintTo method
      const tx = await contract.erc721.mintTo(userAddress, metadata);

      console.log("✅ NFT minted via ERC721 method!");
      console.log("Transaction hash:", tx.receipt.transactionHash);

      return {
        success: true,
        transactionHash: tx.receipt.transactionHash,
        tokenId: tx.id.toString()
      };

    } catch (error: any) {
      console.error("❌ ERC721 minting failed:", error);
      
      // Fallback to the first method
      console.log("🔄 Falling back to direct contract call method");
      return this.mintNFTToWallet(nftData);
    }
  }

  /**
   * Get token ID from transaction receipt
   */
  private async getTokenIdFromTransaction(contract: any, txHash: string): Promise<number | null> {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      // Look for Transfer event to get token ID
      const transferEvent = receipt.logs.find(log => 
        log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      
      if (transferEvent && transferEvent.topics[3]) {
        return parseInt(transferEvent.topics[3], 16);
      }
      
      return null;
    } catch (error) {
      console.error("Error getting token ID:", error);
      return null;
    }
  }

  /**
   * Check if user's wallet has minter role (for debugging)
   */
  async checkMinterRole(walletAddress: string): Promise<boolean> {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
        clientId: this.clientId,
      });

      const contract = await sdk.getContract(this.contractAddress);
      const minterRole = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
      
      const hasMinterRole = await contract.call("hasRole", [minterRole, walletAddress]);
      console.log(`User ${walletAddress} has minter role:`, hasMinterRole);
      
      return hasMinterRole;
    } catch (error) {
      console.error("Error checking minter role:", error);
      return false;
    }
  }
}
