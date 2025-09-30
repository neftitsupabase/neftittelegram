/**
 * Contract Event Monitor - Synchronizes On-Chain Events with Off-Chain Systems
 * Monitors Thirdweb contracts and custom burn contract for events
 */

import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { Polygon } from "@thirdweb-dev/chains";
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface EventMonitorConfig {
  nftDropAddress: string;
  stakingAddress: string;
  burnAddress: string;
  rpcUrl: string;
  clientId: string;
  pollInterval: number; // milliseconds
}

interface ProcessedContractEvent {
  contractAddress: string;
  eventName: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  args: any;
  processed: boolean;
}

interface StakeEvent extends ProcessedContractEvent {
  staker: string;
  tokenId: string;
}

interface UnstakeEvent extends ProcessedContractEvent {
  staker: string;
  tokenId: string;
}

interface BurnEvent extends ProcessedContractEvent {
  burner: string;
  tokenIds: string[];
  burnRule: string;
  resultRarity: string;
}

interface TransferEvent extends ProcessedContractEvent {
  from: string;
  to: string;
  tokenId: string;
}

class ContractEventMonitor {
  private sdk: ThirdwebSDK | null = null;
  private supabase: SupabaseClient;
  private config: EventMonitorConfig;
  private isMonitoring: boolean = false;
  private monitoringIntervals: NodeJS.Timeout[] = [];

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Load configuration from environment variables
    this.config = {
      nftDropAddress: import.meta.env.VITE_NFT_DROP_ADDRESS || '',
      stakingAddress: import.meta.env.VITE_NFT_STAKING_ADDRESS || '',
      burnAddress: import.meta.env.VITE_BURN_CONTRACT_ADDRESS || '',
      rpcUrl: import.meta.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || '',
      pollInterval: 30000 // 30 seconds
    };
  }

  /**
   * Initialize Thirdweb SDK
   */
  private async initializeSDK(): Promise<void> {
    try {
      if (!this.config.clientId) {
        throw new Error('Thirdweb client ID not configured');
      }

      // Initialize SDK with Polygon Amoy testnet
      this.sdk = new ThirdwebSDK(Polygon, {
        clientId: this.config.clientId,
      });

      console.log('✅ Contract event monitor SDK initialized');
    } catch (error) {
      console.error('❌ Failed to initialize event monitor SDK:', error);
      throw error;
    }
  }

  /**
   * Start monitoring all contract events
   */
  async startMonitoring(): Promise<void> {
    try {
      if (this.isMonitoring) {
        console.log('⚠️ Event monitoring already running');
        return;
      }

      console.log('🚀 Starting contract event monitoring...');

      // Initialize SDK
      await this.initializeSDK();

      // Start monitoring each contract
      if (this.config.nftDropAddress) {
        this.startNFTDropMonitoring();
      }

      if (this.config.stakingAddress) {
        this.startStakingMonitoring();
      }

      if (this.config.burnAddress) {
        this.startBurnMonitoring();
      }

      this.isMonitoring = true;
      console.log('✅ Contract event monitoring started');

    } catch (error) {
      console.error('❌ Failed to start event monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring all contract events
   */
  stopMonitoring(): void {
    console.log('🛑 Stopping contract event monitoring...');

    // Clear all intervals
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals = [];

    this.isMonitoring = false;
    console.log('✅ Contract event monitoring stopped');
  }

  /**
   * Monitor NFT Drop contract events (Transfer, Claim)
   */
  private startNFTDropMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.processNFTDropEvents();
      } catch (error) {
        console.error('❌ Error processing NFT Drop events:', error);
      }
    }, this.config.pollInterval);

    this.monitoringIntervals.push(interval);
    console.log('📡 NFT Drop event monitoring started');
  }

  /**
   * Monitor Staking contract events (Stake, Unstake)
   */
  private startStakingMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.processStakingEvents();
      } catch (error) {
        console.error('❌ Error processing staking events:', error);
      }
    }, this.config.pollInterval);

    this.monitoringIntervals.push(interval);
    console.log('📡 Staking event monitoring started');
  }

  /**
   * Monitor Burn contract events (NFTsBurned)
   */
  private startBurnMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.processBurnEvents();
      } catch (error) {
        console.error('❌ Error processing burn events:', error);
      }
    }, this.config.pollInterval);

    this.monitoringIntervals.push(interval);
    console.log('📡 Burn event monitoring started');
  }

  /**
   * Process NFT Drop contract events
   */
  private async processNFTDropEvents(): Promise<void> {
    try {
      if (!this.sdk) return;

      const nftDropContract = await this.sdk.getContract(this.config.nftDropAddress, "nft-drop");
      
      // Get recent Transfer events (mints)
      const transferEvents = await nftDropContract.events.getEvents("Transfer", {
        fromBlock: await this.getLastProcessedBlock('nft_drop', 'Transfer'),
        toBlock: "latest"
      });

      for (const event of transferEvents) {
        if (event.data.from === '0x0000000000000000000000000000000000000000') {
          // This is a mint event
          await this.processTransferEvent(event);
        }
      }

    } catch (error) {
      console.error('❌ Error processing NFT Drop events:', error);
    }
  }

  /**
   * Process Staking contract events
   */
  private async processStakingEvents(): Promise<void> {
    try {
      if (!this.sdk) return;

      const stakingContract = await this.sdk.getContract(this.config.stakingAddress, "stake");
      
      // Get recent Stake events
      const stakeEvents = await stakingContract.events.getEvents("TokensStaked", {
        fromBlock: await this.getLastProcessedBlock('staking', 'TokensStaked'),
        toBlock: "latest"
      });

      for (const event of stakeEvents) {
        await this.processStakeEvent(event);
      }

      // Get recent Unstake events
      const unstakeEvents = await stakingContract.events.getEvents("TokensWithdrawn", {
        fromBlock: await this.getLastProcessedBlock('staking', 'TokensWithdrawn'),
        toBlock: "latest"
      });

      for (const event of unstakeEvents) {
        await this.processUnstakeEvent(event);
      }

    } catch (error) {
      console.error('❌ Error processing staking events:', error);
    }
  }

  /**
   * Process Burn contract events
   */
  private async processBurnEvents(): Promise<void> {
    try {
      if (!this.sdk) return;

      const burnContract = await this.sdk.getContract(this.config.burnAddress);
      
      // Get recent NFTsBurned events
      const burnEvents = await burnContract.events.getEvents("NFTsBurned", {
        fromBlock: await this.getLastProcessedBlock('burn', 'NFTsBurned'),
        toBlock: "latest"
      });

      for (const event of burnEvents) {
        await this.processBurnEvent(event);
      }

    } catch (error) {
      console.error('❌ Error processing burn events:', error);
    }
  }

  /**
   * Process Transfer event (NFT mint)
   */
  private async processTransferEvent(event: any): Promise<void> {
    try {
      const transferEvent: TransferEvent = {
        contractAddress: this.config.nftDropAddress,
        eventName: 'Transfer',
        transactionHash: event.transaction.transactionHash,
        blockNumber: event.transaction.blockNumber,
        timestamp: Date.now(),
        args: event.data,
        processed: false,
        from: event.data.from,
        to: event.data.to,
        tokenId: event.data.tokenId.toString()
      };

      // Sync with database
      await this.syncEventWithDatabase(transferEvent);

      // Update NFT counts for the recipient
      await this.updateNFTCountsAfterMint(transferEvent.to, transferEvent.tokenId);

      console.log(`✅ Processed Transfer event: ${transferEvent.tokenId} → ${transferEvent.to}`);

    } catch (error) {
      console.error('❌ Error processing Transfer event:', error);
    }
  }

  /**
   * Process Stake event
   */
  private async processStakeEvent(event: any): Promise<void> {
    try {
      const stakeEvent: StakeEvent = {
        contractAddress: this.config.stakingAddress,
        eventName: 'TokensStaked',
        transactionHash: event.transaction.transactionHash,
        blockNumber: event.transaction.blockNumber,
        timestamp: Date.now(),
        args: event.data,
        processed: false,
        staker: event.data.staker,
        tokenId: event.data.tokenIds[0]?.toString() || ''
      };

      // Sync with database
      await this.syncEventWithDatabase(stakeEvent);

      // Update staking records
      await this.updateStakingRecords(stakeEvent.staker, stakeEvent.tokenId, 'stake');

      console.log(`✅ Processed Stake event: ${stakeEvent.tokenId} by ${stakeEvent.staker}`);

    } catch (error) {
      console.error('❌ Error processing Stake event:', error);
    }
  }

  /**
   * Process Unstake event
   */
  private async processUnstakeEvent(event: any): Promise<void> {
    try {
      const unstakeEvent: UnstakeEvent = {
        contractAddress: this.config.stakingAddress,
        eventName: 'TokensWithdrawn',
        transactionHash: event.transaction.transactionHash,
        blockNumber: event.transaction.blockNumber,
        timestamp: Date.now(),
        args: event.data,
        processed: false,
        staker: event.data.staker,
        tokenId: event.data.tokenIds[0]?.toString() || ''
      };

      // Sync with database
      await this.syncEventWithDatabase(unstakeEvent);

      // Update staking records
      await this.updateStakingRecords(unstakeEvent.staker, unstakeEvent.tokenId, 'unstake');

      console.log(`✅ Processed Unstake event: ${unstakeEvent.tokenId} by ${unstakeEvent.staker}`);

    } catch (error) {
      console.error('❌ Error processing Unstake event:', error);
    }
  }

  /**
   * Process Burn event
   */
  private async processBurnEvent(event: any): Promise<void> {
    try {
      const burnEvent: BurnEvent = {
        contractAddress: this.config.burnAddress,
        eventName: 'NFTsBurned',
        transactionHash: event.transaction.transactionHash,
        blockNumber: event.transaction.blockNumber,
        timestamp: Date.now(),
        args: event.data,
        processed: false,
        burner: event.data.burner,
        tokenIds: event.data.tokenIds.map((id: any) => id.toString()),
        burnRule: event.data.burnRule,
        resultRarity: event.data.resultRarity
      };

      // Sync with database
      await this.syncEventWithDatabase(burnEvent);

      // Process burn upgrade (mint new NFT)
      await this.processBurnUpgrade(burnEvent);

      console.log(`✅ Processed Burn event: ${burnEvent.tokenIds.length} NFTs → ${burnEvent.resultRarity}`);

    } catch (error) {
      console.error('❌ Error processing Burn event:', error);
    }
  }

  /**
   * Sync event with database
   */
  async syncEventWithDatabase(event: ProcessedContractEvent): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('contract_events')
        .upsert({
          contract_address: event.contractAddress,
          event_name: event.eventName,
          transaction_hash: event.transactionHash,
          block_number: event.blockNumber,
          timestamp: new Date(event.timestamp).toISOString(),
          event_args: event.args,
          processed: event.processed,
          network: 'polygon-amoy'
        }, {
          onConflict: 'transaction_hash,event_name'
        });

      if (error) {
        console.error('❌ Error syncing event with database:', error);
      }

      // Update last processed block
      await this.updateLastProcessedBlock(
        event.contractAddress.includes(this.config.nftDropAddress) ? 'nft_drop' :
        event.contractAddress.includes(this.config.stakingAddress) ? 'staking' : 'burn',
        event.eventName,
        event.blockNumber
      );

    } catch (error) {
      console.error('❌ Error syncing event with database:', error);
    }
  }

  /**
   * Update NFT counts after mint
   */
  private async updateNFTCountsAfterMint(walletAddress: string, tokenId: string): Promise<void> {
    try {
      // Get NFT metadata to determine rarity
      if (!this.sdk) return;
      
      const nftDropContract = await this.sdk.getContract(this.config.nftDropAddress, "nft-drop");
      const nftMetadata = await nftDropContract.get(tokenId);
      const rarity = this.extractRarityFromMetadata(nftMetadata);

      // Update counts in database
      const { error } = await this.supabase.rpc('update_user_nft_counts_after_mint', {
        p_wallet_address: walletAddress.toLowerCase(),
        p_rarity: rarity,
        p_token_id: tokenId
      });

      if (error) {
        console.error('❌ Error updating NFT counts after mint:', error);
      }

    } catch (error) {
      console.error('❌ Error updating NFT counts after mint:', error);
    }
  }

  /**
   * Update staking records
   */
  private async updateStakingRecords(walletAddress: string, tokenId: string, action: 'stake' | 'unstake'): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('sync_staking_from_contract_event', {
        p_wallet_address: walletAddress.toLowerCase(),
        p_token_id: tokenId,
        p_action: action
      });

      if (error) {
        console.error('❌ Error updating staking records:', error);
      }

    } catch (error) {
      console.error('❌ Error updating staking records:', error);
    }
  }

  /**
   * Process burn upgrade (mint upgraded NFT)
   */
  private async processBurnUpgrade(burnEvent: BurnEvent): Promise<void> {
    try {
      // Import hybrid NFT service to mint upgraded NFT
      const { default: hybridNFTService } = await import('./HybridNFTService');
      
      // Mint upgraded NFT to the burner
      const claimResult = await hybridNFTService.claimNFTOnChain(burnEvent.burner, 1);
      
      if (claimResult.success) {
        console.log(`✅ Upgraded NFT minted for burn: ${claimResult.transactionHash}`);
      } else {
        console.error('❌ Failed to mint upgraded NFT:', claimResult.error);
      }

    } catch (error) {
      console.error('❌ Error processing burn upgrade:', error);
    }
  }

  /**
   * Get last processed block for a contract/event combination
   */
  private async getLastProcessedBlock(contractType: string, eventName: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('event_processing_state')
        .select('last_processed_block')
        .eq('contract_type', contractType)
        .eq('event_name', eventName)
        .single();

      if (error || !data) {
        // Return a recent block number if no state exists
        return Math.max(0, (await this.getCurrentBlockNumber()) - 1000);
      }

      return data.last_processed_block;

    } catch (error) {
      console.error('❌ Error getting last processed block:', error);
      return 0;
    }
  }

  /**
   * Update last processed block
   */
  private async updateLastProcessedBlock(contractType: string, eventName: string, blockNumber: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('event_processing_state')
        .upsert({
          contract_type: contractType,
          event_name: eventName,
          last_processed_block: blockNumber,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'contract_type,event_name'
        });

      if (error) {
        console.error('❌ Error updating last processed block:', error);
      }

    } catch (error) {
      console.error('❌ Error updating last processed block:', error);
    }
  }

  /**
   * Get current block number
   */
  private async getCurrentBlockNumber(): Promise<number> {
    try {
      if (!this.sdk) {
        await this.initializeSDK();
      }

      const provider = this.sdk!.getProvider();
      const blockNumber = await provider.getBlockNumber();
      return blockNumber;

    } catch (error) {
      console.error('❌ Error getting current block number:', error);
      return 0;
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
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    config: EventMonitorConfig;
    activeIntervals: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      config: this.config,
      activeIntervals: this.monitoringIntervals.length
    };
  }
}

export const contractEventMonitor = new ContractEventMonitor();
export default contractEventMonitor;
