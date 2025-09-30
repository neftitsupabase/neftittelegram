-- Fix nft_cid_distribution_log table schema
-- Add missing distribution_type column required by execute_burn_transaction function

-- Add distribution_type column if it doesn't exist
DO $$
BEGIN
    -- Check if distribution_type column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'nft_cid_distribution_log' 
        AND column_name = 'distribution_type'
    ) THEN
        -- Add the missing column
        ALTER TABLE nft_cid_distribution_log 
        ADD COLUMN distribution_type VARCHAR(50) DEFAULT 'campaign_reward';
        
        RAISE NOTICE 'Added distribution_type column to nft_cid_distribution_log table';
    ELSE
        RAISE NOTICE 'distribution_type column already exists in nft_cid_distribution_log table';
    END IF;
END $$;

-- Update existing records to have a default distribution_type if they're NULL
UPDATE nft_cid_distribution_log 
SET distribution_type = 'campaign_reward' 
WHERE distribution_type IS NULL;

-- Add index for better performance on distribution_type queries
CREATE INDEX IF NOT EXISTS idx_distribution_log_type 
ON nft_cid_distribution_log(distribution_type);

-- Add check constraint to ensure valid distribution types
DO $$
BEGIN
    -- Drop constraint if it exists (in case we're re-running)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_distribution_type' 
        AND table_name = 'nft_cid_distribution_log'
    ) THEN
        ALTER TABLE nft_cid_distribution_log DROP CONSTRAINT chk_distribution_type;
    END IF;
    
    -- Add the constraint
    ALTER TABLE nft_cid_distribution_log 
    ADD CONSTRAINT chk_distribution_type 
    CHECK (distribution_type IN ('campaign_reward', 'burn_result', 'manual_distribution', 'airdrop'));
    
    RAISE NOTICE 'Added check constraint for distribution_type values';
END $$;

-- Verify the schema fix
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'nft_cid_distribution_log' 
ORDER BY ordinal_position;

COMMENT ON COLUMN nft_cid_distribution_log.distribution_type IS 'Type of distribution: campaign_reward, burn_result, manual_distribution, airdrop';
