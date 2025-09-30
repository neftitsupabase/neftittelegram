// Debug script to test staking contract connectivity and configuration
import pkg from 'ethers';
const { ethers } = pkg;

// Contract addresses from .env
const STAKING_CONTRACT = '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e';
const NFT_CONTRACT = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';
const RPC_URL = 'https://80002.rpc.thirdweb.com/638c3db42b4a8608bf0181cc326ef233';

// Minimal ABIs for testing
const STAKING_ABI = [
  "function stakingToken() view returns (address)",
  "function rewardToken() view returns (address)",
  "function getStakeInfo(address) view returns (uint256[], uint256)",
  "function stake(uint256[] tokenIds)",
  "function withdraw(uint256[] tokenIds)"
];

const NFT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)"
];

async function debugContracts() {
  console.log('🔍 Starting contract debugging...');
  console.log('Staking Contract:', STAKING_CONTRACT);
  console.log('NFT Contract:', NFT_CONTRACT);
  console.log('RPC URL:', RPC_URL);
  
  try {
    // Test RPC connection
    console.log('\n📡 Testing RPC connection...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const network = await provider.getNetwork();
    console.log('✅ Network connected:', {
      chainId: network.chainId.toString(),
      name: network.name
    });
    
    // Test staking contract
    console.log('\n🏦 Testing staking contract...');
    const stakingContract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);
    
    try {
      const stakingToken = await stakingContract.stakingToken();
      console.log('✅ Staking contract accessible');
      console.log('   Configured NFT address:', stakingToken);
      console.log('   Expected NFT address:', NFT_CONTRACT);
      
      if (stakingToken.toLowerCase() !== NFT_CONTRACT.toLowerCase()) {
        console.log('⚠️  WARNING: Staking contract is configured for different NFT!');
        console.log('   This will cause staking to fail');
      } else {
        console.log('✅ NFT contract addresses match');
      }
      
      const rewardToken = await stakingContract.rewardToken();
      console.log('   Reward token:', rewardToken);
      
    } catch (error) {
      console.log('❌ Staking contract error:', error.message);
    }
    
    // Test NFT contract
    console.log('\n🖼️  Testing NFT contract...');
    const nftContract = new ethers.Contract(NFT_CONTRACT, NFT_ABI, provider);
    
    try {
      const name = await nftContract.name();
      const symbol = await nftContract.symbol();
      console.log('✅ NFT contract accessible');
      console.log('   Name:', name);
      console.log('   Symbol:', symbol);
    } catch (error) {
      console.log('❌ NFT contract error:', error.message);
    }
    
    // Test with a sample wallet (if provided)
    const testWallet = '0xe7c8b6180286abdb598f0f818f5fd5b4c42b9ac4'; // From error logs
    console.log('\n👤 Testing with sample wallet:', testWallet);
    
    try {
      const stakeInfo = await stakingContract.getStakeInfo(testWallet);
      console.log('✅ getStakeInfo works');
      console.log('   Staked tokens:', stakeInfo[0].map(t => t.toString()));
      console.log('   Rewards:', ethers.formatEther(stakeInfo[1]), 'ETH');
    } catch (error) {
      console.log('❌ getStakeInfo error:', error.message);
    }
    
    // Test token ownership (token 25 from error logs)
    try {
      const owner = await nftContract.ownerOf(25);
      console.log('✅ Token 25 owner:', owner);
      
      if (owner.toLowerCase() === testWallet.toLowerCase()) {
        console.log('✅ Test wallet owns token 25');
        
        // Check approval
        const isApproved = await nftContract.isApprovedForAll(testWallet, STAKING_CONTRACT);
        console.log('   Approved for staking:', isApproved);
      } else {
        console.log('❌ Test wallet does not own token 25');
      }
    } catch (error) {
      console.log('❌ Token ownership check failed:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Fatal error:', error.message);
  }
}

// Run the debug
debugContracts().catch(console.error);
