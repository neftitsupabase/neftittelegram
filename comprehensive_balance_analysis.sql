-- ============================================================================
-- COMPREHENSIVE BALANCE AGGREGATION ANALYSIS
-- Check UI card values vs achievements_master vs actual claim behavior
-- ============================================================================

-- 1. Check what UI shows (get_user_achievements function result)
SELECT 'UI CARD VALUES (what user sees):' as ui_display;
SELECT get_user_achievements('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', NULL) as ui_data;

-- 2. Check achievements_master raw values
SELECT 'ACHIEVEMENTS_MASTER VALUES (source of truth):' as master_values;
SELECT 
  achievement_key,
  title,
  neft_reward,
  xp_reward,
  required_count,
  is_active
FROM achievements_master 
WHERE achievement_key IN ('first_stake', 'first_burn', 'first_quest', 'staking_pro')
ORDER BY achievement_key;

-- 3. Check user_achievements status
SELECT 'USER_ACHIEVEMENTS STATUS:' as user_status;
SELECT 
  achievement_key,
  status,
  current_progress,
  completed_at,
  claimed_at,
  updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND achievement_key IN ('first_stake', 'first_burn', 'first_quest', 'staking_pro')
ORDER BY achievement_key;

-- 4. Test claim function step by step for each achievement
SELECT 'CLAIM FUNCTION TEST - first_stake:' as test1;
SELECT claim_achievement_reward('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', 'first_stake') as result1;

-- 5. Check current user_balances
SELECT 'CURRENT USER_BALANCES:' as current_balance;
SELECT 
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- 6. Check if there are any balance aggregation triggers or functions
SELECT 'CHECK FOR BALANCE AGGREGATION FUNCTIONS:' as aggregation_check;
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%balance%' OR routine_name LIKE '%aggregate%'
ORDER BY routine_name;

-- 7. Check if there are any triggers on user_balances table
SELECT 'CHECK FOR TRIGGERS ON USER_BALANCES:' as triggers;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'user_balances';

-- 8. Manual calculation of what balance should be after claiming all 4
SELECT 'MANUAL CALCULATION - What balance should be:' as manual_calc;
SELECT 
  200 + 150 + 100 + 1000 as expected_total_neft,
  100 + 75 + 50 + 500 as expected_total_xp,
  'After claiming all 4 completed achievements' as note;

-- 9. Check if get_user_achievements shows correct reward values
SELECT 'VERIFY UI REWARD VALUES:' as verify_ui;
SELECT 
  ua.achievement_key,
  am.neft_reward as master_neft,
  am.xp_reward as master_xp,
  ua.status,
  ua.claimed_at
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.status = 'completed'
ORDER BY ua.achievement_key;
