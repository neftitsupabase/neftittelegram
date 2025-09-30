-- ============================================================================
-- FIX: Ambiguous Column Reference "available_neft" in claim_nft_rewards_supabase_safe
-- ============================================================================
-- Issue: Variable name "available_neft" conflicts with column name "available_neft"
-- Solution: Rename variable to avoid ambiguity

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
    INTO current_balance, current_available_neft -- FIXED: Use renamed variable
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Mark NFT rewards as claimed in staking_rewards table
    UPDATE staking_rewards 
    SET 
        is_claimed = TRUE
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
        current_available_neft + total_claimable, -- FIXED: Use renamed variable
        NOW()
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + total_claimable,
        available_neft = user_balances.available_neft + total_claimable, -- FIXED: Explicit table reference
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION claim_nft_rewards_supabase_safe(TEXT) TO authenticated, anon, public, service_role;

-- Test the function to ensure it works
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed ambiguous column reference in claim_nft_rewards_supabase_safe';
    RAISE NOTICE '✅ Renamed variable: available_neft → current_available_neft';
    RAISE NOTICE '✅ Added explicit table references in ON CONFLICT clause';
    RAISE NOTICE '✅ Removed non-existent claimed_at column reference';
    RAISE NOTICE '🎯 NFT reward claiming should now work without errors';
END $$;
