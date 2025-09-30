import { Web3 } from 'web3';

// Contract addresses
const STAKING_CONTRACT = '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e';
const NFT_CONTRACT = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';
const RPC_URL = 'https://rpc-amoy.polygon.technology';

// User details
const USER_ADDRESS = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';
const TOKEN_ID = 21;

// Simple ABIs for debugging
const NFT_ABI = [
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
  },
  {
    "inputs": [],
    "name": "stakingToken",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function debugStakeRevert() {
  console.log('🔍 Debugging stake transaction revert...');
  
  try {
    const web3 = new Web3(RPC_URL);
    
    // Initialize contracts
    const nftContract = new web3.eth.Contract(NFT_ABI, NFT_CONTRACT);
    const stakingContract = new web3.eth.Contract(STAKING_ABI, STAKING_CONTRACT);
    
    console.log('\n📋 Contract Configuration:');
    console.log('NFT Contract:', NFT_CONTRACT);
    console.log('Staking Contract:', STAKING_CONTRACT);
    console.log('User Address:', USER_ADDRESS);
    console.log('Token ID:', TOKEN_ID);
    
    // Check NFT ownership
    console.log('\n🔍 Checking NFT ownership...');
    const owner = await nftContract.methods.ownerOf(TOKEN_ID).call();
    console.log('Token', TOKEN_ID, 'owner:', owner);
    console.log('User owns token:', owner.toLowerCase() === USER_ADDRESS.toLowerCase());
    
    // Check approval
    console.log('\n🔍 Checking NFT approval...');
    const isApproved = await nftContract.methods.isApprovedForAll(USER_ADDRESS, STAKING_CONTRACT).call();
    console.log('Is approved for all:', isApproved);
    
    // Check staking contract configuration
    console.log('\n🔍 Checking staking contract configuration...');
    const stakingToken = await stakingContract.methods.stakingToken().call();
    console.log('Staking contract expects NFT:', stakingToken);
    console.log('Contract match:', stakingToken.toLowerCase() === NFT_CONTRACT.toLowerCase());
    
    // Check current staking status
    console.log('\n🔍 Checking current staking status...');
    const stakeInfo = await stakingContract.methods.getStakeInfo(USER_ADDRESS).call();
    console.log('Currently staked tokens:', stakeInfo[0]);
    console.log('Token', TOKEN_ID, 'already staked:', stakeInfo[0].includes(TOKEN_ID.toString()));
    
    // Check if token is staked by someone else
    console.log('\n🔍 Checking if token is staked by staking contract...');
    try {
      const currentOwner = await nftContract.methods.ownerOf(TOKEN_ID).call();
      if (currentOwner.toLowerCase() === STAKING_CONTRACT.toLowerCase()) {
        console.log('⚠️ Token', TOKEN_ID, 'is currently owned by staking contract (already staked by someone)');
      } else {
        console.log('✅ Token', TOKEN_ID, 'is not owned by staking contract');
      }
    } catch (error) {
      console.log('❌ Error checking token ownership:', error.message);
    }
    
    console.log('\n✅ Debug complete');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugStakeRevert();
