// Test script to demonstrate IPFS URL updating
import { updateNFTMetadataIPFS, extractIPFSHash, updateIPFSUrl } from './src/config/ipfsConfig.js';

// Your example metadata
const exampleMetadata = {
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

console.log('🔍 Original metadata:');
console.log('Image URL:', exampleMetadata.image);

// Extract IPFS hash
const ipfsHash = extractIPFSHash(exampleMetadata.image);
console.log('📋 Extracted IPFS hash:', ipfsHash);

// Update the image URL
const updatedImageUrl = updateIPFSUrl(exampleMetadata.image);
console.log('🔄 Updated image URL:', updatedImageUrl);

// Update entire metadata object
const updatedMetadata = updateNFTMetadataIPFS(exampleMetadata);
console.log('✅ Updated metadata:');
console.log(JSON.stringify(updatedMetadata, null, 2));
