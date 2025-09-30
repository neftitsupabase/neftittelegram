/**
 * Enhanced Hybrid Burn Service - Smart Mixed Onchain/Offchain Burning
 * Handles mixed selections intelligently:
 * - Mixed offchain/onchain of same rarity: burn each type appropriately
 * - Pure onchain: burn onchain, provide result from offchain CID pool
 * - Pure offchain: existing working system
 */

import Web3 from "web3";
import { ERC721ABI, CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../abis/index';
import { optimizedCIDPoolBurnService } from './OptimizedCIDPoolBurnService';
import type { BurnResult, BurnRule } from './OptimizedCIDPoolBurnService';
import type { NFTData } from './HybridIPFSService';
import { nftLifecycleService, OffchainNFT, OnchainNFT } from './NFTLifecycleService';
import { getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { getIPFSUrl } from '../config/ipfsConfig';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface NFTWithStatus extends NFTData {
  status: 'offchain' | 'onchain';
  tokenId?: string;
  contractAddress?: string;
  stakingStatus?: 'staked' | 'unstaked';
  isStaked?: boolean;
}

interface BurnGroup {
  offchainNFTs: NFTWithStatus[];
  onchainNFTs: NFTWithStatus[];
  rarity: string;
  totalCount: number;
}

interface BurnTransaction {
  hash?: string;
  tokenIds: string[];
  resultRarity: string;
  timestamp: number;
  gasUsed?: string;
  blockNumber?: number;
  burnType: 'hybrid' | 'onchain' | 'offchain';
}

class EnhancedHybridBurnService {
  private web3: Web3 | null = null;
  private nftContract: any = null;
  private userAccount: string | null = null;
  private readonly BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

  constructor() {
    this.initializeWeb3();
  }

  /**
   * Initialize Web3 with MetaMask provider
   */
  private async initializeWeb3(): Promise<void> {
    try {
      if (!window.ethereum) {
        console.log('MetaMask not available, using read-only mode');
        return;
      }
      
      this.web3 = new Web3(window.ethereum);
      
      // Get user account (if connected)
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        this.userAccount = accounts[0] || null;
      } catch (error) {
        console.log('No MetaMask account connected, using read-only mode');
        this.userAccount = null;
      }
      
      if (this.userAccount) {
        console.log('👤 Connected account:', this.userAccount.toLowerCase());
        
        // Verify chain ID
        const chainId = await this.web3.eth.getChainId();
        console.log('Connected to chain ID:', chainId);
        
        if (Number(chainId) !== NETWORK_CONFIG.CHAIN_ID) {
          throw new Error(`Wrong network. Expected ${NETWORK_CONFIG.CHAIN_ID}, got ${chainId}`);
        }
      }
      
      console.log('✅ Web3 setup complete for burning');
      
    } catch (error) {
      console.error('❌ Failed to initialize Web3:', error);
      // Don't throw error, just log it and continue in read-only mode
      console.log('Continuing in read-only mode...');
    }
  }


  /**
   * Initialize Web3 contracts for burning
   */
  private async initializeContracts(): Promise<void> {
    try {
      if (!this.web3) {
        await this.initializeWeb3();
      }

      if (!this.web3) {
        throw new Error('Web3 not initialized');
      }

      // Request account access if needed
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Get the connected account
      const accounts = await this.web3.eth.getAccounts();
      this.userAccount = accounts[0];
      
      if (!this.userAccount) {
        throw new Error('No accounts connected');
      }
      
      // Initialize NFT contract
      this.nftContract = new this.web3.eth.Contract(
        ERC721ABI as any,
        CONTRACT_ADDRESSES.NFT_CONTRACT
      );
      
      console.log('✅ Enhanced hybrid burn contracts initialized with wallet connection');
    } catch (error) {
      console.error('❌ Failed to initialize enhanced hybrid burn contracts:', error);
      throw error;
    }
  }

  /**
   * Check if on-chain burning is available
   */
  async isOnChainAvailable(): Promise<boolean> {
    try {
      if (!CONTRACT_ADDRESSES.NFT_CONTRACT) return false;
      await this.initializeContracts();
      return this.nftContract !== null;
    } catch (error) {
      console.error('On-chain burning not available:', error);
      return false;
    }
  }

  /**
   * Analyze NFT selection and group by status and rarity
   */
  private analyzeNFTSelection(nfts: NFTWithStatus[]): {
    burnGroups: BurnGroup[];
    burnStrategy: 'pure_offchain' | 'pure_onchain' | 'mixed';
    isValid: boolean;
    applicableRule?: BurnRule;
  } {
    console.log('🔍 Analyzing NFT selection for hybrid burn...');
    
    // Group NFTs by rarity
    const rarityGroups: Record<string, BurnGroup> = {};
    
    nfts.forEach(nft => {
      const rarity = nft.rarity.toLowerCase();
      if (!rarityGroups[rarity]) {
        rarityGroups[rarity] = {
          offchainNFTs: [],
          onchainNFTs: [],
          rarity,
          totalCount: 0
        };
      }
      
      if (nft.status === 'offchain') {
        rarityGroups[rarity].offchainNFTs.push(nft);
      } else {
        rarityGroups[rarity].onchainNFTs.push(nft);
      }
      rarityGroups[rarity].totalCount++;
    });

    const burnGroups = Object.values(rarityGroups);
    
    // Determine burn strategy
    let burnStrategy: 'pure_offchain' | 'pure_onchain' | 'mixed' = 'pure_offchain';
    const hasOffchain = nfts.some(nft => nft.status === 'offchain');
    const hasOnchain = nfts.some(nft => nft.status === 'onchain');
    
    if (hasOffchain && hasOnchain) {
      burnStrategy = 'mixed';
    } else if (hasOnchain && !hasOffchain) {
      burnStrategy = 'pure_onchain';
    }

    // Validate against burn rules
    const burnRules = optimizedCIDPoolBurnService.getBurnRules();
    let applicableRule: BurnRule | undefined;
    let isValid = false;

    // Check if any rarity group matches a burn rule
    for (const group of burnGroups) {
      const rule = burnRules.find(r => 
        r.minRarity.toLowerCase() === group.rarity && 
        r.requiredAmount === group.totalCount
      );
      
      if (rule) {
        applicableRule = rule;
        isValid = true;
        break;
      }
    }

    console.log('📊 Analysis result:', {
      burnStrategy,
      isValid,
      groupCount: burnGroups.length,
      applicableRule: applicableRule?.resultingNFT.rarity
    });

    return {
      burnGroups,
      burnStrategy,
      isValid,
      applicableRule
    };
  }

  /**
   * Execute smart hybrid burn based on NFT selection
   */
  async executeSmartHybridBurn(walletAddress: string, nfts: NFTWithStatus[]): Promise<BurnResult> {
    try {
      console.log(`🚀 Starting smart hybrid burn for ${nfts.length} NFTs`);

      // Analyze the selection
      const analysis = this.analyzeNFTSelection(nfts);
      
      if (!analysis.isValid || !analysis.applicableRule) {
        throw new Error('Invalid NFT combination for burning');
      }

      const { burnGroups, burnStrategy, applicableRule } = analysis;
      console.log(`🎯 Burn strategy: ${burnStrategy}`);

      let onchainBurnHashes: string[] = [];
      let resultNFT: NFTData;

      // Execute burn based on strategy
      switch (burnStrategy) {
        case 'pure_offchain':
          console.log('💾 Executing pure offchain burn...');
          return await this.executePureOffchainBurn(walletAddress, nfts.map(n => n.id));

        case 'pure_onchain':
          console.log('⛓️ Executing pure onchain burn with offchain result...');
          onchainBurnHashes = await this.burnOnchainNFTs(nfts.filter(n => n.status === 'onchain'));
          resultNFT = await this.getResultNFTFromOffchainPool(walletAddress, applicableRule.resultingNFT.rarity);
          break;

        case 'mixed':
          console.log('🔀 Executing mixed hybrid burn...');
          
          // Burn onchain NFTs on blockchain
          const onchainNFTs = nfts.filter(n => n.status === 'onchain');
          if (onchainNFTs.length > 0) {
            onchainBurnHashes = await this.burnOnchainNFTs(onchainNFTs);
          }

          // Burn offchain NFTs using offchain service
          const offchainNFTs = nfts.filter(n => n.status === 'offchain');
          if (offchainNFTs.length > 0) {
            await this.burnOffchainNFTsInDatabase(walletAddress, offchainNFTs.map(n => n.id));
          }

          // Get result NFT from offchain CID pool
          resultNFT = await this.getResultNFTFromOffchainPool(walletAddress, applicableRule.resultingNFT.rarity);
          break;

        default:
          throw new Error('Unknown burn strategy');
      }

      // Log the hybrid burn transaction
      let burnType: 'offchain' | 'onchain' | 'hybrid';
      if (burnStrategy === 'pure_onchain') {
        burnType = 'onchain';
      } else {
        burnType = 'hybrid';
      }

      const burnTransaction: BurnTransaction = {
        hash: onchainBurnHashes[0] || undefined,
        tokenIds: nfts.map(n => n.tokenId || n.id),
        resultRarity: applicableRule.resultingNFT.rarity,
        timestamp: Date.now(),
        burnType
      };

      await this.logHybridBurnTransaction(walletAddress, burnTransaction, nfts);

      console.log('✅ Smart hybrid burn completed successfully');
      return {
        success: true,
        resultNFT: resultNFT!
      };

    } catch (error) {
      console.error('❌ Smart hybrid burn failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Smart hybrid burn failed'
      };
    }
  }

  /**
   * Burn onchain NFTs by transferring to burn address
   */
  private async burnOnchainNFTs(onchainNFTs: NFTWithStatus[]): Promise<string[]> {
    console.log(`🔥 Burning ${onchainNFTs.length} onchain NFTs...`);
    
    if (!this.nftContract || !this.web3 || !this.userAccount) {
      await this.initializeContracts();
    }

    const burnHashes: string[] = [];
    
    for (const nft of onchainNFTs) {
      try {
        const tokenId = parseInt(nft.tokenId || nft.id);
        
        // Check if NFT is staked - staked NFTs cannot be burned
        // For onchain NFTs, this should already be checked by blockchain status
        if (nft.id.includes('staked_') || nft.stakingStatus === 'staked' || nft.isStaked === true) {
          console.error(`❌ Cannot burn staked NFT ${tokenId} - must unstake first`);
          throw new Error(`NFT ${tokenId} is currently staked and cannot be burned. Please unstake it first.`);
        }
        
        console.log(`🔗 Burning onchain NFT ${tokenId}...`);
        
        // Estimate gas for the transfer
        const gasLimit = await this.nftContract!.methods
          .transferFrom(this.userAccount, this.BURN_ADDRESS, tokenId)
          .estimateGas({ from: this.userAccount });
        
        // Get current gas price
        const gasPrice = await this.web3!.eth.getGasPrice();
        
        // Execute the transfer to burn address
        const result = await this.nftContract!.methods
          .transferFrom(this.userAccount, this.BURN_ADDRESS, tokenId)
          .send({
            from: this.userAccount,
            gas: Math.floor(Number(gasLimit) * 1.2), // 20% buffer
            gasPrice: gasPrice
          });
        
        burnHashes.push(result.transactionHash);
        console.log(`✅ Onchain NFT ${tokenId} burned: ${result.transactionHash}`);
      } catch (error) {
        console.error(`❌ Failed to burn onchain NFT ${nft.id}:`, error);
        throw error;
      }
    }

    return burnHashes;
  }

  /**
   * Burn offchain NFTs by removing from database
   */
  private async burnOffchainNFTsInDatabase(walletAddress: string, nftIds: string[]): Promise<void> {
    console.log(`🗑️ Burning ${nftIds.length} offchain NFTs in database...`);
    
    try {
      const client = getWalletSupabaseClient(walletAddress);

      const { error } = await client
        .from('nft_cid_distribution_log')
        .delete()
        .eq('wallet_address', walletAddress.toLowerCase())
        .in('nft_id', nftIds);

      if (error) {
        throw new Error(`Failed to burn offchain NFTs: ${error.message}`);
      }

      console.log(`✅ Burned ${nftIds.length} offchain NFTs from database`);
    } catch (error) {
      console.error('❌ Error burning offchain NFTs:', error);
      throw error;
    }
  }

  /**
   * Get result NFT from offchain CID pool and add to user's collection
   */
  private async getResultNFTFromOffchainPool(walletAddress: string, rarity: string): Promise<NFTData> {
    console.log(`🎁 Getting result NFT from offchain CID pool: ${rarity}`);
    
    try {
      const { getWalletSupabaseClient } = await import('../lib/supabaseClientManager');
      const client = getWalletSupabaseClient(walletAddress);

      // Get available NFT from CID pool
      const { data: cidPoolNFT, error: poolError } = await client
        .from('nft_cid_pools')
        .select('*')
        .eq('rarity', rarity.toLowerCase())
        .eq('is_distributed', false)
        .limit(1)
        .single();

      if (poolError || !cidPoolNFT) {
        throw new Error(`No available ${rarity} NFT found in CID pool`);
      }

      // Create result NFT
      const resultNFT: NFTData = {
        id: uuidv4(),
        name: `NEFTIT ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} NFT`,
        description: '',
        image: cidPoolNFT.image_url || getIPFSUrl(cidPoolNFT.cid),
        rarity: rarity,
        wallet_address: walletAddress,
        ipfs_hash: cidPoolNFT.cid,
        pinata_hash: cidPoolNFT.cid,
        metadata_uri: getIPFSUrl(cidPoolNFT.metadata_cid),
        attributes: [
          { trait_type: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1) },
          { trait_type: 'Platform', value: 'NEFTIT' },
          { trait_type: 'Source', value: 'Hybrid Burn Upgrade' }
        ],
        created_at: new Date().toISOString()
      };

      // Ensure user exists in user_nft_collections table first
      const { error: syncError } = await client.rpc('sync_user_nft_collection', {
        p_wallet_address: walletAddress.toLowerCase()
      });

      if (syncError) {
        console.warn('⚠️ Warning syncing user collection (continuing anyway):', syncError);
      }

      // Add to user's collection
      const { error: insertError } = await client
        .from('nft_cid_distribution_log')
        .insert({
          nft_id: resultNFT.id,
          wallet_address: walletAddress.toLowerCase(),
          rarity: resultNFT.rarity,
          cid: resultNFT.ipfs_hash,
          distributed_at: new Date().toISOString()
        });

      if (insertError) {
        throw new Error(`Failed to add result NFT: ${insertError.message}`);
      }

      // Mark CID pool NFT as distributed
      const { error: updateError } = await client
        .from('nft_cid_pools')
        .update({
          is_distributed: true,
          distributed_at: new Date().toISOString(),
          distributed_to_wallet: walletAddress.toLowerCase()
        })
        .eq('id', cidPoolNFT.id);

      if (updateError) {
        console.error('❌ Error marking CID pool NFT as distributed:', updateError);
      }

      console.log(`✅ Result NFT created and added to collection: ${resultNFT.id}`);
      return resultNFT;

    } catch (error) {
      console.error('❌ Error getting result NFT from offchain pool:', error);
      throw error;
    }
  }

  /**
   * Execute pure offchain burn (delegate to existing service)
   */
  private async executePureOffchainBurn(walletAddress: string, nftIds: string[]): Promise<BurnResult> {
    console.log('💾 Delegating to pure offchain burn service...');
    return await optimizedCIDPoolBurnService.burnNFTsOffChain(walletAddress, nftIds);
  }

  /**
   * Log hybrid burn transaction
   */
  private async logHybridBurnTransaction(
    walletAddress: string, 
    transaction: BurnTransaction, 
    burnedNFTs: NFTWithStatus[]
  ): Promise<void> {
    try {
      const { getWalletSupabaseClient } = await import('../lib/supabaseClientManager');
      const client = getWalletSupabaseClient(walletAddress);
      
      const { error } = await client
        .from('burn_transactions')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          burned_nft_ids: burnedNFTs.map(nft => nft.id),
          result_rarity: transaction.resultRarity,
          burn_type: transaction.burnType,
          transaction_hash: transaction.hash || null,
          contract_address: transaction.burnType !== 'offchain' ? CONTRACT_ADDRESSES.NFT_CONTRACT : null,
          gas_used: transaction.gasUsed || null,
          network: transaction.burnType !== 'offchain' ? 'polygon-amoy' : null,
          created_at: new Date(transaction.timestamp).toISOString(),
          metadata: {
            burn_method: 'enhanced_hybrid',
            onchain_nfts: burnedNFTs.filter(n => n.status === 'onchain').length,
            offchain_nfts: burnedNFTs.filter(n => n.status === 'offchain').length,
            burn_strategy: transaction.burnType,
            burn_address: transaction.burnType !== 'offchain' ? this.BURN_ADDRESS : null
          }
        });

      if (error) {
        console.error('❌ Error logging hybrid burn transaction:', error);
      } else {
        console.log('✅ Hybrid burn transaction logged successfully');
      }
    } catch (error) {
      console.error('❌ Error logging hybrid burn transaction:', error);
    }
  }

  /**
   * Get burn rules (delegate to existing service)
   */
  getBurnRules(): BurnRule[] {
    return optimizedCIDPoolBurnService.getBurnRules();
  }

  /**
   * Get configuration for debugging
   */
  getConfiguration(): { isConfigured: boolean; nftContractAddress: string; network: string } {
    return {
      nftContractAddress: CONTRACT_ADDRESSES.NFT_CONTRACT,
      network: 'polygon-amoy',
      isConfigured: !!(CONTRACT_ADDRESSES.NFT_CONTRACT)
    };
  }
}

export const enhancedHybridBurnService = new EnhancedHybridBurnService();
export default enhancedHybridBurnService;
