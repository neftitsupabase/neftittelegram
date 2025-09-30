"use client";

import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { toast } from 'sonner';
import { NFTStakeABI, ERC721ABI, CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../abis/index';
import { NFTData } from './HybridIPFSService';
import { StakingResponse } from '../types/staking';

export class EthereumStakingService {
  private provider: BrowserProvider | null = null;
  private stakingContract: Contract | null = null;
  private nftContract: Contract | null = null;
  private userAddress: string | null = null;

  constructor() {
    this.initializeProvider();
  }

  /**
   * Initialize ethers provider and contracts
   */
  private async initializeProvider(): Promise<void> {
    try {
      if (typeof window !== "undefined" && window.ethereum) {
        this.provider = new BrowserProvider(window.ethereum);
        
        // Get connected account
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          this.userAddress = accounts[0];
          await this.initializeContracts();
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize Ethereum provider:', error);
    }
  }

  /**
   * Initialize smart contracts with signer
   */
  private async initializeContracts(): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const signer = await this.provider.getSigner();
      
      this.stakingContract = new Contract(
        CONTRACT_ADDRESSES.STAKING_CONTRACT,
        NFTStakeABI,
        signer
      );
      
      this.nftContract = new Contract(
        CONTRACT_ADDRESSES.NFT_CONTRACT,
        ERC721ABI,
        signer
      );

      // Validate contracts are deployed and accessible
      await this.validateContracts();

      console.log('✅ Ethereum contracts initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize contracts:', error);
      throw error;
    }
  }

  /**
   * Validate that contracts are properly deployed and accessible
   */
  private async validateContracts(): Promise<void> {
    try {
      if (!this.stakingContract || !this.nftContract) {
        throw new Error('Contracts not initialized');
      }

      // Test staking contract by calling a view function
      const stakingToken = await (this.stakingContract as any).stakingToken();
      console.log('🔍 Staking contract validation - stakingToken:', stakingToken);

      // Test NFT contract by calling a view function
      const nftName = await (this.nftContract as any).name();
      console.log('🔍 NFT contract validation - name:', nftName);

      // Verify the staking contract is pointing to the correct NFT contract
      if (stakingToken.toLowerCase() !== CONTRACT_ADDRESSES.NFT_CONTRACT.toLowerCase()) {
        console.warn('⚠️ Warning: Staking contract is configured for different NFT contract');
        console.warn(`Expected: ${CONTRACT_ADDRESSES.NFT_CONTRACT}`);
        console.warn(`Actual: ${stakingToken}`);
      }

    } catch (error: any) {
      console.error('❌ Contract validation failed:', error);
      
      if (error.message.includes('call revert exception')) {
        throw new Error('Contract not deployed or not accessible on current network');
      } else if (error.message.includes('Internal JSON-RPC error')) {
        throw new Error('RPC connection error - please check network connection');
      } else {
        throw new Error(`Contract validation failed: ${error.message}`);
      }
    }
  }

  /**
   * Ensure user is connected and contracts are initialized
   */
  private async ensureConnection(): Promise<void> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    if (!this.userAddress) {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      this.userAddress = accounts[0];
    }

    if (!this.stakingContract || !this.nftContract) {
      await this.initializeContracts();
    }

    // Ensure correct network
    await this.ensureCorrectNetwork();
  }

  /**
   * Switch to correct network if needed
   */
  private async ensureCorrectNetwork(): Promise<void> {
    try {
      const network = await this.provider!.getNetwork();
      
      if (Number(network.chainId) !== NETWORK_CONFIG.CHAIN_ID) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${NETWORK_CONFIG.CHAIN_ID.toString(16)}` }],
        });
      }
    } catch (switchError: any) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${NETWORK_CONFIG.CHAIN_ID.toString(16)}`,
            chainName: NETWORK_CONFIG.NETWORK_NAME,
            nativeCurrency: {
              name: 'MATIC',
              symbol: NETWORK_CONFIG.CURRENCY_SYMBOL,
              decimals: 18,
            },
            rpcUrls: [NETWORK_CONFIG.RPC_URL],
            blockExplorerUrls: [NETWORK_CONFIG.BLOCK_EXPLORER],
          }],
        });
      }
    }
  }

  /**
   * Check if NFT is approved for staking
   */
  private async checkApproval(tokenId: string): Promise<boolean> {
    if (!this.nftContract || !this.userAddress) {
      throw new Error('Contracts not initialized');
    }

    try {
      // Check if approved for all
      const isApprovedForAll = await (this.nftContract as any).isApprovedForAll(
        this.userAddress,
        CONTRACT_ADDRESSES.STAKING_CONTRACT
      );

      if (isApprovedForAll) {
        return true;
      }

      // Check individual token approval
      const approvedAddress = await (this.nftContract as any).getApproved(tokenId);
      return approvedAddress.toLowerCase() === CONTRACT_ADDRESSES.STAKING_CONTRACT.toLowerCase();
    } catch (error) {
      console.error('❌ Failed to check approval:', error);
      return false;
    }
  }

  /**
   * Approve NFT for staking
   */
  private async approveNFT(): Promise<boolean> {
    if (!this.nftContract || !this.userAddress) {
      throw new Error('Contracts not initialized');
    }

    try {
      console.log('🔐 Requesting NFT approval...');
      
      // Type assertion to access ERC721 methods
      const tx = await (this.nftContract as any).setApprovalForAll(
        CONTRACT_ADDRESSES.STAKING_CONTRACT,
        true
      );
      
      console.log('⏳ Waiting for approval transaction...');
      await tx.wait();
      
      console.log('✅ NFT approval completed');
      return true;
    } catch (error: any) {
      console.error('❌ NFT approval failed:', error);
      
      if (error.code === 'ACTION_REJECTED') {
        toast.error('Approval cancelled by user');
      } else {
        toast.error('Failed to approve NFT for staking');
      }
      
      return false;
    }
  }

  /**
   * Stake NFT onchain
   */
  async stakeNFT(tokenId: string): Promise<StakingResponse> {
    try {
      await this.ensureConnection();
      
      if (!this.stakingContract || !this.nftContract || !this.userAddress) {
        throw new Error('Contracts not initialized');
      }

      console.log(`🔗 Starting onchain NFT staking for token: ${tokenId}`);

      // Check if already staked FIRST (before ownership check)
      const stakeInfo = await this.getStakeInfo();
      if (stakeInfo.stakedNFTs.includes(tokenId)) {
        throw new Error(`Token #${tokenId} is already staked`);
      }

      // Verify ownership (if not staked, user should own it)
      const owner = await (this.nftContract as any).ownerOf(tokenId);
      if (owner.toLowerCase() !== this.userAddress.toLowerCase()) {
        // Check if it's owned by staking contract (already staked by someone else)
        if (owner.toLowerCase() === CONTRACT_ADDRESSES.STAKING_CONTRACT.toLowerCase()) {
          throw new Error(`Token #${tokenId} is already staked by another user`);
        } else {
          throw new Error(`You don't own token #${tokenId}. Current owner: ${owner}`);
        }
      }

      // Check and handle approval
      const isApproved = await this.checkApproval(tokenId);
      if (!isApproved) {
        const approvalSuccess = await this.approveNFT();
        if (!approvalSuccess) {
          throw new Error('NFT approval required for staking');
        }
      }

      // Execute staking transaction
      toast.loading('Staking NFT onchain...', { id: 'stake-nft' });
      
      console.log(`🔗 Attempting to stake token ${tokenId} on contract ${CONTRACT_ADDRESSES.STAKING_CONTRACT}`);
      
      // Cast to any to access the stake method from ABI
      const tx = await (this.stakingContract as any).stake([tokenId]);
      console.log('📤 Staking transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('✅ NFT staked successfully onchain');
      
      toast.success('NFT staked successfully onchain!', { id: 'stake-nft' });

      return {
        success: true,
        message: 'NFT staked successfully onchain',
        data: {
          tokenId,
          transactionHash: tx.hash,
          onchain: true
        }
      };

    } catch (error: any) {
      console.error('❌ Onchain NFT staking failed:', error);
      
      let userMessage = 'Onchain staking failed';
      if (error.code === 'ACTION_REJECTED') {
        userMessage = 'Transaction cancelled by user';
      } else if (error.message.includes('insufficient funds')) {
        userMessage = 'Insufficient MATIC for gas fees';
      } else if (error.message.includes("don't own")) {
        userMessage = error.message;
      } else if (error.message.includes('already staked')) {
        userMessage = error.message;
      } else {
        userMessage = error.message || 'Unknown error occurred';
      }
      
      toast.error(userMessage, { id: 'stake-nft' });
      
      return {
        success: false,
        message: userMessage,
        data: null
      };
    }
  }

  /**
   * Unstake NFT from onchain
   */
  async unstakeNFT(tokenId: string): Promise<StakingResponse> {
    try {
      await this.ensureConnection();
      
      if (!this.stakingContract || !this.userAddress) {
        throw new Error('Contracts not initialized');
      }

      console.log(`🔗 Starting onchain NFT unstaking for token: ${tokenId}`);

      // Verify NFT is staked
      const stakeInfo = await this.getStakeInfo();
      if (!stakeInfo.stakedNFTs.includes(tokenId)) {
        throw new Error(`Token #${tokenId} is not currently staked`);
      }

      // Execute unstaking transaction
      toast.loading('Unstaking NFT from blockchain...', { id: 'unstake-nft' });
      
      // Cast to any to access the withdraw method from ABI
      const tx = await (this.stakingContract as any).withdraw([tokenId]);
      console.log('📤 Unstaking transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('✅ NFT unstaked successfully from onchain');
      
      toast.success('NFT unstaked successfully!', { id: 'unstake-nft' });

      return {
        success: true,
        message: 'NFT unstaked successfully',
        data: {
          tokenId,
          transactionHash: tx.hash,
          onchain: true
        }
      };

    } catch (error: any) {
      console.error('❌ Onchain NFT unstaking failed:', error);
      
      let userMessage = 'Onchain unstaking failed';
      if (error.code === 'ACTION_REJECTED') {
        userMessage = 'Transaction cancelled by user';
      } else if (error.message.includes('insufficient funds')) {
        userMessage = 'Insufficient MATIC for gas fees';
      } else if (error.message.includes('not currently staked')) {
        userMessage = error.message;
      } else {
        userMessage = error.message || 'Unknown error occurred';
      }
      
      toast.error(userMessage, { id: 'unstake-nft' });
      
      return {
        success: false,
        message: userMessage,
        data: null
      };
    }
  }

  /**
   * Get staking information for current user
   */
  async getStakeInfo(): Promise<{ stakedNFTs: string[], rewards: string }> {
    try {
      await this.ensureConnection();
      
      if (!this.stakingContract || !this.userAddress) {
        throw new Error('Contracts not initialized');
      }

      const [tokens, reward] = await (this.stakingContract as any).getStakeInfo(this.userAddress);
      
      return {
        stakedNFTs: tokens.map((t: bigint) => t.toString()),
        rewards: formatUnits(reward, 18)
      };
    } catch (error) {
      console.error('❌ Failed to get stake info:', error);
      return {
        stakedNFTs: [],
        rewards: '0'
      };
    }
  }

  /**
   * Get all staked NFTs for current user
   */
  async getStakedNFTs(): Promise<NFTData[]> {
    try {
      const stakeInfo = await this.getStakeInfo();
      
      return stakeInfo.stakedNFTs.map(tokenId => ({
        id: `onchain_${tokenId}`,
        name: `Onchain NFT ${tokenId}`,
        image: '', // Would need to fetch from tokenURI
        rarity: 'unknown',
        wallet_address: this.userAddress || '',
        isStaked: true,
        stakingMethod: 'onchain' as const
      }));
    } catch (error) {
      console.error('❌ Failed to get staked NFTs:', error);
      return [];
    }
  }

  /**
   * Claim staking rewards (offchain via database)
   */
  async claimRewards(): Promise<StakingResponse> {
    try {
      if (!this.userAddress) {
        await this.ensureConnection();
      }

      if (!this.userAddress) {
        throw new Error('User not connected');
      }

      console.log('🏦 Claiming staking rewards offchain for:', this.userAddress);

      // Import enhanced staking service for offchain reward claiming
      const { default: enhancedStakingService } = await import('./EnhancedStakingService');
      
      toast.loading('Claiming staking rewards...', { id: 'claim-rewards' });
      
      // Use offchain service to claim rewards
      const result = await enhancedStakingService.claimStakingRewards(this.userAddress);
      
      if (result.success) {
        console.log('✅ Rewards claimed successfully offchain');
        toast.success(`Claimed ${result.data?.amount || '0'} NEFT rewards!`, { id: 'claim-rewards' });
        
        return {
          success: true,
          message: 'Rewards claimed successfully',
          data: {
            amount: result.data?.amount || '0',
            method: 'offchain'
          }
        };
      } else {
        throw new Error(result.message || 'Failed to claim rewards');
      }

    } catch (error: any) {
      console.error('❌ Failed to claim rewards offchain:', error);
      
      let userMessage = 'Failed to claim rewards';
      if (error.message.includes('No rewards')) {
        userMessage = 'No rewards available to claim';
      } else if (error.message.includes('not connected')) {
        userMessage = 'Please connect your wallet';
      } else {
        userMessage = error.message || 'Unknown error occurred';
      }
      
      toast.error(userMessage, { id: 'claim-rewards' });
      
      return {
        success: false,
        message: userMessage,
        data: null
      };
    }
  }

  /**
   * Check if onchain staking is available
   */
  async isOnChainAvailable(): Promise<boolean> {
    try {
      if (!this.provider) {
        await this.initializeProvider();
      }
      
      if (!this.provider) {
        return false;
      }

      const network = await this.provider.getNetwork();
      return Number(network.chainId) === NETWORK_CONFIG.CHAIN_ID;
    } catch (error) {
      console.error('❌ Onchain staking not available:', error);
      return false;
    }
  }

  /**
   * Get current user address
   */
  getUserAddress(): string | null {
    return this.userAddress;
  }

  /**
   * Refresh connection and contracts
   */
  async refreshConnection(): Promise<void> {
    this.provider = null;
    this.stakingContract = null;
    this.nftContract = null;
    this.userAddress = null;
    
    await this.initializeProvider();
  }
}

// Export singleton instance
export const ethereumStakingService = new EthereumStakingService();
export default ethereumStakingService;
