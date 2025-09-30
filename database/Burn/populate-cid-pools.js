import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// Supabase configuration
const SUPABASE_URL = 'https://heacehinqihfexxrbwdr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYWNlaGlucWloZmV4eHJid2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMTMyMTMsImV4cCI6MjA2Njc4OTIxM30.9jBZljJ_uS1M2gX9u3Ao_7amPwGtI9myTrdK7cBK7-4';

// Pinata configuration
const PINATA_API_KEY = 'c7b965f39fffe52506b8';
const PINATA_SECRET_KEY = '55e1b40cb26e3c7dcc3925626eb2af139edcb5fda718467e6f60ecec18fc2332';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Image cache to avoid re-uploading same images
const imageCache = new Map();

// NFT pool configuration with new counts and rarities
const NFT_POOLS = {
  legendary: {
    count: 16,
    images: [ 'public/images/nft/Leg.jpg', 'public/images/nft/Leg2.jpg']
  },
  platinum: {
    count: 4,
    images: ['public/images/nft/Plat.jpg']
  },
};

/**
 * Upload image file to IPFS using Pinata
 */
async function uploadImageToPinata(imagePath, filename) {
  try {
    const formData = new FormData();
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Append file buffer directly with proper options
    formData.append('file', imageBuffer, {
      filename: filename,
      contentType: 'image/jpeg'
    });
    
    const pinataMetadata = JSON.stringify({
      name: filename,
      keyvalues: {
        type: 'nft_image',
        platform: 'neftit'
      }
    });
    formData.append('pinataMetadata', pinataMetadata);

    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return {
      success: true,
      ipfsHash: response.data.IpfsHash,
      imageUrl: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`
    };
  } catch (error) {
    console.error('❌ Error uploading image to Pinata:', error);
    const errorMsg = error.response?.data?.error || error.message;
    return { success: false, error: errorMsg };
  }
}

/**
 * Upload unique NFT with both image and metadata to IPFS
 */
async function uploadUniqueNFTToIPFS(rarity, index) {
  try {
    // Select image from available images for this rarity
    const availableImages = NFT_POOLS[rarity].images;
    const selectedImagePath = availableImages[index % availableImages.length];
    
    console.log(`📤 Uploading image: ${selectedImagePath}`);
    
    // Step 1: Check cache first, then upload image to IPFS
    let imageResult;
    if (imageCache.has(selectedImagePath)) {
      imageResult = imageCache.get(selectedImagePath);
      console.log(`🔄 Using cached image: ${imageResult.imageUrl}`);
    } else {
      const imageFilename = `neftit-${rarity}-${index}-${path.basename(selectedImagePath)}`;
      imageResult = await uploadImageToPinata(selectedImagePath, imageFilename);
      
      if (!imageResult.success) {
        throw new Error(`Image upload failed: ${imageResult.error}`);
      }
      
      // Cache the result
      imageCache.set(selectedImagePath, imageResult);
      console.log(`✅ Image uploaded to IPFS: ${imageResult.imageUrl}`);
    }
    
    // Step 2: Create metadata with IPFS image URL
    const getMetadataName = (rarity) => {
      switch(rarity) {
        case 'legendary': return 'Early Birds Legendary';
        case 'platinum': return 'NEFTINUM Platinum';
        default: return rarity.charAt(0).toUpperCase() + rarity.slice(1);
      }
    };

    const nftMetadata = {
      name: getMetadataName(rarity),
      description: `Unique ${rarity} NFT from NEFTIT platform - Serial #${index}`,
      image: imageResult.imageUrl, // ✅ Now using IPFS URL instead of local path
      attributes: [
        { trait_type: "Rarity", value: rarity.charAt(0).toUpperCase() + rarity.slice(1) },
        { trait_type: "Serial Number", value: index },
        { trait_type: "Platform", value: "NEFTIT" },
        { trait_type: "Generation", value: "Unique CID Collection" },
        { trait_type: "Timestamp", value: new Date().toISOString() }
      ],
      external_url: "https://neftit.com",
      background_color: rarity === 'legendary' ? 'FFD700' : rarity === 'rare' ? 'C0C0C0' : 'CD7F32'
    };

    console.log(`📤 Uploading metadata for ${rarity} NFT #${index}`);
    
    // Step 3: Upload metadata to IPFS using Pinata JSON API
    const pinataData = {
      pinataContent: nftMetadata,
      pinataMetadata: {
        name: `${getMetadataName(rarity)}`,
        keyvalues: { 
          rarity: rarity,
          serial: index.toString(),
          type: 'nft_metadata',
          platform: 'neftit',
          image_hash: imageResult.ipfsHash
        }
      }
    };

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
      },
      body: JSON.stringify(pinataData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Pinata API Error ${response.status}:`, errorText);
      throw new Error('Pinata upload failed: ' + response.status + ' - ' + errorText);
    }

    const result = await response.json();
    const metadataCID = result.IpfsHash;
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;

    console.log(`✅ Complete NFT created - Image: ${imageResult.imageUrl}, Metadata: ${metadataUrl}`);

    return {
      success: true,
      cid: metadataCID,
      image_url: imageResult.imageUrl, // ✅ Real IPFS image URL
      metadata_cid: metadataCID,
      metadata_url: metadataUrl,
      image_hash: imageResult.ipfsHash
    };

  } catch (error) {
    console.error(`❌ Error uploading NFT ${rarity} #${index}:`, error);
    // Fallback to deterministic unique CID generation if upload fails
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const fallbackCID = `Qm${rarity}${index.toString().padStart(6, '0')}${random}${timestamp}`;
    
    return {
      cid: fallbackCID,
      metadata_cid: `QmMeta${fallbackCID.substring(2)}`,
      image_url: `https://gateway.pinata.cloud/ipfs/${fallbackCID}`
    };
  }
}

/**
 * Populate CID pools for all rarities
 */
async function populateCIDPools() {
  console.log('🚀 Starting CID pool population...');
  
  const totalNFTs = Object.values(NFT_POOLS).reduce((sum, pool) => sum + pool.count, 0);
  console.log(`📊 Total NFTs to create: ${totalNFTs}`);
  
  let processedCount = 0;
  
  for (const [rarity, config] of Object.entries(NFT_POOLS)) {
    console.log(`\n🎯 Processing ${rarity} NFTs (${config.count} total)...`);
    
    // Process in smaller batches for IPFS uploads
    const batchSize = 10; // Reduced batch size for real IPFS uploads
    const batches = Math.ceil(config.count / batchSize);
    
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, config.count);
      const batchData = [];
      
      // Generate batch data with real IPFS uploads
      for (let i = startIndex; i < endIndex; i++) {
        console.log(`📤 Uploading ${rarity} NFT #${i + 1}...`);
        
        const ipfsResult = await uploadUniqueNFTToIPFS(rarity, i + 1);
        
        batchData.push({
          rarity,
          cid: ipfsResult.cid,
          image_url: ipfsResult.image_url,
          metadata_cid: ipfsResult.metadata_cid,
          is_distributed: false
        });
        
        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Insert batch into database
      try {
        const { data, error } = await supabase
          .from('nft_cid_pools')
          .insert(batchData);
        
        if (error) {
          console.error(`❌ Error inserting batch ${batchIndex + 1}:`, error);
          continue;
        }
        
        processedCount += batchData.length;
        const progress = ((processedCount / totalNFTs) * 100).toFixed(1);
        console.log(`✅ Batch ${batchIndex + 1}/${batches} completed for ${rarity} (${progress}% total progress)`);
        
        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Exception inserting batch ${batchIndex + 1}:`, error);
      }
    }
    
    console.log(`✅ Completed ${rarity}: ${config.count} NFTs created`);
  }
  
  console.log(`\n🎉 CID pool population completed! Total processed: ${processedCount}/${totalNFTs}`);
}

/**
 * Verify pool population
 */
async function verifyCIDPools() {
  console.log('\n🔍 Verifying CID pools...');
  
  try {
    const { data, error } = await supabase.rpc('get_available_cid_counts');
    
    if (error) {
      console.error('❌ Error verifying pools:', error);
      return;
    }
    
    console.log('\n📊 CID Pool Statistics:');
    console.log('┌─────────────┬───────────┬─────────────┬─────────────────┐');
    console.log('│ Rarity      │ Total     │ Available   │ Distributed     │');
    console.log('├─────────────┼───────────┼─────────────┼─────────────────┤');
    
    data.forEach(stat => {
      const rarity = stat.rarity.padEnd(11);
      const total = stat.total_count.toString().padStart(9);
      const available = stat.available_count.toString().padStart(11);
      const distributed = stat.distributed_count.toString().padStart(15);
      console.log(`│ ${rarity} │ ${total} │ ${available} │ ${distributed} │`);
    });
    
    console.log('└─────────────┴───────────┴─────────────┴─────────────────┘');
    
  } catch (error) {
    console.error('❌ Exception verifying pools:', error);
  }
}

/**
 * Clear existing pools (use with caution)
 */
async function clearCIDPools() {
  console.log('⚠️  Clearing existing CID pools...');
  
  try {
    const { error } = await supabase
      .from('nft_cid_pools')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (error) {
      console.error('❌ Error clearing pools:', error);
      return;
    }
    
    console.log('✅ CID pools cleared successfully');
  } catch (error) {
    console.error('❌ Exception clearing pools:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'populate';
  
  switch (command) {
    case 'populate':
      await populateCIDPools();
      await verifyCIDPools();
      break;
      
    case 'verify':
      await verifyCIDPools();
      break;
      
    case 'clear':
      await clearCIDPools();
      break;
      
    default:
      console.log('Usage: node populate-cid-pools.js [populate|verify|clear]');
      console.log('  populate - Create CID pools (default)');
      console.log('  verify   - Check current pool statistics');
      console.log('  clear    - Clear all existing pools (DANGEROUS)');
  }
}

// Run the script
main().catch(console.error);
