import { getSupabaseClient } from '../lib/supabaseClientManager';

export type NFTRarity = 'common' | 'rare' | 'legendary' | 'platinum' | 'silver' | 'gold';

export interface NFTCIDPool {
  id: number;
  rarity: NFTRarity;
  cid: string;
  image_url: string;
  metadata_cid?: string;
  is_distributed: boolean;
  distributed_to_wallet?: string;
  distributed_at?: string;
}

export interface UniqueNFTData {
  id: string;
  name: string;
  description: string;
  image: string;
  rarity: string;
  cid: string;
  metadata_cid?: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface CIDDistributionResult {
  success: boolean;
  nft_data?: UniqueNFTData;
  error?: string;
}

export interface CIDAvailabilityStats {
  rarity: string;
  total_count: number;
  available_count: number;
  distributed_count: number;
}

class UniqueCIDDistributionService {
  /**
   * Distribute a unique NFT CID to a user for specified rarity
   */
  async distributeUniqueNFT(
    walletAddress: string, 
    rarity: 'common' | 'rare' | 'legendary'
  ): Promise<CIDDistributionResult> {
    try {
      console.log(`🎯 Distributing unique ${rarity} NFT to wallet: ${walletAddress}`);

      const { data, error } = await getSupabaseClient().rpc('distribute_unique_nft', {
        wallet_address: walletAddress.toLowerCase(),
        target_rarity: rarity
      });

      if (error) {
        console.error('❌ Database error distributing unique NFT:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`
        };
      }

      if (!data?.success) {
        console.error('❌ Distribution failed:', data?.error);
        return {
          success: false,
          error: data?.error || 'Unknown distribution error'
        };
      }

      console.log('✅ Successfully distributed unique NFT:', data.nft_data);
      return {
        success: true,
        nft_data: data.nft_data
      };

    } catch (error: any) {
      console.error('❌ Error in distributeUniqueNFT:', error);
      return {
        success: false,
        error: error.message || 'Failed to distribute unique NFT'
      };
    }
  }

  /**
   * Get availability statistics for all rarity tiers
   */
  async getCIDAvailabilityStats(): Promise<CIDAvailabilityStats[]> {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_available_cid_counts');

      if (error) {
        console.error('❌ Error fetching CID availability stats:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Error in getCIDAvailabilityStats:', error);
      return [];
    }
  }

  /**
   * Check if CIDs are available for a specific rarity
   */
  async checkCIDAvailability(rarity: 'common' | 'rare' | 'legendary'): Promise<{
    available: boolean;
    count: number;
  }> {
    try {
      const stats = await this.getCIDAvailabilityStats();
      const rarityStats = stats.find(s => s.rarity === rarity);
      
      return {
        available: (rarityStats?.available_count || 0) > 0,
        count: rarityStats?.available_count || 0
      };
    } catch (error: any) {
      console.error('❌ Error checking CID availability:', error);
      return { available: false, count: 0 };
    }
  }

  /**
   * Get distribution history for a wallet
   */
  async getWalletDistributionHistory(walletAddress: string): Promise<Array<{
    nft_id: string;
    rarity: string;
    cid: string;
    distributed_at: string;
  }>> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('nft_cid_distribution_log')
        .select('nft_id, rarity, cid, distributed_at')
        .eq('wallet_address', walletAddress.toLowerCase())
        .order('distributed_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching distribution history:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Error in getWalletDistributionHistory:', error);
      return [];
    }
  }

  /**
   * Batch distribute multiple NFTs to different users
   */
  async batchDistributeNFTs(distributions: Array<{
    walletAddress: string;
    rarity: 'common' | 'rare' | 'legendary';
  }>): Promise<Array<CIDDistributionResult & { walletAddress: string }>> {
    const results: Array<CIDDistributionResult & { walletAddress: string }> = [];

    for (const { walletAddress, rarity } of distributions) {
      const result = await this.distributeUniqueNFT(walletAddress, rarity);
      results.push({
        ...result,
        walletAddress
      });

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Get next available CID for preview (without distributing)
   */
  async previewNextCID(rarity: NFTRarity): Promise<{
    cid?: string;
    image_url?: string;
    available: boolean;
  }> {
    try {
      const { data, error } = await getSupabaseClient().rpc('get_next_available_cid', {
        target_rarity: rarity
      });

      if (error || !data || data.length === 0) {
        return { available: false };
      }

      const nextCID = data[0];
      return {
        cid: nextCID.cid,
        image_url: nextCID.image_url,
        available: true
      };
    } catch (error: any) {
      console.error('❌ Error previewing next CID:', error);
      return { available: false };
    }
  }

  /**
   * Validate that a CID hasn't been distributed
   */
  async validateCIDAvailability(cid: string): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('nft_cid_pools')
        .select('is_distributed')
        .eq('cid', cid)
        .single();

      if (error || !data) {
        return false;
      }

      return !data.is_distributed;
    } catch (error: any) {
      console.error('❌ Error validating CID availability:', error);
      return false;
    }
  }
}

export const uniqueCIDDistributionService = new UniqueCIDDistributionService();
