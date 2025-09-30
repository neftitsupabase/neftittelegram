-- ============================================================================
-- FIX MISSING STAKING COLUMNS
-- Adds missing columns to resolve RPC function errors
-- ============================================================================

-- Add missing columns to staked_nfts table
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS last_reward_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS staking_source TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transaction_hash TEXT DEFAULT NULL;

-- Add missing columns to nft_claims table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nft_claims') THEN
        ALTER TABLE nft_claims 
        ADD COLUMN IF NOT EXISTS claim_type TEXT DEFAULT 'manual';
    END IF;
END $$;

-- Update existing records to have proper last_reward_calculated
UPDATE staked_nfts 
SET last_reward_calculated = staked_at 
WHERE last_reward_calculated IS NULL;

-- Add constraints and comments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_staking_source' 
        AND table_name = 'staked_nfts'
    ) THEN
        ALTER TABLE staked_nfts 
        ADD CONSTRAINT chk_staking_source 
        CHECK (staking_source IS NULL OR staking_source IN ('onchain', 'offchain'));
    END IF;
END $$;

COMMENT ON COLUMN staked_nfts.last_reward_calculated IS 'Timestamp of last reward calculation for this staked NFT';
COMMENT ON COLUMN staked_nfts.staking_source IS 'Tracks whether NFT was staked onchain (blockchain) or offchain (database only)';
COMMENT ON COLUMN staked_nfts.transaction_hash IS 'Blockchain transaction hash for onchain staking operations';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staked_nfts_last_reward ON staked_nfts(last_reward_calculated);
CREATE INDEX IF NOT EXISTS idx_staked_nfts_source_wallet ON staked_nfts(staking_source, wallet_address);
CREATE INDEX IF NOT EXISTS idx_staked_nfts_transaction_hash ON staked_nfts(transaction_hash) WHERE transaction_hash IS NOT NULL;

-- Update get_staked_nfts_with_source function to handle NULL values properly
CREATE OR REPLACE FUNCTION get_staked_nfts_with_source(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'nft_id', nft_id,
      'wallet_address', wallet_address,
      'nft_rarity', nft_rarity,
      'daily_reward', daily_reward,
      'staked_at', staked_at,
      'last_reward_calculated', COALESCE(last_reward_calculated, staked_at),
      'staking_source', COALESCE(staking_source, 'unknown'),
      'transaction_hash', transaction_hash
    )
  ), '[]'::json) INTO result
  FROM staked_nfts 
  WHERE wallet_address = user_wallet;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[]'::json;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_staked_nfts_with_source(TEXT) TO anon, authenticated, service_role;

-- Create enhanced get_user_staking_summary that handles missing columns gracefully
CREATE OR REPLACE FUNCTION get_user_staking_summary_enhanced(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    staked_nfts_count INTEGER := 0;
    staked_tokens_amount DECIMAL(18,8) := 0;
    daily_nft_rewards DECIMAL(18,8) := 0;
    daily_token_rewards DECIMAL(18,8) := 0;
    unclaimed_rewards DECIMAL(18,8) := 0;
    onchain_nfts_count INTEGER := 0;
    offchain_nfts_count INTEGER := 0;
    result JSON;
BEGIN
    -- Count staked NFTs and sum daily rewards
    SELECT 
        COALESCE(COUNT(*), 0),
        COALESCE(SUM(daily_reward), 0)
    INTO staked_nfts_count, daily_nft_rewards
    FROM staked_nfts
    WHERE wallet_address = user_wallet;
    
    -- Count by staking source
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE staking_source = 'onchain'), 0),
        COALESCE(COUNT(*) FILTER (WHERE staking_source = 'offchain'), 0)
    INTO onchain_nfts_count, offchain_nfts_count
    FROM staked_nfts
    WHERE wallet_address = user_wallet;
    
    -- Sum staked tokens and daily rewards
    SELECT 
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(daily_reward), 0)
    INTO staked_tokens_amount, daily_token_rewards
    FROM staked_tokens
    WHERE wallet_address = user_wallet;
    
    -- Sum unclaimed rewards (from low egress system)
    SELECT COALESCE(SUM(total_rewards), 0)
    INTO unclaimed_rewards
    FROM staking_rewards
    WHERE wallet_address = user_wallet AND claimed = FALSE;
    
    -- Build result JSON
    result := json_build_object(
        'staked_nfts_count', staked_nfts_count,
        'staked_tokens_amount', staked_tokens_amount,
        'daily_nft_rewards', daily_nft_rewards,
        'daily_token_rewards', daily_token_rewards,
        'total_daily_rewards', daily_nft_rewards + daily_token_rewards,
        'unclaimed_rewards', unclaimed_rewards,
        'onchain_nfts_count', onchain_nfts_count,
        'offchain_nfts_count', offchain_nfts_count
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'staked_nfts_count', 0,
            'staked_tokens_amount', 0,
            'daily_nft_rewards', 0,
            'daily_token_rewards', 0,
            'total_daily_rewards', 0,
            'unclaimed_rewards', 0,
            'onchain_nfts_count', 0,
            'offchain_nfts_count', 0,
            'error', SQLERRM
        );
END;
$$;

-- Grant permissions for enhanced function
GRANT EXECUTE ON FUNCTION get_user_staking_summary_enhanced(TEXT) TO anon, authenticated, service_role;

-- Create function to update last_reward_calculated when rewards are generated
CREATE OR REPLACE FUNCTION update_last_reward_calculated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update last_reward_calculated for NFTs when rewards are generated
    UPDATE staked_nfts 
    SET last_reward_calculated = NOW()
    WHERE wallet_address = NEW.wallet_address;
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically update last_reward_calculated
DROP TRIGGER IF EXISTS trigger_update_last_reward_calculated ON staking_rewards;
CREATE TRIGGER trigger_update_last_reward_calculated
    AFTER INSERT ON staking_rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_last_reward_calculated();

DO $$
BEGIN
    RAISE NOTICE '✅ MISSING STAKING COLUMNS FIXED:';
    RAISE NOTICE '• Added last_reward_calculated column to staked_nfts';
    RAISE NOTICE '• Added staking_source column to staked_nfts';
    RAISE NOTICE '• Added transaction_hash column to staked_nfts';
    RAISE NOTICE '• Added claim_type column to nft_claims (if exists)';
    RAISE NOTICE '• Updated get_staked_nfts_with_source() with NULL handling';
    RAISE NOTICE '• Created get_user_staking_summary_enhanced() with source breakdown';
    RAISE NOTICE '• Added trigger to update last_reward_calculated automatically';
    RAISE NOTICE '• Created proper indexes for performance';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 RPC FUNCTIONS NOW AVAILABLE:';
    RAISE NOTICE '• get_staked_nfts_with_source(wallet) - Returns staked NFTs with source info';
    RAISE NOTICE '• get_user_staking_summary_enhanced(wallet) - Enhanced summary with source breakdown';
END $$;
