const { Web3 } = require('web3');
const fs = require('fs');

const NFTStakeABI = JSON.parse(fs.readFileSync('./src/abis/NFTStake.json', 'utf8'));

async function testStakingConfig() {
  try {
    console.log('🔍 Testing staking contract configuration...');
    
    const web3 = new Web3('https://rpc-amoy.polygon.technology/');
    const stakingContract = new web3.eth.Contract(
      NFTStakeABI,
      '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e'
    );
    
    console.log('📍 Staking Contract:', '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e');
    console.log('🎯 NFT Contract:', '0x5Bb23220cC12585264fCd144C448eF222c8572A2');
    
    // Test basic contract functions
    try {
      const stakingToken = await stakingContract.methods.stakingToken().call();
      console.log('✅ Staking Token Address:', stakingToken);
      console.log('🔗 Matches NFT Contract:', stakingToken.toLowerCase() === '0x5Bb23220cC12585264fCd144C448eF222c8572A2'.toLowerCase());
      
      if (stakingToken.toLowerCase() !== '0x5Bb23220cC12585264fCd144C448eF222c8572A2'.toLowerCase()) {
        console.log('⚠️ MISMATCH: Staking contract expects different NFT contract!');
        console.log('   Expected:', '0x5Bb23220cC12585264fCd144C448eF222c8572A2');
        console.log('   Configured:', stakingToken);
      }
    } catch (error) {
      console.log('❌ Cannot get staking token:', error.message);
    }
    
    // Test reward token
    try {
      const rewardToken = await stakingContract.methods.rewardToken().call();
      console.log('💰 Reward Token Address:', rewardToken);
    } catch (error) {
      console.log('❌ Cannot get reward token:', error.message);
    }
    
    // Test time unit and rewards
    try {
      const timeUnit = await stakingContract.methods.getTimeUnit().call();
      const rewardsPerUnit = await stakingContract.methods.getRewardTokensPerUnitTime().call();
      console.log('⏰ Time Unit (seconds):', timeUnit);
      console.log('💎 Rewards per time unit:', web3.utils.fromWei(rewardsPerUnit, 'ether'), 'tokens');
    } catch (error) {
      console.log('❌ Cannot get reward info:', error.message);
    }
    
    // Test getStakeInfo with a dummy address
    try {
      const testAddress = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';
      const formattedAddress = web3.utils.toChecksumAddress(testAddress);
      console.log('🧪 Testing getStakeInfo with address:', formattedAddress);
      const stakeInfo = await stakingContract.methods.getStakeInfo(formattedAddress).call();
      console.log('📊 getStakeInfo test successful:', stakeInfo);
    } catch (error) {
      console.log('❌ getStakeInfo failed:');
      console.log('   Error message:', error.message);
      console.log('   Full error:', error);
      
      // Try alternative function names
      console.log('\n🔄 Trying alternative function names...');
      try {
        if (stakingContract.methods.getStakeInfoForToken) {
          const result = await stakingContract.methods.getStakeInfoForToken(1).call();
          console.log('✅ getStakeInfoForToken works:', result);
        }
      } catch (e) {
        console.log('❌ getStakeInfoForToken failed:', e.message);
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testStakingConfig();
