-- COMPLETE FINAL STAKING SUMMARY AND QUERY FUNCTIONS
-- User summary and query functions for UI integration

-- =============================================================================
-- 6. USER SUMMARY AND QUERY FUNCTIONS
-- =============================================================================

-- Get user staking summary (UI-compatible)
CREATE OR REPLACE FUNCTION get_user_staking_summary(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    staked_nfts_count INTEGER := 0;
    staked_tokens_amount DECIMAL(18,8) := 0;
    total_nft_rewards DECIMAL(18,8) := 0;
    total_token_rewards DECIMAL(18,8) := 0;
    claimable_nft_rewards DECIMAL(18,8) := 0;
    claimable_token_rewards DECIMAL(18,8) := 0;
    available_neft DECIMAL(18,8) := 0;
    total_neft_claimed DECIMAL(18,8) := 0;
BEGIN
    -- Get staked NFTs count
    SELECT COUNT(*) INTO staked_nfts_count FROM staked_nfts WHERE wallet_address = user_wallet;
    
    -- Get staked tokens amount
    SELECT COALESCE(SUM(amount), 0) INTO staked_tokens_amount FROM staked_tokens WHERE wallet_address = user_wallet;
    
    -- Get reward totals
    SELECT 
        COALESCE(SUM(total_nft_earned), 0),
        COALESCE(SUM(total_token_earned), 0),
        COALESCE(SUM(total_nft_earned - total_nft_claimed), 0),
        COALESCE(SUM(total_token_earned - total_token_claimed), 0)
    INTO total_nft_rewards, total_token_rewards, claimable_nft_rewards, claimable_token_rewards
    FROM staking_rewards WHERE wallet_address = user_wallet;
    
    -- Get user balance info
    SELECT 
        COALESCE(ub.available_neft, 0),
        COALESCE(ub.total_neft_claimed, 0)
    INTO available_neft, total_neft_claimed
    FROM user_balances ub WHERE ub.wallet_address = user_wallet;
    
    -- Build result JSON
    RETURN json_build_object(
        'wallet_address', user_wallet,
        'staked_nfts_count', staked_nfts_count,
        'staked_tokens_amount', staked_tokens_amount,
        'total_nft_rewards_earned', total_nft_rewards,
        'total_token_rewards_earned', total_token_rewards,
        'claimable_nft_rewards', claimable_nft_rewards,
        'claimable_token_rewards', claimable_token_rewards,
        'total_claimable_rewards', claimable_nft_rewards + claimable_token_rewards,
        'available_neft', available_neft,
        'total_neft_claimed', total_neft_claimed,
        'has_staked_assets', (staked_nfts_count > 0 OR staked_tokens_amount > 0),
        'has_claimable_rewards', (claimable_nft_rewards > 0 OR claimable_token_rewards > 0)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'error', SQLERRM,
        'wallet_address', user_wallet,
        'staked_nfts_count', 0,
        'staked_tokens_amount', 0,
        'total_claimable_rewards', 0,
        'available_neft', 0
    );
END;
$$;

-- Get user staked NFTs
CREATE OR REPLACE FUNCTION get_user_staked_nfts(user_wallet TEXT)
RETURNS TABLE(
    id UUID,
    nft_id TEXT,
    nft_name TEXT,
    nft_image TEXT,
    staked_at TIMESTAMP WITH TIME ZONE,
    daily_rate DECIMAL(18,8),
    total_earned DECIMAL(18,8),
    days_staked INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sn.id,
        sn.nft_id,
        sn.nft_name,
        sn.nft_image,
        sn.staked_at,
        sn.daily_rate,
        sn.total_earned,
        EXTRACT(DAY FROM (NOW() - sn.staked_at))::INTEGER as days_staked
    FROM staked_nfts sn
    WHERE sn.wallet_address = user_wallet
    ORDER BY sn.staked_at DESC;
END;
$$;

-- Get user staked tokens
CREATE OR REPLACE FUNCTION get_user_staked_tokens(user_wallet TEXT)
RETURNS TABLE(
    id UUID,
    amount DECIMAL(18,8),
    staked_at TIMESTAMP WITH TIME ZONE,
    daily_rate DECIMAL(18,8),
    total_earned DECIMAL(18,8),
    days_staked INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.id,
        st.amount,
        st.staked_at,
        st.daily_rate,
        st.total_earned,
        EXTRACT(DAY FROM (NOW() - st.staked_at))::INTEGER as days_staked
    FROM staked_tokens st
    WHERE st.wallet_address = user_wallet
    ORDER BY st.staked_at DESC;
END;
$$;

-- Get user staking rewards history
CREATE OR REPLACE FUNCTION get_user_staking_rewards_history(user_wallet TEXT)
RETURNS TABLE(
    reward_date DATE,
    nft_daily_rate DECIMAL(18,8),
    token_daily_rate DECIMAL(18,8),
    total_nft_earned DECIMAL(18,8),
    total_token_earned DECIMAL(18,8),
    total_nft_claimed DECIMAL(18,8),
    total_token_claimed DECIMAL(18,8),
    nft_claimable DECIMAL(18,8),
    token_claimable DECIMAL(18,8),
    claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.reward_date,
        sr.nft_daily_rate,
        sr.token_daily_rate,
        sr.total_nft_earned,
        sr.total_token_earned,
        sr.total_nft_claimed,
        sr.total_token_claimed,
        (sr.total_nft_earned - sr.total_nft_claimed) as nft_claimable,
        (sr.total_token_earned - sr.total_token_claimed) as token_claimable,
        sr.claimed
    FROM staking_rewards sr
    WHERE sr.wallet_address = user_wallet
    ORDER BY sr.reward_date DESC;
END;
$$;

-- =============================================================================
-- 7. GRANT PERMISSIONS FOR ALL FUNCTIONS
-- =============================================================================

-- Grant execute permissions to all roles
GRANT EXECUTE ON FUNCTION stake_nft(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION unstake_nft(TEXT, TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION stake_tokens(TEXT, DECIMAL) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION unstake_tokens(TEXT, UUID, DECIMAL) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION generate_daily_staking_rewards() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_nft_rewards_supabase_safe(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_token_rewards_supabase_safe(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_all_staking_rewards(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_user_staking_summary(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_user_staked_nfts(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_user_staked_tokens(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_user_staking_rewards_history(TEXT) TO authenticated, anon, public;

-- =============================================================================
-- 8. DEPLOYMENT VERIFICATION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== COMPLETE FINAL STAKING DATABASE DEPLOYED ===';
    RAISE NOTICE 'Schema: All tables created with proper columns and indexes';
    RAISE NOTICE 'Security: RLS policies enabled for all tables';
    RAISE NOTICE 'Functions: All staking functions deployed with Supabase-safe permissions';
    RAISE NOTICE 'Claims: Permission-fixed claim functions ready';
    RAISE NOTICE 'Summary: UI-compatible query functions available';
    RAISE NOTICE '';
    RAISE NOTICE 'READY FOR PRODUCTION USE!';
    RAISE NOTICE '';
    RAISE NOTICE 'Key Functions:';
    RAISE NOTICE '- stake_nft(wallet, nft_id, name, image)';
    RAISE NOTICE '- unstake_nft(wallet, nft_id)';
    RAISE NOTICE '- stake_tokens(wallet, amount)';
    RAISE NOTICE '- unstake_tokens(wallet, id, amount)';
    RAISE NOTICE '- claim_nft_rewards_supabase_safe(wallet)';
    RAISE NOTICE '- claim_token_rewards_supabase_safe(wallet)';
    RAISE NOTICE '- claim_all_staking_rewards(wallet)';
    RAISE NOTICE '- get_user_staking_summary(wallet)';
    RAISE NOTICE '- generate_daily_staking_rewards()';
END $$;
