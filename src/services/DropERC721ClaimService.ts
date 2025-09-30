import { ethers } from 'ethers';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { PolygonAmoyTestnet } from '@thirdweb-dev/chains';
import { createClientWithWalletHeader } from '../lib/supabaseClientManager';
import type { NFTData } from './HybridIPFSService';

export class DropERC721ClaimService {
  private contractAddress: string;
  private clientId: string;

  constructor() {
    this.contractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || "0x483Cc80A9858cc9Bd48b246a6BC91B24ca762CE6";
    this.clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;
  }

  /**
   * Claim NFT from DropERC721 contract using proper metadata structure
   * Creates individual metadata for each NFT to ensure proper MetaMask display
   */
  async claimFromDropContract(nftData: NFTData): Promise<{
    success: boolean;
    transactionHash?: string;
    tokenId?: string;
    contractAddress?: string;
    error?: string;
  }> {
    try {
      console.log("🚀 DropERC721 Claim - Creating individual metadata");
      console.log("🖼️ Original Image:", nftData.image);

      // Check MetaMask
      if (!window.ethereum) {
        return {
          success: false,
          error: "MetaMask not detected. Please install MetaMask to continue."
        };
      }

      // Setup MetaMask and network
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await this.switchToPolygonAmoy();
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress();

      console.log("🎯 Claiming to wallet:", walletAddress);

      // Create SDK
      const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
        clientId: this.clientId,
      });

      const contract = await sdk.getContract(this.contractAddress);

      // Validate IPFS image URL
      let imageURL = nftData.image;
      if (!imageURL || !imageURL.includes('ipfs')) {
        return {
          success: false,
          error: "Invalid IPFS image URL required"
        };
      }

      // Normalize to use gateway.pinata.cloud
      const ipfsMatch = imageURL.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (ipfsMatch) {
        const cid = ipfsMatch[1];
        imageURL = `https://gateway.pinata.cloud/ipfs/${cid}`;
      }

      console.log("✅ Using IPFS image URL:", imageURL);

      // Create proper ERC721 metadata
      const metadata = {
        name: nftData.name || "NEFTIT NFT",
        description: nftData.description || `A ${nftData.rarity || 'common'} NFT from NEFTIT`,
        image: imageURL, // Direct IPFS image URL
        attributes: [
          {
            trait_type: "Rarity",
            value: nftData.rarity || "common"
          },
          {
            trait_type: "Source", 
            value: "NEFTIT CID Pool"
          },
          {
            trait_type: "IPFS CID",
            value: ipfsMatch ? ipfsMatch[1] : "unknown"
          }
        ]
      };

      console.log("🎨 Creating metadata:", metadata);

      // Upload metadata to IPFS
      const metadataJson = JSON.stringify(metadata, null, 2);
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
      
      const formData = new FormData();
      formData.append('file', metadataBlob, `${nftData.id}_metadata.json`);
      
      const pinataMetadata = JSON.stringify({
        name: `${nftData.id}_metadata.json`,
        keyvalues: {
          nft_id: nftData.id,
          type: 'nft_metadata'
        }
      });
      formData.append('pinataMetadata', pinataMetadata);
      
      console.log("📤 Uploading metadata to Pinata...");
      const uploadResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': import.meta.env.VITE_PINATA_API_KEY,
          'pinata_secret_api_key': import.meta.env.VITE_PINATA_SECRET_API_KEY
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("❌ Metadata upload failed:", errorText);
        return {
          success: false,
          error: `Failed to upload metadata: ${errorText}`
        };
      }
      
      const uploadResult = await uploadResponse.json();
      const metadataURI = `https://gateway.pinata.cloud/ipfs/${uploadResult.IpfsHash}`;
      
      console.log("✅ Metadata uploaded:", metadataURI);

      // Check eligibility
      try {
        const walletBalance = await contract.call("balanceOf", [walletAddress]);
        const activeConditionId = await contract.call("getActiveClaimConditionId");
        const claimCondition = await contract.call("getClaimConditionById", [activeConditionId]);
        const quantityLimit = claimCondition.quantityLimitPerWallet;
        
        if (walletBalance.gte(quantityLimit) && !quantityLimit.eq(0)) {
          return {
            success: false,
            error: `Claim limit exceeded! You have ${walletBalance.toString()} NFTs. Max: ${quantityLimit.toString()}`
          };
        }
      } catch (eligibilityError) {
        console.warn("⚠️ Could not check eligibility:", eligibilityError.message);
      }

      // Get next token ID to mint
      let nextTokenId;
      try {
        nextTokenId = await contract.call("nextTokenIdToMint");
        console.log("📋 Next token ID to mint:", nextTokenId.toString());
      } catch (error) {
        console.warn("⚠️ Could not get next token ID, proceeding anyway");
      }

      // For DropERC721, we need to lazy mint individual metadata URIs
      console.log("🔄 Step 1: Lazy minting individual metadata...");
      
      try {
        // Lazy mint with individual metadata URI (not base URI)
        const lazyMintTx = await contract.call("lazyMint", [
          1, // amount - mint just 1 NFT
          metadataURI, // This will be the exact tokenURI for the next token
          "0x" // extraData
        ], {
          gasLimit: 300000,
          maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
          maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei")
        });
        
        console.log("✅ Lazy mint successful with individual metadata");
      } catch (lazyMintError) {
        console.error("❌ Lazy mint failed:", lazyMintError.message);
        return {
          success: false,
          error: "Failed to prepare NFT metadata for claiming"
        };
      }

      // Claim the NFT
      console.log("🔄 Step 2: Claiming NFT...");
      
      const allowlistProof = {
        proof: [],
        quantityLimitPerWallet: 0,
        pricePerToken: 0,
        currency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
      };

      const tx = await contract.call("claim", [
        walletAddress,
        1,
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        0,
        allowlistProof,
        "0x"
      ], {
        gasLimit: 500000,
        maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei")
      });

      console.log("✅ Claim successful!");
      console.log("Transaction Hash:", tx.receipt.transactionHash);
      
      // Extract token ID
      const receipt = tx.receipt;
      const transferEvent = receipt.logs.find(log => 
        log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      
      let tokenId;
      if (transferEvent && transferEvent.topics[3]) {
        tokenId = parseInt(transferEvent.topics[3], 16);
        console.log("✅ Token ID:", tokenId);
      }

      // Verify the tokenURI is set correctly
      if (tokenId !== undefined) {
        try {
          const finalTokenURI = await contract.call("tokenURI", [tokenId]);
          console.log("🔍 Final Token URI:", finalTokenURI);
          
          if (finalTokenURI === metadataURI) {
            console.log("🎨 SUCCESS! TokenURI matches our metadata exactly");
            console.log("🖼️ NFT should display properly in MetaMask");
          } else if (finalTokenURI && finalTokenURI.includes(uploadResult.IpfsHash)) {
            console.log("🎨 SUCCESS! TokenURI contains our metadata hash");
            console.log("🖼️ NFT should display properly in MetaMask");
          } else {
            console.warn("⚠️ TokenURI doesn't match expected metadata");
            console.warn("Expected:", metadataURI);
            console.warn("Actual:", finalTokenURI);
          }
        } catch (uriError) {
          console.warn("⚠️ Could not verify token URI:", uriError.message);
        }
      }
      
      // Save to database
      await this.saveClaimToDatabase(
        nftData.id || nftData.name || 'Unknown NFT',
        walletAddress,
        tx.receipt.transactionHash,
        tokenId?.toString(),
        this.contractAddress
      );

      return {
        success: true,
        transactionHash: tx.receipt.transactionHash,
        tokenId: tokenId?.toString(),
        contractAddress: this.contractAddress
      };

    } catch (error: any) {
      console.error("❌ DropERC721 claim failed:", error);
      
      let errorMessage = "Failed to claim NFT";
      
      if (error.message?.includes("user rejected") || error.code === 4001) {
        errorMessage = "Transaction was rejected by user";
      } else if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas fees";
      } else if (error.message?.includes("execution reverted")) {
        errorMessage = "Transaction failed - contract error";
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private async switchToPolygonAmoy(): Promise<void> {
    const targetChainId = '0x13882';
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: targetChainId,
            chainName: 'Polygon Amoy Testnet',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18,
            },
            rpcUrls: ['https://rpc-amoy.polygon.technology/'],
            blockExplorerUrls: ['https://amoy.polygonscan.com/'],
          }],
        });
      }
    }
  }

  private async saveClaimToDatabase(
    nftId: string,
    walletAddress: string,
    transactionHash: string,
    tokenId?: string,
    contractAddress?: string
  ): Promise<void> {
    try {
      const walletClient = createClientWithWalletHeader(walletAddress);
      
      const claimData = {
        nft_id: nftId,
        wallet_address: walletAddress.toLowerCase(),
        transaction_hash: transactionHash,
        token_id: tokenId,
        contract_address: contractAddress || this.contractAddress,
        claimed_blockchain: 'ethereum',
        claimed_at: new Date().toISOString()
      };

      console.log('💾 Saving claim to database:', claimData);

      const { data, error } = await walletClient
        .from('nft_claims')
        .insert([claimData])
        .select();

      if (error) {
        console.error('Failed to save claim:', error);
      } else {
        console.log('✅ Claim saved to database');
      }
    } catch (error) {
      console.error('❌ Error saving claim:', error);
    }
  }
}

export const dropERC721ClaimService = new DropERC721ClaimService();
