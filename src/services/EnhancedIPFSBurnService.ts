// import hybridIPFSService, { NFTData, IPFSMetadata } from './HybridIPFSService';
// import supabaseIPFSMapping from './SupabaseIPFSMapping';
// import activityTrackingService from './ActivityTrackingService';
// import achievementsService from './AchievementsService';
// import nftCollectionService from './NFTCollectionService';

// // Extended NFTData with staking status for burn page
// export interface NFTDataWithStaking extends NFTData {
//   isStaked: boolean;
// }

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
//   burn_transactions: BurnTransaction[];
//   last_updated: string;
//   storage_info: {
//     primary_hash: string;
//     pinata_hash?: string;
//     storage_provider: 'pinata';
//   };
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
//   storage_info?: {
//     primary_hash: string;
//     storage_provider: string;
//   };
// }

// class EnhancedIPFSBurnService {
//   private cache: Map<string, { data: UserIPFSData; timestamp: number }> = new Map();
//   private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

//   // Low-egress paging configuration
//   private readonly PAGE_SIZE = 50;

//   // Index and Page structures for paginated storage
//   private async getUserIndex(walletAddress: string): Promise<{
//     index: { wallet_address: string; pages: string[]; created_at: string; last_updated: string; version: number } | null;
//     indexHash: string | null;
//   }> {
//     const indexHash = await supabaseIPFSMapping.getIPFSHash(walletAddress);
//     if (!indexHash) return { index: null, indexHash: null };
//     try {
//       const data = await hybridIPFSService.getContentFromIPFS(indexHash) as any;
      
//       // Check if it's already an index format
//       if (data && data.wallet_address === walletAddress && Array.isArray(data.pages)) {
//         return { index: data, indexHash };
//       }
      
//       // Check if it's direct user data format - convert to index format
//       if (data && data.wallet_address === walletAddress && Array.isArray(data.nfts)) {
//         console.log('Converting direct user data to index format');
        
//         // Create a page with the NFTs
//         const pageData = {
//           wallet_address: walletAddress,
//           page_number: 1,
//           nfts: data.nfts,
//           created_at: data.last_updated || new Date().toISOString(),
//           last_updated: data.last_updated || new Date().toISOString()
//         };
        
//         // Upload the page to IPFS
//         const pageUpload = await hybridIPFSService.uploadUserData(pageData, `user-nfts-${walletAddress}-page-1`);
//         const pageHash = pageUpload.primary_hash;
        
//         // Create index pointing to the page
//         const index = {
//           wallet_address: walletAddress,
//           pages: [pageHash],
//           created_at: data.last_updated || new Date().toISOString(),
//           last_updated: new Date().toISOString(),
//           version: 1
//         };
        
//         // Upload new index and update mapping
//         const indexUpload = await hybridIPFSService.uploadUserData(index, `user-nfts-${walletAddress}-index`);
//         const newIndexHash = indexUpload.primary_hash;
//         await supabaseIPFSMapping.saveIPFSHash(walletAddress, newIndexHash);
        
//         return { index, indexHash: newIndexHash };
//       }
      
//     } catch (e) {
//       console.warn('Failed to load user index from IPFS, will treat as missing', e);
//     }
//     return { index: null, indexHash: null };
//   }

//   private async createNewIndex(walletAddress: string): Promise<{ index: { wallet_address: string; pages: string[]; created_at: string; last_updated: string; version: number }; indexHash: string }> {
//     // Create first empty page
//     const firstPage = {
//       wallet_address: walletAddress,
//       page_number: 1,
//       nfts: [] as NFTData[],
//       created_at: new Date().toISOString(),
//       last_updated: new Date().toISOString()
//     };
//     const firstPageUpload = await hybridIPFSService.uploadUserData(firstPage, `user-nfts-${walletAddress}-page-1`);
//     const firstPageHash = firstPageUpload.primary_hash;

//     // Create index referencing the first page
//     const index = {
//       wallet_address: walletAddress,
//       pages: [firstPageHash],
//       created_at: new Date().toISOString(),
//       last_updated: new Date().toISOString(),
//       version: 1
//     };

//     const indexUpload = await hybridIPFSService.uploadUserData(index, `user-nfts-${walletAddress}-index`);
//     const indexHash = indexUpload.primary_hash;
//     await supabaseIPFSMapping.saveIPFSHash(walletAddress, indexHash);
//     return { index, indexHash };
//   }

//   private async saveIndex(walletAddress: string, index: { wallet_address: string; pages: string[]; created_at: string; last_updated: string; version: number }): Promise<string> {
//     index.last_updated = new Date().toISOString();
//     const upload = await hybridIPFSService.uploadUserData(index, `user-nfts-${walletAddress}-index`);
//     const newHash = upload.primary_hash;
//     await supabaseIPFSMapping.saveIPFSHash(walletAddress, newHash);
//     return newHash;
//   }

//   private async loadPage(pageHash: string): Promise<{ wallet_address: string; page_number: number; nfts: NFTData[]; created_at: string; last_updated: string }> {
//     const page = await hybridIPFSService.getContentFromIPFS(pageHash) as any;
//     return page;
//   }

//   private async savePage(walletAddress: string, pageNumber: number, page: { wallet_address: string; page_number: number; nfts: NFTData[]; created_at: string; last_updated: string }): Promise<string> {
//     page.last_updated = new Date().toISOString();
//     const upload = await hybridIPFSService.uploadUserData(page, `user-nfts-${walletAddress}-page-${pageNumber}`);
//     return upload.primary_hash;
//   }

//   private async appendNFTToPages(walletAddress: string, nftData: NFTData): Promise<boolean> {
//     // Ensure index exists
//     let { index } = await this.getUserIndex(walletAddress);
//     if (!index) {
//       const created = await this.createNewIndex(walletAddress);
//       index = created.index;
//     }

//     // Load last page
//     const lastPageHash = index.pages[index.pages.length - 1];
//     let lastPage = await this.loadPage(lastPageHash);

//     // If last page is full, create a new page
//     if (lastPage.nfts.length >= this.PAGE_SIZE) {
//       const newPageNumber = lastPage.page_number + 1;
//       const newPage = {
//         wallet_address: walletAddress,
//         page_number: newPageNumber,
//         nfts: [nftData],
//         created_at: new Date().toISOString(),
//         last_updated: new Date().toISOString()
//       };
//       const newPageHash = await this.savePage(walletAddress, newPageNumber, newPage);
//       index.pages.push(newPageHash);
//       await this.saveIndex(walletAddress, index);
//       return true;
//     }

//     // Append to last page
//     lastPage.nfts.push(nftData);
//     const updatedLastPageHash = await this.savePage(walletAddress, lastPage.page_number, lastPage);
//     // Replace hash in index
//     index.pages[index.pages.length - 1] = updatedLastPageHash;
//     await this.saveIndex(walletAddress, index);
//     return true;
//   }

//   private async removeNFTsFromPages(walletAddress: string, nftIds: string[]): Promise<number> {
//     const { index } = await this.getUserIndex(walletAddress);
//     if (!index) return 0;
//     let removed = 0;

//     for (let i = 0; i < index.pages.length; i++) {
//       const pageHash = index.pages[i];
//       let page = await this.loadPage(pageHash);
//       const before = page.nfts.length;
//       page.nfts = page.nfts.filter(n => !nftIds.includes(n.id));
//       const after = page.nfts.length;
//       if (after !== before) {
//         removed += (before - after);
//         const newPageHash = await this.savePage(walletAddress, page.page_number, page);
//         index.pages[i] = newPageHash;
//       }
//     }
//     if (removed > 0) await this.saveIndex(walletAddress, index);
//     return removed;
//   }

//   // Updated burn rules with new NFT images
//   private burnRules: BurnRule[] = [
//     {
//       minRarity: "Common",
//       maxRarity: "Common",
//       requiredAmount: 5,
//       tier: "1",
//       resultingNFT: {
//         rarity: "Platinum",
//         tier: "4",
//         image: "/images/Platinum.jpg",
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
//         image: "/images/Platinum.jpg",
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
//         image: "/images/Platinum.jpg",
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
//         image: "/images/Silver.jpg",
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
//         image: "/images/Gold.jpg",
//         name: "Gold NFT",
//       },
//     },
//   ];

//   /**
//    * Get user data from IPFS using Pinata storage
//    */
//   private async getUserDataFromIPFS(walletAddress: string): Promise<UserIPFSData> {
//     // Check cache first
//     const cached = this.cache.get(walletAddress);
//     if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
//       return cached.data;
//     }

//     try {
//       // Get user's IPFS hash from Supabase (cross-device persistence)
//       const mappingData = await supabaseIPFSMapping.getIPFSHash(walletAddress);

//       if (mappingData) {
//         console.log(`Loading user data from IPFS using Pinata for: ${walletAddress}`);
        
//         // Try to retrieve existing user data from IPFS using Pinata service
//         const userData = await hybridIPFSService.getContentFromIPFS(mappingData) as UserIPFSData;

//         // Validate the data structure
//         if (userData && userData.wallet_address === walletAddress) {
//           // Cache the data
//           this.cache.set(walletAddress, { data: userData, timestamp: Date.now() });
//           console.log(`Loaded ${userData.nfts.length} NFTs for wallet ${walletAddress} via Pinata storage`);
//           return userData;
//         }
//       }

//       // If no existing data found, create new user data structure
//       console.log(`No existing data found for wallet ${walletAddress}, creating new structure`);
//       const userData: UserIPFSData = {
//         wallet_address: walletAddress,
//         nfts: [],
//         burn_transactions: [],
//         last_updated: new Date().toISOString(),
//         storage_info: {
//           primary_hash: '',
//           storage_provider: 'pinata'
//         }
//       };

//       // Cache the data
//       this.cache.set(walletAddress, { data: userData, timestamp: Date.now() });

//       return userData;
//     } catch (error) {
//       console.error('Error getting user data from hybrid IPFS:', error);
//       // Return empty user data structure
//       return {
//         wallet_address: walletAddress,
//         nfts: [],
//         burn_transactions: [],
//         last_updated: new Date().toISOString(),
//         storage_info: {
//           primary_hash: '',
//           storage_provider: 'pinata'
//         }
//       };
//     }
//   }

//   /**
//    * Save user data to IPFS using Pinata storage
//    */
//   private async saveUserDataToIPFS(userData: UserIPFSData): Promise<string> {
//     try {
//       userData.last_updated = new Date().toISOString();

//       // Upload user data using Pinata
//       const storageResult = await hybridIPFSService.uploadUserData(userData, userData.wallet_address);

//       // Update storage info in user data
//       const ipfsData = {
//         primary_hash: storageResult.primary_hash,
//         pinata_hash: storageResult.pinata_hash,
//         storage_provider: storageResult.storage_provider
//       };

//       // Store the primary IPFS hash in Supabase for cross-device persistence
//       const saved = await supabaseIPFSMapping.saveIPFSHash(userData.wallet_address, storageResult.primary_hash);
//       if (!saved) {
//         console.warn('Failed to save IPFS hash to Supabase, but continuing with operation');
//       }

//       console.log(`Saved user data via Pinata:`, {
//         wallet: userData.wallet_address,
//         primary: storageResult.primary_hash,
//         provider: storageResult.storage_provider
//       });

//       // Update cache
//       this.cache.set(userData.wallet_address, { data: userData, timestamp: Date.now() });

//       return storageResult.primary_hash;
//     } catch (error) {
//       console.error('Error saving user data to hybrid IPFS:', error);
//       throw new Error('Failed to save user data to hybrid IPFS storage');
//     }
//   }

//   /**
//    * Get user's NFTs from IPFS with enhanced error handling and staking status
//    */
//   async getUserNFTs(walletAddress: string): Promise<NFTData[]> {
//     try {
//       // Get user data hash from Supabase mapping
//       const userDataHash = await supabaseIPFSMapping.getIPFSHash(walletAddress);
//       if (!userDataHash) {
//         console.log('No user data found for wallet:', walletAddress);
//         return [];
//       }

//       const userData = await hybridIPFSService.getContentFromIPFS(userDataHash);
//       console.log('🔍 DEBUG: Raw user data structure:', userData);
      
//       // Check if this is paginated storage (index format)
//       if (userData && userData.pages && Array.isArray(userData.pages)) {
//         console.log('📄 Detected paginated storage, using getUserNFTsFromPaginatedStorage');
//         return this.getUserNFTsFromPaginatedStorage(walletAddress);
//       }
      
//       // Check for direct NFTs array
//       if (!userData || !userData.nfts) {
//         console.log('No NFTs found in user data, trying paginated storage as fallback');
//         return this.getUserNFTsFromPaginatedStorage(walletAddress);
//       }

//       console.log(`Found ${userData.nfts.length} NFTs for user`);
//       return userData.nfts;
//     } catch (error) {
//       console.error('Error getting user NFTs:', error);
//       // Try paginated storage as final fallback
//       try {
//         console.log('Trying paginated storage as error fallback');
//         return this.getUserNFTsFromPaginatedStorage(walletAddress);
//       } catch (fallbackError) {
//         console.error('Paginated storage fallback also failed:', fallbackError);
//         return [];
//       }
//     }
//   }

//   // Get user's NFTs with staking status for burn page
//   async getUserNFTsWithStakingStatus(walletAddress: string): Promise<NFTDataWithStaking[]> {
//     try {
//       console.log(`🔄 Loading NFTs with staking status for: ${walletAddress}`);
      
//       // Get base NFTs from IPFS first
//       const nfts = await this.getUserNFTs(walletAddress);
//       console.log(`📦 Base NFTs loaded: ${nfts.length}`);
      
//       if (nfts.length === 0) {
//         console.log('⚠️ No base NFTs found, returning empty array');
//         return [];
//       }
      
//       try {
//         // Import staking service dynamically to avoid circular dependency
//         const { default: offChainStakingService } = await import('./EnhancedStakingService');
//         console.log('✅ Staking service imported successfully');
        
//         // Get staked NFTs from staking service
//         const stakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
//         console.log(`🎯 Staked NFTs from service: ${stakedNFTs.length}`, stakedNFTs);
        
//         const stakedNFTIds = new Set(stakedNFTs.map(stakedNFT => stakedNFT.nft_id));
        
//         console.log(`🔍 Staking status check: ${stakedNFTIds.size} NFTs are currently staked`);
//         console.log(`🆔 Staked NFT IDs:`, Array.from(stakedNFTIds));
        
//         // Add staking status to each NFT
//         const nftsWithStakingStatus = nfts.map(nft => ({
//           ...nft,
//           isStaked: stakedNFTIds.has(nft.id)
//         }));
        
//         const stakedCount = nftsWithStakingStatus.filter(nft => nft.isStaked).length;
//         console.log(`✅ Added staking status: ${stakedCount}/${nfts.length} NFTs are staked`);
        
//         return nftsWithStakingStatus;
//       } catch (stakingError) {
//         console.warn('⚠️ Failed to get staking status, returning NFTs without staking info:', stakingError);
//         // Return NFTs without staking status if staking service fails
//         return nfts.map(nft => ({ ...nft, isStaked: false }));
//       }
//     } catch (error) {
//       console.error('❌ Error getting NFTs with staking status:', error);
//       // Final fallback to regular NFTs without staking status
//       try {
//         const fallbackNFTs = await this.getUserNFTs(walletAddress);
//         return fallbackNFTs.map(nft => ({ ...nft, isStaked: false }));
//       } catch (fallbackError) {
//         console.error('❌ Fallback also failed:', fallbackError);
//         return [];
//       }
//     }
//   }

//   /**
//    * Get user's NFTs from paginated IPFS storage (index + pages)
//    */
//   async getUserNFTsFromPaginatedStorage(walletAddress: string): Promise<NFTData[]> {
//     try {
//       const { index } = await this.getUserIndex(walletAddress);
//       if (!index) {
//         console.log(`No index found for ${walletAddress}, returning empty NFT list`);
//         return [];
//       }

//       // Load all pages in parallel
//       const pages = await Promise.all(index.pages.map(h => this.loadPage(h)));
//       const nfts = pages.flatMap(p => p.nfts || []);

//       console.log(`Loaded ${nfts.length} NFTs for ${walletAddress} from paginated IPFS storage`);

//       // Optional: sync to DB
//       try {
//         await this.syncUserNFTsToDatabase(walletAddress, nfts);
//       } catch (syncError) {
//         console.error('Failed to sync NFTs to database:', syncError);
//       }

//       return nfts;
//     } catch (error) {
//       console.error('Error getting user NFTs from paginated storage:', error);
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
//    * Add NFT to user's collection using paginated storage
//    */
//   async addNFTToUserCollection(walletAddress: string, nftData: NFTData): Promise<boolean> {
//     try {
//       console.log(`Adding NFT to user collection (paged): ${walletAddress}`, nftData.id);
//       // Ensure no duplicate: remove same id before append
//       await this.removeNFTsFromPages(walletAddress, [nftData.id]);
//       await this.appendNFTToPages(walletAddress, nftData);
//       console.log(`Successfully added NFT (paged): ${nftData.id}`);
//       return true;
//     } catch (error) {
//       console.error('Error adding NFT (paged):', error);
//       return false;
//     }
//   }

//   /**
//    * Remove NFT from user's collection using paginated storage
//    */
//   async removeNFTFromUserCollection(walletAddress: string, nftId: string): Promise<boolean> {
//     try {
//       const removed = await this.removeNFTsFromPages(walletAddress, [nftId]);
//       if (removed === 0) {
//         console.warn(`NFT ${nftId} not found in user collection`);
//         return false;
//       }
//       console.log(`Successfully removed NFT (paged): ${nftId}`);
//       return true;
//     } catch (error) {
//       console.error('Error removing NFT (paged):', error);
//       return false;
//     }
//   }

//   /**
//    * Get burn history for a user
//    */
//   async getBurnHistory(walletAddress: string): Promise<BurnTransaction[]> {
//     try {
//       const userData = await this.getUserDataFromIPFS(walletAddress);
//       return userData.burn_transactions;
//     } catch (error) {
//       console.error('Error getting burn history from Pinata storage:', error);
//       return [];
//     }
//   }

//   /**
//    * Burn NFTs and create a new NFT using Pinata storage
//    */
//   async burnNFTsWithHybridIPFS(walletAddress: string, nftIds: string[]): Promise<{ success: boolean; resultNFT?: NFTData; error?: string }> {
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

//       // Enhanced burn validation with detailed logging
//       const validation = this.validateBurnRules(nftsToBurn);
      
//       if (!validation.isValid) {
//         return { success: false, error: validation.error || 'Invalid burn combination' };
//       }

//       const applicableBurnRule = validation.applicableRule!;
//       const rarityToUse = validation.rarityToUse!;
      
//       console.log(`🔥 Burn validation passed: ${validation.validationDetails}`);

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

//       // Upload result NFT metadata to hybrid IPFS storage
//       try {
//         const metadata: IPFSMetadata = {
//           name: resultNFT.name,
//           description: resultNFT.description || '',
//           image: resultNFT.image,
//           attributes: resultNFT.attributes || []
//         };
        
//         const metadataResult = await hybridIPFSService.uploadNFTMetadata(metadata, `burned-nft-${resultNFT.id}`);
        
//         resultNFT.ipfs_hash = metadataResult.primary_hash;
//         resultNFT.pinata_hash = metadataResult.pinata_hash;
//         resultNFT.metadata_uri = hybridIPFSService.getIPFSUrl(metadataResult.primary_hash);
//         resultNFT.token_uri = resultNFT.metadata_uri;
        
//         console.log(`Result NFT metadata uploaded via Pinata:`, {
//           id: resultNFT.id,
//           primary_hash: metadataResult.primary_hash,
//           pinata_hash: metadataResult.pinata_hash,
//           metadata_uri: resultNFT.metadata_uri
//         });
//       } catch (error) {
//         console.error('Error uploading result NFT to hybrid IPFS:', error);
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

//       // Upload burn transaction to Pinata storage for permanent record
//       try {
//         const burnResult = await hybridIPFSService.uploadBurnRecord(burnTransaction, burnTransaction.id);
//         burnTransaction.storage_info = {
//           primary_hash: burnResult.primary_hash,
//           storage_provider: burnResult.storage_provider
//         };
//         console.log(`Burn transaction uploaded via Pinata storage:`, burnResult);
//       } catch (error) {
//         console.error('Error uploading burn transaction to Pinata IPFS:', error);
//       }

//       // CRITICAL: Delete burned NFT metadata from IPFS before updating user data
//       console.log('Starting cleanup of burned NFT metadata from IPFS...');
//       const cleanupResult = await this.cleanupBurnedNFTsFromIPFS(nftsToBurn);
//       console.log('Burned NFT cleanup result:', cleanupResult);

//       // Update user data using paginated storage - remove burned NFTs and add result NFT
//       try {
//         await this.removeNFTFromUserCollection(walletAddress, nftIds[0]);
//         if (nftIds.length > 1) {
//           await this.removeNFTsFromPages(walletAddress, nftIds.slice(1));
//         }
//         await this.addNFTToUserCollection(walletAddress, resultNFT);
//         console.log('Successfully updated user NFT collection');
//       } catch (collectionError) {
//         console.error('Failed to update user collection, but burn succeeded:', collectionError);
//         // Don't fail the burn operation if collection update fails - the burn itself succeeded
//       }

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
//             burn_rule: burnTransaction.burn_rule_applied,
//             storage_provider: burnTransaction.storage_info?.storage_provider || 'hybrid'
//           }
//         });
//         console.log('Burn activity logged successfully:', activityId);
//       } catch (activityError) {
//         console.error('Failed to log burn activity:', activityError);
//         // Don't fail the burn operation if activity logging fails
//       }

//       // Update burn achievements with proper progression tracking
//       try {
//         console.log('🔥 Updating burn achievements with proper progression...');
        
//         // Get current user burn count to determine if this is first burn
//         const currentBurnHistory = await this.getBurnHistory(walletAddress);
//         const isFirstBurn = currentBurnHistory.length === 0;
        
//         if (isFirstBurn) {
//           // Track first burn achievement
//           await achievementsService.updateBurnAchievements(walletAddress, 'first', nftIds.length);
//           console.log('✅ First burn achievement updated');
//         }
        
//         // Always track ALL burn achievements for proper progression
//         // This ensures burn_enthusiast and burn_master show as in_progress after first burn
//         await achievementsService.updateBurnAchievements(walletAddress, 'all', nftIds.length);
//         console.log('✅ All burn achievements updated for progression tracking');
        
//       } catch (achievementError) {
//         console.error('❌ Failed to update burn achievements:', achievementError);
//         // Don't fail the burn operation if achievement update fails
//       }

//       console.log(`Successfully burned ${nftIds.length} NFTs for wallet ${walletAddress} via Pinata storage, created ${resultNFT.rarity} NFT`);

//       return { success: true, resultNFT };

//     } catch (error) {
//       console.error('Error burning NFTs via Pinata storage:', error);
//       return { success: false, error: 'Failed to burn NFTs via Pinata storage' };
//     }
//   }

//   /**
//    * Get burn rules
//    */
//   getBurnRules(): BurnRule[] {
//     return this.burnRules;
//   }

//   /**
//    * Check if IPFS is configured
//    */
//   isIPFSConfigured(): boolean {
//     return hybridIPFSService.isConfigured();
//   }

//   /**
//    * Get IPFS configuration status
//    */
//   getIPFSConfigurationStatus(): {
//     pinata: boolean;
//     supabaseMapping: boolean;
//   } {
//     return hybridIPFSService.getConfigurationStatus();
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
//    * Clean up burned NFT metadata and images from IPFS storage providers
//    * Completely removes all burned NFT data from Pinata and user collection
//    */
//   private async cleanupBurnedNFTsFromIPFS(nftsToBurn: NFTData[]): Promise<{
//     totalProcessed: number;
//     pinataDeleted: number;
//     metadataDeleted: number;
//     imagesDeleted: number;
//     errors: string[];
//     cleanupSummary: string;
//   }> {
//     const result = {
//       totalProcessed: 0,
//       pinataDeleted: 0,
//       metadataDeleted: 0,
//       imagesDeleted: 0,
//       errors: [],
//       cleanupSummary: ''
//     };

//     console.log(`🔥 Starting complete deletion of ${nftsToBurn.length} burned NFTs from IPFS and user collection...`);

//     for (const nft of nftsToBurn) {
//       try {
//         result.totalProcessed++;
//         console.log(`🗑️ Deleting NFT ${nft.id} completely from IPFS...`);

//         // Delete NFT metadata from Pinata if hash exists
//         if (nft.ipfs_hash) {
//           try {
//             await hybridIPFSService.unpinFromPinata(nft.ipfs_hash);
//             result.metadataDeleted++;
//             console.log(`✅ Deleted metadata hash ${nft.ipfs_hash} from Pinata`);
//           } catch (error) {
//             console.warn(`⚠️ Could not delete metadata ${nft.ipfs_hash} from Pinata:`, error);
//           }
//         }

//         // Delete NFT image from Pinata if separate image hash exists
//         if (nft.pinata_hash && nft.pinata_hash !== nft.ipfs_hash) {
//           try {
//             await hybridIPFSService.unpinFromPinata(nft.pinata_hash);
//             result.imagesDeleted++;
//             console.log(`✅ Deleted image hash ${nft.pinata_hash} from Pinata`);
//           } catch (error) {
//             console.warn(`⚠️ Could not delete image ${nft.pinata_hash} from Pinata:`, error);
//           }
//         }

//         // Delete additional storage hash if exists
//         if (nft.pinata_hash && nft.pinata_hash !== nft.ipfs_hash) {
//           try {
//             await hybridIPFSService.unpinFromPinata(nft.pinata_hash);
//             console.log(`✅ Deleted additional hash ${nft.pinata_hash} from Pinata`);
//           } catch (error) {
//             console.warn(`⚠️ Could not delete additional hash ${nft.pinata_hash} from Pinata:`, error);
//           }
//         }

//         result.pinataDeleted++;
//         console.log(`🔥 NFT ${nft.id} completely removed from IPFS storage`);

//       } catch (error) {
//         const errorMsg = `Failed to completely delete NFT ${nft.id}: ${error}`;
//         result.errors.push(errorMsg);
//         console.error(errorMsg);
//       }
//     }

//     result.cleanupSummary = `Completely deleted ${result.totalProcessed} NFTs: ${result.metadataDeleted} metadata files, ${result.imagesDeleted} image files removed from Pinata`;
//     console.log(`🧹 Complete cleanup finished: ${result.cleanupSummary}`);

//     return result;
//   }

//   /**
//    * Enhanced burn validation with proper rarity grouping
//    */
//   private validateBurnRules(nftsToBurn: NFTData[]): {
//     isValid: boolean;
//     applicableRule?: BurnRule;
//     rarityToUse?: string;
//     error?: string;
//     validationDetails: string;
//   } {
//     // Group NFTs by rarity for validation
//     const rarityGroups: { [key: string]: NFTData[] } = {};
//     nftsToBurn.forEach(nft => {
//       // Normalize rarity to match burn rules format (capitalize first letter)
//       const normalizedRarity = (nft.rarity || 'Common').charAt(0).toUpperCase() + (nft.rarity || 'Common').slice(1).toLowerCase();
//       if (!rarityGroups[normalizedRarity]) {
//         rarityGroups[normalizedRarity] = [];
//       }
//       rarityGroups[normalizedRarity].push(nft);
//     });

//     console.log('Burn validation - Rarity groups:', Object.entries(rarityGroups).map(([rarity, nfts]) => `${rarity}: ${nfts.length}`));

//     // Check each rarity group against burn rules
//     for (const [rarity, nfts] of Object.entries(rarityGroups)) {
//       const rule = this.burnRules.find(rule =>
//         rule.minRarity === rarity &&
//         rule.maxRarity === rarity &&
//         nfts.length >= rule.requiredAmount
//       );

//       if (rule) {
//         const validationDetails = `✓ Valid burn: ${nfts.length} ${rarity} NFTs (need ${rule.requiredAmount}) → 1 ${rule.resultingNFT.rarity}`;
//         console.log(validationDetails);
        
//         return {
//           isValid: true,
//           applicableRule: rule,
//           rarityToUse: rarity,
//           validationDetails
//         };
//       }
//     }

//     // No valid rule found
//     const availableRarities = Object.entries(rarityGroups).map(([rarity, nfts]) => `${rarity}: ${nfts.length}`).join(', ');
//     const requiredRules = this.burnRules.map(rule => `${rule.requiredAmount} ${rule.minRarity} → 1 ${rule.resultingNFT.rarity}`).join('; ');
    
//     const error = `No applicable burn rule found. Available: ${availableRarities}. Required: ${requiredRules}`;
//     console.error(error);

//     return {
//       isValid: false,
//       error,
//       validationDetails: `❌ Invalid burn combination: ${availableRarities}`
//     };
//   }

//   /**
//    * Get user data status for debugging with Pinata storage info
//    */
//   async getUserDataStatus(walletAddress: string): Promise<{ 
//     hasSupabaseMapping: boolean; 
//     hasCached: boolean; 
//     supabaseHash?: string;
//     storageProvider?: string;
//     hybridStorageStatus: any;
//   }> {
//     try {
//       const supabaseHash = await supabaseIPFSMapping.getIPFSHash(walletAddress);
//       const hasCached = this.cache.has(walletAddress);
//       const hybridStorageStatus = hybridIPFSService.getConfigurationStatus();

//       let storageProvider = 'unknown';
//       if (hasCached) {
//         const cachedData = this.cache.get(walletAddress);
//         storageProvider = cachedData?.data.storage_info?.storage_provider || 'unknown';
//       }

//       return {
//         hasSupabaseMapping: !!supabaseHash,
//         hasCached,
//         supabaseHash: supabaseHash || undefined,
//         storageProvider,
//         hybridStorageStatus
//       };
//     } catch (error) {
//       console.error('Error getting user data status:', error);
//       return {
//         hasSupabaseMapping: false,
//         hasCached: this.cache.has(walletAddress),
//         hybridStorageStatus: hybridIPFSService.getConfigurationStatus()
//       };
//     }
//   }
// }

// export const enhancedIPFSBurnService = new EnhancedIPFSBurnService();
// export default enhancedIPFSBurnService;
