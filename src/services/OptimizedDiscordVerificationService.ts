import { supabase } from '@/lib/supabase';

export interface DiscordRoleStatus {
  userId: string;
  guildId: string;
  roles: string[];
  verifiedAt: string;
  expiresAt: string;
}

export interface BatchDiscordVerificationResult {
  success: boolean;
  message: string;
  roleStatus: Record<string, boolean>; // roleId -> hasRole
  error?: string;
}

export class OptimizedDiscordVerificationService {
  private static readonly GUILD_ID = '1369232763709947914';
  private static readonly CACHE_DURATION_HOURS = 2; // Cache for 2 hours
  
  // All badge role IDs in one place
  private static readonly BADGE_ROLE_IDS = [
    '1369238686436163625', // OG Discord Badge
    '1382430133692141598', // Kysie Badge
    '1382429731613310996', // Zylo Badge
    '1382430296602841179'  // Dozi Badge
  ];

  /**
   * Batch verify all Discord roles for a user in a single API call
   * This reduces Discord API calls from 4 to 1 (75% reduction)
   */
  static async batchVerifyDiscordRoles(discordUserId: string): Promise<BatchDiscordVerificationResult> {
    try {
      console.log('🚀 Batch verifying Discord roles for user:', discordUserId);
      
      // First check cache
      const cachedResult = await this.getCachedRoleStatus(discordUserId);
      if (cachedResult && this.isCacheValid(cachedResult.expiresAt)) {
        console.log('✅ Using cached Discord role verification');
        return this.convertCachedToResult(cachedResult);
      }

      // If no cache or expired, make single API call
      console.log('🔄 Cache miss/expired, making Discord API call...');
      const apiResult = await this.callDiscordAPI(discordUserId);
      
      if (apiResult.success) {
        // Cache the result
        await this.cacheRoleStatus(discordUserId, apiResult.roleStatus);
        console.log('💾 Cached Discord role verification result');
      }

      return apiResult;
    } catch (error) {
      console.error('❌ Batch Discord verification error:', error);
      return {
        success: false,
        message: 'Failed to verify Discord roles',
        roleStatus: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Single API call to Discord backend to check all roles
   */
  private static async callDiscordAPI(discordUserId: string): Promise<BatchDiscordVerificationResult> {
    try {
      const response = await fetch('http://localhost:3001/verify-discord-roles-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          discordUserId,
          roleIds: this.BADGE_ROLE_IDS,
          guildId: this.GUILD_ID
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Failed to verify Discord roles',
          roleStatus: {},
          error: data.error || 'HTTP error'
        };
      }

      return {
        success: true,
        message: 'Discord roles verified successfully',
        roleStatus: data.roleStatus || {}
      };
    } catch (error) {
      console.error('❌ Discord API call error:', error);
      return {
        success: false,
        message: 'Failed to connect to Discord service',
        roleStatus: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if user has a specific role (from cached data)
   */
  static async hasRole(discordUserId: string, roleId: string): Promise<boolean> {
    try {
      const cachedResult = await this.getCachedRoleStatus(discordUserId);
      if (cachedResult && this.isCacheValid(cachedResult.expiresAt)) {
        return cachedResult.roles.includes(roleId);
      }
      
      // If no cache, make a single batch call
      const result = await this.batchVerifyDiscordRoles(discordUserId);
      return result.roleStatus[roleId] || false;
    } catch (error) {
      console.error('❌ Role check error:', error);
      return false;
    }
  }

  /**
   * Cache role verification results in Supabase
   */
  private static async cacheRoleStatus(discordUserId: string, roleStatus: Record<string, boolean>): Promise<void> {
    try {
      const roles = Object.keys(roleStatus).filter(roleId => roleStatus[roleId]);
      const expiresAt = new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('discord_role_cache')
        .upsert({
          user_id: discordUserId,
          guild_id: this.GUILD_ID,
          roles: roles,
          verified_at: new Date().toISOString(),
          expires_at: expiresAt
        }, {
          onConflict: 'user_id,guild_id'
        });

      if (error) {
        console.error('❌ Failed to cache role status:', error);
      }
    } catch (error) {
      console.error('❌ Caching error:', error);
    }
  }

  /**
   * Get cached role status from Supabase
   */
  private static async getCachedRoleStatus(discordUserId: string): Promise<DiscordRoleStatus | null> {
    try {
      const { data, error } = await supabase
        .from('discord_role_cache')
        .select('*')
        .eq('user_id', discordUserId)
        .eq('guild_id', this.GUILD_ID)
        .single();

      if (error || !data) {
        return null;
      }

      return data as DiscordRoleStatus;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if cache is still valid
   */
  private static isCacheValid(expiresAt: string): boolean {
    return new Date(expiresAt) > new Date();
  }

  /**
   * Convert cached data to verification result
   */
  private static convertCachedToResult(cached: DiscordRoleStatus): BatchDiscordVerificationResult {
    const roleStatus: Record<string, boolean> = {};
    
    this.BADGE_ROLE_IDS.forEach(roleId => {
      roleStatus[roleId] = cached.roles.includes(roleId);
    });

    return {
      success: true,
      message: 'Discord roles verified from cache',
      roleStatus
    };
  }

  /**
   * Clear expired cache entries (can be called periodically)
   */
  static async clearExpiredCache(): Promise<void> {
    try {
      const { error } = await supabase
        .from('discord_role_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('❌ Failed to clear expired cache:', error);
      } else {
        console.log('🧹 Cleared expired Discord role cache');
      }
    } catch (error) {
      console.error('❌ Cache cleanup error:', error);
    }
  }

  /**
   * Force refresh cache for a specific user
   */
  static async forceRefreshCache(discordUserId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('discord_role_cache')
        .delete()
        .eq('user_id', discordUserId)
        .eq('guild_id', this.GUILD_ID);

      if (error) {
        console.error('❌ Failed to clear user cache:', error);
      } else {
        console.log('🔄 Cleared cache for user:', discordUserId);
      }
    } catch (error) {
      console.error('❌ Cache refresh error:', error);
    }
  }
}

export default OptimizedDiscordVerificationService;
