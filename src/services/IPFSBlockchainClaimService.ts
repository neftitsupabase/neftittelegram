import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { ethers } from "ethers";
import { enhancedIPFSBurnService } from './EnhancedIPFSBurnService';
import { hybridIPFSService, NFTData, IPFSMetadata } from './HybridIPFSService';
import { supabaseIPFSMapping } from './SupabaseIPFSMapping';
import { toast } from 'react-hot-toast';

export interface BlockchainClaimResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  ipfsCID?: string;
  metadataURI?: string;
  error?: string;
}

/**
 * Service for claiming NFTs from IPFS storage to blockchain with proper CID storage
 * Handles the complete flow: IPFS CID extraction → Metadata creation → Blockchain minting
 */
export class IPFSBlockchainClaimService {
  private contractAddress: string;
  private sdk: ThirdwebSDK;

  constructor() {
    this.contractAddress = import.meta.env.VITE_THIRDWEB_NFT_DROP_ADDRESS || "0x8252451036797413e75338E70d294e9ed753AE64";
    this.sdk = new ThirdwebSDK(PolygonAmoyTestnet, {
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
    });
  }

  /**
   * Main entry point: Claim NFT from IPFS to blockchain with proper CID storage
   */
  async claimNFTFromIPFS(nft: NFTData, walletAddress: string): Promise<BlockchainClaimResult> {
    try {
      console.log("🚀 Starting IPFS to blockchain claim for:", nft.name);
      console.log("📍 Wallet:", walletAddress);
      console.log("📦 NFT Data:", nft);

      // Step 1: Extract or upload IPFS CID for the NFT image
      let ipfsCID = await this.extractNFTImageCID(nft, walletAddress)
      
      if (!ipfsCID) {
        return {
          success: false,
          error: `No IPFS CID found for NFT ${nft.name}. NFT needs to be properly uploaded to IPFS first.`
        };
      }

      console.log("✅ Found IPFS CID:", ipfsCID);

      // Step 2: Create proper blockchain metadata with IPFS image URL
      const blockchainMetadata = await this.createBlockchainMetadata(nft, ipfsCID);
      console.log("✅ Created blockchain metadata:", blockchainMetadata);

      // Step 3: Upload metadata to IPFS for blockchain reference
      const metadataResult = await hybridIPFSService.uploadNFTMetadata(
        blockchainMetadata, 
        `blockchain-${nft.id}`
      );
      console.log("✅ Uploaded metadata to IPFS:", metadataResult);

      // Step 4: Connect to wallet and mint NFT on blockchain
      const claimResult = await this.mintNFTOnBlockchain(
        walletAddress, 
        metadataResult.image_url, // Use IPFS metadata URL
        blockchainMetadata
      );

      if (claimResult.success) {
        console.log("✅ Successfully claimed NFT to blockchain:", {
          tokenId: claimResult.tokenId,
          txHash: claimResult.transactionHash,
          ipfsCID: ipfsCID,
          metadataURI: metadataResult.image_url
        });

        return {
          success: true,
          tokenId: claimResult.tokenId,
          transactionHash: claimResult.transactionHash,
          ipfsCID: ipfsCID,
          metadataURI: metadataResult.image_url
        };
      } else {
        return claimResult;
      }

    } catch (error) {
      console.error("❌ Error claiming NFT from IPFS to blockchain:", error);
      return {
        success: false,
        error: `Failed to claim NFT: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract IPFS CID for NFT image from various sources
   */
  private async extractNFTImageCID(nft: NFTData, walletAddress: string): Promise<string | null> {
    console.log("🔍 Extracting IPFS CID for NFT:", nft.id);

    // Priority 1: Direct IPFS hash in NFT data
    if (nft.ipfs_hash) {
      console.log("✅ Found direct IPFS hash:", nft.ipfs_hash);
      return nft.ipfs_hash;
    }

    // Priority 2: Pinata hash in NFT data
    if (nft.pinata_hash) {
      console.log("✅ Found Pinata hash:", nft.pinata_hash);
      return nft.pinata_hash;
    }

    // Priority 3: Extract from image URL if it's already an IPFS URL
    if (nft.image && (nft.image.includes('/ipfs/') || nft.image.includes('ipfs.io') || nft.image.includes('gateway.pinata.cloud'))) {
      const cidMatch = nft.image.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (cidMatch) {
        console.log("✅ Extracted CID from IPFS image URL:", cidMatch[1]);
        return cidMatch[1];
      }
    }

    // Priority 4: Get from user's IPFS collection
    try {
      const userCollectionCID = await supabaseIPFSMapping.getIPFSHash(walletAddress);
      if (userCollectionCID) {
        console.log("✅ Found user collection CID:", userCollectionCID);
        // Load user collection. It might be an index (paginated) or direct data
        const userData = await hybridIPFSService.getContentFromIPFS(userCollectionCID);

        // Case A: Direct structure with nfts[]
        if (userData && Array.isArray(userData.nfts)) {
          const foundNFT = (userData.nfts as NFTData[]).find((n: NFTData) => n.id === nft.id);
          if (foundNFT) {
            // Prefer explicit hashes, else attempt from image URL
            if (foundNFT.ipfs_hash || foundNFT.pinata_hash) {
              const cid = foundNFT.ipfs_hash || foundNFT.pinata_hash;
              console.log("✅ Found NFT CID in direct user data:", cid);
              return cid as string;
            }
            if (foundNFT.image && foundNFT.image.includes('/ipfs/')) {
              const m = foundNFT.image.match(/\/ipfs\/([a-zA-Z0-9]+)/);
              if (m) {
                console.log("✅ Extracted CID from found NFT image URL:", m[1]);
                return m[1];
              }
            }
          }
        }

        // Case B: Index format with pages[]
        if (userData && Array.isArray(userData.pages)) {
          console.log("📄 User data is an index with", userData.pages.length, "pages — searching for NFT in pages");
          for (const pageHash of userData.pages as string[]) {
            try {
              const page = await hybridIPFSService.getContentFromIPFS(pageHash);
              if (page && Array.isArray(page.nfts)) {
                const foundOnPage = (page.nfts as NFTData[]).find((n: NFTData) => n.id === nft.id);
                if (foundOnPage) {
                  if (foundOnPage.ipfs_hash || foundOnPage.pinata_hash) {
                    const cid = foundOnPage.ipfs_hash || foundOnPage.pinata_hash;
                    console.log("✅ Found NFT CID in paginated page:", cid);
                    return cid as string;
                  }
                  if (foundOnPage.image && foundOnPage.image.includes('/ipfs/')) {
                    const m = foundOnPage.image.match(/\/ipfs\/([a-zA-Z0-9]+)/);
                    if (m) {
                      console.log("✅ Extracted CID from paginated page image URL:", m[1]);
                      return m[1];
                    }
                  }
                }
              }
            } catch (pageErr) {
              console.warn("⚠️ Failed to load or parse page", pageHash, pageErr);
            }
          }
          console.warn("⚠️ NFT not found in any paginated pages for id:", nft.id);
        }
      }
    } catch (error) {
      console.warn("⚠️ Failed to get CID from user collection:", error);
    }

    // Priority 5: For local images, upload to IPFS first
    if (nft.image && nft.image.startsWith('/images/')) {
      console.log("⚠️ NFT has local image path, needs IPFS upload:", nft.image);
      return null; // Caller should handle this case
    }

    console.warn("⚠️ No IPFS CID found for NFT:", nft.id);
    return null;
  }

  /**
   * Create blockchain-compatible metadata with IPFS image URL
   */
  private async createBlockchainMetadata(nft: NFTData, ipfsCID: string): Promise<IPFSMetadata> {
    // Create IPFS image URL from CID
    const ipfsImageURL = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;

    return {
      name: nft.name,
      description: nft.description || `A ${nft.rarity} rarity NFT from NEFTIT platform`,
      image: ipfsImageURL, // ✅ This is the key - IPFS image URL stored on blockchain
      attributes: nft.attributes || [
        { trait_type: "Rarity", value: nft.rarity },
        { trait_type: "Tier", value: nft.tier?.toString() || "1" },
        { trait_type: "Platform", value: "NEFTIT" },
        { trait_type: "IPFS_CID", value: ipfsCID }, // Store CID as attribute
        { trait_type: "Claimed_At", value: new Date().toISOString() }
      ],
      external_url: `https://neftit.com/nft/${nft.id}`
    };
  }

  /**
   * Mint NFT on blockchain with IPFS metadata
   */
  private async mintNFTOnBlockchain(
    walletAddress: string, 
    metadataURI: string,
    metadata: IPFSMetadata
  ): Promise<BlockchainClaimResult> {
    try {
      console.log("⛓️ Connecting to blockchain contract:", this.contractAddress);

      // Connect to the contract
      const contract = await this.sdk.getContract(this.contractAddress);
      console.log("✅ Connected to contract");

      // Try different claim methods with proper metadata
      const claimMethods = [
        () => this.claimWithMetadata(contract, walletAddress, metadataURI),
        () => this.claimWithDirectMint(contract, walletAddress, metadata),
        () => this.claimWithBasicCall(contract, walletAddress, metadataURI)
      ];

      for (let i = 0; i < claimMethods.length; i++) {
        try {
          console.log(`🔄 Trying claim method ${i + 1}...`);
          const result = await claimMethods[i]();
          if (result.success) {
            console.log(`✅ Claim method ${i + 1} succeeded:`, result);
            return result;
          }
        } catch (error) {
          console.warn(`⚠️ Claim method ${i + 1} failed:`, error);
          if (i === claimMethods.length - 1) {
            throw error; // Throw on last attempt
          }
        }
      }

      return {
        success: false,
        error: "All claim methods failed"
      };

    } catch (error) {
      console.error("❌ Blockchain minting failed:", error);
      return {
        success: false,
        error: `Blockchain minting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Claim method 1: With metadata URI
   */
  private async claimWithMetadata(contract: any, walletAddress: string, metadataURI: string): Promise<BlockchainClaimResult> {
    const tx = await contract.call("claim", [
      walletAddress,
      1, // quantity
      "0x0000000000000000000000000000000000000000", // currency (ETH)
      "0", // price
      {
        proof: [],
        quantityLimitPerWallet: 0,
        pricePerToken: "0",
        currency: "0x0000000000000000000000000000000000000000",
      },
      metadataURI // Include metadata URI
    ], {
      gasLimit: 300000,
      gasPrice: ethers.utils.parseUnits("20", "gwei")
    });

    return this.processTransactionResult(tx, walletAddress);
  }

  /**
   * Claim method 2: Direct mint with metadata
   */
  private async claimWithDirectMint(contract: any, walletAddress: string, metadata: IPFSMetadata): Promise<BlockchainClaimResult> {
    // Try ERC721 mint if available
    if (contract.erc721) {
      const tx = await contract.erc721.mintTo(walletAddress, metadata);
      return this.processTransactionResult(tx, walletAddress);
    }

    // Fallback to direct call
    const tx = await contract.call("mintTo", [walletAddress, metadata], {
      gasLimit: 400000,
      gasPrice: ethers.utils.parseUnits("25", "gwei")
    });

    return this.processTransactionResult(tx, walletAddress);
  }

  /**
   * Claim method 3: Basic call without metadata
   */
  private async claimWithBasicCall(contract: any, walletAddress: string, metadataURI: string): Promise<BlockchainClaimResult> {
    const tx = await contract.call("claim", [
      walletAddress,
      1,
      "0x0000000000000000000000000000000000000000",
      "0",
      {
        proof: [],
        quantityLimitPerWallet: 0,
        pricePerToken: "0",
        currency: "0x0000000000000000000000000000000000000000",
      },
      "0x" // empty data
    ], {
      gasLimit: 500000,
      gasPrice: ethers.utils.parseUnits("30", "gwei")
    });

    return this.processTransactionResult(tx, walletAddress);
  }

  /**
   * Process transaction result and extract token ID
   */
  private async processTransactionResult(tx: any, walletAddress: string): Promise<BlockchainClaimResult> {
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

      // If no token ID found, generate a placeholder
      if (!tokenId) {
        tokenId = `pending-${Date.now()}`;
        console.warn("⚠️ Token ID not found in transaction, using placeholder:", tokenId);
      }

      console.log("✅ Transaction processed successfully:", {
        transactionHash,
        tokenId
      });

      return {
        success: true,
        tokenId,
        transactionHash
      };

    } catch (error) {
      console.error("❌ Error processing transaction result:", error);
      throw error;
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
}

// Export singleton instance
export const ipfsBlockchainClaimService = new IPFSBlockchainClaimService();
export default ipfsBlockchainClaimService;
