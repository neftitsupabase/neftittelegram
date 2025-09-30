-- ============================================================================
-- REVIEW COMPREHENSIVE BALANCE AGGREGATION TRIGGERS AND FUNCTIONS
-- Analyze the balance aggregation system to identify potential issues
-- ============================================================================

-- Step 1: Check all active triggers on reward tables
SELECT 'ACTIVE TRIGGERS ON REWARD TABLES:' as trigger_review;
SELECT 
  t.trigger_name,
  t.event_object_table as table_name,
  t.action_timing,
  t.event_manipulation,
  t.action_statement
FROM information_schema.triggers t
WHERE t.event_object_table IN (
  'user_achievements',
  'daily_claims', 
  'campaign_reward_claims',
  'staking_rewards',
  'referral_rewards',
  'user_balances'
)
ORDER BY t.event_object_table, t.trigger_name;

-- Step 2: Check balance aggregation functions
SELECT 'BALANCE AGGREGATION FUNCTIONS:' as function_review;
SELECT 
  routine_name,
  routine_type,
  CASE 
    WHEN routine_definition LIKE '%user_balances%' THEN 'Updates user_balances'
    WHEN routine_definition LIKE '%aggregate%' THEN 'Aggregation function'
    WHEN routine_definition LIKE '%sync%' THEN 'Sync function'
    ELSE 'Other'
  END as function_purpose
FROM information_schema.routines 
WHERE routine_name ILIKE '%balance%' 
   OR routine_name ILIKE '%aggregate%'
   OR routine_name ILIKE '%sync%'
   OR routine_definition ILIKE '%user_balances%'
ORDER BY routine_name;

-- Step 3: Check for potential double-triggering issues
SELECT 'POTENTIAL DOUBLE-TRIGGERING ANALYSIS:' as double_trigger_check;
SELECT 
  trigger_name,
  event_object_table,
  COUNT(*) as trigger_count,
  array_agg(action_timing || ' ' || event_manipulation) as trigger_events
FROM information_schema.triggers
WHERE event_object_table IN ('user_achievements', 'daily_claims', 'campaign_reward_claims', 'staking_rewards')
GROUP BY trigger_name, event_object_table
HAVING COUNT(*) > 1;

-- Step 4: Check the comprehensive balance aggregation function specifically
SELECT 'COMPREHENSIVE AGGREGATION FUNCTION DETAILS:' as aggregation_details;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'aggregate_user_rewards_from_all_sources'
   OR routine_name = 'sync_user_balance_from_all_sources'
   OR routine_name = 'trigger_comprehensive_balance_sync';

-- Step 5: Check for conflicting balance update mechanisms
SELECT 'CONFLICTING BALANCE UPDATE MECHANISMS:' as conflict_check;
SELECT 
  routine_name,
  CASE 
    WHEN routine_definition ILIKE '%INSERT INTO user_balances%' THEN 'Direct INSERT'
    WHEN routine_definition ILIKE '%UPDATE user_balances%' THEN 'Direct UPDATE'
    WHEN routine_definition ILIKE '%ON CONFLICT%' THEN 'UPSERT'
    ELSE 'Other'
  END as update_mechanism
FROM information_schema.routines 
WHERE routine_definition ILIKE '%user_balances%'
ORDER BY routine_name;

-- Step 6: Check for recursive trigger issues
SELECT 'RECURSIVE TRIGGER ANALYSIS:' as recursive_check;
SELECT 
  t1.trigger_name as trigger_1,
  t1.event_object_table as table_1,
  t2.trigger_name as trigger_2,
  t2.event_object_table as table_2,
  'Potential recursive loop if triggers update each other' as warning
FROM information_schema.triggers t1
JOIN information_schema.triggers t2 ON t1.event_object_table != t2.event_object_table
WHERE t1.event_object_table = 'user_balances' 
  AND t2.event_object_table IN ('user_achievements', 'daily_claims', 'campaign_reward_claims', 'staking_rewards')
  AND t1.action_statement ILIKE '%' || t2.event_object_table || '%';

-- Step 7: Check trigger execution order
SELECT 'TRIGGER EXECUTION ORDER:' as execution_order;
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  'Check if BEFORE triggers might interfere with AFTER triggers' as note
FROM information_schema.triggers
WHERE event_object_table IN ('user_achievements', 'daily_claims', 'campaign_reward_claims', 'staking_rewards', 'user_balances')
ORDER BY event_object_table, action_timing, trigger_name;

-- Step 8: Identify potential issues
SELECT 'POTENTIAL ISSUES IDENTIFIED:' as issues_header;
SELECT 'Issue 1: Multiple triggers on same table could cause double-processing' as issue_1;
SELECT 'Issue 2: Triggers updating user_balances while other triggers read from it' as issue_2;
SELECT 'Issue 3: Comprehensive aggregation might be called multiple times per transaction' as issue_3;
SELECT 'Issue 4: Achievement claim triggers might fire before balance aggregation completes' as issue_4;

-- Step 9: Recommendations
SELECT 'RECOMMENDATIONS:' as recommendations_header;
SELECT '1. Disable triggers temporarily and manually sync balances to test' as rec_1;
SELECT '2. Add logging to trigger functions to track execution order' as rec_2;
SELECT '3. Consider using a single trigger per table with proper error handling' as rec_3;
SELECT '4. Implement transaction-level balance updates instead of row-level' as rec_4;
SELECT '5. Add balance validation checks to detect inconsistencies' as rec_5;
