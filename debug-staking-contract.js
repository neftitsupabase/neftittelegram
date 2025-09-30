// Simple debug script
async function debugStakingContract() {
  console.log('🔍 Debugging Staking Contract Configuration...');
  console.log('📍 Staking Contract: 0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e');
  console.log('📍 NFT Contract: 0x5Bb23220cC12585264fCd144C448eF222c8572A2');
  console.log('👤 User Wallet: 0xe7c8b6180286abdb598f0f818f5fd5b4c42b9ac4');
  console.log('🎯 Token ID: 25');
  console.log('');
  
  console.log('🎯 LIKELY ISSUES:');
  console.log('1. Staking contract may be configured for different NFT contract');
  console.log('2. Token ID 25 may not exist or not owned by user');
  console.log('3. NFT not approved for staking contract');
  console.log('4. Contract may have specific requirements (e.g., minimum staking period)');
  console.log('');
  
  console.log('💡 SOLUTIONS TO TRY:');
  console.log('1. Check if staking contract stakingToken() matches our NFT contract');
  console.log('2. Verify token 25 exists and is owned by user');
  console.log('3. Ensure NFT is approved for staking contract');
  console.log('4. Check contract events/logs for specific error messages');
}

debugStakingContract();
