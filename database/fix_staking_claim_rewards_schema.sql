-- FIX STAKING CLAIM REWARDS SCHEMA MISMATCH
-- Creates RPC functions that match the actual staking_rewards table structure
-- Fixes "column reward_amount does not exist" error

-- =============================================================================
-- CLAIM REWARDS FUNCTIONS (CORRECTED FOR ACTUAL SCHEMA)
-- =============================================================================

-- Claim NFT rewards only
CREATE OR REPLACE FUNCTION claim_nft_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    pending_nft_rewards DECIMAL(18,8) := 0;
    total_earned DECIMAL(18,8) := 0;
    total_claimed DECIMAL(18,8) := 0;
BEGIN
    -- Calculate pending NFT rewards (earned - claimed)
    SELECT 
        COALESCE(SUM(total_nft_earned), 0),
        COALESCE(SUM(total_nft_claimed), 0)
    INTO total_earned, total_claimed
    FROM staking_rewards 
    WHERE wallet_address = user_wallet;
    
    pending_nft_rewards := total_earned - total_claimed;
    
    -- Check if there are rewards to claim
    IF pending_nft_rewards <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'No NFT rewards available to claim',
            'error', 'NO_REWARDS_AVAILABLE'
        );
    END IF;
    
    -- Update claimed amount
    UPDATE staking_rewards 
    SET 
        total_nft_claimed = total_nft_earned,
        claimed = true,
        last_updated = NOW()
    WHERE wallet_address = user_wallet;
    
    -- Add rewards to user balance
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, last_updated)
    VALUES (user_wallet, pending_nft_rewards, pending_nft_rewards, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + pending_nft_rewards,
        available_neft = user_balances.available_neft + pending_nft_rewards,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from NFT staking rewards', pending_nft_rewards),
        'total_claimed', pending_nft_rewards,
        'nft_rewards_claimed', pending_nft_rewards,
        'reward_type', 'nft_staking'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming NFT rewards: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;

-- Claim token rewards only
CREATE OR REPLACE FUNCTION claim_token_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    pending_token_rewards DECIMAL(18,8) := 0;
    total_earned DECIMAL(18,8) := 0;
    total_claimed DECIMAL(18,8) := 0;
BEGIN
    -- Calculate pending token rewards (earned - claimed)
    SELECT 
        COALESCE(SUM(total_token_earned), 0),
        COALESCE(SUM(total_token_claimed), 0)
    INTO total_earned, total_claimed
    FROM staking_rewards 
    WHERE wallet_address = user_wallet;
    
    pending_token_rewards := total_earned - total_claimed;
    
    -- Check if there are rewards to claim
    IF pending_token_rewards <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'No token rewards available to claim',
            'error', 'NO_REWARDS_AVAILABLE'
        );
    END IF;
    
    -- Update claimed amount
    UPDATE staking_rewards 
    SET 
        total_token_claimed = total_token_earned,
        claimed = true,
        last_updated = NOW()
    WHERE wallet_address = user_wallet;
    
    -- Add rewards to user balance
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, last_updated)
    VALUES (user_wallet, pending_token_rewards, pending_token_rewards, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + pending_token_rewards,
        available_neft = user_balances.available_neft + pending_token_rewards,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from token staking rewards', pending_token_rewards),
        'total_claimed', pending_token_rewards,
        'token_rewards_claimed', pending_token_rewards,
        'reward_type', 'token_staking'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming token rewards: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;

-- Claim all rewards (both NFT and token)
CREATE OR REPLACE FUNCTION claim_all_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_all_rewards DECIMAL(18,8) := 0;
    nft_pending DECIMAL(18,8) := 0;
    token_pending DECIMAL(18,8) := 0;
    nft_earned DECIMAL(18,8) := 0;
    nft_claimed DECIMAL(18,8) := 0;
    token_earned DECIMAL(18,8) := 0;
    token_claimed DECIMAL(18,8) := 0;
BEGIN
    -- Calculate pending rewards by type
    SELECT 
        COALESCE(SUM(total_nft_earned), 0),
        COALESCE(SUM(total_nft_claimed), 0),
        COALESCE(SUM(total_token_earned), 0),
        COALESCE(SUM(total_token_claimed), 0)
    INTO nft_earned, nft_claimed, token_earned, token_claimed
    FROM staking_rewards 
    WHERE wallet_address = user_wallet;
    
    nft_pending := nft_earned - nft_claimed;
    token_pending := token_earned - token_claimed;
    total_all_rewards := nft_pending + token_pending;
    
    -- Check if there are rewards to claim
    IF total_all_rewards <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'No rewards available to claim',
            'error', 'NO_REWARDS_AVAILABLE'
        );
    END IF;
    
    -- Mark all rewards as claimed
    UPDATE staking_rewards 
    SET 
        total_nft_claimed = total_nft_earned,
        total_token_claimed = total_token_earned,
        claimed = true,
        last_updated = NOW()
    WHERE wallet_address = user_wallet;
    
    -- Add rewards to user balance
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, last_updated)
    VALUES (user_wallet, total_all_rewards, total_all_rewards, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + total_all_rewards,
        available_neft = user_balances.available_neft + total_all_rewards,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from staking rewards', total_all_rewards),
        'total_claimed', total_all_rewards,
        'nft_rewards_claimed', nft_pending,
        'token_rewards_claimed', token_pending,
        'reward_type', 'all_staking'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming rewards: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;

-- Enhanced get_user_staking_summary with pending rewards breakdown
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
    nft_earned DECIMAL(18,8) := 0;
    nft_claimed DECIMAL(18,8) := 0;
    token_earned DECIMAL(18,8) := 0;
    token_claimed DECIMAL(18,8) := 0;
BEGIN
    -- Calculate pending rewards (earned - claimed)
    SELECT 
        COALESCE(SUM(total_nft_earned), 0),
        COALESCE(SUM(total_nft_claimed), 0),
        COALESCE(SUM(total_token_earned), 0),
        COALESCE(SUM(total_token_claimed), 0)
    INTO nft_earned, nft_claimed, token_earned, token_claimed
    FROM staking_rewards 
    WHERE wallet_address = user_wallet;
    
    nft_pending := nft_earned - nft_claimed;
    token_pending := token_earned - token_claimed;
    total_pending := nft_pending + token_pending;

    SELECT json_build_object(
        'staked_nfts_count', COALESCE((SELECT COUNT(*) FROM staked_nfts WHERE wallet_address = user_wallet), 0),
        'staked_tokens_amount', COALESCE((SELECT SUM(amount) FROM staked_tokens WHERE wallet_address = user_wallet), 0),
        'total_pending_rewards', total_pending,
        'nft_pending_rewards', nft_pending,
        'token_pending_rewards', token_pending,
        'daily_nft_rewards', COALESCE((SELECT SUM(daily_rate) FROM staked_nfts WHERE wallet_address = user_wallet), 0),
        'daily_token_rewards', COALESCE((SELECT SUM(daily_rate) FROM staked_tokens WHERE wallet_address = user_wallet), 0)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION claim_nft_rewards_supabase_safe(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_token_rewards_supabase_safe(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_all_rewards_supabase_safe(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_staking_summary(TEXT) TO anon, authenticated, service_role;
