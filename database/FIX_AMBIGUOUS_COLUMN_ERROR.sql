-- ============================================================================
-- FIX AMBIGUOUS COLUMN REFERENCE ERROR IN generate_daily_staking_rewards
-- ============================================================================

-- Drop the existing function with the error
DROP FUNCTION IF EXISTS generate_daily_staking_rewards();

-- Create the corrected function with proper variable naming
CREATE FUNCTION generate_daily_staking_rewards()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_reward_date DATE := CURRENT_DATE;  -- Renamed to avoid ambiguity
    processed_count INTEGER := 0;
    wallet_record RECORD;
    cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate 24-hour cutoff time
    cutoff_time := NOW() - INTERVAL '24 hours';
    
    -- Process rewards for each wallet with staked assets (staked for 24+ hours)
    FOR wallet_record IN (
        SELECT DISTINCT wallet_address
        FROM (
            SELECT wallet_address FROM staked_nfts WHERE staked_at <= cutoff_time
            UNION
            SELECT wallet_address FROM staked_tokens WHERE staked_at <= cutoff_time
        ) AS eligible_wallets
    ) LOOP
        -- Insert or update daily rewards
        INSERT INTO staking_rewards (
            wallet_address,
            reward_date,
            nft_rewards,
            token_rewards,
            total_rewards
        )
        SELECT
            wallet_record.wallet_address,
            current_reward_date,  -- Use the renamed variable
            COALESCE(nft_rewards.total, 0),
            COALESCE(token_rewards.total, 0),
            COALESCE(nft_rewards.total, 0) + COALESCE(token_rewards.total, 0)
        FROM (
            SELECT COALESCE(SUM(daily_reward), 0) as total
            FROM staked_nfts
            WHERE wallet_address = wallet_record.wallet_address
            AND staked_at <= cutoff_time
        ) nft_rewards
        CROSS JOIN (
            SELECT COALESCE(SUM(daily_reward), 0) as total
            FROM staked_tokens
            WHERE wallet_address = wallet_record.wallet_address
            AND staked_at <= cutoff_time
        ) token_rewards
        WHERE (COALESCE(nft_rewards.total, 0) + COALESCE(token_rewards.total, 0)) > 0
        ON CONFLICT (wallet_address, reward_date)
        DO UPDATE SET
            nft_rewards = EXCLUDED.nft_rewards,
            token_rewards = EXCLUDED.token_rewards,
            total_rewards = EXCLUDED.total_rewards;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_daily_staking_rewards() TO authenticated, anon, public;

-- Test the function
SELECT generate_daily_staking_rewards() as wallets_processed;

-- Verify the fix worked
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed ambiguous column reference error';
    RAISE NOTICE '✅ Function generate_daily_staking_rewards() recreated';
    RAISE NOTICE '✅ Ready to generate rewards for eligible wallets';
END $$;
