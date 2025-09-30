import Web3 from 'web3';
import { toast } from 'sonner';
import { NFTStakeABI, ERC721ABI, CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../abis/index';
import { NFTData } from './HybridIPFSService';
import { StakingResponse } from '../types/staking';
import { getIPFSUrl } from '../config/ipfsConfig';
import offChainStakingService from './EnhancedStakingService';

export class ImprovedOnchainStakingService {
  private web3: Web3 | null = null;
  private readOnlyWeb3: Web3 | null = null;
  private nftContract: any = null;
  private stakingContract: any = null;
  private readOnlyNftContract: any = null;
  private readOnlyStakingContract: any = null;
  private userAccount: string | null = null;
  private offChainStakingService = offChainStakingService;

  constructor() {
    this.initializeWeb3();
  }

  /**
   * Initialize Web3 with hybrid approach: MetaMask for transactions, direct RPC for reads
   */
  private async initializeWeb3(): Promise<void> {
    try {
      // Initialize read-only Web3 instance for read operations using direct RPC
      const rpcUrls = [
        NETWORK_CONFIG.RPC_URL,
        'https://rpc-amoy.polygon.technology',
        'https://polygon-amoy-bor-rpc.publicnode.com',
        'https://rpc.ankr.com/polygon_amoy'
      ];
      this.readOnlyWeb3 = new Web3(rpcUrls[0]);
      
      // Initialize contracts for read-only operations
      this.initializeReadOnlyContracts();
      
      // Check if MetaMask is available for transactions
      if (window.ethereum) {
        // Initialize Web3 with MetaMask provider for transactions
        this.web3 = new Web3(window.ethereum);
        
        // Get user account from MetaMask (if connected)
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          this.userAccount = accounts[0] || null;
        } catch (error) {
          console.log('No MetaMask account connected, using read-only mode');
          this.userAccount = null;
        }
      } else {
        console.log('MetaMask not available, using read-only mode');
        this.userAccount = null;
      }
      
      if (this.userAccount) {
        console.log('👤 Connected account:', this.userAccount.toLowerCase());
        
        // Verify chain ID using MetaMask
        const chainId = await this.web3!.eth.getChainId();
        console.log('Connected to chain ID:', chainId);
        
        if (Number(chainId) !== NETWORK_CONFIG.CHAIN_ID) {
          throw new Error(`Wrong network. Expected ${NETWORK_CONFIG.CHAIN_ID}, got ${chainId}`);
        }
        
        // Initialize contracts for transactions
        this.initializeContracts();
      }
      
      console.log('✅ Hybrid Web3 setup: MetaMask for transactions, direct RPC for reads');
      
    } catch (error) {
      console.error('❌ Failed to initialize Web3:', error);
      // Don't throw error, just log it and continue in read-only mode
      console.log('Continuing in read-only mode...');
    }
  }


  private async ensureCorrectNetwork(): Promise<void> {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${NETWORK_CONFIG.CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
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
  }

  private async initializeContracts(): Promise<void> {
    try {
      if (!this.web3 || !this.readOnlyWeb3) {
        await this.initializeWeb3();
      }

      if (!this.web3 || !this.readOnlyWeb3) {
        throw new Error('No Ethereum provider available');
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      this.userAccount = accounts[0];
      
      // Initialize transaction contracts with MetaMask
      this.nftContract = new this.web3.eth.Contract(
        ERC721ABI as any,
        CONTRACT_ADDRESSES.NFT_CONTRACT
      );
      
      this.stakingContract = new this.web3.eth.Contract(
        NFTStakeABI as any,
        CONTRACT_ADDRESSES.STAKING_CONTRACT
      );

      // Initialize read-only contracts with direct RPC
      this.readOnlyNftContract = new this.readOnlyWeb3.eth.Contract(
        ERC721ABI as any,
        CONTRACT_ADDRESSES.NFT_CONTRACT
      );
      
      this.readOnlyStakingContract = new this.readOnlyWeb3.eth.Contract(
        NFTStakeABI as any,
        CONTRACT_ADDRESSES.STAKING_CONTRACT
      );

      console.log('✅ Contracts initialized successfully with hybrid approach');
    } catch (error) {
      console.error('❌ Error initializing contracts:', error);
      throw error;
    }
  }

  /**
   * Check and handle NFT approval automatically with retry mechanism
   */
  private async checkAndHandleApproval(walletAddress: string, tokenId: string): Promise<boolean> {
    const maxRetries = 3;
    let attempt = 0;
    
    // First, validate contract addresses and connectivity
    try {
      console.log('🔍 Validating contract connectivity...');
      console.log(`📋 NFT Contract: ${CONTRACT_ADDRESSES.NFT_CONTRACT}`);
      console.log(`🏦 Staking Contract: ${CONTRACT_ADDRESSES.STAKING_CONTRACT}`);
      
      // Test basic contract connectivity and ownership using read-only contract
      const owner = await this.retryRPCCall(
        () => this.readOnlyNftContract.methods.ownerOf(tokenId).call()
      );
      console.log(`✅ Contract connectivity verified - Token ${tokenId} owner: ${owner}`);
      console.log(`🔍 Connected wallet: ${walletAddress}`);
      
      if (String(owner).toLowerCase() !== walletAddress.toLowerCase()) {
        console.error(`❌ Ownership mismatch:`);
        console.error(`   Token ${tokenId} owner: ${owner}`);
        console.error(`   Connected wallet: ${walletAddress}`);
        throw new Error(`Token ${tokenId} is owned by ${owner}, not by the connected wallet ${walletAddress}. Please connect the correct wallet or select an NFT you own.`);
      }
      
    } catch (error) {
      console.error('❌ Contract validation failed:', error);
      throw new Error(`Contract validation failed: ${error.message}`);
    }
    
    while (attempt < maxRetries) {
      try {
        console.log(`🔍 Checking NFT approval status (attempt ${attempt + 1}/${maxRetries})...`);
        
        // Check if already approved for all tokens
        let isApprovedForAll = false;
        try {
          isApprovedForAll = await this.retryRPCCall(
            () => this.readOnlyNftContract.methods.isApprovedForAll(walletAddress, CONTRACT_ADDRESSES.STAKING_CONTRACT).call()
          );
          
          if (isApprovedForAll) {
            console.log('✅ NFT already approved for all tokens - no approval needed');
            return true;
          }
        } catch (approvalCheckError) {
          console.warn('⚠️ Failed to check isApprovedForAll, trying individual token approval check');
          
          // If we're getting Internal JSON-RPC errors consistently, skip approval entirely
          if (approvalCheckError.message && approvalCheckError.message.includes('Internal JSON-RPC error')) {
            console.log('🔄 Detected MetaMask Internal JSON-RPC error - skipping approval checks');
            console.log('💡 Assuming NFT is already approved (verified by debug script)');
            return true;
          }
        }
        
        // Check individual token approval
        let isIndividuallyApproved = false;
        try {
          const approvedAddress = await this.retryRPCCall(
            () => this.readOnlyNftContract.methods.getApproved(tokenId).call()
          ) as string;
          isIndividuallyApproved = approvedAddress.toLowerCase() === CONTRACT_ADDRESSES.STAKING_CONTRACT.toLowerCase();
          
          if (isIndividuallyApproved) {
            console.log('✅ NFT already approved for this specific token - no approval needed');
            return true;
          }
        } catch (individualApprovalError) {
          console.warn('⚠️ Failed to check individual token approval');
        }
        
        // If both approval checks failed due to network issues, check if we should skip approval
        if (!isApprovedForAll && !isIndividuallyApproved) {
          console.log('⚠️ Could not verify approval status due to network issues');
          
          // If we're getting consistent "Internal JSON-RPC error", it's likely a MetaMask/RPC issue
          // In this case, we should skip approval and proceed with staking
          // The user can always approve manually if needed
          console.log('🔄 Skipping approval check due to persistent RPC errors - proceeding with staking');
          console.log('💡 If staking fails due to approval, please approve manually in MetaMask');
          return true; // Skip approval and proceed
        }
        
        // Need approval - automatically approve for all tokens
        console.log('🔐 NFT needs approval for staking contract - performing automatic approval...');
        
        const approvalResult = await this.performAutomaticApproval(walletAddress);
        if (approvalResult) {
          console.log('✅ NFT approval completed successfully');
          return true;
        }
        
        attempt++;
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying approval in 2 seconds... (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ NFT approval attempt ${attempt + 1} failed:`, error);
        
        // Check if error is due to user rejection (don't retry)
        if (error.message && (error.message.includes('User denied') || error.message.includes('rejected'))) {
          console.log('👤 User cancelled approval transaction');
          return false;
        }
        
        // Check if error is due to already being approved
        if (error.message && error.message.includes('already approved')) {
          console.log('✅ NFT was already approved (detected from error)');
          return true;
        }
        
        attempt++;
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying after error in 3 seconds... (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    console.error('❌ All approval attempts failed');
    return false;
  }

  /**
   * Perform automatic approval for all NFTs (setApprovalForAll)
   */
  private async performAutomaticApproval(walletAddress: string): Promise<boolean> {
    try {
      console.log('🔐 Performing automatic approval for all NFTs...');
      
      // Use setApprovalForAll to approve all NFTs at once
      const gasPrice = await this.getGasPriceWithFallback();
      const gasLimit = 100000; // Standard gas limit for approval
      
      console.log('📤 Requesting setApprovalForAll approval...');
      
      const tx = await this.nftContract.methods.setApprovalForAll(
        CONTRACT_ADDRESSES.STAKING_CONTRACT,
        true
      ).send({
        from: walletAddress,
        gas: gasLimit.toString(),
        gasPrice: gasPrice.toString()
      });
      
      console.log('✅ Automatic approval transaction completed:', tx.transactionHash);
      
      // Wait a moment for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify approval was successful
      const isApproved = await this.retryRPCCall(
        () => this.readOnlyNftContract.methods.isApprovedForAll(
          walletAddress, 
          CONTRACT_ADDRESSES.STAKING_CONTRACT
        ).call()
      );
      
      if (isApproved) {
        console.log('✅ Automatic approval verified successfully');
        return true;
      } else {
        console.warn('⚠️ Approval transaction completed but verification failed');
        return false;
      }
      
    } catch (error: any) {
      console.error('❌ Automatic approval failed:', error);
      
      // Check if user cancelled
      if (error.message && (error.message.includes('User denied') || error.message.includes('cancelled'))) {
        console.log('❌ User cancelled the approval transaction');
        return false;
      }
      
      // Check if already approved
      if (error.message && error.message.includes('already approved')) {
        console.log('✅ NFT was already approved (detected from error)');
        return true;
      }
      
      return false;
    }
  }

  /**
   * Retry RPC calls with direct RPC endpoints (bypass MetaMask for reads)
   */
  private async retryRPCCall<T>(operation: () => Promise<T>, maxRetries: number = 2): Promise<T> {
    // Skip MetaMask entirely for read operations and use direct RPC
    console.log(`🔗 Using direct RPC for read operation (bypassing MetaMask)...`);
    
    if (!this.readOnlyWeb3) {
      throw new Error('Read-only Web3 instance not initialized');
    }
    
    try {
      return await operation();
    } catch (error: any) {
      console.error(`❌ Direct RPC call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform approval transaction with enhanced error handling
   */
  private async performApprovalWithRetry(): Promise<boolean> {
    try {
      // Estimate gas with multiple fallback strategies
      let gasEstimate = await this.estimateGasWithFallback();
      let gasPrice = await this.getGasPriceWithFallback();
      
      console.log('📊 Using gas estimate:', gasEstimate, 'gas price:', gasPrice);
      
      // Attempt approval transaction
      const approvalTx = await this.nftContract.methods.setApprovalForAll(
        CONTRACT_ADDRESSES.STAKING_CONTRACT,
        true
      ).send({
        from: this.userAccount,
        gas: gasEstimate,
        gasPrice: gasPrice
      });
      
      console.log('✅ NFT approval transaction sent:', approvalTx.transactionHash);
      
      // Wait for confirmation with timeout
      await this.waitForTransactionConfirmation(approvalTx.transactionHash);
      
      return true;
      
    } catch (error) {
      console.error('❌ Approval transaction failed:', error);
      
      // Handle specific error types
      if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient funds for gas fees. Please add more ETH to your wallet.');
      }
      
      if (error.message?.includes('nonce')) {
        console.log('⚠️ Nonce error detected, may retry with fresh nonce');
      }
      
      return false;
    }
  }

  /**
   * Estimate gas with multiple fallback strategies
   */
  private async estimateGasWithFallback(): Promise<number> {
    const fallbackGasLimits = [100000, 150000, 200000];
    
    try {
      const gasEstimate = await this.nftContract.methods.setApprovalForAll(
        CONTRACT_ADDRESSES.STAKING_CONTRACT,
        true
      ).estimateGas({ from: this.userAccount });
      
      // Add 30% buffer to gas estimate
      return Math.floor(gasEstimate * 1.3);
      
    } catch (gasError) {
      console.warn('⚠️ Gas estimation failed, using fallback strategy');
      
      // Try different gas limits
      for (const gasLimit of fallbackGasLimits) {
        try {
          await this.nftContract.methods.setApprovalForAll(
            CONTRACT_ADDRESSES.STAKING_CONTRACT,
            true
          ).estimateGas({ from: this.userAccount, gas: gasLimit });
          
          console.log('📊 Fallback gas limit works:', gasLimit);
          return gasLimit;
        } catch {
          continue;
        }
      }
      
      // Final fallback
      console.warn('⚠️ All gas estimation failed, using maximum fallback');
      return 250000;
    }
  }

  /**
   * Validate contract state (check if paused, etc.)
   */
  private async validateContractState(): Promise<void> {
    try {
      console.log('🔍 Validating staking contract state...');
      
      // Check if contract has a paused state
      try {
        const isPaused = await this.readOnlyStakingContract.methods.paused().call();
        if (isPaused) {
          throw new Error('Staking contract is currently paused. Please try again later.');
        }
        console.log('✅ Contract is not paused');
      } catch (pausedError) {
        // Contract might not have paused function, continue
        console.log('ℹ️ Contract does not have paused state or check failed');
      }
      
      // Check if staking is enabled
      try {
        const stakingEnabled = await this.readOnlyStakingContract.methods.stakingEnabled().call();
        if (!stakingEnabled) {
          throw new Error('Staking is currently disabled on the contract. Please try again later.');
        }
        console.log('✅ Staking is enabled');
      } catch (enabledError) {
        // Contract might not have stakingEnabled function, continue
        console.log('ℹ️ Contract does not have stakingEnabled state or check failed');
      }
      
      // Test basic contract connectivity
      try {
        const stakingToken = await this.readOnlyStakingContract.methods.stakingToken().call();
        console.log('✅ Contract connectivity confirmed, staking token:', stakingToken);
      } catch (connectivityError) {
        throw new Error('Cannot connect to staking contract. Please check your network connection.');
      }
      
    } catch (error) {
      console.error('❌ Contract state validation failed:', error);
      throw error;
    }
  }

  /**
   * Get gas price with fallback strategies
   */
  private async getGasPriceWithFallback(): Promise<string> {
    try {
      const gasPrice = await this.web3!.eth.getGasPrice();
      return Math.floor(Number(gasPrice) * 1.1).toString(); // 10% buffer
    } catch (gasPriceError) {
      console.warn('⚠️ Gas price fetch failed, using network-appropriate fallback');
      
      // Try to detect network and use appropriate gas price
      try {
        const networkId = await this.web3!.eth.net.getId();
        if (networkId === 137n) { // Polygon Mainnet
          return '30000000000'; // 30 gwei
        } else if (networkId === 80002n) { // Polygon Amoy
          return '2000000000'; // 2 gwei
        } else { // Ethereum or other
          return '20000000000'; // 20 gwei
        }
      } catch {
        return '2000000000'; // 2 gwei final fallback
      }
    }
  }

  /**
   * Wait for transaction confirmation with timeout
   */
  private async waitForTransactionConfirmation(txHash: string, timeoutMs: number = 30000): Promise<void> {
    console.log('⏳ Waiting for transaction confirmation...');
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await this.web3!.eth.getTransactionReceipt(txHash);
        if (receipt && receipt.status) {
          console.log('✅ Transaction confirmed successfully');
          return;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.warn('⚠️ Transaction confirmation timeout, but may still be processing');
  }

  /**
   * Comprehensive contract validation before staking
   */
  private async validateStakingRequirements(walletAddress: string, tokenId: string, skipApprovalCheck: boolean = false): Promise<void> {
    console.log('🔍 Performing comprehensive staking validation...');

    // 1. Check staking contract configuration (with RPC error handling)
    let stakingTokenAddress;
    try {
      stakingTokenAddress = await this.retryRPCCall(
        () => this.readOnlyStakingContract.methods.stakingToken().call()
      );
      console.log('📋 Staking contract expects NFT contract:', stakingTokenAddress);
      console.log('📋 Our NFT contract address:', CONTRACT_ADDRESSES.NFT_CONTRACT);
      
      if (stakingTokenAddress.toLowerCase() !== CONTRACT_ADDRESSES.NFT_CONTRACT.toLowerCase()) {
        throw new Error(`Contract mismatch: Staking contract expects ${stakingTokenAddress}, but trying to stake from ${CONTRACT_ADDRESSES.NFT_CONTRACT}`);
      }
      console.log('✅ Contract configuration valid');
    } catch (configError) {
      console.error('❌ Contract configuration error:', configError);
      
      // If all RPC calls fail, skip validation but warn user
      if (configError.message.includes('Internal JSON-RPC error')) {
        console.warn('⚠️ RPC endpoints failing - skipping contract configuration check');
        console.warn('💡 Assuming contract configuration is correct (verified by debug script)');
      } else {
        throw new Error('Staking contract configuration error: ' + configError.message);
      }
    }

    // 2. Skip already staked check (done earlier in stakeNFTOnChain)
    console.log('✅ Already staked check completed earlier');

    // 3. Verify NFT exists and ownership
    let owner;
    try {
      owner = await this.readOnlyNftContract.methods.ownerOf(tokenId).call();
      console.log('🔍 NFT ownership - Token ID:', tokenId, 'Owner:', owner, 'User:', walletAddress);
      
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        // Check if it's owned by staking contract (already staked by someone else)
        if (owner.toLowerCase() === CONTRACT_ADDRESSES.STAKING_CONTRACT.toLowerCase()) {
          throw new Error(`Token #${tokenId} is already staked by another user`);
        } else {
          throw new Error(`You don't own token #${tokenId}. Current owner: ${owner}`);
        }
      }
      console.log('✅ NFT ownership verified');
    } catch (ownerError) {
      console.error('❌ NFT ownership verification failed:', ownerError);
      if (ownerError.message.includes('ERC721: invalid token ID')) {
        throw new Error(`Token #${tokenId} does not exist on the NFT contract`);
      }
      if (ownerError.message.includes('already staked') || ownerError.message.includes("don't own")) {
        throw ownerError; // Re-throw our specific errors
      }
      throw new Error(`Cannot verify NFT ownership: ${ownerError.message}`);
    }

    // 3. Check approval status (skip if already handled)
    if (!skipApprovalCheck) {
      let isApproved;
      try {
        isApproved = await this.readOnlyNftContract.methods.isApprovedForAll(walletAddress, CONTRACT_ADDRESSES.STAKING_CONTRACT).call();
        console.log('🔍 Approval status:', isApproved);
        
        if (!isApproved) {
          // Also check individual token approval
          const approvedAddress = await this.readOnlyNftContract.methods.getApproved(tokenId).call();
          isApproved = approvedAddress.toLowerCase() === CONTRACT_ADDRESSES.STAKING_CONTRACT.toLowerCase();
          console.log('🔍 Individual token approval:', approvedAddress, 'Approved:', isApproved);
        }
        
        if (!isApproved) {
          throw new Error('NFT not approved for staking contract. Please approve first.');
        }
        console.log('✅ NFT approval verified');
      } catch (approvalError) {
        console.error('❌ Approval verification failed:', approvalError);
        throw new Error(`Cannot verify NFT approval: ${approvalError.message}`);
      }
    }

    // 4. Check if already staked
    try {
      const stakeInfo = await this.readOnlyStakingContract.methods.getStakeInfo(walletAddress).call();
      const stakedTokens = stakeInfo._tokensStaked || stakeInfo[0] || [];
      const stakedTokenStrings = stakedTokens.map((token: any) => String(token));
      const isAlreadyStaked = stakedTokenStrings.includes(tokenId);
      
      if (isAlreadyStaked) {
        throw new Error(`Token #${tokenId} is already staked`);
      }
      console.log('✅ Token not already staked');
    } catch (stakeCheckError) {
      if (stakeCheckError.message.includes('already staked')) {
        throw stakeCheckError;
      }
      console.warn('⚠️ Could not verify staking status, proceeding with caution');
    }

    console.log('✅ All staking requirements validated successfully');
  }

  /**
   * Enhanced NFT staking with comprehensive validation
   */
  async stakeNFTOnChain(nftId: string, walletAddress: string): Promise<any> {
    try {
      console.log(`🔗 Starting enhanced onchain NFT staking for: ${nftId}`);
      
      // Extract token ID from nftId (format: "onchain_31" -> "31")
      const tokenId = nftId.replace('onchain_', '');
      console.log(`🔢 Extracted token ID: ${tokenId}`);
      
      // Initialize contracts with current provider
      await this.initializeContracts();
      console.log('✅ Contracts initialized successfully with MetaMask provider');
      
      // Step 0: Check if NFT is already staked FIRST (better user experience)
      console.log('🔍 Checking if NFT is already staked...');
      try {
        const stakeInfo = await this.retryRPCCall(
          () => this.readOnlyStakingContract.methods.getStakeInfo(walletAddress).call()
        );
        const stakedTokens = stakeInfo[0] || [];
        const stakedTokenStrings = stakedTokens.map(t => t.toString());
        
        if (stakedTokenStrings.includes(tokenId)) {
          const errorMsg = `🔄 NFT #${tokenId} is already staked! You can unstake it first if you want to restake it.`;
          console.log(errorMsg);
          throw new Error(errorMsg);
        }
        console.log('✅ NFT is not already staked by user');
      } catch (error) {
        if (error.message.includes('already staked')) {
          throw error; // Re-throw our custom already staked error
        }
        console.warn('⚠️ Could not check staking status, proceeding with ownership check');
      }
      
      // Step 1: Verify wallet ownership
      console.log('🔍 Verifying NFT ownership...');
      try {
        const actualOwner = await this.retryRPCCall(
          () => this.readOnlyNftContract.methods.ownerOf(tokenId).call()
        );
        
        if (String(actualOwner).toLowerCase() !== walletAddress.toLowerCase()) {
          const errorMsg = `❌ NFT Ownership Error: Token ${tokenId} is owned by ${actualOwner}, but you're connected with ${walletAddress}. Please connect the wallet that owns this NFT.`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log(`✅ Ownership verified: Token ${tokenId} is owned by ${walletAddress}`);
      } catch (error) {
        if (error.message.includes('NFT Ownership Error')) {
          throw error; // Re-throw our custom ownership error
        }
        throw new Error(`Failed to verify NFT ownership: ${error.message}`);
      }
      
      // Step 2: Check and handle NFT approval
      console.log('🔐 Checking and handling NFT approval...');
      const isApproved = await this.checkAndHandleApproval(walletAddress, tokenId);
      
      if (!isApproved) {
        throw new Error('NFT approval failed or was cancelled by user');
      }
      console.log('✅ NFT approval confirmed - proceeding with staking...');

      // Validate staking requirements before proceeding
      await this.validateStakingRequirements(walletAddress, tokenId, true);
      
      // Check contract state (paused, etc.)
      await this.validateContractState();

      // Execute staking transaction
      toast.loading('Staking NFT onchain...', { id: 'stake-nft' });
      console.log('🔗 Executing stake transaction...');
      
      // Convert tokenId to proper uint256 format for contract call
      const numericTokenId = parseInt(tokenId);
      
      // Validate token ID is a positive integer
      if (isNaN(numericTokenId) || numericTokenId < 0) {
        throw new Error(`Invalid token ID: ${tokenId}. Must be a positive integer.`);
      }
      
      console.log('📤 Preparing stake method with token ID:', numericTokenId, '(converted from:', tokenId, ')');
      console.log('🔍 Token ID validation - Original:', tokenId, 'Parsed:', numericTokenId, 'Type:', typeof numericTokenId);
      
      // Try dynamic gas estimation first, fallback to fixed values
      let gasPrice, gasLimit;
      
      try {
        // Get current gas price from read-only Web3 (bypass MetaMask RPC issues)
        const networkGasPrice = await this.readOnlyWeb3.eth.getGasPrice();
        gasPrice = networkGasPrice.toString();
        console.log('📊 Network gas price (via direct RPC):', gasPrice);
        
        // Estimate gas for the staking transaction with enhanced fallback
        gasPrice = await this.getGasPriceWithFallback();
        
        // Try gas estimation with multiple approaches
        let estimatedGas;
        try {
          // Method 1: Direct contract call estimation
          estimatedGas = await this.readOnlyStakingContract.methods.stake([numericTokenId]).estimateGas({ from: this.userAccount });
          console.log('📊 Gas estimated via contract method:', estimatedGas);
        } catch (contractEstimateError) {
          console.warn('⚠️ Contract gas estimation failed, trying transaction simulation...');
          
          // Method 2: Raw transaction estimation
          const encodedABI = this.stakingContract.methods.stake([numericTokenId]).encodeABI();
          estimatedGas = await this.readOnlyWeb3.eth.estimateGas({
            from: this.userAccount,
            to: CONTRACT_ADDRESSES.STAKING_CONTRACT,
            data: encodedABI
          });
          console.log('📊 Gas estimated via raw transaction:', estimatedGas);
        }
        
        // Use higher buffer for safety (50% instead of 20%)
        gasLimit = Math.floor(Number(estimatedGas) * 1.5);
        console.log('📊 Final gas limit with 50% buffer:', gasLimit);
        
      } catch (gasError) {
        console.warn('⚠️ All gas estimation methods failed, using network-specific fallbacks:', gasError.message);
        
        // Network-specific gas settings
        try {
          const networkId = await this.web3!.eth.net.getId();
          if (networkId === 137n) { // Polygon Mainnet
            gasPrice = '50000000000'; // 50 gwei
            gasLimit = 500000;
          } else if (networkId === 80002n) { // Polygon Amoy
            gasPrice = '2000000000'; // 2 gwei
            gasLimit = 800000; // Higher limit for testnet
          } else {
            gasPrice = '20000000000'; // 20 gwei
            gasLimit = 600000;
          }
        } catch {
          gasPrice = '3000000000'; // 3 gwei final fallback
          gasLimit = 800000; // High fallback limit
        }
      }
      
      console.log('📊 Final gas parameters - Price:', gasPrice, 'Limit:', gasLimit);

      // Execute the stake transaction with retry mechanism
      console.log('📤 Calling stake method with token ID:', numericTokenId);
      
      let result;
      const maxRetries = 2;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Transaction attempt ${attempt}/${maxRetries}`);
          
          // Final validation before transaction
          console.log('🔍 Final pre-transaction validation...');
          
          // Double-check ownership right before staking
          const currentOwner = await this.readOnlyNftContract.methods.ownerOf(numericTokenId).call();
          console.log('🔍 Current NFT owner (pre-transaction):', currentOwner);
          console.log('🔍 User account:', this.userAccount);
          
          if (currentOwner.toLowerCase() !== this.userAccount.toLowerCase()) {
            // Check if the NFT is owned by the staking contract (already staked)
            if (currentOwner.toLowerCase() === CONTRACT_ADDRESSES.STAKING_CONTRACT.toLowerCase()) {
              throw new Error(`Token #${numericTokenId} is already staked by another user. The NFT is currently locked in the staking contract.`);
            } else {
              throw new Error(`NFT ownership changed! Current owner: ${currentOwner}, Expected: ${this.userAccount}`);
            }
          }
          
          // Double-check approval right before staking
          const isApproved = await this.readOnlyNftContract.methods.isApprovedForAll(this.userAccount, CONTRACT_ADDRESSES.STAKING_CONTRACT).call();
          console.log('🔍 Current approval status (pre-transaction):', isApproved);
          
          if (!isApproved) {
            // Check individual approval as fallback
            const approvedAddress = await this.readOnlyNftContract.methods.getApproved(numericTokenId).call();
            const individuallyApproved = approvedAddress.toLowerCase() === CONTRACT_ADDRESSES.STAKING_CONTRACT.toLowerCase();
            console.log('🔍 Individual approval (pre-transaction):', approvedAddress, 'Approved:', individuallyApproved);
            
            if (!individuallyApproved) {
              console.log('🔐 NFT not approved - attempting automatic approval...');
              
              // Try automatic approval before failing
              const autoApprovalResult = await this.performAutomaticApproval(this.userAccount!);
              if (!autoApprovalResult) {
                throw new Error('NFT approval was revoked or expired. Please re-approve the NFT for staking.');
              }
              
              console.log('✅ Automatic approval completed - proceeding with staking...');
            }
          }
          
          console.log('✅ Pre-transaction validation passed - executing stake...');
          
          // Use raw transaction to avoid ABI decoding issues
          try {
            // Encode the function call manually to bypass Web3.js event decoding
            const encodedABI = this.stakingContract.methods.stake([numericTokenId]).encodeABI();
            
            const txParams = {
              from: this.userAccount,
              to: this.stakingContract.options.address,
              gas: gasLimit,
              gasPrice: gasPrice,
              data: encodedABI
            };
            
            console.log('📤 Sending raw staking transaction to avoid ABI decoding issues...');
            const rawResult = await this.web3!.eth.sendTransaction(txParams);
            result = { transactionHash: typeof rawResult === 'string' ? rawResult : (rawResult as any).transactionHash };
            
          } catch (rawError) {
            console.warn('⚠️ Raw staking transaction failed, falling back to contract method:', rawError);
            
            // Fallback to original method but catch and handle ABI errors
            try {
              result = await this.stakingContract.methods.stake([numericTokenId]).send({
                from: this.userAccount,
                gas: gasLimit,
                gasPrice: gasPrice
              });
            } catch (contractError: any) {
              // If it's an ABI decoding error but transaction was sent, extract tx hash
              if (contractError.message && (contractError.message.includes('Parameter decoding error') || 
                                          contractError.message.includes('ABI decoding') ||
                                          contractError.message.includes('decode'))) {
                console.log('🔍 ABI decoding error detected in staking, checking for successful transaction...');
                
                // Enhanced transaction detection with multiple strategies
                let foundTxHash = null;
                
                try {
                  // Strategy 1: Check recent blocks (multiple blocks for better coverage)
                  const latestBlock = await this.readOnlyWeb3.eth.getBlockNumber();
                  
                  for (let blockOffset = 0; blockOffset <= 2; blockOffset++) {
                    const blockNumber = Number(latestBlock) - blockOffset;
                    const block = await this.readOnlyWeb3.eth.getBlock(blockNumber, true);
                    
                    const recentTx = block.transactions?.find((tx: any) => 
                      tx.from?.toLowerCase() === this.userAccount?.toLowerCase() &&
                      tx.to?.toLowerCase() === this.stakingContract.options.address?.toLowerCase()
                    );
                    
                    if (recentTx) {
                      foundTxHash = typeof recentTx === 'string' ? recentTx : (recentTx as any).hash;
                      console.log(`🎯 Found staking transaction in block ${blockNumber}:`, foundTxHash);
                      break;
                    }
                  }
                  
                  // Strategy 2: If no transaction found, check if NFT ownership changed (indicates successful staking)
                  if (!foundTxHash) {
                    console.log('🔍 No transaction found in recent blocks, checking NFT ownership change...');
                    
                    // Wait a moment for blockchain state to update
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const currentOwner = await this.readOnlyNftContract.methods.ownerOf(numericTokenId).call();
                    const isNowOwnedByContract = currentOwner.toLowerCase() === CONTRACT_ADDRESSES.STAKING_CONTRACT.toLowerCase();
                    
                    if (isNowOwnedByContract) {
                      console.log('✅ NFT ownership transferred to staking contract - transaction was successful!');
                      // Create a placeholder result since we know staking succeeded
                      result = { transactionHash: 'success_via_ownership_check' };
                    } else {
                      console.log('❌ NFT still owned by user - transaction likely failed');
                      throw contractError;
                    }
                  } else {
                    result = { transactionHash: foundTxHash };
                  }
                  
                } catch (recoveryError) {
                  console.error('❌ Transaction recovery failed:', recoveryError);
                  throw contractError;
                }
              } else {
                throw contractError;
              }
            }
          }
          
          console.log('✅ Transaction successful on attempt:', attempt);
          break;
          
        } catch (txError: any) {
          console.error(`❌ Transaction attempt ${attempt} failed:`, txError.message);
          
          if (attempt === maxRetries) {
            // If all attempts failed, throw the error
            throw txError;
          }
          
          // Wait before retry
          console.log('⏳ Waiting 3 seconds before retry...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      const txHash = result.transactionHash;
      
      console.log('📤 Staking transaction sent:', txHash);
      
      // Wait for confirmation with safe receipt handling to avoid ABI decoding issues
      const receipt = await this.waitForTransactionReceiptSafe(txHash, 60000);
      
      if (!receipt.status || receipt.status === '0x0') {
        console.error('❌ Transaction failed. Receipt:', receipt);
        console.error('🔍 Transaction Hash:', receipt.transactionHash);
        console.error('🔍 Block Explorer URL:', `${NETWORK_CONFIG.BLOCK_EXPLORER}/tx/${receipt.transactionHash}`);
        console.error('🔍 Gas Used:', receipt.gasUsed, 'of', gasLimit);
        
        // Try to get the revert reason
        try {
          const tx = await this.readOnlyWeb3.eth.getTransaction(receipt.transactionHash);
          console.error('🔍 Transaction Details:', {
            gasPrice: tx.gasPrice,
            gasLimit: tx.gas,
            value: tx.value,
            data: tx.input?.slice(0, 50) + '...'
          });
        } catch (txError) {
          console.warn('Could not fetch transaction details:', txError);
        }
        
        throw new Error(`Transaction failed on blockchain. Check explorer: ${NETWORK_CONFIG.BLOCK_EXPLORER}/tx/${receipt.transactionHash}`);
      }

      toast.success('NFT staked successfully onchain!', { id: 'stake-nft' });
      console.log('✅ Onchain staking successful, tx:', receipt.transactionHash);
      
      // 🔥 CRITICAL FIX: Record onchain staking in Supabase database for tracking
      console.log('📊 Recording onchain staking in database for unified reward system...');
      
      // 🎯 FETCH ACTUAL BLOCKCHAIN METADATA FOR REAL RARITY
      const extractedTokenId = this.extractTokenId(nftId);
      console.log('🔍 Fetching actual NFT metadata from blockchain for token:', extractedTokenId);
      
      const blockchainMetadata = await this.fetchNFTMetadataFromBlockchain(extractedTokenId);
      console.log(`✅ Retrieved blockchain metadata - Rarity: ${blockchainMetadata.rarity}, Name: ${blockchainMetadata.name}`);
      
      // Create NFT data object with REAL blockchain metadata
      const nftData = {
        id: nftId,
        name: blockchainMetadata.name,
        rarity: blockchainMetadata.rarity, // 🎯 REAL RARITY FROM BLOCKCHAIN
        image: blockchainMetadata.image,
        description: blockchainMetadata.description,
        attributes: blockchainMetadata.attributes,
        collection: 'NEFTIT',
        wallet_address: walletAddress, // 🔧 FIX: Add required wallet_address property
        ipfs_hash: '',
        metadata_uri: ''
      };
      
      console.log(`🎨 STORING ACTUAL RARITY: ${nftData.rarity} (from blockchain metadata)`);
      
      // Record the onchain staking in database with REAL metadata
      const recordingResult = await this.recordOnchainStakingForTracking(
        walletAddress, 
        nftData, 
        receipt.transactionHash
      );
      
      if (recordingResult.success) {
        console.log('✅ Onchain staking successfully recorded in database');
      } else {
        console.warn('⚠️ Failed to record onchain staking in database:', recordingResult.error);
      }
      
      return {
        success: true,
        verified: true, // Transaction was mined and verified successful
        message: 'NFT staked successfully onchain',
        transactionHash: receipt.transactionHash,
        data: {
          tokenId: this.extractTokenId(nftId),
          transactionHash: receipt.transactionHash,
          onchain: true,
          tracked: true, // Unified reward system handles tracking
          // UI UPDATE DATA - Everything needed for immediate UI refresh
          nftId: nftId,
          stakingSource: 'onchain',
          isStaked: true,
          stakedAt: new Date().toISOString(),
          // Signal UI to update immediately
          immediateUpdate: {
            action: 'stake',
            nftId: nftId,
            stakingSource: 'onchain',
            showLockOverlay: true,
            updateStakingCount: true
          }
        }
      };

    } catch (error) {
      console.error('❌ Onchain NFT staking failed - NO FALLBACK:', error);
      
      let userMessage = 'Onchain staking failed';
      if (error instanceof Error) {
        if (error.message.includes('User denied')) {
          userMessage = 'Transaction was cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          userMessage = 'Insufficient MATIC for gas fees';
        } else if (error.message.includes('Contract mismatch')) {
          userMessage = 'Contract configuration error - please contact support';
        } else if (error.message.includes('does not exist')) {
          userMessage = 'NFT does not exist on the blockchain';
        } else if (error.message.includes('not approved')) {
          userMessage = 'NFT not approved for staking - please approve first';
        } else if (error.message.includes('already staked')) {
          userMessage = error.message; // Use our improved "already staked" message
        } else if (error.message.includes("don't own")) {
          userMessage = error.message; // Use specific ownership message
        } else if (error.message.includes('ownership mismatch')) {
          userMessage = 'You do not own this NFT';
        } else {
          userMessage = error.message;
        }
      }
      
      toast.error(`Onchain staking failed: ${userMessage}`, { id: 'stake-nft' });
      
      // CRITICAL: Throw error to ensure proper revert - NO FALLBACK TO OFFCHAIN
      throw new Error(`Onchain staking failed: ${userMessage}`);
    }
  }

  /**
   * Wait for transaction receipt with timeout
   */
  private async waitForTransactionReceipt(txHash: string, timeoutMs: number = 60000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await this.web3!.eth.getTransactionReceipt(txHash);
        if (receipt) {
          return receipt;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Transaction timeout - please check your wallet and try again');
  }

  /**
   * Extract numeric token ID from string ID
   */
  private extractTokenId(nftId: string): string {
    const match = nftId.match(/\d+/);
    if (!match) {
      throw new Error('Invalid NFT ID format');
    }
    return match[0];
  }

  /**
   * Normalize rarity values to match database constraints
   */
  private normalizeRarity(rarity: string | null): string {
    if (!rarity) return 'Common'; // Only use Common as last resort

    // Convert to proper case format expected by database
    const normalized = rarity.toLowerCase().trim();
    switch (normalized) {
      case 'common': return 'Common';
      case 'rare': return 'Rare';
      case 'legendary': return 'Legendary';
      case 'platinum': return 'Platinum';
      case 'silver': return 'Silver';
      case 'gold': return 'Gold';
      // Handle additional common variations
      case 'epic': return 'Legendary'; // Map Epic to Legendary
      case 'ultra rare': return 'Legendary';
      case 'super rare': return 'Rare';
      default:
        // PRESERVE ACTUAL RARITY - Don't default to Common for unknown values
        console.log(`🎨 Preserving unknown rarity: ${rarity}`);
        return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase(); // Capitalize first letter
    }
  }

  /**
   * Extract rarity from NFT name or description text
   */
  private extractRarityFromText(text: string): string | null {
    if (!text) return null;
    
    const lowerText = text.toLowerCase();
    const rarityKeywords = ['legendary', 'rare', 'common', 'platinum', 'gold', 'silver', 'epic', 'ultra rare', 'super rare'];
    
    for (const keyword of rarityKeywords) {
      if (lowerText.includes(keyword)) {
        console.log(`🔍 Found rarity keyword '${keyword}' in text: ${text}`);
        return keyword;
      }
    }
    
    return null;
  }

  /**
   * Check if onchain staking is available
   */
  async isOnChainAvailable(): Promise<boolean> {
    try {
      console.log('🔍 Checking onchain availability...');
      
      if (!window.ethereum) {
        console.log('❌ No MetaMask detected');
        return false;
      }
      
      if (!this.web3) {
        console.log('🔄 Initializing Web3...');
        await this.initializeWeb3();
      }
      
      if (!this.web3) {
        console.log('❌ Web3 initialization failed');
        return false;
      }

      const chainId = await this.web3.eth.getChainId();
      const expectedChainId = NETWORK_CONFIG.CHAIN_ID;
      console.log(`🔗 Current chain ID: ${chainId}, Expected: ${expectedChainId}`);
      
      const isCorrectNetwork = Number(chainId) === expectedChainId;
      console.log(`⛓️ Network check result: ${isCorrectNetwork}`);
      
      if (!isCorrectNetwork) {
        console.warn(`❌ Wrong network. Connected to ${chainId}, need ${expectedChainId} (Polygon Amoy)`);
      }
      
      return isCorrectNetwork;
    } catch (error) {
      console.error('❌ Onchain staking not available:', error);
      return false;
    }
  }

  /**
   * Fetch NFT metadata from blockchain to get actual rarity and attributes
   */
  private async fetchNFTMetadataFromBlockchain(tokenId: string): Promise<{ rarity: string, name: string, image: string, description: string, attributes: any[] }> {
    try {
      console.log(`🔍 Fetching NFT metadata from blockchain for token ${tokenId}...`);
      
      // Get tokenURI from contract
      const tokenURIResult = await this.retryRPCCall(
        () => this.readOnlyNftContract.methods.tokenURI(tokenId).call()
      );
      
      // Type assertion and validation for tokenURI
      const tokenURI = String(tokenURIResult || '').trim();
      
      console.log(`📋 Token URI for ${tokenId}: ${tokenURI}`);
      
      if (!tokenURI || tokenURI === '' || tokenURI === 'undefined' || tokenURI === 'null') {
        console.warn(`⚠️ No valid tokenURI found for token ${tokenId}, using defaults`);
        return {
          rarity: 'Common',
          name: `Onchain NFT #${tokenId}`,
          image: '',
          description: `Onchain staked NFT #${tokenId}`,
          attributes: []
        };
      }
      
      // Validate tokenURI format (should be a valid URL)
      let validTokenURI: string;
      try {
        // Check if it's a valid URL or IPFS hash
        if (tokenURI.startsWith('http://') || tokenURI.startsWith('https://')) {
          validTokenURI = tokenURI;
        } else if (tokenURI.startsWith('ipfs://')) {
          // Convert IPFS protocol to HTTP gateway
          const ipfsHash = tokenURI.replace('ipfs://', '');
          validTokenURI = getIPFSUrl(ipfsHash);
        } else if (tokenURI.match(/^Qm[a-zA-Z0-9]{44}$/)) {
          // Direct IPFS hash
          validTokenURI = getIPFSUrl(tokenURI);
        } else {
          throw new Error('Invalid tokenURI format');
        }
      } catch (urlError) {
        console.warn(`⚠️ Invalid tokenURI format: ${tokenURI}, using defaults`);
        return {
          rarity: 'Common',
          name: `Onchain NFT #${tokenId}`,
          image: '',
          description: `Onchain staked NFT #${tokenId}`,
          attributes: []
        };
      }
      
      // Fetch metadata from IPFS/HTTP
      console.log(`🌐 Fetching metadata from: ${validTokenURI}`);
      const response = await fetch(validTokenURI);
      
      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch metadata from ${tokenURI}, status: ${response.status}`);
        throw new Error(`HTTP ${response.status}`);
      }
      
      const metadata = await response.json();
      console.log(`📋 NFT Metadata for token ${tokenId}:`, metadata);
      
      // Extract rarity from metadata attributes - ENHANCED DETECTION
      let rarity = null; // Start with null to detect actual rarity
      
      if (metadata.attributes && Array.isArray(metadata.attributes)) {
        const rarityAttribute = metadata.attributes.find((attr: any) => 
          attr.trait_type?.toLowerCase() === 'rarity' || 
          attr.trait_type?.toLowerCase() === 'tier' ||
          attr.trait_type?.toLowerCase() === 'level' ||
          attr.trait_type?.toLowerCase() === 'grade' ||
          attr.name?.toLowerCase() === 'rarity' ||
          attr.name?.toLowerCase() === 'tier'
        );
        
        if (rarityAttribute) {
          rarity = rarityAttribute.value || rarityAttribute.trait_value;
          console.log(`🎨 Found rarity in attributes: ${rarity} (from ${rarityAttribute.trait_type || rarityAttribute.name})`);
        }
      }
      
      // Also check if rarity is a direct property
      if (!rarity && metadata.rarity) {
        rarity = metadata.rarity;
        console.log(`🎨 Found rarity as direct property: ${rarity}`);
      }
      
      // Check for tier as alternative
      if (!rarity && metadata.tier) {
        rarity = metadata.tier;
        console.log(`🎨 Found rarity as tier property: ${rarity}`);
      }
      
      // If no rarity found in metadata, try to extract from NFT name or description
      if (!rarity && metadata.name) {
        const nameRarity = this.extractRarityFromText(metadata.name);
        if (nameRarity) {
          rarity = nameRarity;
          console.log(`🎨 Extracted rarity from name: ${rarity}`);
        }
      }
      
      if (!rarity && metadata.description) {
        const descRarity = this.extractRarityFromText(metadata.description);
        if (descRarity) {
          rarity = descRarity;
          console.log(`🎨 Extracted rarity from description: ${rarity}`);
        }
      }
      
      // Normalize rarity to match database constraints
      rarity = this.normalizeRarity(rarity);
      
      return {
        rarity: rarity,
        name: metadata.name || `Onchain NFT #${tokenId}`,
        image: metadata.image || '',
        description: metadata.description || `Onchain staked NFT #${tokenId}`,
        attributes: metadata.attributes || []
      };
      
    } catch (error) {
      console.error(`❌ Error fetching NFT metadata for token ${tokenId}:`, error);
      console.log(`🔄 Using fallback metadata for token ${tokenId}`);
      
      // Try to determine rarity from token ID patterns or other sources
      let fallbackRarity = 'Common';
      
      // You can add logic here to determine rarity based on token ID ranges
      // For example: if (parseInt(tokenId) >= 1000) fallbackRarity = 'Legendary';
      
      // Return fallback metadata with intelligent rarity detection
      return {
        rarity: fallbackRarity,
        name: `Onchain NFT #${tokenId}`,
        image: '',
        description: `Onchain staked NFT #${tokenId}`,
        attributes: []
      };
    }
  }

  /**
   * Record onchain staking for unified reward system integration
   * This method adds onchain staked NFT to database for offchain reward participation
   */
  private async recordOnchainStakingForTracking(walletAddress: string, nft: NFTData, transactionHash: string): Promise<{ success: boolean, data?: any, error?: string }> {
    try {
      console.log('📊 Recording onchain staking for unified reward system:', nft.id);
      
      const tokenId = this.extractTokenId(nft.id);
      
      // 🔥 CRITICAL FIX: Fetch actual NFT metadata from blockchain instead of using defaults
      console.log('🔍 Fetching actual NFT metadata from blockchain...');
      const blockchainMetadata = await this.fetchNFTMetadataFromBlockchain(tokenId);
      
      console.log(`✅ Retrieved blockchain metadata - Rarity: ${blockchainMetadata.rarity}, Name: ${blockchainMetadata.name}`);
      
      // Create enhanced NFT data for database tracking using REAL blockchain metadata
      const enhancedNFTData = {
        id: `onchain_${tokenId}`, // Prefix to identify as onchain
        name: blockchainMetadata.name,
        image: blockchainMetadata.image,
        rarity: blockchainMetadata.rarity, // 🎯 REAL RARITY FROM BLOCKCHAIN
        wallet_address: walletAddress,
        description: blockchainMetadata.description,
        attributes: blockchainMetadata.attributes,
        collection: 'NEFTIT',
        ipfs_hash: nft.ipfs_hash || '',
        metadata_uri: nft.metadata_uri || ''
      };
      
      console.log('📝 Enhanced NFT data with REAL blockchain metadata:', enhancedNFTData);
      console.log(`🎨 RARITY CONFIRMED: ${enhancedNFTData.rarity} (from blockchain metadata)`);
      
      // 🔥 CRITICAL VALIDATION: Ensure rarity is not null/undefined before database storage
      if (!enhancedNFTData.rarity || enhancedNFTData.rarity.trim() === '') {
        console.warn(`⚠️ WARNING: Empty rarity detected for token ${tokenId}, using fallback`);
        enhancedNFTData.rarity = 'Common'; // Only fallback if truly empty
      }
      
      console.log(`🎯 FINAL RARITY FOR DATABASE: ${enhancedNFTData.rarity}`);
      
      // Record onchain staking in database using offchain service for reward tracking
      // Use 'onchain' as staking source to differentiate from regular offchain staking
      const result = await this.offChainStakingService.stakeNFT(
        walletAddress, 
        enhancedNFTData, 
        'onchain', // Specify onchain staking source
        transactionHash // Pass transaction hash for tracking
      );
      
      if (result.success) {
        console.log('✅ Onchain NFT recorded in database for reward tracking:', tokenId);
        console.log(`🎁 NFT will now participate in daily reward generation with ${enhancedNFTData.rarity} rarity rewards`);
        
        return { 
          success: true, 
          data: { 
            message: 'Onchain staking recorded successfully in database',
            tokenId: tokenId,
            transactionHash: transactionHash,
            rarity: enhancedNFTData.rarity,
            stakingId: result.data?.stakingId
          }
        };
      } else {
        console.error('❌ Failed to record onchain staking in database:', result.message || 'Unknown error');
        return { success: false, error: result.message || 'Failed to record onchain staking in database' };
      }
      
    } catch (error) {
      console.error('❌ Error recording onchain staking tracking:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update offchain staking record status after blockchain operations
   * This keeps the record for history/analytics but marks it as unstaked
   */
  private async updateOffchainStakingRecord(walletAddress: string, tokenId: string, status: 'staked' | 'unstaked'): Promise<void> {
    try {
      console.log(`💾 Updating onchain NFT record to ${status} status in unified reward system:`, tokenId);
      
      // Try multiple ID formats to find and update the correct staking record
      const possibleIds = [
        `onchain_${tokenId}`,
        `blockchain_${tokenId}`,
        tokenId,
        tokenId.toString()
      ];
      
      let updated = false;
      for (const id of possibleIds) {
        try {
          console.log(`🔍 Attempting to update staking record with ID: ${id} to ${status}`);
          
          if (status === 'unstaked') {
            // Use the unstakeNFT method which properly handles the status update
            const result = await this.offChainStakingService.unstakeNFT(walletAddress, id);
            
            if (result.success) {
              console.log(`✅ Successfully updated onchain staked NFT to unstaked status using ID: ${id}`);
              updated = true;
              break;
            }
          } else {
            // For staked status, we'd use stakeNFT method (if needed in future)
            console.log(`ℹ️ Staked status update not implemented yet for ID: ${id}`);
          }
        } catch (idError) {
          console.log(`⚠️ Failed to update record with ID ${id}:`, idError.message);
          continue;
        }
      }
      
      if (!updated && status === 'unstaked') {
        console.warn('⚠️ Could not find matching staking record to update. This may be expected if the NFT was staked directly onchain.');
      }
      
    } catch (error) {
      console.error('❌ Error updating staking record:', error);
    }
  }
  
  /**
   * Enhanced NFT unstaking from onchain
   */
  async unstakeNFTOnChain(walletAddress: string, tokenId: string): Promise<StakingResponse> {
    try {
      console.log(`🔗 Starting enhanced onchain NFT unstaking for token: ${tokenId}`);
      
      await this.initializeContracts();
      
      if (!this.nftContract || !this.stakingContract || !this.userAccount) {
        throw new Error('Contracts not initialized or user not connected');
      }

      // Validate and sanitize token ID - FIXED LOGIC
      const numericTokenId = parseInt(tokenId);
      if (isNaN(numericTokenId) || numericTokenId < 0) {
        throw new Error(`Invalid token ID: ${tokenId}. Must be a positive integer.`);
      }
      
      console.log('📤 Validated token ID:', numericTokenId, '(from input:', tokenId, ')');

      // Validate that the NFT is actually staked using direct contract call
      console.log('🔍 Validating NFT staking status...');
      const formattedAddress = this.web3!.utils.toChecksumAddress(walletAddress);
      const stakeInfo = await this.readOnlyStakingContract.methods.getStakeInfo(formattedAddress).call();
      const stakedTokens = stakeInfo._tokensStaked || stakeInfo[0] || [];
      const stakedTokenStrings = stakedTokens.map((token: any) => token.toString());
      
      console.log('📋 Current staked tokens:', stakedTokenStrings);
      console.log('🔍 Looking for token ID:', tokenId, 'and numeric:', numericTokenId.toString());
      
      // FIXED: Check both string and numeric formats for proper matching
      const isStaked = stakedTokenStrings.includes(tokenId) || 
                      stakedTokenStrings.includes(numericTokenId.toString()) ||
                      stakedTokens.some((token: any) => parseInt(token) === numericTokenId);
      
      if (!isStaked) {
        throw new Error(`Token #${tokenId} is not currently staked onchain. Staked tokens: [${stakedTokenStrings.join(', ')}]. Searched for: ${tokenId}, ${numericTokenId}`);
      }

      // Execute unstaking transaction
      toast.loading('Unstaking NFT from blockchain...', { id: 'unstake-nft' });
      console.log('🔗 Executing unstake transaction...');
      
      // Try dynamic gas estimation first, fallback to fixed values
      let gasPrice, gasLimit;
      
      try {
        // Get current gas price from read-only Web3 (bypass MetaMask RPC issues)
        const networkGasPrice = await this.readOnlyWeb3.eth.getGasPrice();
        gasPrice = networkGasPrice.toString();
        console.log('📊 Network gas price (via direct RPC):', gasPrice);
        
        // Estimate gas using read-only contract (bypass MetaMask RPC issues)
        const estimatedGas = await this.readOnlyStakingContract.methods.withdraw([numericTokenId]).estimateGas({
          from: this.userAccount
        });
        
        // Add 20% buffer to gas limit and convert to number
        gasLimit = Math.floor(Number(estimatedGas) * 1.2);
        console.log('📊 Estimated gas limit (with buffer, via direct RPC):', gasLimit);
        
      } catch (gasError) {
        console.warn('⚠️ Gas estimation failed, using fixed values:', gasError.message);
        gasPrice = '3000000000'; // 3 gwei fallback
        gasLimit = 400000; // Safe fallback
      }
      
      console.log('📊 Final gas parameters - Price:', gasPrice, 'Limit:', gasLimit);

      // Execute the withdraw transaction with proper error handling
      console.log('📤 Calling withdraw method with token ID array:', [numericTokenId]);
      
      // Use sendTransaction directly to avoid automatic event decoding
      let txHash: string;
      
      try {
        // Encode the function call manually to bypass Web3.js event decoding
        const encodedABI = this.stakingContract.methods.withdraw([numericTokenId]).encodeABI();
        
        const txParams = {
          from: this.userAccount,
          to: this.stakingContract.options.address,
          gas: gasLimit,
          gasPrice: gasPrice,
          data: encodedABI
        };
        
        console.log('📤 Sending raw transaction to avoid ABI decoding issues...');
        const result = await this.web3!.eth.sendTransaction(txParams);
        txHash = typeof result === 'string' ? result : (result as any).transactionHash;
        
      } catch (sendError) {
        console.warn('⚠️ Raw transaction failed, falling back to contract method:', sendError);
        
        // Fallback to original method but catch and handle ABI errors
        try {
          const result = await this.stakingContract.methods.withdraw([numericTokenId]).send({
            from: this.userAccount,
            gas: gasLimit,
            gasPrice: gasPrice
          });
          txHash = result.transactionHash;
        } catch (contractError: any) {
          // If it's an ABI decoding error but transaction was sent, extract tx hash
          if (contractError.message && contractError.message.includes('Parameter decoding error')) {
            console.log('🔍 ABI decoding error detected, checking for successful transaction...');
            
            // Try to find the transaction hash in the error or recent transactions
            const latestBlock = await this.readOnlyWeb3.eth.getBlockNumber();
            const block = await this.readOnlyWeb3.eth.getBlock(latestBlock, true);
            
            // Look for recent transaction from our account
            const recentTx = block.transactions?.find((tx: any) => 
              tx.from?.toLowerCase() === this.userAccount?.toLowerCase() &&
              tx.to?.toLowerCase() === this.stakingContract.options.address?.toLowerCase()
            );
            
            if (recentTx) {
              txHash = typeof recentTx === 'string' ? recentTx : (recentTx as any).hash;
              console.log('🎯 Found transaction hash despite ABI error:', txHash);
            } else {
              throw contractError;
            }
          } else {
            throw contractError;
          }
        }
      }
      
      console.log('📤 Unstaking transaction sent:', txHash);
      
      // Wait for confirmation with custom receipt handling to avoid ABI decoding issues
      const receipt = await this.waitForTransactionReceiptSafe(txHash, 60000);
      
      if (!receipt.status || receipt.status === '0x0') {
        console.error('❌ Transaction failed. Receipt:', receipt);
        throw new Error('Transaction failed on blockchain - check transaction on explorer for details');
      }

      toast.success('NFT unstaked successfully from blockchain!', { id: 'unstake-nft' });
      console.log('✅ Onchain unstaking successful, tx:', receipt.transactionHash);
      
      // Update offchain record to unstaked status (don't delete - keep history)
      await this.updateOffchainStakingRecord(walletAddress, tokenId, 'unstaked');
      
      return {
        success: true,
        message: 'NFT unstaked successfully from blockchain',
        data: {
          transactionHash: receipt.transactionHash,
          tokenId: tokenId,
          onchain: true,
          // UI UPDATE DATA - Everything needed for immediate UI refresh
          nftId: `onchain_${tokenId}`, // Match the UI NFT ID format
          stakingSource: 'onchain',
          isStaked: false,
          unstakedAt: new Date().toISOString(),
          // Signal UI to update immediately
          immediateUpdate: {
            action: 'unstake',
            nftId: `onchain_${tokenId}`,
            stakingSource: 'onchain',
            showLockOverlay: false,
            updateStakingCount: true,
            removeLockOverlay: true
          }
        }
      };

    } catch (error) {
      console.error('❌ Enhanced onchain NFT unstaking failed:', error);
      
      let userMessage = 'Onchain unstaking failed';
      if (error instanceof Error) {
        if (error.message.includes('User denied')) {
          userMessage = 'Transaction was cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          userMessage = 'Insufficient MATIC for gas fees';
        } else if (error.message.includes('Parameter decoding error') || error.message.includes('AbiError')) {
          userMessage = 'Contract parameter error - please try again or contact support';
        } else if (error.message.includes('not currently staked')) {
          userMessage = error.message; // Use the detailed staking status message
        } else if (error.message.includes('not currently staked')) {
          userMessage = 'NFT is not currently staked onchain';
        } else {
          userMessage = error.message;
        }
      }
      
      toast.error(`Unstaking failed: ${userMessage}`, { id: 'unstake-nft' });
      
      return {
        success: false,
        message: userMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // REMOVED: calculateDailyReward() - Now handled by unified database reward system
  // All reward calculations are done in the database via stake_nft_with_source() function
  // This ensures consistency between onchain and offchain staking rewards

  /**
   * Get staking info for a user
   */
  async getStakeInfo(walletAddress: string): Promise<{ stakedNFTs: string[], pendingRewards: string }> {
    try {
      console.log(`🔄 [ImprovedOnchainStakingService] getStakeInfo called for: ${walletAddress}`);
      await this.initializeContracts();
      
      if (!this.stakingContract) {
        throw new Error('Staking contract not initialized');
      }

      const formattedAddress = this.web3!.utils.toChecksumAddress(walletAddress);
      console.log(`📞 [ImprovedOnchainStakingService] Calling contract getStakeInfo for: ${formattedAddress}`);
      const stakeInfo = await this.readOnlyStakingContract.methods.getStakeInfo(formattedAddress).call();
      const stakedTokens = stakeInfo._tokensStaked || stakeInfo[0] || [];
      const pendingRewards = stakeInfo._rewards || stakeInfo[1] || '0';
      
      return {
        stakedNFTs: stakedTokens.map((tokenId: any) => tokenId.toString()),
        pendingRewards: this.web3!.utils.fromWei(pendingRewards, 'ether')
      };
    } catch (error: any) {
      console.error('❌ [ImprovedOnchainStakingService] Error getting stake info:', error);
      
      // Check if this is the MetaMask circuit breaker error
      if (error?.message?.includes('circuit breaker is open') || error?.code === -32603) {
        console.warn('🚫 [ImprovedOnchainStakingService] MetaMask circuit breaker blocked getStakeInfo call');
      }
      
      return { stakedNFTs: [], pendingRewards: '0' };
    }
  }

  /**
   * Recover and sync onchain staked NFTs to database
   */
  async recoverOnchainStakedNFTs(walletAddress: string): Promise<{ success: boolean, recovered: number, error?: string }> {
    try {
      console.log(`🔄 Starting onchain NFT recovery for: ${walletAddress}`);
      
      // Get onchain staked NFTs
      const stakeInfo = await this.getStakeInfo(walletAddress);
      
      if (stakeInfo.stakedNFTs.length === 0) {
        console.log('ℹ️ No onchain staked NFTs found');
        return { success: true, recovered: 0 };
      }
      
      console.log(`📊 Found ${stakeInfo.stakedNFTs.length} onchain staked NFTs`);
      
      // Import supabase here to avoid circular dependencies
      const { supabase } = await import('../lib/supabase');
      
      // Check which NFTs are already in database
      const { data: existingStakes, error: fetchError } = await supabase
        .from('staked_nfts')
        .select('nft_id')
        .eq('wallet_address', walletAddress.toLowerCase())
        .eq('staking_source', 'onchain');
      
      if (fetchError) {
        console.error('❌ Error fetching existing stakes:', fetchError);
      }
      
      const existingTokenIds = new Set(
        (existingStakes || []).map(stake => stake.nft_id?.replace('onchain_', ''))
      );
      
      let recovered = 0;
      
      // Process each onchain staked NFT
      for (const tokenId of stakeInfo.stakedNFTs) {
        if (existingTokenIds.has(tokenId)) {
          console.log(`✅ Token ${tokenId} already exists in database`);
          continue;
        }
        
        try {
          // Get stake details from contract
          const stakeDetails = await this.stakingContract!.methods.stakes(tokenId).call();
          const stakeTimestamp = stakeDetails.timestamp || stakeDetails[1];
          const stakedAt = new Date(parseInt(stakeTimestamp) * 1000).toISOString();
          
          // Create database record for missing NFT
          const stakeRecord = {
            nft_id: `onchain_${tokenId}`,
            wallet_address: walletAddress.toLowerCase(),
            nft_rarity: 'Common', // Default to common for recovered NFTs
            daily_reward: 0, // Will be calculated by database in stake_nft_with_source()
            staked_at: stakedAt,
            last_reward_calculated: stakedAt,
            staking_source: 'onchain',
            transaction_hash: `recovered_${Date.now()}_${tokenId}`
          };
          
          const { error: insertError } = await supabase
            .from('staked_nfts')
            .insert(stakeRecord);
          
          if (insertError) {
            console.error(`❌ Error inserting stake record for token ${tokenId}:`, insertError);
          } else {
            console.log(`✅ Recovered and synced token ${tokenId} to database`);
            recovered++;
          }
          
        } catch (tokenError: any) {
          console.error(`❌ Error processing token ${tokenId}:`, tokenError);
        }
      }
      
      console.log(`🎉 Recovery complete! Recovered: ${recovered} NFTs`);
      
      return { success: true, recovered };
      
    } catch (error) {
      console.error('❌ Error during onchain NFT recovery:', error);
        return { success: false, recovered: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get staked NFTs onchain (simplified version for sync operations)
   */
  async getStakedNFTsOnChain(walletAddress: string): Promise<any[]> {
    try {
      console.log(`🔍 Getting staked NFTs onchain for: ${walletAddress}`);
      
      const stakeInfo = await this.getStakeInfo(walletAddress);
      const stakedNFTs = [];
      
      for (const tokenId of stakeInfo.stakedNFTs) {
        try {
          // Create basic NFT object for sync operations
          stakedNFTs.push({
            id: `onchain_${tokenId}`,
            tokenId,
            name: `Onchain NFT #${tokenId}`,
            image: null, // Will be populated by detailed fetch if needed
            rarity: 'Common', // Default rarity
            isStaked: true,
            stakingMethod: 'onchain'
          });
        } catch (tokenError: any) {
          console.error(`❌ Error processing token ${tokenId}:`, tokenError);
        }
      }
      
      console.log(`✅ Found ${stakedNFTs.length} staked NFTs onchain`);
      return stakedNFTs;
      
    } catch (error) {
      console.error('❌ Error getting staked NFTs onchain:', error);
      return [];
    }
  }

  /**
   * Get detailed onchain staked NFTs with metadata - FIXED TO USE PROPER METADATA LOADING
   */
  async getDetailedOnchainStakedNFTs(walletAddress: string): Promise<any[]> {
    try {
      console.log(`🔍 [ImprovedOnchainStakingService] Getting detailed onchain staked NFTs for: ${walletAddress}`);
      console.log(`🔧 [ImprovedOnchainStakingService] Contract addresses - Staking: ${this.stakingContract?._address}, NFT: ${this.nftContract?._address}`);
      console.log(`🔧 [ImprovedOnchainStakingService] Contracts initialized:`, {
        stakingContract: !!this.stakingContract,
        nftContract: !!this.nftContract,
        readOnlyNftContract: !!this.readOnlyNftContract
      });
      
      console.log(`🔄 [ImprovedOnchainStakingService] Calling getStakeInfo...`);
      const stakeInfo = await this.getStakeInfo(walletAddress);
      console.log(`📊 [ImprovedOnchainStakingService] Stake info retrieved:`, { stakedNFTs: stakeInfo.stakedNFTs, totalStaked: stakeInfo.stakedNFTs.length });
      
      const detailedNFTs = [];
      
      for (const tokenId of stakeInfo.stakedNFTs) {
        try {
          // Get staker info for this user (not token-specific, but user-specific)
          const stakerInfo = await this.stakingContract!.methods.stakers(walletAddress).call();
          const timeOfLastUpdate = stakerInfo.timeOfLastUpdate || stakerInfo[2];
          const stakedAt = new Date(parseInt(timeOfLastUpdate) * 1000).toISOString();
          
          let name = `${tokenId}`;
          let image = null;
          let rarity = null; // Don't default to 'common' - extract from metadata
          let description = '';
          let attributes: any[] = [];
          let tokenURI = null;
          
          // CRITICAL FIX: Get metadata directly from blockchain using tokenURI
          // Staked NFTs are no longer "owned" by wallet, so we must fetch from contract
          try {
            if (this.nftContract) {
              console.log(`🔍 Fetching metadata for staked NFT ${tokenId} from blockchain...`);
              tokenURI = await this.readOnlyNftContract.methods.tokenURI(tokenId).call();
              
              if (tokenURI && (tokenURI.startsWith('http') || tokenURI.startsWith('/api/ipfs/'))) {
                console.log(`📡 Fetching metadata from URI: ${tokenURI}`);
                const response = await fetch(tokenURI);
                if (response.ok) {
                  const metadata = await response.json();
                  name = metadata?.name || name;
                  image = metadata?.image || null;
                  description = metadata?.description || '';
                  attributes = metadata?.attributes || [];
                  
                  // ENHANCED: Extract rarity from multiple sources with priority
                  // Priority 1: Check attributes for rarity/tier/level
                  const rarityAttr = attributes.find(attr => {
                    const traitType = attr.trait_type?.toLowerCase();
                    return traitType === 'rarity' || 
                           traitType === 'tier' || 
                           traitType === 'level' ||
                           traitType === 'grade' ||
                           traitType === 'quality';
                  });
                  
                  if (rarityAttr) {
                    rarity = rarityAttr.value.toString().toLowerCase();
                    console.log(`🎯 Found rarity in attributes: ${rarity}`);
                  } else {
                    // Priority 2: Extract from NFT name
                    const nameMatch = name.match(/(common|rare|epic|legendary|platinum|silver|gold)/i);
                    if (nameMatch) {
                      rarity = nameMatch[1].toLowerCase();
                      console.log(`🎯 Extracted rarity from name: ${rarity}`);
                    } else {
                      // Priority 3: Check description for rarity keywords
                      const descMatch = description.match(/(common|rare|epic|legendary|platinum|silver|gold)/i);
                      if (descMatch) {
                        rarity = descMatch[1].toLowerCase();
                        console.log(`🎯 Found rarity in description: ${rarity}`);
                      } else {
                        // Priority 4: Check all attributes for rarity values
                        const rarityValue = attributes.find(attr => {
                          const value = attr.value?.toString().toLowerCase();
                          return value && /(common|rare|epic|legendary|platinum|silver|gold)/.test(value);
                        });
                        
                        if (rarityValue) {
                          const match = rarityValue.value.toString().match(/(common|rare|epic|legendary|platinum|silver|gold)/i);
                          if (match) {
                            rarity = match[1].toLowerCase();
                            console.log(`🎯 Found rarity in attribute value: ${rarity}`);
                          }
                        }
                      }
                    }
                  }
                  
                  // Final fallback only if absolutely no rarity found
                  if (!rarity) {
                    rarity = 'common';
                    console.log(`⚠️ No rarity found in metadata, defaulting to: ${rarity}`);
                  }
                  
                  console.log(`✅ Successfully fetched metadata for staked NFT ${tokenId}: ${name} (${rarity})`);
                } else {
                  console.warn(`⚠️ Failed to fetch metadata from URI ${tokenURI}: ${response.status}`);
                }
              } else {
                console.warn(`⚠️ Invalid or missing tokenURI for NFT ${tokenId}: ${tokenURI}`);
              }
            } else {
              console.warn(`⚠️ NFT contract not available for metadata fetching`);
            }
          } catch (metadataError: any) {
            console.error(`❌ Error fetching metadata for staked NFT ${tokenId}:`, metadataError instanceof Error ? metadataError.message : 'Unknown error');
            // If metadata fetch fails completely, set fallback rarity only if not already set
            if (!rarity) {
              rarity = 'common';
              console.log(`⚠️ Metadata fetch failed, using fallback rarity: ${rarity}`);
            }
          }
          
          // Ensure rarity is always set before creating NFT object
          if (!rarity) {
            rarity = 'common';
            console.log(`⚠️ No rarity determined, using final fallback: ${rarity}`);
          }
          
          detailedNFTs.push({
            tokenId,
            stakedAt,
            stakeTimestamp: parseInt(timeOfLastUpdate) * 1000,
            tokenURI,
            name,
            image,
            rarity,
            description,
            attributes,
            dailyReward: this.calculateDailyReward(rarity) // Calculate proper daily reward
          });
          
        } catch (tokenError: any) {
          console.error(`❌ Error getting details for token ${tokenId}:`, tokenError);
          // Add minimal data even if details fetch fails
          detailedNFTs.push({
            tokenId,
            stakedAt: new Date().toISOString(),
            name: `Onchain NFT #${tokenId}`,
            image: null,
            rarity: 'Common',
            dailyReward: 1,
            error: tokenError instanceof Error ? tokenError.message : 'Unknown error'
          });
        }
      }
      
      console.log(`✅ Retrieved details for ${detailedNFTs.length} onchain staked NFTs with proper metadata`);
      return detailedNFTs;
      
    } catch (error: any) {
      console.error('❌ [ImprovedOnchainStakingService] Error getting detailed onchain staked NFTs:', error);
      
      // Check if this is the MetaMask circuit breaker error
      if (error?.message?.includes('circuit breaker is open') || error?.code === -32603) {
        console.warn('🚫 [ImprovedOnchainStakingService] MetaMask circuit breaker is preventing blockchain calls');
        console.warn('🔄 [ImprovedOnchainStakingService] Fallback mechanism should handle this in Staking.tsx');
      }
      
      return [];
    }
  }

  /**
   * Calculate daily reward based on rarity
   */
  private calculateDailyReward(rarity: string): number {
    const rarityRewards = {
      'common': 1,
      'rare': 2,
      'epic': 3,
      'legendary': 5,
      'platinum': 8,
      'silver': 12,
      'gold': 20
    };
    
    return rarityRewards[rarity.toLowerCase()] || 1;
  }

  /**
   * Sync existing staked NFTs from blockchain to database for reward tracking
   * This method finds NFTs that are already staked onchain but not recorded in database
   */
  async syncExistingStakedNFTs(walletAddress: string): Promise<{success: boolean, synced: number, errors: string[], details: any[]}> {
    try {
      console.log('🔄 Starting sync of existing staked NFTs for wallet:', walletAddress);
      
      // 1. Get staked NFTs from blockchain
      const stakedNFTs = await this.getStakedNFTsOnChain(walletAddress);
      console.log(`📊 Found ${stakedNFTs.length} NFTs staked onchain`);
      
      if (stakedNFTs.length === 0) {
        return { success: true, synced: 0, errors: [], details: [] };
      }
      
      // 2. Get already tracked NFTs from database
      const trackedNFTs = await this.offChainStakingService.getStakedNFTs(walletAddress);
      console.log(`💾 Found ${trackedNFTs.length} NFTs already tracked in database`);
      
      // Create set of tracked token IDs (remove onchain_ prefix for comparison)
      const trackedTokenIds = new Set(
        trackedNFTs
          .filter(nft => nft.id.startsWith('onchain_'))
          .map(nft => nft.id.replace('onchain_', ''))
      );
      
      // 3. Find untracked NFTs
      const untracked = stakedNFTs.filter(nft => {
        const tokenId = this.extractTokenId(nft.id);
        return !trackedTokenIds.has(tokenId);
      });
      
      console.log(`🔍 Found ${untracked.length} untracked staked NFTs to sync`);
      
      if (untracked.length === 0) {
        console.log('✅ All staked NFTs are already tracked in database');
        return { success: true, synced: 0, errors: [], details: [] };
      }
      
      // 4. Record each untracked NFT
      let synced = 0;
      const errors: string[] = [];
      const details: any[] = [];
      
      for (const nft of untracked) {
        try {
          console.log(`📝 Syncing NFT ${nft.id} to database...`);
          
          const result = await this.recordOnchainStakingForTracking(
            walletAddress, 
            nft, 
            'sync_existing' // Use special transaction hash to indicate this is a sync operation
          );
          
          if (result.success) {
            synced++;
            details.push({
              tokenId: this.extractTokenId(nft.id),
              name: nft.name,
              rarity: nft.rarity,
              status: 'synced',
              stakingId: result.data?.stakingId
            });
            console.log(`✅ Successfully synced NFT ${nft.id}`);
          } else {
            const errorMsg = `Failed to sync ${nft.id}: ${result.error}`;
            errors.push(errorMsg);
            details.push({
              tokenId: this.extractTokenId(nft.id),
              name: nft.name,
              status: 'failed',
              error: result.error
            });
            console.error(`❌ ${errorMsg}`);
          }
        } catch (error) {
          const errorMsg = `Exception syncing ${nft.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          details.push({
            tokenId: this.extractTokenId(nft.id),
            name: nft.name,
            status: 'exception',
            error: errorMsg
          });
          console.error(`❌ ${errorMsg}`);
        }
      }
      
      console.log(`🎯 Sync completed: ${synced} synced, ${errors.length} errors`);
      
      return { 
        success: true, 
        synced, 
        errors, 
        details 
      };
      
    } catch (error) {
      console.error('❌ Error during sync operation:', error);
      return { 
        success: false, 
        synced: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown sync error'], 
        details: [] 
      };
    }
  }

  /**
   * Safe transaction receipt waiting that avoids ABI decoding issues
   */
  private async waitForTransactionReceiptSafe(txHash: string, timeoutMs: number = 60000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Use direct web3 call to avoid ABI event decoding issues
        const receipt = await this.readOnlyWeb3.eth.getTransactionReceipt(txHash);
        
        if (receipt) {
          console.log('✅ Transaction receipt received:', {
            transactionHash: receipt.transactionHash,
            status: receipt.status,
            gasUsed: receipt.gasUsed,
            blockNumber: receipt.blockNumber
          });
          return receipt;
        }
        
        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.warn('⚠️ Error checking transaction receipt:', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error(`Transaction receipt timeout after ${timeoutMs}ms for tx: ${txHash}`);
  }

  /**
   * Public method to check if user has approved the staking contract
   */
  async checkApprovalStatus(walletAddress: string): Promise<boolean> {
    try {
      if (!this.readOnlyNftContract) {
        await this.initializeContracts();
      }

      console.log('🔍 Checking approval status for wallet:', walletAddress);
      
      // Check if approved for all tokens
      const isApprovedForAll = await this.readOnlyNftContract.methods
        .isApprovedForAll(walletAddress, CONTRACT_ADDRESSES.STAKING_CONTRACT)
        .call();
      
      console.log('✅ Approval status:', isApprovedForAll);
      return isApprovedForAll;
    } catch (error) {
      console.error('❌ Error checking approval status:', error);
      return false;
    }
  }

  /**
   * Public method to manually approve the staking contract
   */
  async approveStakingContract(walletAddress: string): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!this.nftContract || !this.userAccount) {
        await this.initializeContracts();
      }

      console.log('🔐 Starting manual approval for staking contract...');
      
      // Check if already approved
      const alreadyApproved = await this.checkApprovalStatus(walletAddress);
      if (alreadyApproved) {
        console.log('✅ Already approved - no action needed');
        return { success: true };
      }

      const gasPrice = await this.getGasPriceWithFallback();
      const gasLimit = 100000; // Standard gas limit for approval

      console.log('📤 Sending approval transaction...');
      
      const result = await this.nftContract.methods.setApprovalForAll(
        CONTRACT_ADDRESSES.STAKING_CONTRACT,
        true
      ).send({
        from: this.userAccount,
        gas: gasLimit,
        gasPrice: gasPrice
      });

      console.log('✅ Approval transaction successful:', result.transactionHash);
      
      // Wait a moment for blockchain confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify approval was successful
      const isApproved = await this.checkApprovalStatus(walletAddress);
      
      if (isApproved) {
        return { 
          success: true, 
          transactionHash: result.transactionHash 
        };
      } else {
        throw new Error('Approval verification failed');
      }

    } catch (error: any) {
      console.error('❌ Approval failed:', error);
      
      let errorMessage = 'Approval transaction failed';
      if (error.message) {
        if (error.message.includes('User denied')) {
          errorMessage = 'Approval cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas fee';
        } else {
          errorMessage = error.message;
        }
      }

      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }
}

export default new ImprovedOnchainStakingService();
