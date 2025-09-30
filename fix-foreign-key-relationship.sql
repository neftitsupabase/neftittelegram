-- Fix foreign key relationship between nft_cid_distribution_log and nft_cid_pools
-- This will allow Supabase to perform the JOIN query properly

-- First, let's check if the foreign key constraint already exists
-- If it doesn't exist, we'll create it

-- Add foreign key constraint from nft_cid_distribution_log.cid to nft_cid_pools.cid
DO $$
BEGIN
    -- Check if the foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_distribution_log_cid_pools'
        AND table_name = 'nft_cid_distribution_log'
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE nft_cid_distribution_log 
        ADD CONSTRAINT fk_distribution_log_cid_pools 
        FOREIGN KEY (cid) REFERENCES nft_cid_pools(cid);
        
        RAISE NOTICE 'Foreign key constraint added successfully';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
END $$;

-- Create an index on the foreign key column for better performance
CREATE INDEX IF NOT EXISTS idx_distribution_log_cid_fk 
ON nft_cid_distribution_log(cid);

-- Verify the relationship was created
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'nft_cid_distribution_log';
