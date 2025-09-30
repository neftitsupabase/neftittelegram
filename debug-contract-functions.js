const Web3 = require('web3');
const NFTStakeABI = require('./src/abis/NFTStake.json');

async function debugContractFunctions() {
  try {
    console.log('🔍 Testing contract functions on Polygon Amoy...');
    
    // Initialize Web3 with Polygon Amoy RPC
    const web3 = new Web3('https://rpc-amoy.polygon.technology/');
    const stakingContract = new web3.eth.Contract(
      NFTStakeABI,
      '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e'
    );
    
    console.log('📍 Contract Address:', '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e');
    console.log('🌐 Network:', await web3.eth.getChainId());
    
    // Test wallet address (use a real wallet for testing)
    const testWallet = '0x742d35Cc6634C0532925a3b8D4C0C4c3e2f5d2d3'; // Your NFT contract address as test
    
    console.log('\n🧪 Testing contract functions...');
    
    // Test 1: Check if contract has code
    const code = await web3.eth.getCode('0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e');
    console.log('📄 Contract has code:', code !== '0x');
    
    // Test 2: List available methods
    console.log('\n📋 Available contract methods:');
    const methods = stakingContract.methods;
    Object.keys(methods).forEach(method => {
      if (typeof methods[method] === 'function') {
        console.log(`  - ${method}`);
      }
    });
    
    // Test 3: Try getStakeInfo function
    try {
      console.log('\n🔍 Testing getStakeInfo function...');
      const stakeInfo = await stakingContract.methods.getStakeInfo(testWallet).call();
      console.log('✅ getStakeInfo result:', stakeInfo);
    } catch (error) {
      console.log('❌ getStakeInfo failed:', error.message);
    }
    
    // Test 4: Try other common staking functions
    const functionsToTest = [
      'stakingToken',
      'rewardToken', 
      'getRewardTokensPerUnitTime',
      'getTimeUnit',
      'getStakeInfoForToken'
    ];
    
    for (const funcName of functionsToTest) {
      try {
        if (stakingContract.methods[funcName]) {
          console.log(`\n🔍 Testing ${funcName}...`);
          const result = await stakingContract.methods[funcName]().call();
          console.log(`✅ ${funcName} result:`, result);
        } else {
          console.log(`⚠️ Function ${funcName} not found in contract`);
        }
      } catch (error) {
        console.log(`❌ ${funcName} failed:`, error.message);
      }
    }
    
    // Test 5: Check if we can get basic contract info
    try {
      console.log('\n🔍 Testing basic contract info...');
      if (stakingContract.methods.stakingToken) {
        const stakingTokenAddr = await stakingContract.methods.stakingToken().call();
        console.log('✅ Staking token address:', stakingTokenAddr);
      }
    } catch (error) {
      console.log('❌ Basic info failed:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

debugContractFunctions();
