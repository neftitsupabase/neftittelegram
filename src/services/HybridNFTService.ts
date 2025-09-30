/**
 * Hybrid NFT Service - On-Chain NFT Management with Off-Chain Integration
 * Handles NFT claiming through Thirdweb DropERC721 while maintaining off-chain tracking
 */

import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { Polygon } from "@thirdweb-dev/chains";
import { getWalletSupabaseClient } from "../lib/supabaseClientManager";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { NFTData } from './HybridIPFSService';
import toast from 'react-hot-toast';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface OnChainNFTConfig {
  nftDropAddress: string;
  rpcUrl: string;
  clientId: string;
}

interface ClaimResult {
  success: boolean;
  nfts?: NFTData[];
  transactionHash?: string;
  error?: string;
}

interface ClaimCondition {
  maxClaimableSupply: string;
  maxClaimablePerWallet: string;
  currentMintSupply: string;
  availableSupply: string;
  allowlistProof?: any;
  price: string;
  currency: string;
}

interface ClaimTransaction {
  hash: string;
  tokenIds: string[];
  quantity: number;
  timestamp: number;
  gasUsed?: string;
}

class HybridNFTService {
  private sdk: ThirdwebSDK | null = null;
  private nftDropContract: any = null;
  private supabase: SupabaseClient;
  private config: OnChainNFTConfig;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Load configuration from environment variables
    this.config = {
      nftDropAddress: import.meta.env.VITE_NFT_DROP_ADDRESS || '',
      rpcUrl: import.meta.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || ''
    };
  }

  /**
   * Create Supabase client with wallet address header for RLS
   */
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    return createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          'x-wallet-address': walletAddress,
        },
      },
    });
  }

  /**
   * Initialize Thirdweb SDK and contracts
   */
  private async initializeContracts(): Promise<void> {
    try {
      if (!this.config.clientId) {
        throw new Error('Thirdweb client ID not configured');
      }

      if (!this.config.nftDropAddress) {
        throw new Error('NFT Drop contract address not configured');
      }

      // Initialize SDK with Polygon Amoy testnet
      this.sdk = new ThirdwebSDK(Polygon, {
        clientId: this.config.clientId,
      });

      // Get NFT Drop contract instance
      this.nftDropContract = await this.sdk.getContract(this.config.nftDropAddress, "nft-drop");

      console.log('✅ Thirdweb NFT contracts initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Thirdweb NFT contracts:', error);
      throw error;
    }
  }

  /**
   * Check if on-chain NFT claiming is available
   */
  async isOnChainAvailable(): Promise<boolean> {
    try {
      if (!this.config.nftDropAddress) {
        return false;
      }

      await this.initializeContracts();
      return this.nftDropContract !== null;
    } catch (error) {
      console.error('On-chain NFT claiming not available:', error);
      return false;
    }
  }

  /**
   * Get claim conditions for the NFT drop
   */
  async getClaimConditions(): Promise<ClaimCondition | null> {
    try {
      // Initialize contracts if needed
      if (!this.nftDropContract) {
        await this.initializeContracts();
      }

      const claimConditions = await this.nftDropContract.claimConditions.getAll();
      
      if (!claimConditions || claimConditions.length === 0) {
        return null;
      }

      // Get the active claim condition (usually the first one)
      const activeCondition = claimConditions[0];
      
      return {
        maxClaimableSupply: activeCondition.maxClaimableSupply,
        maxClaimablePerWallet: activeCondition.maxClaimablePerWallet,
        currentMintSupply: activeCondition.currentMintSupply || '0',
        availableSupply: activeCondition.availableSupply,
        price: activeCondition.price,
        currency: activeCondition.currencyAddress
      };

    } catch (error) {
      console.error('❌ Error getting claim conditions:', error);
      return null;
    }
  }

  /**
   * Check how many NFTs a wallet can claim
   */
  async getClaimableAmount(walletAddress: string): Promise<number> {
    try {
      // Initialize contracts if needed
      if (!this.nftDropContract) {
        await this.initializeContracts();
      }

      const claimableAmount = await this.nftDropContract.claimConditions.getClaimableAmount(walletAddress);
      return parseInt(claimableAmount.toString());

    } catch (error) {
      console.error('❌ Error getting claimable amount:', error);
      return 0;
    }
  }

  /**
   * Claim NFTs on-chain using Thirdweb DropERC721 contract
   */
  async claimNFTOnChain(walletAddress: string, quantity: number = 1): Promise<ClaimResult> {
    try {
      console.log(`🔗 Starting on-chain NFT claiming for ${quantity} NFTs`);

      // Initialize contracts if needed
      if (!this.nftDropContract) {
        await this.initializeContracts();
      }

      // Check claim conditions
      const claimableAmount = await this.getClaimableAmount(walletAddress);
      if (claimableAmount < quantity) {
        throw new Error(`You can only claim ${claimableAmount} NFTs`);
      }

      // Execute claim transaction
      toast.loading('Claiming NFTs on-chain...', { id: 'claim-nfts' });
      console.log('🔗 Executing claim transaction...');
      
      const claimTx = await this.nftDropContract.claimTo(walletAddress, quantity);
      const receipt = await claimTx.wait();

      // Extract token IDs from transaction events
      const tokenIds = this.extractTokenIdsFromClaimReceipt(receipt);

      const claimTransaction: ClaimTransaction = {
        hash: receipt.transactionHash,
        tokenIds: tokenIds,
        quantity: quantity,
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed?.toString()
      };

      toast.success(`${quantity} NFT${quantity > 1 ? 's' : ''} claimed successfully!`, { id: 'claim-nfts' });
      console.log('✅ On-chain claiming successful:', claimTransaction);

      // Get NFT metadata for claimed tokens
      const claimedNFTs = await this.getNFTsMetadata(tokenIds, walletAddress);

      // Update off-chain tracking
      await this.updateOffChainRecords(walletAddress, claimedNFTs, claimTransaction);

      return {
        success: true,
        nfts: claimedNFTs,
        transactionHash: claimTransaction.hash
      };

    } catch (error) {
      console.error('❌ On-chain NFT claiming failed:', error);
      toast.error(`Claiming failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'claim-nfts' });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'On-chain claiming failed'
      };
    }
  }

  /**
   * Get user's NFTs from on-chain contract
   */
  async getUserNFTsOnChain(walletAddress: string): Promise<NFTData[]> {
    try {
      console.log(`🔍 Getting NFTs from chain for: ${walletAddress}`);

      // Initialize contracts if needed
      if (!this.nftDropContract) {
        await this.initializeContracts();
      }

      // Get owned NFTs for this wallet
      const ownedNFTs = await this.nftDropContract.getOwned(walletAddress);
      
      if (!ownedNFTs || ownedNFTs.length === 0) {
        console.log('📭 No NFTs found on-chain');
        return [];
      }

      // Convert to NFTData format
      const nfts: NFTData[] = ownedNFTs.map((nft: any) => ({
        id: nft.metadata.id || nft.tokenId?.toString() || '',
        name: nft.metadata.name || `NEFTIT NFT #${nft.tokenId}`,
        description: nft.metadata.description || '',
        image: nft.metadata.image || '',
        rarity: this.extractRarityFromMetadata(nft.metadata),
        wallet_address: walletAddress,
        ipfs_hash: nft.metadata.image?.replace('https://gateway.pinata.cloud/ipfs/', '') || '',
        pinata_hash: nft.metadata.image?.replace('https://gateway.pinata.cloud/ipfs/', '') || '',
        metadata_uri: nft.uri || '',
        attributes: nft.metadata.attributes || [],
        created_at: new Date().toISOString()
      }));

      console.log(`✅ Found ${nfts.length} NFTs on-chain`);
      return nfts;

    } catch (error) {
      console.error('❌ Error getting NFTs from chain:', error);
      return [];
    }
  }

  /**
   * Get NFT metadata for specific token IDs
   */
  private async getNFTsMetadata(tokenIds: string[], walletAddress: string): Promise<NFTData[]> {
    try {
      const nfts: NFTData[] = [];

      for (const tokenId of tokenIds) {
        try {
          const nftMetadata = await this.nftDropContract.get(tokenId);
          
          const nftData: NFTData = {
            id: tokenId,
            name: nftMetadata.name || `NEFTIT NFT #${tokenId}`,
            description: nftMetadata.description || '',
            image: nftMetadata.image || '',
            rarity: this.extractRarityFromMetadata(nftMetadata),
            wallet_address: walletAddress,
            ipfs_hash: nftMetadata.image?.replace('https://gateway.pinata.cloud/ipfs/', '') || '',
            pinata_hash: nftMetadata.image?.replace('https://gateway.pinata.cloud/ipfs/', '') || '',
            metadata_uri: nftMetadata.uri || '',
            attributes: nftMetadata.attributes || [],
            created_at: new Date().toISOString()
          };
          
          nfts.push(nftData);
        } catch (error) {
          console.error(`❌ Error getting metadata for token ${tokenId}:`, error);
        }
      }

      return nfts;
    } catch (error) {
      console.error('❌ Error getting NFTs metadata:', error);
      return [];
    }
  }

  /**
   * Extract token IDs from claim transaction receipt
   */
  private extractTokenIdsFromClaimReceipt(receipt: any): string[] {
    try {
      const tokenIds: string[] = [];

      // Look for Transfer events in the transaction
      if (receipt.events) {
        for (const event of receipt.events) {
          if (event.event === 'Transfer' && event.args.from === '0x0000000000000000000000000000000000000000') {
            tokenIds.push(event.args.tokenId.toString());
          }
        }
      }

      return tokenIds;
    } catch (error) {
      console.error('❌ Error extracting token IDs:', error);
      return [];
    }
  }

  /**
   * Update off-chain records after on-chain claim
   */
  private async updateOffChainRecords(
    walletAddress: string, 
    claimedNFTs: NFTData[], 
    transaction: ClaimTransaction
  ): Promise<void> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);

      // Log the claim transaction
      const { error: txError } = await client
        .from('onchain_claim_transactions')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          transaction_hash: transaction.hash,
          token_ids: transaction.tokenIds,
          quantity: transaction.quantity,
          contract_address: this.config.nftDropAddress,
          gas_used: transaction.gasUsed,
          timestamp: new Date(transaction.timestamp).toISOString(),
          network: 'polygon-amoy'
        });

      if (txError) {
        console.error('❌ Error logging claim transaction:', txError);
      }

      // Update NFT counts and achievements
      await Promise.allSettled([
        this.updateNFTCounts(walletAddress, claimedNFTs),
        this.updateAchievements(walletAddress, claimedNFTs),
        this.logActivity(walletAddress, claimedNFTs, transaction)
      ]);

      console.log('✅ Off-chain records updated after on-chain claim');
    } catch (error) {
      console.error('❌ Error updating off-chain records:', error);
    }
  }

  /**
   * Update NFT counts in database
   */
  private async updateNFTCounts(walletAddress: string, nfts: NFTData[]): Promise<void> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);

      // Count NFTs by rarity
      const rarityCounts = nfts.reduce((counts, nft) => {
        const rarity = nft.rarity.toLowerCase();
        counts[rarity] = (counts[rarity] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      // Update user NFT counts
      const { error } = await client.rpc('update_user_nft_counts_after_claim', {
        p_wallet_address: walletAddress.toLowerCase(),
        p_rarity_counts: rarityCounts
      });

      if (error) {
        console.error('❌ Error updating NFT counts:', error);
      } else {
        console.log('✅ NFT counts updated successfully');
      }
    } catch (error) {
      console.error('❌ Error updating NFT counts:', error);
    }
  }

  /**
   * Update achievements after claiming NFTs
   */
  private async updateAchievements(walletAddress: string, nfts: NFTData[]): Promise<void> {
    try {
      // Import achievements service to avoid circular dependency
      const { default: achievementsService } = await import('./AchievementsService');
      
      // Update quest achievements (NFT claiming counts as quest completion)
      await achievementsService.updateQuestAchievements(walletAddress, 'all');
      
      console.log('✅ Achievements updated after NFT claim');
    } catch (error) {
      console.error('❌ Error updating achievements:', error);
    }
  }

  /**
   * Log activity after claiming NFTs
   */
  private async logActivity(
    walletAddress: string, 
    nfts: NFTData[], 
    transaction: ClaimTransaction
  ): Promise<void> {
    try {
      // Import activity service to avoid circular dependency
      const { default: activityTrackingService } = await import('./ActivityTrackingService');
      
      await activityTrackingService.logActivity(walletAddress, {
        activityType: 'claim',
        title: `Claimed ${nfts.length} NFT${nfts.length > 1 ? 's' : ''} On-Chain`,
        description: `Successfully claimed ${nfts.length} NFT${nfts.length > 1 ? 's' : ''} from on-chain drop`,
        details: `Transaction: ${transaction.hash}`,
        metadata: {
          token_ids: transaction.tokenIds,
          transaction_hash: transaction.hash,
          claim_type: 'on-chain',
          rarities: nfts.map(nft => nft.rarity)
        }
      });
      
      console.log('✅ Activity logged after NFT claim');
    } catch (error) {
      console.error('❌ Error logging activity:', error);
    }
  }

  /**
   * Sync NFT metadata with IPFS
   */
  async syncNFTMetadata(tokenId: string): Promise<void> {
    try {
      console.log(`🔄 Syncing metadata for token: ${tokenId}`);

      // Initialize contracts if needed
      if (!this.nftDropContract) {
        await this.initializeContracts();
      }

      // Refresh metadata from contract
      await this.nftDropContract.refresh(tokenId);
      
      console.log(`✅ Metadata synced for token: ${tokenId}`);
    } catch (error) {
      console.error('❌ Error syncing NFT metadata:', error);
    }
  }

  /**
   * Extract rarity from NFT metadata
   */
  private extractRarityFromMetadata(metadata: any): string {
    // Try to find rarity in attributes
    if (metadata.attributes && Array.isArray(metadata.attributes)) {
      const rarityAttribute = metadata.attributes.find(
        (attr: any) => attr.trait_type?.toLowerCase() === 'rarity'
      );
      if (rarityAttribute) {
        return rarityAttribute.value.toLowerCase();
      }
    }

    // Try to extract from name
    if (metadata.name) {
      const name = metadata.name.toLowerCase();
      if (name.includes('common')) return 'common';
      if (name.includes('rare')) return 'rare';
      if (name.includes('legendary')) return 'legendary';
      if (name.includes('platinum')) return 'platinum';
      if (name.includes('silver')) return 'silver';
      if (name.includes('gold')) return 'gold';
    }

    // Default to common
    return 'common';
  }

  /**
   * Get total supply information
   */
  async getSupplyInfo(): Promise<{
    totalSupply: number;
    maxSupply: number;
    availableSupply: number;
  }> {
    try {
      // Initialize contracts if needed
      if (!this.nftDropContract) {
        await this.initializeContracts();
      }

      const totalSupply = await this.nftDropContract.totalSupply();
      const claimConditions = await this.getClaimConditions();

      return {
        totalSupply: parseInt(totalSupply.toString()),
        maxSupply: claimConditions ? parseInt(claimConditions.maxClaimableSupply) : 0,
        availableSupply: claimConditions ? parseInt(claimConditions.availableSupply) : 0
      };

    } catch (error) {
      console.error('❌ Error getting supply info:', error);
      return {
        totalSupply: 0,
        maxSupply: 0,
        availableSupply: 0
      };
    }
  }

  /**
   * Get configuration status
   */
  getConfiguration(): OnChainNFTConfig & { isConfigured: boolean } {
    return {
      ...this.config,
      isConfigured: !!(this.config.nftDropAddress && this.config.clientId)
    };
  }
}

export const hybridNFTService = new HybridNFTService();
export default hybridNFTService;
