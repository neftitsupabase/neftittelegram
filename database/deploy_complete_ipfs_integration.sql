-- Complete IPFS Integration Deployment for NEFTIT Platform
-- This script integrates Pinata-only architecture with existing database
-- Updated to use Pinata exclusively for IPFS storage

-- Step 1: Create/Update main project with NFT.storage IPFS images
-- Use a specific UUID for consistent reference
DO $$
DECLARE
    main_project_id UUID := 'b5f6da7b-53b8-4bf7-9464-2def2bab609a'::UUID;
BEGIN
    INSERT INTO projects (
        id,
        title,
        description,
        collection_name,
        nft_images,
        created_at,
        updated_at
    ) VALUES (
        main_project_id,
        'NEFTIT Main NFT Collection',
        'Primary NFT collection with multiple rarity tiers stored on IPFS via NFT.storage',
        'NEFTIT Main Collection',
    '{
        "COMMON": [
            {
                "path": "/images/common1.jpg",
                "ipfs_hash": "QmW37FWsy7pKnZqRyeMS1MAA2hDDxRRkgh1aEpPZCqmJga",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmW37FWsy7pKnZqRyeMS1MAA2hDDxRRkgh1aEpPZCqmJga",
                "ipfs_gateway": "https://QmW37FWsy7pKnZqRyeMS1MAA2hDDxRRkgh1aEpPZCqmJga.ipfs.dweb.link"
            },
            {
                "path": "/images/common2.jpg",
                "ipfs_hash": "QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH",
                "ipfs_gateway": "https://QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH.ipfs.dweb.link"
            },
            {
                "path": "/images/common3.jpg",
                "ipfs_hash": "Qmax77GZCCXr939inoTgSmGex1YAr3EfeszY764YGajqtz",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/Qmax77GZCCXr939inoTgSmGex1YAr3EfeszY764YGajqtz",
                "ipfs_gateway": "https://Qmax77GZCCXr939inoTgSmGex1YAr3EfeszY764YGajqtz.ipfs.dweb.link"
            }
        ],
        "RARE": [
            {
                "path": "/images/Rare1.jpg",
                "ipfs_hash": "QmcZ1Xexgc3HMXLrfcFz4PX3EVpg57hYe1Z3zZu27b47Lz",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmcZ1Xexgc3HMXLrfcFz4PX3EVpg57hYe1Z3zZu27b47Lz",
                "ipfs_gateway": "https://QmcZ1Xexgc3HMXLrfcFz4PX3EVpg57hYe1Z3zZu27b47Lz.ipfs.dweb.link"
            },
            {
                "path": "/images/Rare2.jpg",
                "ipfs_hash": "QmaGMGwGTtPdvCa7aGZEwB2BMVvexuTGrn9qY1NYP85S2W",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmaGMGwGTtPdvCa7aGZEwB2BMVvexuTGrn9qY1NYP85S2W",
                "ipfs_gateway": "https://QmaGMGwGTtPdvCa7aGZEwB2BMVvexuTGrn9qY1NYP85S2W.ipfs.dweb.link"
            },
            {
                "path": "/images/Rare3.jpg",
                "ipfs_hash": "QmccGgVGC8HPGrwkeK52tyDGEdPYzWPdg18i7ykoH4ZHVa",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmccGgVGC8HPGrwkeK52tyDGEdPYzWPdg18i7ykoH4ZHVa",
                "ipfs_gateway": "https://QmccGgVGC8HPGrwkeK52tyDGEdPYzWPdg18i7ykoH4ZHVa.ipfs.dweb.link"
            }
        ],
        "LEGENDARY": [
            {
                "path": "/images/Legendary.jpg",
                "ipfs_hash": "QmYTuk9pB7uZMvcai694rFs5vQnDwU7uPQG4pTmLir8NyQ",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmYTuk9pB7uZMvcai694rFs5vQnDwU7uPQG4pTmLir8NyQ",
                "ipfs_gateway": "https://QmYTuk9pB7uZMvcai694rFs5vQnDwU7uPQG4pTmLir8NyQ.ipfs.dweb.link"
            }
        ],
        "PLATINUM": [
            {
                "path": "/images/Platinum.jpg",
                "ipfs_hash": "QmaKUg34wva83DEFHtwoBPjr1Rv8gnrN3R5fapXDs16D4C",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmaKUg34wva83DEFHtwoBPjr1Rv8gnrN3R5fapXDs16D4C",
                "ipfs_gateway": "https://QmaKUg34wva83DEFHtwoBPjr1Rv8gnrN3R5fapXDs16D4C.ipfs.dweb.link"
            }
        ],
        "SILVER": [
            {
                "path": "/images/Silver.jpg",
                "ipfs_hash": "QmfEK4YkTdxtw3pLnUYgKouQS25Yt97YZcJCPmkq58fKfS",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmfEK4YkTdxtw3pLnUYgKouQS25Yt97YZcJCPmkq58fKfS",
                "ipfs_gateway": "https://QmfEK4YkTdxtw3pLnUYgKouQS25Yt97YZcJCPmkq58fKfS.ipfs.dweb.link"
            }
        ],
        "GOLD": [
            {
                "path": "/images/Gold.jpg",
                "ipfs_hash": "QmfKKMC5UXXUJLX86nf3dcTdbwHTzRP3xa3c31kd9M96xq",
                "pinata_url": "https://gateway.pinata.cloud/ipfs/QmfKKMC5UXXUJLX86nf3dcTdbwHTzRP3xa3c31kd9M96xq",
                "ipfs_gateway": "https://QmfKKMC5UXXUJLX86nf3dcTdbwHTzRP3xa3c31kd9M96xq.ipfs.dweb.link"
            }
        ]
    }'::jsonb,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        nft_images = EXCLUDED.nft_images,
        updated_at = NOW();
        
    RAISE NOTICE 'Project created/updated with UUID: %', main_project_id;
END $$;

-- Step 2: Create helper function for NFT.storage-only architecture
CREATE OR REPLACE FUNCTION get_nft_image_for_rarity(
    project_id UUID,
    rarity TEXT,
    image_index INTEGER DEFAULT 0
) RETURNS TEXT AS $$
DECLARE
    images_array JSONB;
    selected_image JSONB;
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
    
    -- Return NFT.storage URL (primary) with fallback to IPFS gateway
    RETURN COALESCE(
        selected_image->>'nft_storage_url',
        selected_image->>'ipfs_gateway',
        selected_image->>'path'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Enhanced function with gateway preference for NFT.storage-only
CREATE OR REPLACE FUNCTION get_nft_image_for_rarity_enhanced(
    project_id UUID,
    rarity TEXT,
    image_index INTEGER DEFAULT 0,
    prefer_ipfs_gateway BOOLEAN DEFAULT false
) RETURNS TEXT AS $$
DECLARE
    images_array JSONB;
    selected_image JSONB;
    gateway_url TEXT;
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
    
    -- Choose gateway based on preference (NFT.storage vs IPFS gateway)
    IF prefer_ipfs_gateway AND selected_image ? 'ipfs_gateway' THEN
        gateway_url := selected_image->>'ipfs_gateway';
    ELSE
        gateway_url := selected_image->>'nft_storage_url';
    END IF;
    
    -- Fallback to any available URL if preferred not found
    IF gateway_url IS NULL THEN
        gateway_url := COALESCE(
            selected_image->>'nft_storage_url',
            selected_image->>'ipfs_gateway',
            selected_image->>'path'
        );
    END IF;
    
    RETURN gateway_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Update available NFT images function for NFT.storage
DROP FUNCTION IF EXISTS get_available_nft_images();
CREATE OR REPLACE FUNCTION get_available_nft_images()
RETURNS JSONB AS $$
BEGIN
    RETURN '{
        "common_collection": {
            "common1": "https://nftstorage.link/ipfs/QmW37FWsy7pKnZqRyeMS1MAA2hDDxRRkgh1aEpPZCqmJga",
            "common2": "https://nftstorage.link/ipfs/QmZHkTFU2LurmQLXEshuoSrbtpw2YFLu2MT2TweymaAKkH",
            "common3": "https://nftstorage.link/ipfs/Qmax77GZCCXr939inoTgSmGex1YAr3EfeszY764YGajqtz"
        },
        "rare_collection": {
            "rare1": "https://nftstorage.link/ipfs/QmcZ1Xexgc3HMXLrfcFz4PX3EVpg57hYe1Z3zZu27b47Lz",
            "rare2": "https://nftstorage.link/ipfs/QmaGMGwGTtPdvCa7aGZEwB2BMVvexuTGrn9qY1NYP85S2W",
            "rare3": "https://nftstorage.link/ipfs/QmccGgVGC8HPGrwkeK52tyDGEdPYzWPdg18i7ykoH4ZHVa"
        },
        "premium_collection": {
            "legendary": "https://nftstorage.link/ipfs/QmYTuk9pB7uZMvcai694rFs5vQnDwU7uPQG4pTmLir8NyQ",
            "platinum": "https://nftstorage.link/ipfs/QmaKUg34wva83DEFHtwoBPjr1Rv8gnrN3R5fapXDs16D4C",
            "silver": "https://nftstorage.link/ipfs/QmfEK4YkTdxtw3pLnUYgKouQS25Yt97YZcJCPmkq58fKfS",
            "gold": "https://nftstorage.link/ipfs/QmfKKMC5UXXUJLX86nf3dcTdbwHTzRP3xa3c31kd9M96xq"
        }
    }'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create performance index
CREATE INDEX IF NOT EXISTS idx_projects_nft_images ON projects USING GIN (nft_images);

-- Step 6: Add comments for documentation
COMMENT ON FUNCTION get_nft_image_for_rarity IS 'Helper function to retrieve NFT.storage IPFS URLs for NFT distribution based on rarity and index';
COMMENT ON FUNCTION get_nft_image_for_rarity_enhanced IS 'Enhanced function to retrieve IPFS URLs with gateway preference (NFT.storage for reliability, IPFS gateway for decentralization)';
COMMENT ON FUNCTION get_available_nft_images IS 'Returns all available NFT images with NFT.storage IPFS URLs for admin interface';

-- Step 7: Verification queries
SELECT 
    id,
    title,
    nft_images
FROM projects 
WHERE id = 'b5f6da7b-53b8-4bf7-9464-2def2bab609a'::UUID;

-- Test the helper functions
SELECT get_nft_image_for_rarity('b5f6da7b-53b8-4bf7-9464-2def2bab609a'::UUID, 'COMMON', 0) as common_image_nft_storage;
SELECT get_nft_image_for_rarity('b5f6da7b-53b8-4bf7-9464-2def2bab609a'::UUID, 'RARE', 1) as rare_image_nft_storage;
SELECT get_nft_image_for_rarity('b5f6da7b-53b8-4bf7-9464-2def2bab609a'::UUID, 'LEGENDARY', 0) as legendary_image_nft_storage;

-- Test enhanced function with different gateway preferences
SELECT get_nft_image_for_rarity_enhanced('b5f6da7b-53b8-4bf7-9464-2def2bab609a'::UUID, 'COMMON', 0, false) as nft_storage_url;
SELECT get_nft_image_for_rarity_enhanced('b5f6da7b-53b8-4bf7-9464-2def2bab609a'::UUID, 'COMMON', 0, true) as ipfs_gateway_url;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ NEFTIT IPFS Integration Deployment Complete!';
    RAISE NOTICE '🔗 All NFT images now stored on IPFS via NFT.storage';
    RAISE NOTICE '📊 Project "neftit_main_collection" updated with 10 IPFS images';
    RAISE NOTICE '🛠️ Helper functions created for campaign distribution';
    RAISE NOTICE '🚀 Ready for production NFT distribution!';
END $$;
