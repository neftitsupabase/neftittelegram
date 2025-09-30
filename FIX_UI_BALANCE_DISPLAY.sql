-- ============================================================================
-- SIMPLE FIX: Ensure get_direct_user_balance function works properly
-- This will make the UI show balances from user_balances table correctly
-- ============================================================================

-- Drop and recreate get_direct_user_balance function to ensure it works
DROP FUNCTION IF EXISTS get_direct_user_balance(TEXT);

CREATE OR REPLACE FUNCTION get_direct_user_balance(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    balance_record RECORD;
BEGIN
    -- Get balance from user_balances table
    SELECT 
        wallet_address,
        COALESCE(total_neft_claimed, 0) as total_neft_claimed,
        COALESCE(total_xp_earned, 0) as total_xp_earned,
        COALESCE(available_neft, 0) as available_neft,
        COALESCE(staked_neft, 0) as staked_neft,
        COALESCE(total_nft_count, 0) as total_nft_count,
        last_updated
    INTO balance_record
    FROM user_balances
    WHERE wallet_address = user_wallet;
    
    -- If no record found, return zero balance
    IF NOT FOUND THEN
        result := json_build_object(
            'wallet_address', user_wallet,
            'total_neft_claimed', 0,
            'total_xp_earned', 0,
            'available_neft', 0,
            'staked_neft', 0,
            'total_nft_count', 0,
            'last_updated', NOW()
        );
    ELSE
        result := json_build_object(
            'wallet_address', balance_record.wallet_address,
            'total_neft_claimed', balance_record.total_neft_claimed,
            'total_xp_earned', balance_record.total_xp_earned,
            'available_neft', balance_record.available_neft,
            'staked_neft', balance_record.staked_neft,
            'total_nft_count', balance_record.total_nft_count,
            'last_updated', balance_record.last_updated
        );
    END IF;
    
    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO authenticated, anon, public;

-- Test the function
SELECT 'get_direct_user_balance function created successfully!' as status;
