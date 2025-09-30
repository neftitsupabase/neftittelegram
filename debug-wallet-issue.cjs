const { Web3 } = require('web3');
const fs = require('fs');

const NFTStakeABI = JSON.parse(fs.readFileSync('./src/abis/NFTStake.json', 'utf8'));
const ERC721ABI = JSON.parse(fs.readFileSync('./src/abis/ERC721.json', 'utf8'));

async function debugWalletIssue() {
  try {
    console.log('🔍 Debugging wallet-specific staking issue...');
    
    const web3 = new Web3('https://rpc-amoy.polygon.technology/');
    const walletAddress = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4';
    const nftContractAddress = '0x5Bb23220cC12585264fCd144C448eF222c8572A2';
    const stakingContractAddress = '0x1F2Dbf590b1c4C96c1ddb4FF55002Dbb33DA294e';
    
    const nftContract = new web3.eth.Contract(ERC721ABI, nftContractAddress);
    const stakingContract = new web3.eth.Contract(NFTStakeABI, stakingContractAddress);
    
    console.log('👤 Wallet:', walletAddress);
    console.log('🎯 NFT Contract:', nftContractAddress);
    console.log('📍 Staking Contract:', stakingContractAddress);
    
    // Test 1: Check if wallet owns any NFTs
    try {
      const balance = await nftContract.methods.balanceOf(walletAddress).call();
      console.log('💰 NFT Balance:', balance.toString());
      
      if (balance == 0) {
        console.log('⚠️ ISSUE: Wallet has no NFTs to stake!');
        console.log('   User needs to claim NFTs first before staking.');
        return;
      }
    } catch (error) {
      console.log('❌ Balance check failed:', error.message);
      return;
    }
    
    // Test 2: Try to get a token ID the wallet owns
    let ownedTokenId = null;
    try {
      // Try different methods to get token IDs
      const balance = await nftContract.methods.balanceOf(walletAddress).call();
      
      if (balance > 0) {
        try {
          // Method 1: tokenOfOwnerByIndex (if supported)
          ownedTokenId = await nftContract.methods.tokenOfOwnerByIndex(walletAddress, 0).call();
          console.log('🎯 Found owned token ID:', ownedTokenId.toString());
        } catch (e) {
          console.log('❌ tokenOfOwnerByIndex not supported:', e.message);
          
          // Method 2: Try common token IDs
          for (let i = 1; i <= 100; i++) {
            try {
              const owner = await nftContract.methods.ownerOf(i).call();
              if (owner.toLowerCase() === walletAddress.toLowerCase()) {
                ownedTokenId = i;
                console.log('🎯 Found owned token ID:', i);
                break;
              }
            } catch (ownerError) {
              // Token doesn't exist, continue
            }
          }
        }
      }
    } catch (error) {
      console.log('❌ Token ID lookup failed:', error.message);
    }
    
    if (!ownedTokenId) {
      console.log('⚠️ Could not find any owned token IDs');
      return;
    }
    
    // Test 3: Check if the specific token is already staked
    try {
      const formattedAddress = web3.utils.toChecksumAddress(walletAddress);
      console.log('🧪 Checking stake status for wallet:', formattedAddress);
      
      const stakeInfo = await stakingContract.methods.getStakeInfo(formattedAddress).call();
      console.log('📊 Current stake info:', stakeInfo);
      
      const stakedTokens = stakeInfo._tokensStaked || stakeInfo[0] || [];
      const isTokenStaked = stakedTokens.some(tokenId => tokenId.toString() === ownedTokenId.toString());
      
      console.log('🎯 Token', ownedTokenId, 'is already staked:', isTokenStaked);
      
      if (isTokenStaked) {
        console.log('⚠️ ISSUE: Token is already staked!');
        return;
      }
      
    } catch (error) {
      console.log('❌ getStakeInfo failed:', error.message);
      console.log('   This might be the root cause of the staking failure');
    }
    
    // Test 4: Check approval status
    try {
      const isApproved = await nftContract.methods.isApprovedForAll(walletAddress, stakingContractAddress).call();
      console.log('📝 Is approved for staking:', isApproved);
      
      if (!isApproved) {
        console.log('⚠️ ISSUE: Wallet not approved for staking');
        console.log('   Need to call setApprovalForAll first');
      }
    } catch (error) {
      console.log('❌ Approval check failed:', error.message);
    }
    
    // Test 5: Check staking contract configuration
    try {
      const stakingToken = await stakingContract.methods.stakingToken().call();
      console.log('🎯 Staking contract expects NFTs from:', stakingToken);
      
      if (stakingToken.toLowerCase() !== nftContractAddress.toLowerCase()) {
        console.log('⚠️ CRITICAL ISSUE: Contract address mismatch!');
        console.log('   Expected:', nftContractAddress);
        console.log('   Configured:', stakingToken);
      } else {
        console.log('✅ Contract addresses match correctly');
      }
    } catch (error) {
      console.log('❌ Staking token check failed:', error.message);
    }
    
    // Test 6: Try a simple stake simulation (read-only)
    try {
      console.log('🧪 Testing stake function signature...');
      // This should fail with a revert reason, not an RPC error
      await stakingContract.methods.stake([ownedTokenId]).call({ from: walletAddress });
      console.log('✅ Stake function call structure is valid');
    } catch (error) {
      console.log('❌ Stake simulation failed:', error.message);
      if (error.message.includes('Internal JSON-RPC error')) {
        console.log('🔍 This confirms the RPC error is in the stake function');
      }
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

debugWalletIssue();
