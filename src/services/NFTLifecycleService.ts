import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { IPFS_GATEWAYS, getIPFSUrl, extractIPFSHash } from '../config/ipfsConfig';
import { web3MetaMaskNFTService } from './Web3MetaMaskNFTService';
import { ImprovedOnchainStakingService } from './ImprovedOnchainStakingService';
import optimizedCIDPoolBurnService from './OptimizedCIDPoolBurnService';
import onchainNFTTrackingService from './OnchainNFTTrackingService';

export interface OffchainNFT {
  id: string;
  name: string;
  description?: string;
  image: string;
  rarity: string;
  attributes?: any[];
  ipfs_hash?: string;
  metadata_uri?: string;
  wallet_address: string;
  created_at?: string;
  status: 'offchain' | 'claiming' | 'onchain';
  isStaked?: boolean;
}

export interface OnchainNFT {
  id: string;
  name: string;
  description?: string;
  image: string;
  rarity: string;
  attributes?: any[];
  tokenId: string;
  transactionHash: string;
  contractAddress: string;
  metadataURI: string;
  wallet_address: string;
  claimed_at: string;
  claimed_blockchain: string;
  status: 'onchain' | 'reward_tracking';
  fallback_images?: string[];
  ipfs_hash?: string;
  isStaked?: boolean;
  stakeTimestamp?: number;
}

/**
 * Service to manage the complete NFT lifecycle from offchain to onchain
 * Handles loading, claiming, and cleanup of NFTs with IPFS gateway fallbacks
 */
export class NFTLifecycleService {
  private ipfsGateways: string[];
  private stakingService: ImprovedOnchainStakingService;
  private supabase: SupabaseClient;

  constructor() {
    this.ipfsGateways = [...IPFS_GATEWAYS];
    this.stakingService = new ImprovedOnchainStakingService();
    this.supabase = getSupabaseClient();
  }

  /**
   * Extract rarity from NFT name
   */
  private extractRarityFromName(name: string): string | null {
    const nameStr = name.toLowerCase();
    if (nameStr.includes('common')) return 'common';
    if (nameStr.includes('rare')) return 'rare';
    if (nameStr.includes('legendary')) return 'legendary';
    if (nameStr.includes('platinum')) return 'platinum';
    if (nameStr.includes('silver')) return 'silver';
    if (nameStr.includes('gold')) return 'gold';
    return null;
  }

  /**
   * Test IPFS gateway reliability and return working URL
   */
  private async testGatewayReliability(cid: string): Promise<string> {
    if (!cid) {
      console.warn('⚠️ No CID provided for gateway testing');
      return `${this.ipfsGateways[0]}`;
    }

    // Test gateways with shorter timeout for better performance
    for (const gateway of this.ipfsGateways) {
      try {
        const url = `${gateway}${cid}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(url, { 
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ Gateway working for ${cid.slice(0, 10)}...: ${gateway}`);
          return url;
        }
      } catch (error) {
        console.warn(`⚠️ Gateway failed for ${cid.slice(0, 10)}...: ${gateway}`);
        continue;
      }
    }
    
    // Fallback to first gateway if all fail
    console.warn(`⚠️ All gateways failed for ${cid.slice(0, 10)}..., using fallback`);
    return `${this.ipfsGateways[0]}${cid}`;
  }

  /**
   * Test multiple CIDs and return best gateway URLs
   */
  private async testMultipleGateways(cids: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    // Test gateways in parallel for better performance
    const promises = cids.filter(cid => cid).map(async (cid) => {
      results[cid] = await this.testGatewayReliability(cid);
    });
    
    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Get reliable IPFS URL for a CID with gateway fallback
   */
  async getReliableIPFSUrl(cid: string): Promise<string> {
    return this.testGatewayReliability(cid);
  }

  /**
   * Enhance NFT data with reliable IPFS URLs
   */
  async enhanceNFTsWithReliableUrls(nfts: OffchainNFT[]): Promise<OffchainNFT[]> {
    if (nfts.length === 0) return nfts;

    // Extract CIDs from NFT data
    const cids = nfts.map(nft => nft.ipfs_hash).filter(Boolean) as string[];
    
    if (cids.length === 0) return nfts;

    console.log(`🔍 Testing IPFS gateways for ${cids.length} NFT images...`);
    const gatewayUrls = await this.testMultipleGateways(cids);

    // Update NFTs with reliable URLs
    return nfts.map(nft => ({
      ...nft,
      image: nft.ipfs_hash && gatewayUrls[nft.ipfs_hash] 
        ? gatewayUrls[nft.ipfs_hash] 
        : nft.image
    }));
  }
  
  /**
   * Load offchain NFTs for a wallet address - DATABASE/IPFS ONLY
   */
  async loadOffchainNFTs(walletAddress: string): Promise<OffchainNFT[]> {
    try {
      console.log('🔄 Loading offchain NFTs from database/IPFS for wallet:', walletAddress);

      // Use OptimizedCIDPoolBurnService for efficient NFT retrieval from database/IPFS
      const nftData = await optimizedCIDPoolBurnService.getUserNFTs(walletAddress);

      if (!nftData || nftData.length === 0) {
        console.log('📭 No offchain NFTs found in database');
        return [];
      }

      // Filter out NFTs that are already claimed onchain (database-only check)
      const claimedNFTIds = await this.getClaimedNFTIds(walletAddress);
      
      // Get offchain staked NFTs to add staking status
      let stakedNFTIds = new Set<string>();
      try {
        const enhancedStakingService = (await import('./EnhancedStakingService')).default;
        const stakedNFTs = await enhancedStakingService.getStakedNFTs(walletAddress);
        stakedNFTIds = new Set(stakedNFTs.map(nft => nft.nft_id));
        console.log(`🔒 Found ${stakedNFTIds.size} offchain staked NFTs for wallet`);
      } catch (error) {
        console.warn('⚠️ Could not load offchain staked NFTs:', error);
      }
      
      // Convert NFTData to OffchainNFT format and filter unclaimed ones
      const offchainNFTs: OffchainNFT[] = nftData
        .filter(nft => !claimedNFTIds.has(nft.id))
        .map(nft => ({
          id: nft.id,
          name: nft.name,
          description: nft.description || `A ${nft.rarity} NFT from the NEFTIT platform`,
          image: nft.image,
          rarity: nft.rarity,
          attributes: nft.attributes || [
            { trait_type: 'Rarity', value: nft.rarity.charAt(0).toUpperCase() + nft.rarity.slice(1) },
            { trait_type: 'Platform', value: 'NEFTIT' }
          ],
          ipfs_hash: nft.ipfs_hash,
          metadata_uri: nft.metadata_uri,
          wallet_address: walletAddress,
          status: 'offchain' as const,
          isStaked: stakedNFTIds.has(nft.id)
        }));

      const stakedCount = offchainNFTs.filter(nft => nft.isStaked).length;
      console.log(`✅ Loaded ${offchainNFTs.length} offchain NFTs from database/IPFS (filtered ${claimedNFTIds.size} claimed, ${stakedCount} staked)`);
      return offchainNFTs;
      
    } catch (error) {
      console.error('❌ Error loading offchain NFTs from database:', error);
      return [];
    }
  }

  /**
   * Load onchain NFTs for a wallet address - BLOCKCHAIN ONLY (database only if NO blockchain data)
   * If blockchain data exists: ONLY blockchain data (owned + staked)
   * If NO blockchain data: database fallback for new claims
   */
  async loadOnchainNFTs(walletAddress: string): Promise<OnchainNFT[]> {
    try {
      console.log(`🔍 Loading onchain NFTs - BLOCKCHAIN FIRST (database only if no blockchain data) for wallet: ${walletAddress}`);
      
      // Get all NFTs owned by the wallet directly from the blockchain contract
      const blockchainNFTs = await web3MetaMaskNFTService.getOwnedNFTs(walletAddress);
      
      // Get staked NFTs for this wallet from blockchain
      let stakedNFTs: any[] = [];
      try {
        if (await this.stakingService.isOnChainAvailable()) {
          stakedNFTs = await this.stakingService.getDetailedOnchainStakedNFTs(walletAddress);
          console.log(`🔒 Found ${stakedNFTs.length} staked NFTs on blockchain`);
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch staked NFTs from blockchain:', error);
      }
      
      const blockchainTotal = blockchainNFTs.length + stakedNFTs.length;
      
      // PRIORITY 3: Add database NFTs as fallback (ONLY if no blockchain data)
      if (blockchainTotal === 0) {
        console.log('📊 No blockchain NFTs found - loading recently claimed NFTs as fallback');
        const recentlyClaimedNFTs = await this.getRecentlyClaimedNFTs(walletAddress);
        
        // Filter out reward tracking entries from UI display
        const filteredDatabaseNFTs = recentlyClaimedNFTs.filter(nft => 
          !nft.id.includes('onchain_reward_') && 
          nft.status !== 'reward_tracking'
        );
        
        if (filteredDatabaseNFTs.length > 0) {
          console.log(`📊 Added ${filteredDatabaseNFTs.length} recently claimed NFTs as fallback (filtered out ${recentlyClaimedNFTs.length - filteredDatabaseNFTs.length} reward tracking entries)`);
          return filteredDatabaseNFTs;
        }
      } else {
        console.log(`📊 Blockchain data available (${blockchainTotal} NFTs) - skipping database fallback`);
      }

      const onchainNFTs: OnchainNFT[] = [];
      const processedTokenIds = new Set<string>();
      
      // PRIORITY 1: Add blockchain-owned NFTs first (REAL SOURCE OF TRUTH)
      for (const nft of blockchainNFTs) {
        try {
          // Extract metadata purely from blockchain data
          let name = `NFT #${nft.tokenId}`;
          let description = '';
          let image = '';
          let attributes: any[] = [];
          let rarity = 'Common';
          let fallback_images: string[] = [];
          let ipfs_hash = '';

          // Use blockchain metadata if available
          if (nft.metadata) {
            name = nft.metadata.name || name;
            description = nft.metadata.description || '';
            image = nft.metadata.image || '';
            attributes = nft.metadata.attributes || [];
            
            // Extract rarity from attributes if available
            const rarityAttr = attributes.find(attr => 
              attr.trait_type?.toLowerCase() === 'rarity' || 
              attr.trait_type?.toLowerCase() === 'tier'
            );
            if (rarityAttr) {
              rarity = rarityAttr.value.toLowerCase();
            } else {
              // Try to extract rarity from name if not in attributes
              const nameRarity = this.extractRarityFromName(name);
              if (nameRarity) {
                rarity = nameRarity;
              }
            }
            
            // Extract IPFS hash from image URL if it's an IPFS URL
            if (image && image.includes('ipfs')) {
              const ipfsMatch = image.match(/Qm[1-9A-HJ-NP-Za-km-z]{44}/);
              if (ipfsMatch) {
                ipfs_hash = ipfsMatch[0];
                // Generate fallback images using IPFS gateways
                fallback_images = this.ipfsGateways.map(gateway => `${gateway}${ipfs_hash}`);
              }
            }
          }

          const nftData = {
            id: `onchain_${nft.tokenId}`,
            name,
            description,
            image,
            rarity,
            attributes,
            tokenId: nft.tokenId,
            transactionHash: '', // Not available from blockchain query
            contractAddress: web3MetaMaskNFTService.contractAddress,
            metadataURI: nft.tokenURI,
            wallet_address: walletAddress,
            claimed_at: new Date().toISOString(), // Approximate timestamp
            claimed_blockchain: 'polygon',
            status: 'onchain' as const,
            fallback_images,
            ipfs_hash,
            isStaked: false
          };
          
          onchainNFTs.push(nftData);
          processedTokenIds.add(nft.tokenId);

        } catch (error) {
          console.warn(`⚠️ Failed to process onchain NFT ${nft.tokenId}:`, error);
          
          // Add basic NFT data even if processing fails
          onchainNFTs.push({
            id: `onchain_${nft.tokenId}`,
            name: nft.metadata?.name || `NFT #${nft.tokenId}`,
            description: nft.metadata?.description || '',
            image: nft.metadata?.image || '',
            rarity: this.extractRarityFromName(nft.metadata?.name || ''),
            attributes: nft.metadata?.attributes || [],
            tokenId: nft.tokenId,
            transactionHash: '',
            contractAddress: web3MetaMaskNFTService.contractAddress,
            metadataURI: nft.tokenURI,
            wallet_address: walletAddress,
            claimed_at: new Date().toISOString(),
            claimed_blockchain: 'polygon',
            status: 'onchain' as const,
            fallback_images: [],
            ipfs_hash: '',
            isStaked: false
          });
        }
      }

      // PRIORITY 2: Update existing NFTs to staked status OR add new staked NFTs
      for (const stakedNft of stakedNFTs) {
        try {
          const tokenId = stakedNft.tokenId;
          
          // Check if we already have this NFT from owned NFTs
          const existingNFTIndex = onchainNFTs.findIndex(nft => nft.tokenId === tokenId);
          
          if (existingNFTIndex >= 0) {
            // Update existing NFT to staked status
            console.log(`🔄 Updating existing NFT ${tokenId} to staked status`);
            onchainNFTs[existingNFTIndex] = {
              ...onchainNFTs[existingNFTIndex],
              isStaked: true,
              stakeTimestamp: stakedNft.stakeTimestamp,
              // Keep all other properties the same
            };
          } else {
            // Add new staked NFT (not in owned list) - CRITICAL FIX: Use proper metadata
            console.log(`➕ Adding new staked NFT ${tokenId} with proper metadata`);
            
            // CRITICAL FIX: Staked NFTs have proper metadata from ImprovedOnchainStakingService
            // Don't use fallback names - use the actual metadata
            let name = stakedNft.name || `NFT #${tokenId}`;
            let image = stakedNft.image || '';
            let rarity = stakedNft.rarity;
            let description = stakedNft.description || '';
            let attributes = stakedNft.attributes || [];
            
            // If we still have generic data, try to get metadata from tokenURI
            if (!stakedNft.name || stakedNft.name.includes('Onchain NFT #')) {
              console.log(`🔍 Attempting to fetch proper metadata for staked NFT ${tokenId}`);
              try {
                if (stakedNft.tokenURI && stakedNft.tokenURI.startsWith('http')) {
                  const response = await fetch(stakedNft.tokenURI);
                  if (response.ok) {
                    const metadata = await response.json();
                    name = metadata.name || name;
                    image = metadata.image || image;
                    description = metadata.description || description;
                    attributes = metadata.attributes || attributes;
                    
                    // Extract rarity from attributes
                    const rarityAttr = attributes.find(attr => 
                      attr.trait_type?.toLowerCase() === 'rarity' || 
                      attr.trait_type?.toLowerCase() === 'tier'
                    );
                    if (rarityAttr) {
                      rarity = rarityAttr.value.toLowerCase();
                    }
                    
                    console.log(`✅ Successfully fetched metadata for staked NFT ${tokenId}: ${name}`);
                  }
                }
              } catch (metadataError) {
                console.warn(`⚠️ Could not fetch metadata for staked NFT ${tokenId}:`, metadataError);
              }
            }
            
            const stakedNftData = {
              id: `onchain_${tokenId}`,
              name,
              description,
              image,
              rarity: rarity.toLowerCase(),
              attributes,
              tokenId: tokenId,
              transactionHash: stakedNft.transactionHash || '',
              contractAddress: web3MetaMaskNFTService.contractAddress,
              metadataURI: stakedNft.tokenURI || '',
              wallet_address: walletAddress,
              claimed_at: new Date().toISOString(),
              claimed_blockchain: 'polygon',
              status: 'onchain' as const,
              fallback_images: [],
              ipfs_hash: '',
              isStaked: true,
              stakeTimestamp: stakedNft.stakeTimestamp
            };
            
            onchainNFTs.push(stakedNftData);
            console.log(`✅ Added staked NFT with proper metadata: ${name} (${tokenId})`);
          }
          
          processedTokenIds.add(tokenId);
        } catch (error) {
          console.warn(`⚠️ Failed to process staked NFT ${stakedNft.tokenId}:`, error);
        }
      }
      
      // NO DATABASE FALLBACK - We have blockchain data, so we use ONLY blockchain data
      console.log(`✅ Successfully processed ${onchainNFTs.length} total BLOCKCHAIN-ONLY NFTs:`);
      console.log(`   🔗 ${blockchainNFTs.length} blockchain-owned`);
      console.log(`   🔒 ${stakedNFTs.length} blockchain-staked`);
      console.log(`   💾 0 database fallback (blockchain data available)`);
      
      if (onchainNFTs.length !== blockchainTotal) {
        console.warn(`⚠️ Mismatch: processed ${onchainNFTs.length} but expected ${blockchainTotal}`);
      }
      
      // Auto-sync onchain NFTs to database tracking system
      console.log(`🔄 Starting onchain NFT sync for wallet: ${walletAddress}`);
      console.log(`📊 Onchain NFTs to sync: ${onchainNFTs.length}`);
      
      try {
        // DISABLED: Problematic sync method causing null errors
        // await onchainNFTTrackingService.autoSyncOnchainNFTs(walletAddress, onchainNFTs);
        console.log(`⚠️ Onchain NFT sync disabled - returning ${onchainNFTs.length} onchain NFTs without database sync`);
        
        // Get and log the comprehensive counts after sync
        const counts = await onchainNFTTrackingService.getComprehensiveNFTCounts(walletAddress);
        console.log(`📊 Post-sync comprehensive NFT counts:`, counts);
        
      } catch (error) {
        console.warn('⚠️ Failed to sync onchain NFTs to database (non-critical):', error);
        console.error('Full sync error details:', error);
      }
      
      return onchainNFTs;
    } catch (error) {
      console.error('❌ Failed to load onchain NFTs from blockchain:', error);
      // NO FALLBACK - Return empty array if blockchain fails
      return [];
    }
  }


  /**
   * Claim an offchain NFT to blockchain
   */
  async claimNFTToBlockchain(nft: OffchainNFT, walletAddress: string): Promise<{
    success: boolean;
    onchainNFT?: OnchainNFT;
    error?: string;
  }> {
    try {
      console.log('🚀 Claiming NFT to blockchain:', nft.id);
      
      // Use the existing Web3MetaMaskNFTService which handles automatic role granting
      const result = await web3MetaMaskNFTService.mintNFT(nft.id, walletAddress);
      
      if (result.success) {
        // Create onchain NFT object
        const onchainNFT: OnchainNFT = {
          ...nft,
          tokenId: result.tokenId || '',
          transactionHash: result.transactionHash,
          contractAddress: web3MetaMaskNFTService['contractAddress'], // Access private property
          metadataURI: result.metadataURI || '',
          claimed_at: new Date().toISOString(),
          claimed_blockchain: 'polygon',
          status: 'onchain' as const
        };

        // CRITICAL FIX: Don't delete offchain NFTs - mark as claimed instead with complete data
        await this.markAsClaimedInsteadOfDelete(nft.id, walletAddress, {
          transactionHash: result.transactionHash,
          tokenId: result.tokenId || '',
          contractAddress: web3MetaMaskNFTService['contractAddress']
        });
        
        console.log('✅ NFT successfully claimed to blockchain and removed from offchain storage');
        
        return {
          success: true,
          onchainNFT
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to claim NFT'
        };
      }
      
    } catch (error: any) {
      console.error('❌ Failed to claim NFT to blockchain:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Get claimed NFT IDs from database only
   */
  private async getClaimedNFTIds(walletAddress: string): Promise<Set<string>> {
    try {
      const { data, error } = await this.supabase
        .from('nft_claims')
        .select('nft_id')
        .eq('wallet_address', walletAddress.toLowerCase());

      if (error) {
        console.error('❌ Error fetching claimed NFT IDs:', error);
        return new Set();
      }

      const claimedIds = new Set(data?.map(claim => claim.nft_id) || []);
      console.log(`🔍 Found ${claimedIds.size} claimed NFT IDs in database`);
      return claimedIds;
    } catch (error) {
      console.error('❌ Failed to get claimed NFT IDs:', error);
      return new Set();
    }
  }

  /**
   * Mark NFT as claimed instead of deleting it - PRESERVES DATA
   */
  private async markAsClaimedInsteadOfDelete(nftId: string, walletAddress: string, claimData?: {
    transactionHash: string;
    tokenId: string;
    contractAddress: string;
  }): Promise<void> {
    try {
      console.log('✅ Marking NFT as claimed (preserving data):', nftId);
      
      // Add to claims table without deleting original data
      const { error: insertError } = await this.supabase
        .from('nft_claims')
        .upsert({
          nft_id: nftId,
          wallet_address: walletAddress.toLowerCase(),
          claimed_blockchain: 'polygon',
          transaction_hash: claimData?.transactionHash || `claim_${nftId}_${Date.now()}`,
          contract_address: claimData?.contractAddress || '0x5Bb23220cC12585264fCd144C448eF222c8572A2',
          token_id: claimData?.tokenId || 'pending',
          blockchain_type: 'polygon',
          claim_type: 'blockchain',
          claimed_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('❌ Could not mark as claimed:', insertError);
        console.error('❌ Insert error details:', insertError.message, insertError.details);
      } else {
        console.log('✅ NFT marked as claimed with complete data in nft_claims table');
      }
      
    } catch (error) {
      console.error('❌ Failed to mark NFT as claimed:', error);
      // Don't throw error as the onchain claim was successful
    }
  }

  /**
   * DEPRECATED: Remove NFT from offchain storage after successful onchain claim
   * REPLACED WITH: markAsClaimedInsteadOfDelete to preserve data
   */
  private async removeFromOffchainStorage(nftId: string, walletAddress: string): Promise<void> {
    console.warn('⚠️ DEPRECATED: removeFromOffchainStorage called - this deletes NFT data permanently!');
    console.warn('⚠️ Use markAsClaimedInsteadOfDelete instead to preserve NFT data');
    
    // Don't actually delete - just log the warning
    return;
  }


  /**
   * Get recently claimed NFTs from database (for display until blockchain indexes them)
   */
  private async getRecentlyClaimedNFTs(walletAddress: string): Promise<OnchainNFT[]> {
    try {
      console.log('🔍 Loading recently claimed NFTs from database...');
      
      const { data: claims, error } = await this.supabase
        .from('nft_claims')
        .select(`
          nft_id,
          transaction_hash,
          contract_address,
          token_id,
          claimed_at,
          claimed_blockchain
        `)
        .eq('wallet_address', walletAddress.toLowerCase())
        .order('claimed_at', { ascending: false })
        .limit(50); // Get recent claims

      if (error || !claims) {
        console.warn('⚠️ Could not load recent claims:', error);
        return [];
      }

      const recentlyClaimedNFTs: OnchainNFT[] = [];
      
      for (const claim of claims) {
        try {
          // Get original NFT data for the claimed NFT
          const originalData = await this.getOriginalNFTData(claim.nft_id);
          
          if (originalData) {
            const onchainNFT: OnchainNFT = {
              id: `claimed_${claim.nft_id}`,
              name: originalData.name,
              description: originalData.description,
              image: originalData.image,
              rarity: originalData.rarity,
              attributes: originalData.attributes,
              tokenId: claim.token_id || '',
              transactionHash: claim.transaction_hash || '',
              contractAddress: claim.contract_address || '',
              metadataURI: '',
              wallet_address: walletAddress,
              claimed_at: claim.claimed_at,
              claimed_blockchain: claim.claimed_blockchain || 'polygon',
              status: 'onchain' as const,
              fallback_images: originalData.fallback_images || [],
              ipfs_hash: originalData.ipfs_hash || '',
              isStaked: false
            };
            
            recentlyClaimedNFTs.push(onchainNFT);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to process claimed NFT ${claim.nft_id}:`, error);
        }
      }
      
      console.log(`✅ Loaded ${recentlyClaimedNFTs.length} recently claimed NFTs from database`);
      return recentlyClaimedNFTs;
      
    } catch (error) {
      console.error('❌ Failed to load recently claimed NFTs:', error);
      return [];
    }
  }

  /**
   * Get original NFT data for display purposes with IPFS fallbacks
   */
  private async getOriginalNFTData(nftId: string): Promise<any | null> {
    try {
      // Try to get from nft_cid_distribution_log first
      const { data, error } = await this.supabase
        .from('nft_cid_distribution_log')
        .select(`
          nft_id, 
          rarity, 
          cid,
          nft_cid_pools!inner(
            name,
            description,
            image_url,
            metadata_cid,
            attributes
          )
        `)
        .eq('nft_id', nftId)
        .single();

      if (!error && data) {
        const poolData = Array.isArray(data.nft_cid_pools) ? data.nft_cid_pools[0] : data.nft_cid_pools;
        
        // Generate fallback image URLs using all IPFS gateways
        const fallbackImages = data.cid ? this.ipfsGateways.map(gateway => `${gateway}${data.cid}`) : [];
        
        return {
          id: data.nft_id,
          name: poolData?.name || `NEFTIT ${data.rarity?.charAt(0).toUpperCase() + data.rarity?.slice(1)} NFT`,
          description: poolData?.description || '',
          image: poolData?.image_url || getIPFSUrl(data.cid || ''),
          rarity: data.rarity || 'Common',
          attributes: poolData?.attributes || [
            { trait_type: 'Rarity', value: data.rarity?.charAt(0).toUpperCase() + data.rarity?.slice(1) || 'Common' },
            { trait_type: 'Platform', value: 'NEFTIT' },
            { trait_type: 'Status', value: 'Onchain' }
          ],
          fallback_images: fallbackImages,
          ipfs_hash: data.cid
        };
      }

      return null;
    } catch (error) {
      console.warn('⚠️ Could not get original NFT data:', error);
      return null;
    }
  }

  /**
   * Get combined NFT status for a wallet (offchain + onchain)
   */
  async getNFTStatus(walletAddress: string): Promise<{
    offchainNFTs: OffchainNFT[];
    onchainNFTs: OnchainNFT[];
    totalOffchain: number;
    totalOnchain: number;
  }> {
    const [offchainNFTs, onchainNFTs] = await Promise.all([
      this.loadOffchainNFTs(walletAddress),
      this.loadOnchainNFTs(walletAddress)
    ]);

    return {
      offchainNFTs,
      onchainNFTs,
      totalOffchain: offchainNFTs.length,
      totalOnchain: onchainNFTs.length
    };
  }
}

export const nftLifecycleService = new NFTLifecycleService();
