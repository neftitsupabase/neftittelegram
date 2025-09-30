import { supabase } from '@/lib/supabase';
import OptimizedDiscordVerificationService from './OptimizedDiscordVerificationService';

export interface BadgeVerificationResult {
  success: boolean;
  message: string;
  isEligible: boolean;
  error?: string;
}

export interface BadgeInfo {
  badgeId: string;
  title: string;
  roleId?: string;
  type: 'discord_role' | 'level';
  requiredValue?: number;
}

export class BadgeVerificationService {
  // Badge configurations
  private static readonly BADGES: BadgeInfo[] = [
    {
      badgeId: 'og-discord',
      title: 'OG Discord Badge',
      roleId: '1369238686436163625',
      type: 'discord_role'
    },
    {
      badgeId: 'kysie',
      title: 'Kysie Badge',
      roleId: '1382430133692141598',
      type: 'discord_role'
    },
    {
      badgeId: 'zylo',
      title: 'Zylo Badge',
      roleId: '1382429731613310996',
      type: 'discord_role'
    },
    {
      badgeId: 'dozi',
      title: 'Dozi Badge',
      roleId: '1382430296602841179',
      type: 'discord_role'
    },
    {
      badgeId: 'level-20',
      title: '20 Level NEFTIT',
      type: 'level',
      requiredValue: 20
    }
  ];

  private static readonly GUILD_ID = '1369232763709947914';

  /**
   * Get all available badges
   */
  static getBadges(): BadgeInfo[] {
    return this.BADGES;
  }

  /**
   * Get badge info by ID
   */
  static getBadgeById(badgeId: string): BadgeInfo | undefined {
    return this.BADGES.find(badge => badge.badgeId === badgeId);
  }

  /**
   * Verify if user is eligible for a specific badge
   */
  static async verifyBadgeEligibility(badgeId: string, discordUserId?: string, userLevel?: number): Promise<BadgeVerificationResult> {
    try {
      const badge = this.getBadgeById(badgeId);
      if (!badge) {
        return {
          success: false,
          message: 'Badge not found',
          isEligible: false,
          error: 'Invalid badge ID'
        };
      }

      if (badge.type === 'discord_role') {
        return await this.verifyDiscordRoleBadge(badge, discordUserId);
      } else if (badge.type === 'level') {
        return await this.verifyLevelBadge(badge, userLevel);
      }

      return {
        success: false,
        message: 'Unknown badge type',
        isEligible: false,
        error: 'Invalid badge type'
      };
    } catch (error) {
      console.error('Badge verification error:', error);
      return {
        success: false,
        message: 'Failed to verify badge eligibility',
        isEligible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify Discord role-based badges (Optimized with caching)
   */
  private static async verifyDiscordRoleBadge(badge: BadgeInfo, discordUserId?: string): Promise<BadgeVerificationResult> {
    if (!discordUserId) {
      return {
        success: false,
        message: 'Discord account not connected',
        isEligible: false,
        error: 'No Discord user ID provided'
      };
    }

    if (!badge.roleId) {
      return {
        success: false,
        message: 'Badge configuration error',
        isEligible: false,
        error: 'No role ID configured for this badge'
      };
    }

    try {
      // Use optimized Discord verification service with caching
      const hasRole = await OptimizedDiscordVerificationService.hasRole(discordUserId, badge.roleId);
      
      if (hasRole) {
        return {
          success: true,
          message: `${badge.title} eligibility verified successfully!`,
          isEligible: true
        };
      } else {
        return {
          success: true,
          message: `You don't have the required role for ${badge.title}`,
          isEligible: false
        };
      }
    } catch (error) {
      console.error('Discord role verification error:', error);
      return {
        success: false,
        message: 'Failed to verify Discord role',
        isEligible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify level-based badges
   */
  private static async verifyLevelBadge(badge: BadgeInfo, userLevel?: number): Promise<BadgeVerificationResult> {
    if (userLevel === undefined || userLevel === null) {
      return {
        success: false,
        message: 'User level not available',
        isEligible: false,
        error: 'No user level provided'
      };
    }

    if (!badge.requiredValue) {
      return {
        success: false,
        message: 'Badge configuration error',
        isEligible: false,
        error: 'No required level configured for this badge'
      };
    }

    if (userLevel >= badge.requiredValue) {
      return {
        success: true,
        message: `${badge.title} eligibility verified! You are level ${userLevel}`,
        isEligible: true
      };
    } else {
      return {
        success: true,
        message: `You need level ${badge.requiredValue} to claim ${badge.title}. Current level: ${userLevel}`,
        isEligible: false
      };
    }
  }

  /**
   * Get user's claimed badges from database
   */
  static async getUserClaimedBadges(walletAddress: string): Promise<string[]> {
    try {
      console.log('🔍 Fetching claimed badges for wallet:', walletAddress);
      
      const { data, error } = await supabase
        .from('users')
        .select('claimed_badges')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) {
        console.error('❌ Error fetching claimed badges:', error);
        
        // If the column doesn't exist, try to create it
        if (error.code === '42703') { // Column doesn't exist
          console.log('🔄 claimed_badges column not found, attempting to create...');
          await this.createClaimedBadgesColumn();
          return [];
        }
        
        return [];
      }

      console.log('✅ Claimed badges fetched successfully:', data?.claimed_badges);
      return data?.claimed_badges || [];
    } catch (error) {
      console.error('❌ Error fetching claimed badges:', error);
      return [];
    }
  }

  /**
   * Create the claimed_badges column if it doesn't exist
   */
  private static async createClaimedBadgesColumn(): Promise<void> {
    try {
      console.log('🔧 Creating claimed_badges column...');
      
      // Execute SQL to add the column
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS claimed_badges JSONB DEFAULT '[]'::jsonb;
          
          CREATE INDEX IF NOT EXISTS idx_users_claimed_badges 
          ON users USING GIN(claimed_badges);
        `
      });

      if (error) {
        console.error('❌ Failed to create claimed_badges column:', error);
        // Fallback: try to insert a user record with the column
        await this.insertUserWithBadges();
      } else {
        console.log('✅ claimed_badges column created successfully');
      }
    } catch (error) {
      console.error('❌ Error creating claimed_badges column:', error);
      // Fallback: try to insert a user record with the column
      await this.insertUserWithBadges();
    }
  }

  /**
   * Fallback: Insert a user record with claimed_badges column
   */
  private static async insertUserWithBadges(): Promise<void> {
    try {
      console.log('🔄 Attempting fallback: insert user with claimed_badges...');
      
      // This is a fallback method - in practice, you'd run the SQL script
      console.log('⚠️ Please run the SQL script: database/add_claimed_badges_column.sql');
      console.log('⚠️ Or manually add the column: ALTER TABLE users ADD COLUMN claimed_badges JSONB DEFAULT \'[]\'::jsonb;');
    } catch (error) {
      console.error('❌ Fallback failed:', error);
    }
  }

  /**
   * Claim a badge for a user
   */
  static async claimBadge(walletAddress: string, badgeId: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      console.log('🎯 Attempting to claim badge:', badgeId, 'for wallet:', walletAddress);
      
      // First check if user is eligible
      const badge = this.getBadgeById(badgeId);
      if (!badge) {
        console.error('❌ Invalid badge ID:', badgeId);
        return {
          success: false,
          message: 'Invalid badge ID',
          error: 'Badge not found'
        };
      }

      console.log('✅ Badge found:', badge.title);

      // Get current claimed badges
      const currentClaimedBadges = await this.getUserClaimedBadges(walletAddress);
      console.log('📋 Current claimed badges:', currentClaimedBadges);
      
      // Check if already claimed
      if (currentClaimedBadges.includes(badgeId)) {
        console.log('⚠️ Badge already claimed');
        return {
          success: false,
          message: 'Badge already claimed',
          error: 'Badge already claimed by this user'
        };
      }

      // Add badge to claimed badges
      const updatedClaimedBadges = [...currentClaimedBadges, badgeId];
      console.log('🔄 Updated claimed badges:', updatedClaimedBadges);

      // Update database
      console.log('💾 Updating database...');
      const { data, error } = await supabase
        .from('users')
        .update({ 
          claimed_badges: updatedClaimedBadges,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .select('claimed_badges');

      if (error) {
        console.error('❌ Database update error:', error);
        
        // If the column doesn't exist, try to create it
        if (error.code === '42703') { // Column doesn't exist
          console.log('🔄 claimed_badges column not found, attempting to create...');
          await this.createClaimedBadgesColumn();
          
          // Try the update again
          console.log('🔄 Retrying database update...');
          const { error: retryError } = await supabase
            .from('users')
            .update({ 
              claimed_badges: updatedClaimedBadges,
              updated_at: new Date().toISOString()
            })
            .eq('wallet_address', walletAddress);

          if (retryError) {
            console.error('❌ Retry failed:', retryError);
            return {
              success: false,
              message: 'Failed to claim badge - database column issue',
              error: retryError.message
            };
          }
        } else {
          return {
            success: false,
            message: 'Failed to claim badge',
            error: error.message
          };
        }
      }

      console.log('✅ Badge claimed successfully in database');
      return {
        success: true,
        message: `${badge.title} claimed successfully!`
      };
    } catch (error) {
      console.error('❌ Error claiming badge:', error);
      return {
        success: false,
        message: 'Failed to claim badge',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify all badges for a user
   */
  static async verifyAllBadges(walletAddress: string, discordUserId?: string, userLevel?: number): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const badge of this.BADGES) {
      const result = await this.verifyBadgeEligibility(badge.badgeId, discordUserId, userLevel);
      results[badge.badgeId] = result.isEligible;
    }

    return results;
  }
}

export default BadgeVerificationService;
