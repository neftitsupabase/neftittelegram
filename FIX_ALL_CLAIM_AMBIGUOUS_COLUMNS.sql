-- ============================================================================
-- COMPREHENSIVE FIX: Ambiguous Column References in ALL Claim Functions
-- ============================================================================
-- Issue: Variable name "available_neft" conflicts with column name "available_neft"
-- Solution: Rename variables and fix schema issues in all claim functions

-- ============================================================================
-- 1. FIX NFT REWARDS CLAIM FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_nft_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_claimable DECIMAL(18,8) := 0;
    reward_count INTEGER := 0;
    current_balance DECIMAL(18,8) := 0;
    current_available_neft DECIMAL(18,8) := 0; -- RENAMED to avoid ambiguity
BEGIN
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
        RETURN json_build_object(
            'success', false,
            'message', 'No NFT staking rewards available to claim',
            'total_claimed', 0,
            'nft_rewards_claimed', 0,
            'reward_type', 'nft_staking'
        );
    END IF;
    
    -- Get current user balance (avoid column name conflicts)
    SELECT 
        COALESCE(total_neft_claimed, 0),
        COALESCE(available_neft, 0)
    INTO current_balance, current_available_neft
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Mark NFT rewards as claimed in staking_rewards table
    UPDATE staking_rewards 
    SET is_claimed = TRUE
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
        current_available_neft + total_claimable,
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
    RAISE LOG 'Error in claim_nft_rewards_supabase_safe for wallet %: %', user_wallet, SQLERRM;
    
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming NFT rewards: ' || SQLERRM,
        'error', SQLERRM,
        'error_code', SQLSTATE
    );
END;
$$;

-- ============================================================================
-- 2. FIX TOKEN REWARDS CLAIM FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_token_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_claimable DECIMAL(18,8) := 0;
    reward_count INTEGER := 0;
    current_balance DECIMAL(18,8) := 0;
    current_available_neft DECIMAL(18,8) := 0; -- RENAMED to avoid ambiguity
BEGIN
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
        RETURN json_build_object(
            'success', false,
            'message', 'No token staking rewards available to claim',
            'total_claimed', 0,
            'token_rewards_claimed', 0,
            'reward_type', 'token_staking'
        );
    END IF;
    
    -- Get current user balance (avoid column name conflicts)
    SELECT 
        COALESCE(total_neft_claimed, 0),
        COALESCE(available_neft, 0)
    INTO current_balance, current_available_neft
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Mark token rewards as claimed in staking_rewards table
    UPDATE staking_rewards 
    SET is_claimed = TRUE
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
        current_available_neft + total_claimable,
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
    RAISE LOG 'Error in claim_token_rewards_supabase_safe for wallet %: %', user_wallet, SQLERRM;
    
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming token rewards: ' || SQLERRM,
        'error', SQLERRM,
        'error_code', SQLSTATE
    );
END;
$$;

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION claim_nft_rewards_supabase_safe(TEXT) TO authenticated, anon, public, service_role;
GRANT EXECUTE ON FUNCTION claim_token_rewards_supabase_safe(TEXT) TO authenticated, anon, public, service_role;

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '✅ COMPREHENSIVE CLAIM FUNCTIONS FIX COMPLETED';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '✅ Fixed claim_nft_rewards_supabase_safe:';
    RAISE NOTICE '   - Renamed variable: available_neft → current_available_neft';
    RAISE NOTICE '   - Removed non-existent claimed_at column';
    RAISE NOTICE '   - Added explicit table references in ON CONFLICT';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Fixed claim_token_rewards_supabase_safe:';
    RAISE NOTICE '   - Renamed variable: available_neft → current_available_neft';
    RAISE NOTICE '   - Removed non-existent claimed_at column';
    RAISE NOTICE '   - Added explicit table references in ON CONFLICT';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Both NFT and Token reward claiming should now work without errors!';
    RAISE NOTICE '============================================================================';
END $$;
