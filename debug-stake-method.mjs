import Web3 from 'web3';
import fs from 'fs';

// Load environment variables
const CONTRACT_ADDRESSES = {
  NFT_CONTRACT: '0x742d35Cc6634C0532925a3b8D4C0C4c3e2f5d2d3',
  STAKING_CONTRACT: '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e'
};

const NETWORK_CONFIG = {
  CHAIN_ID: 80002,
  RPC_URLS: [
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy.drpc.org'
  ]
};

async function debugStakeMethod() {
  try {
    console.log('🔍 Testing stake method call...');
    
    // Initialize Web3 with MetaMask
    if (!globalThis.window?.ethereum) {
      console.log('❌ No MetaMask detected - using RPC for read-only testing');
      const web3 = new Web3(NETWORK_CONFIG.RPC_URLS[0]);
      
      // Load contract ABIs
      const nftABI = JSON.parse(fs.readFileSync('./src/abis/ERC721.json', 'utf8'));
      const stakingABI = JSON.parse(fs.readFileSync('./src/abis/NFTStake.json', 'utf8'));
      
      const stakingContract = new web3.eth.Contract(stakingABI, CONTRACT_ADDRESSES.STAKING_CONTRACT);
      
      // Test if we can call read methods
      console.log('📋 Testing read methods...');
      
      try {
        const stakingToken = await stakingContract.methods.stakingToken().call();
        console.log('✅ stakingToken():', stakingToken);
      } catch (error) {
        console.log('❌ stakingToken() failed:', error.message);
      }
      
      // Test method existence
      console.log('🔍 Available methods:');
      console.log('stake method exists:', typeof stakingContract.methods.stake === 'function');
      console.log('withdraw method exists:', typeof stakingContract.methods.withdraw === 'function');
      
      // Test method signature
      try {
        console.log('📋 Testing stake method signature...');
        const stakeMethod = stakingContract.methods.stake([1]);
        console.log('✅ Stake method created successfully');
        console.log('Method ABI:', stakeMethod._method);
      } catch (error) {
        console.log('❌ Stake method creation failed:', error.message);
      }
      
      return;
    }
    
    console.log('✅ MetaMask detected, testing with user wallet...');
    
    const web3 = new Web3(window.ethereum);
    
    // Check network
    const chainId = await web3.eth.getChainId();
    console.log('Current chain ID:', chainId);
    
    if (Number(chainId) !== NETWORK_CONFIG.CHAIN_ID) {
      console.log('❌ Wrong network. Expected:', NETWORK_CONFIG.CHAIN_ID, 'Got:', chainId);
      return;
    }
    
    // Get user account
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      console.log('❌ No accounts connected');
      return;
    }
    
    const userAccount = accounts[0];
    console.log('👤 User account:', userAccount);
    
    // Load contract ABIs
    const stakingABI = JSON.parse(fs.readFileSync('./src/abis/NFTStake.json', 'utf8'));
    const stakingContract = new web3.eth.Contract(stakingABI, CONTRACT_ADDRESSES.STAKING_CONTRACT);
    
    // Test basic contract connectivity
    try {
      const stakingToken = await stakingContract.methods.stakingToken().call();
      console.log('✅ Contract connectivity verified. Staking token:', stakingToken);
    } catch (error) {
      console.log('❌ Contract connectivity failed:', error.message);
      return;
    }
    
    // Test stake method with dry run
    console.log('🧪 Testing stake method (dry run)...');
    
    try {
      // Test with a sample token ID
      const testTokenId = 1;
      
      // Estimate gas for the transaction
      const gasEstimate = await stakingContract.methods.stake([testTokenId]).estimateGas({
        from: userAccount
      });
      
      console.log('✅ Gas estimate successful:', gasEstimate);
      
      // Test the actual method call (this will fail if not approved, but we can see the error)
      try {
        const result = await stakingContract.methods.stake([testTokenId]).call({
          from: userAccount
        });
        console.log('✅ Stake method call successful (dry run):', result);
      } catch (callError) {
        console.log('⚠️ Stake method call failed (expected if not approved):', callError.message);
        
        // Check if it's an approval issue
        if (callError.message.includes('ERC721: caller is not token owner or approved')) {
          console.log('💡 This is likely an approval issue - the method signature is correct');
        } else if (callError.message.includes('ERC721: invalid token ID')) {
          console.log('💡 Token ID does not exist - method signature is correct');
        } else {
          console.log('❌ Unexpected error - may indicate method signature issue');
        }
      }
      
    } catch (estimateError) {
      console.log('❌ Gas estimation failed:', estimateError.message);
      
      // This could indicate a method signature issue
      if (estimateError.message.includes('execution reverted')) {
        console.log('💡 Method exists but execution reverted - likely approval or ownership issue');
      } else if (estimateError.message.includes('method not found')) {
        console.log('💡 Method signature issue - stake method not found or wrong parameters');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
  }
}

// Run the debug test
debugStakeMethod().catch(console.error);
