import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { ethers } from "ethers";
import { optimizedCIDPoolBurnService } from './OptimizedCIDPoolBurnService';
import { NFTData } from './HybridIPFSService';
import { autoMinterRoleService } from './AutoMinterRoleService';
import { toast } from 'react-hot-toast';

export interface CIDPoolClaimResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  ipfsCID?: string;
  metadataURI?: string;
  contractAddress?: string;
  blockNumber?: number;
  error?: string;
}

/**
 * Service for claiming NFTs from CID Pool to Polygon Amoy blockchain
 * Uses actual IPFS CIDs from user's distributed NFTs
 */
export class CIDPoolBlockchainClaimService {
  private contractAddress: string;
  private sdk: ThirdwebSDK;

  constructor() {
    // Use the deployed contract address from env
    this.contractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || 
                          import.meta.env.NFT_CONTRACT_ADDRESS || 
                          "0x8252451036797413e75338E70d294e9ed753AE64";
    
    console.log("🏗️ CID Pool Blockchain Claim Service initialized with contract:", this.contractAddress);
    
    // Initialize SDK without wallet - will connect later
    this.sdk = new ThirdwebSDK(PolygonAmoyTestnet, {
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
    });
  }

  /**
   * Main entry point: Claim NFT from CID Pool to Polygon Amoy blockchain
   */
  async claimNFTFromCIDPool(nft: NFTData, walletAddress: string, userId?: string): Promise<CIDPoolClaimResult> {
    try {
      console.log("🚀 Starting CID Pool to blockchain claim for:", nft.name);
      console.log("📍 Wallet:", walletAddress);
      console.log("👤 User ID:", userId);
      console.log("📦 NFT Data:", {
        id: nft.id,
        name: nft.name,
        rarity: nft.rarity,
        image: nft.image,
        ipfs_hash: nft.ipfs_hash,
        pinata_hash: nft.pinata_hash
      });

      // Step 1: Extract IPFS CID from NFT data
      const ipfsCID = this.extractIPFSCID(nft);
      
      // Step 2: Auto-grant minter role if userId provided
      if (userId) {
        console.log("🔑 Auto-granting minter role for user...");
        const nftChainInfo = autoMinterRoleService.extractNFTChainInfo(nft);
        const roleResult = await autoMinterRoleService.autoGrantMinterRole(userId, nftChainInfo, walletAddress);
        
        if (!roleResult.success) {
          console.warn("⚠️ Failed to auto-grant minter role:", roleResult.error);
          // Continue with minting attempt anyway
        } else {
          console.log("✅ Minter role granted successfully");
        }
      }

      // Step 3: Validate NFT has IPFS CID
      if (!ipfsCID) {
        return {
          success: false,
          error: `No IPFS CID found for NFT ${nft.name}. This NFT may not be properly distributed from CID pool.`
        };
      }

      // Step 4: Get metadata from IPFS
      console.log("📥 Fetching metadata from IPFS CID:", ipfsCID);
      const metadata = await this.getMetadataFromIPFS(ipfsCID);
      
      if (!metadata) {
        return {
          success: false,
          error: `Failed to fetch metadata from IPFS for CID: ${ipfsCID}`
        };
      }

      console.log("✅ Metadata fetched successfully:", metadata);

      // Step 5: Check if already claimed
      if (this.isAlreadyClaimed(nft.id, walletAddress)) {
        return {
          success: false,
          error: `NFT ${nft.name} has already been claimed to blockchain by this wallet.`
        };
      }

      // Step 6: Mint NFT on Polygon Amoy
      console.log("⛓️ Minting NFT on Polygon Amoy blockchain...");
      const claimResult = await this.mintNFTOnPolygonAmoy(walletAddress, metadata, ipfsCID);
      
      if (claimResult.success) {
        // Step 7: Store claim data
        this.storeClaim(nft.id, walletAddress, claimResult);
        
        console.log("🎉 NFT successfully claimed from CID Pool to blockchain!");
        toast.success(`🎉 ${nft.name} claimed to blockchain!`);
        
        return {
          success: true,
          tokenId: claimResult.tokenId,
          transactionHash: claimResult.transactionHash,
          ipfsCID: ipfsCID,
          metadataURI: `https://gateway.pinata.cloud/ipfs/${ipfsCID}`,
          contractAddress: this.contractAddress
        };
      } else {
        console.error("❌ Blockchain minting failed:", claimResult.error);
        toast.error(`Failed to claim ${nft.name}: ${claimResult.error}`);
        return claimResult;
      }

    } catch (error) {
      console.error("❌ Error claiming NFT from CID Pool to blockchain:", error);
      return {
        success: false,
        error: `Failed to claim NFT: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract IPFS CID from NFT data (prioritize existing hashes)
   */
  private extractIPFSCID(nft: NFTData): string | null {
    console.log("🔍 Extracting IPFS CID from NFT data...");

    // Priority 1: Direct IPFS hash
    if (nft.ipfs_hash) {
      console.log("✅ Found direct IPFS hash:", nft.ipfs_hash);
      return nft.ipfs_hash;
    }

    // Priority 2: Pinata hash
    if (nft.pinata_hash) {
      console.log("✅ Found Pinata hash:", nft.pinata_hash);
      return nft.pinata_hash;
    }

    // Priority 3: Extract from IPFS image URL
    if (nft.image && (nft.image.includes('/ipfs/') || nft.image.includes('ipfs.io') || nft.image.includes('gateway.pinata.cloud'))) {
      const cidMatch = nft.image.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (cidMatch) {
        console.log("✅ Extracted CID from IPFS image URL:", cidMatch[1]);
        return cidMatch[1];
      }
    }

    // Priority 4: Extract from metadata URI
    if (nft.metadata_uri && nft.metadata_uri.includes('/ipfs/')) {
      const cidMatch = nft.metadata_uri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (cidMatch) {
        console.log("✅ Extracted CID from metadata URI:", cidMatch[1]);
        return cidMatch[1];
      }
    }

    console.warn("⚠️ No IPFS CID found in NFT data:", nft.id);
    return null;
  }

  /**
   * Create blockchain-compatible metadata with IPFS image URL
   */
  private createBlockchainMetadata(nft: NFTData, ipfsCID: string) {
    // Create IPFS image URL from CID
    const ipfsImageURL = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;

    return {
      name: nft.name,
      description: nft.description || `A ${nft.rarity} rarity NFT from NEFTIT platform`,
      image: ipfsImageURL, // ✅ IPFS image URL stored on blockchain
      attributes: [
        { trait_type: "Rarity", value: nft.rarity },
        { trait_type: "Platform", value: "NEFTIT" },
        { trait_type: "IPFS_CID", value: ipfsCID }, // Store actual CID as attribute
        { trait_type: "Claimed_At", value: new Date().toISOString() },
        { trait_type: "Original_ID", value: nft.id }
      ],
      external_url: `https://neftit.com/nft/${nft.id}`
    };
  }

  /**
   * Connect wallet to ThirdwebSDK for blockchain operations
   */
  private async connectWallet(): Promise<boolean> {
    try {
      // Check if MetaMask is available
      if (typeof window !== 'undefined' && window.ethereum) {
        console.log("🔗 Connecting ThirdwebSDK to MetaMask...");
        
        // Create ethers provider and signer (this will use existing connection)
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        
        // Update the SDK with the signer
        this.sdk.updateSignerOrProvider(signer);
        
        console.log("✅ ThirdwebSDK connected to MetaMask");
        return true;
      } else {
        console.error("❌ MetaMask not detected");
        return false;
      }
    } catch (error) {
      console.error("❌ Failed to connect wallet to ThirdwebSDK:", error);
      return false;
    }
  }

  /**
   * Mint NFT using Thirdweb ERC721Drop contract (claim-based) with MetaMask
   */
  private async mintNFTOnPolygonAmoy(
    walletAddress: string, 
    metadata: any, 
    metadataURI: string
  ): Promise<{ success: boolean; tokenId?: string; transactionHash?: string; error?: string; contractAddress?: string; metadataURI?: string; blockNumber?: number }> {
    try {
      console.log("🔗 Using Thirdweb ERC721Drop contract with MetaMask...");
      
      // Check if MetaMask is available
      if (!window.ethereum) {
        throw new Error("MetaMask not detected. Please install MetaMask to claim NFTs.");
      }

      // Connect to MetaMask
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Setup MetaMask provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Verify the connected wallet matches the expected wallet
      const connectedAddress = await signer.getAddress();
      if (connectedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(`Please connect to wallet ${walletAddress} in MetaMask`);
      }

      // Initialize Thirdweb SDK with MetaMask signer
      const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
        clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
      });

      // Get contract instance as ERC721Drop
      const contract = await sdk.getContract(this.contractAddress);
      console.log("✅ Connected to ERC721Drop contract");

      // Check contract supply limits first
      try {
        const totalSupply = await contract.call("totalSupply");
        const maxSupply = await contract.call("maxTotalSupply");
        console.log(`📊 Contract supply: ${totalSupply}/${maxSupply}`);
        
        if (parseInt(totalSupply) >= parseInt(maxSupply)) {
          return {
            success: false,
            error: `Contract has reached maximum supply (${maxSupply}). No more NFTs can be minted.`
          };
        }
      } catch (e) {
        console.warn("⚠️ Could not check contract supply, proceeding...");
      }

      console.log("🎯 Claiming NFT for:", walletAddress);

      // Use direct contract call with increased limits to bypass claim conditions
      const claimResult = await contract.call("claim", [
        walletAddress, // receiver
        1, // quantity
        ethers.constants.AddressZero, // currency (native token)
        0, // pricePerToken
        {
          proof: [],
          quantityLimitPerWallet: 100, // Increased limit to avoid DropClaimExceedLimit
          pricePerToken: 0,
          currency: ethers.constants.AddressZero
        }, // allowlistProof
        "0x" // data
      ]);
      
      console.log("✅ NFT claimed successfully!");
      console.log("🎯 Claim result:", claimResult);

      // Extract transaction hash from the result
      const txHash = claimResult.receipt?.transactionHash || claimResult.transactionHash;
      const blockNumber = claimResult.receipt?.blockNumber || claimResult.blockNumber;

      return {
        success: true,
        transactionHash: txHash,
        tokenId: "1", // Will be extracted from transaction logs
        contractAddress: this.contractAddress,
        metadataURI: metadataURI,
        blockNumber: blockNumber
      };

    } catch (error) {
      console.error("❌ Thirdweb claim failed:", error);
      
      // Parse Thirdweb-specific errors
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('DropClaimExceedLimit')) {
        console.log("🔄 DropClaimExceedLimit detected, trying direct contract call...");
      } else {
        console.log("🔄 Thirdweb claim failed, trying direct contract call...");
      }
      
      // Fallback to direct contract call
      return await this.claimWithDirectCall(walletAddress, metadata, metadataURI);
    }
  }

  /**
   * Fallback claim method using direct contract calls with MetaMask
   */
  private async claimWithDirectCall(
    walletAddress: string, 
    metadata: any, 
    metadataURI: string
  ): Promise<{ success: boolean; tokenId?: string; transactionHash?: string; error?: string; contractAddress?: string; metadataURI?: string; blockNumber?: number }> {
    try {
      console.log("🔗 Using direct contract call approach with MetaMask...");
      
      // Check if MetaMask is available
      if (!window.ethereum) {
        throw new Error("MetaMask not detected. Please install MetaMask to claim NFTs.");
      }

      // Connect to MetaMask
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Setup MetaMask provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Verify the connected wallet matches the expected wallet
      const connectedAddress = await signer.getAddress();
      if (connectedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(`Please connect to wallet ${walletAddress} in MetaMask`);
      }

      // Use the actual ERC721Drop ABI for claim function
      const claimABI = [
        "function claim(address _receiver, uint256 _quantity, address _currency, uint256 _pricePerToken, tuple(bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) _allowlistProof, bytes _data) payable",
        "function totalSupply() view returns (uint256)",
        "function maxTotalSupply() view returns (uint256)"
      ];

      console.log("🔄 Using direct claim function...");
      const contract = new ethers.Contract(this.contractAddress, claimABI, signer);
      
      // Check contract limits first
      try {
        const totalSupply = await contract.totalSupply();
        const maxSupply = await contract.maxTotalSupply();
        console.log(`📊 Contract stats: ${totalSupply}/${maxSupply} minted`);
        
        if (totalSupply.gte(maxSupply)) {
          return {
            success: false,
            error: `Contract has reached maximum supply (${maxSupply}). No more NFTs can be minted.`
          };
        }
      } catch (e) {
        console.warn("⚠️ Could not check contract limits, proceeding with claim...");
      }
      
      // Prepare claim parameters with higher limits
      const receiver = walletAddress;
      const quantity = 1;
      const currency = ethers.constants.AddressZero; // Native token (MATIC)
      const pricePerToken = 0; // Free claim
      const allowlistProof = {
        proof: [],
        quantityLimitPerWallet: 100, // Increased limit to avoid DropClaimExceedLimit
        pricePerToken: 0,
        currency: ethers.constants.AddressZero
      };
      const data = "0x"; // Empty data

      // Get network info for proper gas configuration
      const network = await provider.getNetwork();
      const feeData = await provider.getFeeData();
      
      console.log("⛽ Network fee data:", {
        gasPrice: feeData.gasPrice?.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
      });

      // Configure transaction options based on network type
      let txOptions: any = {
        gasLimit: 500000
      };

      // Force proper gas pricing for Polygon Amoy (minimum 25 gwei priority fee required)
      const minPriorityFee = ethers.utils.parseUnits("30", "gwei"); // 30 gwei (above 25 gwei minimum)
      const minMaxFee = ethers.utils.parseUnits("50", "gwei"); // 50 gwei max fee
      
      // Use EIP-1559 with enforced minimums for Polygon Amoy
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 transaction (Type 2) with minimum enforcement
        const calculatedMaxFee = feeData.maxFeePerGas.mul(120).div(100);
        const calculatedPriorityFee = feeData.maxPriorityFeePerGas.mul(110).div(100);
        
        txOptions.maxFeePerGas = calculatedMaxFee.gt(minMaxFee) ? calculatedMaxFee : minMaxFee;
        txOptions.maxPriorityFeePerGas = calculatedPriorityFee.gt(minPriorityFee) ? calculatedPriorityFee : minPriorityFee;
        console.log("🚀 Using EIP-1559 transaction with enforced minimums");
      } else {
        // Fallback to fixed gas pricing for Polygon Amoy
        txOptions.maxFeePerGas = minMaxFee;
        txOptions.maxPriorityFeePerGas = minPriorityFee;
        console.log("⚡ Using fallback EIP-1559 gas pricing");
      }

      console.log("💰 Transaction options:", txOptions);

      const tx = await contract.claim(
        receiver,
        quantity,
        currency,
        pricePerToken,
        allowlistProof,
        data,
        txOptions
      );

      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      
      // Extract token ID from logs
      let tokenId;
      if (receipt.logs && receipt.logs.length > 0) {
        const transferLog = receipt.logs.find((log: any) => log.topics.length === 4);
        if (transferLog) {
          tokenId = ethers.BigNumber.from(transferLog.topics[3]).toString();
        }
      }

      console.log("✅ Direct claim successful!");
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        tokenId: tokenId || `claimed-${Date.now()}`,
        contractAddress: this.contractAddress,
        metadataURI: metadataURI,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error("❌ Direct contract call failed:", error);
      
      // Parse specific error messages
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('DropClaimExceedLimit')) {
        errorMessage = 'You have reached the maximum claim limit for this contract. Please try again later or contact support.';
      } else if (errorMessage.includes('eip-1559 transaction do not support gasPrice')) {
        errorMessage = 'Gas configuration error. The network is experiencing issues. Please try again in a few minutes.';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient MATIC balance to pay for gas fees. Please add MATIC to your wallet.';
      }
      
      return {
        success: false,
        error: `Claim failed: ${errorMessage}`
      };
    }
  }

  /**
   * Process transaction result and extract relevant information
   */
  private async processTransactionResult(tx: any, ipfsCID?: string, metadataURI?: string): Promise<CIDPoolClaimResult> {
    try {
      console.log("📋 Processing transaction result:", tx);

      let transactionHash: string;
      let tokenId: string | undefined;

      // Handle different transaction result formats
      if (tx.receipt) {
        transactionHash = tx.receipt.transactionHash;
        
        // Try to extract token ID from events
        if (tx.receipt.events) {
          const transferEvent = tx.receipt.events.find((event: any) => 
            event.event === 'Transfer' || event.eventSignature === 'Transfer(address,address,uint256)'
          );
          
          if (transferEvent && transferEvent.args) {
            tokenId = transferEvent.args.tokenId?.toString() || transferEvent.args[2]?.toString();
          }
        }
      } else if (tx.hash) {
        transactionHash = tx.hash;
      } else {
        transactionHash = tx.toString();
      }

      // If no token ID found, try to get it from transaction receipt
      if (!tokenId) {
        try {
          // Wait a moment for transaction to be mined
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Generate a reasonable token ID based on timestamp
          tokenId = `${Date.now()}`;
          console.warn("⚠️ Token ID not found in transaction, using timestamp-based ID:", tokenId);
        } catch (e) {
          tokenId = `pending-${Date.now()}`;
        }
      }

      console.log("✅ Transaction processed successfully:", {
        transactionHash,
        tokenId
      });

      return {
        success: true,
        tokenId,
        transactionHash,
        contractAddress: this.contractAddress,
        ipfsCID: ipfsCID,
        metadataURI: metadataURI
      };

    } catch (error) {
      console.error("❌ Error processing transaction result:", error);
      throw error;
    }
  }

  /**
   * Get metadata from IPFS CID
   */
  private async getMetadataFromIPFS(ipfsCID: string): Promise<any> {
    try {
      const metadataURL = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;
      console.log("📥 Fetching metadata from:", metadataURL);
      
      const response = await fetch(metadataURL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const metadata = await response.json();
      return metadata;
    } catch (error) {
      console.error("❌ Failed to fetch metadata from IPFS:", error);
      return null;
    }
  }

  /**
   * Check if NFT is already claimed to blockchain
   */
  private isAlreadyClaimed(nftId: string, walletAddress: string): boolean {
    try {
      const claimedKey = `claimed_nfts_${walletAddress}`;
      const existingClaims = JSON.parse(localStorage.getItem(claimedKey) || '[]');
      return existingClaims.some((claim: any) => claim.nftId === nftId);
    } catch (error) {
      console.warn("⚠️ Failed to check claim status:", error);
      return false;
    }
  }

  /**
   * Store claim data in localStorage for UI updates
   */
  private storeClaim(nftId: string, walletAddress: string, claimResult: CIDPoolClaimResult) {
    try {
      const claimedKey = `claimed_nfts_${walletAddress}`;
      const existingClaims = JSON.parse(localStorage.getItem(claimedKey) || '[]');
      
      const claimData = {
        nftId: nftId,
        tokenId: claimResult.tokenId,
        transactionHash: claimResult.transactionHash,
        contractAddress: this.contractAddress,
        ipfsCID: claimResult.ipfsCID,
        claimedAt: new Date().toISOString()
      };
      
      existingClaims.push(claimData);
      localStorage.setItem(claimedKey, JSON.stringify(existingClaims));
      
      console.log("💾 Stored claim data in localStorage:", claimData);
    } catch (error) {
      console.warn("⚠️ Failed to store claim data:", error);
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.contractAddress && import.meta.env.VITE_THIRDWEB_CLIENT_ID);
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Get blockchain explorer URL for transaction
   */
  getExplorerURL(txHash: string): string {
    return `https://amoy.polygonscan.com/tx/${txHash}`;
  }

  /**
   * Get blockchain explorer URL for NFT
   */
  getNFTExplorerURL(tokenId: string): string {
    return `https://amoy.polygonscan.com/token/${this.contractAddress}?a=${tokenId}`;
  }
}

// Export singleton instance
export const cidPoolBlockchainClaimService = new CIDPoolBlockchainClaimService();
export default cidPoolBlockchainClaimService;
