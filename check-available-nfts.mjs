import { Web3 } from 'web3';

// Contract addresses
const STAKING_CONTRACT = '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e';
const NFT_CONTRACT = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';
const RPC_URL = 'https://rpc-amoy.polygon.technology';

// User details
const USER_ADDRESS = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

// NFT ABI for checking ownership and balance
const NFT_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {"internalType": "uint256", "name": "index", "type": "uint256"}],
    "name": "tokenOfOwnerByIndex",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
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
  }
];

// Staking ABI for checking staked tokens
const STAKING_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "_staker", "type": "address"}],
    "name": "getStakeInfo",
    "outputs": [
      {"internalType": "uint256[]", "name": "_tokensStaked", "type": "uint256[]"},
      {"internalType": "uint256", "name": "_rewards", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function checkAvailableNFTs() {
  console.log('🔍 Checking available NFTs for staking...');
  
  try {
    const web3 = new Web3(RPC_URL);
    
    // Initialize contracts
    const nftContract = new web3.eth.Contract(NFT_ABI, NFT_CONTRACT);
    const stakingContract = new web3.eth.Contract(STAKING_ABI, STAKING_CONTRACT);
    
    console.log('\n📋 User Information:');
    console.log('User Address:', USER_ADDRESS);
    console.log('NFT Contract:', NFT_CONTRACT);
    console.log('Staking Contract:', STAKING_CONTRACT);
    
    // Check user's NFT balance
    console.log('\n🔍 Checking NFT balance...');
    const balance = await nftContract.methods.balanceOf(USER_ADDRESS).call();
    console.log('Total NFTs owned by user:', balance.toString());
    
    if (balance === '0') {
      console.log('❌ User owns no NFTs from this contract');
      return;
    }
    
    // Get all owned token IDs
    console.log('\n📝 Fetching owned token IDs...');
    const ownedTokens = [];
    
    for (let i = 0; i < parseInt(balance); i++) {
      try {
        const tokenId = await nftContract.methods.tokenOfOwnerByIndex(USER_ADDRESS, i).call();
        ownedTokens.push(tokenId.toString());
      } catch (error) {
        console.log(`⚠️ Could not fetch token at index ${i}:`, error.message);
      }
    }
    
    console.log('Owned token IDs:', ownedTokens);
    
    // Check current staking status
    console.log('\n🔍 Checking current staking status...');
    const stakeInfo = await stakingContract.methods.getStakeInfo(USER_ADDRESS).call();
    const stakedTokens = stakeInfo[0].map(token => token.toString());
    console.log('Currently staked tokens:', stakedTokens);
    
    // Check approval status
    console.log('\n🔍 Checking approval status...');
    const isApproved = await nftContract.methods.isApprovedForAll(USER_ADDRESS, STAKING_CONTRACT).call();
    console.log('Approved for all:', isApproved);
    
    // Categorize tokens
    const availableForStaking = ownedTokens.filter(token => !stakedTokens.includes(token));
    const alreadyStaked = ownedTokens.filter(token => stakedTokens.includes(token));
    
    console.log('\n📊 Summary:');
    console.log('✅ Available for staking:', availableForStaking.length > 0 ? availableForStaking : 'None');
    console.log('🔒 Already staked:', alreadyStaked.length > 0 ? alreadyStaked : 'None');
    console.log('🔑 Approval needed:', !isApproved ? 'Yes' : 'No');
    
    if (availableForStaking.length > 0) {
      console.log('\n🎯 Recommended action:');
      console.log(`Try staking token ID: ${availableForStaking[0]}`);
      if (!isApproved) {
        console.log('⚠️ Remember to approve the staking contract first!');
      }
    } else if (alreadyStaked.length > 0) {
      console.log('\n🎯 Recommended action:');
      console.log(`Try unstaking token ID: ${alreadyStaked[0]}`);
    } else {
      console.log('\n❌ No NFTs available for testing');
    }
    
  } catch (error) {
    console.error('❌ Error checking NFTs:', error.message);
  }
}

checkAvailableNFTs();
