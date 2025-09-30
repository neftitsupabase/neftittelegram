// import ipfsService, { NFTData, IPFSMetadata } from './IPFSService';
// import supabaseIPFSMapping from './SupabaseIPFSMapping';
// import activityTrackingService from './ActivityTrackingService';
// import achievementsService from './AchievementsService';
// import nftCollectionService from './NFTCollectionService';

// interface BurnRule {
//   minRarity: string;
//   maxRarity: string;
//   requiredAmount: number;
//   tier: string;
//   resultingNFT: {
//     rarity: string;
//     tier: string;
//     image: string;
//     name: string;
//   };
// }

// interface UserIPFSData {
//   wallet_address: string;
//   nfts: NFTData[];
//   burn_history: BurnTransaction[];
//   last_updated: string;
// }

// interface BurnTransaction {
//   id: string;
//   wallet_address: string;
//   burned_nft_ids: string[];
//   burned_nft_ipfs_hashes: string[];
//   result_nft_id: string;
//   result_nft_ipfs_hash: string;
//   burn_rule_applied: string;
//   total_burn_value: number;
//   transaction_hash?: string;
//   burn_type: 'offchain' | 'onchain';
//   created_at: string;
// }

// class IPFSBurnService {
//   private cache: Map<string, { data: UserIPFSData; timestamp: number }> = new Map();
//   private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

//   // Updated burn rules as per user requirements
//   private burnRules: BurnRule[] = [
//     {
//       minRarity: "Common",
//       maxRarity: "Common",
//       requiredAmount: 5,
//       tier: "1",
//       resultingNFT: {
//         rarity: "Platinum",
//         tier: "4",
//         image: "/images/3d-rendering-holographic-layering_23-2150491112.avif",
//         name: "Platinum NFT",
//       },
//     },
//     {
//       minRarity: "Rare",
//       maxRarity: "Rare",
//       requiredAmount: 3,
//       tier: "2",
//       resultingNFT: {
//         rarity: "Platinum",
//         tier: "4",
//         image: "/images/3d-rendering-holographic-layering_23-2150491112.avif",
//         name: "Platinum NFT",
//       },
//     },
//     {
//       minRarity: "Legendary",
//       maxRarity: "Legendary",
//       requiredAmount: 2,
//       tier: "3",
//       resultingNFT: {
//         rarity: "Platinum",
//         tier: "4",
//         image: "/images/3d-rendering-holographic-layering_23-2150491112.avif",
//         name: "Platinum NFT",
//       },
//     },
//     {
//       minRarity: "Platinum",
//       maxRarity: "Platinum",
//       requiredAmount: 5,
//       tier: "4",
//       resultingNFT: {
//         rarity: "Silver",
//         tier: "6",
//         image: "/images/3d-rendering-holographic-layering_23-2150491112.avif",
//         name: "Silver NFT",
//       },
//     },
//     {
//       minRarity: "Silver",
//       maxRarity: "Silver",
//       requiredAmount: 5,
//       tier: "6",
//       resultingNFT: {
//         rarity: "Gold",
//         tier: "7",
//         image: "/images/crypto-currency-token-like-bitcoin-visual-design-artwork_796368-21708.avif",
//         name: "Gold NFT",
//       },
//     },
//   ];

//   /**
//    * Get user data from IPFS with caching
//    */
//   private async getUserDataFromIPFS(walletAddress: string): Promise<UserIPFSData> {
//     // Check cache first
//     const cached = this.cache.get(walletAddress);
//     if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
//       return cached.data;
//     }

//     try {
//       // Get user's IPFS hash from Supabase (cross-device persistence)
//       const userDataHash = await supabaseIPFSMapping.getIPFSHash(walletAddress);

//       if (userDataHash) {
//         // Try to retrieve existing user data from IPFS
//         console.log(`Loading user data from IPFS hash: ${userDataHash}`);
//         const userData = await ipfsService.getMetadataFromIPFS(userDataHash) as any as UserIPFSData;

//         // Validate the data structure
//         if (userData && userData.wallet_address === walletAddress) {
//           // Cache the data
//           this.cache.set(walletAddress, { data: userData, timestamp: Date.now() });
//           console.log(`Loaded ${userData.nfts.length} NFTs for wallet ${walletAddress}`);
//           return userData;
//         }
//       }

//       // If no existing data found, create new user data structure
//       console.log(`No existing data found for wallet ${walletAddress}, creating new structure`);
//       const userData: UserIPFSData = {
//         wallet_address: walletAddress,
//         nfts: [],
//         burn_history: [],
//         last_updated: new Date().toISOString()
//       };

//       // Cache the data
//       this.cache.set(walletAddress, { data: userData, timestamp: Date.now() });

//       return userData;
//     } catch (error) {
//       console.error('Error getting user data from IPFS:', error);
//       // Return empty user data structure
//       return {
//         wallet_address: walletAddress,
//         nfts: [],
//         burn_history: [],
//         last_updated: new Date().toISOString()
//       };
//     }
//   }

//   /**
//    * Save user data to IPFS
//    */
//   private async saveUserDataToIPFS(userData: UserIPFSData): Promise<string> {
//     try {
//       userData.last_updated = new Date().toISOString();

//       const ipfsHash = await ipfsService.uploadMetadata(userData as any, `user-data-${userData.wallet_address}`);

//       // Store the IPFS hash in Supabase for cross-device persistence
//       const saved = await supabaseIPFSMapping.saveIPFSHash(userData.wallet_address, ipfsHash);
//       if (!saved) {
//         console.warn('Failed to save IPFS hash to Supabase, but continuing with operation');
//       }

//       console.log(`Saved user data to IPFS hash: ${ipfsHash} for wallet: ${userData.wallet_address}`);

//       // Update cache
//       this.cache.set(userData.wallet_address, { data: userData, timestamp: Date.now() });

//       return ipfsHash;
//     } catch (error) {
//       console.error('Error saving user data to IPFS:', error);
//       throw new Error('Failed to save user data to IPFS');
//     }
//   }

//   /**
//    * Get user's NFTs from IPFS (single source of truth)
//    */
//   async getUserNFTs(walletAddress: string): Promise<NFTData[]> {
//     try {
//       // Get user data from IPFS (which is synced via supabaseIPFSMapping)
//       const userData = await this.getUserDataFromIPFS(walletAddress);

//       console.log(`Loaded ${userData.nfts.length} NFTs for ${walletAddress} from IPFS`);

//       // Sync NFTs to database for leaderboard tracking (if not already synced)
//       try {
//         await this.syncUserNFTsToDatabase(walletAddress, userData.nfts);
//       } catch (syncError) {
//         console.error('Failed to sync NFTs to database:', syncError);
//         // Don't fail the operation if database sync fails
//       }

//       return userData.nfts;
//     } catch (error) {
//       console.error('Error getting user NFTs:', error);
//       return [];
//     }
//   }

//   /**
//    * Sync user's NFT collection to database for leaderboard tracking
//    */
//   private async syncUserNFTsToDatabase(walletAddress: string, nfts: NFTData[]): Promise<void> {
//     try {
//       console.log(`Syncing ${nfts.length} NFTs to database for wallet ${walletAddress}`);

//       // Get current database count to avoid unnecessary syncing
//       const currentCount = await nftCollectionService.getActiveNFTCount(walletAddress);

//       // If database already has NFTs for this wallet, skip full sync
//       if (currentCount > 0) {
//         console.log(`Database already has ${currentCount} NFTs for ${walletAddress}, skipping full sync`);
//         return;
//       }

//       // Sync all NFTs to database
//       const result = await nftCollectionService.syncUserNFTCollection(walletAddress, nfts, 'burn');
//       console.log(`Database sync complete for ${walletAddress}: ${result.synced} synced, ${result.failed} failed`);
//     } catch (error) {
//       console.error('Error syncing user NFTs to database:', error);
//     }
//   }



//   /**
//    * Get burn history for a user
//    */
//   async getBurnHistory(walletAddress: string): Promise<BurnTransaction[]> {
//     try {
//       const userData = await this.getUserDataFromIPFS(walletAddress);
//       return userData.burn_history;
//     } catch (error) {
//       console.error('Error getting burn history:', error);
//       return [];
//     }
//   }

//   /**
//    * Burn NFTs and create a new NFT based on burn rules
//    */
//   async burnNFTsWithIPFS(walletAddress: string, nftIds: string[]): Promise<{ success: boolean; resultNFT?: NFTData; error?: string }> {
//     try {
//       // Get ALL user NFTs (including campaign rewards) to ensure we have the complete collection
//       const allUserNFTs = await this.getUserNFTs(walletAddress);

//       // Find the NFTs to burn from the complete collection
//       const nftsToBurn = allUserNFTs.filter(nft => nftIds.includes(nft.id));

//       if (nftsToBurn.length !== nftIds.length) {
//         const foundIds = nftsToBurn.map(nft => nft.id);
//         const missingIds = nftIds.filter(id => !foundIds.includes(id));
//         console.error(`Missing NFTs for burn: ${missingIds.join(', ')}`);
//         console.error(`Available NFTs: ${allUserNFTs.map(nft => nft.id).join(', ')}`);
//         return { success: false, error: `Some NFTs not found in user collection: ${missingIds.join(', ')}` };
//       }

//       // Get user data for updating (this will be synced with the latest NFTs)
//       const userData = await this.getUserDataFromIPFS(walletAddress);

//       // Group NFTs by rarity
//       const rarityGroups: { [key: string]: NFTData[] } = {};
//       nftsToBurn.forEach(nft => {
//         const rarity = nft.rarity || 'Common';
//         if (!rarityGroups[rarity]) {
//           rarityGroups[rarity] = [];
//         }
//         rarityGroups[rarity].push(nft);
//       });

//       // Find applicable burn rule
//       let applicableBurnRule: BurnRule | null = null;
//       let rarityToUse = '';

//       for (const [rarity, nfts] of Object.entries(rarityGroups)) {
//         const rule = this.burnRules.find(rule =>
//           rule.minRarity === rarity &&
//           rule.maxRarity === rarity &&
//           nfts.length >= rule.requiredAmount
//         );

//         if (rule) {
//           applicableBurnRule = rule;
//           rarityToUse = rarity;
//           break;
//         }
//       }

//       if (!applicableBurnRule) {
//         return { success: false, error: 'No applicable burn rule found for selected NFTs' };
//       }

//       // Create the result NFT
//       const resultNFT: NFTData = {
//         id: `burned-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//         name: applicableBurnRule.resultingNFT.name,
//         description: `Created by burning ${applicableBurnRule.requiredAmount} ${rarityToUse} NFTs`,
//         image: applicableBurnRule.resultingNFT.image,
//         rarity: applicableBurnRule.resultingNFT.rarity,
//         tier: parseInt(applicableBurnRule.resultingNFT.tier),
//         wallet_address: walletAddress,
//         created_at: new Date().toISOString(),
//         attributes: [
//           { trait_type: 'Rarity', value: applicableBurnRule.resultingNFT.rarity },
//           { trait_type: 'Tier', value: applicableBurnRule.resultingNFT.tier },
//           { trait_type: 'Created By', value: 'Burn Process' },
//           { trait_type: 'Burn Date', value: new Date().toISOString().split('T')[0] }
//         ]
//       };

//       // Upload result NFT metadata to IPFS
//       try {
//         const metadata = {
//           name: resultNFT.name,
//           description: resultNFT.description || '',
//           image: resultNFT.image,
//           attributes: resultNFT.attributes || []
//         };
//         resultNFT.ipfs_hash = await ipfsService.uploadMetadata(metadata, `burned-nft-${resultNFT.id}`);
//         resultNFT.metadata_uri = `${ipfsService.getIPFSUrl(resultNFT.ipfs_hash)}`;
//         resultNFT.token_uri = resultNFT.metadata_uri;
//       } catch (error) {
//         console.error('Error uploading result NFT to IPFS:', error);
//         // Continue without IPFS hash for now
//       }

//       // Create burn transaction record
//       const burnTransaction: BurnTransaction = {
//         id: `burn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//         wallet_address: walletAddress,
//         burned_nft_ids: nftIds,
//         burned_nft_ipfs_hashes: nftsToBurn.map(nft => nft.ipfs_hash || ''),
//         result_nft_id: resultNFT.id,
//         result_nft_ipfs_hash: resultNFT.ipfs_hash || '',
//         burn_rule_applied: `${applicableBurnRule.requiredAmount} ${rarityToUse} → 1 ${applicableBurnRule.resultingNFT.rarity}`,
//         total_burn_value: nftsToBurn.length,
//         burn_type: 'offchain',
//         created_at: new Date().toISOString()
//       };

//       // Update user data - remove burned NFTs and add result NFT
//       userData.nfts = userData.nfts.filter(nft => !nftIds.includes(nft.id)); // Remove burned NFTs
//       userData.nfts.push(resultNFT); // Add result NFT
//       userData.burn_history.push(burnTransaction); // Add burn transaction
//       userData.last_updated = new Date().toISOString();

//       // Save updated user data to IPFS (single source of truth)
//       await this.saveUserDataToIPFS(userData);

//       // Sync NFT data to database for leaderboard tracking
//       try {
//         console.log('Syncing NFT data to database for leaderboard...');

//         // Mark burned NFTs as inactive in database
//         const markedCount = await nftCollectionService.markNFTsAsBurned(nftIds, burnTransaction.id);
//         console.log(`Marked ${markedCount} NFTs as burned in database`);

//         // Add the new result NFT to database
//         const syncSuccess = await nftCollectionService.syncNFTFromBurn(resultNFT, 'burn');
//         if (syncSuccess) {
//           console.log(`Successfully synced new NFT ${resultNFT.id} to database`);
//         } else {
//           console.error(`Failed to sync new NFT ${resultNFT.id} to database`);
//         }
//       } catch (syncError) {
//         console.error('Failed to sync NFT data to database:', syncError);
//         // Don't fail the burn operation if database sync fails
//       }

//       // Log burn activity
//       try {
//         const activityId = await activityTrackingService.logActivity(walletAddress, {
//           activityType: 'burn',
//           title: `Burned ${nftIds.length} NFTs`,
//           description: `Burned ${nftIds.length} ${rarityToUse} NFTs to create ${resultNFT.rarity} NFT`,
//           details: `Created: ${resultNFT.name}`,
//           metadata: {
//             burned_nft_count: nftIds.length,
//             burned_rarity: rarityToUse,
//             result_nft_id: resultNFT.id,
//             result_rarity: resultNFT.rarity,
//             burn_rule: burnTransaction.burn_rule_applied
//           }
//         });
//         console.log('Burn activity logged successfully:', activityId);
//       } catch (activityError) {
//         console.error('Failed to log burn activity:', activityError);
//         // Don't fail the burn operation if activity logging fails
//       }

//       // Update burn achievements
//       try {
//         console.log('Updating burn achievements...');
//         await achievementsService.updateBurnAchievements(walletAddress, nftIds.length);
//         console.log('Burn achievements updated successfully');
//       } catch (achievementError) {
//         console.error('Failed to update burn achievements:', achievementError);
//         // Don't fail the burn operation if achievement update fails
//       }

//       console.log(`Successfully burned ${nftIds.length} NFTs for wallet ${walletAddress}, created ${resultNFT.rarity} NFT`);

//       return { success: true, resultNFT };

//     } catch (error) {
//       console.error('Error burning NFTs:', error);
//       return { success: false, error: 'Failed to burn NFTs' };
//     }
//   }

//   /**
//    * Get burn rules
//    */
//   getBurnRules(): BurnRule[] {
//     return this.burnRules;
//   }

//   /**
//    * Check if IPFS service is configured
//    */
//   isIPFSConfigured(): boolean {
//     return ipfsService.isConfigured();
//   }

//   /**
//    * Clear user data from Supabase and cache (for debugging/reset)
//    */
//   async clearUserData(walletAddress: string): Promise<void> {
//     try {
//       await supabaseIPFSMapping.deleteMapping(walletAddress);
//       this.cache.delete(walletAddress);
//       console.log(`Cleared user data for wallet: ${walletAddress}`);
//     } catch (error) {
//       console.error('Error clearing user data:', error);
//     }
//   }

//   /**
//    * Get user data status for debugging
//    */
//   async getUserDataStatus(walletAddress: string): Promise<{ hasSupabaseMapping: boolean; hasCached: boolean; supabaseHash?: string }> {
//     try {
//       const supabaseHash = await supabaseIPFSMapping.getIPFSHash(walletAddress);
//       const hasCached = this.cache.has(walletAddress);

//       return {
//         hasSupabaseMapping: !!supabaseHash,
//         hasCached,
//         supabaseHash: supabaseHash || undefined
//       };
//     } catch (error) {
//       console.error('Error getting user data status:', error);
//       return {
//         hasSupabaseMapping: false,
//         hasCached: this.cache.has(walletAddress)
//       };
//     }
//   }
// }

// export const ipfsBurnService = new IPFSBurnService();
// export default ipfsBurnService;
