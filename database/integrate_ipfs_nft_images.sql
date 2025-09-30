-- IPFS NFT Images Integration for NEFTIT Platform (Pinata)
-- This script updates the projects table with Pinata IPFS-hosted NFT images
-- and creates helper functions for retrieving Pinata IPFS URLs by rarity, let's create a sample project entry or update existing ones with the new IPFS image mapping
-- The nft_images column stores a JSON object mapping rarity levels to IPFS URLs

-- Update projects table with new IPFS image URLs
-- Replace 'your_project_id' with actual project ID or create new project entry

-- Example project update with new IPFS images
INSERT INTO projects (
    id,
    name,
    description,
    nft_images,
    created_at,
    updated_at
) VALUES (
    'neftit_main_collection',
    'NEFTIT Main NFT Collection',
    'Primary NFT collection with multiple rarity tiers stored on Pinata IPFS',
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

-- Alternative: Update existing project with new IPFS images
-- UPDATE projects 
-- SET nft_images = '{
--     "COMMON": [...],
--     "RARE": [...],
--     etc...
-- }'::jsonb,
-- updated_at = NOW()
-- WHERE id = 'your_existing_project_id';

-- Verify the integration
SELECT 
    id,
    name,
    nft_images
FROM projects 
WHERE id = 'neftit_main_collection';

-- Function to get IPFS URL for a specific rarity (helper for campaign distribution)
CREATE OR REPLACE FUNCTION get_nft_image_for_rarity(
    project_id TEXT,
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
    
    -- Return the Pinata gateway URL (fastest access)
    RETURN selected_image->>'pinata_gateway';
END;
$$ LANGUAGE plpgsql;

-- Test the helper function
SELECT get_nft_image_for_rarity('neftit_main_collection', 'COMMON', 0) as common_image;
SELECT get_nft_image_for_rarity('neftit_main_collection', 'RARE', 1) as rare_image;
SELECT get_nft_image_for_rarity('neftit_main_collection', 'LEGENDARY', 0) as legendary_image;

-- Create index for better performance on projects queries
CREATE INDEX IF NOT EXISTS idx_projects_nft_images ON projects USING GIN (nft_images);

COMMENT ON FUNCTION get_nft_image_for_rarity IS 'Helper function to retrieve IPFS URLs for NFT distribution based on rarity and index';
