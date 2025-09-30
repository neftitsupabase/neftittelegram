// Test script to demonstrate metadata extraction from IPFS URL
// This simulates how your NFT metadata will be processed

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://4everland.io/ipfs/"
];

// Your example metadata URL and expected content
const metadataUrl = "https://ipfs.io/ipfs/QmVZxXBLQQp1i7cy8CE3drFANGCj88vFgFYPqfGtg4HZSu";
const expectedMetadata = {
  "name": "NEFTINUM Platinum",
  "description": "Unique platinum NFT from NEFTIT platform - Serial #4",
  "image": "https://gateway.pinata.cloud/ipfs/QmQLYmfbauDCRCEf1Xjdai4PTjh8RZ2qmeREaGdeZr9RdZ",
  "attributes": [
    {"trait_type": "Rarity", "value": "Platinum"},
    {"trait_type": "Serial Number", "value": 4},
    {"trait_type": "Platform", "value": "NEFTIT"},
    {"trait_type": "Generation", "value": "Unique CID Collection"},
    {"trait_type": "Timestamp", "value": "2025-09-13T12:52:48.932Z"}
  ],
  "external_url": "https://neftit.com",
  "background_color": "CD7F32"
};

// Simulate the fetchIPFSMetadata function
async function fetchIPFSMetadata(metadataCid) {
  console.log(`🔍 Fetching metadata from IPFS: ${metadataCid}`);
  
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const metadataUrl = `${gateway}${metadataCid}`;
      console.log(`🌐 Trying gateway: ${metadataUrl}`);
      
      // In real implementation, this would fetch from IPFS
      // For demo, we'll use the expected metadata
      const metadata = expectedMetadata;
      
      console.log(`✅ Successfully fetched metadata from ${gateway}:`, metadata);
      
      // Extract rarity from attributes if not in root
      let rarity = metadata.rarity;
      if (!rarity && metadata.attributes) {
        const rarityAttr = metadata.attributes.find(attr => 
          attr.trait_type?.toLowerCase() === 'rarity'
        );
        if (rarityAttr) {
          rarity = rarityAttr.value;
        }
      }
      
      return {
        name: metadata.name,
        description: metadata.description,
        image: metadata.image,
        attributes: metadata.attributes || [],
        rarity: rarity
      };
      
    } catch (error) {
      console.warn(`⚠️ Failed to fetch metadata from ${gateway}:`, error.message);
      continue;
    }
  }
  
  return null;
}

// Extract IPFS hash from URL
function extractIPFSHash(url) {
  const ipfsHashMatch = url.match(/Qm[1-9A-HJ-NP-Za-km-z]{44}/);
  return ipfsHashMatch ? ipfsHashMatch[0] : null;
}

// Get improved IPFS URL
function getIPFSUrl(hash) {
  return `${IPFS_GATEWAYS[0]}${hash}`;
}

// Simulate processing your NFT
async function processNFT() {
  console.log('🚀 Processing NFT with metadata URL:', metadataUrl);
  
  // Extract CID from the metadata URL
  const metadataCid = extractIPFSHash(metadataUrl);
  console.log('📋 Extracted metadata CID:', metadataCid);
  
  // Fetch metadata from IPFS
  const metadata = await fetchIPFSMetadata(metadataCid);
  
  if (metadata) {
    console.log('\n✅ EXTRACTED DATA:');
    console.log('Name:', metadata.name);
    console.log('Rarity:', metadata.rarity);
    console.log('Description:', metadata.description);
    console.log('Original Image URL:', metadata.image);
    
    // Update image URL to use improved gateway
    const imageHash = extractIPFSHash(metadata.image);
    const improvedImageUrl = getIPFSUrl(imageHash);
    console.log('Improved Image URL:', improvedImageUrl);
    
    console.log('\n🎯 FINAL NFT DATA:');
    const finalNFT = {
      name: metadata.name,
      description: metadata.description,
      image: improvedImageUrl,
      rarity: metadata.rarity,
      attributes: metadata.attributes,
      fallback_images: IPFS_GATEWAYS.map(gateway => `${gateway}${imageHash}`)
    };
    
    console.log(JSON.stringify(finalNFT, null, 2));
  } else {
    console.error('❌ Failed to fetch metadata');
  }
}

// Run the test
processNFT().catch(console.error);
