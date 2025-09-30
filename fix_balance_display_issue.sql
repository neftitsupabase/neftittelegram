-- ============================================================================
-- FIX BALANCE DISPLAY ISSUE
-- The daily claim is working but NEFT balance is not showing in UI
-- ============================================================================

-- Update the get_direct_user_balance function to properly handle daily claims
CREATE OR REPLACE FUNCTION get_direct_user_balance(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_neft_claimed DECIMAL(18,8) := 0;
    total_xp_earned INTEGER := 0;
    referral_neft DECIMAL(18,8) := 0;
    staked_amount DECIMAL(18,8) := 0;
    total_nft_count INTEGER := 0;
    last_updated TIMESTAMPTZ := NOW();
    available_neft DECIMAL(18,8) := 0;
BEGIN
    -- Get user balance data from user_balances table
    SELECT 
        COALESCE(ub.total_neft_claimed, 0),
        COALESCE(ub.total_xp_earned, 0),
        COALESCE(ub.available_neft, 0),
        COALESCE(ub.last_updated, NOW())
    INTO total_neft_claimed, total_xp_earned, available_neft, last_updated
    FROM user_balances ub
    WHERE ub.wallet_address = user_wallet;
    
    -- If no record in user_balances, check user_streaks (for daily claims)
    IF total_neft_claimed = 0 AND total_xp_earned = 0 THEN
        SELECT 
            COALESCE(us.total_neft_earned, 0),
            COALESCE(us.total_xp_earned, 0)
        INTO total_neft_claimed, total_xp_earned
        FROM user_streaks us
        WHERE us.wallet_address = user_wallet;
        
        -- Set available_neft to total_neft_claimed if not set
        IF available_neft = 0 THEN
            available_neft := total_neft_claimed;
        END IF;
    END IF;
    
    -- Get referral earnings
    SELECT COALESCE(ur.total_neft_earned, 0)
    INTO referral_neft
    FROM user_referrals ur
    WHERE ur.wallet_address = user_wallet;
    
    -- Get staked amount
    SELECT COALESCE(SUM(st.amount), 0)
    INTO staked_amount
    FROM staked_tokens st
    WHERE st.wallet_address = user_wallet;
    
    -- Calculate final available NEFT (total - staked)
    available_neft := GREATEST(0, (total_neft_claimed + referral_neft) - staked_amount);
    
    -- Return JSON with all balance information
    RETURN json_build_object(
        'total_neft_claimed', total_neft_claimed + referral_neft,
        'total_xp_earned', total_xp_earned,
        'available_neft', available_neft,
        'staked_neft', staked_amount,
        'total_nft_count', total_nft_count,
        'last_updated', last_updated,
        'primary_wallet', user_wallet,
        'linked_accounts', '[]'::json,
        'unified_balance', true
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO anon;

-- Test the function
DO $$
DECLARE
    test_wallet TEXT := '0x7780E03eF5709441fA566e138B498100C2c7B9F2';
    result JSON;
BEGIN
    SELECT get_direct_user_balance(test_wallet) INTO result;
    RAISE NOTICE 'Balance for %: %', test_wallet, result;
END;
$$;
