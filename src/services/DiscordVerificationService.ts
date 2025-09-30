import { supabase } from '@/lib/supabase';

export interface DiscordVerificationResult {
  success: boolean;
  message: string;
  isMember?: boolean;
  hasRole?: boolean;
  error?: string;
}

export class DiscordVerificationService {
  // Keep default values as fallback
  private static readonly DEFAULT_GUILD_ID = '1369232763709947914';
  private static readonly DEFAULT_ROLE_ID = '1369238686436163625';

  /**
   * Verify if a user has joined the Discord server
   * @param userId Discord user ID
   * @param guildId Discord server/guild ID (optional, uses default if not provided)
   */
  static async verifyDiscordMembership(userId: string, guildId?: string): Promise<DiscordVerificationResult> {
    try {
      // Use provided guildId or fallback to default
      const targetGuildId = guildId || this.DEFAULT_GUILD_ID;
      
      console.log('=== DISCORD MEMBERSHIP VERIFICATION START ===');
      console.log('User ID to verify:', userId);
      console.log('User ID type:', typeof userId);
      console.log('User ID length:', userId?.length);
      console.log('Guild ID to check:', targetGuildId);
      console.log('Guild ID source:', guildId ? 'task-specific' : 'default fallback');
      
      const requestBody = {
        discordUserId: userId,
        guildId: targetGuildId
      };
      console.log('Request body being sent:', requestBody);
      console.log('Request body JSON:', JSON.stringify(requestBody));
      
      // Use backend service instead of Supabase Edge Function
      const response = await fetch('http://localhost:3001/verify-discord-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Discord membership verification response:', data);
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('=== DISCORD MEMBERSHIP VERIFICATION END ===');

      if (!response.ok) {
        console.error('Discord membership verification error:', data);
        return {
          success: false,
          message: data.message || 'Failed to verify Discord membership',
          error: data.error || 'HTTP error'
        };
      }

      if (data.isMember) {
        return {
          success: true,
          message: data.message || 'Discord membership verified successfully!',
          isMember: true
        };
      } else {
        return {
          success: false,
          message: data.message || 'User not found in Discord server',
          isMember: false
        };
      }
    } catch (error) {
      console.error('Discord membership verification service error:', error);
      return {
        success: false,
        message: 'Internal error during Discord membership verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify if a user has the required role in the Discord server
   * @param userId Discord user ID
   * @param guildId Discord server/guild ID (optional, uses default if not provided)
   * @param roleId Discord role ID (optional, uses default if not provided)
   */
  static async verifyDiscordRole(userId: string, guildId?: string, roleId?: string): Promise<DiscordVerificationResult> {
    try {
      // Use provided guildId and roleId or fallback to defaults
      const targetGuildId = guildId || this.DEFAULT_GUILD_ID;
      const targetRoleId = roleId || this.DEFAULT_ROLE_ID;
      
      console.log('=== DISCORD ROLE VERIFICATION START ===');
      console.log('User ID to verify:', userId);
      console.log('Guild ID to check:', targetGuildId);
      console.log('Role ID to check:', targetRoleId);
      console.log('Guild ID source:', guildId ? 'task-specific' : 'default fallback');
      console.log('Role ID source:', roleId ? 'task-specific' : 'default fallback');
      
      const requestBody = {
        discordUserId: userId,
        guildId: targetGuildId,
        roleId: targetRoleId
      };
      console.log('Request body being sent:', requestBody);
      
      // Use backend service instead of Supabase Edge Function
      const response = await fetch('http://localhost:3001/verify-discord-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Discord role verification response:', data);
      console.log('=== DISCORD ROLE VERIFICATION END ===');

      if (!response.ok) {
        console.error('Discord role verification error:', data);
        return {
          success: false,
          message: data.message || 'Failed to verify Discord role',
          error: data.error || 'HTTP error'
        };
      }

      if (data.hasRole) {
        return {
          success: true,
          message: data.message || 'Discord role verified successfully!',
          hasRole: true
        };
      } else {
        return {
          success: false,
          message: data.message || 'Required role not found',
          hasRole: false
        };
      }
    } catch (error) {
      console.error('Discord role verification service error:', error);
      return {
        success: false,
        message: 'Internal error during Discord role verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify both Discord membership and role in a single call
   */
  static async verifyDiscordComplete(userId: string): Promise<DiscordVerificationResult> {
    try {
      // First verify membership
      const membershipResult = await this.verifyDiscordMembership(userId);
      if (!membershipResult.success || !membershipResult.isMember) {
        return {
          success: false,
          message: 'Please join the Discord server first before verifying role',
          isMember: false,
          hasRole: false
        };
      }

      // Then verify role
      const roleResult = await this.verifyDiscordRole(userId);
      return {
        success: roleResult.success,
        message: roleResult.message,
        isMember: true,
        hasRole: roleResult.hasRole
      };
    } catch (error) {
      console.error('Discord complete verification error:', error);
      return {
        success: false,
        message: 'Internal error during Discord verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the Discord invite link for the server
   */
  static getDiscordInviteLink(): string {
    return `https://t.co/4EeqEtQqw3`; // Updated Discord invite link
  }

  /**
   * Get the Discord guild ID
   */
  static getGuildId(): string {
    return this.DEFAULT_GUILD_ID;
  }

  /**
   * Get the Discord role ID
   */
  static getRoleId(): string {
    return this.DEFAULT_ROLE_ID;
  }

  /**
   * Test Discord API connectivity and bot permissions
   */
  static async testDiscordAPI(): Promise<{ success: boolean; message: string; error?: string; config?: any }> {
    try {
      console.log('=== TESTING DISCORD API CONNECTIVITY ===');
      console.log('Guild ID:', this.DEFAULT_GUILD_ID);
      console.log('Role ID:', this.DEFAULT_ROLE_ID);
      
      // Test backend health endpoint
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();
      
      console.log('Backend health response:', data);
      
      if (!response.ok) {
        return {
          success: false,
          message: 'Failed to connect to backend service',
          error: data.message || 'HTTP error'
        };
      }
      
      return {
        success: true,
        message: 'Backend service connectivity test successful',
        config: data.config
      };
    } catch (error) {
      console.error('Discord API test error:', error);
      return {
        success: false,
        message: 'Backend service test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default DiscordVerificationService;
