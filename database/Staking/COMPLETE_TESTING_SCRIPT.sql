-- Complete testing script for reward tracking system
-- Run this in Supabase SQL editor for comprehensive testing

-- 1. Deploy the proper reward tracking system
-- (This includes cumulative tracking and proper summary function)

-- Add cumulative tracking columns if they don't exist
ALTER TABLE staking_rewards 
ADD COLUMN IF NOT EXISTS total_nft_earned DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_token_earned DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_nft_claimed DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_token_claimed DECIMAL(18,8) DEFAULT 0;

-- 2. Update reward generation function
DROP FUNCTION IF EXISTS generate_daily_staking_rewards();

CREATE FUNCTION generate_daily_staking_rewards()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processed_wallets INTEGER := 0;
    current_reward_date DATE := CURRENT_DATE;
    wallet_record RECORD;
    nft_daily_reward DECIMAL(18,8);
    token_daily_reward DECIMAL(18,8);
BEGIN
    FOR wallet_record IN 
        SELECT DISTINCT wallet_address FROM staked_nfts
        UNION
        SELECT DISTINCT wallet_address FROM staked_tokens
    LOOP
        -- Calculate daily NFT rewards
        SELECT COALESCE(SUM(daily_reward), 0) INTO nft_daily_reward
        FROM staked_nfts 
        WHERE wallet_address = wallet_record.wallet_address;
        
        -- Calculate daily token rewards  
        SELECT COALESCE(SUM(daily_reward), 0) INTO token_daily_reward
        FROM staked_tokens 
        WHERE wallet_address = wallet_record.wallet_address;
        
        -- Insert or update staking rewards with cumulative tracking
        INSERT INTO staking_rewards (
            wallet_address, reward_date, nft_rewards, token_rewards,
            total_nft_earned, total_token_earned, total_nft_claimed, total_token_claimed, claimed
        )
        VALUES (
            wallet_record.wallet_address, current_reward_date, 
            nft_daily_reward, token_daily_reward,
            nft_daily_reward, token_daily_reward, 0, 0, FALSE
        )
        ON CONFLICT (wallet_address, reward_date)
        DO UPDATE SET
            nft_rewards = nft_daily_reward,
            token_rewards = token_daily_reward,
            total_nft_earned = staking_rewards.total_nft_earned + nft_daily_reward,
            total_token_earned = staking_rewards.total_token_earned + token_daily_reward,
            claimed = FALSE;
        
        processed_wallets := processed_wallets + 1;
    END LOOP;
    
    RETURN processed_wallets;
END;
$$;

-- 3. Update summary function with UI compatibility
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

-- 4. Fix NFT claim function
DROP FUNCTION IF EXISTS claim_nft_rewards(TEXT);

CREATE FUNCTION claim_nft_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nft_claimable DECIMAL(18,8) := 0;
BEGIN
    -- Calculate claimable NFT rewards (only from records with unclaimed rewards)
    SELECT COALESCE(SUM(total_nft_earned - total_nft_claimed), 0)
    INTO nft_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet
    AND total_nft_earned > total_nft_claimed;
    
    IF nft_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No NFT rewards available to claim'
        );
    END IF;
    
    -- Update claimed amounts ONLY for records with unclaimed NFT rewards
    UPDATE staking_rewards
    SET total_nft_claimed = total_nft_earned
    WHERE wallet_address = user_wallet
    AND total_nft_earned > total_nft_claimed;
    
    -- Add to user balance (this correctly adds to existing balance)
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

-- 5. Fix token claim function
DROP FUNCTION IF EXISTS claim_token_rewards(TEXT);

CREATE FUNCTION claim_token_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token_claimable DECIMAL(18,8) := 0;
BEGIN
    -- Calculate claimable token rewards (only from records with unclaimed rewards)
    SELECT COALESCE(SUM(total_token_earned - total_token_claimed), 0)
    INTO token_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet
    AND total_token_earned > total_token_claimed;
    
    IF token_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No token rewards available to claim'
        );
    END IF;
    
    -- Update claimed amounts ONLY for records with unclaimed token rewards
    UPDATE staking_rewards
    SET total_token_claimed = total_token_earned
    WHERE wallet_address = user_wallet
    AND total_token_earned > total_token_claimed;
    
    -- Add to user balance (this correctly adds to existing balance)
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

-- 6. Generate rewards immediately for testing
SELECT generate_daily_staking_rewards() as wallets_processed;

DO $$
BEGIN
    RAISE NOTICE '✅ Complete reward tracking system deployed';
    RAISE NOTICE '✅ Cumulative tracking implemented';
    RAISE NOTICE '✅ Fixed claim functions to properly accumulate rewards';
    RAISE NOTICE '✅ Rewards generated for all staking wallets';
    RAISE NOTICE '🧪 Ready for testing: claim NFT rewards, then token rewards';
    RAISE NOTICE '🧪 Both should accumulate in user balance correctly';
END $$;
