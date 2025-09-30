-- Fix NFT Distribution Foreign Key Constraint Issue
-- This script addresses the foreign key constraint violation in nft_cid_distribution_log

-- First, let's check the current foreign key constraint
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'nft_cid_distribution_log';

-- Option 1: Temporarily drop the foreign key constraint to allow testing
-- This is the quickest fix for testing purposes
DO $$
BEGIN
    -- Drop the foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_nft_cid_distribution_log_wallet_address' 
        AND table_name = 'nft_cid_distribution_log'
    ) THEN
        ALTER TABLE nft_cid_distribution_log 
        DROP CONSTRAINT fk_nft_cid_distribution_log_wallet_address;
        RAISE NOTICE 'Dropped foreign key constraint fk_nft_cid_distribution_log_wallet_address';
    END IF;
END $$;

-- Option 2: Create a more flexible constraint that allows test data
-- Add the constraint back with DEFERRABLE option for testing
DO $$
BEGIN
    -- Add a more flexible foreign key constraint
    ALTER TABLE nft_cid_distribution_log 
    ADD CONSTRAINT fk_nft_cid_distribution_log_wallet_address 
    FOREIGN KEY (wallet_address) 
    REFERENCES users(wallet_address) 
    ON DELETE CASCADE 
    DEFERRABLE INITIALLY DEFERRED;
    
    RAISE NOTICE 'Added flexible foreign key constraint with DEFERRABLE option';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Foreign key constraint already exists';
END $$;

-- Create a function to safely insert test users
CREATE OR REPLACE FUNCTION ensure_test_user_exists(
    p_wallet_address VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
    user_exists BOOLEAN := FALSE;
BEGIN
    -- Check if user already exists
    SELECT EXISTS(
        SELECT 1 FROM users 
        WHERE wallet_address = LOWER(p_wallet_address)
    ) INTO user_exists;
    
    IF user_exists THEN
        RAISE NOTICE 'User already exists: %', p_wallet_address;
        RETURN TRUE;
    END IF;
    
    -- Create the user if it doesn't exist
    INSERT INTO users (
        wallet_address,
        display_name,
        provider,
        wallet_type,
        created_at,
        updated_at,
        last_login
    ) VALUES (
        LOWER(p_wallet_address),
        'Test_User_' || SUBSTRING(p_wallet_address FROM 1 FOR 8),
        'test',
        'test',
        NOW(),
        NOW(),
        NOW()
    ) ON CONFLICT (wallet_address) DO NOTHING;
    
    RAISE NOTICE 'Created test user: %', p_wallet_address;
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user %: %', p_wallet_address, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
