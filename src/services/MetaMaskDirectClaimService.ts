import { NFTData } from "@/services/HybridIPFSService";
import { toast } from "react-hot-toast";

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface MetaMaskClaimResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  contractAddress?: string;
  error?: string;
}

export class MetaMaskDirectClaimService {
  private contractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || "0x8252451036797413e75338E70d294e9ed753AE64";
  
  // Common ERC721 functions that might exist on the contract
  private contractABI = [
    {
      "inputs": [
        {"internalType": "address", "name": "to", "type": "address"}
      ],
      "name": "claim",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "to", "type": "address"},
        {"internalType": "uint256", "name": "quantity", "type": "uint256"}
      ],
      "name": "claim",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "to", "type": "address"},
        {"internalType": "string", "name": "uri", "type": "string"}
      ],
      "name": "mint",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "to", "type": "address"},
        {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
      ],
      "name": "safeMint",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalSupply",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  /**
   * Claim NFT directly using MetaMask - no server-side wallets needed
   */
  async claimNFTWithMetaMask(nft: NFTData, walletAddress: string): Promise<MetaMaskClaimResult> {
    try {
      console.log("🚀 Starting MetaMask direct claim for:", nft.name);
      console.log("📦 NFT Details:", {
        id: nft.id,
        name: nft.name,
        rarity: nft.rarity,
        image: nft.image,
        ipfs_hash: nft.ipfs_hash
      });

      // Step 1: Check MetaMask availability
      if (!window.ethereum) {
        return {
          success: false,
          error: "MetaMask not detected. Please install MetaMask."
        };
      }

      // Step 2: Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Step 3: Check network (Polygon Amoy)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x13882') {
        return {
          success: false,
          error: "Please switch to Polygon Amoy testnet (Chain ID: 80002)"
        };
      }

      // Step 4: Get next token ID (for reference)
      const nextTokenId = await this.getNextTokenId();
      console.log("🆔 Next Token ID:", nextTokenId);

      // Step 5: Try different claim methods (most NFT Drop contracts use simple claim)
      let transactionHash: string;
      
      try {
        // Method 1: Try simple claim(address) - most common for NFT Drop contracts
        console.log("⛓️ Trying simple claim(address) method...");
        const claimData = this.encodeFunction('claim', [walletAddress]);
        
        transactionHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletAddress,
            to: this.contractAddress,
            data: claimData,
            gas: '0x186A0', // 100,000 gas limit
          }],
        });
      } catch (claimError) {
        console.log("⛓️ Simple claim failed, trying claim with quantity...");
        
        // Method 2: Try claim(address, quantity) 
        const claimQuantityData = this.encodeFunction('claimQuantity', [walletAddress, 1]);
        
        transactionHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletAddress,
            to: this.contractAddress,
            data: claimQuantityData,
            gas: '0x186A0', // 100,000 gas limit
          }],
        });
      }

      console.log("📤 Transaction sent:", transactionHash);
      toast.success(`Transaction sent! Waiting for confirmation...`);

      // Step 8: Wait for transaction confirmation (CRITICAL!)
      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await this.waitForTransactionConfirmation(transactionHash);

      if (!receipt || receipt.status === '0x0') {
        // Transaction failed
        console.error("❌ Transaction failed on blockchain");
        return {
          success: false,
          error: "Transaction failed on blockchain. Please check the transaction on Polygonscan."
        };
      }

      console.log("✅ Transaction confirmed successfully!");
      toast.success(`NFT minted successfully! Token ID: ${nextTokenId}`);

      return {
        success: true,
        tokenId: nextTokenId.toString(),
        transactionHash: transactionHash,
        contractAddress: this.contractAddress
      };

    } catch (error: any) {
      console.error("❌ MetaMask direct claim failed:", error);
      
      // Handle user rejection
      if (error.code === 4001) {
        return {
          success: false,
          error: "Transaction rejected by user"
        };
      }

      return {
        success: false,
        error: error.message || "Failed to claim NFT with MetaMask"
      };
    }
  }

  /**
   * Create metadata URI for the NFT
   */
  private createMetadataURI(nft: NFTData): string {
    // If NFT has IPFS hash, use it directly
    if (nft.ipfs_hash) {
      return `https://gateway.pinata.cloud/ipfs/${nft.ipfs_hash}`;
    }

    // Create inline metadata
    const metadata = {
      name: nft.name,
      description: nft.description || `A ${nft.rarity} rarity NFT from NEFTIT platform`,
      image: nft.image,
      attributes: [
        { trait_type: "Rarity", value: nft.rarity || "Common" },
        { trait_type: "Type", value: "NFT" },
        { trait_type: "Platform", value: "NEFTIT" }
      ]
    };

    // Convert to data URI (for simple implementation)
    const metadataString = JSON.stringify(metadata);
    const base64Metadata = btoa(metadataString);
    return `data:application/json;base64,${base64Metadata}`;
  }

  /**
   * Get next available token ID
   */
  private async getNextTokenId(): Promise<number> {
    try {
      // Call totalSupply to get next token ID
      const totalSupplyData = this.encodeFunction('totalSupply', []);
      
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: this.contractAddress,
          data: totalSupplyData
        }, 'latest']
      });

      // Convert hex result to number and add 1
      const totalSupply = parseInt(result, 16);
      return totalSupply + 1;
    } catch (error) {
      console.warn("Could not get total supply, using timestamp-based ID");
      return Date.now() % 1000000; // Fallback to timestamp-based ID
    }
  }

  /**
   * Prepare mint transaction data
   */
  private prepareMintTransaction(to: string, uri: string): string {
    // Encode mint(address to, string uri) function call
    return this.encodeFunction('mint', [to, uri]);
  }

  /**
   * Simple function encoding (without external libraries)
   */
  private encodeFunction(functionName: string, params: any[]): string {
    if (functionName === 'totalSupply') {
      // totalSupply() function selector
      return '0x18160ddd';
    }

    if (functionName === 'claim' && params.length === 1) {
      // claim(address) function selector: 0x6a627842
      const functionSelector = '0x6a627842';
      
      // Encode address parameter
      const addressParam = params[0].toLowerCase().replace('0x', '').padStart(64, '0');
      
      return functionSelector + addressParam;
    }

    if (functionName === 'claimQuantity' && params.length === 2) {
      // claim(address,uint256) function selector: 0x84bb1e42
      const functionSelector = '0x84bb1e42';
      
      // Encode parameters
      const addressParam = params[0].toLowerCase().replace('0x', '').padStart(64, '0');
      const quantityParam = params[1].toString(16).padStart(64, '0');
      
      return functionSelector + addressParam + quantityParam;
    }

    if (functionName === 'mint') {
      // mint(address,string) function selector: 0xd85d3d27
      const functionSelector = '0xd85d3d27';
      
      // Encode parameters
      const addressParam = params[0].toLowerCase().replace('0x', '').padStart(64, '0');
      const uriParam = this.encodeString(params[1]);
      
      return functionSelector + addressParam + uriParam;
    }

    throw new Error(`Unknown function: ${functionName}`);
  }

  /**
   * Encode string parameter for contract call
   */
  private encodeString(str: string): string {
    // Convert string to hex
    const hexString = Array.from(str)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
    
    // Pad to 32-byte boundary
    const paddedLength = Math.ceil(hexString.length / 64) * 64;
    const paddedHex = hexString.padEnd(paddedLength, '0');
    
    // Add length prefix (32-byte offset to string data, then length, then data)
    const offset = '0000000000000000000000000000000000000000000000000000000000000040';
    const length = str.length.toString(16).padStart(64, '0');
    
    return offset + length + paddedHex;
  }

  /**
   * Wait for transaction confirmation on blockchain
   */
  private async waitForTransactionConfirmation(transactionHash: string, maxWaitTime: number = 60000): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const receipt = await window.ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [transactionHash],
        });

        if (receipt) {
          console.log("📋 Transaction receipt:", receipt);
          return receipt;
        }

        console.log("⏳ Transaction still pending, waiting...");
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error("Error checking transaction status:", error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    console.error("❌ Transaction confirmation timeout");
    return null;
  }

  /**
   * Check if user can claim (simple check)
   */
  async canClaim(nftId: string, walletAddress: string): Promise<boolean> {
    // Simple check - in a real implementation, you'd check the database
    try {
      const claimed = localStorage.getItem(`claimed_${nftId}_${walletAddress}`);
      return !claimed;
    } catch (error) {
      return true; // Allow claim if check fails
    }
  }

  /**
   * Mark NFT as claimed locally
   */
  markAsClaimed(nftId: string, walletAddress: string, transactionHash: string): void {
    try {
      const claimData = {
        nftId,
        walletAddress,
        transactionHash,
        claimedAt: new Date().toISOString()
      };
      localStorage.setItem(`claimed_${nftId}_${walletAddress}`, JSON.stringify(claimData));
    } catch (error) {
      console.warn("Could not save claim data locally:", error);
    }
  }
}

export const metaMaskDirectClaimService = new MetaMaskDirectClaimService();
