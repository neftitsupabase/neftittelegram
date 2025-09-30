-- ============================================================================
-- FIX PENDING REWARDS DISPLAY - Database vs UI Integration Issue
-- ============================================================================

-- Problem: Database stores nft_rewards and token_rewards separately in staking_rewards table
-- But UI calculates them proportionally from total unclaimed_rewards
-- This creates incorrect display of NFT vs Token pending rewards

-- Solution: Update get_user_staking_summary to return actual breakdown from staking_rewards table

DROP FUNCTION IF EXISTS get_user_staking_summary(TEXT);

CREATE FUNCTION get_user_staking_summary(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_unclaimed DECIMAL(18,8) := 0;
    nft_unclaimed DECIMAL(18,8) := 0;
    token_unclaimed DECIMAL(18,8) := 0;
BEGIN
    -- Get actual unclaimed rewards breakdown from staking_rewards table
    SELECT 
        COALESCE(SUM(total_rewards), 0),
        COALESCE(SUM(nft_rewards), 0),
        COALESCE(SUM(token_rewards), 0)
    INTO total_unclaimed, nft_unclaimed, token_unclaimed
    FROM staking_rewards 
    WHERE wallet_address = user_wallet AND claimed = FALSE;
    
    -- Build result with ACTUAL pending rewards from database
    SELECT json_build_object(
        'staked_nfts_count', COALESCE((SELECT COUNT(*) FROM staked_nfts WHERE wallet_address = user_wallet), 0),
        'staked_tokens_amount', COALESCE((SELECT SUM(amount) FROM staked_tokens WHERE wallet_address = user_wallet), 0),
        'daily_nft_rewards', COALESCE((SELECT SUM(daily_reward) FROM staked_nfts WHERE wallet_address = user_wallet), 0),
        'daily_token_rewards', COALESCE((SELECT SUM(daily_reward) FROM staked_tokens WHERE wallet_address = user_wallet), 0),
        'unclaimed_rewards', total_unclaimed,
        'nft_pending_rewards', nft_unclaimed,        -- ACTUAL NFT rewards from database
        'token_pending_rewards', token_unclaimed     -- ACTUAL token rewards from database
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_staking_summary(TEXT) TO authenticated, anon, public;

-- ============================================================================
-- UPDATE ENHANCED STAKING SERVICE TO USE DATABASE VALUES DIRECTLY
-- ============================================================================

-- The parseStakingSummary function should now use the database values directly
-- instead of calculating proportions

DO $$
BEGIN
    RAISE NOTICE '✅ Updated get_user_staking_summary to return ACTUAL pending rewards';
    RAISE NOTICE '✅ Database now returns:';
    RAISE NOTICE '   • nft_pending_rewards: Actual NFT rewards from staking_rewards table';
    RAISE NOTICE '   • token_pending_rewards: Actual token rewards from staking_rewards table';
    RAISE NOTICE '   • unclaimed_rewards: Total pending rewards';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 NEXT: Update EnhancedStakingService.parseStakingSummary()';
    RAISE NOTICE '   Remove proportional calculation and use database values directly';
END $$;
