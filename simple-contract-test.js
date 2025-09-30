// Simple contract test using fetch to check if contracts exist
import fetch from 'node-fetch';
const RPC_URL = 'https://80002.rpc.thirdweb.com/638c3db42b4a8608bf0181cc326ef233';
const STAKING_CONTRACT = '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e';
const NFT_CONTRACT = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';

async function testContracts() {
  console.log('🔍 Testing contract deployment...');
  
  // Test if contracts have code deployed
  const testContract = async (address, name) => {
    try {
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getCode',
          params: [address, 'latest'],
          id: 1
        })
      });
      
      const result = await response.json();
      const code = result.result;
      
      if (code === '0x' || code === '0x0') {
        console.log(`❌ ${name} (${address}): No contract deployed`);
        return false;
      } else {
        console.log(`✅ ${name} (${address}): Contract deployed (${code.length} bytes)`);
        return true;
      }
    } catch (error) {
      console.log(`❌ ${name} (${address}): Error - ${error.message}`);
      return false;
    }
  };
  
  // Test network connection
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1
      })
    });
    
    const result = await response.json();
    const chainId = parseInt(result.result, 16);
    console.log(`✅ Network connected: Chain ID ${chainId}`);
    
    if (chainId !== 80002) {
      console.log('⚠️  Warning: Expected Polygon Amoy (80002)');
    }
  } catch (error) {
    console.log('❌ Network connection failed:', error.message);
    return;
  }
  
  // Test contracts
  const stakingExists = await testContract(STAKING_CONTRACT, 'Staking Contract');
  const nftExists = await testContract(NFT_CONTRACT, 'NFT Contract');
  
  if (!stakingExists) {
    console.log('\n🚨 CRITICAL: Staking contract not deployed!');
    console.log('This explains the "Internal JSON-RPC error"');
    console.log('The contract address in .env may be incorrect or not deployed');
  }
  
  if (!nftExists) {
    console.log('\n🚨 CRITICAL: NFT contract not deployed!');
    console.log('This will cause ownership checks to fail');
  }
  
  if (stakingExists && nftExists) {
    console.log('\n✅ Both contracts are deployed and accessible');
    console.log('The issue may be with contract configuration or method calls');
  }
}

testContracts().catch(console.error);
