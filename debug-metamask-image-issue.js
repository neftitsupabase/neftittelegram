// Debug script to test MetaMask NFT image issues
// Run this in browser console to test image accessibility

async function debugMetaMaskImageIssue() {
  console.log("🔍 Debugging MetaMask NFT image display issue...");
  
  // Test common IPFS gateways
  const testGateways = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
    'https://nftstorage.link/ipfs/'
  ];
  
  // Example CID from your NFT (replace with actual CID)
  const testCID = "QmYourActualImageCID";
  
  console.log("Testing IPFS gateways for image accessibility...");
  
  for (const gateway of testGateways) {
    const imageURL = `${gateway}${testCID}`;
    
    try {
      console.log(`Testing: ${imageURL}`);
      
      // Test with fetch
      const response = await fetch(imageURL, { 
        method: 'HEAD',
        mode: 'cors'
      });
      
      if (response.ok) {
        console.log(`✅ ${gateway} - Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        console.log(`   Content-Length: ${response.headers.get('content-length')}`);
        console.log(`   Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin')}`);
      } else {
        console.log(`❌ ${gateway} - Status: ${response.status}`);
      }
      
      // Test with Image object (how MetaMask loads images)
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          console.log(`🖼️ ${gateway} - Image loads successfully (${img.width}x${img.height})`);
          resolve();
        };
        img.onerror = () => {
          console.log(`🚫 ${gateway} - Image load failed (CORS/Network issue)`);
          resolve();
        };
        img.src = imageURL;
        
        // Timeout after 5 seconds
        setTimeout(() => {
          console.log(`⏰ ${gateway} - Timeout`);
          resolve();
        }, 5000);
      });
      
    } catch (error) {
      console.log(`❌ ${gateway} - Error: ${error.message}`);
    }
    
    console.log("---");
  }
  
  // Test metadata accessibility
  console.log("\n🔍 Testing metadata accessibility...");
  
  // Get the actual token URI from contract (replace with your contract address and token ID)
  if (window.ethereum) {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractABI = [
        "function tokenURI(uint256 tokenId) view returns (string)"
      ];
      const contract = new ethers.Contract("0x5Bb23220cC12585264fCd144C448eF222c8572A2", contractABI, provider);
      
      // Replace with actual token ID
      const tokenId = 4; // From screenshot
      const tokenURI = await contract.tokenURI(tokenId);
      
      console.log(`📋 Token URI: ${tokenURI}`);
      
      // Fetch metadata
      const metadataResponse = await fetch(tokenURI);
      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        console.log("📄 Metadata:", metadata);
        
        // Test the image URL from metadata
        if (metadata.image) {
          console.log(`🖼️ Testing metadata image URL: ${metadata.image}`);
          
          const img = new Image();
          img.crossOrigin = "anonymous";
          
          await new Promise((resolve) => {
            img.onload = () => {
              console.log(`✅ Metadata image loads successfully (${img.width}x${img.height})`);
              resolve();
            };
            img.onerror = () => {
              console.log(`❌ Metadata image load failed - This is why MetaMask shows broken image`);
              resolve();
            };
            img.src = metadata.image;
            
            setTimeout(() => {
              console.log(`⏰ Metadata image test timeout`);
              resolve();
            }, 5000);
          });
        }
      } else {
        console.log(`❌ Failed to fetch metadata: ${metadataResponse.status}`);
      }
      
    } catch (error) {
      console.log(`❌ Contract interaction failed: ${error.message}`);
    }
  }
  
  console.log("\n🎯 Debug complete!");
}

// Run the debug
debugMetaMaskImageIssue();
