import { getSupabaseClient } from '../lib/supabaseClientManager';
import { NFTData } from './HybridIPFSService';

const supabase = getSupabaseClient();

export interface NFTCollectionRecord {
  id: number;
  nft_id: string;
  wallet_address: string;
  name: string;
  rarity: string;
  tier: number;
  metadata_uri?: string;
  is_active: boolean;
  created_from: string;
  created_at: string;
  burned_at?: string;
  burn_transaction_id?: string;
}

export interface WalletNFTStats {
  total_nfts: number;
  active_nfts: number;
  burned_nfts: number;
  rarity_breakdown: Record<string, { total: number; active: number }>;
}

class NFTCollectionService {
  private readonly TABLE_NAME = 'nft_collections';

  /**
   * Sync NFT data from burn operations to database
   */
  async syncNFTFromBurn(nftData: NFTData, createdFrom: string = 'burn'): Promise<boolean> {
    try {
      console.log(`Syncing NFT to database: ${nftData.id} for wallet ${nftData.wallet_address}`);

      const { error } = await supabase.rpc('sync_nft_from_burn', {
        p_nft_id: nftData.id,
        p_wallet_address: nftData.wallet_address,
        p_name: nftData.name,
        p_rarity: nftData.rarity || 'Common',
        p_tier: nftData.tier || 1,
        p_metadata_uri: nftData.metadata_uri || null,
        p_created_from: createdFrom
      });

      if (error) {
        console.error('Error syncing NFT to database:', error);
        return false;
      }

      console.log(`Successfully synced NFT ${nftData.id} to database`);
      return true;
    } catch (error) {
      console.error('Error syncing NFT from burn:', error);
      return false;
    }
  }

  /**
   * Mark NFTs as burned in the database
   */
  async markNFTsAsBurned(nftIds: string[], burnTransactionId: string): Promise<number> {
    try {
      console.log(`Marking ${nftIds.length} NFTs as burned with transaction ID: ${burnTransactionId}`);

      const { data, error } = await supabase.rpc('mark_nfts_as_burned', {
        p_nft_ids: nftIds,
        p_burn_transaction_id: burnTransactionId
      });

      if (error) {
        console.error('Error marking NFTs as burned:', error);
        return 0;
      }

      const updatedCount = data || 0;
      console.log(`Successfully marked ${updatedCount} NFTs as burned`);
      return updatedCount;
    } catch (error) {
      console.error('Error marking NFTs as burned:', error);
      return 0;
    }
  }

  /**
   * Get NFT collection stats for a wallet
   */
  async getWalletNFTStats(walletAddress: string): Promise<WalletNFTStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_wallet_nft_stats', {
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('Error getting wallet NFT stats:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return {
          total_nfts: 0,
          active_nfts: 0,
          burned_nfts: 0,
          rarity_breakdown: {}
        };
      }

      return data[0];
    } catch (error) {
      console.error('Error getting wallet NFT stats:', error);
      return null;
    }
  }

  /**
   * Sync multiple NFTs from a user's collection
   */
  async syncUserNFTCollection(walletAddress: string, nfts: NFTData[], createdFrom: string = 'burn'): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    console.log(`Syncing ${nfts.length} NFTs for wallet ${walletAddress}`);

    for (const nft of nfts) {
      const success = await this.syncNFTFromBurn(nft, createdFrom);
      if (success) {
        synced++;
      } else {
        failed++;
      }
    }

    console.log(`Sync complete for ${walletAddress}: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  /**
   * Get active NFTs for a wallet (for leaderboard counting)
   */
  async getActiveNFTCount(walletAddress: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress)
        .eq('is_active', true);

      if (error) {
        console.error('Error getting active NFT count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error getting active NFT count:', error);
      return 0;
    }
  }

  /**
   * Get all NFT collections for debugging
   */
  async getAllCollections(limit: number = 100): Promise<NFTCollectionRecord[]> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting all collections:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting all collections:', error);
      return [];
    }
  }

  /**
   * Clear all NFT data for a wallet (for debugging/reset)
   */
  async clearWalletNFTs(walletAddress: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error clearing wallet NFTs:', error);
        return false;
      }

      console.log(`Cleared all NFT data for wallet: ${walletAddress}`);
      return true;
    } catch (error) {
      console.error('Error clearing wallet NFTs:', error);
      return false;
    }
  }
}

export const nftCollectionService = new NFTCollectionService();
export default nftCollectionService;
