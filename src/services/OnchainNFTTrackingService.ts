import { SupabaseClient } from '@supabase/supabase-js';
import { getWalletSupabaseClient } from '../lib/supabaseClientManager';

export interface OnchainNFTData {
  tokenId: string;
  name: string;
  rarity: string;
  image: string;
  metadata_uri?: string;
  isStaked?: boolean;
  attributes?: any[];
}

export interface NFTCounts {
  total_nfts: number;
  common_count: number;
  rare_count: number;
  legendary_count: number;
  platinum_count: number;
  silver_count: number;
  gold_count: number;
  staked_count?: number;
  available_count?: number;
}

export interface ComprehensiveNFTCounts {
  wallet_address: string;
  offchain_counts: NFTCounts;
  onchain_counts: NFTCounts;
  combined_counts: NFTCounts;
  has_onchain_data: boolean;
  needs_onchain_sync: boolean;
}

class OnchainNFTTrackingService {
  private createClient(walletAddress: string): SupabaseClient {
    return getWalletSupabaseClient(walletAddress);
  }

  /**
   * Sync onchain NFTs to database tracking system
   */
  async syncOnchainNFTsToDatabase(
    walletAddress: string, 
    onchainNFTs: OnchainNFTData[]
  ): Promise<{ success: boolean; synced_nfts: number; onchain_counts: NFTCounts }> {
    try {
      console.log(`🔄 Syncing ${onchainNFTs.length} onchain NFTs to database for wallet: ${walletAddress}`);
      
      const client = this.createClient(walletAddress);
      
      // Convert NFTs to JSONB format for database function
      const nftJsonArray = onchainNFTs.map(nft => ({
        tokenId: nft.tokenId,
        name: nft.name,
        rarity: this.normalizeRarity(nft.rarity),
        image: nft.image,
        metadata_uri: nft.metadata_uri,
        isStaked: nft.isStaked || false,
        attributes: nft.attributes || []
      }));

      const { data, error } = await client.rpc('sync_onchain_nfts_to_collection', {
        p_wallet_address: walletAddress,
        p_onchain_nfts: nftJsonArray
      });

      if (error) {
        console.error('❌ Error syncing onchain NFTs:', error);
        throw new Error(`Failed to sync onchain NFTs: ${error.message}`);
      }

      console.log('✅ Onchain NFTs synced successfully:', data);
      return {
        success: data.success,
        synced_nfts: data.synced_nfts,
        onchain_counts: data.onchain_counts
      };

    } catch (error) {
      console.error('❌ Error in syncOnchainNFTsToDatabase:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive NFT counts (offchain + onchain)
   */
  async getComprehensiveNFTCounts(walletAddress: string): Promise<ComprehensiveNFTCounts> {
    try {
      console.log(`📊 Getting comprehensive NFT counts for wallet: ${walletAddress}`);
      
      const client = this.createClient(walletAddress);

      const { data, error } = await client.rpc('get_comprehensive_nft_counts', {
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('❌ Error getting comprehensive NFT counts:', error);
        throw new Error(`Failed to get comprehensive NFT counts: ${error.message}`);
      }

      console.log('✅ Comprehensive NFT counts retrieved:', data);
      return data as ComprehensiveNFTCounts;

    } catch (error) {
      console.error('❌ Error in getComprehensiveNFTCounts:', error);
      throw error;
    }
  }

  /**
   * Auto-sync onchain NFTs when loading NFTs in components
   */
  async autoSyncOnchainNFTs(walletAddress: string, onchainNFTs: any[]): Promise<void> {
    try {
      console.log(`🔄 Auto-syncing ${onchainNFTs.length} onchain NFTs for wallet: ${walletAddress}`);
      console.log(`📋 NFT data to sync:`, onchainNFTs);
      
      // Convert onchain NFTs to tracking format
      const trackingData = onchainNFTs.map(nft => this.convertBlockchainNFTToTrackingFormat(nft));
      console.log(`📋 Converted tracking data:`, trackingData);
      
      await this.syncOnchainNFTsToDatabase(walletAddress, trackingData);
      console.log(`✅ Auto-sync completed for wallet: ${walletAddress}`);
      
      // Verify sync worked by getting counts
      const counts = await this.getComprehensiveNFTCounts(walletAddress);
      console.log(`📊 Verification - comprehensive counts after sync:`, counts);
      
    } catch (error) {
      console.error('❌ Error in autoSyncOnchainNFTs:', error);
      console.error('Full error details:', error);
      // Don't throw - this is non-critical for UI functionality
    }
  }

  /**
   * Normalize rarity values to standard format
   */
  private normalizeRarity(rarity: string): string {
    if (!rarity) return 'common';
    
    const normalized = rarity.toLowerCase().trim();
    const validRarities = ['common', 'rare', 'legendary', 'platinum', 'silver', 'gold'];
    
    return validRarities.includes(normalized) ? normalized : 'common';
  }

  /**
   * Extract rarity from NFT metadata or attributes
   */
  extractRarityFromNFT(nft: any): string {
    // Try multiple sources for rarity
    if (nft.rarity) return this.normalizeRarity(nft.rarity);
    
    if (nft.attributes && Array.isArray(nft.attributes)) {
      const rarityAttr = nft.attributes.find((attr: any) => 
        attr.trait_type?.toLowerCase() === 'rarity' || 
        attr.name?.toLowerCase() === 'rarity'
      );
      if (rarityAttr) return this.normalizeRarity(rarityAttr.value);
    }
    
    if (nft.metadata?.attributes && Array.isArray(nft.metadata.attributes)) {
      const rarityAttr = nft.metadata.attributes.find((attr: any) => 
        attr.trait_type?.toLowerCase() === 'rarity' || 
        attr.name?.toLowerCase() === 'rarity'
      );
      if (rarityAttr) return this.normalizeRarity(rarityAttr.value);
    }
    
    // Try to extract from name
    if (nft.name) {
      const name = nft.name.toLowerCase();
      if (name.includes('platinum')) return 'platinum';
      if (name.includes('legendary')) return 'legendary';
      if (name.includes('rare')) return 'rare';
      if (name.includes('gold')) return 'gold';
      if (name.includes('silver')) return 'silver';
    }
    
    return 'common';
  }

  /**
   * Convert blockchain NFT to tracking format
   */
  convertBlockchainNFTToTrackingFormat(blockchainNFT: any): OnchainNFTData {
    return {
      tokenId: blockchainNFT.tokenId?.toString() || blockchainNFT.id?.toString() || '0',
      name: blockchainNFT.name || blockchainNFT.metadata?.name || `NFT #${blockchainNFT.tokenId}`,
      rarity: this.extractRarityFromNFT(blockchainNFT),
      image: blockchainNFT.image || blockchainNFT.metadata?.image || '',
      metadata_uri: blockchainNFT.metadata_uri || blockchainNFT.tokenURI,
      isStaked: blockchainNFT.isStaked || false,
      attributes: blockchainNFT.attributes || blockchainNFT.metadata?.attributes || []
    };
  }
}

export const onchainNFTTrackingService = new OnchainNFTTrackingService();
export default onchainNFTTrackingService;
