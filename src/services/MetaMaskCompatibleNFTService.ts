import { ethers } from 'ethers';
import { supabase } from '../lib/supabase';

/**
 * MetaMask-Compatible NFT Minting Service
 * Ensures NFT metadata is properly formatted for MetaMask display
 */
export class MetaMaskCompatibleNFTService {
  private rpcEndpoints: string[];
  private contractABI: any[];
  private contractAddress: string;
  private ipfsGateways: string[];

  constructor() {
    this.contractAddress = "0x5Bb23220cC12585264fCd144C448eF222c8572A2";
    
    this.rpcEndpoints = [
      'https://polygon-amoy.g.alchemy.com/v2/demo',
      'https://rpc-amoy.polygon.technology/',
      'https://polygon-amoy.drpc.org',
      'https://polygon-amoy-bor-rpc.publicnode.com',
      'https://rpc.ankr.com/polygon_amoy'
    ];

    // Multiple IPFS gateways for better MetaMask compatibility
    this.ipfsGateways = [
      'https://gateway.pinata.cloud/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/',
      'https://nftstorage.link/ipfs/'
    ];

    // NFT Collection ABI with tokenURI function
    this.contractABI = [
      {
        "inputs": [
          {"internalType": "address", "name": "_to", "type": "address"},
          {"internalType": "string", "name": "_uri", "type": "string"}
        ],
        "name": "mintTo",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "uint256", "name": "_tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "nextTokenIdToMint",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ];
  }

  /**
   * Create MetaMask-compatible metadata with multiple gateway fallbacks
   */
  private async createMetaMaskCompatibleMetadata(nftData: any, imageCID: string): Promise<any> {
    console.log("🎨 Creating MetaMask-compatible metadata...");
    
    // Test which IPFS gateway works best
    const workingImageURL = await this.findWorkingImageURL(imageCID);
    
    const metadata = {
      name: nftData.name || `NEFTIT ${nftData.rarity} NFT #${nftData.nft_id}`,
      description: nftData.description || `A unique ${nftData.rarity} rarity NFT from the NEFTIT platform. This NFT represents digital ownership and can be used within the NEFTIT ecosystem.`,
      image: workingImageURL,
      external_url: `${window.location.origin}/nft/${nftData.nft_id}`,
      attributes: [
        {
          trait_type: "Rarity",
          value: nftData.rarity
        },
        {
          trait_type: "Platform",
          value: "NEFTIT"
        },
        {
          trait_type: "Collection",
          value: "NEFTIT Genesis"
        },
        {
          trait_type: "IPFS CID",
          value: imageCID
        },
        {
          trait_type: "Minted Date",
          value: new Date().toISOString().split('T')[0]
        }
      ],
      // Additional MetaMask-specific fields
      animation_url: null,
      youtube_url: null,
      background_color: null,
      // OpenSea compatibility
      opensea: {
        name: nftData.name || `NEFTIT ${nftData.rarity} NFT`,
        description: nftData.description || `A ${nftData.rarity} rarity NFT from NEFTIT`,
        image: workingImageURL,
        external_link: `${window.location.origin}/nft/${nftData.nft_id}`
      }
    };

    console.log("✅ MetaMask-compatible metadata created:", metadata);
    return metadata;
  }

  /**
   * Test multiple IPFS gateways to find the most accessible one for MetaMask
   */
  private async findWorkingImageURL(imageCID: string): Promise<string> {
    console.log("🔍 Testing IPFS gateways for MetaMask compatibility...");
    
    for (const gateway of this.ipfsGateways) {
      try {
        const imageURL = `${gateway}${imageCID}`;
        const response = await fetch(imageURL, { method: 'HEAD' });
        
        if (response.ok) {
          console.log(`✅ Working gateway found: ${gateway}`);
          return imageURL;
        }
      } catch (error) {
        console.log(`❌ Gateway failed: ${gateway}`);
        continue;
      }
    }
    
    // Fallback to first gateway if none work
    const fallbackURL = `${this.ipfsGateways[0]}${imageCID}`;
    console.log(`⚠️ No working gateway found, using fallback: ${fallbackURL}`);
    return fallbackURL;
  }

  private async findWorkingMetadataURL(metadataCID: string): Promise<string> {
    console.log(`🔍 Testing IPFS gateways for existing metadata: ${metadataCID}`);
    
    for (const gateway of this.ipfsGateways) {
      try {
        const metadataURL = `${gateway}${metadataCID}`;
        const response = await fetch(metadataURL, { method: 'HEAD' });
        
        if (response.ok) {
          console.log(`✅ Working metadata gateway found: ${gateway}`);
          return metadataURL;
        }
      } catch (error) {
        console.log(`❌ Metadata gateway failed: ${gateway}`);
        continue;
      }
    }
    
    // Fallback to Pinata gateway (most reliable for your data)
    const fallbackURL = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;
    console.log(`⚠️ No working gateway found for metadata, using Pinata fallback: ${fallbackURL}`);
    return fallbackURL;
  }

  /**
   * Upload MetaMask-compatible metadata to IPFS using Pinata
   */
  private async uploadMetadataToIPFS(metadata: any): Promise<string> {
    console.log("📤 Uploading MetaMask-compatible metadata to Pinata IPFS...");
    
    try {
      // Use Pinata for metadata upload
      const pinataApiKey = import.meta.env.VITE_PINATA_API_KEY;
      const pinataSecretKey = import.meta.env.VITE_PINATA_SECRET_API_KEY;
      
      if (!pinataApiKey || !pinataSecretKey) {
        throw new Error("Pinata API keys not configured");
      }

      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': pinataApiKey,
          'pinata_secret_api_key': pinataSecretKey,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: `NEFTIT-MetaMask-Metadata-${Date.now()}`,
            keyvalues: {
              platform: "NEFTIT",
              type: "metadata",
              metamask_compatible: "true"
            }
          },
          pinataOptions: {
            cidVersion: 1
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Pinata upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      const metadataCID = result.IpfsHash;
      
      console.log("✅ Metadata uploaded to Pinata IPFS:", metadataCID);
      return metadataCID;
      
    } catch (error) {
      console.error("❌ Failed to upload metadata to Pinata IPFS:", error);
      throw error;
    }
  }

  /**
   * Mint NFT with MetaMask-compatible metadata
   */
  async mintMetaMaskCompatibleNFT(nftId: string, walletAddress: string): Promise<any> {
    console.log(`🎯 Starting MetaMask-compatible NFT mint for NFT ${nftId}`);

    try {
      // Get NFT data from database
      const { data: nftData, error } = await supabase
        .from('nft_cid_distribution_log')
        .select(`
          nft_id,
          rarity,
          cid,
          distributed_at,
          nft_cid_pools!inner(
            image_url,
            metadata_cid
          )
        `)
        .eq('nft_id', nftId)
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (error || !nftData) {
        throw new Error(`NFT not found: ${error?.message}`);
      }

      // Extract image CID from image_url
      const cidPoolData = Array.isArray(nftData.nft_cid_pools) ? nftData.nft_cid_pools[0] : nftData.nft_cid_pools;
      
      // Extract CID from image_url (e.g., "https://gateway.pinata.cloud/ipfs/QmccGgVGC8HPGrwkeK52tyDGEdPYzWPdg18i7ykoH4ZHVa")
      let imageCID = nftData.cid; // fallback to main CID
      
      if (cidPoolData?.image_url) {
        const urlParts = cidPoolData.image_url.split('/ipfs/');
        if (urlParts.length > 1) {
          imageCID = urlParts[1]; // Extract CID from URL
        }
      }
      
      if (!imageCID) {
        throw new Error('No image CID found for NFT');
      }

      // Use existing metadata CID from database with gateway testing
      let metadataURI = "";
      let metadataCID = "";
      
      if (cidPoolData?.metadata_cid) {
        metadataCID = cidPoolData.metadata_cid;
      } else if (nftData.cid) {
        metadataCID = nftData.cid;
      } else {
        throw new Error('No metadata CID found for NFT');
      }

      // Test gateways to find working one for existing metadata
      metadataURI = await this.findWorkingMetadataURL(metadataCID);

      console.log(`📋 MetaMask-compatible metadata URI: ${metadataURI}`);

      // Try minting with each RPC endpoint
      for (const rpcUrl of this.rpcEndpoints) {
        try {
          const result = await this.attemptMintWithRPC(rpcUrl, walletAddress, metadataURI);
          if (result.success) {
            console.log(`✅ MetaMask-compatible NFT mint successful with RPC: ${rpcUrl}`);
            
            // Update database
            await this.updateNFTClaimStatus(nftId, walletAddress, result.tokenId, result.transactionHash, metadataURI);
            
            // Verify MetaMask compatibility
            await this.verifyMetaMaskCompatibility(result.tokenId, metadataURI);
            
            return result;
          }
        } catch (error: any) {
          console.log(`❌ RPC ${rpcUrl} failed:`, error.message);
          continue;
        }
      }

      throw new Error("All RPC endpoints failed for MetaMask-compatible NFT minting");

    } catch (error: any) {
      console.error("❌ MetaMask-compatible NFT mint failed:", error);
      throw error;
    }
  }

  /**
   * Verify that the minted NFT will display properly in MetaMask
   */
  private async verifyMetaMaskCompatibility(tokenId: string, metadataURI: string): Promise<void> {
    console.log("🔍 Verifying MetaMask compatibility...");
    
    try {
      // Test metadata accessibility
      const metadataResponse = await fetch(metadataURI);
      if (!metadataResponse.ok) {
        console.warn("⚠️ Metadata URI not accessible:", metadataURI);
        return;
      }
      
      const metadata = await metadataResponse.json();
      
      // Check required fields for MetaMask
      const requiredFields = ['name', 'description', 'image'];
      const missingFields = requiredFields.filter(field => !metadata[field]);
      
      if (missingFields.length > 0) {
        console.warn("⚠️ Missing required metadata fields for MetaMask:", missingFields);
      }
      
      // Test image accessibility
      if (metadata.image) {
        try {
          const imageResponse = await fetch(metadata.image, { method: 'HEAD' });
          if (imageResponse.ok) {
            console.log("✅ NFT image is accessible for MetaMask");
          } else {
            console.warn("⚠️ NFT image may not be accessible in MetaMask");
          }
        } catch (error) {
          console.warn("⚠️ Could not verify image accessibility:", error);
        }
      }
      
      console.log("✅ MetaMask compatibility verification completed");
      
    } catch (error) {
      console.warn("⚠️ Could not verify MetaMask compatibility:", error);
    }
  }

  private async attemptMintWithRPC(rpcUrl: string, walletAddress: string, metadataURI: string): Promise<any> {
    console.log(`🔗 Attempting MetaMask-compatible mint with RPC: ${rpcUrl}`);
    
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = web3Provider.getSigner();
    
    // Ensure correct network
    const network = await provider.getNetwork();
    if (network.chainId !== 80002) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }],
      });
    }

    const contract = new ethers.Contract(this.contractAddress, this.contractABI, provider);
    const contractWithSigner = contract.connect(signer);

    // Get gas price with buffer
    const gasPrice = await provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(120).div(100);

    try {
      const nextTokenId = await contract.nextTokenIdToMint();
      console.log(`🔢 Next token ID to mint: ${nextTokenId.toString()}`);

      const gasEstimate = await contractWithSigner.estimateGas.mintTo(walletAddress, metadataURI);
      console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);

      console.log(`🔨 Minting MetaMask-compatible NFT to ${walletAddress}`);
      
      const mintTx = await contractWithSigner.mintTo(walletAddress, metadataURI, {
        gasLimit: gasEstimate.mul(120).div(100),
        gasPrice: adjustedGasPrice
      });

      console.log(`⏳ Mint transaction sent: ${mintTx.hash}`);
      const receipt = await mintTx.wait();
      console.log(`✅ Mint transaction confirmed in block: ${receipt.blockNumber}`);

      const tokenId = this.extractTokenIdFromReceipt(receipt);
      console.log(`🎯 Minted token ID: ${tokenId}`);

      // Verify token URI on-chain
      if (tokenId) {
        try {
          const tokenURI = await contract.tokenURI(tokenId);
          console.log(`🔍 On-chain token URI: ${tokenURI}`);
          
          if (tokenURI === metadataURI) {
            console.log(`✅ Token URI matches expected metadata URI`);
          } else {
            console.log(`⚠️ Token URI mismatch - Expected: ${metadataURI}, Got: ${tokenURI}`);
          }
        } catch (uriError) {
          console.log(`⚠️ Could not verify token URI:`, uriError);
        }
      }

      return {
        success: true,
        transactionHash: mintTx.hash,
        tokenId: tokenId,
        receipt: receipt,
        metadataURI: metadataURI
      };

    } catch (error: any) {
      console.error(`❌ MetaMask-compatible mint failed with RPC ${rpcUrl}:`, error);
      throw error;
    }
  }

  private extractTokenIdFromReceipt(receipt: any): string | null {
    try {
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
          
          if (log.topics && log.topics[0] === transferTopic && log.topics.length >= 4) {
            const fromAddress = log.topics[1];
            if (fromAddress === "0x0000000000000000000000000000000000000000000000000000000000000000") {
              const tokenIdHex = log.topics[3];
              const tokenId = ethers.BigNumber.from(tokenIdHex).toString();
              console.log("🎯 Extracted token ID from Transfer event:", tokenId);
              return tokenId;
            }
          }
        }
      }

      const transferEvent = receipt.events?.find((event: any) => 
        event.event === 'Transfer' && 
        event.args?.from === ethers.constants.AddressZero
      );
      
      if (transferEvent && transferEvent.args?.tokenId) {
        return transferEvent.args.tokenId.toString();
      }
      
      console.log("⚠️ Could not extract token ID from receipt");
      return null;
    } catch (error) {
      console.log("❌ Error extracting token ID from receipt:", error);
      return null;
    }
  }

  private async updateNFTClaimStatus(
    nftId: string, 
    walletAddress: string, 
    tokenId: string | null, 
    transactionHash: string,
    metadataURI: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('nft_claims')
        .insert({
          nft_id: nftId,
          wallet_address: walletAddress.toLowerCase(),
          token_id: tokenId,
          transaction_hash: transactionHash,
          claimed_at: new Date().toISOString(),
          contract_address: this.contractAddress,
          claimed_blockchain: 'polygon',
          metadata_uri: metadataURI,
          metamask_compatible: true // Flag for MetaMask compatibility
        });

      if (error) {
        console.error('Failed to update claim status:', error);
      } else {
        console.log(`✅ MetaMask-compatible NFT claim status updated in database`);
      }
    } catch (error) {
      console.error('Database update error:', error);
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.contractAddress && 
      import.meta.env.VITE_PINATA_API_KEY &&
      import.meta.env.VITE_PINATA_SECRET_API_KEY
    );
  }

  /**
   * Get MetaMask-specific troubleshooting info
   */
  getMetaMaskTroubleshootingInfo(): any {
    return {
      contractAddress: this.contractAddress,
      supportedGateways: this.ipfsGateways,
      requirements: [
        "HTTPS image URLs",
        "Accessible IPFS gateways", 
        "ERC-721 compliant metadata",
        "Proper CORS headers"
      ],
      commonIssues: [
        "IPFS gateway accessibility",
        "Metadata structure compliance",
        "Image URL format",
        "Network connectivity"
      ]
    };
  }
}

// Export singleton instance
export const metaMaskCompatibleNFTService = new MetaMaskCompatibleNFTService();
export default metaMaskCompatibleNFTService;
