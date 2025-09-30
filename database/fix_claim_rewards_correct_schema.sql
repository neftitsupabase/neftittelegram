-- FIX CLAIM REWARDS WITH CORRECT SCHEMA
-- Fixes the "column total_nft_earned does not exist" error
-- Uses the actual staking_rewards table schema with reward_amount and is_claimed columns

-- =============================================================================
-- CORRECTED CLAIM NFT REWARDS FUNCTION (MATCHES ACTUAL SCHEMA)
-- =============================================================================

CREATE OR REPLACE FUNCTION claim_nft_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_claimable DECIMAL(18,8) := 0;
    reward_count INTEGER := 0;
    current_balance DECIMAL(18,8) := 0;
    available_neft DECIMAL(18,8) := 0;
BEGIN
    -- First, try to generate rewards for today if they don't exist
    INSERT INTO staking_rewards (wallet_address, reward_type, source_id, reward_amount, reward_date)
    SELECT 
        wallet_address,
        'nft_staking',
        id,
        daily_reward,
        CURRENT_DATE
    FROM staked_nfts
    WHERE wallet_address = user_wallet
    ON CONFLICT (wallet_address, reward_type, source_id, reward_date) DO NOTHING;
    
    -- Calculate total claimable NFT rewards using actual schema
    SELECT 
        COALESCE(SUM(reward_amount), 0),
        COUNT(*)
    INTO total_claimable, reward_count
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND reward_type = 'nft_staking'
    AND is_claimed = FALSE;
    
    -- Check if there are rewards to claim
    IF total_claimable <= 0 THEN
        -- Check if user has staked NFTs but no rewards
        DECLARE
            staked_nfts_count INTEGER := 0;
        BEGIN
            SELECT COUNT(*) INTO staked_nfts_count FROM staked_nfts WHERE wallet_address = user_wallet;
            
            IF staked_nfts_count > 0 THEN
                RETURN json_build_object(
                    'success', false,
                    'message', format('You have %s staked NFTs but no claimable rewards yet. Rewards are generated daily.', staked_nfts_count),
                    'total_claimed', 0,
                    'nft_rewards_claimed', 0,
                    'staked_nfts_count', staked_nfts_count,
                    'error', 'NO_REWARDS_GENERATED'
                );
            ELSE
                RETURN json_build_object(
                    'success', false,
                    'message', 'No NFT rewards available to claim. Stake NFTs first to earn rewards.',
                    'total_claimed', 0,
                    'nft_rewards_claimed', 0,
                    'staked_nfts_count', 0,
                    'error', 'NO_STAKED_NFTS'
                );
            END IF;
        END;
    END IF;
    
    -- Get current balance before updates
    SELECT 
        COALESCE(total_neft_claimed, 0),
        COALESCE(available_neft, 0)
    INTO current_balance, available_neft
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Mark NFT rewards as claimed in staking_rewards table
    -- This UPDATES existing records to set is_claimed = TRUE
    UPDATE staking_rewards 
    SET 
        is_claimed = TRUE,
        claimed_at = NOW()
    WHERE wallet_address = user_wallet 
    AND reward_type = 'nft_staking'
    AND is_claimed = FALSE;
    
    -- Update user balance with UPSERT to handle conflicts
    INSERT INTO user_balances (
        wallet_address, 
        total_neft_claimed, 
        available_neft, 
        last_updated
    )
    VALUES (
        user_wallet, 
        current_balance + total_claimable, 
        available_neft + total_claimable, 
        NOW()
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + total_claimable,
        available_neft = user_balances.available_neft + total_claimable,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from NFT staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'nft_rewards_claimed', total_claimable,
        'reward_type', 'nft_staking',
        'rewards_count', reward_count
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Enhanced error logging
    RAISE LOG 'Error in claim_nft_rewards_supabase_safe for wallet %: %', user_wallet, SQLERRM;
    
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming NFT rewards: ' || SQLERRM,
        'error', SQLERRM,
        'error_code', SQLSTATE
    );
END;
$$;

-- =============================================================================
-- CORRECTED CLAIM TOKEN REWARDS FUNCTION (MATCHES ACTUAL SCHEMA)
-- =============================================================================

CREATE OR REPLACE FUNCTION claim_token_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_claimable DECIMAL(18,8) := 0;
    reward_count INTEGER := 0;
    current_balance DECIMAL(18,8) := 0;
    available_neft DECIMAL(18,8) := 0;
BEGIN
    -- First, try to generate rewards for today if they don't exist
    INSERT INTO staking_rewards (wallet_address, reward_type, source_id, reward_amount, reward_date)
    SELECT 
        wallet_address,
        'token_staking',
        id,
        daily_reward,
        CURRENT_DATE
    FROM staked_tokens
    WHERE wallet_address = user_wallet
    ON CONFLICT (wallet_address, reward_type, source_id, reward_date) DO NOTHING;
    
    -- Calculate total claimable token rewards using actual schema
    SELECT 
        COALESCE(SUM(reward_amount), 0),
        COUNT(*)
    INTO total_claimable, reward_count
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND reward_type = 'token_staking'
    AND is_claimed = FALSE;
    
    -- Check if there are rewards to claim
    IF total_claimable <= 0 THEN
        -- Check if user has staked tokens but no rewards
        DECLARE
            staked_tokens_amount DECIMAL(18,8) := 0;
        BEGIN
            SELECT COALESCE(SUM(amount), 0) INTO staked_tokens_amount FROM staked_tokens WHERE wallet_address = user_wallet;
            
            IF staked_tokens_amount > 0 THEN
                RETURN json_build_object(
                    'success', false,
                    'message', format('You have %s staked NEFT but no claimable rewards yet. Rewards are generated daily.', staked_tokens_amount),
                    'total_claimed', 0,
                    'token_rewards_claimed', 0,
                    'staked_tokens_amount', staked_tokens_amount,
                    'error', 'NO_REWARDS_GENERATED'
                );
            ELSE
                RETURN json_build_object(
                    'success', false,
                    'message', 'No token rewards available to claim. Stake NEFT tokens first to earn rewards.',
                    'total_claimed', 0,
                    'token_rewards_claimed', 0,
                    'staked_tokens_amount', 0,
                    'error', 'NO_STAKED_TOKENS'
                );
            END IF;
        END;
    END IF;
    
    -- Get current balance before updates
    SELECT 
        COALESCE(total_neft_claimed, 0),
        COALESCE(available_neft, 0)
    INTO current_balance, available_neft
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Mark token rewards as claimed in staking_rewards table
    -- This UPDATES existing records to set is_claimed = TRUE
    UPDATE staking_rewards 
    SET 
        is_claimed = TRUE,
        claimed_at = NOW()
    WHERE wallet_address = user_wallet 
    AND reward_type = 'token_staking'
    AND is_claimed = FALSE;
    
    -- Update user balance with UPSERT to handle conflicts
    INSERT INTO user_balances (
        wallet_address, 
        total_neft_claimed, 
        available_neft, 
        last_updated
    )
    VALUES (
        user_wallet, 
        current_balance + total_claimable, 
        available_neft + total_claimable, 
        NOW()
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + total_claimable,
        available_neft = user_balances.available_neft + total_claimable,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from token staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'token_rewards_claimed', total_claimable,
        'reward_type', 'token_staking',
        'rewards_count', reward_count
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Enhanced error logging
    RAISE LOG 'Error in claim_token_rewards_supabase_safe for wallet %: %', user_wallet, SQLERRM;
    
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming token rewards: ' || SQLERRM,
        'error', SQLERRM,
        'error_code', SQLSTATE
    );
END;
$$;

-- =============================================================================
-- CORRECTED CLAIM ALL REWARDS FUNCTION (MATCHES ACTUAL SCHEMA)
-- =============================================================================

CREATE OR REPLACE FUNCTION claim_all_staking_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_claimable DECIMAL(18,8) := 0;
    nft_claimable DECIMAL(18,8) := 0;
    token_claimable DECIMAL(18,8) := 0;
    reward_count INTEGER := 0;
    current_balance DECIMAL(18,8) := 0;
    available_neft DECIMAL(18,8) := 0;
BEGIN
    -- Calculate total claimable rewards by type using actual schema
    SELECT 
        COALESCE(SUM(CASE WHEN reward_type = 'nft_staking' THEN reward_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reward_type = 'token_staking' THEN reward_amount ELSE 0 END), 0),
        COUNT(*)
    INTO nft_claimable, token_claimable, reward_count
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND is_claimed = FALSE;
    
    total_claimable := nft_claimable + token_claimable;
    
    -- Check if there are rewards to claim
    IF total_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'No rewards available to claim',
            'total_claimed', 0,
            'nft_rewards_claimed', 0,
            'token_rewards_claimed', 0,
            'error', 'NO_REWARDS_AVAILABLE'
        );
    END IF;
    
    -- Get current balance before updates
    SELECT 
        COALESCE(total_neft_claimed, 0),
        COALESCE(available_neft, 0)
    INTO current_balance, available_neft
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Mark all rewards as claimed in staking_rewards table
    -- This UPDATES existing records to set is_claimed = TRUE
    UPDATE staking_rewards 
    SET 
        is_claimed = TRUE,
        claimed_at = NOW()
    WHERE wallet_address = user_wallet 
    AND is_claimed = FALSE;
    
    -- Update user balance with UPSERT to handle conflicts
    INSERT INTO user_balances (
        wallet_address, 
        total_neft_claimed, 
        available_neft, 
        last_updated
    )
    VALUES (
        user_wallet, 
        current_balance + total_claimable, 
        available_neft + total_claimable, 
        NOW()
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + total_claimable,
        available_neft = user_balances.available_neft + total_claimable,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'nft_rewards_claimed', nft_claimable,
        'token_rewards_claimed', token_claimable,
        'reward_type', 'all_staking',
        'rewards_count', reward_count
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Enhanced error logging
    RAISE LOG 'Error in claim_all_staking_rewards for wallet %: %', user_wallet, SQLERRM;
    
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming all rewards: ' || SQLERRM,
        'error', SQLERRM,
        'error_code', SQLSTATE
    );
END;
$$;

-- =============================================================================
-- CORRECTED GET USER STAKING SUMMARY WITH PENDING REWARDS BREAKDOWN
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_staking_summary(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    nft_pending DECIMAL(18,8) := 0;
    token_pending DECIMAL(18,8) := 0;
    total_pending DECIMAL(18,8) := 0;
BEGIN
    -- Calculate pending rewards by type using actual schema
    SELECT 
        COALESCE(SUM(CASE WHEN reward_type = 'nft_staking' THEN reward_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reward_type = 'token_staking' THEN reward_amount ELSE 0 END), 0)
    INTO nft_pending, token_pending
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND is_claimed = FALSE;
    
    total_pending := nft_pending + token_pending;

    SELECT json_build_object(
        'staked_nfts_count', COALESCE((SELECT COUNT(*) FROM staked_nfts WHERE wallet_address = user_wallet), 0),
        'staked_tokens_amount', COALESCE((SELECT SUM(amount) FROM staked_tokens WHERE wallet_address = user_wallet), 0),
        'total_pending_rewards', total_pending,
        'nft_pending_rewards', nft_pending,
        'token_pending_rewards', token_pending,
        'daily_nft_rewards', COALESCE((SELECT SUM(daily_reward) FROM staked_nfts WHERE wallet_address = user_wallet), 0),
        'daily_token_rewards', COALESCE((SELECT SUM(daily_reward) FROM staked_tokens WHERE wallet_address = user_wallet), 0)
    ) INTO result;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'error', 'Error getting staking summary: ' || SQLERRM,
        'staked_nfts_count', 0,
        'staked_tokens_amount', 0,
        'total_pending_rewards', 0,
        'nft_pending_rewards', 0,
        'token_pending_rewards', 0,
        'daily_nft_rewards', 0,
        'daily_token_rewards', 0
    );
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION claim_nft_rewards_supabase_safe(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_token_rewards_supabase_safe(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_all_staking_rewards(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_staking_summary(TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- VERIFICATION AND LOGGING
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== CLAIM REWARDS SCHEMA CORRECTED ===';
    RAISE NOTICE 'Fixed functions to match actual staking_rewards table schema:';
    RAISE NOTICE '  - Uses reward_amount (not total_nft_earned/total_token_earned)';
    RAISE NOTICE '  - Uses is_claimed (not claimed)';
    RAISE NOTICE '  - Uses reward_type to distinguish nft_staking vs token_staking';
    RAISE NOTICE '';
    RAISE NOTICE 'Updated functions:';
    RAISE NOTICE '  - claim_nft_rewards_supabase_safe: Fixed column references';
    RAISE NOTICE '  - claim_token_rewards_supabase_safe: Fixed column references';
    RAISE NOTICE '  - claim_all_staking_rewards: Fixed column references';
    RAISE NOTICE '  - get_user_staking_summary: Enhanced with proper pending rewards';
    RAISE NOTICE '';
    RAISE NOTICE 'The "column total_nft_earned does not exist" error should now be resolved.';
END $$;
