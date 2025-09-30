// Test script to run in browser console to test metadata fetching
// Copy and paste this into your browser console when the app is running

// Test the metadata fetching directly
async function testMetadataFetching() {
  console.log('🧪 Testing metadata fetching...');
  
  const metadataCid = 'QmVZxXBLQQp1i7cy8CE3drFANGCj88vFgFYPqfGtg4HZSu';
  const gateways = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/'
  ];
  
  for (const gateway of gateways) {
    try {
      const url = `${gateway}${metadataCid}`;
      console.log(`🌐 Testing: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`📊 Response status: ${response.status}`);
      
      if (response.ok) {
        const metadata = await response.json();
        console.log(`✅ Success with ${gateway}:`, metadata);
        
        // Test the specific data extraction
        console.log('📋 Extracted data:');
        console.log('Name:', metadata.name);
        console.log('Description:', metadata.description);
        console.log('Image:', metadata.image);
        console.log('Rarity from attributes:', metadata.attributes?.find(attr => attr.trait_type?.toLowerCase() === 'rarity')?.value);
        
        return metadata;
      }
    } catch (error) {
      console.error(`❌ Failed with ${gateway}:`, error);
    }
  }
  
  console.error('❌ All gateways failed');
  return null;
}

// Test the service method
async function testServiceMethod() {
  console.log('🧪 Testing service method...');
  
  try {
    // Get the service instance
    const { default: optimizedCIDPoolBurnService } = await import('./src/services/OptimizedCIDPoolBurnService.js');
    
    const metadataCid = 'QmVZxXBLQQp1i7cy8CE3drFANGCj88vFgFYPqfGtg4HZSu';
    const result = await optimizedCIDPoolBurnService.testMetadataFetch(metadataCid);
    
    console.log('🧪 Service test result:', result);
    return result;
  } catch (error) {
    console.error('❌ Service test failed:', error);
    return null;
  }
}

// Run the tests
console.log('🚀 Starting metadata fetch tests...');
console.log('Run testMetadataFetching() to test direct fetch');
console.log('Run testServiceMethod() to test service method');

// Auto-run the direct test
testMetadataFetching();
