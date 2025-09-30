import improvedOnchainStakingService from './ImprovedOnchainStakingService';
import offChainStakingService from './EnhancedStakingService';
import { toast } from 'sonner';

/**
 * Service to recover missing Supabase records for onchain staked NFTs
 * This handles cases where NFTs are staked on blockchain but database records were deleted
 */
export class OnchainStakingRecoveryService {
  
  /**
   * Recover missing staking records for a wallet
   * This will sync blockchain staked NFTs back to Supabase database
   */
  async recoverMissingStakingRecords(walletAddress: string): Promise<{
    success: boolean;
    recovered: number;
    errors: string[];
    details: any[];
  }> {
    try {
      console.log('🔄 [Recovery] Starting recovery of missing staking records for:', walletAddress);
      
      // Check if onchain staking is available
      if (!await improvedOnchainStakingService.isOnChainAvailable()) {
        throw new Error('Onchain staking service is not available');
      }
      
      // 1. Get all NFTs staked on blockchain
      const onchainStakedNFTs = await improvedOnchainStakingService.getStakedNFTsOnChain(walletAddress);
      console.log(`📊 [Recovery] Found ${onchainStakedNFTs.length} NFTs staked on blockchain`);
      
      if (onchainStakedNFTs.length === 0) {
        console.log('✅ [Recovery] No NFTs staked on blockchain');
        return { success: true, recovered: 0, errors: [], details: [] };
      }
      
      // 2. Get current database records
      const databaseStakedNFTs = await offChainStakingService.getStakedNFTs(walletAddress);
      console.log(`💾 [Recovery] Found ${databaseStakedNFTs.length} NFTs in database`);
      
      // 3. Find missing records (NFTs staked on blockchain but not in database)
      const databaseTokenIds = new Set(
        databaseStakedNFTs
          .filter(nft => nft.staking_source === 'onchain')
          .map(nft => {
            // Extract token ID from various formats
            if (nft.nft_id?.toString().startsWith('onchain_')) {
              return nft.nft_id.toString().replace('onchain_', '');
            }
            return nft.nft_id?.toString();
          })
          .filter(Boolean)
      );
      
      const missingNFTs = onchainStakedNFTs.filter(nft => {
        const tokenId = this.extractTokenId(nft.id || nft.tokenId);
        const isMissing = !databaseTokenIds.has(tokenId);
        
        if (isMissing) {
          console.log(`🔍 [Recovery] Missing database record for token ID: ${tokenId}`);
        }
        
        return isMissing;
      });
      
      console.log(`🚨 [Recovery] Found ${missingNFTs.length} NFTs missing from database`);
      
      if (missingNFTs.length === 0) {
        console.log('✅ [Recovery] All onchain staked NFTs are already in database');
        return { success: true, recovered: 0, errors: [], details: [] };
      }
      
      // 4. Use the existing sync method to recover records
      console.log('🔄 [Recovery] Using syncExistingStakedNFTs to recover records...');
      const syncResult = await improvedOnchainStakingService.syncExistingStakedNFTs(walletAddress);
      
      if (syncResult.success) {
        console.log(`✅ [Recovery] Successfully recovered ${syncResult.synced} staking records`);
        toast.success(`Recovered ${syncResult.synced} missing staking records!`);
      } else {
        console.error('❌ [Recovery] Sync failed:', syncResult.errors);
        toast.error('Failed to recover some staking records');
      }
      
      return {
        success: syncResult.success,
        recovered: syncResult.synced,
        errors: syncResult.errors,
        details: syncResult.details
      };
      
    } catch (error) {
      console.error('❌ [Recovery] Error during recovery:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Recovery failed: ${errorMessage}`);
      
      return {
        success: false,
        recovered: 0,
        errors: [errorMessage],
        details: []
      };
    }
  }
  
  /**
   * Check for missing staking records without fixing them
   */
  async checkForMissingRecords(walletAddress: string): Promise<{
    onchainStaked: number;
    databaseRecords: number;
    missing: number;
    missingDetails: any[];
  }> {
    try {
      console.log('🔍 [Recovery] Checking for missing staking records...');
      
      if (!await improvedOnchainStakingService.isOnChainAvailable()) {
        return { onchainStaked: 0, databaseRecords: 0, missing: 0, missingDetails: [] };
      }
      
      const [onchainStakedNFTs, databaseStakedNFTs] = await Promise.all([
        improvedOnchainStakingService.getStakedNFTsOnChain(walletAddress),
        offChainStakingService.getStakedNFTs(walletAddress)
      ]);
      
      const databaseTokenIds = new Set(
        databaseStakedNFTs
          .filter(nft => nft.staking_source === 'onchain')
          .map(nft => this.extractTokenId(nft.nft_id?.toString()))
          .filter(Boolean)
      );
      
      const missingNFTs = onchainStakedNFTs.filter(nft => {
        const tokenId = this.extractTokenId(nft.id || nft.tokenId);
        return !databaseTokenIds.has(tokenId);
      });
      
      return {
        onchainStaked: onchainStakedNFTs.length,
        databaseRecords: databaseStakedNFTs.filter(nft => nft.staking_source === 'onchain').length,
        missing: missingNFTs.length,
        missingDetails: missingNFTs.map(nft => ({
          tokenId: this.extractTokenId(nft.id || nft.tokenId),
          name: nft.name,
          id: nft.id
        }))
      };
      
    } catch (error) {
      console.error('❌ [Recovery] Error checking records:', error);
      return { onchainStaked: 0, databaseRecords: 0, missing: 0, missingDetails: [] };
    }
  }
  
  /**
   * Extract clean token ID from various formats
   */
  private extractTokenId(id: string | undefined): string {
    if (!id) return '';
    
    // Handle various ID formats
    if (id.startsWith('onchain_')) {
      return id.replace('onchain_', '');
    }
    if (id.startsWith('staked_')) {
      return id.replace('staked_', '');
    }
    if (id.startsWith('blockchain_')) {
      return id.replace('blockchain_', '');
    }
    
    // Return as-is if it's already a clean token ID
    return id.toString();
  }
  
  /**
   * Force refresh NFT context after recovery
   */
  async refreshNFTContext(): Promise<void> {
    try {
      // Emit event to refresh NFT context
      window.dispatchEvent(new CustomEvent('nft-staking-recovered'));
      console.log('🔄 [Recovery] Emitted NFT context refresh event');
    } catch (error) {
      console.warn('⚠️ [Recovery] Could not emit refresh event:', error);
    }
  }
}

// Export singleton instance
export const onchainStakingRecoveryService = new OnchainStakingRecoveryService();
export default onchainStakingRecoveryService;
