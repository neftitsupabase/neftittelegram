-- ============================================================================
-- SAFE STAKING COLUMNS FIX
-- Adds missing columns WITHOUT affecting existing offchain staking
-- ============================================================================

-- Step 1: Add columns with safe defaults
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS last_reward_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS staking_source TEXT DEFAULT 'offchain',  -- Default to offchain for existing records
ADD COLUMN IF NOT EXISTS transaction_hash TEXT DEFAULT NULL;

-- Step 2: Update existing records to maintain current behavior
UPDATE staked_nfts 
SET staking_source = 'offchain'
WHERE staking_source IS NULL;

-- Step 3: Only update last_reward_calculated if it's truly NULL and we have staked_at
UPDATE staked_nfts 
SET last_reward_calculated = COALESCE(staked_at, NOW())
WHERE last_reward_calculated IS NULL;

-- Step 4: Add constraint AFTER updating existing data
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_staking_source' 
        AND table_name = 'staked_nfts'
    ) THEN
        ALTER TABLE staked_nfts 
        ADD CONSTRAINT chk_staking_source 
        CHECK (staking_source IN ('onchain', 'offchain'));  -- Remove NULL option since we set defaults
    END IF;
END $$;

-- Step 5: Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_staked_nfts_source_wallet ON staked_nfts(staking_source, wallet_address);
CREATE INDEX IF NOT EXISTS idx_staked_nfts_transaction_hash ON staked_nfts(transaction_hash) WHERE transaction_hash IS NOT NULL;

-- Step 6: Create backward-compatible function that extends existing one
CREATE OR REPLACE FUNCTION get_user_staking_summary_with_source(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_summary JSON;
    onchain_count INTEGER := 0;
    offchain_count INTEGER := 0;
    result JSON;
BEGIN
    -- Get existing summary (preserves all current logic)
    SELECT get_user_staking_summary(user_wallet) INTO base_summary;
    
    -- Add source breakdown
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE staking_source = 'onchain'), 0),
        COALESCE(COUNT(*) FILTER (WHERE staking_source = 'offchain'), 0)
    INTO onchain_count, offchain_count
    FROM staked_nfts
    WHERE wallet_address = user_wallet;
    
    -- Merge with existing data
    SELECT json_build_object(
        'staked_nfts_count', COALESCE((base_summary->>'staked_nfts_count')::INTEGER, 0),
        'staked_tokens_amount', COALESCE((base_summary->>'staked_tokens_amount')::DECIMAL, 0),
        'daily_nft_rewards', COALESCE((base_summary->>'daily_nft_rewards')::DECIMAL, 0),
        'daily_token_rewards', COALESCE((base_summary->>'daily_token_rewards')::DECIMAL, 0),
        'total_pending_rewards', COALESCE((base_summary->>'total_pending_rewards')::DECIMAL, 0),
        'nft_pending_rewards', COALESCE((base_summary->>'nft_pending_rewards')::DECIMAL, 0),
        'token_pending_rewards', COALESCE((base_summary->>'token_pending_rewards')::DECIMAL, 0),
        'onchain_nfts_count', onchain_count,
        'offchain_nfts_count', offchain_count
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_staking_summary_with_source(TEXT) TO anon, authenticated, service_role;

-- Add comments
COMMENT ON COLUMN staked_nfts.last_reward_calculated IS 'Timestamp of last reward calculation for this staked NFT';
COMMENT ON COLUMN staked_nfts.staking_source IS 'Tracks whether NFT was staked onchain or offchain (default: offchain)';
COMMENT ON COLUMN staked_nfts.transaction_hash IS 'Blockchain transaction hash for onchain staking operations';

DO $$
BEGIN
    RAISE NOTICE '✅ SAFE MIGRATION COMPLETED';
    RAISE NOTICE '• Added columns with safe defaults (existing records = offchain)';
    RAISE NOTICE '• Preserved existing reward calculation timestamps';
    RAISE NOTICE '• Created get_user_staking_summary_with_source() for enhanced data';
    RAISE NOTICE '• Original get_user_staking_summary() unchanged';
    RAISE NOTICE '• All existing offchain staking functionality preserved';
END $$;
