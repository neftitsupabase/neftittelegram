/**
 * Optimized Burn Service using CID Pool System
 * Minimal HybridIPFSService usage for maximum performance
 */

import { getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IPFS_GATEWAYS, getIPFSUrl, updateNFTMetadataIPFS, extractIPFSHash } from '../config/ipfsConfig';
import hybridIPFSService, { NFTData } from './HybridIPFSService';
import activityTrackingService from './ActivityTrackingService';
import achievementsService from './AchievementsService';
import { v4 as uuidv4 } from 'uuid';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export interface BurnRule {
  minRarity: string;
  maxRarity: string;
  requiredAmount: number;
  tier: string;
  resultingNFT: {
    rarity: string;
    tier: string;
    image: string;
    name: string;
  };
}

interface BurnTransaction {
  id: string;
  wallet_address: string;
  burned_nfts: NFTData[];
  result_nft: NFTData;
  burn_rule: BurnRule;
  timestamp: string;
  transaction_hash?: string;
}

export interface BurnResult {
  success: boolean;
  resultNFT?: NFTData;
  error?: string;
  burnTransaction?: BurnTransaction;
}

interface NFTDataWithStaking extends NFTData {
  isStaked?: boolean;
}

class OptimizedCIDPoolBurnService {
  private supabase: SupabaseClient;
  private ipfsGateways: string[];

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.ipfsGateways = [...IPFS_GATEWAYS];
  }

  // Create Supabase client with wallet address header for RLS
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

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
        const timeoutId = setTimeout(() => controller.abort(), 2000); // Reduced timeout
        
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
   * Fetch and parse NFT metadata from IPFS
   */
  private async fetchIPFSMetadata(metadataCid: string): Promise<{
    name?: string;
    description?: string;
    image?: string;
    attributes?: any[];
    rarity?: string;
  } | null> {
    if (!metadataCid) {
      console.warn('⚠️ No metadata CID provided');
      return null;
    }

    console.log(`🔍 Fetching metadata from IPFS: ${metadataCid}`);
    console.log(`🌐 Available gateways:`, this.ipfsGateways);

    // Try each gateway until one works
    for (const gateway of this.ipfsGateways) {
      try {
        const metadataUrl = `${gateway}${metadataCid}`;
        console.log(`🌐 Trying gateway: ${metadataUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout for metadata
        
        const response = await fetch(metadataUrl, {
          signal: controller.signal,
          method: 'GET',
          mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn(`⚠️ Gateway ${gateway} returned ${response.status} for ${metadataCid}`);
          continue;
        }
        
        const metadata = await response.json();
        console.log(`✅ Successfully fetched metadata from ${gateway}:`, metadata);
        
        // Extract rarity from attributes if not in root
        let rarity = metadata.rarity;
        if (!rarity && metadata.attributes) {
          const rarityAttr = metadata.attributes.find((attr: any) => 
            attr.trait_type?.toLowerCase() === 'rarity'
          );
          if (rarityAttr) {
            rarity = rarityAttr.value;
          }
        }
        
        return {
          name: metadata.name,
          description: metadata.description,
          image: metadata.image,
          attributes: metadata.attributes || [],
          rarity: rarity
        };
        
      } catch (error) {
        console.warn(`⚠️ Failed to fetch metadata from ${gateway}:`, error.message);
        continue;
      }
    }
    
    console.error(`❌ Failed to fetch metadata from all gateways for CID: ${metadataCid}`);
    
    // Try one more time with a simple GET request (no CORS mode)
    console.log(`🔄 Trying fallback approach without CORS mode...`);
    try {
      const fallbackUrl = `${this.ipfsGateways[2]}${metadataCid}`; // Use Pinata as fallback
      const response = await fetch(fallbackUrl);
      if (response.ok) {
        const metadata = await response.json();
        console.log(`✅ Fallback fetch successful:`, metadata);
        
        let rarity = metadata.rarity;
        if (!rarity && metadata.attributes) {
          const rarityAttr = metadata.attributes.find((attr: any) => 
            attr.trait_type?.toLowerCase() === 'rarity'
          );
          if (rarityAttr) {
            rarity = rarityAttr.value;
          }
        }
        
        return {
          name: metadata.name,
          description: metadata.description,
          image: metadata.image,
          attributes: metadata.attributes || [],
          rarity: rarity
        };
      }
    } catch (fallbackError) {
      console.warn(`⚠️ Fallback fetch also failed:`, fallbackError.message);
    }
    
    return null;
  }

  /**
   * Test multiple gateways in parallel for better performance
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

  // Optimized burn rules using CID pool result NFTs
  private burnRules: BurnRule[] = [
    {
      minRarity: "common",
      maxRarity: "common",
      requiredAmount: 5,
      tier: "1",
      resultingNFT: {
        rarity: "platinum",
        tier: "4",
        image: "", // Will be fetched from CID pool
        name: "NEFTINUM Platinum",
      },
    },
    {
      minRarity: "rare",
      maxRarity: "rare",
      requiredAmount: 3,
      tier: "2",
      resultingNFT: {
        rarity: "platinum",
        tier: "4",
        image: "", // Will be fetched from CID pool
        name: "NEFTINUM Platinum",
      },
    },
    {
      minRarity: "legendary",
      maxRarity: "legendary",
      requiredAmount: 2,
      tier: "3",
      resultingNFT: {
        rarity: "platinum",
        tier: "4",
        image: "", // Will be fetched from CID pool
        name: "NEFTINUM Platinum",
      },
    },
    {
      minRarity: "platinum",
      maxRarity: "platinum",
      requiredAmount: 5,
      tier: "4",
      resultingNFT: {
        rarity: "silver",
        tier: "6",
        image: "", // Will be fetched from CID pool
        name: "Silver NFT",
      },
    },
    {
      minRarity: "silver",
      maxRarity: "silver",
      requiredAmount: 5,
      tier: "6",
      resultingNFT: {
        rarity: "gold",
        tier: "7",
        image: "", // Will be fetched from CID pool
        name: "Gold NFT",
      },
    },
  ];

  /**
   * Get user's NFTs from CID pool database with reliable IPFS gateway fallbacks
   */
  async getUserNFTs(walletAddress: string): Promise<NFTData[]> {
    try {
      console.log(`🚀 Loading NFTs from CID pool for: ${walletAddress}`);

      const { data: distributedNFTs, error } = await this.createClientWithWalletHeader(walletAddress)
        .from('nft_cid_distribution_log')
        .select(`
          nft_id,
          rarity,
          cid,
          distributed_at
        `)
        .eq('wallet_address', walletAddress.toLowerCase())
        .order('distributed_at', { ascending: false });

      if (error) {
        console.error('❌ Database error loading NFTs:', error);
        throw new Error(`Failed to load NFTs: ${error.message}`);
      }

      if (!distributedNFTs || distributedNFTs.length === 0) {
        console.log('📭 No NFTs found in CID pool for wallet');
        return [];
      }

      // Convert database records to NFTData format and fetch actual metadata from IPFS
      console.log(`📊 Processing ${distributedNFTs.length} NFT records from database`);
      console.log(`🔍 Sample record:`, distributedNFTs[0]);
      
      const nfts: NFTData[] = await Promise.all(distributedNFTs.map(async (record) => {
        const metadataCid = record.cid;
        const metadataUrl = getIPFSUrl(metadataCid);
        
        console.log(`📋 Processing NFT ${record.nft_id}:`, {
          nft_id: record.nft_id,
          rarity: record.rarity,
          cid: record.cid,
          distributed_at: record.distributed_at
        });
        
        // Try to fetch actual metadata from IPFS
        console.log(`🔍 Fetching metadata for NFT ${record.nft_id} from CID: ${metadataCid}`);
        let metadata = null;
        try {
          metadata = await this.fetchIPFSMetadata(metadataCid);
          if (metadata) {
            console.log(`✅ Successfully fetched metadata for ${record.nft_id}:`, metadata);
          } else {
            console.warn(`⚠️ No metadata returned for ${record.nft_id} from CID: ${metadataCid}`);
          }
        } catch (error) {
          console.error(`❌ Error fetching metadata for ${record.nft_id}:`, error);
          metadata = null;
        }
        
        // Use fetched metadata if available, otherwise fallback to defaults
        const name = metadata?.name || `NEFTIT ${record.rarity.charAt(0).toUpperCase() + record.rarity.slice(1)} NFT`;
        const description = metadata?.description || `A ${record.rarity} NFT from the NEFTIT platform`;
        const rarity = metadata?.rarity || record.rarity;
        
        // For image, use the image from metadata if available, otherwise use CID as image
        let imageUrl = '';
        let fallbackImages: string[] = [];
        
        if (metadata?.image) {
          // If metadata has an image URL, extract the IPFS hash and use our proxy
          const imageHash = extractIPFSHash(metadata.image);
          if (imageHash) {
            imageUrl = getIPFSUrl(imageHash);
          } else {
            // If no IPFS hash found, use the original URL
            imageUrl = metadata.image;
          }
          
          // Create fallback URLs from the image IPFS hash
          if (imageHash) {
            fallbackImages = this.ipfsGateways.map(gateway => `${gateway}${imageHash}`);
          }
        } else {
          // If no image in metadata, use the CID itself as image
          imageUrl = getIPFSUrl(metadataCid);
          fallbackImages = this.ipfsGateways.map(gateway => `${gateway}${metadataCid}`);
        }
        
        console.log(`✅ Processed NFT ${record.nft_id}:`, {
          name,
          rarity,
          imageUrl,
          hasMetadata: !!metadata
        });
        
        return {
          id: record.nft_id,
          name,
          description,
          image: imageUrl,
          rarity,
          wallet_address: walletAddress,
          ipfs_hash: record.cid,
          pinata_hash: record.cid,
          metadata_uri: metadataUrl,
          fallback_images: fallbackImages,
          attributes: metadata?.attributes || [
            { trait_type: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1) },
            { trait_type: 'Platform', value: 'NEFTIT' },
            { trait_type: 'Unique ID', value: record.nft_id }
          ],
          created_at: record.distributed_at
        };
      }));

      console.log(`✅ Loaded ${nfts.length} NFTs from CID pool database with reliable IPFS URLs`);
      return nfts;

    } catch (error) {
      console.error('❌ Error loading NFTs from CID pool:', error);
      return [];
    }
  }

  /**
   * Get user's NFTs with staking status (optimized)
   */
  async getUserNFTsWithStakingStatus(walletAddress: string): Promise<NFTDataWithStaking[]> {
    try {
      console.log(`🔄 Loading NFTs with staking status for: ${walletAddress}`);
      
      // Get base NFTs from CID pool database
      const nfts = await this.getUserNFTs(walletAddress);
      console.log(`📦 Base NFTs loaded: ${nfts.length}`);
      
      if (nfts.length === 0) {
        return [];
      }
      
      try {
        // Import services dynamically to avoid circular dependency
        const { default: offChainStakingService } = await import('./EnhancedStakingService');
        const { ImprovedOnchainStakingService } = await import('./ImprovedOnchainStakingService');
        
        // Get offchain staked NFTs from database (for reward tracking)
        const offchainStakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
        const offchainStakedIds = new Set(offchainStakedNFTs.map(nft => nft.nft_id));
        
        // Get onchain staked NFTs directly from blockchain (for lock status)
        let onchainStakedIds = new Set<string>();
        try {
          const onchainStakingService = new ImprovedOnchainStakingService();
          const onchainStakedNFTs = await onchainStakingService.getStakedNFTsOnChain(walletAddress);
          onchainStakedIds = new Set(onchainStakedNFTs.map(nft => nft.tokenId?.toString() || nft.id?.toString()));
          console.log(`⛓️ Found ${onchainStakedIds.size} NFTs staked onchain from blockchain`);
        } catch (error) {
          console.warn('⚠️ Could not fetch onchain staking status:', error);
        }
        
        // Add staking status to NFTs based on their type
        const nftsWithStaking: NFTDataWithStaking[] = nfts.map(nft => {
          // Determine if NFT is onchain based on available properties
          const isOnchainNFT = nft.tokenId || nft.contractAddress || nft.id.startsWith('onchain_');
          let isStaked = false;
          
          if (isOnchainNFT) {
            // For onchain NFTs: Check blockchain staking status (not database)
            const tokenId = nft.tokenId?.toString() || nft.id?.replace(/^onchain_/, '');
            isStaked = onchainStakedIds.has(tokenId);
            console.log(`⛓️ Onchain NFT ${tokenId}: ${isStaked ? 'STAKED' : 'UNSTAKED'} (blockchain check)`);
          } else {
            // For offchain NFTs: Check database staking status
            isStaked = offchainStakedIds.has(nft.id);
            console.log(`💾 Offchain NFT ${nft.id}: ${isStaked ? 'STAKED' : 'UNSTAKED'} (database check)`);
          }
          
          return {
            ...nft,
            isStaked
          };
        });
        
        console.log(`✅ Added staking status to ${nftsWithStaking.length} NFTs`);
        console.log(`🔍 DEBUG: Offchain staked NFT IDs from database:`, Array.from(offchainStakedIds));
        console.log(`🔍 DEBUG: Onchain staked NFT IDs from blockchain:`, Array.from(onchainStakedIds));
        console.log(`🔍 DEBUG: NFTs with staking status:`, nftsWithStaking.map(nft => ({ 
          id: nft.id, 
          name: nft.name, 
          isStaked: nft.isStaked, 
          hasTokenId: !!nft.tokenId,
          hasContractAddress: !!nft.contractAddress
        })));
        return nftsWithStaking;
        
      } catch (stakingError) {
        console.error('❌ Error getting staking status:', stakingError);
        // Return NFTs without staking status if staking service fails
        return nfts.map(nft => ({ ...nft, isStaked: false }));
      }
      
    } catch (error) {
      console.error('❌ Error loading NFTs with staking status:', error);
      return [];
    }
  }

  /**
   * Get result NFT from CID pool (no upload needed)
   */
  private async getResultNFTFromCIDPool(rarity: string): Promise<{ resultNFT: NFTData; cidPoolId: number }> {
    try {
      console.log(`🎯 Getting result NFT from CID pool for rarity: ${rarity}`);

      const { data: cidPoolNFT, error } = await this.createClientWithWalletHeader('')
        .from('nft_cid_pools')
        .select('*')
        .eq('rarity', rarity.toLowerCase())
        .eq('is_distributed', false)
        .limit(1)
        .single();

      if (error || !cidPoolNFT) {
        throw new Error(`No available ${rarity} NFT found in CID pool`);
      }

      // Mark CID as distributed (but don't mark as distributed yet - only after successful burn)
      // We'll mark it in the burn transaction function

      // Log the CID pool NFT data for debugging
      console.log(`📋 CID Pool NFT data:`, {
        id: cidPoolNFT.id,
        rarity: cidPoolNFT.rarity,
        image_url: cidPoolNFT.image_url,
        cid: cidPoolNFT.cid,
        metadata_cid: cidPoolNFT.metadata_cid
      });

      const resultNFT: NFTData = {
        id: uuidv4(),
        name: `NEFTIT ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} NFT`,
        description: '',
        image: cidPoolNFT.image_url || getIPFSUrl(cidPoolNFT.cid),
        rarity: rarity,
        wallet_address: '', // Will be set by caller
        ipfs_hash: cidPoolNFT.cid,
        pinata_hash: cidPoolNFT.cid,
        metadata_uri: getIPFSUrl(cidPoolNFT.metadata_cid),
        attributes: [
          { trait_type: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1) },
          { trait_type: 'Platform', value: 'NEFTIT' },
          { trait_type: 'Source', value: 'Burn Upgrade' }
        ],
        created_at: new Date().toISOString()
      };

      console.log(`✅ Retrieved result NFT from CID pool:`, {
        id: resultNFT.id,
        image: resultNFT.image,
        rarity: resultNFT.rarity
      });
      return { resultNFT, cidPoolId: cidPoolNFT.id };

    } catch (error) {
      console.error('❌ Error getting result NFT from CID pool:', error);
      throw error;
    }
  }

  /**
   * Remove burned NFTs from distribution log
   */
  private async removeBurnedNFTsFromLog(walletAddress: string, nftIds: string[]): Promise<void> {
    try {
      console.log(`🗑️ Removing ${nftIds.length} burned NFTs from distribution log`);

      const { error } = await this.createClientWithWalletHeader(walletAddress)
        .from('nft_cid_distribution_log')
        .delete()
        .eq('wallet_address', walletAddress.toLowerCase())
        .in('nft_id', nftIds);

      if (error) {
        throw new Error(`Failed to remove burned NFTs: ${error.message}`);
      }

      console.log(`✅ Removed ${nftIds.length} NFTs from distribution log`);
    } catch (error) {
      console.error('❌ Error removing burned NFTs:', error);
      throw error;
    }
  }

  /**
   * Add result NFT to distribution log
   */
  private async addResultNFTToLog(walletAddress: string, resultNFT: NFTData): Promise<void> {
    try {
      console.log(`➕ Adding result NFT to distribution log:`, resultNFT.id);

      const { error } = await this.createClientWithWalletHeader(walletAddress)
        .from('nft_cid_distribution_log')
        .insert({
          nft_id: resultNFT.id,
          wallet_address: walletAddress.toLowerCase(),
          rarity: resultNFT.rarity,
          cid: resultNFT.ipfs_hash,
          distributed_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to add result NFT: ${error.message}`);
      }

      console.log(`✅ Added result NFT to distribution log`);
    } catch (error) {
      console.error('❌ Error adding result NFT:', error);
      throw error;
    }
  }

  /**
   * Log burn transaction to database for unified tracking
   */
  private async logBurnTransactionToDatabase(burnTransaction: BurnTransaction): Promise<void> {
    try {
      console.log(`📝 Logging off-chain burn transaction to database:`, burnTransaction.id);

      const { error } = await this.createClientWithWalletHeader(burnTransaction.wallet_address)
        .from('burn_transactions')
        .insert({
          wallet_address: burnTransaction.wallet_address.toLowerCase(),
          burned_nft_ids: burnTransaction.burned_nfts.map(nft => nft.id),
          result_rarity: burnTransaction.result_nft.rarity,
          burn_type: 'offchain', // Distinguish from onchain burns
          transaction_hash: null, // No blockchain transaction for off-chain
          contract_address: null,
          gas_used: null,
          network: null,
          created_at: burnTransaction.timestamp,
          // Additional metadata for off-chain burns
          metadata: {
            burn_method: 'offchain',
            burn_rule: burnTransaction.burn_rule,
            result_nft_id: burnTransaction.result_nft.id,
            ipfs_hash: burnTransaction.result_nft.ipfs_hash,
            burn_transaction_id: burnTransaction.id
          }
        });

      if (error) {
        console.error('❌ Error logging off-chain burn transaction to database:', error);
      } else {
        console.log('✅ Off-chain burn transaction logged to main burn_transactions table');
      }
    } catch (error) {
      console.error('❌ Error logging off-chain burn transaction to database:', error);
      // Don't throw - burn should succeed even if logging fails
    }
  }

  /**
   * Log burn transaction to IPFS (minimal HybridIPFSService usage)
   */
  private async logBurnTransaction(burnTransaction: BurnTransaction): Promise<void> {
    try {
      console.log(`📝 Logging burn transaction to IPFS:`, burnTransaction.id);

      // Only use HybridIPFSService for burn record logging
      await hybridIPFSService.uploadBurnRecord(burnTransaction, burnTransaction.id);

      console.log(`✅ Burn transaction logged to IPFS`);
    } catch (error) {
      console.error('❌ Error logging burn transaction:', error);
      // Don't throw - burn should succeed even if logging fails
    }
  }

  /**
   * Optimized OFF-CHAIN burn NFTs process using CID pool (IPFS-based)
   * This burns NFTs stored in IPFS and updates database records only
   */
  async burnNFTsOffChain(walletAddress: string, nftIds: string[]): Promise<BurnResult> {
    try {
      console.log(`🔥 Starting OFF-CHAIN burn process for ${nftIds.length} NFTs (IPFS-based)`);

      // 1. Get user's NFTs from CID pool database
      const allUserNFTs = await this.getUserNFTs(walletAddress);
      const nftsToBurn = allUserNFTs.filter(nft => nftIds.includes(nft.id));

      if (nftsToBurn.length !== nftIds.length) {
        throw new Error('Some NFTs not found in user collection');
      }

      // 2. Validate burn rule
      const burnRule = this.validateBurnRule(nftsToBurn);
      if (!burnRule) {
        throw new Error('Invalid burn combination');
      }

      // 3. Get result NFT from CID pool (no upload needed)
      const { resultNFT, cidPoolId } = await this.getResultNFTFromCIDPool(burnRule.resultingNFT.rarity);
      resultNFT.wallet_address = walletAddress;
      
      // Update burn rule with actual image from CID pool
      burnRule.resultingNFT.image = resultNFT.image;

      // 4. Create burn transaction
      const burnTransaction: BurnTransaction = {
        id: uuidv4(),
        wallet_address: walletAddress,
        burned_nfts: nftsToBurn,
        result_nft: resultNFT,
        burn_rule: burnRule,
        timestamp: new Date().toISOString()
      };

      // 5. Update database with complete NFT tracking (atomic operations)
      const { data: burnResult, error: burnError } = await this.createClientWithWalletHeader(walletAddress).rpc('execute_burn_transaction', {
        p_wallet_address: walletAddress.toLowerCase(),
        p_burned_nft_ids: nftIds,
        p_result_nft: {
          nft_id: resultNFT.id,
          rarity: resultNFT.rarity,
          cid: resultNFT.ipfs_hash,
          distributed_at: resultNFT.created_at
        }
      });
      
      if (burnError) {
        throw new Error(`Burn transaction failed: ${burnError.message}`);
      }
      
      // Now mark the CID pool NFT as distributed after successful burn
      const { error: updateError } = await this.createClientWithWalletHeader('')
        .from('nft_cid_pools')
        .update({
          is_distributed: true,
          distributed_at: new Date().toISOString(),
          distributed_to_wallet: walletAddress.toLowerCase()
        })
        .eq('id', cidPoolId);

      if (updateError) {
        console.error('❌ Error marking CID pool NFT as distributed:', updateError);
        // Don't throw - burn was successful, this is just cleanup
      }

      console.log('🔥 Burn transaction completed:', burnResult);

      // 6. Log burn transaction to database and IPFS
      await Promise.allSettled([
        this.logBurnTransactionToDatabase(burnTransaction),
        this.logBurnTransaction(burnTransaction)
      ]);

      // 7. Log activity and update achievements
      await Promise.allSettled([
        activityTrackingService.logActivity(walletAddress, {
          activityType: 'burn',
          title: `Burned ${nftsToBurn.length} NFTs`,
          description: `Burned ${nftsToBurn.length} ${nftsToBurn[0].rarity} NFTs → 1 ${resultNFT.rarity} NFT`,
          details: `Burn Rule: ${burnRule.requiredAmount} ${burnRule.minRarity} → 1 ${burnRule.resultingNFT.rarity}`,
          metadata: {
            burned_nfts: nftIds,
            result_nft: resultNFT.id,
            burn_transaction_id: burnTransaction.id
          }
        }),
        achievementsService.updateBurnAchievements(walletAddress, 'all')
      ]);

      console.log(`✅ Off-chain burn completed successfully`);
      return {
        success: true,
        resultNFT,
        burnTransaction
      };

    } catch (error) {
      console.error('❌ Off-chain burn failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * @deprecated Use burnNFTsOffChain instead. Kept for backward compatibility.
   */
  async burnNFTsOptimized(walletAddress: string, nftIds: string[]): Promise<BurnResult> {
    console.log('⚠️ burnNFTsOptimized is deprecated. Use burnNFTsOffChain instead.');
    return this.burnNFTsOffChain(walletAddress, nftIds);
  }

  /**
   * Validate burn rule (same logic as before)
   */
  private validateBurnRule(nftsToBurn: NFTData[]): BurnRule | null {
    if (nftsToBurn.length === 0) return null;

    // Group NFTs by rarity
    const rarityGroups = nftsToBurn.reduce((groups, nft) => {
      const rarity = nft.rarity.toLowerCase();
      groups[rarity] = (groups[rarity] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);

    // Find matching burn rule
    for (const rule of this.burnRules) {
      const minRarity = rule.minRarity.toLowerCase();
      const maxRarity = rule.maxRarity.toLowerCase();

      if (minRarity === maxRarity) {
        // Single rarity rule
        if (rarityGroups[minRarity] === rule.requiredAmount && 
            Object.keys(rarityGroups).length === 1) {
          return rule;
        }
      }
    }

    return null;
  }

  /**
   * Get burn rules
   */
  getBurnRules(): BurnRule[] {
    return this.burnRules;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return true; // CID pool system is always configured if database is available
  }

  /**
   * Get comprehensive user NFT collection status with count tracking
   */
  async getUserDataStatus(walletAddress: string): Promise<{
    hasData: boolean;
    nftCount: number;
    lastUpdated?: string;
    rarityBreakdown?: Record<string, number>;
    countsMatch?: boolean;
    needsSync?: boolean;
  }> {
    try {
      const { data: status, error } = await this.createClientWithWalletHeader(walletAddress).rpc('get_user_collection_status', {
        p_wallet_address: walletAddress.toLowerCase()
      });

      if (error) {
        console.error('Error getting collection status:', error);
        // Fallback to basic NFT count
        const nfts = await this.getUserNFTs(walletAddress);
        return {
          hasData: nfts.length > 0,
          nftCount: nfts.length,
          lastUpdated: nfts.length > 0 ? nfts[0].created_at : undefined
        };
      }

      const liveCounts = status.live_counts;
      return {
        hasData: (liveCounts?.total_nfts || 0) > 0,
        nftCount: liveCounts?.total_nfts || 0,
        lastUpdated: status.cached_counts?.last_updated,
        rarityBreakdown: {
          common: liveCounts?.common_count || 0,
          rare: liveCounts?.rare_count || 0,
          legendary: liveCounts?.legendary_count || 0,
          platinum: liveCounts?.platinum_count || 0,
          silver: liveCounts?.silver_count || 0,
          gold: liveCounts?.gold_count || 0
        },
        countsMatch: status.counts_match,
        needsSync: status.needs_sync
      };
    } catch (error) {
      console.error('Error getting user data status:', error);
      return {
        hasData: false,
        nftCount: 0
      };
    }
  }

  /**
   * Sync user NFT collection counts
   */
  async syncUserNFTCollection(walletAddress: string): Promise<boolean> {
    try {
      console.log(`🔄 Syncing NFT collection counts for: ${walletAddress}`);

      const { data: result, error } = await this.supabase.rpc('sync_user_nft_collection', {
        p_wallet_address: walletAddress.toLowerCase()
      });

      if (error) {
        console.error('❌ Error syncing collection counts:', error);
        return false;
      }

      console.log('✅ Collection counts synced:', result);
      return result?.success || false;
    } catch (error) {
      console.error('❌ Error syncing collection counts:', error);
      return false;
    }
  }

  /**
   * Get user's NFT counts by rarity
   */
  async getUserNFTCounts(walletAddress: string): Promise<Record<string, number>> {
    try {
      const { data: counts, error } = await this.supabase.rpc('get_user_nft_counts', {
        p_wallet_address: walletAddress.toLowerCase()
      });

      if (error) {
        console.error('❌ Error getting NFT counts:', error);
        return {};
      }

      return {
        total: counts?.total_nfts || 0,
        common: counts?.common_count || 0,
        rare: counts?.rare_count || 0,
        legendary: counts?.legendary_count || 0,
        platinum: counts?.platinum_count || 0,
        silver: counts?.silver_count || 0,
        gold: counts?.gold_count || 0
      };
    } catch (error) {
      console.error('❌ Error getting NFT counts:', error);
      return {};
    }
  }

  /**
   * Test metadata fetching for debugging
   */
  async testMetadataFetch(metadataCid: string): Promise<any> {
    console.log(`🧪 Testing metadata fetch for CID: ${metadataCid}`);
    
    try {
      const metadata = await this.fetchIPFSMetadata(metadataCid);
      console.log(`🧪 Test result:`, metadata);
      return metadata;
    } catch (error) {
      console.error(`🧪 Test failed:`, error);
      return null;
    }
  }

  /**
   * Update existing NFT metadata to use improved IPFS URLs
   * Useful for migrating old metadata with outdated gateway URLs
   */
  async updateNFTMetadataIPFSUrls(walletAddress: string): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
  }> {
    try {
      console.log('🔄 Updating NFT metadata IPFS URLs for wallet:', walletAddress);
      
      const client = this.createClientWithWalletHeader(walletAddress);
      
      // Get all NFTs for the wallet
      const { data: nfts, error } = await client
        .from('user_nft_collections')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase());
      
      if (error) {
        console.error('❌ Error fetching NFTs for IPFS update:', error);
        return { success: false, updated: 0, errors: [error.message] };
      }
      
      if (!nfts || nfts.length === 0) {
        console.log('📭 No NFTs found for IPFS URL updates');
        return { success: true, updated: 0, errors: [] };
      }
      
      let updated = 0;
      const errors: string[] = [];
      
      for (const nft of nfts) {
        try {
          let needsUpdate = false;
          const updates: any = {};
          
          // Check and update image URL
          if (nft.image && (nft.image.includes('gateway.pinata.cloud') || nft.image.includes('ipfs.io'))) {
            const newImageUrl = getIPFSUrl(extractIPFSHash(nft.image) || '');
            if (newImageUrl !== nft.image) {
              updates.image = newImageUrl;
              needsUpdate = true;
              console.log(`🔄 Updating image for NFT ${nft.id}: ${nft.image} -> ${newImageUrl}`);
            }
          }
          
          // Check and update metadata_uri
          if (nft.metadata_uri && (nft.metadata_uri.includes('gateway.pinata.cloud') || nft.metadata_uri.includes('ipfs.io'))) {
            const newMetadataUri = getIPFSUrl(extractIPFSHash(nft.metadata_uri) || '');
            if (newMetadataUri !== nft.metadata_uri) {
              updates.metadata_uri = newMetadataUri;
              needsUpdate = true;
              console.log(`🔄 Updating metadata_uri for NFT ${nft.id}: ${nft.metadata_uri} -> ${newMetadataUri}`);
            }
          }
          
          // Update attributes if they contain IPFS URLs
          if (nft.attributes && Array.isArray(nft.attributes)) {
            const updatedAttributes = updateNFTMetadataIPFS({ attributes: nft.attributes }).attributes;
            if (JSON.stringify(updatedAttributes) !== JSON.stringify(nft.attributes)) {
              updates.attributes = updatedAttributes;
              needsUpdate = true;
              console.log(`🔄 Updating attributes for NFT ${nft.id}`);
            }
          }
          
          // Apply updates if needed
          if (needsUpdate) {
            const { error: updateError } = await client
              .from('user_nft_collections')
              .update(updates)
              .eq('id', nft.id);
            
            if (updateError) {
              console.error(`❌ Error updating NFT ${nft.id}:`, updateError);
              errors.push(`NFT ${nft.id}: ${updateError.message}`);
            } else {
              updated++;
              console.log(`✅ Updated NFT ${nft.id} with improved IPFS URLs`);
            }
          }
          
        } catch (nftError) {
          console.error(`❌ Error processing NFT ${nft.id}:`, nftError);
          errors.push(`NFT ${nft.id}: ${nftError.message}`);
        }
      }
      
      console.log(`✅ IPFS URL update complete: ${updated} NFTs updated, ${errors.length} errors`);
      return { success: errors.length === 0, updated, errors };
      
    } catch (error) {
      console.error('❌ Failed to update NFT metadata IPFS URLs:', error);
      return { success: false, updated: 0, errors: [error.message] };
    }
  }
}

export const optimizedCIDPoolBurnService = new OptimizedCIDPoolBurnService();
export default optimizedCIDPoolBurnService;
