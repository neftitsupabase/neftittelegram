import { createClientWithWalletHeader } from '../lib/supabaseClientManager';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClaimedNFT {
  id: string;
  nft_id: string;
  wallet_address: string;
  claimed_blockchain: string;
  transaction_hash: string;
  token_id: string | null;
  contract_address: string | null;
  claimed_at: string;
  // Additional NFT metadata
  name?: string;
  image?: string;
  description?: string;
  rarity?: string;
  // Claim status
  is_claimed_onchain: boolean;
  claim_status: 'pending' | 'confirmed' | 'failed';
  metamask_compatible?: boolean;
}

export interface NFTClaimStats {
  total_claims: number;
  ethereum_claims: number;
  solana_claims: number;
  sui_claims: number;
  latest_claim_date: string | null;
}

class NFTClaimDisplayService {
  private clientCache: Map<string, SupabaseClient> = new Map();

  /**
   * Get wallet-specific Supabase client with proper headers
   */
  private getClient(walletAddress: string): SupabaseClient {
    const normalizedWallet = walletAddress.toLowerCase();
    
    if (!this.clientCache.has(normalizedWallet)) {
      const client = createClientWithWalletHeader(walletAddress);
      this.clientCache.set(normalizedWallet, client);
    }
    
    return this.clientCache.get(normalizedWallet)!;
  }

  /**
   * Fetch all claimed NFTs for a wallet address
   */
  async getClaimedNFTs(walletAddress: string): Promise<ClaimedNFT[]> {
    try {
      console.log('🔍 Fetching claimed NFTs for wallet:', walletAddress);
      
      const client = this.getClient(walletAddress);
      
      const { data, error } = await client
        .from('nft_claims')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .order('claimed_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch claimed NFTs:', error);
        return [];
      }

      console.log(`✅ Found ${data?.length || 0} claimed NFTs`);
      
      return (data || []).map(claim => ({
        id: claim.id,
        nft_id: claim.nft_id,
        wallet_address: claim.wallet_address,
        claimed_blockchain: claim.claimed_blockchain,
        transaction_hash: claim.transaction_hash,
        token_id: claim.token_id,
        contract_address: claim.contract_address,
        claimed_at: claim.claimed_at,
        is_claimed_onchain: true, // If it's in database, it was successfully claimed
        claim_status: 'confirmed',
        metamask_compatible: claim.claimed_blockchain === 'ethereum' // Ethereum/Polygon NFTs are MetaMask compatible
      }));

    } catch (error) {
      console.error('❌ Error fetching claimed NFTs:', error);
      return [];
    }
  }

  /**
   * Check if a specific NFT is already claimed by wallet
   */
  async isNFTClaimed(walletAddress: string, nftId: string): Promise<boolean> {
    try {
      const client = this.getClient(walletAddress);
      
      const { data, error } = await client
        .rpc('is_nft_claimed', {
          p_wallet_address: walletAddress.toLowerCase(),
          p_nft_id: nftId
        });

      if (error) {
        console.error('❌ Failed to check NFT claim status:', error);
        return false;
      }

      return data === true;

    } catch (error) {
      console.error('❌ Error checking NFT claim status:', error);
      return false;
    }
  }

  /**
   * Get claim statistics for a wallet
   */
  async getClaimStats(walletAddress: string): Promise<NFTClaimStats> {
    try {
      const claimedNFTs = await this.getClaimedNFTs(walletAddress);
      
      const stats: NFTClaimStats = {
        total_claims: claimedNFTs.length,
        ethereum_claims: claimedNFTs.filter(nft => nft.claimed_blockchain === 'ethereum').length,
        solana_claims: claimedNFTs.filter(nft => nft.claimed_blockchain === 'solana').length,
        sui_claims: claimedNFTs.filter(nft => nft.claimed_blockchain === 'sui').length,
        latest_claim_date: claimedNFTs.length > 0 ? claimedNFTs[0].claimed_at : null
      };

      return stats;

    } catch (error) {
      console.error('❌ Error getting claim stats:', error);
      return {
        total_claims: 0,
        ethereum_claims: 0,
        solana_claims: 0,
        sui_claims: 0,
        latest_claim_date: null
      };
    }
  }

  /**
   * Get blockchain explorer URL for transaction
   */
  getExplorerUrl(transactionHash: string, blockchain: string): string {
    switch (blockchain.toLowerCase()) {
      case 'ethereum':
        // Polygon Amoy Testnet
        return `https://amoy.polygonscan.com/tx/${transactionHash}`;
      case 'solana':
        return `https://explorer.solana.com/tx/${transactionHash}?cluster=devnet`;
      case 'sui':
        return `https://suiexplorer.com/txblock/${transactionHash}?network=testnet`;
      default:
        return '#';
    }
  }

  /**
   * Format claim date for display
   */
  formatClaimDate(claimedAt: string): string {
    try {
      const date = new Date(claimedAt);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Unknown date';
    }
  }

  /**
   * Get blockchain display name and color
   */
  getBlockchainInfo(blockchain: string): { name: string; color: string; icon: string } {
    switch (blockchain.toLowerCase()) {
      case 'ethereum':
        return { name: 'Polygon', color: 'text-purple-600', icon: '⬟' };
      case 'solana':
        return { name: 'Solana', color: 'text-green-600', icon: '◎' };
      case 'sui':
        return { name: 'Sui', color: 'text-blue-600', icon: '🌊' };
      default:
        return { name: blockchain, color: 'text-gray-600', icon: '🔗' };
    }
  }

  /**
   * Clear client cache (useful for logout)
   */
  clearCache(): void {
    this.clientCache.clear();
  }
}

// Export singleton instance
const nftClaimDisplayService = new NFTClaimDisplayService();
export default nftClaimDisplayService;
