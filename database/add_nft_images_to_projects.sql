-- Add NFT Images Column to Projects Table for Manual Campaign NFT Control
-- This allows you to set different NFT images per rarity for each campaign/project

-- Add nft_images column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS nft_images JSONB DEFAULT '{
  "common": "/images/common2.jpg",
  "rare": "/images/Rare1.jpg", 
  "legendary": "/images/Legendary.jpg"
}';

-- Update existing projects with default NFT images (you can change these per project)
UPDATE projects 
SET nft_images = '{
  "common": "/images/common2.jpg",
  "rare": "/images/Rare1.jpg",
  "legendary": "/images/Legendary.jpg"
}'
WHERE nft_images IS NULL;

-- Example: Update specific project with custom NFT images
-- UPDATE projects 
-- SET nft_images = '{
--   "common": "/images/cybernetic-gorilla-fierce-futuristic-illustration_477639-6715.avif",
--   "rare": "/images/gradient-galaxy-background_52683-140335.avif",
--   "legendary": "/images/hidden-mining-concept-illustration_114360-29618.avif"
-- }'
-- WHERE id = 'your-project-id-here';

-- Add comment for clarity
COMMENT ON COLUMN projects.nft_images IS 'JSONB object containing NFT image URLs for each rarity tier (common, rare, legendary). Allows manual control over which images are distributed for each campaign.';
