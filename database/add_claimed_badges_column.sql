-- Add claimed_badges column to users table
-- This script adds a JSONB column to store user's claimed badges

-- Check if the column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'claimed_badges'
    ) THEN
        -- Add the claimed_badges column
        ALTER TABLE users 
        ADD COLUMN claimed_badges JSONB DEFAULT '[]'::jsonb;
        
        -- Create an index for better performance
        CREATE INDEX IF NOT EXISTS idx_users_claimed_badges 
        ON users USING GIN(claimed_badges);
        
        RAISE NOTICE '✅ Successfully added claimed_badges column to users table';
    ELSE
        RAISE NOTICE 'ℹ️ claimed_badges column already exists in users table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'claimed_badges';

-- Show sample data structure
SELECT 
    wallet_address,
    claimed_badges,
    CASE 
        WHEN claimed_badges IS NULL THEN 'NULL'
        WHEN jsonb_array_length(claimed_badges) = 0 THEN 'Empty array []'
        ELSE 'Has badges: ' || jsonb_array_length(claimed_badges) || ' items'
    END as badge_status
FROM users 
LIMIT 5;
