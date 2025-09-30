-- COMPREHENSIVE STAKING SCHEMA FIX
-- Adds ALL missing columns needed for complete staking functionality
-- Based on console errors: staked_neft, daily_rate, total_earned columns missing

-- =============================================================================
-- 1. ADD MISSING COLUMNS TO USER_BALANCES TABLE
-- =============================================================================

-- Add staked_neft column (needed for balance functions)
ALTER TABLE user_balances 
ADD COLUMN IF NOT EXISTS staked_neft DECIMAL(18,8) DEFAULT 0;

-- Add available_neft column if not exists (for staking balance tracking)
ALTER TABLE user_balances 
ADD COLUMN IF NOT EXISTS available_neft DECIMAL(18,8) DEFAULT 0;

-- Add total_nft_count column (needed for balance functions)
ALTER TABLE user_balances 
ADD COLUMN IF NOT EXISTS total_nft_count INTEGER DEFAULT 0;

-- =============================================================================
-- 2. ADD MISSING COLUMNS TO STAKED_NFTS TABLE
-- =============================================================================

-- Add daily_reward column (needed for older staking functions)
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS daily_reward DECIMAL(18,8) DEFAULT 5.0;

-- Add daily_rate column (needed for newer staking functions - CURRENT ERROR)
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(18,8) DEFAULT 5.0;

-- Add total_earned column (needed for unstake_nft function)
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(18,8) DEFAULT 0;

-- Add last_claim column (needed for reward tracking)
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS last_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fix nft_rarity column constraint (make it nullable or add default)
ALTER TABLE staked_nfts 
ALTER COLUMN nft_rarity DROP NOT NULL;

-- Fix daily_reward column constraint (make it nullable or add default)
ALTER TABLE staked_nfts 
ALTER COLUMN daily_reward DROP NOT NULL;

-- =============================================================================
-- 3. ADD MISSING COLUMNS TO STAKED_TOKENS TABLE
-- =============================================================================

-- Add total_earned column (needed for unstake_tokens function)  
ALTER TABLE staked_tokens 
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(18,8) DEFAULT 0;

-- Add last_claim column (needed for reward tracking)
ALTER TABLE staked_tokens 
ADD COLUMN IF NOT EXISTS last_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records with default values
UPDATE staked_nfts 
SET total_earned = 0 
WHERE total_earned IS NULL;

UPDATE staked_tokens 
SET total_earned = 0 
WHERE total_earned IS NULL;

-- =============================================================================
-- 2. VERIFY COLUMNS EXIST
-- =============================================================================

DO $$
DECLARE
    nft_column_exists BOOLEAN := FALSE;
    token_column_exists BOOLEAN := FALSE;
BEGIN
    -- Check if total_earned exists in staked_nfts
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staked_nfts' 
        AND column_name = 'total_earned'
    ) INTO nft_column_exists;
    
    -- Check if total_earned exists in staked_tokens
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staked_tokens' 
        AND column_name = 'total_earned'
    ) INTO token_column_exists;
    
    -- Report results
    RAISE NOTICE '';
    RAISE NOTICE '✅ TOTAL_EARNED COLUMN STATUS:';
    RAISE NOTICE '• staked_nfts.total_earned: %', CASE WHEN nft_column_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '• staked_tokens.total_earned: %', CASE WHEN token_column_exists THEN 'EXISTS' ELSE 'MISSING' END;
    
    IF nft_column_exists AND token_column_exists THEN
        RAISE NOTICE '✅ All required columns exist - unstaking functions should work now!';
    ELSE
        RAISE NOTICE '❌ Some columns still missing - check for errors above';
    END IF;
    RAISE NOTICE '';
END $$;

-- =============================================================================
-- 3. TEST THE FIX (OPTIONAL)
-- =============================================================================

-- Test that the columns can be accessed (this will fail if columns don't exist)
DO $$
DECLARE
    test_nft_earned DECIMAL(18,8);
    test_token_earned DECIMAL(18,8);
BEGIN
    -- Test accessing total_earned columns
    SELECT COALESCE(MAX(total_earned), 0) INTO test_nft_earned FROM staked_nfts;
    SELECT COALESCE(MAX(total_earned), 0) INTO test_token_earned FROM staked_tokens;
    
    RAISE NOTICE '✅ Column access test passed:';
    RAISE NOTICE '• Max NFT total_earned: %', test_nft_earned;
    RAISE NOTICE '• Max Token total_earned: %', test_token_earned;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Column access test failed: %', SQLERRM;
END $$;
