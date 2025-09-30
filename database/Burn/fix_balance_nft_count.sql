-- ============================================================================
-- FIX BALANCE NFT COUNT
-- Update get_direct_user_balance to include actual NFT counts from comprehensive system
-- ============================================================================

-- Update the balance function to include real NFT counts
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
    nft_counts_result JSON;
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
    
    -- Get comprehensive NFT counts (if function exists)
    BEGIN
        SELECT get_comprehensive_nft_counts(user_wallet) INTO nft_counts_result;
        
        -- Extract total count from the combined section
        IF nft_counts_result IS NOT NULL AND nft_counts_result->'combined' IS NOT NULL THEN
            total_nft_count := COALESCE(
                (nft_counts_result->'combined'->>'total_nfts')::INTEGER, 
                0
            );
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- If comprehensive function doesn't exist, fall back to basic count
            SELECT COALESCE(COUNT(*), 0)
            INTO total_nft_count
            FROM user_nft_collections unc
            WHERE unc.wallet_address = user_wallet;
    END;
    
    -- Return JSON with correct available_neft calculation and real NFT count
    RETURN json_build_object(
        'total_neft_claimed', total_neft_claimed + referral_neft,
        'total_xp_earned', total_xp_earned,
        'available_neft', GREATEST(0, (total_neft_claimed + referral_neft) - staked_amount),
        'staked_neft', staked_amount,
        'total_nft_count', total_nft_count,
        'last_updated', last_updated
    );
END;
$$;

-- Grant permissions to all user types
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO public;

-- Test the updated function
SELECT 'Updated balance function to include real NFT counts!' as status;
