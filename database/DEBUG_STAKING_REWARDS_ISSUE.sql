-- ============================================================================
-- DEBUG STAKING REWARDS ISSUE - Find out why rewards aren't generating
-- ============================================================================

-- 1. Check if cron jobs are enabled and running
SELECT 
    jobname, 
    schedule, 
    command, 
    active,
    jobid
FROM cron.job 
WHERE jobname LIKE '%staking%' OR jobname LIKE '%reward%';

-- 2. Check if the generate_daily_staking_rewards function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'generate_daily_staking_rewards';

-- 3. Check if there are any staked assets older than 24 hours
SELECT 
    'staked_nfts' as table_name,
    wallet_address,
    nft_id,
    daily_reward,
    staked_at,
    NOW() - staked_at as time_staked,
    CASE 
        WHEN staked_at <= NOW() - INTERVAL '24 hours' THEN 'ELIGIBLE'
        ELSE 'NOT_ELIGIBLE'
    END as reward_eligibility
FROM staked_nfts
UNION ALL
SELECT 
    'staked_tokens' as table_name,
    wallet_address,
    amount::text as asset_id,
    daily_reward,
    staked_at,
    NOW() - staked_at as time_staked,
    CASE 
        WHEN staked_at <= NOW() - INTERVAL '24 hours' THEN 'ELIGIBLE'
        ELSE 'NOT_ELIGIBLE'
    END as reward_eligibility
FROM staked_tokens
ORDER BY staked_at DESC;

-- 4. Check existing rewards in staking_rewards table
SELECT 
    wallet_address,
    reward_date,
    nft_rewards,
    token_rewards,
    total_rewards,
    claimed,
    created_at
FROM staking_rewards
ORDER BY created_at DESC
LIMIT 20;

-- 5. Manual test of reward generation function
SELECT generate_daily_staking_rewards() as processed_wallets;

-- 6. Check if trigger_reward_generation_for_user function exists
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'trigger_reward_generation_for_user';

-- 7. Test immediate reward generation for a specific wallet (replace with actual wallet)
-- SELECT trigger_reward_generation_for_user('YOUR_WALLET_ADDRESS_HERE');

-- 8. Check pg_cron extension status
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 9. Check cron job execution history (if available)
SELECT 
    jobid,
    runid, 
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details 
WHERE command LIKE '%generate_daily_staking_rewards%'
ORDER BY start_time DESC
LIMIT 10;

-- 10. Show current time and timezone
SELECT 
    NOW() as current_time_utc,
    CURRENT_TIMESTAMP as current_timestamp,
    EXTRACT(timezone_hour FROM NOW()) as timezone_offset;
