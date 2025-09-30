-- =============================================================================
-- FIX STAKING SCHEMA - Add missing columns
-- =============================================================================

-- Check current table structure
SELECT 'Current staked_nfts columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'staked_nfts' 
ORDER BY ordinal_position;

-- Add missing columns to staked_nfts table
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(18,8) DEFAULT 5.0;

ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(18,8) DEFAULT 0;

ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS last_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS nft_name TEXT;

ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS nft_image TEXT;

-- Update existing records with default values
UPDATE staked_nfts 
SET daily_rate = 5.0 
WHERE daily_rate IS NULL;

UPDATE staked_nfts 
SET total_earned = 0 
WHERE total_earned IS NULL;

UPDATE staked_nfts 
SET last_claim = NOW() 
WHERE last_claim IS NULL;

-- Check updated table structure
SELECT 'Updated staked_nfts columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'staked_nfts' 
ORDER BY ordinal_position;

-- Test the staking function now
SELECT 'Testing staking function after schema fix:' as test;
