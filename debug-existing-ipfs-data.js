// Debug script to check existing IPFS data for wallet
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugExistingIPFSData() {
  const walletAddress = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';
  
  console.log('🔍 Checking existing IPFS data for wallet:', walletAddress);
  
  try {
    // 1. Check Supabase mapping
    const { data: mappingData, error: mappingError } = await supabase
      .from('user_ipfs_mappings')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();
    
    if (mappingError) {
      console.error('❌ Supabase mapping error:', mappingError);
      return;
    }
    
    console.log('✅ Found IPFS mapping:', {
      wallet: mappingData.wallet_address,
      hash: mappingData.ipfs_hash,
      lastUpdated: mappingData.last_updated
    });
    
    // 2. Try to fetch IPFS content
    const ipfsHash = mappingData.ipfs_hash;
    const gateways = [
      `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
      `https://ipfs.io/ipfs/${ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
      `https://gateway.ipfs.io/ipfs/${ipfsHash}`
    ];
    
    console.log('🌐 Trying IPFS gateways...');
    
    for (const gateway of gateways) {
      try {
        console.log(`Trying: ${gateway}`);
        const response = await fetch(gateway, { 
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ IPFS content found:', {
            gateway: gateway,
            hasNFTs: data.nfts ? data.nfts.length : 0,
            structure: Object.keys(data)
          });
          
          // Check paginated storage
          if (data.pages && Array.isArray(data.pages)) {
            console.log('📄 Paginated storage detected:', {
              pageCount: data.pages.length,
              pages: data.pages
            });
            
            // Try to fetch first page
            if (data.pages.length > 0) {
              const firstPageHash = data.pages[0];
              console.log(`🔍 Fetching first page: ${firstPageHash}`);
              
              try {
                const pageResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${firstPageHash}`);
                if (pageResponse.ok) {
                  const pageData = await pageResponse.json();
                  console.log('📄 First page content:', {
                    hasNFTs: pageData.nfts ? pageData.nfts.length : 0,
                    structure: Object.keys(pageData)
                  });
                  
                  if (pageData.nfts && pageData.nfts.length > 0) {
                    console.log('🎨 Sample NFT from page:', {
                      id: pageData.nfts[0].id,
                      name: pageData.nfts[0].name,
                      rarity: pageData.nfts[0].rarity,
                      image: pageData.nfts[0].image
                    });
                  }
                }
              } catch (pageError) {
                console.log('❌ Error fetching page:', pageError.message);
              }
            }
          }
          
          if (data.nfts && data.nfts.length > 0) {
            console.log('🎨 Sample NFT:', {
              id: data.nfts[0].id,
              name: data.nfts[0].name,
              rarity: data.nfts[0].rarity,
              image: data.nfts[0].image
            });
          }
          break;
        } else {
          console.log(`❌ Failed: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Gateway error:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugExistingIPFSData();
