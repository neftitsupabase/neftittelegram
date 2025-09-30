/**
 * Hybrid Burn Service - On-Chain Burn with Off-Chain Upgrade Logic
 * Uses standard transfer to burn address (0x000...dEaD) with off-chain CID pool system
 */

import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { Polygon } from "@thirdweb-dev/chains";
import { optimizedCIDPoolBurnService } from './OptimizedCIDPoolBurnService';
import type { BurnResult, BurnRule } from './OptimizedCIDPoolBurnService';
import type { NFTData } from './HybridIPFSService';
import toast from 'react-hot-toast';

interface OnChainBurnConfig {
  burnAddress: string; // 0x000000000000000000000000000000000000dEaD
  nftContractAddress: string;
  rpcUrl: string;
  clientId: string;
  network: string;
  chainId: number;
}

interface BurnTransaction {
  hash: string;
  tokenIds: string[];
  resultRarity: string;
  timestamp: number;
  gasUsed?: string;
  blockNumber?: number;
}


class HybridBurnService {
  private sdk: ThirdwebSDK | null = null;
  private nftContract: any = null;
  private config: OnChainBurnConfig;
  private readonly BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

  constructor() {
    
    // Load configuration from environment variables
    this.config = {
      burnAddress: this.BURN_ADDRESS,
      nftContractAddress: import.meta.env.VITE_NFT_CLAIM_CONTRACT_ADDRESS || '',
      rpcUrl: import.meta.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || '',
      network: this.detectNetworkFromRPC(import.meta.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology'),
      chainId: this.detectChainIdFromRPC(import.meta.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology')
    };
  }

  /**
   * Detect network name from RPC URL for AVAX, BNB, Polygon, and major L2s
   */
  private detectNetworkFromRPC(rpcUrl: string): string {
    const url = rpcUrl.toLowerCase();
    
    // Ethereum networks
    if (url.includes('ethereum') || url.includes('mainnet') || url.includes('infura') || url.includes('alchemy')) {
      if (url.includes('sepolia')) return 'ethereum-sepolia';
      return 'ethereum-mainnet';
    }
    
    // Polygon networks (Layer 2)
    if (url.includes('polygon') || url.includes('matic')) {
      if (url.includes('amoy') || url.includes('testnet')) return 'polygon-amoy';
      if (url.includes('mumbai')) return 'polygon-mumbai';
      return 'polygon-mainnet';
    }
    
    // Arbitrum networks (Layer 2)
    if (url.includes('arbitrum')) {
      if (url.includes('sepolia') || url.includes('testnet')) return 'arbitrum-sepolia';
      if (url.includes('nova')) return 'arbitrum-nova';
      return 'arbitrum-mainnet';
    }
    
    // Base networks (Layer 2)
    if (url.includes('base')) {
      if (url.includes('sepolia') || url.includes('testnet')) return 'base-sepolia';
      return 'base-mainnet';
    }
    
    // BNB Smart Chain networks
    if (url.includes('bsc') || url.includes('binance') || url.includes('bnb')) {
      if (url.includes('testnet')) return 'bnb-testnet';
      return 'bnb-mainnet';
    }
    
    // Avalanche networks
    if (url.includes('avalanche') || url.includes('avax')) {
      if (url.includes('fuji') || url.includes('testnet')) return 'avalanche-fuji';
      return 'avalanche-mainnet';
    }
    
    // Default fallback for EVM compatibility
    return 'evm-compatible';
  }

  /**
   * Detect chain ID from RPC URL for AVAX, BNB, Polygon, and major L2s
   */
  private detectChainIdFromRPC(rpcUrl: string): number {
    const url = rpcUrl.toLowerCase();
    
    // Ethereum networks
    if (url.includes('sepolia')) return 11155111; // Ethereum Sepolia
    if (url.includes('ethereum') || url.includes('mainnet') || url.includes('infura') || url.includes('alchemy')) return 1; // Ethereum Mainnet
    
    // Polygon networks (Layer 2)
    if (url.includes('amoy')) return 80002; // Polygon Amoy
    if (url.includes('mumbai')) return 80001; // Polygon Mumbai
    if (url.includes('polygon') || url.includes('matic')) return 137; // Polygon Mainnet
    
    // Arbitrum networks (Layer 2)
    if (url.includes('arbitrum')) {
      if (url.includes('sepolia')) return 421614; // Arbitrum Sepolia
      if (url.includes('nova')) return 42170; // Arbitrum Nova
      return 42161; // Arbitrum Mainnet
    }
    
    // Base networks (Layer 2)
    if (url.includes('base')) {
      if (url.includes('sepolia')) return 84532; // Base Sepolia
      return 8453; // Base Mainnet
    }
    
    // BNB Smart Chain networks
    if (url.includes('bsc') || url.includes('binance') || url.includes('bnb')) {
      if (url.includes('testnet')) return 97; // BNB Testnet
      return 56; // BNB Mainnet
    }
    
    // Avalanche networks
    if (url.includes('fuji')) return 43113; // Avalanche Fuji
    if (url.includes('avalanche') || url.includes('avax')) return 43114; // Avalanche Mainnet
    
    // Default fallback (Polygon Amoy for current setup)
    return 80002;
  }

  /**
   * Initialize Thirdweb SDK and contracts
   */
  private async initializeContracts(): Promise<void> {
    try {
      if (!this.config.clientId) {
        throw new Error('Thirdweb client ID not configured');
      }

      if (!this.config.nftContractAddress || !this.config.burnAddress) {
        throw new Error('Contract addresses not configured');
      }

      // Initialize SDK with Polygon Amoy testnet
      this.sdk = new ThirdwebSDK(Polygon, {
        clientId: this.config.clientId,
      });

      // Get contract instances
      this.nftContract = await this.sdk.getContract(this.config.nftContractAddress, "nft-drop");

      console.log('✅ Thirdweb burn contracts initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Thirdweb burn contracts:', error);
      throw error;
    }
  }

  /**
   * Check if on-chain burning is available
   */
  async isOnChainAvailable(): Promise<boolean> {
    try {
      if (!this.config.nftContractAddress || !this.config.burnAddress) {
        return false;
      }

      await this.initializeContracts();
      return this.nftContract !== null;
    } catch (error) {
      console.error('On-chain burning not available:', error);
      return false;
    }
  }

  /**
   * Burn NFTs on-chain using standard transfer to burn address
   */
  async burnNFTsOnChain(walletAddress: string, tokenIds: string[]): Promise<BurnResult> {
    try {
      console.log(`🔥 Starting hybrid burn for ${tokenIds.length} tokens`);

      // Initialize contracts if needed
      if (!this.nftContract) {
        await this.initializeContracts();
      }

      // Step 1: Get NFT metadata and validate burn rules off-chain
      const nftsMetadata = [];
      for (const tokenId of tokenIds) {
        const nftMetadata = await this.nftContract.get(tokenId);
        nftsMetadata.push({
          id: tokenId,
          rarity: this.extractRarityFromMetadata(nftMetadata),
          name: nftMetadata.name,
          image: nftMetadata.image
        });
      }

      // Step 2: Validate burn rules using existing burn service logic
      const burnRules = optimizedCIDPoolBurnService.getBurnRules();
      const burnRule = this.findValidBurnRule(nftsMetadata, burnRules);
      
      if (!burnRule) {
        throw new Error('Invalid NFT combination for burning');
      }

      // Step 3: Transfer NFTs to burn address (on-chain proof of burn)
      console.log(`🔗 Transferring ${tokenIds.length} NFTs to burn address...`);
      const burnTransactions = [];
      
      for (const tokenId of tokenIds) {
        const tx = await this.nftContract.transfer(this.BURN_ADDRESS, tokenId);
        const receipt = await tx.wait();
        burnTransactions.push({
          tokenId,
          hash: receipt.transactionHash,
          blockNumber: receipt.blockNumber
        });
        console.log(`✅ Burned NFT ${tokenId}: ${receipt.transactionHash}`);
      }

      // Step 4: Process upgrade logic off-chain using existing burn service
      console.log(`⚡ Processing burn upgrade off-chain...`);
      const upgradeResult = await optimizedCIDPoolBurnService.burnNFTsOffChain(
        walletAddress,
        tokenIds
      );

      // Step 5: The upgraded NFT is already handled by burnNFTsOffChain
      console.log(`✅ Upgrade processed off-chain`);

      // Step 6: Log hybrid burn transaction
      const burnTransaction: BurnTransaction = {
        hash: burnTransactions[0].hash,
        tokenIds: tokenIds,
        resultRarity: upgradeResult.resultNFT?.rarity || burnRule.resultingNFT.rarity,
        timestamp: Date.now(),
        gasUsed: '0',
        blockNumber: burnTransactions[0].blockNumber
      };

      await this.logOnChainBurnTransaction(walletAddress, burnTransaction);

      return {
        success: true,
        resultNFT: upgradeResult.resultNFT || {
          id: 'hybrid-burn-result',
          name: burnRule.resultingNFT.name,
          description: `Upgraded ${burnRule.resultingNFT.rarity} NFT from hybrid burn`,
          image: burnRule.resultingNFT.image,
          rarity: burnRule.resultingNFT.rarity,
          wallet_address: walletAddress,
          ipfs_hash: '',
          pinata_hash: '',
          metadata_uri: '',
          attributes: [
            { trait_type: 'Rarity', value: burnRule.resultingNFT.rarity },
            { trait_type: 'Source', value: 'Hybrid Burn' }
          ],
          created_at: new Date().toISOString()
        },
      };

    } catch (error) {
      console.error('❌ On-chain NFT burning failed:', error);
      toast.error(`Burning failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'burn-nfts' });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'On-chain burning failed'
      };
    }
  }

  /**
   * Burn NFTs using the specified method (no fallback)
   */
  async burnNFTs(walletAddress: string, nftIds: string[], method: 'onchain' | 'offchain'): Promise<BurnResult> {
    if (method === 'onchain') {
      console.log('🔗 Using on-chain burning (no fallback)');
      return await this.burnNFTsOnChain(walletAddress, nftIds);
    } else {
      console.log('💾 Using off-chain burning');
      return await this.burnNFTsOffChain(walletAddress, nftIds);
    }
  }





  /**
   * Find valid burn rule for given NFT metadata
   */
  private findValidBurnRule(nftsMetadata: any[], burnRules: any[]): any {
    // Group NFTs by rarity
    const rarityCount = nftsMetadata.reduce((acc, nft) => {
      acc[nft.rarity] = (acc[nft.rarity] || 0) + 1;
      return acc;
    }, {});

    // Find matching burn rule
    for (const rule of burnRules) {
      if (rarityCount[rule.minRarity] >= rule.requiredAmount) {
        return rule;
      }
    }
    return null;
  }


  /**
   * Log on-chain burn transaction to the main burn_transactions table
   */
  private async logOnChainBurnTransaction(walletAddress: string, transaction: BurnTransaction): Promise<void> {
    try {
      const { createClientWithWalletHeader } = await import('../lib/supabaseClientManager');
      const client = createClientWithWalletHeader(walletAddress);
      
      // Log to main burn_transactions table with on-chain specific fields
      const { error } = await client
        .from('burn_transactions')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          burned_nft_ids: transaction.tokenIds,
          result_rarity: transaction.resultRarity,
          burn_type: 'onchain', // Distinguish from offchain burns
          transaction_hash: transaction.hash, // On-chain transaction hash
          contract_address: this.config.nftContractAddress,
          gas_used: transaction.gasUsed,
          network: this.config.network,
          created_at: new Date(transaction.timestamp).toISOString(),
          // Additional metadata for on-chain burns
          metadata: {
            burn_method: 'hybrid',
            burn_address: this.BURN_ADDRESS,
            block_number: transaction.blockNumber || null,
            chain_id: this.config.chainId,
            rpc_url: this.config.rpcUrl
          }
        });

      if (error) {
        console.error('❌ Error logging on-chain burn transaction:', error);
      } else {
        console.log('✅ On-chain burn transaction logged to main burn_transactions table');
      }
    } catch (error) {
      console.error('❌ Error logging on-chain burn transaction:', error);
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
   * Get burn rules (delegates to OptimizedCIDPoolBurnService)
   */
  getBurnRules(): BurnRule[] {
    return optimizedCIDPoolBurnService.getBurnRules();
  }

  /**
   * Burn NFTs off-chain (delegates to OptimizedCIDPoolBurnService)
   */
  async burnNFTsOffChain(walletAddress: string, nftIds: string[]): Promise<BurnResult> {
    return await optimizedCIDPoolBurnService.burnNFTsOffChain(walletAddress, nftIds);
  }

  /**
   * Get configuration status
   */
  getConfiguration(): OnChainBurnConfig & { isConfigured: boolean } {
    return {
      ...this.config,
      isConfigured: !!(this.config.nftContractAddress && this.config.burnAddress && this.config.clientId)
    };
  }
}

export const hybridBurnService = new HybridBurnService();
export default hybridBurnService;
