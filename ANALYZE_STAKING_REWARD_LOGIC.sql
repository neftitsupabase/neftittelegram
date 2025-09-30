-- ============================================================================
-- COMPREHENSIVE STAKING REWARD LOGIC ANALYSIS
-- ============================================================================
-- This script analyzes the complete staking reward system to verify:
-- 1. Rewards stop after unstaking
-- 2. Unclaimed rewards accumulate properly
-- 3. Daily reward generation logic
-- 4. Pending reward calculation accuracy

-- ============================================================================
-- SECTION 1: CHECK CURRENT FUNCTIONS AND THEIR LOGIC
-- ============================================================================

-- 1.1 Check if reward generation function exists and view its logic
SELECT 
    'REWARD GENERATION FUNCTION' as analysis_type,
    routine_name,
    routine_type,
    data_type,
    CASE 
        WHEN routine_definition IS NOT NULL THEN 'Function exists with logic'
        ELSE 'Function missing or no definition'
    END as status
FROM information_schema.routines 
WHERE routine_name = 'generate_daily_staking_rewards';

-- 1.2 Check staking summary function
SELECT 
    'STAKING SUMMARY FUNCTION' as analysis_type,
    routine_name,
    routine_type,
    data_type,
    CASE 
        WHEN routine_definition IS NOT NULL THEN 'Function exists with logic'
        ELSE 'Function missing or no definition'
    END as status
FROM information_schema.routines 
WHERE routine_name = 'get_user_staking_summary';

-- ============================================================================
-- SECTION 2: ANALYZE REWARD GENERATION LOGIC
-- ============================================================================

-- 2.1 Check how rewards are generated (should only include CURRENTLY staked assets)
SELECT 
    'REWARD GENERATION LOGIC ANALYSIS' as analysis_type,
    'The generate_daily_staking_rewards() function should:' as description,
    '1. Only process assets in staked_nfts and staked_tokens tables' as rule_1,
    '2. Use 24-hour cutoff (staked_at <= NOW() - INTERVAL ''24 hours'')' as rule_2,
    '3. Calculate rewards based on daily_reward column' as rule_3,
    '4. Store in staking_rewards table with reward_date = CURRENT_DATE' as rule_4;

-- 2.2 Test reward generation logic with sample data
-- Check what assets would be eligible for rewards right now
SELECT 
    'CURRENT ELIGIBLE ASSETS' as analysis_type,
    'staked_nfts' as asset_type,
    wallet_address,
    nft_id,
    daily_reward,
    staked_at,
    NOW() - staked_at as time_staked,
    CASE 
        WHEN staked_at <= NOW() - INTERVAL '24 hours' THEN 'ELIGIBLE FOR REWARDS'
        ELSE 'NOT YET ELIGIBLE (< 24 hours)'
    END as reward_eligibility
FROM staked_nfts
WHERE daily_reward > 0

UNION ALL

SELECT 
    'CURRENT ELIGIBLE ASSETS' as analysis_type,
    'staked_tokens' as asset_type,
    wallet_address,
    amount::text as asset_id,
    daily_reward,
    staked_at,
    NOW() - staked_at as time_staked,
    CASE 
        WHEN staked_at <= NOW() - INTERVAL '24 hours' THEN 'ELIGIBLE FOR REWARDS'
        ELSE 'NOT YET ELIGIBLE (< 24 hours)'
    END as reward_eligibility
FROM staked_tokens
WHERE daily_reward > 0
ORDER BY wallet_address, staked_at DESC;

-- ============================================================================
-- SECTION 3: VERIFY UNSTAKING STOPS REWARDS
-- ============================================================================

-- 3.1 Check if unstaked assets are properly removed from staked tables
SELECT 
    'UNSTAKING VERIFICATION' as analysis_type,
    'When assets are unstaked, they should be REMOVED from staked_nfts/staked_tokens' as expected_behavior,
    'This ensures generate_daily_staking_rewards() will NOT include them in future calculations' as reward_impact;

-- 3.2 Check for any orphaned staking records (this would be a bug)
SELECT 
    'ORPHANED STAKING RECORDS CHECK' as analysis_type,
    COUNT(*) as total_staked_nfts,
    COUNT(CASE WHEN daily_reward > 0 THEN 1 END) as nfts_with_rewards,
    COUNT(CASE WHEN staked_at <= NOW() - INTERVAL '24 hours' THEN 1 END) as nfts_eligible_for_rewards
FROM staked_nfts;

SELECT 
    'ORPHANED STAKING RECORDS CHECK' as analysis_type,
    COUNT(*) as total_staked_tokens,
    COUNT(CASE WHEN daily_reward > 0 THEN 1 END) as tokens_with_rewards,
    COUNT(CASE WHEN staked_at <= NOW() - INTERVAL '24 hours' THEN 1 END) as tokens_eligible_for_rewards
FROM staked_tokens;

-- ============================================================================
-- SECTION 4: ANALYZE PENDING REWARDS ACCUMULATION
-- ============================================================================

-- 4.1 Check how pending rewards are calculated
SELECT 
    'PENDING REWARDS CALCULATION' as analysis_type,
    'Pending rewards = SUM of unclaimed rewards from staking_rewards table' as method,
    'WHERE wallet_address = user AND is_claimed = FALSE' as filter_logic;

-- 4.2 Check current pending rewards for all users
SELECT 
    'CURRENT PENDING REWARDS' as analysis_type,
    wallet_address,
    COUNT(*) as total_reward_records,
    COUNT(CASE WHEN is_claimed = FALSE THEN 1 END) as unclaimed_records,
    SUM(CASE WHEN is_claimed = FALSE THEN reward_amount ELSE 0 END) as total_pending_neft,
    MIN(reward_date) as earliest_reward_date,
    MAX(reward_date) as latest_reward_date
FROM staking_rewards
GROUP BY wallet_address
ORDER BY total_pending_neft DESC;

-- 4.3 Check reward accumulation over time (should increase daily if not claimed)
SELECT 
    'REWARD ACCUMULATION ANALYSIS' as analysis_type,
    reward_date,
    COUNT(DISTINCT wallet_address) as wallets_with_rewards,
    SUM(reward_amount) as total_rewards_generated,
    COUNT(CASE WHEN is_claimed = FALSE THEN 1 END) as unclaimed_count,
    SUM(CASE WHEN is_claimed = FALSE THEN reward_amount ELSE 0 END) as unclaimed_amount
FROM staking_rewards
WHERE reward_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY reward_date
ORDER BY reward_date DESC;

-- ============================================================================
-- SECTION 5: CHECK CRON JOB STATUS
-- ============================================================================

-- 5.1 Check if cron job is properly configured
SELECT 
    'CRON JOB STATUS' as analysis_type,
    jobname,
    schedule,
    command,
    active,
    database,
    CASE 
        WHEN active THEN 'ACTIVE - Will run automatically'
        ELSE 'INACTIVE - Manual execution required'
    END as status
FROM cron.job 
WHERE jobname LIKE '%staking%' OR jobname LIKE '%reward%' OR command LIKE '%generate_daily_staking_rewards%';

-- 5.2 Check recent cron job execution history
SELECT 
    'CRON EXECUTION HISTORY' as analysis_type,
    job_pid,
    status,
    return_message,
    start_time,
    end_time,
    CASE 
        WHEN status = 'succeeded' THEN '✅ SUCCESS'
        WHEN status = 'failed' THEN '❌ FAILED'
        ELSE status
    END as execution_result
FROM cron.job_run_details 
WHERE command LIKE '%generate_daily_staking_rewards%'
ORDER BY start_time DESC 
LIMIT 10;

-- ============================================================================
-- SECTION 6: MANUAL REWARD GENERATION TEST
-- ============================================================================

-- 6.1 Test what would happen if we run reward generation now
SELECT 
    'MANUAL REWARD GENERATION TEST' as analysis_type,
    'Run this to test: SELECT generate_daily_staking_rewards();' as test_command,
    'This will show how many wallets would get rewards processed' as expected_output;

-- 6.2 Check if rewards would be duplicated (should use ON CONFLICT)
SELECT 
    'DUPLICATE PREVENTION CHECK' as analysis_type,
    reward_date,
    wallet_address,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) > 1 THEN '⚠️ DUPLICATE DETECTED'
        ELSE '✅ NO DUPLICATES'
    END as duplicate_status
FROM staking_rewards
WHERE reward_date = CURRENT_DATE
GROUP BY reward_date, wallet_address
HAVING COUNT(*) > 1;

-- ============================================================================
-- SECTION 7: SPECIFIC USER ANALYSIS (Replace with actual wallet)
-- ============================================================================
-- 7.1 Analyze specific user's staking and rewards
-- REPLACE '0x7536d7fC275b67A982e52EBF1f012aF90D33cE68' WITH ACTUAL WALLET ADDRESS
DO $$
DECLARE
    test_wallet TEXT := '0x7536d7fC275b67A982e52EBF1f012aF90D33cE68';
    nft_count INTEGER;
    nft_daily_total DECIMAL(18,8);
    token_amount DECIMAL(18,8);
    token_daily_total DECIMAL(18,8);
    reward_count INTEGER;
    pending_total DECIMAL(18,8);
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'ANALYZING WALLET: %', test_wallet;
    RAISE NOTICE '============================================================================';
    
    -- Check current staked NFTs
    SELECT COUNT(*), COALESCE(SUM(daily_reward), 0)
    INTO nft_count, nft_daily_total
    FROM staked_nfts 
    WHERE wallet_address = test_wallet;
    
    -- Check current staked tokens
    SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(daily_reward), 0)
    INTO token_amount, token_daily_total
    FROM staked_tokens 
    WHERE wallet_address = test_wallet;
    
    -- Check reward history
    SELECT COUNT(*), COALESCE(SUM(CASE WHEN is_claimed = FALSE THEN reward_amount ELSE 0 END), 0)
    INTO reward_count, pending_total
    FROM staking_rewards 
    WHERE wallet_address = test_wallet;
    
    -- Output results
    RAISE NOTICE 'CURRENT STAKED ASSETS:';
    RAISE NOTICE '  NFTs: % (Total Daily: % NEFT)', nft_count, nft_daily_total;
    RAISE NOTICE '  Tokens: % NEFT (Total Daily: % NEFT)', token_amount, token_daily_total;
    RAISE NOTICE 'REWARD HISTORY:';
    RAISE NOTICE '  Total Rewards: % records, % NEFT pending', reward_count, pending_total;
END $$;

-- ============================================================================
-- SECTION 8: RECOMMENDATIONS
-- ============================================================================
SELECT 
    'SYSTEM HEALTH RECOMMENDATIONS' as analysis_type,
    '1. Rewards should STOP immediately after unstaking (assets removed from staked_* tables)' as rule_1,
    '2. Unclaimed rewards should ACCUMULATE daily in staking_rewards table' as rule_2,
    '3. Cron job should run daily at midnight UTC to generate rewards' as rule_3,
    '4. get_user_staking_summary() should return SUM of unclaimed rewards as pending_rewards' as rule_4,
    '5. Manual execution: SELECT generate_daily_staking_rewards(); for immediate testing' as rule_5;
