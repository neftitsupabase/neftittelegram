-- Database Functions Update for Pinata IPFS Integration
-- This script updates existing database functions to return Pinata IPFS URLs instead of local paths
-- and creates enhanced functions with Pinata gateway preference

-- Update the get_available_nft_images function to return IPFS URLs
CREATE OR REPLACE FUNCTION get_available_nft_images()
RETURNS JSONB AS $$
BEGIN
    RETURN '{
        "common_collection": {
            "common1": "https://gateway.pinata.cloud/ipfs/QmW37FWsy7pKnZqRyeMS1MAA2hDDxRRkgh1aEpPZCqmJga",
            "common2": "https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH",
            "common3": "https://gateway.pinata.cloud/ipfs/Qmax77GZCCXr939inoTgSmGex1YAr3EfeszY764YGajqtz"
        },
        "rare_collection": {
            "rare1": "https://gateway.pinata.cloud/ipfs/QmcZ1Xexgc3HMXLrfcFz4PX3EVpg57hYe1Z3zZu27b47Lz",
            "rare2": "https://gateway.pinata.cloud/ipfs/QmaGMGwGTtPdvCa7aGZEwB2BMVvexuTGrn9qY1NYP85S2W",
            "rare3": "https://gateway.pinata.cloud/ipfs/QmccGgVGC8HPGrwkeK52tyDGEdPYzWPdg18i7ykoH4ZHVa"
        },
        "premium_collection": {
            "legendary": "https://gateway.pinata.cloud/ipfs/QmYTuk9pB7uZMvcai694rFs5vQnDwU7uPQG4pTmLir8NyQ",
            "platinum": "https://gateway.pinata.cloud/ipfs/QmaKUg34wva83DEFHtwoBPjr1Rv8gnrN3R5fapXDs16D4C",
            "silver": "https://gateway.pinata.cloud/ipfs/QmfEK4YkTdxtw3pLnUYgKouQS25Yt97YZcJCPmkq58fKfS",
            "gold": "https://gateway.pinata.cloud/ipfs/QmfKKMC5UXXUJLX86nf3dcTdbwHTzRP3xa3c31kd9M96xq"
        }
    }'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to get IPFS URL with fallback to Pinata gateway
CREATE OR REPLACE FUNCTION get_nft_image_for_rarity_enhanced(
    project_id TEXT,
    rarity TEXT,
    image_index INTEGER DEFAULT 0,
    gateway_preference TEXT DEFAULT 'pinata'
) RETURNS TEXT AS $$
DECLARE
    images_array JSONB;
    selected_image JSONB;
    gateway_base_url TEXT;
BEGIN
    -- Get the images array for the specified rarity
    SELECT nft_images->rarity INTO images_array
    FROM projects 
    WHERE id = project_id;
    
    -- If no images found, return null
    IF images_array IS NULL OR jsonb_array_length(images_array) = 0 THEN
        RETURN NULL;
    END IF;
    
    -- Get the image at the specified index (or random if index >= array length)
    IF image_index >= jsonb_array_length(images_array) THEN
        image_index := floor(random() * jsonb_array_length(images_array))::INTEGER;
    END IF;
    
    selected_image := images_array->image_index;
    
    -- Choose gateway based on preference
    gateway_base_url := CASE 
        WHEN gateway_preference = 'pinata' THEN 'https://gateway.pinata.cloud/ipfs/'
        WHEN gateway_preference = 'dweb' THEN 'https://dweb.link/ipfs/'
        WHEN gateway_preference = 'nft_storage' THEN 'https://nftstorage.link/ipfs/'
        ELSE 'https://gateway.pinata.cloud/ipfs/' -- default to Pinata
    END;
    
    -- Fallback to any available URL if preferred not found
    RETURN COALESCE(
        gateway_base_url || selected_image->>'ipfs_hash',
        selected_image->>'pinata_gateway',
        selected_image->>'ipfs_gateway',
        selected_image->>'path'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing projects with default IPFS images if they don't have them
UPDATE projects 
SET default_ipfs_image = 'https://gateway.pinata.cloud/ipfs/QmW37FWsy7pKnZqRyeMS1MAA2hDDxRRkgh1aEpPZCqmJga'
WHERE default_ipfs_image IS NULL OR default_ipfs_image = '';

-- Update any existing NFT.storage URLs to Pinata URLs in projects table
UPDATE projects 
SET nft_images = replace(nft_images::text, 'https://nftstorage.link/ipfs/', 'https://gateway.pinata.cloud/ipfs/')::jsonb
WHERE nft_images::text LIKE '%nftstorage.link%';
        }
    ],
    "RARE": [
        {
            "path": "/images/Rare1.jpg",
            "ipfs_hash": "QmcZ1Xexgc3HMXLrfcFz4PX3EVpg57hYe1Z3zZu27b47Lz",
            "pinata_gateway": "https://gateway.pinata.cloud/ipfs/QmcZ1Xexgc3HMXLrfcFz4PX3EVpg57hYe1Z3zZu27b47Lz",
            "ipfs_gateway": "https://QmcZ1Xexgc3HMXLrfcFz4PX3EVpg57hYe1Z3zZu27b47Lz.ipfs.dweb.link"
        }
    ],
    "LEGENDARY": [
        {
            "path": "/images/Legendary.jpg",
            "ipfs_hash": "QmYTuk9pB7uZMvcai694rFs5vQnDwU7uPQG4pTmLir8NyQ",
            "pinata_gateway": "https://gateway.pinata.cloud/ipfs/QmYTuk9pB7uZMvcai694rFs5vQnDwU7uPQG4pTmLir8NyQ",
            "ipfs_gateway": "https://QmYTuk9pB7uZMvcai694rFs5vQnDwU7uPQG4pTmLir8NyQ.ipfs.dweb.link"
        }
    ]
}'::jsonb
WHERE nft_images IS NULL OR nft_images = '{}';

-- Test the enhanced function
SELECT get_nft_image_for_rarity_enhanced('neftit_main_collection', 'COMMON', 0, false) as pinata_url;
SELECT get_nft_image_for_rarity_enhanced('neftit_main_collection', 'COMMON', 0, true) as ipfs_url;

COMMENT ON FUNCTION get_nft_image_for_rarity_enhanced IS 'Enhanced function to retrieve IPFS URLs with gateway preference (Pinata for speed, IPFS for decentralization)';
COMMENT ON FUNCTION get_available_nft_images IS 'Returns all available NFT images with IPFS URLs for admin interface';
