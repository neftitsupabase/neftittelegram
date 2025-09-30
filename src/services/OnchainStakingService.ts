import Web3 from 'web3';
import { toast } from 'sonner';
import { NFTStakeABI, ERC721ABI, CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../abis/index';
import { NFTData } from './HybridIPFSService';
import { StakingResponse } from '../types/staking';
import offChainStakingService from './EnhancedStakingService';


export class OnchainStakingService {
  private web3: Web3 | null = null;
  private nftContract: any = null;
  private stakingContract: any = null;
  private userAccount: string | null = null;

  constructor() {
    this.initializeWeb3();
  }

  private async initializeWeb3(): Promise<void> {
    try {
      // Always use reliable RPC for Web3 instance
      this.web3 = await this.initWeb3WithRPC();
      
      // Get user account from MetaMask for signing
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        this.userAccount = accounts[0];
        
        if (!this.userAccount) {
          throw new Error('No account connected');
        }
        
        await this.ensureCorrectNetwork();
        console.log('👤 Connected account:', this.userAccount);
        
        // Test the connection
        const chainId = await this.web3.eth.getChainId();
        console.log('Connected to chain ID:', chainId);
        
        if (Number(chainId) !== NETWORK_CONFIG.CHAIN_ID) {
          throw new Error(`Wrong network. Expected ${NETWORK_CONFIG.CHAIN_ID}, got ${chainId}`);
        }
        
        console.log('✅ MetaMask connection verified, chain ID:', chainId);
      } else {
        throw new Error('MetaMask not available');
      }
    } catch (error) {
      console.error('❌ Web3 initialization failed:', error);
      throw new Error('Web3 initialization failed: ' + error.message);
    }
  }

  /**
   * Switch MetaMask to correct network (without RPC override)
   */
  private async switchMetaMaskToThirdwebRPC(): Promise<void> {
    try {
      // Just switch to the correct chain ID without specifying RPC
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{
          chainId: '0x13882', // 80002 in hex (Polygon Amoy)
        }],
      });
      
      console.log('✅ MetaMask switched to Polygon Amoy network');
    } catch (switchError: any) {
      // If the chain doesn't exist, add it with our RPC endpoint
      if (switchError.code === 4902) {
        const thirdwebRpcUrl = 'https://80002.rpc.thirdweb.com/638c3db42b4a8608bf0181cc326ef233';
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x13882',
              chainName: 'Polygon Amoy Testnet',
              nativeCurrency: {
                name: 'POL',
                symbol: 'POL',
                decimals: 18,
              },
              rpcUrls: [thirdwebRpcUrl],
              blockExplorerUrls: ['https://www.oklink.com/amoy'],
            }],
          });
          console.log('✅ Added Polygon Amoy network to MetaMask');
        } catch (addError) {
          console.error('❌ Failed to add network to MetaMask:', addError);
          throw addError;
        }
      } else {
        console.error('❌ Failed to switch MetaMask network:', switchError);
        // Don't throw error, continue with existing network
      }
    }
  }

  /**
   * Initialize Web3 with RPC fallback
   * Based on Web3MetaMaskNFTService pattern
   */
  private async initWeb3WithRPC(): Promise<Web3> {
    const rpcEndpoints = [
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy-bor-rpc.publicnode.com',
      'https://rpc.ankr.com/polygon_amoy',
      'https://polygon-amoy.blockpi.network/v1/rpc/public',
      'https://80002.rpc.thirdweb.com/638c3db42b4a8608bf0181cc326ef233',
      'https://polygon-amoy.drpc.org',
      'https://polygon-amoy.g.alchemy.com/v2/demo'
    ];

    for (const rpcUrl of rpcEndpoints) {
      try {
        console.log(`🔗 Trying RPC endpoint: ${rpcUrl}`);
        const web3 = new Web3(rpcUrl);
        
        // Test the connection with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('RPC timeout')), 5000);
        });
        
        await Promise.race([
          web3.eth.getBlockNumber(),
          timeoutPromise
        ]);
        
        console.log(`✅ Successfully connected to: ${rpcUrl}`);
        return web3;
      } catch (error) {
        console.warn(`⚠️ RPC endpoint failed: ${rpcUrl}`, error);
        continue;
      }
    }
    
    throw new Error('All RPC endpoints failed');
  }

  private async ensureCorrectNetwork(): Promise<void> {
    try {
      // Ensure we're on Polygon Amoy network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${NETWORK_CONFIG.CHAIN_ID.toString(16)}` }], // 0x13882 for Amoy
        });
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
      
      console.log('✅ Web3 provider initialized on Polygon Amoy');
    } catch (error) {
      console.error('❌ Error ensuring correct network:', error);
    }
  }

  private async initializeContracts(): Promise<void> {
    try {
      if (!this.web3) {
        await this.initializeWeb3();
      }

      if (!this.web3) {
        throw new Error('No Ethereum provider available');
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      this.userAccount = accounts[0];
      
      // Create a separate Web3 instance using MetaMask provider for transactions
      const metaMaskWeb3 = new Web3(window.ethereum);
      
      // Use MetaMask Web3 for contracts that need to send transactions
      this.nftContract = new metaMaskWeb3.eth.Contract(
        ERC721ABI as any,
        CONTRACT_ADDRESSES.NFT_CONTRACT
      );
      
      this.stakingContract = new metaMaskWeb3.eth.Contract(
        NFTStakeABI as any,
        CONTRACT_ADDRESSES.STAKING_CONTRACT
      );

      console.log('✅ Contracts initialized successfully with MetaMask provider');
    } catch (error) {
      console.error('❌ Error initializing contracts:', error);
      throw error;
    }
  }

  /**
   * Check if onchain staking is available
   */
  async isOnChainAvailable(): Promise<boolean> {
    try {
      if (!this.web3) {
        await this.initializeWeb3();
      }
      
      if (!this.web3) {
        return false;
      }

      // Try to get network to verify connection
      const chainId = await this.web3.eth.getChainId();
      console.log('Connected to chain ID:', chainId);
      
      return true;
    } catch (error) {
      console.error('❌ Onchain staking not available:', error);
      return false;
    }
  }

  /**
   * Get staking info for a user (staked NFTs and rewards)
   */
  async getStakeInfo(walletAddress: string): Promise<{ stakedNFTs: string[], pendingRewards: string }> {
    try {
      await this.initializeContracts();
      
      if (!this.stakingContract) {
        throw new Error('Staking contract not initialized');
      }

      // Ensure address is properly formatted for Web3 validation
      const formattedAddress = this.web3!.utils.toChecksumAddress(walletAddress);
      
      // Get staked NFTs and rewards using the correct ABI function
      const stakeInfo = await this.stakingContract.methods.getStakeInfo(formattedAddress).call();
      const stakedTokens = stakeInfo._tokensStaked || stakeInfo[0] || [];
      const pendingRewards = stakeInfo._rewards || stakeInfo[1] || '0';
      
      return {
        stakedNFTs: stakedTokens.map((tokenId: any) => tokenId.toString()),
        pendingRewards: this.web3!.utils.fromWei(pendingRewards, 'ether')
      };
    } catch (error) {
      console.error('❌ Error getting stake info:', error);
      return { stakedNFTs: [], pendingRewards: '0' };
    }
  }

  /**
   * Extract numeric token ID from string ID (e.g., "onchain_25" -> "25")
   */
  private extractTokenId(nftId: string): string {
    // Extract numeric token ID from string like "onchain_25"
    const match = nftId.match(/\d+/);
    if (!match) {
      throw new Error('Invalid NFT ID format');
    }
    return match[0];
  }

  /**
   * Extract token ID from transaction receipt using Transfer event
   * Based on Web3MetaMaskNFTService pattern
   */
  private async extractTokenIdFromReceipt(txHash: string): Promise<string | null> {
    try {
      if (!this.web3) return null;
      
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (receipt && receipt.logs && receipt.logs.length > 0) {
        // Look for Transfer event (topic0 = keccak256("Transfer(address,address,uint256)"))
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        const transferLog = receipt.logs.find(log => log.topics && log.topics[0] === transferTopic);
        
        if (transferLog && transferLog.topics && transferLog.topics.length >= 4) {
          // Token ID is the 4th topic (index 3) in Transfer event
          const tokenId = parseInt(transferLog.topics[3], 16).toString();
          console.log('🎯 Extracted Token ID from receipt:', tokenId);
          return tokenId;
        }
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Could not extract token ID from receipt:', error);
      return null;
    }
  }

  /**
   * Stake NFT onchain - integrates with existing offchain system
   */
  async stakeNFTOnChain(walletAddress: string, nft: NFTData): Promise<StakingResponse> {
    try {
      console.log(`🔗 Starting onchain NFT staking for token ID: ${nft.id}`);
      
      // Extract numeric token ID from string ID (e.g., "onchain_25" -> "25")
      const tokenId = this.extractTokenId(nft.id);
      console.log(`🔢 Extracted token ID for contract: ${tokenId}`);
      
      await this.initializeContracts();
      
      if (!this.nftContract || !this.stakingContract || !this.userAccount) {
        throw new Error('Contracts not initialized or user not connected');
      }

      // Check if user owns the NFT with better error handling
      let owner;
      try {
        owner = await this.nftContract.methods.ownerOf(tokenId).call();
        console.log('🔍 NFT owner check - Token ID:', tokenId, 'Owner:', owner, 'User:', walletAddress);
      } catch (ownerError) {
        console.error('❌ Error checking NFT ownership:', ownerError);
        throw new Error(`Cannot verify NFT ownership for token ${tokenId}. Token may not exist.`);
      }
      
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(`You do not own NFT #${tokenId}. Current owner: ${owner}`);
      }

      // Check if NFT is already staked by checking user's staked tokens
      console.log('🔍 Checking if NFT is already staked...');
      console.log('📍 Staking contract address:', CONTRACT_ADDRESSES.STAKING_CONTRACT);
      console.log('👤 Wallet address:', walletAddress);
      
      try {
        // Use robust contract call approach based on Web3MetaMaskNFTService
        console.log('🧪 Testing contract call with different methods...');
        
        // Try with MetaMask first, then fallback to RPC if needed
        let web3ToUse = this.web3!;
        let stakeInfo;
        
        try {
          // Method 1: Try with formatted address and explicit from parameter
          const formattedAddress = this.web3!.utils.toChecksumAddress(walletAddress);
          console.log('📝 Formatted address:', formattedAddress);
          
          stakeInfo = await this.stakingContract.methods.getStakeInfo(formattedAddress).call({
            from: this.userAccount
          });
          console.log('📊 Stake info result (method 1):', stakeInfo);
        } catch (method1Error) {
          console.log('❌ Method 1 failed, trying RPC fallback...');
          
          try {
            // Method 2: Try with RPC fallback
            web3ToUse = await this.initWeb3WithRPC();
            const rpcContract = new web3ToUse.eth.Contract(NFTStakeABI, CONTRACT_ADDRESSES.STAKING_CONTRACT);
            
            stakeInfo = await rpcContract.methods.getStakeInfo(walletAddress).call();
            console.log('📊 Stake info result (RPC fallback):', stakeInfo);
          } catch (method2Error) {
            console.log('❌ RPC fallback also failed, trying basic call...');
            
            // Method 3: Basic call without options
            stakeInfo = await this.stakingContract.methods.getStakeInfo(walletAddress).call();
            console.log('📊 Stake info result (basic call):', stakeInfo);
          }
        }
        
        const stakedTokens = stakeInfo._tokensStaked || stakeInfo[0] || [];
        console.log('🎯 Staked tokens:', stakedTokens);
        
        // Convert all staked tokens to strings for comparison
        const stakedTokenStrings = stakedTokens.map((token: any) => String(token));
        const isAlreadyStaked = stakedTokenStrings.includes(tokenId);
        
        if (isAlreadyStaked) {
          throw new Error('NFT is already staked');
        }
        
        console.log('✅ NFT is not staked, proceeding...');
      } catch (contractError) {
        console.error('❌ Contract call failed:', contractError);
        console.log('⚠️ Skipping stake check due to contract error, proceeding with staking...');
        // Continue with staking even if we can't check - the contract will reject if already staked
      }

      // Check approval with robust error handling
      let isApproved = false;
      try {
        console.log('🔍 Checking approval status...');
        isApproved = await this.nftContract.methods.isApprovedForAll(walletAddress, CONTRACT_ADDRESSES.STAKING_CONTRACT).call({
          from: this.userAccount
        });
        console.log('📝 Approval status:', isApproved);
      } catch (approvalError) {
        console.error('❌ Approval check failed:', approvalError);
        console.log('⚠️ Assuming not approved and proceeding with approval request...');
        isApproved = false;
      }
      
      if (!isApproved) {
        console.log('📝 Requesting NFT approval for staking contract...');
        toast.loading('Requesting approval to stake NFT...', { id: 'stake-approval' });
        
        try {
          // First, ensure MetaMask is on correct network
          await this.switchMetaMaskToThirdwebRPC();
          
          // Get current gas price from network
          let gasPrice;
          try {
            gasPrice = await this.web3!.eth.getGasPrice();
            console.log('📊 Current gas price:', gasPrice);
          } catch (gasPriceError) {
            console.warn('⚠️ Could not get gas price, using default');
            gasPrice = '2000000000'; // 2 gwei fallback
          }
          
          // Manual transaction with explicit parameters to avoid estimation
          const txData = this.nftContract.methods.setApprovalForAll(CONTRACT_ADDRESSES.STAKING_CONTRACT, true).encodeABI();
          
          const txParams = {
            from: this.userAccount,
            to: CONTRACT_ADDRESSES.NFT_CONTRACT,
            data: txData,
            gas: '0x186A0', // 100000 in hex
            gasPrice: `0x${parseInt(gasPrice).toString(16)}`,
          };
          
          console.log('📤 Sending approval transaction with params:', txParams);
          
          const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [txParams],
          });
          
          console.log('📤 Approval transaction sent:', txHash);
          
          // Wait for confirmation
          let receipt = null;
          let attempts = 0;
          while (!receipt && attempts < 30) {
            try {
              receipt = await this.web3!.eth.getTransactionReceipt(txHash);
              if (!receipt) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;
              }
            } catch (receiptError) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              attempts++;
            }
          }
          
          if (!receipt) {
            throw new Error('Transaction timeout - please check your wallet');
          }
          
          if (!receipt.status || receipt.status === '0x0') {
            throw new Error('Transaction failed on blockchain');
          }
          
          toast.success('NFT approved for staking!', { id: 'stake-approval' });
          console.log('✅ NFT approved for staking contract, tx:', receipt.transactionHash);
        } catch (approvalTxError) {
          console.error('❌ Approval transaction failed:', approvalTxError);
          
          if (approvalTxError.message.includes('User denied')) {
            toast.error('Transaction cancelled by user', { id: 'stake-approval' });
            throw new Error('Transaction cancelled by user');
          } else if (approvalTxError.message.includes('insufficient funds')) {
            toast.error('Insufficient MATIC for gas fees', { id: 'stake-approval' });
            throw new Error('Insufficient MATIC for gas fees');
          } else {
            toast.error('Failed to approve NFT for staking', { id: 'stake-approval' });
            throw new Error('Approval failed: ' + approvalTxError.message);
          }
        }
      }

      // Stake the NFT
      toast.loading('Staking NFT onchain...', { id: 'stake-nft' });
      console.log('🔗 Executing stake transaction...');
      console.log('🎯 Staking token ID:', tokenId);
      console.log('👤 From account:', this.userAccount);
      
      let stakeTx;
      try {
        // Ensure MetaMask is on correct network
        await this.switchMetaMaskToThirdwebRPC();
        
        // Get current gas price from network
        let gasPrice;
        try {
          gasPrice = await this.web3!.eth.getGasPrice();
          console.log('📊 Current gas price for staking:', gasPrice);
        } catch (gasPriceError) {
          console.warn('⚠️ Could not get gas price, using default');
          gasPrice = '2000000000'; // 2 gwei fallback
        }
        
        // Check if staking contract is configured for our NFT contract
        let stakingTokenAddress;
        try {
          stakingTokenAddress = await this.stakingContract.methods.stakingToken().call();
          console.log('🔍 Staking contract expects NFT contract:', stakingTokenAddress);
          console.log('🔍 Our NFT contract address:', CONTRACT_ADDRESSES.NFT_CONTRACT);
          
          if (stakingTokenAddress.toLowerCase() !== CONTRACT_ADDRESSES.NFT_CONTRACT.toLowerCase()) {
            throw new Error(`Staking contract is configured for ${stakingTokenAddress}, but trying to stake from ${CONTRACT_ADDRESSES.NFT_CONTRACT}`);
          }
        } catch (configError) {
          console.error('❌ Error checking staking contract configuration:', configError);
          throw new Error('Staking contract configuration error: ' + configError.message);
        }
        
        // Manual transaction with explicit parameters to avoid estimation
        const txData = this.stakingContract.methods.stake([tokenId]).encodeABI();
        
        const txParams = {
          from: this.userAccount,
          to: CONTRACT_ADDRESSES.STAKING_CONTRACT,
          data: txData,
          gas: '0x493E0', // 300000 in hex (increased gas limit)
          gasPrice: `0x${parseInt(gasPrice).toString(16)}`,
        };
        
        console.log('📤 Sending staking transaction with params:', txParams);
        
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams],
        });
        
        console.log('📤 Staking transaction sent:', txHash);
        
        // Wait for confirmation
        let receipt = null;
        let attempts = 0;
        while (!receipt && attempts < 30) {
          try {
            receipt = await this.web3!.eth.getTransactionReceipt(txHash);
            if (!receipt) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              attempts++;
            }
          } catch (receiptError) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
          }
        }
        
        if (!receipt) {
          throw new Error('Transaction timeout - please check your wallet');
        }
        
        if (!receipt.status || receipt.status === '0x0') {
          // Get more detailed error information
          console.error('❌ Transaction failed on blockchain. Receipt:', receipt);
          
          // Try to get revert reason if available
          let revertReason = 'Unknown reason';
          try {
            if (receipt.logs && receipt.logs.length === 0) {
              revertReason = 'Transaction reverted with no logs (likely a require() failure)';
            }
          } catch (e) {
            // Ignore error getting revert reason
          }
          
          throw new Error(`Transaction failed on blockchain: ${revertReason}`);
        }

        toast.success('NFT staked successfully onchain!', { id: 'stake-nft' });
        console.log('✅ Onchain staking successful, tx:', receipt.transactionHash);
        
        // Create a transaction object with hash for compatibility
        stakeTx = { transactionHash: receipt.transactionHash };
      } catch (stakingError) {
        console.error('❌ Staking transaction failed:', stakingError);
        
        if (stakingError.message.includes('User denied')) {
          toast.error('Transaction cancelled by user', { id: 'stake-nft' });
          throw new Error('Transaction cancelled by user');
        } else if (stakingError.message.includes('insufficient funds')) {
          toast.error('Insufficient MATIC for gas fees', { id: 'stake-nft' });
          throw new Error('Insufficient MATIC for gas fees');
        } else if (stakingError.message.includes('revert')) {
          toast.error('Transaction reverted on blockchain', { id: 'stake-nft' });
          throw new Error('Transaction reverted: ' + stakingError.message);
        } else {
          toast.error('Failed to stake NFT onchain', { id: 'stake-nft' });
          throw new Error('Staking failed: ' + stakingError.message);
        }
      }

      // Record offchain for unified rewards
      const offchainResult = await offChainStakingService.stakeNFT(walletAddress, nft);
      
      return {
        success: true,
        message: 'NFT staked successfully onchain',
        data: {
          ...offchainResult.data,
          transactionHash: stakeTx.transactionHash,
          onchain: true
        }
      };

    } catch (error) {
      console.error('❌ Onchain NFT staking failed:', error);
      
      // Provide more specific error messages for common issues
      let userMessage = 'Onchain staking failed';
      if (error instanceof Error) {
        if (error.message.includes('Internal JSON-RPC error')) {
          userMessage = 'Network connection issue. Please try again in a moment.';
        } else if (error.message.includes('User denied')) {
          userMessage = 'Transaction was cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          userMessage = 'Insufficient MATIC for gas fees';
        } else if (error.message.includes('All RPC endpoints failed')) {
          userMessage = 'Network temporarily unavailable. Please try again later.';
        } else {
          userMessage = error.message;
        }
      }
      
      toast.error(`Staking failed: ${userMessage}`, { id: 'stake-nft' });
      
      return {
        success: false,
        message: userMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unstake NFT from onchain contract
   */
  async unstakeNFTOnChain(walletAddress: string, nftId: string): Promise<StakingResponse> {
    try {
      console.log(`🔗 Starting onchain NFT unstaking for token ID: ${nftId}`);
      
      // Extract numeric token ID from string ID (e.g., "onchain_25" -> "25")
      const tokenId = this.extractTokenId(nftId);
      console.log(`🔢 Extracted token ID for contract: ${tokenId}`);
      
      await this.initializeContracts();
      
      if (!this.stakingContract || !this.userAccount) {
        throw new Error('Staking contract not initialized or user not connected');
      }

      // Check if NFT is staked by this user
      const stakeInfo = await this.stakingContract.methods.getStakeInfo(walletAddress).call();
      const stakedTokens = stakeInfo._tokensStaked || stakeInfo[0] || [];
      const isStakedByUser = stakedTokens.some((stakedTokenId: any) => stakedTokenId.toString() === tokenId);
      
      if (!isStakedByUser) {
        throw new Error('NFT is not staked by you');
      }

      // Unstake the NFT
      toast.loading('Unstaking NFT from chain...', { id: 'unstake-nft' });
      console.log('🔗 Executing unstake transaction...');
      
      const unstakeTx = await this.stakingContract.methods.withdraw([tokenId]).send({ from: this.userAccount });

      toast.success('NFT unstaked successfully from chain!', { id: 'unstake-nft' });
      console.log('✅ Onchain unstaking successful:', unstakeTx.transactionHash);

      // Update offchain tracking
      const offchainResult = await offChainStakingService.unstakeNFT(walletAddress, nftId);
      
      return {
        success: true,
        message: 'NFT unstaked successfully from chain',
        data: {
          ...offchainResult.data,
          transactionHash: unstakeTx.transactionHash,
          onchain: true
        }
      };

    } catch (error) {
      console.error('❌ Onchain NFT unstaking failed:', error);
      toast.error(`Unstaking failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'unstake-nft' });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Onchain unstaking failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Claim rewards from onchain contract (optional - rewards mainly from offchain)
   */
  async claimOnchainRewards(walletAddress: string): Promise<StakingResponse> {
    try {
      console.log(`🔗 Claiming onchain rewards for: ${walletAddress}`);
      
      await this.initializeContracts();
      
      if (!this.stakingContract || !this.userAccount) {
        throw new Error('Staking contract not initialized or user not connected');
      }

      // Check pending rewards
      const pendingRewards = await this.stakingContract.methods.earned(walletAddress).call();
      if (pendingRewards.toString() === '0') {
        throw new Error('No rewards to claim');
      }

      // Claim rewards
      toast.loading('Claiming onchain rewards...', { id: 'claim-rewards' });
      console.log('🔗 Executing claim transaction...');
      
      const claimTx = await this.stakingContract.methods.getReward().send({ from: this.userAccount });

      const rewardAmount = this.web3!.utils.fromWei(pendingRewards, 'ether');
      
      toast.success(`Claimed ${rewardAmount} NEFT rewards!`, { id: 'claim-rewards' });
      console.log('✅ Onchain rewards claimed:', claimTx.transactionHash);
      
      return {
        success: true,
        message: `Claimed ${rewardAmount} NEFT rewards onchain`,
        data: {
          transactionHash: claimTx.transactionHash,
          rewardAmount,
          onchain: true
        }
      };

    } catch (error) {
      console.error('❌ Onchain reward claiming failed:', error);
      toast.error(`Claiming failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'claim-rewards' });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Onchain reward claiming failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's staked NFTs from onchain contract
   */
  async getStakedNFTsOnChain(walletAddress: string): Promise<any[]> {
    try {
      const stakeInfo = await this.getStakeInfo(walletAddress);
      const stakedNFTs: any[] = [];
      
      for (const tokenId of stakeInfo.stakedNFTs) {
        stakedNFTs.push({
          id: Date.now() + Math.random(), // Unique ID for staking record
          nft_id: `onchain_${tokenId}`, // Convert back to full format
          wallet_address: walletAddress,
          staked_at: new Date().toISOString(),
          onchain: true
        });
      }
      
      return stakedNFTs;
    } catch (error) {
      console.error('❌ Error getting onchain staked NFTs:', error);
      return [];
    }
  }

  /**
   * Get user's staked NFTs from onchain contract (legacy method)
   */
  async getStakedNFTs(walletAddress: string): Promise<NFTData[]> {
    try {
      const stakeInfo = await this.getStakeInfo(walletAddress);
      const stakedNFTs: NFTData[] = [];
      
      for (const tokenId of stakeInfo.stakedNFTs) {
        try {
          // Get NFT metadata (simplified for now)
          const nftData: NFTData = {
            id: `onchain_${tokenId}`, // Convert back to full format
            name: `NEFTIT NFT #${tokenId}`,
            description: 'NEFTIT Collection NFT',
            image: '', // Would need to fetch from contract or IPFS
            rarity: 'common', // Would need to determine from metadata
            wallet_address: walletAddress,
            ipfs_hash: '',
            pinata_hash: '',
            metadata_uri: '',
            attributes: [],
            created_at: new Date().toISOString()
          };
          
          stakedNFTs.push(nftData);
        } catch (error) {
          console.error(`❌ Error getting metadata for token ${tokenId}:`, error);
        }
      }
      
      return stakedNFTs;
    } catch (error) {
      console.error('❌ Error getting staked NFTs:', error);
      return [];
    }
  }
}

export default new OnchainStakingService();
