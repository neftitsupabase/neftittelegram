-- DEBUG PENDING REWARDS MISMATCH
-- Helps identify why UI shows pending rewards but database returns NO_REWARDS_AVAILABLE

-- =============================================================================
-- COMPREHENSIVE DEBUG FUNCTION FOR PENDING REWARDS MISMATCH
-- =============================================================================

CREATE OR REPLACE FUNCTION debug_pending_rewards_mismatch(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    -- Staked assets
    staked_nfts_count INTEGER := 0;
    staked_tokens_amount DECIMAL(18,8) := 0;
    
    -- Reward records
    total_reward_records INTEGER := 0;
    nft_reward_records INTEGER := 0;
    token_reward_records INTEGER := 0;
    unclaimed_nft_records INTEGER := 0;
    unclaimed_token_records INTEGER := 0;
    
    -- Calculated vs actual rewards
    calculated_nft_rewards DECIMAL(18,8) := 0;
    calculated_token_rewards DECIMAL(18,8) := 0;
    actual_nft_rewards DECIMAL(18,8) := 0;
    actual_token_rewards DECIMAL(18,8) := 0;
    
    -- Daily rates
    total_nft_daily_rate DECIMAL(18,8) := 0;
    total_token_daily_rate DECIMAL(18,8) := 0;
    
    -- Staking summary from function
    summary_result JSON;
BEGIN
    -- Get staked assets count
    SELECT COUNT(*) INTO staked_nfts_count FROM staked_nfts WHERE wallet_address = user_wallet;
    SELECT COALESCE(SUM(amount), 0) INTO staked_tokens_amount FROM staked_tokens WHERE wallet_address = user_wallet;
    
    -- Get daily rates
    SELECT COALESCE(SUM(daily_reward), 0) INTO total_nft_daily_rate FROM staked_nfts WHERE wallet_address = user_wallet;
    SELECT COALESCE(SUM(daily_reward), 0) INTO total_token_daily_rate FROM staked_tokens WHERE wallet_address = user_wallet;
    
    -- Get reward records count
    SELECT COUNT(*) INTO total_reward_records FROM staking_rewards WHERE wallet_address = user_wallet;
    SELECT COUNT(*) INTO nft_reward_records FROM staking_rewards WHERE wallet_address = user_wallet AND reward_type = 'nft_staking';
    SELECT COUNT(*) INTO token_reward_records FROM staking_rewards WHERE wallet_address = user_wallet AND reward_type = 'token_staking';
    SELECT COUNT(*) INTO unclaimed_nft_records FROM staking_rewards WHERE wallet_address = user_wallet AND reward_type = 'nft_staking' AND is_claimed = FALSE;
    SELECT COUNT(*) INTO unclaimed_token_records FROM staking_rewards WHERE wallet_address = user_wallet AND reward_type = 'token_staking' AND is_claimed = FALSE;
    
    -- Get actual unclaimed rewards from database
    SELECT COALESCE(SUM(reward_amount), 0) INTO actual_nft_rewards 
    FROM staking_rewards 
    WHERE wallet_address = user_wallet AND reward_type = 'nft_staking' AND is_claimed = FALSE;
    
    SELECT COALESCE(SUM(reward_amount), 0) INTO actual_token_rewards 
    FROM staking_rewards 
    WHERE wallet_address = user_wallet AND reward_type = 'token_staking' AND is_claimed = FALSE;
    
    -- Calculate what rewards SHOULD be (estimated based on time)
    -- This is a simplified calculation - actual calculation may be more complex
    calculated_nft_rewards := total_nft_daily_rate; -- Assuming 1 day worth
    calculated_token_rewards := total_token_daily_rate; -- Assuming 1 day worth
    
    -- Get staking summary from the actual function
    SELECT get_user_staking_summary(user_wallet) INTO summary_result;
    
    -- Build comprehensive debug result
    SELECT json_build_object(
        'wallet_address', user_wallet,
        'debug_timestamp', NOW(),
        'staked_assets', json_build_object(
            'nfts_count', staked_nfts_count,
            'tokens_amount', staked_tokens_amount,
            'nft_daily_rate', total_nft_daily_rate,
            'token_daily_rate', total_token_daily_rate
        ),
        'reward_records', json_build_object(
            'total_records', total_reward_records,
            'nft_records', nft_reward_records,
            'token_records', token_reward_records,
            'unclaimed_nft_records', unclaimed_nft_records,
            'unclaimed_token_records', unclaimed_token_records
        ),
        'rewards_comparison', json_build_object(
            'actual_nft_rewards', actual_nft_rewards,
            'actual_token_rewards', actual_token_rewards,
            'calculated_nft_rewards', calculated_nft_rewards,
            'calculated_token_rewards', calculated_token_rewards,
            'nft_mismatch', (calculated_nft_rewards != actual_nft_rewards),
            'token_mismatch', (calculated_token_rewards != actual_token_rewards)
        ),
        'staking_summary_function', summary_result,
        'diagnosis', CASE 
            WHEN staked_nfts_count = 0 AND staked_tokens_amount = 0 THEN 'NO_STAKED_ASSETS'
            WHEN total_reward_records = 0 THEN 'NO_REWARD_RECORDS_GENERATED'
            WHEN unclaimed_nft_records = 0 AND unclaimed_token_records = 0 THEN 'ALL_REWARDS_CLAIMED'
            WHEN calculated_nft_rewards > actual_nft_rewards OR calculated_token_rewards > actual_token_rewards THEN 'UI_CALCULATION_MISMATCH'
            ELSE 'REWARDS_AVAILABLE'
        END,
        'recommended_fix', CASE 
            WHEN total_reward_records = 0 THEN 'Run generate_rewards_for_wallet() to create reward records'
            WHEN unclaimed_nft_records = 0 AND unclaimed_token_records = 0 THEN 'All rewards already claimed - wait for new daily rewards'
            WHEN calculated_nft_rewards > actual_nft_rewards OR calculated_token_rewards > actual_token_rewards THEN 'UI is showing calculated rewards but database has different values - sync needed'
            ELSE 'Check claim function logic'
        END
    ) INTO result;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'error', 'Debug failed: ' || SQLERRM,
        'wallet_address', user_wallet
    );
END;
$$;

-- =============================================================================
-- QUICK FIX: FORCE REFRESH STAKING SUMMARY
-- =============================================================================

CREATE OR REPLACE FUNCTION force_refresh_staking_summary(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- First generate any missing rewards for today
    PERFORM generate_rewards_for_wallet(user_wallet);
    
    -- Then return fresh staking summary
    RETURN get_user_staking_summary(user_wallet);
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'error', 'Force refresh failed: ' || SQLERRM,
        'wallet_address', user_wallet
    );
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION debug_pending_rewards_mismatch(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION force_refresh_staking_summary(TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- USAGE INSTRUCTIONS
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== PENDING REWARDS MISMATCH DEBUG TOOLS ===';
    RAISE NOTICE '';
    RAISE NOTICE 'To debug the pending rewards mismatch:';
    RAISE NOTICE '  SELECT debug_pending_rewards_mismatch(''your_wallet_address'');';
    RAISE NOTICE '';
    RAISE NOTICE 'To force refresh staking summary:';
    RAISE NOTICE '  SELECT force_refresh_staking_summary(''your_wallet_address'');';
    RAISE NOTICE '';
    RAISE NOTICE 'This will help identify why UI shows 1.5000 NEFT but claim returns NO_REWARDS_AVAILABLE';
END $$;
