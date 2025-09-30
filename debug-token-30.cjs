const { Web3 } = require('web3');
const fs = require('fs');

const ERC721ABI = JSON.parse(fs.readFileSync('./src/abis/ERC721.json', 'utf8'));

async function debugToken30() {
  try {
    console.log('🔍 Debugging token ID 30 specifically...');
    
    const web3 = new Web3('https://rpc-amoy.polygon.technology/');
    const walletAddress = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4';
    const nftContractAddress = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';
    
    const nftContract = new web3.eth.Contract(ERC721ABI, nftContractAddress);
    
    console.log('👤 Wallet:', walletAddress);
    console.log('🎯 NFT Contract:', nftContractAddress);
    console.log('🔢 Testing Token ID: 30');
    
    // Test 1: Check if token 30 exists and who owns it
    try {
      const owner = await nftContract.methods.ownerOf(30).call();
      console.log('👤 Owner of token 30:', owner);
      console.log('✅ Your wallet owns token 30:', owner.toLowerCase() === walletAddress.toLowerCase());
      
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        console.log('❌ ISSUE: You do not own token ID 30!');
        console.log('   Expected owner:', walletAddress);
        console.log('   Actual owner:', owner);
        console.log('   This explains the staking failure');
      }
    } catch (error) {
      console.log('❌ Token 30 does not exist or error checking ownership:', error.message);
      console.log('   This explains the Internal JSON-RPC error');
    }
    
    // Test 2: Check what tokens you actually own
    console.log('\n🔍 Finding tokens you actually own...');
    const ownedTokens = [];
    
    try {
      const balance = await nftContract.methods.balanceOf(walletAddress).call();
      console.log('💰 Your NFT balance:', balance.toString());
      
      // Try to find owned tokens by checking common IDs
      for (let tokenId = 1; tokenId <= 100; tokenId++) {
        try {
          const owner = await nftContract.methods.ownerOf(tokenId).call();
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            ownedTokens.push(tokenId);
            console.log(`✅ You own token ID: ${tokenId}`);
            
            // Stop after finding a few to avoid too many calls
            if (ownedTokens.length >= 5) break;
          }
        } catch (e) {
          // Token doesn't exist, continue
        }
      }
      
    } catch (error) {
      console.log('❌ Error checking owned tokens:', error.message);
    }
    
    if (ownedTokens.length === 0) {
      console.log('⚠️ Could not find any owned tokens');
    } else {
      console.log(`\n✅ Tokens you actually own: [${ownedTokens.join(', ')}]`);
      console.log('\n🔧 Solution:');
      console.log('1. Your staking page is showing incorrect token IDs');
      console.log('2. The NFT with ID "onchain_30" should have token ID from your owned list');
      console.log('3. Check your NFTLifecycleService or claim data for token ID mismatch');
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

debugToken30();
