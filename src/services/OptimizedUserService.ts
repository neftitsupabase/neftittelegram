import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClientManager';

interface UserProfile {
  id: string;
  wallet_address: string;
  username?: string;
  avatar_url?: string;
  level?: number;
  xp?: number;
  created_at?: string;
  updated_at?: string;
}

interface UserDashboard {
  profile: UserProfile | null;
  balance: {
    neft_balance: number;
    xp_balance: number;
    staked_amount: number;
  };
  achievements: {
    total: number;
    completed: number;
    completion_percentage: number;
  };
  recent_activity: Array<{
    id: string;
    type: string;
    description: string;
    created_at: string;
  }>;
}

class OptimizedUserService {
  private supabase: SupabaseClient;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get user profile with smart caching
   */
  async getUserProfile(walletAddress: string): Promise<UserProfile | null> {
    const cacheKey = `profile_${walletAddress}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`Returning cached profile for ${walletAddress}`);
      return cached.data;
    }

    try {
      console.log(`Fetching fresh profile for ${walletAddress}`);
      const { data, error } = await this.supabase
        .from('users')
        .select('id, wallet_address, username, avatar_url, level, xp, created_at, updated_at')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      if (data) {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }

  /**
   * Get complete user dashboard data in single RPC call
   */
  async getUserDashboard(walletAddress: string): Promise<UserDashboard | null> {
    const cacheKey = `dashboard_${walletAddress}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`Returning cached dashboard for ${walletAddress}`);
      return cached.data;
    }

    try {
      console.log(`Fetching fresh dashboard for ${walletAddress}`);
      const { data, error } = await this.supabase.rpc('get_user_dashboard_data', {
        user_wallet_address: walletAddress
      });

      if (error) {
        console.error('Error fetching user dashboard:', error);
        return null;
      }

      if (data && data.length > 0) {
        const dashboardData = data[0];
        this.cache.set(cacheKey, { data: dashboardData, timestamp: Date.now() });
        return dashboardData;
      }
      return null;
    } catch (error) {
      console.error('Error in getUserDashboard:', error);
      return null;
    }
  }

  /**
   * Get user balance with caching
   */
  async getUserBalance(walletAddress: string): Promise<{ neft_balance: number; xp_balance: number; staked_amount: number } | null> {
    const cacheKey = `balance_${walletAddress}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const { data, error } = await this.supabase
        .from('user_balances')
        .select('neft_balance, xp_balance, staked_amount')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) {
        console.error('Error fetching user balance:', error);
        return null;
      }

      if (data) {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } catch (error) {
      console.error('Error in getUserBalance:', error);
      return null;
    }
  }

  /**
   * Clear cache for specific user
   */
  clearUserCache(walletAddress: string): void {
    const keysToDelete = [
      `profile_${walletAddress}`,
      `dashboard_${walletAddress}`,
      `balance_${walletAddress}`
    ];
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`Cleared cache for ${walletAddress}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
    console.log('Cleared all cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

export const optimizedUserService = new OptimizedUserService();
export default optimizedUserService;
