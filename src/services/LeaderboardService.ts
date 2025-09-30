import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClientManager';

// Interface matching the existing User type from leaderboardData.ts
export interface User {
  id: string;
  username: string;
  profileImage: string;
  neftBalance: number;
  nftCount: number;
  rank: number;
  previousRank: number;
  isCurrentUser?: boolean;
}

class LeaderboardService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get top 10 NEFT holders from user_balances table
   * Uses efficient SQL function with ORDER BY + LIMIT for minimal egress
   */
  async getTopNEFTHolders(): Promise<User[]> {
    try {
      console.log('🔍 Fetching top 10 NEFT holders from Supabase...');

      const { data, error } = await this.supabase.rpc('get_top_neft_holders_with_usernames', {
        result_limit: 10
      });

      if (error) {
        console.error('❌ Error fetching NEFT leaderboard:', error);
        console.error('💡 Have you executed the leaderboard_functions_with_usernames.sql in your Supabase database?');
        throw error;
      }

      // Transform to match existing User interface with test user filtering
      const users: User[] = (data || [])
        .map((row: any) => {
          const generatedUsername = this.generateUsername(row.wallet_address, false);
          
          // Filter out test users
          if (generatedUsername === null) {
            console.log(`🚫 Filtering out test user from NEFT leaderboard: ${row.wallet_address}`);
            return null;
          }
          
          return {
            id: row.wallet_address,
            username: row.username || generatedUsername,
            profileImage: row.profile_image || '',
            neftBalance: parseFloat(row.total_neft_claimed || '0'),
            nftCount: 0,
            rank: row.rank_position,
            previousRank: row.rank_position
          };
        })
        .filter(Boolean) as User[]; // Remove null entries (filtered test users)

      // RECALCULATE RANKS after filtering test users
      const rankedUsers = users
        .sort((a, b) => b.neftBalance - a.neftBalance) // Sort by NEFT balance descending
        .map((user, index) => ({
          ...user,
          rank: index + 1, // Recalculate rank based on filtered list
          previousRank: index + 1 // Update previous rank too
        }));

      console.log(`💰 NEFT Leaderboard: ${rankedUsers.length} users with recalculated ranks (test users filtered out)`);
      rankedUsers.forEach((user, index) => {
        console.log(`🏆 Rank ${user.rank}: ${user.username} - ${user.neftBalance} NEFT`);
      });
      
      return rankedUsers;
    } catch (error) {
      console.error('Error in getTopNEFTHolders:', error);
      return [];
    }
  }

  /**
   * Get top 10 NFT holders using optimized NFT count tracking
   * Real-time counts with both offchain and onchain NFTs
   */
  async getTopNFTHolders(currentUserWallet?: string): Promise<User[]> {
    try {
      console.log('🔍 Fetching NFT holders from optimized count tracking...');

      const { data, error } = await this.supabase.rpc('get_nft_leaderboard_optimized', {
        p_limit: 10,
        p_current_user_wallet: currentUserWallet || null
      });

      if (error) {
        console.error('❌ Error fetching NFT leaderboard:', error);
        console.error('💡 Have you executed the optimized_nft_leaderboard_functions.sql in your Supabase database?');
        throw error;
      }

      // Transform to match existing User interface with deduplication logging and test user filtering
      const users: User[] = (data || [])
        .map((row: any, index: number) => {
          const isCurrentUser = row.is_current_user || false;
          const generatedUsername = this.generateUsername(row.wallet_address, isCurrentUser);
          
          // Filter out test users (generateUsername returns null for test users)
          if (generatedUsername === null) {
            console.log(`🚫 Filtering out test user: ${row.wallet_address}`);
            return null;
          }
          
          const user: User = {
            id: row.wallet_address,
            username: row.username || generatedUsername,
            profileImage: '/profilepictures/profileimg1.jpg', // Default image since we removed profile_image
            neftBalance: 0,
            nftCount: row.total_nfts,
            rank: row.rank_position,
            previousRank: row.rank_position,
            isCurrentUser: isCurrentUser
          };
          
          console.log(`📦 NFT User ${index + 1}: ${user.username} (${user.id}) - ${user.nftCount} NFTs, rank ${user.rank}${user.isCurrentUser ? ' [YOU]' : ''}`);
          return user;
        })
        .filter(Boolean) as User[]; // Remove null entries (filtered test users)

      // RECALCULATE RANKS after filtering test users
      const rankedUsers = users
        .sort((a, b) => b.nftCount - a.nftCount) // Sort by NFT count descending
        .map((user, index) => ({
          ...user,
          rank: index + 1, // Recalculate rank based on filtered list
          previousRank: index + 1 // Update previous rank too
        }));

      // Check for duplicates in the raw data
      const walletAddresses = rankedUsers.map(u => u.id.toLowerCase());
      const uniqueAddresses = [...new Set(walletAddresses)];
      if (walletAddresses.length !== uniqueAddresses.length) {
        console.warn(`⚠️ DUPLICATES DETECTED: ${walletAddresses.length} total users, ${uniqueAddresses.length} unique addresses`);
        walletAddresses.forEach((addr, index) => {
          const duplicateIndex = walletAddresses.indexOf(addr);
          if (duplicateIndex !== index) {
            console.warn(`🔍 Duplicate found: ${rankedUsers[index].username} (${addr}) at positions ${duplicateIndex} and ${index}`);
          }
        });
      }

      console.log(`📊 NFT Leaderboard (optimized): ${rankedUsers.length} users with recalculated ranks`);
      rankedUsers.forEach((user, index) => {
        console.log(`🏆 Rank ${user.rank}: ${user.username} - ${user.nftCount} NFTs`);
      });
      
      return rankedUsers;
    } catch (error) {
      console.error('Error in getTopNFTHolders:', error);
      return [];
    }
  }

  /**
   * Get current user's position in NEFT leaderboard
   */
  async getCurrentUserNEFT(walletAddress: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase.rpc('get_user_neft_rank_with_username', {
        user_wallet: walletAddress
      });

      if (error || !data || data.length === 0) {
        return null;
      }

      const row = data[0];
      return {
        id: row.wallet_address,
        username: row.username || 'You', // Always show "You" for current user
        profileImage: row.profile_image || '',
        neftBalance: parseFloat(row.total_neft_claimed || '0'),
        nftCount: 0,
        rank: row.rank_position,
        previousRank: row.rank_position,
        isCurrentUser: true
      };
    } catch (error) {
      console.error('Error getting user NEFT rank:', error);
      return null;
    }
  }

  /**
   * Get current user's position in NFT leaderboard using optimized function
   * Calculates rank based on filtered leaderboard (excluding test users)
   */
  async getCurrentUserNFT(walletAddress: string): Promise<User | null> {
    try {
      console.log('🔍 Getting user NFT rank from filtered leaderboard...');

      // Get the full filtered leaderboard to calculate accurate rank
      const fullLeaderboard = await this.getTopNFTHolders(walletAddress);
      
      // Find current user in the filtered leaderboard
      const currentUserInLeaderboard = fullLeaderboard.find(user => 
        user.id.toLowerCase() === walletAddress.toLowerCase() || user.isCurrentUser
      );
      
      if (currentUserInLeaderboard) {
        console.log(`📦 Current user found in leaderboard: Rank ${currentUserInLeaderboard.rank} with ${currentUserInLeaderboard.nftCount} NFTs`);
        return currentUserInLeaderboard;
      }

      // Fallback: Get user data directly if not in top leaderboard
      const { data, error } = await this.supabase.rpc('get_user_nft_rank_optimized', {
        p_wallet_address: walletAddress
      });

      if (error || !data || data.length === 0) {
        console.log(`⚠️ No NFT rank data found for wallet: ${walletAddress}`);
        return null;
      }

      const row = data[0];
      
      // Calculate accurate rank by counting users with higher NFT counts (excluding test users)
      const { data: higherRankData, error: rankError } = await this.supabase.rpc('get_nft_leaderboard_optimized', {
        p_limit: 1000, // Get more users to calculate accurate rank
        p_current_user_wallet: null
      });
      
      let calculatedRank = 1;
      if (!rankError && higherRankData) {
        // Filter out test users and count those with higher NFT counts
        const filteredUsers = higherRankData.filter((user: any) => {
          const normalizedAddress = user.wallet_address.toLowerCase().trim();
          return !(normalizedAddress.includes('test_user') || 
                   normalizedAddress.startsWith('test') ||
                   normalizedAddress.includes('testuser'));
        });
        
        calculatedRank = filteredUsers.filter((user: any) => user.total_nfts > row.total_nfts).length + 1;
      }

      const user: User = {
        id: row.wallet_address,
        username: row.username || 'You', // Always show "You" for current user
        profileImage: '/profilepictures/profileimg1.jpg', // Default image since we removed profile_image
        neftBalance: 0,
        nftCount: row.total_nfts,
        rank: calculatedRank, // Use calculated rank based on filtered data
        previousRank: calculatedRank,
        isCurrentUser: true
      };

      console.log(`📦 Current user NFT rank (calculated): ${user.rank} with ${user.nftCount} NFTs (${row.offchain_nfts} offchain + ${row.onchain_nfts} onchain)`);
      return user;
    } catch (error) {
      console.error('Error getting user NFT rank:', error);
      return null;
    }
  }

  /**
   * Generate a clean username from wallet address (no test user prefixes)
   */
  private generateUsername(walletAddress: string, isCurrentUser: boolean = false): string {
    if (!walletAddress) return 'Anonymous';
    
    // Normalize the wallet address for consistent processing
    const normalizedAddress = walletAddress.toLowerCase().trim();
    
    // For current user, always show "You" instead of wallet address
    if (isCurrentUser) {
      return 'You';
    }
    
    // Filter out test user patterns - don't show them in leaderboard
    if (normalizedAddress.includes('test_user') || 
        normalizedAddress.startsWith('test') ||
        normalizedAddress.includes('testuser')) {
      return null; // Signal to filter out this user
    }
    
    // For social logins like "social:google:108308658811682407572"
    if (normalizedAddress.startsWith('social:')) {
      const parts = normalizedAddress.split(':');
      if (parts.length >= 3) {
        const platform = parts[1]; // google, twitter, etc
        const identifier = parts[2].substring(0, 8);
        return `${platform}_${identifier}`;
      }
    }
    
    // For email-based logins
    if (normalizedAddress.includes('@')) {
      const parts = normalizedAddress.split('@');
      if (parts.length >= 2) {
        const platform = parts[1].split('.')[0];
        const identifier = parts[0].substring(0, 8);
        return `${platform}_${identifier}`;
      }
    }
    
    // For wallet addresses starting with 0x, create a more readable version
    if (normalizedAddress.startsWith('0x') && normalizedAddress.length > 10) {
      return `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(normalizedAddress.length - 4)}`;
    }
    
    // For other addresses, create a shortened version
    if (normalizedAddress.length > 10) {
      return `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(normalizedAddress.length - 4)}`;
    }
    
    return normalizedAddress;
  }

  /**
   * Generate a profile image URL based on wallet address
   */
  private generateProfileImage(walletAddress: string): string {
    // Always return the default avatar - users can change it in edit profile
    return '/profilepictures/profileimg1.jpg';
  }
}

// Export singleton instance
const leaderboardService = new LeaderboardService();
export default leaderboardService;
