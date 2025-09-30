-- ============================================================================
-- INVESTIGATE TRIGGER AGGREGATION ISSUES
-- Since no obvious duplicates found, check trigger execution and aggregation logic
-- ============================================================================

-- Step 1: Check if comprehensive balance aggregation is causing double-counting
SELECT 'COMPREHENSIVE AGGREGATION FUNCTION ANALYSIS:' as aggregation_analysis;

-- Test the comprehensive aggregation function directly
SELECT 'TESTING COMPREHENSIVE AGGREGATION FUNCTION:' as test_function;
SELECT aggregate_user_rewards_from_all_sources('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as comprehensive_result;

-- Step 2: Check user_balances update history
SELECT 'USER_BALANCES UPDATE HISTORY:' as update_history;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated,
  'Check when balance was last updated' as note
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Step 3: Check if triggers are firing multiple times
SELECT 'TRIGGER EXECUTION ANALYSIS:' as trigger_analysis;

-- Check PostgreSQL logs for trigger executions (if available)
SELECT 'CHECKING FOR TRIGGER LOGS:' as trigger_logs;
-- Note: This requires log_statement = 'all' in postgresql.conf
-- Check pg_stat_user_functions for trigger function calls
SELECT 
  funcname,
  calls,
  total_time,
  self_time,
  'High call count may indicate multiple trigger executions' as note
FROM pg_stat_user_functions 
WHERE funcname ILIKE '%balance%' 
   OR funcname ILIKE '%trigger%'
   OR funcname ILIKE '%sync%'
ORDER BY calls DESC;

-- Step 4: Check for balance aggregation inconsistencies
SELECT 'BALANCE AGGREGATION INCONSISTENCY CHECK:' as inconsistency_check;

-- Manual calculation vs comprehensive function
WITH manual_calc AS (
  SELECT 
    COALESCE((SELECT SUM(am.neft_reward) FROM user_achievements ua JOIN achievements_master am ON ua.achievement_key = am.achievement_key WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.status = 'completed' AND ua.claimed_at IS NOT NULL), 0) as manual_achievement_neft,
    COALESCE((SELECT SUM(base_neft_reward + bonus_neft_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as manual_daily_neft,
    COALESCE((SELECT SUM(neft_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as manual_campaign_neft,
    COALESCE((SELECT SUM(total_nft_claimed + total_token_claimed) FROM staking_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND claimed = true), 0) as manual_staking_neft,
    COALESCE((SELECT SUM(neft_reward) FROM referral_rewards WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as manual_referral_neft
),
comprehensive_calc AS (
  SELECT 
    (aggregate_user_rewards_from_all_sources('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->>'total_neft_claimed')::DECIMAL as comprehensive_neft,
    (aggregate_user_rewards_from_all_sources('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->'breakdown'->>'achievement_neft')::DECIMAL as comprehensive_achievement_neft,
    (aggregate_user_rewards_from_all_sources('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->'breakdown'->>'daily_neft')::DECIMAL as comprehensive_daily_neft,
    (aggregate_user_rewards_from_all_sources('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->'breakdown'->>'campaign_neft')::DECIMAL as comprehensive_campaign_neft,
    (aggregate_user_rewards_from_all_sources('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->'breakdown'->>'staking_neft')::DECIMAL as comprehensive_staking_neft,
    (aggregate_user_rewards_from_all_sources('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->'breakdown'->>'referral_neft')::DECIMAL as comprehensive_referral_neft
)
SELECT 
  'Manual Calculation' as method,
  (manual_achievement_neft + manual_daily_neft + manual_campaign_neft + manual_staking_neft + manual_referral_neft) as total_neft,
  manual_achievement_neft as achievement_neft,
  manual_daily_neft as daily_neft,
  manual_campaign_neft as campaign_neft,
  manual_staking_neft as staking_neft,
  manual_referral_neft as referral_neft
FROM manual_calc

UNION ALL

SELECT 
  'Comprehensive Function' as method,
  comprehensive_neft as total_neft,
  comprehensive_achievement_neft as achievement_neft,
  comprehensive_daily_neft as daily_neft,
  comprehensive_campaign_neft as campaign_neft,
  comprehensive_staking_neft as staking_neft,
  comprehensive_referral_neft as referral_neft
FROM comprehensive_calc

UNION ALL

SELECT 
  'Difference' as method,
  (comprehensive_neft - (manual_achievement_neft + manual_daily_neft + manual_campaign_neft + manual_staking_neft + manual_referral_neft)) as total_neft,
  (comprehensive_achievement_neft - manual_achievement_neft) as achievement_neft,
  (comprehensive_daily_neft - manual_daily_neft) as daily_neft,
  (comprehensive_campaign_neft - manual_campaign_neft) as campaign_neft,
  (comprehensive_staking_neft - manual_staking_neft) as staking_neft,
  (comprehensive_referral_neft - manual_referral_neft) as referral_neft
FROM manual_calc, comprehensive_calc;

-- Step 5: Check for potential trigger race conditions
SELECT 'TRIGGER RACE CONDITION CHECK:' as race_condition_check;

-- Check if multiple triggers updated user_balances recently
SELECT 
  'Recent balance updates (check for rapid successive updates):' as check_type,
  last_updated,
  total_neft_claimed,
  total_xp_earned,
  'Look for multiple updates within seconds of each other' as note
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Step 6: Check for potential caching or stored procedure issues
SELECT 'STORED PROCEDURE AND CACHING CHECK:' as cache_check;

-- Check if there are any cached balance values in other tables (if they exist)
SELECT 'CHECKING FOR POTENTIAL CACHE TABLES:' as cache_tables;

-- Check if user_activity_stats table exists and has conflicting data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activity_stats') THEN
    RAISE NOTICE 'USER_ACTIVITY_STATS table exists - checking for conflicts';
    PERFORM 1 FROM user_activity_stats WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';
  ELSE
    RAISE NOTICE 'USER_ACTIVITY_STATS table does not exist';
  END IF;
END $$;

-- Check if user_streaks table exists and has conflicting data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_streaks') THEN
    RAISE NOTICE 'USER_STREAKS table exists - checking for conflicts';
    PERFORM 1 FROM user_streaks WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';
  ELSE
    RAISE NOTICE 'USER_STREAKS table does not exist';
  END IF;
END $$;

-- Step 7: Recommendations for fixing the issue
SELECT 'RECOMMENDATIONS TO FIX EXCESS VALUES:' as recommendations;
SELECT '1. Temporarily disable balance aggregation triggers' as rec_1;
SELECT '2. Manually recalculate and update user_balances with correct values' as rec_2;
SELECT '3. Add logging to comprehensive aggregation function to track execution' as rec_3;
SELECT '4. Implement balance validation checks before each update' as rec_4;
SELECT '5. Consider using a queue-based balance update system instead of triggers' as rec_5;

-- Step 8: Proposed fix - Manual balance correction
SELECT 'PROPOSED MANUAL FIX:' as manual_fix;
SELECT 'UPDATE user_balances SET' as fix_step_1;
SELECT '  total_neft_claimed = (calculated_correct_amount),' as fix_step_2;
SELECT '  total_xp_earned = (calculated_correct_amount),' as fix_step_3;
SELECT '  available_neft = (calculated_correct_amount),' as fix_step_4;
SELECT '  last_updated = NOW()' as fix_step_5;
SELECT 'WHERE wallet_address = ''0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'';' as fix_step_6;
