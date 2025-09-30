import { getSupabaseClient } from '../lib/supabaseClientManager';

const supabase = getSupabaseClient();

export interface UserIPFSMapping {
  wallet_address: string;
  ipfs_hash: string;
  last_updated: string;
  created_at: string;
}

class SupabaseIPFSMappingService {
  private readonly TABLE_NAME = 'user_ipfs_mappings';

  /**
   * Get IPFS hash for a wallet address
   */
  async getIPFSHash(walletAddress: string): Promise<string | null> {
    try {
      console.log(`Getting IPFS hash for wallet: ${walletAddress}`);
      
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('ipfs_hash')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - this is expected for new users
          console.log(`No IPFS mapping found for wallet: ${walletAddress}`);
          return null;
        }
        throw error;
      }

      console.log(`Found IPFS hash for wallet ${walletAddress}: ${data.ipfs_hash}`);
      return data.ipfs_hash;
    } catch (error) {
      console.error('Error getting IPFS hash:', error);
      return null;
    }
  }

  /**
   * Save IPFS hash for a wallet address
   */
  async saveIPFSHash(walletAddress: string, ipfsHash: string): Promise<boolean> {
    try {
      console.log(`Saving IPFS hash for wallet ${walletAddress}: ${ipfsHash}`);
      
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .upsert({
          wallet_address: walletAddress,
          ipfs_hash: ipfsHash,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'wallet_address'
        });

      if (error) {
        throw error;
      }

      console.log(`Successfully saved IPFS hash for wallet: ${walletAddress}`);
      return true;
    } catch (error) {
      console.error('Error saving IPFS hash:', error);
      return false;
    }
  }

  /**
   * Delete IPFS mapping for a wallet address (for cleanup/reset)
   */
  async deleteMapping(walletAddress: string): Promise<boolean> {
    try {
      console.log(`Deleting IPFS mapping for wallet: ${walletAddress}`);
      
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('wallet_address', walletAddress);

      if (error) {
        throw error;
      }

      console.log(`Successfully deleted IPFS mapping for wallet: ${walletAddress}`);
      return true;
    } catch (error) {
      console.error('Error deleting IPFS mapping:', error);
      return false;
    }
  }

  /**
   * Get all mappings (for debugging)
   */
  async getAllMappings(): Promise<UserIPFSMapping[]> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting all mappings:', error);
      return [];
    }
  }

  /**
   * Check if table exists and create it if needed
   */
  async ensureTableExists(): Promise<boolean> {
    try {
      // Try to query the table to see if it exists
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .select('count(*)')
        .limit(1);

      if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
        console.warn(`Table ${this.TABLE_NAME} does not exist. Please create it manually in Supabase.`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking table existence:', error);
      return false;
    }
  }
}

export const supabaseIPFSMapping = new SupabaseIPFSMappingService();
export default supabaseIPFSMapping;
