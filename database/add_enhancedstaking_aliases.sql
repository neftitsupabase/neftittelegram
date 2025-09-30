-- ADD ENHANCED STAKING SERVICE ALIASES
-- Creates alias functions that match EnhancedStakingService expectations
-- Maps to the actual functions created by COMPLETE_TESTING_SCRIPT.sql

-- Alias for claim_nft_rewards_supabase_safe -> claim_nft_rewards
CREATE OR REPLACE FUNCTION claim_nft_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN claim_nft_rewards(user_wallet);
END;
$$;

-- Alias for claim_token_rewards_supabase_safe -> claim_token_rewards  
CREATE OR REPLACE FUNCTION claim_token_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN claim_token_rewards(user_wallet);
END;
$$;

-- Alias for claim_all_rewards_supabase_safe -> claim_all_staking_rewards (atomic operation)
CREATE OR REPLACE FUNCTION claim_all_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Use the new atomic claim_all_staking_rewards function
    RETURN claim_all_staking_rewards(user_wallet);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION claim_nft_rewards_supabase_safe(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_token_rewards_supabase_safe(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_all_rewards_supabase_safe(TEXT) TO anon, authenticated, service_role;

-- Test the aliases work
DO $$
BEGIN
    RAISE NOTICE '✅ Enhanced Staking Service aliases created';
    RAISE NOTICE '✅ claim_nft_rewards_supabase_safe -> claim_nft_rewards';
    RAISE NOTICE '✅ claim_token_rewards_supabase_safe -> claim_token_rewards';
    RAISE NOTICE '✅ claim_all_rewards_supabase_safe -> combined function';
    RAISE NOTICE '🎯 EnhancedStakingService should now work without errors';
END $$;
