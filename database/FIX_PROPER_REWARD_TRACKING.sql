-- ============================================================================
-- FIX PROPER REWARD TRACKING - CUMULATIVE SYSTEM
-- ============================================================================
-- This fixes the reward system to properly track earned vs claimed amounts

-- 1. Add columns to track cumulative amounts
ALTER TABLE staking_rewards 
ADD COLUMN IF NOT EXISTS total_nft_earned DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_token_earned DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_nft_claimed DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_token_claimed DECIMAL(18,8) DEFAULT 0;

-- 2. Update existing records to initialize cumulative values
UPDATE staking_rewards 
SET 
    total_nft_earned = nft_rewards,
    total_token_earned = token_rewards,
    total_nft_claimed = CASE WHEN claimed THEN nft_rewards ELSE 0 END,
    total_token_claimed = CASE WHEN claimed THEN token_rewards ELSE 0 END;

-- 3. Create improved reward generation function
DROP FUNCTION IF EXISTS generate_daily_staking_rewards();

CREATE FUNCTION generate_daily_staking_rewards()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_reward_date DATE := CURRENT_DATE;
    processed_count INTEGER := 0;
    wallet_record RECORD;
    cutoff_time TIMESTAMP WITH TIME ZONE;
    current_nft_daily DECIMAL(18,8);
    current_token_daily DECIMAL(18,8);
BEGIN
    cutoff_time := NOW() - INTERVAL '24 hours';
    
    FOR wallet_record IN (
        SELECT DISTINCT wallet_address
        FROM (
            SELECT wallet_address FROM staked_nfts WHERE staked_at <= cutoff_time
            UNION
            SELECT wallet_address FROM staked_tokens WHERE staked_at <= cutoff_time
        ) AS eligible_wallets
    ) LOOP
        -- Calculate current daily rewards
        SELECT COALESCE(SUM(daily_reward), 0) INTO current_nft_daily
        FROM staked_nfts
        WHERE wallet_address = wallet_record.wallet_address
        AND staked_at <= cutoff_time;
        
        SELECT COALESCE(SUM(daily_reward), 0) INTO current_token_daily
        FROM staked_tokens
        WHERE wallet_address = wallet_record.wallet_address
        AND staked_at <= cutoff_time;
        
        -- Insert or update with cumulative tracking
        INSERT INTO staking_rewards (
            wallet_address,
            reward_date,
            nft_rewards,
            token_rewards,
            total_rewards,
            total_nft_earned,
            total_token_earned,
            total_nft_claimed,
            total_token_claimed,
            claimed
        )
        VALUES (
            wallet_record.wallet_address,
            current_reward_date,
            current_nft_daily,
            current_token_daily,
            current_nft_daily + current_token_daily,
            current_nft_daily,
            current_token_daily,
            0, -- No claims yet
            0, -- No claims yet
            FALSE
        )
        ON CONFLICT (wallet_address, reward_date)
        DO UPDATE SET
            -- Update daily rates
            nft_rewards = current_nft_daily,
            token_rewards = current_token_daily,
            total_rewards = current_nft_daily + current_token_daily,
            -- Add new daily rewards to cumulative earned
            total_nft_earned = staking_rewards.total_nft_earned + current_nft_daily,
            total_token_earned = staking_rewards.total_token_earned + current_token_daily;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- 4. Update get_user_staking_summary to show proper pending amounts
DROP FUNCTION IF EXISTS get_user_staking_summary(TEXT);

CREATE FUNCTION get_user_staking_summary(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_nft_pending DECIMAL(18,8) := 0;
    total_token_pending DECIMAL(18,8) := 0;
BEGIN
    -- Calculate pending rewards = earned - claimed
    SELECT 
        COALESCE(SUM(total_nft_earned - total_nft_claimed), 0),
        COALESCE(SUM(total_token_earned - total_token_claimed), 0)
    INTO total_nft_pending, total_token_pending
    FROM staking_rewards 
    WHERE wallet_address = user_wallet;
    
    SELECT json_build_object(
        'staked_nfts_count', COALESCE((SELECT COUNT(*) FROM staked_nfts WHERE wallet_address = user_wallet), 0),
        'staked_tokens_amount', COALESCE((SELECT SUM(amount) FROM staked_tokens WHERE wallet_address = user_wallet), 0),
        'daily_nft_rewards', COALESCE((SELECT SUM(daily_reward) FROM staked_nfts WHERE wallet_address = user_wallet), 0),
        'daily_token_rewards', COALESCE((SELECT SUM(daily_reward) FROM staked_tokens WHERE wallet_address = user_wallet), 0),
        'unclaimed_rewards', total_nft_pending + total_token_pending,  -- UI compatibility
        'total_pending_rewards', total_nft_pending + total_token_pending,
        'nft_pending_rewards', total_nft_pending,
        'token_pending_rewards', total_token_pending
    ) INTO result;
    
    RETURN result;
END;
$$;

-- 5. Update claim functions to properly track claimed amounts
DROP FUNCTION IF EXISTS claim_nft_rewards(TEXT);

CREATE FUNCTION claim_nft_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nft_claimable DECIMAL(18,8) := 0;
BEGIN
    -- Calculate claimable NFT rewards
    SELECT COALESCE(SUM(total_nft_earned - total_nft_claimed), 0)
    INTO nft_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet;
    
    IF nft_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No NFT rewards available to claim'
        );
    END IF;
    
    -- Update claimed amounts
    UPDATE staking_rewards
    SET total_nft_claimed = total_nft_earned
    WHERE wallet_address = user_wallet;
    
    -- Add to user balance
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
    VALUES (user_wallet, nft_claimable, nft_claimable, 0)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + nft_claimable,
        available_neft = user_balances.available_neft + nft_claimable;
    
    RETURN json_build_object(
        'success', true,
        'message', 'NFT rewards claimed successfully',
        'nft_rewards_claimed', nft_claimable,
        'total_claimed', nft_claimable
    );
END;
$$;

DROP FUNCTION IF EXISTS claim_token_rewards(TEXT);

CREATE FUNCTION claim_token_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token_claimable DECIMAL(18,8) := 0;
BEGIN
    -- Calculate claimable token rewards
    SELECT COALESCE(SUM(total_token_earned - total_token_claimed), 0)
    INTO token_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet;
    
    IF token_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No token rewards available to claim'
        );
    END IF;
    
    -- Update claimed amounts
    UPDATE staking_rewards
    SET total_token_claimed = total_token_earned
    WHERE wallet_address = user_wallet;
    
    -- Add to user balance
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
    VALUES (user_wallet, token_claimable, token_claimable, 0)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + token_claimable,
        available_neft = user_balances.available_neft + token_claimable;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Token rewards claimed successfully',
        'token_rewards_claimed', token_claimable,
        'total_claimed', token_claimable
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_daily_staking_rewards() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_user_staking_summary(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_nft_rewards(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_token_rewards(TEXT) TO authenticated, anon, public;

DO $$
BEGIN
    RAISE NOTICE '✅ Implemented proper cumulative reward tracking';
    RAISE NOTICE '✅ Pending rewards = Total earned - Total claimed';
    RAISE NOTICE '✅ Daily rewards accumulate properly';
    RAISE NOTICE '✅ Claims update cumulative claimed amounts';
    RAISE NOTICE '✅ UI will show correct pending amounts after claims';
END $$;
