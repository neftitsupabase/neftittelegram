import { supabase } from '@/lib/supabase';
import { nftLifecycleService } from './NFTLifecycleService';

/**
 * NFT Count Tracking Service
 * 
 * Provides real-time, scalable NFT counting for leaderboards
 * - Tracks both offchain and onchain NFTs
 * - Low egress database operations
 * - Real-time updates on claim/burn/stake operations
 * - Optimized for leaderboard performance
 */

export interface NFTCountData {
  wallet_address: string;
  offchain_nfts: number;
  onchain_nfts: number;
  total_nfts: number;
  staked_nfts: number;
  last_updated: string;
}

export interface LeaderboardUser {
  wallet_address: string;
  username: string;
  profile_image: string;
  total_nfts: number;
  offchain_nfts: number;
  onchain_nfts: number;
  staked_nfts: number;
  rank_position: number;
  is_current_user?: boolean;
}

class NFTCountTrackingService {
  /**
   * Update NFT counts for a specific user
   * Called after any NFT operation (claim, burn, stake, unstake)
   */
  async updateUserNFTCounts(walletAddress: string): Promise<NFTCountData | null> {
    try {
      console.log(`🔄 [NFTCountTracking] Updating NFT counts for wallet: ${walletAddress}`);

      // Get real-time NFT data from lifecycle service
      const [offchainNFTs, onchainNFTs] = await Promise.all([
        nftLifecycleService.loadOffchainNFTs(walletAddress),
        nftLifecycleService.loadOnchainNFTs(walletAddress)
      ]);

      // Calculate counts
      const offchainCount = offchainNFTs?.length || 0;
      const onchainCount = onchainNFTs?.length || 0;
      const totalCount = offchainCount + onchainCount;
      
      // Count staked NFTs from both sources
      const stakedOffchain = offchainNFTs?.filter(nft => nft.isStaked).length || 0;
      const stakedOnchain = onchainNFTs?.filter(nft => nft.isStaked).length || 0;
      const stakedCount = stakedOffchain + stakedOnchain;

      const countData: NFTCountData = {
        wallet_address: walletAddress.toLowerCase(),
        offchain_nfts: offchainCount,
        onchain_nfts: onchainCount,
        total_nfts: totalCount,
        staked_nfts: stakedCount,
        last_updated: new Date().toISOString()
      };

      // Upsert to database using efficient SQL
      const { data, error } = await supabase
        .from('user_nft_counts')
        .upsert(countData, {
          onConflict: 'wallet_address'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [NFTCountTracking] Database error:', error);
        throw error;
      }

      console.log(`✅ [NFTCountTracking] Updated counts:`, {
        wallet: walletAddress.slice(0, 8) + '...',
        offchain: offchainCount,
        onchain: onchainCount,
        total: totalCount,
        staked: stakedCount
      });

      return data;
    } catch (error) {
      console.error('❌ [NFTCountTracking] Failed to update NFT counts:', error);
      return null;
    }
  }

  /**
   * Get top NFT holders with efficient pagination
   * Optimized for leaderboard display with minimal egress
   */
  async getTopNFTHolders(
    limit: number = 10, 
    currentUserWallet?: string
  ): Promise<LeaderboardUser[]> {
    try {
      console.log(`🏆 [NFTCountTracking] Fetching top ${limit} NFT holders`);

      const { data, error } = await supabase.rpc('get_nft_leaderboard_optimized', {
        p_limit: limit,
        p_current_user_wallet: currentUserWallet?.toLowerCase() || null
      });

      if (error) {
        console.error('❌ [NFTCountTracking] Leaderboard query error:', error);
        throw error;
      }

      const users: LeaderboardUser[] = (data || []).map((row: any) => ({
        wallet_address: row.wallet_address,
        username: row.username || this.generateUsername(row.wallet_address),
        profile_image: row.profile_image || '/profilepictures/profileimg1.jpg',
        total_nfts: row.total_nfts || 0,
        offchain_nfts: row.offchain_nfts || 0,
        onchain_nfts: row.onchain_nfts || 0,
        staked_nfts: row.staked_nfts || 0,
        rank_position: row.rank_position || 0,
        is_current_user: row.is_current_user || false
      }));

      console.log(`📊 [NFTCountTracking] Retrieved ${users.length} leaderboard entries`);
      return users;
    } catch (error) {
      console.error('❌ [NFTCountTracking] Failed to get leaderboard:', error);
      return [];
    }
  }

  /**
   * Get current user's NFT rank and stats
   */
  async getUserNFTRank(walletAddress: string): Promise<LeaderboardUser | null> {
    try {
      const { data, error } = await supabase.rpc('get_user_nft_rank_optimized', {
        p_wallet_address: walletAddress.toLowerCase()
      });

      if (error || !data || data.length === 0) {
        console.log(`⚠️ [NFTCountTracking] No rank data found for wallet: ${walletAddress}`);
        return null;
      }

      const row = data[0];
      return {
        wallet_address: row.wallet_address,
        username: row.username || 'You',
        profile_image: row.profile_image || '/profilepictures/profileimg1.jpg',
        total_nfts: row.total_nfts || 0,
        offchain_nfts: row.offchain_nfts || 0,
        onchain_nfts: row.onchain_nfts || 0,
        staked_nfts: row.staked_nfts || 0,
        rank_position: row.rank_position || 0,
        is_current_user: true
      };
    } catch (error) {
      console.error('❌ [NFTCountTracking] Failed to get user rank:', error);
      return null;
    }
  }

  /**
   * Batch update NFT counts for multiple users
   * Useful for periodic sync operations
   */
  async batchUpdateNFTCounts(walletAddresses: string[]): Promise<void> {
    try {
      console.log(`🔄 [NFTCountTracking] Batch updating ${walletAddresses.length} wallets`);

      const updates = await Promise.allSettled(
        walletAddresses.map(wallet => this.updateUserNFTCounts(wallet))
      );

      const successful = updates.filter(result => result.status === 'fulfilled').length;
      const failed = updates.length - successful;

      console.log(`✅ [NFTCountTracking] Batch update complete: ${successful} success, ${failed} failed`);
    } catch (error) {
      console.error('❌ [NFTCountTracking] Batch update failed:', error);
    }
  }

  /**
   * Initialize NFT counts for a new user
   */
  async initializeUserCounts(walletAddress: string): Promise<void> {
    try {
      console.log(`🆕 [NFTCountTracking] Initializing counts for new user: ${walletAddress}`);
      await this.updateUserNFTCounts(walletAddress);
    } catch (error) {
      console.error('❌ [NFTCountTracking] Failed to initialize user counts:', error);
    }
  }

  /**
   * Get NFT count statistics for analytics
   */
  async getNFTStatistics(): Promise<{
    totalUsers: number;
    totalNFTs: number;
    totalOffchain: number;
    totalOnchain: number;
    totalStaked: number;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_nft_statistics');

      if (error) {
        console.error('❌ [NFTCountTracking] Statistics query error:', error);
        throw error;
      }

      return data[0] || {
        totalUsers: 0,
        totalNFTs: 0,
        totalOffchain: 0,
        totalOnchain: 0,
        totalStaked: 0
      };
    } catch (error) {
      console.error('❌ [NFTCountTracking] Failed to get statistics:', error);
      return {
        totalUsers: 0,
        totalNFTs: 0,
        totalOffchain: 0,
        totalOnchain: 0,
        totalStaked: 0
      };
    }
  }

  /**
   * Generate username from wallet address
   */
  private generateUsername(walletAddress: string): string {
    if (!walletAddress) return 'Anonymous';
    
    // For social logins
    if (walletAddress.startsWith('social:')) {
      const parts = walletAddress.split(':');
      if (parts.length >= 3) {
        const platform = parts[1];
        const identifier = parts[2].substring(0, 8);
        return `${platform}_${identifier}`;
      }
    }
    
    // For email-based logins
    if (walletAddress.includes('@')) {
      const parts = walletAddress.split('@');
      if (parts.length >= 2) {
        const platform = parts[1].split('.')[0];
        const identifier = parts[0].substring(0, 8);
        return `${platform}_${identifier}`;
      }
    }
    
    // For wallet addresses
    if (walletAddress.length > 10) {
      return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
    }
    
    return walletAddress;
  }
}

// Export singleton instance
export const nftCountTrackingService = new NFTCountTrackingService();
export default nftCountTrackingService;
