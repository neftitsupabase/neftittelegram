-- ============================================================================
-- UNIVERSAL BALANCE FUNCTION
-- Works for ALL wallet addresses (blockchain wallets, social login, etc.)
-- Handles different wallet address formats universally
-- ============================================================================

-- Create universal function that works for any wallet address format
-- Includes referral earnings in total_neft_claimed
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
    last_updated TIMESTAMPTZ := NOW();
BEGIN
    -- Get user balance data
    SELECT 
        COALESCE(ub.total_neft_claimed, 0),
        COALESCE(ub.total_xp_earned, 0),
        COALESCE(ub.last_updated, NOW())
    INTO total_neft_claimed, total_xp_earned, last_updated
    FROM user_balances ub
    WHERE ub.wallet_address = user_wallet;
    
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
    
    -- Return JSON with correct available_neft calculation
    RETURN json_build_object(
        'total_neft_claimed', total_neft_claimed + referral_neft,
        'total_xp_earned', total_xp_earned,
        'available_neft', GREATEST(0, (total_neft_claimed + referral_neft) - staked_amount),
        'staked_neft', staked_amount,
        'total_nft_count', 0,
        'last_updated', last_updated
    );
END;
$$;

-- Grant permissions to all user types
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO public;

-- Test with different wallet address formats
SELECT 'Universal balance function created for ALL wallet addresses!' as status;

-- Test with social login format


-- Test with any other format
SELECT 'Testing other format:' as test_type;
SELECT get_direct_user_balance('user123@example.com') as other_result;

-- Show all existing balances in the system
SELECT 'All existing balances in system:' as info;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated
FROM user_balances 
ORDER BY last_updated DESC;
