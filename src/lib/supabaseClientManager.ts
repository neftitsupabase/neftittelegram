import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase URL and key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. Please check your .env file.');
}

/**
 * Centralized Supabase Client Manager
 * Prevents multiple GoTrueClient instances by using singleton pattern
 */
class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private mainClient: SupabaseClient | null = null;
  private walletClients: Map<string, SupabaseClient> = new Map();

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager();
    }
    return SupabaseClientManager.instance;
  }

  /**
   * Get the main Supabase client (singleton)
   */
  public getMainClient(): SupabaseClient {
    if (!this.mainClient) {
      console.log('🔧 Creating main Supabase client...');
      this.mainClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        },
        global: {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      });
    }
    return this.mainClient;
  }

  /**
   * Get a wallet-specific client with RLS headers (cached by wallet address)
   */
  public getWalletClient(walletAddress: string): SupabaseClient {
    // Normalize wallet address
    const normalizedWallet = walletAddress.toLowerCase();
    
    if (!this.walletClients.has(normalizedWallet)) {
      console.log(`🔧 Creating wallet-specific Supabase client for: ${normalizedWallet}`);
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        },
        global: {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-wallet-address': walletAddress  // CRITICAL: RLS header
          }
        }
      });
      this.walletClients.set(normalizedWallet, client);
    }
    
    return this.walletClients.get(normalizedWallet)!;
  }

  /**
   * Clear cached wallet clients (useful for memory management)
   */
  public clearWalletClients(): void {
    console.log('🧹 Clearing cached wallet clients...');
    this.walletClients.clear();
  }

  /**
   * Get client count for debugging
   */
  public getClientCount(): { main: number; wallet: number } {
    return {
      main: this.mainClient ? 1 : 0,
      wallet: this.walletClients.size
    };
  }
}

// Export singleton instance
const clientManager = SupabaseClientManager.getInstance();

// Export convenience functions
export const getSupabaseClient = () => clientManager.getMainClient();
export const getWalletSupabaseClient = (walletAddress: string) => clientManager.getWalletClient(walletAddress);
export const clearWalletClients = () => clientManager.clearWalletClients();
export const getClientStats = () => clientManager.getClientCount();

// Backward compatibility exports
export const supabase = getSupabaseClient();
export const createClientWithWalletHeader = getWalletSupabaseClient;

// Test connection on init (only once)
let connectionTested = false;
export const testConnection = async () => {
  if (connectionTested) return;
  connectionTested = true;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('users').select('count').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
    } else {
      console.log('✅ Supabase connection successful');
    }
  } catch (err) {
    console.error('❌ Supabase connection error:', err);
  }
};

// Auto-test connection
testConnection();

export default clientManager;
