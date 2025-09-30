// import { ThirdwebSDK } from "@thirdweb-dev/sdk";
// import { Signer, providers } from "ethers";
// import { toast } from "react-hot-toast";
// import { THIRDWEB_CONFIG } from "../config/thirdweb";
// import { enhancedIPFSBurnService } from "./EnhancedIPFSBurnService";
// import { hybridIPFSService } from "./HybridIPFSService";
// import { createClient } from '@supabase/supabase-js';
// import type { Wallet } from "thirdweb/wallets";

// const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_ANON_KEY
// );

// // Types
// export interface NFTMetadata {
//   id: string;
//   name: string;
//   description: string;
//   image: string;
//   rarity: string;
//   attributes: { [key: string]: string };
//   seller_fee_basis_points?: number; // Optional royalty fee in basis points (e.g., 500 = 5%)
// }

// export class ThirdwebNFTService {
//   private sdk: ThirdwebSDK;
//   private enhancedIPFSBurnService: any;

//   constructor(signerOrWallet?: Signer | Wallet) {
//     this.sdk = new ThirdwebSDK(THIRDWEB_CONFIG.chain, {
//       clientId: THIRDWEB_CONFIG.clientId,
//     });
    
//     // Only update signer if provided and it's a valid Signer
//     if (signerOrWallet && this.isSigner(signerOrWallet)) {
//       this.sdk.updateSignerOrProvider(signerOrWallet);
//     }
    
//     this.enhancedIPFSBurnService = enhancedIPFSBurnService;
//   }

//   /**
//    * Connect to MetaMask and update the SDK with the signer
//    */
//   async connectToMetaMask(): Promise<boolean> {
//     try {
//       if (!window.ethereum) {
//         console.error("MetaMask not detected");
//         return false;
//       }

//       console.log("🔗 Connecting ThirdwebSDK to MetaMask...");
      
//       // Create ethers provider and signer (this will use existing connection)
//       const provider = new providers.Web3Provider(window.ethereum);
//       const signer = provider.getSigner();
      
//       // Update the SDK with the signer
//       this.sdk.updateSignerOrProvider(signer);
      
//       console.log("✅ ThirdwebSDK connected to MetaMask");
//       return true;
//     } catch (error) {
//       console.error("Failed to connect ThirdwebSDK to MetaMask:", error);
//       return false;
//     }
//   }

//   private isSigner(obj: any): obj is Signer {
//     return obj && typeof obj.getAddress === 'function' && typeof obj.signMessage === 'function';
//   }

//   /**
//    * Claim NFT - Enhanced to handle IPFS NFTs and mint to blockchain
//    */
//   async claimNFT(walletAddress: string, quantity: number = 1, nftMetadata?: any): Promise<{ success: boolean; tokenIds?: string[]; error?: string; transactionHash?: string }> {
//     try {
//       console.log("🚀 Starting NFT claiming process...");
//       console.log(`👤 Wallet: ${walletAddress}`);
//       console.log(`📦 Quantity: ${quantity}`);

//       // Step 1: Check if contract is configured
//       if (!this.isContractConfigured()) {
//         const error = "NFT Drop contract is not configured. Please deploy the contract first.";
//         console.error("❌", error);
//         toast.error(error);
//         return { success: false, error };
//       }

//       let nftsToMint: NFTMetadata[] = [];

//       // Step 2: Get NFTs to mint
//       if (nftMetadata) {
//         // Use provided metadata (bypass IPFS fetching)
//         console.log("🎯 Using provided NFT metadata for minting");
//         nftsToMint = [{
//           id: nftMetadata.id || `nft_${Date.now()}`,
//           name: nftMetadata.name || "NEFTIT NFT",
//           description: nftMetadata.description || "NEFTIT Platform NFT",
//           image: nftMetadata.image || "",
//           rarity: nftMetadata.rarity || "common",
//           attributes: nftMetadata.attributes || {},
//           seller_fee_basis_points: typeof nftMetadata.seller_fee_basis_points === 'string' 
//             ? parseInt(nftMetadata.seller_fee_basis_points) 
//             : (nftMetadata.seller_fee_basis_points || 300)
//         }];
//       } else {
//         // Fetch from IPFS (original flow)
//         console.log("🔍 Step 2: Fetching user's off-chain IPFS NFTs...");
//         const userNFTs = await this.getUserIPFSNFTs(walletAddress);
        
//         if (userNFTs.length === 0) {
//           const error = "No off-chain NFTs found for claiming. Participate in campaigns to earn NFTs.";
//           console.error("❌", error);
//           toast.error(error);
//           return { success: false, error };
//         }

//         console.log(`📦 Found ${userNFTs.length} off-chain NFTs available for claiming`);
        
//         // Step 3: Select NFTs to mint (up to requested quantity)
//         nftsToMint = userNFTs.slice(0, Math.min(quantity, userNFTs.length));
//       }
      
//       console.log(`🎯 Selected ${nftsToMint.length} NFTs for minting`);

//       // Step 4: Prepare NFT metadata with IPFS CID for blockchain minting
//       console.log("🔧 Step 4: Preparing NFT metadata with IPFS CID for blockchain minting...");
//       const mintMetadata = [];
      
//       for (const nft of nftsToMint) {
//         // Extract IPFS CID from the NFT data
//         let ipfsCID = null;
//         let imageUrl = nft.image;
        
//         // Extract CID from various IPFS URL formats (Pinata IPFS)
//         if (imageUrl) {
//           if (imageUrl.startsWith('ipfs://')) {
//             ipfsCID = imageUrl.replace('ipfs://', '');
//             imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;
//           } else if (imageUrl.includes('/ipfs/')) {
//             ipfsCID = imageUrl.split('/ipfs/')[1];
//             imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;
//           } else if (imageUrl.includes('gateway.pinata.cloud/ipfs/')) {
//             // Already a Pinata gateway URL
//             ipfsCID = imageUrl.split('gateway.pinata.cloud/ipfs/')[1];
//           } else if (imageUrl.startsWith('Qm') || imageUrl.startsWith('baf')) {
//             // Direct IPFS hash
//             ipfsCID = imageUrl;
//             imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;
//           } else if (imageUrl.startsWith('/images/')) {
//             // Local image path - convert to placeholder IPFS
//             ipfsCID = `QmPlaceholder${Date.now()}`;
//             imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;
//           }
//         }

//         // Prepare comprehensive metadata for blockchain minting
//         const metadata = {
//           name: nft.name || `NEFTIT NFT #${Date.now()}`,
//           description: nft.description || "NEFTIT Platform NFT claimed from IPFS",
//           image: imageUrl,
//           external_url: "https://neftit.com",
//           seller_fee_basis_points: typeof nft.seller_fee_basis_points === 'string' 
//             ? parseInt(nft.seller_fee_basis_points) 
//             : (nft.seller_fee_basis_points || 300),
//           attributes: [
//             {
//               trait_type: "Rarity",
//               value: nft.rarity || "common"
//             },
//             {
//               trait_type: "Source",
//               value: "IPFS"
//             },
//             {
//               trait_type: "IPFS CID",
//               value: ipfsCID || "unknown"
//             },
//             {
//               trait_type: "Claimed Date",
//               value: new Date().toISOString().split('T')[0]
//             },
//             // Add any custom attributes from the original NFT
//             ...(nft.attributes ? Object.entries(nft.attributes).map(([key, value]) => ({
//               trait_type: key,
//               value: String(value)
//             })) : []),

//           ]
//         };

//         mintMetadata.push(metadata);
//         console.log(`🎨 Prepared metadata for NFT: ${nft.name} (IPFS CID: ${ipfsCID})`);
//       }

//       // Step 5: Mint NFTs using NFT Drop contract
//       console.log("⛓️ Step 5: Minting NFTs to NFT Drop contract...");
      
//       // Use NFT Drop contract for claiming (supports ERC721 with claim conditions)
//       const nftContract = await this.sdk.getContract(THIRDWEB_CONFIG.contracts.nftDrop);
//       console.log("✅ Using NFT Drop contract:", THIRDWEB_CONFIG.contracts.nftDrop);
      
//       const tokenIds: string[] = [];
//       let transactionHash = "";

//       for (let i = 0; i < mintMetadata.length; i++) {
//         const metadata = mintMetadata[i];
//         const originalNFT = nftsToMint[i];
        
//         try {
//           console.log(`🔄 Claiming NFT ${i + 1}/${mintMetadata.length} from NFT Drop contract...`);
          
//           let mintResult;
          
//           // Based on console logs, your contract doesn't support standard minting/claiming
//           // Let's try alternative approaches for basic NFT contracts
//           try {
//             console.log("Attempting to interact with basic NFT contract...");
            
//             // Try using the contract's available functions
//             // First check what functions are actually available
//             console.log("Contract type:", (nftContract as any).contractType);
//             console.log("Available extensions:", {
//               erc721: !!nftContract.erc721,
//               erc1155: !!nftContract.erc1155,
//               claimConditions: !!(nftContract as any).claimConditions,
//               metadata: !!(nftContract as any).metadata
//             });
            
//             // Try ERC721 specific methods first (NFT Drop contract)
//             if (nftContract.erc721) {
//               console.log("Using ERC721 methods...");
//               try {
//                 // Try ERC721 claim method
//                 console.log("Trying erc721.claim...");
//                 mintResult = await nftContract.erc721.claim(1); // quantity 1
//                 console.log("✅ Successfully claimed using erc721.claim");
//               } catch (erc721Error: any) {
//                 console.log("erc721.claim failed:", erc721Error.message);
                
//                 // Try ERC721 claimTo method
//                 console.log("Trying erc721.claimTo...");
//                 mintResult = await nftContract.erc721.claimTo(walletAddress, 1); // to, quantity
//                 console.log("✅ Successfully claimed using erc721.claimTo");
//               }
//             }
//             // Fallback to claimConditions if ERC721 methods fail
//             else if ((nftContract as any).claimConditions) {
//               console.log("Trying claimConditions.claim with quantity 1...");
//               try {
//                 mintResult = await (nftContract as any).claimConditions.claim(1);
//                 console.log("✅ Successfully claimed using claimConditions.claim");
//               } catch (claimError: any) {
//                 console.log("claimConditions.claim failed:", claimError.message);
                
//                 // Try with different parameters
//                 console.log("Trying claimConditions.claimTo...");
//                 mintResult = await (nftContract as any).claimConditions.claimTo(walletAddress, 1);
//                 console.log("✅ Successfully claimed using claimConditions.claimTo");
//               }
//             }
//             // Try direct contract interaction with available functions
//             else {
//               console.log("No claim conditions available. Checking available contract functions...");
              
//               // Try to call any available mint function directly
//               const contractFunctions = Object.keys((nftContract as any).functions || {});
//               console.log("Available contract functions:", contractFunctions);
              
//               // Look for any mint-related functions
//               const mintFunctions = contractFunctions.filter(fn => 
//                 fn.toLowerCase().includes('mint') || 
//                 fn.toLowerCase().includes('claim') ||
//                 fn.toLowerCase().includes('create')
//               );
              
//               if (mintFunctions.length > 0) {
//                 console.log("Found potential mint functions:", mintFunctions);
                
//                 // Try the first available mint function
//                 const mintFunction = mintFunctions[0];
//                 console.log(`Trying function: ${mintFunction}`);
                
//                 try {
//                   mintResult = await (nftContract as any).call(mintFunction, [walletAddress, metadata]);
//                   console.log(`✅ Successfully minted using ${mintFunction}`);
//                 } catch (funcError: any) {
//                   console.log(`Function ${mintFunction} failed:`, funcError.message);
//                   throw new Error(`No working mint functions found. Available functions: ${mintFunctions.join(', ')}`);
//                 }
//               } else {
//                 throw new Error("No mint or claim functions available in this contract");
//               }
//             }
//           } catch (error: any) {
//             console.error("All contract interaction methods failed:", error.message);
//             throw new Error(`Contract interaction failed: ${error.message}. Your contract may not support NFT minting or claiming. Please check your Thirdweb dashboard to ensure the contract has the required extensions.`);
//           }
          
//           const tokenId = mintResult.id.toString();
//           tokenIds.push(tokenId);
//           if (i === 0) transactionHash = mintResult.receipt.transactionHash;
          
//           console.log(`✅ Successfully minted NFT:`);
//           console.log(`   Token ID: ${tokenIds[tokenIds.length - 1]}`);
//           console.log(`   Transaction: ${transactionHash}`);
          
//           // Record migration mapping (IPFS NFT ID -> Blockchain Token ID)
//           console.log(`📝 Migration Record: IPFS NFT "${originalNFT.id}" -> Blockchain Token ID "${tokenIds[tokenIds.length - 1]}"`);
//           // TODO: Store this mapping in database for audit trail and preventing double claims
          
//         } catch (mintError: any) {
//           console.error(`❌ Failed to mint NFT ${i + 1}:`, mintError);
          
//           // Handle specific blockchain errors
//           if (mintError.message?.includes("insufficient funds")) {
//             toast.error("Insufficient funds for gas fees. Please add MATIC to your wallet.");
//             return { success: false, error: "Insufficient gas funds" };
//           } else if (mintError.message?.includes("user rejected")) {
//             toast.error("Transaction was rejected by user.");
//             return { success: false, error: "Transaction rejected" };
//           } else if (mintError.message?.includes("contract not deployed")) {
//             toast.error("NFT contract is not properly deployed. Please contact support.");
//             return { success: false, error: "Contract deployment issue" };
//           } else if (mintError.message?.includes("DropNoActiveCondition")) {
//             toast.error("ERC1155 Drop has no active claim conditions. Using direct minting instead.");
//             // Try direct ERC1155 minting as fallback
//             try {
//               const mintResult = await (nftContract as any).erc1155.mintTo(walletAddress, {
//                 metadata,
//                 supply: 1
//               });
//               const tokenId = mintResult.id.toString();
//               tokenIds.push(tokenId);
//               if (i === 0) transactionHash = mintResult.receipt.transactionHash;
//               console.log(`✅ Fallback ERC1155 mint successful - Token ID: ${tokenId}`);
//               continue; // Continue to next NFT
//             } catch (fallbackError) {
//               console.error("❌ Fallback ERC1155 mint also failed:", fallbackError);
//               throw fallbackError;
//             }
//           }
          
//           throw mintError; // Re-throw for general error handling
//         }
//       }

//       // Step 6: Success response
//       console.log("🎉 NFT claiming completed successfully!");
//       console.log(`✅ Minted ${tokenIds.length} NFTs to wallet: ${walletAddress}`);
//       console.log(`🔗 Transaction Hash: ${transactionHash}`);
//       console.log(`🎫 Token IDs: ${tokenIds.join(", ")}`);

//       toast.success(`Successfully claimed ${tokenIds.length} NFT${tokenIds.length > 1 ? 's' : ''}!`);
      
//       return {
//         success: true,
//         tokenIds,
//         transactionHash
//       };

//     } catch (error: any) {
//       console.error("❌ NFT claiming failed:", error);
      
//       let errorMessage = "Failed to claim NFT. Please try again.";
//       if (error.message?.includes("insufficient funds")) {
//         errorMessage = "Insufficient funds for gas fees.";
//       } else if (error.message?.includes("user rejected")) {
//         errorMessage = "Transaction was rejected.";
//       } else if (error.message?.includes("network")) {
//         errorMessage = "Network error. Please check your connection.";
//       }
      
//       toast.error(errorMessage);
//       return { success: false, error: errorMessage };
//     }
//   }

//   /**
//    * Get user's blockchain NFTs (already minted on-chain)
//    */
//   async getUserNFTs(walletAddress: string): Promise<NFTMetadata[]> {
//     try {
//       console.log("🔍 Fetching user's blockchain NFTs from Polygon Amoy...");
      
//       const nftCollection = await this.sdk.getContract(THIRDWEB_CONFIG.contracts.nftDrop);
//       const ownedNFTs = await nftCollection.erc721.getOwned(walletAddress);
      
//       console.log(`📦 Found ${ownedNFTs.length} blockchain NFTs for wallet: ${walletAddress}`);
      
//       return ownedNFTs.map((nft) => ({
//         id: String(nft.metadata.id ?? nft.metadata.name ?? "unknown"),
//         name: String(nft.metadata.name ?? `NEFTIT NFT #${nft.metadata.id}`),
//         description: nft.metadata.description || "NEFTIT Platform NFT",
//         image: nft.metadata.image || "",
//         rarity: this.extractRarityFromMetadata(nft.metadata),
//         attributes: this.normalizeAttributes(nft.metadata?.attributes || []),
//         seller_fee_basis_points: (() => {
//           const value = nft.metadata?.seller_fee_basis_points;
//           if (typeof value === 'string') {
//             const parsed = parseInt(value);
//             return isNaN(parsed) ? 300 : parsed;
//           }
//           return typeof value === 'number' ? value : 300;
//         })() as number
//       }));
//     } catch (error) {
//       console.error("Failed to fetch blockchain NFTs:", error);
//       return [];
//     }
//   }

//   /**
//    * Get user's off-chain IPFS NFTs (available for claiming)
//    */
//   async getUserIPFSNFTs(walletAddress: string): Promise<NFTMetadata[]> {
//     try {
//       console.log("🔍 Step 1: Fetching user's off-chain IPFS NFTs...");
      
//       // First check user data status to ensure proper authentication context
//       const status = await this.enhancedIPFSBurnService.getUserDataStatus(walletAddress);
//       console.log('User data status:', status);
      
//       // Use the enhancedIPFSBurnService to get NFTs (it handles authentication properly)
//       const nfts = await this.enhancedIPFSBurnService.getUserNFTs(walletAddress);
      
//       if (!nfts || nfts.length === 0) {
//         console.log("⚠️ No IPFS NFTs found for wallet:", walletAddress);
//         return [];
//       }

//       console.log(`📦 Found ${nfts.length} IPFS NFTs for claiming`);
      
//       // Convert to NFTMetadata format expected by ThirdwebNFTService
//       const nftMetadata: NFTMetadata[] = nfts.map((nft, index) => ({
//         id: nft.id || `ipfs_nft_${index}`,
//         name: nft.name || `IPFS NFT #${index + 1}`,
//         description: nft.description || "NFT stored on IPFS",
//         image: nft.image || "",
//         rarity: nft.rarity || "common",
//         attributes: nft.attributes || {},
//         seller_fee_basis_points: (() => {
//           const value = (nft as any).seller_fee_basis_points;
//           if (typeof value === 'string') {
//             const parsed = parseInt(value);
//             return isNaN(parsed) ? 300 : parsed;
//           }
//           return typeof value === 'number' ? value : 300;
//         })() as number
//       }));
      
//       return nftMetadata;
      
//     } catch (error) {
//       console.error("❌ Error fetching user IPFS NFTs:", error);
//       return [];
//     }
//   }

//   private normalizeAttributes(attributes: any): { [key: string]: string } {
//     if (!Array.isArray(attributes)) return {};
    
//     const normalized: { [key: string]: string } = {};
//     attributes.forEach((attr: any) => {
//       if (attr.trait_type && attr.value !== undefined) {
//         normalized[attr.trait_type] = String(attr.value);
//       }
//     });
//     return normalized;
//   }

//   private extractRarityFromMetadata(metadata: any): string {
//     if (!metadata) return "common";
    
//     // Check attributes for rarity
//     if (metadata.attributes && Array.isArray(metadata.attributes)) {
//       const rarityAttr = metadata.attributes.find((attr: any) => 
//         attr.trait_type?.toLowerCase() === 'rarity'
//       );
//       if (rarityAttr) return rarityAttr.value.toLowerCase();
//     }
    
//     // Check direct rarity field
//     if (metadata.rarity) return metadata.rarity.toLowerCase();
    
//     return "common";
//   }

//   isContractConfigured(): boolean {
//     return !!THIRDWEB_CONFIG.contracts.nftDrop;
//   }

//   async getTotalSupply(): Promise<number> {
//     try {
//       if (!this.isContractConfigured()) return 0;
      
//       const nftCollection = await this.sdk.getContract(THIRDWEB_CONFIG.contracts.nftDrop);
//       // Use the correct method to get total supply for ERC721
//       const totalSupply = await nftCollection.erc721.totalCount();
//       return parseInt(totalSupply.toString());
//     } catch (error) {
//       console.error("Failed to get total supply:", error);
//       return 0;
//     }
//   }
// }
