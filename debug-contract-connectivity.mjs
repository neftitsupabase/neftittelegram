// Debug script to test contract connectivity and identify RPC issues
import { Web3 } from 'web3';

// Contract addresses from your config
const CONTRACT_ADDRESSES = {
  NFT_CONTRACT: '0x5Bb23220cC12585264fCd144C448eF222c8572A2',
  STAKING_CONTRACT: '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e',
};

// Basic ERC721 ABI for testing
const ERC721_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function debugContractConnectivity() {
  console.log('🔍 Starting contract connectivity debug...\n');
  
  const rpcEndpoints = [
    'https://rpc-amoy.polygon.technology/',
    'https://polygon-amoy.drpc.org',
    'https://80002.rpc.thirdweb.com/demo'
  ];
  
  for (const rpcUrl of rpcEndpoints) {
    console.log(`\n📡 Testing RPC endpoint: ${rpcUrl}`);
    
    try {
      const web3 = new Web3(rpcUrl);
      
      // Test basic connectivity
      const blockNumber = await web3.eth.getBlockNumber();
      console.log(`✅ Connected - Latest block: ${blockNumber}`);
      
      // Test contract existence
      const nftContract = new web3.eth.Contract(ERC721_ABI, CONTRACT_ADDRESSES.NFT_CONTRACT);
      
      try {
        const totalSupply = await nftContract.methods.totalSupply().call();
        console.log(`✅ NFT Contract responsive - Total supply: ${totalSupply}`);
        
        // Test specific token (31 from your logs)
        try {
          const owner = await nftContract.methods.ownerOf(31).call();
          console.log(`✅ Token 31 owner: ${owner}`);
        } catch (tokenError) {
          console.log(`⚠️ Token 31 not found: ${tokenError.message}`);
        }
        
      } catch (contractError) {
        console.log(`❌ NFT Contract error: ${contractError.message}`);
      }
      
    } catch (rpcError) {
      console.log(`❌ RPC Error: ${rpcError.message}`);
    }
  }
}

debugContractConnectivity().catch(console.error);
