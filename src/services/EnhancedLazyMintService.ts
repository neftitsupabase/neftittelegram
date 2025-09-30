import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { ethers } from "ethers";
import { autoMinterRoleService, NFTChainInfo } from './AutoMinterRoleService';

export interface NFTData {
  id: string;
  name: string;
  description?: string;
  image: string;
  rarity: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  chain?: string;
  targetChain?: string;
  network?: string;
}

export interface ClaimResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  error?: string;
  walletAddress?: string;
}

export class EnhancedLazyMintService {
  private contractAddress = "0x8252451036797413e75338E70d294e9ed753AE64";

  /**
   * Optimized NFT claim process: Extract CID + Auto-grant minter role + MetaMask claim
   */
  async claimNFTWithAutoMinterRole(
    userId: string, 
    nftData: NFTData, 
    connectedWalletAddress: string
  ): Promise<ClaimResult> {
    try {
      console.log("🚀 Starting optimized NFT claim process...");
      console.log("👤 User ID:", userId);
      console.log("🎨 NFT:", nftData.name);
      console.log("🔗 Connected wallet:", connectedWalletAddress);

      // Step 1: Extract IPFS CID from NFT data (from CIDPoolBlockchainClaimService logic)
      console.log("🔍 Step 1: Extracting IPFS CID from NFT data...");
      const ipfsCID = this.extractIPFSCID(nftData);
      if (!ipfsCID) {
        return {
          success: false,
          error: "No IPFS CID found in NFT data"
        };
      }
      console.log("✅ Found IPFS CID:", ipfsCID);

      // Step 2: Fetch metadata from IPFS
      console.log("📥 Step 2: Fetching metadata from IPFS...");
      const metadata = await this.fetchMetadataFromIPFS(ipfsCID);
      if (!metadata) {
        return {
          success: false,
          error: "Failed to fetch metadata from IPFS"
        };
      }
      console.log("✅ Metadata fetched successfully:", metadata.name);

      // Step 3: Auto-grant minter role if needed
      if (userId && userId.trim() !== '') {
        console.log("🔑 Step 3: Auto-granting minter role...");
        const nftChainInfo = autoMinterRoleService.extractNFTChainInfo(nftData);
        const minterResult = await autoMinterRoleService.autoGrantMinterRole(userId, nftChainInfo, connectedWalletAddress);
        
        if (!minterResult.success && !minterResult.error?.includes("PermissionsAlreadyGranted")) {
          return {
            success: false,
            error: `Failed to grant minter role: ${minterResult.error}`
          };
        }
        console.log("✅ Minter role handled successfully");
      }

      // Step 4: Connect to MetaMask and claim NFT
      console.log("🔗 Step 4: Connecting to MetaMask and claiming NFT...");
      const claimResult = await this.claimNFTWithMetaMask(connectedWalletAddress, metadata, ipfsCID);

      if (claimResult.success) {
        console.log("✅ NFT claim completed successfully!");
        console.log("🔗 Transaction hash:", claimResult.transactionHash);
        console.log("🆔 Token ID:", claimResult.tokenId);
      }

      return claimResult;

    } catch (error: any) {
      console.error("❌ Optimized NFT claim failed:", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred"
      };
    }
  }

  /**
   * Extract IPFS CID from NFT data (from CIDPoolBlockchainClaimService)
   */
  private extractIPFSCID(nft: any): string | null {
    // Try different possible CID locations
    if (nft.ipfs_hash) {
      return nft.ipfs_hash;
    }
    if (nft.cid) {
      return nft.cid;
    }
    if (nft.metadata_cid) {
      return nft.metadata_cid;
    }
    if (nft.metadataURI && nft.metadataURI.includes('ipfs/')) {
      return nft.metadataURI.split('ipfs/')[1];
    }
    if (nft.image && nft.image.includes('ipfs/')) {
      return nft.image.split('ipfs/')[1];
    }
    return null;
  }

  /**
   * Fetch metadata from IPFS CID
   */
  private async fetchMetadataFromIPFS(cid: string): Promise<any> {
    try {
      const metadataURL = `https://gateway.pinata.cloud/ipfs/${cid}`;
      console.log("📥 Fetching metadata from:", metadataURL);
      
      const response = await fetch(metadataURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`);
      }
      
      const metadata = await response.json();
      return metadata;
    } catch (error) {
      console.error("❌ Failed to fetch metadata from IPFS:", error);
      return null;
    }
  }

  /**
   * Claim NFT using MetaMask with optimized gas settings
   */
  private async claimNFTWithMetaMask(
    walletAddress: string, 
    metadata: any, 
    ipfsCID: string
  ): Promise<ClaimResult> {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error("MetaMask not detected. Please install MetaMask.");
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Check if on correct network (Polygon Amoy)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x13882') {
        throw new Error("Please switch to Polygon Amoy testnet");
      }

      // Create ethers provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Initialize Thirdweb SDK
      const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
        clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
      });

      // Get contract instance
      const contract = await sdk.getContract(this.contractAddress);
      console.log("✅ Connected to contract via MetaMask");

      // Get current gas price and calculate optimized settings
      const gasPrice = await provider.getGasPrice();
      const adjustedGasPrice = gasPrice.mul(150).div(100); // 50% buffer

      // Execute claim transaction
      console.log("🎯 Executing claim transaction...");
      const claimResult = await contract.call("claim", [
        walletAddress, // receiver
        1, // quantity
        ethers.constants.AddressZero, // currency (native token)
        0, // pricePerToken
        {
          proof: [],
          quantityLimitPerWallet: 0,
          pricePerToken: 0,
          currency: ethers.constants.AddressZero
        }, // allowlistProof
        "0x" // data
      ], {
        gasLimit: 500000,
        gasPrice: adjustedGasPrice,
        maxFeePerGas: adjustedGasPrice.mul(2),
        maxPriorityFeePerGas: adjustedGasPrice.div(2)
      });

      // Extract transaction details
      const txHash = claimResult.receipt?.transactionHash || claimResult.transactionHash;
      const blockNumber = claimResult.receipt?.blockNumber || claimResult.blockNumber;

      // Extract token ID from logs if available
      let tokenId = "1"; // Default
      if (claimResult.receipt?.logs) {
        const transferLog = claimResult.receipt.logs.find((log: any) => log.topics.length === 4);
        if (transferLog) {
          tokenId = ethers.BigNumber.from(transferLog.topics[3]).toString();
        }
      }

      console.log("✅ Claim successful!");
      console.log("🔗 Transaction hash:", txHash);
      console.log("🆔 Token ID:", tokenId);

      return {
        success: true,
        tokenId: tokenId,
        transactionHash: txHash,
        walletAddress: walletAddress
      };

    } catch (error: any) {
      console.error("❌ MetaMask claim failed:", error);
      
      // Provide user-friendly error messages
      if (error.message?.includes("User denied transaction")) {
        return {
          success: false,
          error: "Transaction was cancelled by user"
        };
      } else if (error.message?.includes("insufficient funds")) {
        return {
          success: false,
          error: "Insufficient MATIC balance for gas fees"
        };
      } else if (error.message?.includes("gas price below minimum")) {
        return {
          success: false,
          error: "Gas price too low. Please try again with higher gas settings."
        };
      } else {
        return {
          success: false,
          error: error.message || "Failed to claim NFT"
        };
      }
    }
  }



}

export const enhancedLazyMintService = new EnhancedLazyMintService();
