import { getWalletSupabaseClient } from '../lib/SupabaseClientManager';
import { getWalletAddress } from '@/utils/authUtils';

export interface NFTClaimStatus {
  is_claimed: boolean;
  can_claim: boolean;
  claimed_blockchain: string | null;
  claimed_at: string | null;
  transaction_hash: string | null;
  wallet_address: string | null;
}

export interface ClaimResult {
  success: boolean;
  error?: string;
  claim_id?: string;
  blockchain_type?: string;
  transaction_hash?: string;
  claimed_blockchain?: string;
  claimed_at?: string;
}

export interface BlockchainClaim {
  nft_id: string;
  blockchain_type: string;
  transaction_hash: string;
  token_id: string;
  wallet_address: string;
  claimed_at: string;
}

export class NFTClaimTrackingService {

  /**
   * Check if an NFT has already been claimed by the user
   */
  async checkNFTClaimStatus(nftId: string): Promise<NFTClaimStatus> {
    const walletAddress = getWalletAddress();
    
    if (!walletAddress) {
      return {
        is_claimed: false,
        can_claim: false,
        claimed_blockchain: null,
        claimed_at: null,
        transaction_hash: null,
        wallet_address: null
      };
    }

    try {
      const supabase = getWalletSupabaseClient(walletAddress);
      
      // Try to query the nft_claims table directly
      const { data, error } = await supabase
        .from('nft_claims')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('nft_id', nftId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      // If table doesn't exist or other database error, allow claiming
      if (error) {
        console.warn('NFT claims table not accessible, allowing claim:', error.message);
        return {
          is_claimed: false,
          can_claim: true,
          claimed_blockchain: null,
          claimed_at: null,
          transaction_hash: null,
          wallet_address: walletAddress
        };
      }

      if (data) {
        // NFT has been claimed
        return {
          is_claimed: true,
          can_claim: false,
          claimed_blockchain: data.blockchain_type,
          claimed_at: data.claimed_at,
          transaction_hash: data.transaction_hash,
          wallet_address: data.wallet_address
        };
      } else {
        // NFT has not been claimed yet
        return {
          is_claimed: false,
          can_claim: true,
          claimed_blockchain: null,
          claimed_at: null,
          transaction_hash: null,
          wallet_address: walletAddress
        };
      }
    } catch (error) {
      console.warn('Failed to check NFT claim status, allowing claim:', error);
      // Return safe default on any error - allow claiming
      return {
        is_claimed: false,
        can_claim: true,
        claimed_blockchain: null,
        claimed_at: null,
        transaction_hash: null,
        wallet_address: walletAddress
      };
    }
  }

  /**
   * Record an NFT claim to prevent duplicate claims
   */
  async recordNFTClaim(
    nftId: string,
    blockchainType: 'ethereum' | 'solana' | 'sui',
    blockchainAddress: string,
    transactionHash: string,
    tokenId: string,
    walletAddress: string
  ): Promise<ClaimResult> {
    const userAddress = getWalletAddress();
    if (!userAddress) {
      throw new Error('User not authenticated');
    }

    try {
      const supabase = getWalletSupabaseClient(userAddress);
      
      const { data, error } = await supabase.rpc('record_nft_claim', {
        p_user_id: userAddress,
        p_nft_id: nftId,
        p_blockchain_type: blockchainType,
        p_blockchain_address: blockchainAddress,
        p_transaction_hash: transactionHash,
        p_token_id: tokenId,
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('Error recording NFT claim:', error);
        throw new Error(`Failed to record claim: ${error.message}`);
      }

      return data as ClaimResult;
    } catch (error) {
      console.error('Error in recordNFTClaim:', error);
      throw error;
    }
  }

  /**
   * Get all blockchain claims for the current user
   */
  async getUserBlockchainClaims(): Promise<BlockchainClaim[]> {
    const walletAddress = getWalletAddress();
    if (!walletAddress) {
      throw new Error('User not authenticated');
    }

    try {
      const supabase = getWalletSupabaseClient(walletAddress);
      
      const { data, error } = await supabase.rpc('get_user_blockchain_claims', {
        p_user_id: walletAddress
      });

      if (error) {
        console.error('Error getting user blockchain claims:', error);
        throw new Error(`Failed to get claims: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserBlockchainClaims:', error);
      throw error;
    }
  }

  /**
   * Check if user can claim a specific NFT (wrapper for UI components)
   */
  async canClaimNFT(nftId: string): Promise<boolean> {
    try {
      const status = await this.checkNFTClaimStatus(nftId);
      return status.can_claim;
    } catch (error) {
      console.error('Error checking if can claim NFT:', error);
      return false; // Default to not allowing claim on error
    }
  }

  /**
   * Get claim status with user-friendly formatting
   */
  async getFormattedClaimStatus(nftId: string): Promise<{
    canClaim: boolean;
    statusMessage: string;
    claimedInfo?: {
      blockchain: string;
      date: string;
      txHash: string;
    };
  }> {
    try {
      const status = await this.checkNFTClaimStatus(nftId);
      
      if (status.can_claim) {
        return {
          canClaim: true,
          statusMessage: 'Available to claim'
        };
      } else {
        const claimedDate = status.claimed_at ? 
          new Date(status.claimed_at).toLocaleDateString() : 'Unknown';
        
        return {
          canClaim: false,
          statusMessage: `Already claimed to ${status.claimed_blockchain}`,
          claimedInfo: {
            blockchain: status.claimed_blockchain || 'Unknown',
            date: claimedDate,
            txHash: status.transaction_hash || ''
          }
        };
      }
    } catch (error) {
      console.error('Error getting formatted claim status:', error);
      return {
        canClaim: false,
        statusMessage: 'Error checking claim status'
      };
    }
  }
}

export const nftClaimTrackingService = new NFTClaimTrackingService();
