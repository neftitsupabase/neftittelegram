const { Web3 } = require('web3');
const fs = require('fs');

const ERC721ABI = JSON.parse(fs.readFileSync('./src/abis/ERC721.json', 'utf8'));

async function testNFTDisplay() {
  try {
    console.log('🔍 Testing NFT display for your wallet...');
    
    const web3 = new Web3('https://rpc-amoy.polygon.technology/');
    const walletAddress = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4';
    const nftContractAddress = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';
    
    const nftContract = new web3.eth.Contract(ERC721ABI, nftContractAddress);
    
    console.log('👤 Wallet:', walletAddress);
    console.log('🎯 NFT Contract:', nftContractAddress);
    
    // Test 1: Check current NFT balance
    try {
      const balance = await nftContract.methods.balanceOf(walletAddress).call();
      console.log('💰 Current NFT Balance:', balance.toString());
      
      if (balance == 0) {
        console.log('⚠️ No NFTs found in wallet');
        console.log('   This explains why staking failed - you need to claim NFTs first');
        return;
      }
      
      console.log(`✅ Found ${balance} NFT(s) in wallet!`);
      
    } catch (error) {
      console.log('❌ Balance check failed:', error.message);
      return;
    }
    
    // Test 2: Try to find token IDs owned by wallet
    console.log('\n🔍 Searching for owned token IDs...');
    const ownedTokens = [];
    
    try {
      const balance = await nftContract.methods.balanceOf(walletAddress).call();
      
      // Method 1: Try tokenOfOwnerByIndex if supported
      try {
        for (let i = 0; i < balance; i++) {
          const tokenId = await nftContract.methods.tokenOfOwnerByIndex(walletAddress, i).call();
          ownedTokens.push(tokenId.toString());
          console.log(`🎯 Found owned token ${i + 1}:`, tokenId.toString());
        }
      } catch (indexError) {
        console.log('❌ tokenOfOwnerByIndex not supported, trying alternative method...');
        
        // Method 2: Check common token IDs
        for (let tokenId = 1; tokenId <= 1000; tokenId++) {
          try {
            const owner = await nftContract.methods.ownerOf(tokenId).call();
            if (owner.toLowerCase() === walletAddress.toLowerCase()) {
              ownedTokens.push(tokenId.toString());
              console.log(`🎯 Found owned token:`, tokenId);
              
              // Limit to first 10 to avoid too many calls
              if (ownedTokens.length >= 10) break;
            }
          } catch (ownerError) {
            // Token doesn't exist or other error, continue
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Token search failed:', error.message);
    }
    
    if (ownedTokens.length === 0) {
      console.log('⚠️ Could not find any specific token IDs');
      console.log('   This might be a contract limitation, but balance shows NFTs exist');
    } else {
      console.log(`✅ Successfully found ${ownedTokens.length} owned token ID(s):`, ownedTokens);
    }
    
    // Test 3: Check if these NFTs should appear in staking page
    console.log('\n📊 Staking Page Analysis:');
    console.log('✅ MyNFTs page: Uses NFTLifecycleService to show offchain + onchain NFTs');
    console.log('✅ Staking page: Uses same NFTLifecycleService to load NFTs');
    console.log('✅ Onchain NFTs: Should appear with status="onchain" and claimed=true');
    
    if (ownedTokens.length > 0) {
      console.log('\n🎯 Expected Behavior:');
      console.log('1. Your claimed NFTs should appear in MyNFTs page under "On Blockchain" tab');
      console.log('2. Same NFTs should appear in Staking page as stakeable NFTs');
      console.log('3. When you click stake, it should use OnchainStakingService');
      console.log('4. NFTs should have status="onchain" and onChain=true properties');
      
      console.log('\n🔧 If NFTs not showing in staking page:');
      console.log('1. Check browser console for NFTLifecycleService errors');
      console.log('2. Verify NFT claims are stored in Supabase nft_claims table');
      console.log('3. Check if wallet address matches exactly');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testNFTDisplay();
