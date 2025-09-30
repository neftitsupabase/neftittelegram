-- Add missing onchain tracking columns to user_nft_collections table
-- This must be run BEFORE deploying the onchain NFT tracking functions

-- Add onchain NFT count columns
ALTER TABLE user_nft_collections 
ADD COLUMN IF NOT EXISTS onchain_common_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onchain_rare_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onchain_legendary_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onchain_platinum_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onchain_silver_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onchain_gold_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onchain_staked_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_onchain_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add constraints to ensure non-negative values (using DO blocks for safe execution)
DO $$
BEGIN
    -- Add constraints only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_onchain_common_count_non_negative') THEN
        ALTER TABLE user_nft_collections ADD CONSTRAINT chk_onchain_common_count_non_negative CHECK (onchain_common_count >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_onchain_rare_count_non_negative') THEN
        ALTER TABLE user_nft_collections ADD CONSTRAINT chk_onchain_rare_count_non_negative CHECK (onchain_rare_count >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_onchain_legendary_count_non_negative') THEN
        ALTER TABLE user_nft_collections ADD CONSTRAINT chk_onchain_legendary_count_non_negative CHECK (onchain_legendary_count >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_onchain_platinum_count_non_negative') THEN
        ALTER TABLE user_nft_collections ADD CONSTRAINT chk_onchain_platinum_count_non_negative CHECK (onchain_platinum_count >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_onchain_silver_count_non_negative') THEN
        ALTER TABLE user_nft_collections ADD CONSTRAINT chk_onchain_silver_count_non_negative CHECK (onchain_silver_count >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_onchain_gold_count_non_negative') THEN
        ALTER TABLE user_nft_collections ADD CONSTRAINT chk_onchain_gold_count_non_negative CHECK (onchain_gold_count >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_onchain_staked_count_non_negative') THEN
        ALTER TABLE user_nft_collections ADD CONSTRAINT chk_onchain_staked_count_non_negative CHECK (onchain_staked_count >= 0);
    END IF;
END $$;

-- Create index for better performance on onchain sync timestamp
CREATE INDEX IF NOT EXISTS idx_user_nft_collections_onchain_sync 
ON user_nft_collections(last_onchain_sync);

-- Update existing records to have default values
UPDATE user_nft_collections 
SET 
  onchain_common_count = COALESCE(onchain_common_count, 0),
  onchain_rare_count = COALESCE(onchain_rare_count, 0),
  onchain_legendary_count = COALESCE(onchain_legendary_count, 0),
  onchain_platinum_count = COALESCE(onchain_platinum_count, 0),
  onchain_silver_count = COALESCE(onchain_silver_count, 0),
  onchain_gold_count = COALESCE(onchain_gold_count, 0),
  onchain_staked_count = COALESCE(onchain_staked_count, 0),
  last_onchain_sync = COALESCE(last_onchain_sync, NOW())
WHERE 
  onchain_common_count IS NULL OR
  onchain_rare_count IS NULL OR
  onchain_legendary_count IS NULL OR
  onchain_platinum_count IS NULL OR
  onchain_silver_count IS NULL OR
  onchain_gold_count IS NULL OR
  onchain_staked_count IS NULL OR
  last_onchain_sync IS NULL;
