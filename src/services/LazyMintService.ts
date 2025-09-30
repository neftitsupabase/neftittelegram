import { ThirdwebSDK, NATIVE_TOKEN_ADDRESS } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { getAuthStatus } from "../utils/authUtils";
import { toast } from "react-hot-toast";
import type { NFTData } from "./HybridIPFSService";

export interface LazyMintResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  error?: string;
}

export class LazyMintService {
  private sdk: ThirdwebSDK;
  private contractAddress: string;

  constructor() {
    this.contractAddress = import.meta.env.VITE_THIRDWEB_NFT_DROP_ADDRESS || "0x8252451036797413e75338E70d294e9ed753AE64";
    this.sdk = new ThirdwebSDK(PolygonAmoyTestnet, {
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
    });
  }

  private async connectToMetaMask(): Promise<boolean> {
    try {
      console.log("🔗 Connecting to MetaMask for lazy minting...");
      if (!window.ethereum) {
        toast.error("MetaMask is not installed!");
        throw new Error("MetaMask not found");
      }

      // Request account access
      console.log("🔐 Requesting MetaMask account access...");
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      // Check current chain
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log("🌐 Current chain ID:", chainId);

      // Ensure we're on Polygon Amoy
      if (chainId !== '0x13882') {
        console.log("🔄 Switching to Polygon Amoy...");
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x13882' }],
          });
          console.log("✅ Switched to Polygon Amoy");
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            console.log("⚠️ Polygon Amoy not added to MetaMask, attempting to add...");
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x13882',
                  chainName: 'Polygon Amoy Testnet',
                  rpcUrls: ['https://rpc-amoy.polygon.technology/'],
                  nativeCurrency: {
                    name: 'MATIC',
                    symbol: 'MATIC',
                    decimals: 18,
                  },
                  blockExplorerUrls: ['https://amoy.polygonscan.com/'],
                }],
              });
              console.log("✅ Polygon Amoy added and switched successfully!");
            } catch (addError: any) {
              console.error("❌ Failed to add Polygon Amoy to MetaMask:", addError);
              toast.error("Failed to add Polygon Amoy to MetaMask. Please add it manually.");
              return false;
            }
          } else {
            console.error("❌ Failed to switch to Polygon Amoy:", switchError);
            toast.error("Failed to switch to Polygon Amoy. Please switch manually.");
            return false;
          }
        }
      }

      console.log("🔗 MetaMask accounts found:", accounts);

      // Always use ethers provider for proper signing
      console.log("🔧 Initializing SDK with ethers provider for proper signing...");

      // Create ethers provider and signer
      let provider, signer;
      
      // Try to use window.ethers if available (MetaMask injects it)
      if ((window as any).ethers && (window as any).ethers.providers) {
        console.log("🔧 Using window.ethers provider...");
        provider = new (window as any).ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
      } else {
        // Fallback: Use dynamic import of ethers
        console.log("🔧 Using dynamic ethers import...");
        const ethers = await import('ethers');
        // Use the correct ethers v5 syntax
        provider = new (ethers as any).providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
      }
      
      console.log("✅ Ethers provider and signer created");
      
      // Initialize SDK with the signer
      this.sdk = new ThirdwebSDK(signer, {
        clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
      });
      
      console.log("✅ SDK initialized with ethers signer");
      
      // Verify the connection
      try {
        const connectedAddress = await signer.getAddress();
        console.log("✅ Connected wallet address:", connectedAddress);
      } catch (addressError) {
        console.log("⚠️ Could not get address from signer:", addressError.message);
      }
      
      return true;
    } catch (error: any) {
      console.error("❌ Failed to connect MetaMask:", error);
      toast.error(`Failed to connect MetaMask: ${error.message}`);
      return false;
    }
  }

  private extractIPFSCID(url: string): string | null {
    try {
      console.log("🔍 Attempting to extract IPFS CID from:", url);

    // Handle different IPFS URL formats
      if (url.includes('/ipfs/')) {
        const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
          console.log("✅ Extracted CID from /ipfs/ format:", match[1]);
          return match[1];
        }
      }
      
      if (url.includes('ipfs://')) {
        const match = url.match(/ipfs:\/\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
          console.log("✅ Extracted CID from ipfs:// format:", match[1]);
          return match[1];
        }
      }
      
      console.log("❌ Could not extract IPFS CID from URL format:", url);
      return null;
    } catch (error) {
      console.error("❌ Error extracting IPFS CID:", error);
      return null;
    }
  }

  async lazyMintNFT(walletAddress: string, nft: NFTData): Promise<LazyMintResult> {
    try {
      console.log("🚀 Starting NFT lazy mint + claim process...");
      console.log("👤 Wallet:", walletAddress);
      console.log("🎨 NFT:", nft.name, `(${nft.rarity})`);

      // Step 1: Check authentication
      const authStatus = await getAuthStatus();
      console.log("🔐 Authentication status:", authStatus);
      
      if (!authStatus) {
        throw new Error("Authentication failed or wallet mismatch");
      }

      // Step 2: Connect to MetaMask
      console.log("🔗 Connecting to MetaMask...");
      const connected = await this.connectToMetaMask();
      if (!connected) {
        return { success: false, error: "Failed to connect to MetaMask. Please check your wallet connection." };
      }

      // Step 3: Get contract instance
      const contract = await this.sdk.getContract(this.contractAddress);
      console.log("✅ Contract connected:", this.contractAddress);

      // Step 4: Prepare NFT metadata for lazy minting
      console.log("📝 Preparing NFT metadata for lazy minting...");
      
      // Convert local image path to IPFS URL
      let imageUrl = nft.image;
      if (nft.image.startsWith('/images/')) {
        // Map local paths to IPFS URLs
        const imageMapping: { [key: string]: string } = {
          '/images/common2.jpg': 'https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH',
          '/images/rare2.jpg': 'https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH',
          '/images/epic2.jpg': 'https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH',
          '/images/legendary2.jpg': 'https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH',
          '/images/Rare1.jpg': 'https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH',
          '/images/Common1.jpg': 'https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH',
          '/images/Epic1.jpg': 'https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH',
          '/images/Legendary1.jpg': 'https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH',
        };
        imageUrl = imageMapping[nft.image] || nft.image;
        console.log(`🖼️ Converted image path: ${nft.image} → ${imageUrl}`);
      }

      const metadata = {
        name: nft.name,
        description: nft.description,
        image: imageUrl,
        attributes: nft.attributes || [
          { trait_type: "Rarity", value: nft.rarity || "Unknown" },
          { trait_type: "Type", value: "NFT" }
        ]
      };

      console.log("📋 NFT Metadata:", metadata);

      // Step 5: Lazy mint the NFT metadata first
      console.log("🔨 Lazy minting NFT metadata to contract...");
      let lazyMintResult;
      
      try {
        // Method 1: Try ERC721 lazyMint with MetaMask-specific error handling
        console.log("Method 1: Using ERC721 lazyMint...");
        try {
          // Add gas limit for MetaMask compatibility
          lazyMintResult = await contract.erc721.lazyMint([metadata], {
            gasLimit: 500000 // Set explicit gas limit for MetaMask
          });
          console.log("✅ ERC721 lazyMint successful!");
        } catch (gasError) {
          // If gas limit fails, try without gas limit
          console.log("Gas limit failed, trying without gas limit...");
          lazyMintResult = await contract.erc721.lazyMint([metadata]);
          console.log("✅ ERC721 lazyMint successful!");
        }
      } catch (lazyMintError) {
        console.log("Method 1 failed, trying direct contract call...", lazyMintError.message);
        
        // Method 2: Try direct contract call for lazyMint
        console.log("Method 2: Using direct contract lazyMint call...");
        try {
          // Extract IPFS CID from the image URL
          let ipfsCID = this.extractIPFSCID(imageUrl);
          if (!ipfsCID) {
            // If no CID found, use a default one
            ipfsCID = "QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH";
            console.log("⚠️ Using default IPFS CID:", ipfsCID);
          }
          
          // Try with gas limit for MetaMask compatibility
          try {
            lazyMintResult = await contract.call("lazyMint", [1, `ipfs://${ipfsCID}/`, "0x"], {
              gasLimit: 500000
            });
            console.log("✅ Direct lazyMint call successful!");
          } catch (gasError) {
            // If gas limit fails, try without gas limit
            console.log("Gas limit failed, trying without gas limit...");
            lazyMintResult = await contract.call("lazyMint", [1, `ipfs://${ipfsCID}/`, "0x"]);
            console.log("✅ Direct lazyMint call successful!");
          }
        } catch (directLazyMintError) {
          console.log("Method 2 failed, trying alternative approach...", directLazyMintError.message);
          
          // Method 3: Try createBatch
          console.log("Method 3: Using createBatch...");
          try {
            lazyMintResult = await contract.call("createBatch", [[metadata]]);
            console.log("✅ createBatch successful!");
          } catch (createBatchError) {
            console.log("Method 3 failed, trying final approach...", createBatchError.message);
            
            // Method 4: Try direct mint to user (skip lazy minting)
            console.log("Method 4: Skipping lazy mint, trying direct mint...");
            try {
              lazyMintResult = await contract.call("mintTo", [walletAddress, metadata]);
              console.log("✅ Direct mintTo successful!");
            } catch (directMintError) {
              console.log("All lazy mint methods failed:", directMintError.message);
              throw new Error("Failed to lazy mint NFT metadata. Contract may not support lazy minting.");
            }
          }
        }
      }

      console.log("📋 Lazy mint result:", lazyMintResult);

            // Step 6: Now claim the lazy minted NFT
      console.log("🎯 Claiming the lazy minted NFT...");
      let claimResult;
      
      try {
        // Method 1: Try direct claim call with FREE parameters
        console.log("Method 1: Using direct claim call with FREE parameters...");
        try {
          claimResult = await contract.call("claim", [
            walletAddress, // receiver
            1, // quantity
            "0x0000000000000000000000000000000000000000", // currency (zero address for free)
            "0", // price (0 ETH for free)
            {
          proof: [],
              quantityLimitPerWallet: 5,
              pricePerToken: "0",
              currency: "0x0000000000000000000000000000000000000000",
            },
            "0x" // empty bytes
          ], {
            gasLimit: 500000 // Set explicit gas limit for MetaMask
          });
        } catch (gasError) {
          // If gas limit fails, try without gas limit
          console.log("Gas limit failed, trying without gas limit...");
        claimResult = await contract.call("claim", [
            walletAddress, // receiver
            1, // quantity
            "0x0000000000000000000000000000000000000000", // currency (zero address for free)
            "0", // price (0 ETH for free)
            {
              proof: [],
              quantityLimitPerWallet: 5,
              pricePerToken: "0",
              currency: "0x0000000000000000000000000000000000000000",
            },
            "0x" // empty bytes
          ]);
        }
        console.log("✅ Direct claim call successful!");
      } catch (directClaimError) {
        console.log("Method 1 failed, trying alternative approach...", directClaimError.message);
        
        // Method 2: Try with different FREE format
        console.log("Method 2: Using different FREE format...");
        try {
          claimResult = await contract.call("claim", [
            walletAddress, // receiver
            1, // quantity
            "0x0000000000000000000000000000000000000000", // currency (zero address for free)
            "0x0", // price in hex format (0 ETH)
            {
              proof: [],
              quantityLimitPerWallet: 5,
              pricePerToken: "0x0",
              currency: "0x0000000000000000000000000000000000000000",
            },
            "0x" // empty bytes
          ]);
          console.log("✅ Alternative price format successful!");
        } catch (altPriceError) {
          console.log("Method 2 failed, trying zero price...", altPriceError.message);
          
          // Method 3: Try with zero price (free claim)
          console.log("Method 3: Using zero price (free claim)...");
          try {
            claimResult = await contract.call("claim", [
              walletAddress, // receiver
              1, // quantity
              "0x0000000000000000000000000000000000000000", // zero address
              "0", // zero price
              {
                proof: [],
                quantityLimitPerWallet: 1,
                pricePerToken: "0",
                currency: "0x0000000000000000000000000000000000000000",
              },
              "0x" // empty bytes
            ]);
            console.log("✅ Zero price claim successful!");
          } catch (zeroPriceError) {
            console.log("Method 3 failed, trying simple claim...", zeroPriceError.message);
            
            // Method 4: Try simple claim without parameters
            console.log("Method 4: Using simple claim without parameters...");
            try {
              claimResult = await contract.call("claim");
              console.log("✅ Simple claim successful!");
            } catch (simpleClaimError) {
              console.log("All claim methods failed:", simpleClaimError.message);
              throw new Error("Failed to claim NFT after lazy minting.");
            }
          }
        }
      }

      console.log("📋 Claim result:", claimResult);

      if (!claimResult || !claimResult.receipt) {
        throw new Error("Claim transaction failed or no receipt received.");
      }

      let tokenId = "unknown";
      let transactionHash = claimResult.receipt.transactionHash || "";
      
      // Try to extract token ID from transaction logs
      if (claimResult.receipt.logs && claimResult.receipt.logs.length > 0) {
        for (const log of claimResult.receipt.logs) {
          if (log.topics && log.topics.length >= 4) {
            const tokenIdHex = log.topics[3];
            if (tokenIdHex) {
              tokenId = parseInt(tokenIdHex, 16).toString();
              break;
            }
          }
        }
      }

      console.log(`🎫 Token ID: ${tokenId}`);
      console.log(`🔗 Transaction Hash: ${transactionHash}`);

      toast.success(`NFT claimed successfully! ${nft.name} is now in your wallet 🎉`, {
        duration: 6000,
        style: {
          background: '#10B981',
          color: '#ffffff',
        },
      });
      console.log("🎉 NFT claimed successfully!");
      console.log("💰 NFT should now appear in your wallet (MetaMask, OKX, etc.)");

      // Record the claim in multiple ways for reliability
      try {
        const { nftClaimTrackingService } = await import('./NFTClaimTrackingService');
        await nftClaimTrackingService.recordNFTClaim(
          nft.id,
          'ethereum', // blockchain type
          this.contractAddress,
          transactionHash,
          tokenId,
          walletAddress
        );
        console.log("✅ Claim recorded in tracking service");
      } catch (trackingError) {
        console.error("⚠️ Failed to record claim in tracking service:", trackingError);
      }

      try {
        const claimedKey = `claimed_nfts_${walletAddress}`;
        const existingClaims = JSON.parse(localStorage.getItem(claimedKey) || '[]');
        const newClaim = {
          nftId: nft.id,
          nftName: nft.name,
          tokenId,
          transactionHash,
          claimedAt: new Date().toISOString(),
          contractAddress: this.contractAddress
        };
        existingClaims.push(newClaim);
        localStorage.setItem(claimedKey, JSON.stringify(existingClaims));
        console.log("✅ Claim recorded in localStorage backup");
      } catch (localStorageError) {
        console.error("⚠️ Failed to record claim in localStorage:", localStorageError);
      }

      return {
        success: true,
        tokenId,
        transactionHash
      };

    } catch (error: any) {
      console.error("❌ Lazy mint + claim failed:", error);
      
      let errorMessage = "Failed to lazy mint and claim NFT";
      if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient MATIC for gas fees";
        toast.error(errorMessage);
      } else if (error.message?.includes("user rejected")) {
        errorMessage = "Transaction rejected by user";
        toast.error(errorMessage);
      } else if (error.message?.includes("Internal JSON-RPC error")) {
        errorMessage = "Network error - please try again";
        toast.error(errorMessage);
      } else if (error.message?.includes("missing trie node")) {
        errorMessage = "Network sync issue - please try again";
        toast.error(errorMessage);
      } else {
      toast.error(errorMessage);
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async getUserIPFSNFTs(walletAddress: string): Promise<NFTData[]> {
    try {
      // For now, return empty array since we're focusing on direct claiming
      // This can be implemented later if needed
      return [];
    } catch (error) {
      console.error("Error getting user IPFS NFTs:", error);
      return [];
    }
  }

  /**
   * Check if lazy minting is supported
   */
  async isLazyMintSupported(): Promise<boolean> {
    try {
      const contract = await this.sdk.getContract(this.contractAddress);
      // Simple check - if we can get the contract, assume it supports basic operations
      return true;
    } catch (error) {
      console.error("Error checking lazy mint support:", error);
      return false;
    }
  }
}

// Export singleton instance
export const lazyMintService = new LazyMintService();