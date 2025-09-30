/**
 * NFT Approval Debug Script
 * Analyzes common NFT approval failure scenarios
 */

const { Web3 } = require('web3');

// Configuration
const CONFIG = {
  RPC_ENDPOINTS: [
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy-bor-rpc.publicnode.com',
    'https://rpc.ankr.com/polygon_amoy'
  ],
  NFT_CONTRACT: '0x5Bb23220cC12585264fCd144C448eF222c8572A2',
  STAKING_CONTRACT: '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e', // Replace with actual staking contract
  TEST_TOKEN_ID: '31', // Replace with actual token ID
  TEST_WALLET: '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4', // Replace with actual wallet address
};

// Minimal ERC721 ABI for testing
const ERC721_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {"internalType": "address", "name": "operator", "type": "address"}],
    "name": "isApprovedForAll",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "getApproved",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "operator", "type": "address"}, {"internalType": "bool", "name": "approved", "type": "bool"}],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

class NFTApprovalDebugger {
  constructor() {
    this.web3 = null;
    this.nftContract = null;
  }

  async initializeWeb3() {
    console.log('🔗 Testing RPC endpoints...');
    
    for (const rpcUrl of CONFIG.RPC_ENDPOINTS) {
      try {
        console.log(`Testing: ${rpcUrl}`);
        const web3 = new Web3(rpcUrl);
        
        // Test connection
        const blockNumber = await web3.eth.getBlockNumber();
        console.log(`✅ Connected to ${rpcUrl}, block: ${blockNumber}`);
        
        this.web3 = web3;
        this.nftContract = new web3.eth.Contract(ERC721_ABI, CONFIG.NFT_CONTRACT);
        return true;
      } catch (error) {
        console.log(`❌ Failed: ${rpcUrl} - ${error.message}`);
        continue;
      }
    }
    
    throw new Error('All RPC endpoints failed');
  }

  async debugApprovalIssues(walletAddress, tokenId) {
    console.log('\n🔍 === NFT APPROVAL DEBUG ANALYSIS ===\n');
    
    try {
      // 1. Check contract connectivity
      console.log('1️⃣ Testing contract connectivity...');
      const contractCode = await this.web3.eth.getCode(CONFIG.NFT_CONTRACT);
      if (contractCode === '0x') {
        console.error('❌ NFT contract not found at address:', CONFIG.NFT_CONTRACT);
        return;
      }
      console.log('✅ NFT contract exists');

      // 2. Check token ownership
      console.log('\n2️⃣ Checking token ownership...');
      try {
        const owner = await this.nftContract.methods.ownerOf(tokenId).call();
        console.log(`Token ${tokenId} owner: ${owner}`);
        console.log(`Provided wallet: ${walletAddress}`);
        
        if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
          console.error('❌ OWNERSHIP MISMATCH - This is likely the main issue!');
          console.error(`   Token is owned by: ${owner}`);
          console.error(`   But trying to approve from: ${walletAddress}`);
          return;
        }
        console.log('✅ Ownership verified');
      } catch (error) {
        console.error('❌ Failed to check ownership:', error.message);
        if (error.message.includes('nonexistent token')) {
          console.error('   Token does not exist!');
        }
        return;
      }

      // 3. Check current approval status
      console.log('\n3️⃣ Checking current approval status...');
      
      // Check isApprovedForAll
      try {
        const isApprovedForAll = await this.nftContract.methods.isApprovedForAll(
          walletAddress, 
          CONFIG.STAKING_CONTRACT
        ).call();
        console.log(`IsApprovedForAll: ${isApprovedForAll}`);
        
        if (isApprovedForAll) {
          console.log('✅ Already approved for all tokens - no approval needed');
          return;
        }
      } catch (error) {
        console.error('❌ Failed to check isApprovedForAll:', error.message);
      }

      // Check individual token approval
      try {
        const approvedAddress = await this.nftContract.methods.getApproved(tokenId).call();
        console.log(`Individual approval for token ${tokenId}: ${approvedAddress}`);
        
        if (approvedAddress.toLowerCase() === CONFIG.STAKING_CONTRACT.toLowerCase()) {
          console.log('✅ Token already individually approved');
          return;
        }
      } catch (error) {
        console.error('❌ Failed to check individual approval:', error.message);
      }

      // 4. Test gas estimation for approval
      console.log('\n4️⃣ Testing gas estimation for approval...');
      try {
        const gasEstimate = await this.nftContract.methods.setApprovalForAll(
          CONFIG.STAKING_CONTRACT,
          true
        ).estimateGas({ from: walletAddress });
        
        console.log(`✅ Gas estimate successful: ${gasEstimate}`);
        
        // Check if wallet has enough balance for gas
        const balance = await this.web3.eth.getBalance(walletAddress);
        const gasPrice = await this.web3.eth.getGasPrice();
        const gasCost = BigInt(gasEstimate) * BigInt(gasPrice);
        
        console.log(`Wallet balance: ${this.web3.utils.fromWei(balance, 'ether')} ETH`);
        console.log(`Estimated gas cost: ${this.web3.utils.fromWei(gasCost.toString(), 'ether')} ETH`);
        
        if (BigInt(balance) < gasCost) {
          console.error('❌ INSUFFICIENT FUNDS for gas fees!');
          console.error(`   Need: ${this.web3.utils.fromWei(gasCost.toString(), 'ether')} ETH`);
          console.error(`   Have: ${this.web3.utils.fromWei(balance, 'ether')} ETH`);
        } else {
          console.log('✅ Sufficient funds for gas');
        }
        
      } catch (error) {
        console.error('❌ Gas estimation failed:', error.message);
        
        if (error.message.includes('execution reverted')) {
          console.error('   Contract execution would revert - check contract state');
        }
        if (error.message.includes('insufficient funds')) {
          console.error('   Insufficient funds for gas');
        }
      }

      // 5. Check network and chain ID
      console.log('\n5️⃣ Checking network configuration...');
      const chainId = await this.web3.eth.getChainId();
      console.log(`Current chain ID: ${chainId}`);
      
      if (chainId !== 80002n) {
        console.error('❌ WRONG NETWORK!');
        console.error(`   Expected: 80002 (Polygon Amoy)`);
        console.error(`   Current: ${chainId}`);
      } else {
        console.log('✅ Correct network (Polygon Amoy)');
      }

    } catch (error) {
      console.error('❌ Debug analysis failed:', error.message);
    }
  }

  async runDiagnosis() {
    try {
      await this.initializeWeb3();
      
      // Use provided values or defaults
      const walletAddress = CONFIG.TEST_WALLET;
      const tokenId = CONFIG.TEST_TOKEN_ID;
      
      if (!walletAddress || walletAddress === '0x...') {
        console.error('❌ Please set TEST_WALLET in the config');
        return;
      }
      
      await this.debugApprovalIssues(walletAddress, tokenId);
      
    } catch (error) {
      console.error('❌ Diagnosis failed:', error.message);
    }
  }
}

// Export for use in other scripts
module.exports = NFTApprovalDebugger;

// Run if called directly
if (require.main === module) {
  console.log('🚀 Starting NFT Approval Debug Analysis...\n');
  
  const debugTool = new NFTApprovalDebugger();
  debugTool.runDiagnosis().then(() => {
    console.log('\n✅ Debug analysis complete');
  }).catch(error => {
    console.error('\n❌ Debug analysis failed:', error.message);
  });
}
