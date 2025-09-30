import { ethers } from 'ethers';
import { createClientWithWalletHeader } from '../lib/supabaseClientManager';
import type { NFTData } from './HybridIPFSService';

export class DirectEthersNFTClaimService {
  private contractAddress: string;
  private fallbackRPCs: string[];
  private contractABI: any[];

  constructor() {
    this.contractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || "0x483Cc80A9858cc9Bd48b246a6BC91B24ca762CE6";
    
    // Multiple RPC endpoints for maximum reliability
    this.fallbackRPCs = [
      'https://rpc-amoy.polygon.technology/',
      'https://polygon-amoy.drpc.org',
      'https://polygon-amoy-bor-rpc.publicnode.com',
      'https://rpc.ankr.com/polygon_amoy',
      'https://polygon-amoy.gateway.tenderly.co',
      'https://endpoints.omniatech.io/v1/matic/amoy/public'
    ];

    // ERC721Drop ABI for lazy minting and claiming
    this.contractABI = [
      {
        "inputs": [],
        "name": "baseURI",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{"name": "_baseURI", "type": "string"}],
        "name": "setBaseURI",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {"name": "_amount", "type": "uint256"},
          {"name": "_baseURIForTokens", "type": "string"},
          {"name": "_data", "type": "bytes"}
        ],
        "name": "lazyMint",
        "outputs": [{"name": "batchId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {"name": "_receiver", "type": "address"},
          {"name": "_quantity", "type": "uint256"},
          {"name": "_currency", "type": "address"},
          {"name": "_pricePerToken", "type": "uint256"},
          {
            "components": [
              {"name": "proof", "type": "bytes32[]"},
              {"name": "quantityLimitPerWallet", "type": "uint256"},
              {"name": "pricePerToken", "type": "uint256"},
              {"name": "currency", "type": "address"}
            ],
            "name": "_allowlistProof",
            "type": "tuple"
          },
          {"name": "_data", "type": "bytes"}
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "anonymous": false,
        "inputs": [
          {"indexed": true, "name": "from", "type": "address"},
          {"indexed": true, "name": "to", "type": "address"},
          {"indexed": true, "name": "tokenId", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
      }
    ];
  }

  /**
   * Direct ethers.js NFT claiming with RPC fallbacks
   */
  async claimNFTDirect(nftData: NFTData): Promise<{
    success: boolean;
    transactionHash?: string;
    tokenId?: string;
    contractAddress?: string;
    error?: string;
  }> {
    try {
      console.log("🚀 Direct Ethers NFT Claim - Bypassing ThirdwebSDK");
      console.log("🖼️ Image URL:", nftData.image);

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

      // Try each RPC endpoint until one works
      for (let i = 0; i < this.fallbackRPCs.length; i++) {
        const rpcUrl = this.fallbackRPCs[i];
        console.log(`🔄 Attempt ${i + 1}/${this.fallbackRPCs.length}: Using RPC ${rpcUrl}`);
        
        try {
          const result = await this.attemptClaimWithRPC(rpcUrl, walletAddress, nftData);
          if (result.success) {
            return result;
          }
        } catch (rpcError: any) {
          console.log(`⚠️ RPC ${rpcUrl} failed:`, rpcError.message);
          
          // If this is the last RPC, return the error
          if (i === this.fallbackRPCs.length - 1) {
            return {
              success: false,
              error: `All RPC endpoints failed. Last error: ${rpcError.message}`
            };
          }
          
          // Continue to next RPC
          continue;
        }
      }

      return {
        success: false,
        error: "All RPC endpoints failed to process the claim"
      };

    } catch (error: any) {
      console.error("❌ Direct ethers claim failed:", error);
      
      let errorMessage = "Failed to claim NFT";
      
      if (error.message?.includes("user rejected") || error.code === 4001) {
        errorMessage = "Transaction was rejected by user";
      } else if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas fees";
      } else if (error.message?.includes("Internal JSON-RPC error")) {
        errorMessage = "Network error - please try again in a few minutes";
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Attempt claim using a specific RPC endpoint
   */
  private async attemptClaimWithRPC(rpcUrl: string, walletAddress: string, nftData: NFTData) {
    // Create provider with specific RPC
    const rpcProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Test RPC connectivity first
    try {
      await rpcProvider.getNetwork();
      console.log(`✅ RPC ${rpcUrl} is responsive`);
    } catch (testError) {
      throw new Error(`RPC connectivity test failed: ${testError.message}`);
    }

    // Create contract instance with RPC provider
    const contract = new ethers.Contract(this.contractAddress, this.contractABI, rpcProvider);

    // Get current gas price from this RPC
    const gasPrice = await rpcProvider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(120).div(100); // 20% buffer

    console.log(`💰 Gas price from ${rpcUrl}:`, ethers.utils.formatUnits(adjustedGasPrice, 'gwei'), 'gwei');

    // Get MetaMask signer for transaction signing
    const metamaskProvider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = metamaskProvider.getSigner();

    // Connect contract to signer for transaction
    const contractWithSigner = contract.connect(signer);

    // First, set up metadata with lazyMint if we have metadata URI
    let metadataURI = "";
    if (nftData.metadata_uri) {
      metadataURI = nftData.metadata_uri;
    } else if (nftData.ipfs_hash) {
      metadataURI = `https://gateway.pinata.cloud/ipfs/${nftData.ipfs_hash}`;
    }

    console.log(`🔍 DEBUG: NFT metadata check - metadata_uri: ${nftData.metadata_uri}, ipfs_hash: ${nftData.ipfs_hash}`);
    console.log(`🔍 DEBUG: Resolved metadataURI: ${metadataURI}`);

    // For Drop contracts, we MUST use lazyMint + claim pattern
    // The metadata will be stored in batches, not individual URIs
    if (metadataURI && metadataURI.trim() !== "") {
      console.log(`📋 LazyMinting batch with metadata: ${metadataURI}`);
      
      try {
        const lazyMintTx = await contractWithSigner.lazyMint(
          1, // Amount to lazy mint
          metadataURI, // Base URI for this batch
          "0x", // No encrypted data
          {
            gasLimit: ethers.BigNumber.from("300000"),
            gasPrice: adjustedGasPrice
          }
        );

        console.log(`⏳ LazyMint transaction sent: ${lazyMintTx.hash}`);
        await lazyMintTx.wait();
        console.log(`✅ LazyMint completed successfully`);
      } catch (lazyMintError: any) {
        console.log(`⚠️ LazyMint failed: ${lazyMintError.message}`);
        // Continue with claim anyway - tokens might already be lazy minted
      }
    } else {
      console.log("⚠️ No metadata URI available, proceeding with claim only");
    }

    // Prepare claim parameters
    const allowlistProof = {
      proof: [],
      quantityLimitPerWallet: 0,
      pricePerToken: 0,
      currency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    };

    // Estimate gas using the RPC provider
    let gasEstimate;
    try {
      gasEstimate = await contract.estimateGas.claim(
        walletAddress,
        1,
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        0,
        allowlistProof,
        "0x"
      );
      console.log(`⛽ Gas estimate from ${rpcUrl}:`, gasEstimate.toString());
    } catch (estimateError) {
      console.log(`⚠️ Gas estimation failed on ${rpcUrl}, using default`);
      gasEstimate = ethers.BigNumber.from("500000");
    }

    // Execute the claim transaction
    const tx = await contractWithSigner.claim(
      walletAddress,
      1,
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      0,
      allowlistProof,
      "0x",
      {
        gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
        gasPrice: adjustedGasPrice
      }
    );

    console.log(`🚀 Transaction sent via ${rpcUrl}:`, tx.hash);
    console.log("⏳ Waiting for confirmation...");

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    console.log("✅ Transaction confirmed!");
    console.log("📋 Receipt:", receipt);
    
    const tokenId = this.extractTokenIdFromReceipt(receipt);
    
    // Verify tokenURI after successful claim
    if (tokenId) {
      try {
        const tokenURI = await contract.tokenURI(tokenId);
        console.log(`🔍 TokenURI for token ${tokenId}: ${tokenURI}`);
        
        // Fetch and log the actual metadata
        try {
          const response = await fetch(tokenURI);
          const metadata = await response.json();
          console.log(`📋 NFT Metadata for token ${tokenId}:`, metadata);
          console.log(`🖼️ Image URL in metadata: ${metadata.image}`);
        } catch (metadataError) {
          console.log("⚠️ Could not fetch metadata:", metadataError.message);
        }
      } catch (uriError) {
        console.log("⚠️ Could not get tokenURI:", uriError.message);
      }
    }
    
    await this.saveClaimToDatabase(
      nftData.id || nftData.name || 'Unknown NFT',
      walletAddress,
      receipt.transactionHash,
      tokenId?.toString(),
      this.contractAddress
    );

    return {
      success: true,
      transactionHash: receipt.transactionHash,
      tokenId: tokenId?.toString(),
      contractAddress: this.contractAddress
    };
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
            rpcUrls: this.fallbackRPCs,
            blockExplorerUrls: ['https://amoy.polygonscan.com/'],
          }],
        });
      }
    }
  }

  private extractTokenIdFromReceipt(receipt: any): number | null {
    try {
      const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      const transferEvent = receipt.logs.find((log: any) => log.topics[0] === transferTopic);
      
      if (transferEvent && transferEvent.topics[3]) {
        return parseInt(transferEvent.topics[3], 16);
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting token ID:", error);
      return null;
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

export const directEthersNFTClaimService = new DirectEthersNFTClaimService();
