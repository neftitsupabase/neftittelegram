import { ethers } from 'ethers';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { PolygonAmoyTestnet } from '@thirdweb-dev/chains';
import { createClientWithWalletHeader } from '../lib/supabaseClientManager';
import type { NFTData } from './HybridIPFSService';

export class DirectCIDClaimService {
  private contractAddress: string;
  private clientId: string;

  constructor() {
    this.contractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || "0x483Cc80A9858cc9Bd48b246a6BC91B24ca762CE6";
    this.clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;
  }

  /**
   * Claim NFT using the actual IPFS CID directly - no metadata upload
   * Uses the existing IPFS image URL as the tokenURI
   */
  async claimWithActualCID(nftData: NFTData): Promise<{
    success: boolean;
    transactionHash?: string;
    tokenId?: string;
    contractAddress?: string;
    error?: string;
  }> {
    try {
      console.log("🚀 Direct CID Claim - Using actual IPFS image as tokenURI");
      console.log("🖼️ Original Image URL:", nftData.image);
      console.log("📦 NFT Data:", nftData);

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

      // Extract the actual IPFS CID from the image URL
      let actualImageURL = nftData.image;
      let ipfsCID = "";
      
      if (!actualImageURL || !actualImageURL.includes('ipfs')) {
        return {
          success: false,
          error: "No valid IPFS image URL found in NFT data"
        };
      }

      // Extract CID from various IPFS URL formats
      const ipfsMatch = actualImageURL.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (ipfsMatch) {
        ipfsCID = ipfsMatch[1];
        // Use the actual IPFS image URL directly
        actualImageURL = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;
        console.log("✅ Extracted IPFS CID:", ipfsCID);
        console.log("✅ Using direct image URL:", actualImageURL);
      } else {
        return {
          success: false,
          error: "Could not extract IPFS CID from image URL"
        };
      }

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

      // Method 1: Try using the image URL directly as tokenURI (no metadata)
      console.log("🔄 Method 1: Using IPFS image URL directly as tokenURI...");
      
      try {
        // Lazy mint with the actual image URL as the tokenURI
        await contract.call("lazyMint", [
          1, // amount
          actualImageURL, // Use the actual IPFS image URL directly
          "0x" // extraData
        ], {
          gasLimit: 300000,
          maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
          maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei")
        });
        
        console.log("✅ Lazy mint with direct image URL successful");
      } catch (lazyMintError) {
        console.error("❌ Lazy mint failed:", lazyMintError.message);
        
        // Method 2: Try using existing metadata URI if available
        if (nftData.metadata_uri || nftData.ipfs_hash) {
          console.log("🔄 Method 2: Using existing metadata URI...");
          
          let existingMetadataURI = "";
          if (nftData.metadata_uri) {
            existingMetadataURI = nftData.metadata_uri;
          } else if (nftData.ipfs_hash) {
            existingMetadataURI = `https://gateway.pinata.cloud/ipfs/${nftData.ipfs_hash}`;
          }
          
          console.log("📋 Using existing metadata URI:", existingMetadataURI);
          
          try {
            await contract.call("lazyMint", [
              1,
              existingMetadataURI,
              "0x"
            ], {
              gasLimit: 300000,
              maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),
              maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei")
            });
            
            console.log("✅ Lazy mint with existing metadata successful");
          } catch (existingMetadataError) {
            console.error("❌ Both methods failed:", existingMetadataError.message);
            return {
              success: false,
              error: "Failed to prepare NFT for claiming"
            };
          }
        } else {
          return {
            success: false,
            error: "Failed to prepare NFT for claiming"
          };
        }
      }

      // Claim the NFT
      console.log("🔄 Claiming NFT...");
      
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

      // Check final tokenURI and try to fetch it
      if (tokenId !== undefined) {
        try {
          const finalTokenURI = await contract.call("tokenURI", [tokenId]);
          console.log("🔍 Final Token URI:", finalTokenURI);
          
          // Try to fetch the content from the tokenURI
          try {
            const response = await fetch(finalTokenURI);
            if (response.ok) {
              const content = await response.text();
              console.log("📄 TokenURI Content:", content);
              
              // Check if it's JSON metadata or direct image
              try {
                const metadata = JSON.parse(content);
                console.log("🎨 Parsed Metadata:", metadata);
                if (metadata.image) {
                  console.log("🖼️ Image URL in metadata:", metadata.image);
                  if (metadata.image.includes(ipfsCID)) {
                    console.log("🎉 SUCCESS! Metadata contains correct IPFS image");
                  } else {
                    console.warn("⚠️ Metadata image doesn't match expected CID");
                  }
                } else {
                  console.warn("⚠️ No image field found in metadata");
                }
              } catch (parseError) {
                console.log("📷 TokenURI points directly to image (not JSON metadata)");
                if (finalTokenURI.includes(ipfsCID)) {
                  console.log("🎉 SUCCESS! TokenURI points directly to correct image");
                }
              }
            } else {
              console.warn("⚠️ Could not fetch tokenURI content:", response.status);
            }
          } catch (fetchError) {
            console.warn("⚠️ Could not fetch tokenURI:", fetchError.message);
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
      console.error("❌ Direct CID claim failed:", error);
      
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

export const directCIDClaimService = new DirectCIDClaimService();
