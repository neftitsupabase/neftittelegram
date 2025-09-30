-- DIAGNOSE REWARDS AVAILABILITY ISSUE
-- Helps identify why "NO_REWARDS_AVAILABLE" is being returned

-- =============================================================================
-- DIAGNOSTIC FUNCTION TO CHECK REWARD STATUS
-- =============================================================================

CREATE OR REPLACE FUNCTION diagnose_rewards_status(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    staked_nfts_count INTEGER := 0;
    staked_tokens_amount DECIMAL(18,8) := 0;
    total_rewards_records INTEGER := 0;
    unclaimed_rewards_records INTEGER := 0;
    claimed_rewards_records INTEGER := 0;
    nft_rewards_unclaimed DECIMAL(18,8) := 0;
    token_rewards_unclaimed DECIMAL(18,8) := 0;
    latest_reward_date DATE;
    oldest_reward_date DATE;
BEGIN
    -- Check staked assets
    SELECT COUNT(*) INTO staked_nfts_count FROM staked_nfts WHERE wallet_address = user_wallet;
    SELECT COALESCE(SUM(amount), 0) INTO staked_tokens_amount FROM staked_tokens WHERE wallet_address = user_wallet;
    
    -- Check rewards records
    SELECT COUNT(*) INTO total_rewards_records FROM staking_rewards WHERE wallet_address = user_wallet;
    SELECT COUNT(*) INTO unclaimed_rewards_records FROM staking_rewards WHERE wallet_address = user_wallet AND is_claimed = FALSE;
    SELECT COUNT(*) INTO claimed_rewards_records FROM staking_rewards WHERE wallet_address = user_wallet AND is_claimed = TRUE;
    
    -- Check unclaimed rewards by type
    SELECT 
        COALESCE(SUM(CASE WHEN reward_type = 'nft_staking' THEN reward_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reward_type = 'token_staking' THEN reward_amount ELSE 0 END), 0)
    INTO nft_rewards_unclaimed, token_rewards_unclaimed
    FROM staking_rewards 
    WHERE wallet_address = user_wallet AND is_claimed = FALSE;
    
    -- Check reward date range
    SELECT MIN(reward_date), MAX(reward_date) 
    INTO oldest_reward_date, latest_reward_date
    FROM staking_rewards 
    WHERE wallet_address = user_wallet;
    
    -- Build comprehensive diagnostic result
    SELECT json_build_object(
        'wallet_address', user_wallet,
        'current_date', CURRENT_DATE,
        'staking_status', json_build_object(
            'staked_nfts_count', staked_nfts_count,
            'staked_tokens_amount', staked_tokens_amount,
            'has_staked_assets', (staked_nfts_count > 0 OR staked_tokens_amount > 0)
        ),
        'rewards_records', json_build_object(
            'total_records', total_rewards_records,
            'unclaimed_records', unclaimed_rewards_records,
            'claimed_records', claimed_rewards_records,
            'oldest_reward_date', oldest_reward_date,
            'latest_reward_date', latest_reward_date
        ),
        'unclaimed_rewards', json_build_object(
            'nft_rewards', nft_rewards_unclaimed,
            'token_rewards', token_rewards_unclaimed,
            'total_unclaimed', nft_rewards_unclaimed + token_rewards_unclaimed
        ),
        'diagnosis', CASE 
            WHEN staked_nfts_count = 0 AND staked_tokens_amount = 0 THEN 'NO_STAKED_ASSETS'
            WHEN total_rewards_records = 0 THEN 'NO_REWARDS_GENERATED'
            WHEN unclaimed_rewards_records = 0 AND claimed_rewards_records > 0 THEN 'ALL_REWARDS_CLAIMED'
            WHEN unclaimed_rewards_records > 0 THEN 'REWARDS_AVAILABLE'
            ELSE 'UNKNOWN_ISSUE'
        END,
        'recommended_action', CASE 
            WHEN staked_nfts_count = 0 AND staked_tokens_amount = 0 THEN 'Stake NFTs or tokens first to generate rewards'
            WHEN total_rewards_records = 0 THEN 'Run daily reward calculation or wait for automatic generation'
            WHEN unclaimed_rewards_records = 0 AND claimed_rewards_records > 0 THEN 'All rewards already claimed - stake more or wait for new rewards'
            WHEN unclaimed_rewards_records > 0 THEN 'Rewards available for claiming'
            ELSE 'Contact support for investigation'
        END
    ) INTO result;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'error', 'Diagnostic failed: ' || SQLERRM,
        'wallet_address', user_wallet
    );
END;
$$;

-- =============================================================================
-- MANUAL REWARD GENERATION FUNCTION (FOR TESTING)
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_rewards_for_wallet(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nft_rewards_generated INTEGER := 0;
    token_rewards_generated INTEGER := 0;
    total_reward_amount DECIMAL(18,8) := 0;
BEGIN
    -- Generate NFT staking rewards for today
    INSERT INTO staking_rewards (wallet_address, reward_type, source_id, reward_amount, reward_date)
    SELECT 
        wallet_address,
        'nft_staking',
        id,
        daily_reward,
        CURRENT_DATE
    FROM staked_nfts
    WHERE wallet_address = user_wallet
    AND NOT EXISTS (
        SELECT 1 FROM staking_rewards 
        WHERE staking_rewards.wallet_address = staked_nfts.wallet_address 
        AND staking_rewards.source_id = staked_nfts.id 
        AND staking_rewards.reward_date = CURRENT_DATE
        AND staking_rewards.reward_type = 'nft_staking'
    );
    
    GET DIAGNOSTICS nft_rewards_generated = ROW_COUNT;
    
    -- Generate token staking rewards for today
    INSERT INTO staking_rewards (wallet_address, reward_type, source_id, reward_amount, reward_date)
    SELECT 
        wallet_address,
        'token_staking',
        id,
        daily_reward,
        CURRENT_DATE
    FROM staked_tokens
    WHERE wallet_address = user_wallet
    AND NOT EXISTS (
        SELECT 1 FROM staking_rewards 
        WHERE staking_rewards.wallet_address = staked_tokens.wallet_address 
        AND staking_rewards.source_id = staked_tokens.id 
        AND staking_rewards.reward_date = CURRENT_DATE
        AND staking_rewards.reward_type = 'token_staking'
    );
    
    GET DIAGNOSTICS token_rewards_generated = ROW_COUNT;
    
    -- Calculate total reward amount generated
    SELECT COALESCE(SUM(reward_amount), 0) 
    INTO total_reward_amount
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND reward_date = CURRENT_DATE 
    AND is_claimed = FALSE;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Rewards generated successfully',
        'nft_rewards_generated', nft_rewards_generated,
        'token_rewards_generated', token_rewards_generated,
        'total_records_generated', nft_rewards_generated + token_rewards_generated,
        'total_reward_amount', total_reward_amount,
        'reward_date', CURRENT_DATE
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Failed to generate rewards: ' || SQLERRM
    );
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION diagnose_rewards_status(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION generate_rewards_for_wallet(TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- USAGE INSTRUCTIONS
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== REWARDS DIAGNOSTIC TOOLS CREATED ===';
    RAISE NOTICE '';
    RAISE NOTICE 'To diagnose why NO_REWARDS_AVAILABLE is returned:';
    RAISE NOTICE '  SELECT diagnose_rewards_status(''your_wallet_address'');';
    RAISE NOTICE '';
    RAISE NOTICE 'To manually generate rewards for testing:';
    RAISE NOTICE '  SELECT generate_rewards_for_wallet(''your_wallet_address'');';
    RAISE NOTICE '';
    RAISE NOTICE 'Common issues and solutions:';
    RAISE NOTICE '  1. NO_STAKED_ASSETS: Stake NFTs or tokens first';
    RAISE NOTICE '  2. NO_REWARDS_GENERATED: Run generate_rewards_for_wallet()';
    RAISE NOTICE '  3. ALL_REWARDS_CLAIMED: Wait for new rewards or stake more assets';
    RAISE NOTICE '  4. REWARDS_AVAILABLE: Claim function should work';
END $$;
