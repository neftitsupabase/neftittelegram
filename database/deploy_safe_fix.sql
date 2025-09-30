-- ============================================================================
-- DEPLOY SAFE STAKING COLUMNS FIX
-- Fixes missing database columns causing RPC function failures
-- ============================================================================

-- Step 1: Add missing columns to staked_nfts table
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS last_reward_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS staking_source TEXT DEFAULT 'offchain',
ADD COLUMN IF NOT EXISTS transaction_hash TEXT DEFAULT NULL;

-- Step 2: Add missing claim_type column to nft_claims table
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nft_claims') THEN
        ALTER TABLE nft_claims 
        ADD COLUMN IF NOT EXISTS claim_type TEXT DEFAULT 'manual';
    END IF;
END $$;

-- Step 3: Update existing records to maintain current behavior
UPDATE staked_nfts 
SET staking_source = 'offchain'
WHERE staking_source IS NULL;

UPDATE staked_nfts 
SET last_reward_calculated = COALESCE(staked_at, NOW())
WHERE last_reward_calculated IS NULL;

-- Step 4: Add constraint safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_staking_source' 
        AND table_name = 'staked_nfts'
    ) THEN
        ALTER TABLE staked_nfts 
        ADD CONSTRAINT chk_staking_source 
        CHECK (staking_source IN ('onchain', 'offchain'));
    END IF;
END $$;

-- Step 5: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_staked_nfts_source_wallet ON staked_nfts(staking_source, wallet_address);
CREATE INDEX IF NOT EXISTS idx_staked_nfts_transaction_hash ON staked_nfts(transaction_hash) WHERE transaction_hash IS NOT NULL;

-- Step 6: Fix get_staked_nfts_with_source function
CREATE OR REPLACE FUNCTION get_staked_nfts_with_source(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', id,
            'nft_id', nft_id,
            'wallet_address', wallet_address,
            'nft_rarity', nft_rarity,
            'daily_reward', daily_reward,
            'staked_at', staked_at,
            'last_reward_calculated', COALESCE(last_reward_calculated, staked_at, NOW()),
            'staking_source', COALESCE(staking_source, 'offchain'),
            'transaction_hash', transaction_hash,
            'stakingSource', COALESCE(staking_source, 'offchain')
        )
    )
    INTO result
    FROM staked_nfts
    WHERE wallet_address = user_wallet;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION get_staked_nfts_with_source(TEXT) TO anon, authenticated, service_role;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ SAFE DATABASE FIX COMPLETED';
    RAISE NOTICE '• Added missing columns with safe defaults';
    RAISE NOTICE '• Fixed claim_type column in nft_claims table';
    RAISE NOTICE '• Updated get_staked_nfts_with_source function';
    RAISE NOTICE '• All existing data preserved';
    RAISE NOTICE '• Ready for onchain staking integration';
END $$;
