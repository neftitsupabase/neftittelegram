-- ============================================================================
-- ANALYZE BALANCE CACHE ISSUE
-- Check for wrong values in user_balances vs actual claimed achievements
-- ============================================================================

-- Expected balance calculation based on claimed achievements
SELECT 'EXPECTED BALANCE CALCULATION:' as calculation;
SELECT 
  'first_stake: 200 NEFT, 100 XP (claimed)' as achievement_1,
  'first_quest: 100 NEFT, 50 XP (claimed)' as achievement_2,
  'staking_pro: 1000 NEFT, 500 XP (claimed)' as achievement_3,
  'first_burn: 150 NEFT, 75 XP (NOT claimed yet)' as achievement_4,
  '---' as separator,
  'EXPECTED TOTAL: 1300 NEFT, 650 XP' as expected_total;

-- Check actual user_balances values
SELECT 'ACTUAL USER_BALANCES VALUES:' as actual;
SELECT 
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Calculate the discrepancy
SELECT 'DISCREPANCY ANALYSIS:' as discrepancy;
SELECT 
  ub.total_neft_claimed as actual_neft,
  1300 as expected_neft,
  (ub.total_neft_claimed - 1300) as neft_difference,
  ub.total_xp_earned as actual_xp,
  650 as expected_xp,
  (ub.total_xp_earned - 650) as xp_difference,
  CASE 
    WHEN ub.total_neft_claimed > 1300 THEN 'EXCESS VALUES DETECTED'
    WHEN ub.total_neft_claimed < 1300 THEN 'MISSING VALUES DETECTED'
    ELSE 'VALUES MATCH'
  END as status
FROM user_balances ub
WHERE ub.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check for multiple claim entries or cache issues
SELECT 'CHECK FOR DUPLICATE CLAIMS:' as duplicate_check;
SELECT 
  achievement_key,
  claimed_at,
  COUNT(*) as claim_count
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND claimed_at IS NOT NULL
GROUP BY achievement_key, claimed_at
HAVING COUNT(*) > 1;

-- Check for any balance aggregation functions or triggers
SELECT 'CHECK FOR BALANCE AGGREGATION FUNCTIONS:' as functions;
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name ILIKE '%balance%' 
   OR routine_name ILIKE '%aggregate%'
   OR routine_name ILIKE '%total%'
   OR routine_definition ILIKE '%user_balances%'
ORDER BY routine_name;

-- Check for triggers on user_balances table
SELECT 'CHECK FOR TRIGGERS ON USER_BALANCES:' as triggers;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'user_balances';

-- Check claim history with timestamps to detect rapid multiple claims
SELECT 'CLAIM HISTORY TIMELINE:' as timeline;
SELECT 
  ua.achievement_key,
  ua.claimed_at,
  am.neft_reward,
  am.xp_reward,
  LAG(ua.claimed_at) OVER (ORDER BY ua.claimed_at) as previous_claim,
  ua.claimed_at - LAG(ua.claimed_at) OVER (ORDER BY ua.claimed_at) as time_between_claims
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.claimed_at IS NOT NULL
ORDER BY ua.claimed_at;

-- Check if there are any cached values in other tables
SELECT 'CHECK FOR CACHED BALANCE VALUES:' as cache_check;
SELECT 
  table_name,
  column_name
FROM information_schema.columns 
WHERE column_name ILIKE '%neft%' 
   OR column_name ILIKE '%balance%'
   OR column_name ILIKE '%total%'
ORDER BY table_name, column_name;
