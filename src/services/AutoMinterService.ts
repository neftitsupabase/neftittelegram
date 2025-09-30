import { adminMinterService } from './AdminMinterService';
import { contractPermissionService } from './ContractPermissionService';

/**
 * Auto Minter Service - Automatically grants MINTER_ROLE to users who want to mint NFTs
 * This service ensures seamless NFT minting without manual permission management
 */
export class AutoMinterService {
  private roleCheckCache = new Map<string, { hasRole: boolean, timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Automatically ensure a user has MINTER_ROLE before minting
   * This is the main function called before any NFT minting operation
   */
  async ensureMinterRole(walletAddress: string): Promise<{
    success: boolean;
    message: string;
    txHash?: string;
    alreadyHadRole?: boolean;
  }> {
    try {
      console.log('🔑 Ensuring MINTER_ROLE for wallet:', walletAddress);

      // Check if user already has MINTER_ROLE (with caching)
      const hasRole = await this.checkMinterRoleWithCache(walletAddress);
      
      if (hasRole) {
        return {
          success: true,
          message: 'User already has MINTER_ROLE',
          alreadyHadRole: true
        };
      }

      // User doesn't have role, grant it automatically
      console.log('🔄 User lacks MINTER_ROLE, granting automatically...');
      const grantResult = await adminMinterService.grantMinterRoleToUser(walletAddress);

      if (grantResult.success) {
        // Clear cache for this user since role status changed
        this.roleCheckCache.delete(walletAddress.toLowerCase());
        
        return {
          success: true,
          message: 'MINTER_ROLE granted successfully',
          txHash: grantResult.txHash
        };
      } else {
        return {
          success: false,
          message: `Failed to grant MINTER_ROLE: ${grantResult.message}`
        };
      }

    } catch (error: any) {
      console.error('❌ Auto minter role error:', error);
      return {
        success: false,
        message: `Auto minter error: ${error.message}`
      };
    }
  }

  /**
   * Check if user has MINTER_ROLE with caching to reduce blockchain calls
   */
  private async checkMinterRoleWithCache(walletAddress: string): Promise<boolean> {
    const key = walletAddress.toLowerCase();
    const cached = this.roleCheckCache.get(key);
    
    // Return cached result if still valid
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log('📋 Using cached role status for:', walletAddress);
      return cached.hasRole;
    }

    // Check role on blockchain
    try {
      const hasRole = await contractPermissionService.hasMinterRole(walletAddress);
      
      // Cache the result
      this.roleCheckCache.set(key, {
        hasRole,
        timestamp: Date.now()
      });
      
      return hasRole;
    } catch (error) {
      console.error('❌ Role check failed:', error);
      return false;
    }
  }

  /**
   * Batch ensure MINTER_ROLE for multiple users
   * Useful for bulk operations
   */
  async ensureMinterRoleBatch(walletAddresses: string[]): Promise<{
    successful: string[];
    failed: { address: string; reason: string }[];
    alreadyHadRole: string[];
  }> {
    const successful: string[] = [];
    const failed: { address: string; reason: string }[] = [];
    const alreadyHadRole: string[] = [];

    console.log(`🔄 Batch ensuring MINTER_ROLE for ${walletAddresses.length} wallets`);

    for (const address of walletAddresses) {
      try {
        const result = await this.ensureMinterRole(address);
        
        if (result.success) {
          if (result.alreadyHadRole) {
            alreadyHadRole.push(address);
          } else {
            successful.push(address);
          }
        } else {
          failed.push({ address, reason: result.message });
        }
      } catch (error: any) {
        failed.push({ address, reason: error.message || 'Unknown error' });
      }
    }

    console.log(`✅ Batch complete: ${successful.length} granted, ${alreadyHadRole.length} already had role, ${failed.length} failed`);

    return { successful, failed, alreadyHadRole };
  }

  /**
   * Clear role cache for a specific user or all users
   */
  clearRoleCache(walletAddress?: string): void {
    if (walletAddress) {
      this.roleCheckCache.delete(walletAddress.toLowerCase());
      console.log('🗑️ Cleared role cache for:', walletAddress);
    } else {
      this.roleCheckCache.clear();
      console.log('🗑️ Cleared all role cache');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [, entry] of this.roleCheckCache) {
      if ((now - entry.timestamp) < this.CACHE_DURATION) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.roleCheckCache.size,
      validEntries,
      expiredEntries
    };
  }

  /**
   * Preload MINTER_ROLE status for multiple users
   * Useful for optimizing bulk operations
   */
  async preloadMinterRoles(walletAddresses: string[]): Promise<void> {
    console.log(`📋 Preloading MINTER_ROLE status for ${walletAddresses.length} wallets`);
    
    const promises = walletAddresses.map(address => 
      this.checkMinterRoleWithCache(address).catch(error => {
        console.warn(`Failed to preload role for ${address}:`, error);
        return false;
      })
    );

    await Promise.all(promises);
    console.log('✅ Preloading complete');
  }
}

export const autoMinterService = new AutoMinterService();
