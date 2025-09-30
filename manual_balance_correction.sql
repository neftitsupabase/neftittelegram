-- ============================================================================
-- MANUAL BALANCE CORRECTION FOR EXCESS VALUES
-- Based on investigation findings - corrects user_balances to expected values
-- ============================================================================

-- Step 1: Calculate the correct expected balance from achievements only
WITH expected_achievement_balance AS (
  SELECT 
    '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' as wallet_address,
    COALESCE(SUM(am.neft_reward), 0) as expected_neft,
    COALESCE(SUM(am.xp_reward), 0) as expected_xp
  FROM user_achievements ua 
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key 
  WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
    AND ua.status = 'completed' 
    AND ua.claimed_at IS NOT NULL
),
current_balance AS (
  SELECT 
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft
  FROM user_balances 
  WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
)
SELECT 
  'BALANCE CORRECTION ANALYSIS:' as analysis,
  eb.wallet_address,
  cb.total_neft_claimed as current_neft,
  eb.expected_neft as expected_neft,
  (cb.total_neft_claimed - eb.expected_neft) as excess_neft,
  cb.total_xp_earned as current_xp,
  eb.expected_xp as expected_xp,
  (cb.total_xp_earned - eb.expected_xp) as excess_xp
FROM expected_achievement_balance eb
LEFT JOIN current_balance cb ON eb.wallet_address = cb.wallet_address;

-- Step 2: Show what the correction will do
SELECT 'PROPOSED CORRECTION:' as correction_info;
SELECT 'This will set the balance to ONLY achievement rewards (1300 NEFT, 650 XP)' as note_1;
SELECT 'If you want to include other legitimate rewards, modify the calculation below' as note_2;

-- Step 3: Backup current balance before correction
CREATE TEMP TABLE balance_backup AS
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated,
  'backup_' || EXTRACT(EPOCH FROM NOW()) as backup_id
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

SELECT 'BACKUP CREATED:' as backup_status;
SELECT * FROM balance_backup;

-- Step 4: Calculate correct values (achievements only for now)
WITH correct_balance AS (
  SELECT 
    COALESCE(SUM(am.neft_reward), 0) as correct_neft,
    COALESCE(SUM(am.xp_reward), 0) as correct_xp
  FROM user_achievements ua 
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key 
  WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
    AND ua.status = 'completed' 
    AND ua.claimed_at IS NOT NULL
)
-- Step 5: Apply the correction
UPDATE user_balances SET
  total_neft_claimed = (SELECT correct_neft FROM correct_balance),
  total_xp_earned = (SELECT correct_xp FROM correct_balance),
  available_neft = (SELECT correct_neft FROM correct_balance), -- Assuming no staked amount
  last_updated = NOW()
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Step 6: Verify the correction
SELECT 'CORRECTION APPLIED - VERIFICATION:' as verification;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated,
  'Should be 1300 NEFT, 650 XP' as expected_values
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Step 7: Show the difference
WITH correction_summary AS (
  SELECT 
    bb.total_neft_claimed as old_neft,
    ub.total_neft_claimed as new_neft,
    (bb.total_neft_claimed - ub.total_neft_claimed) as neft_reduction,
    bb.total_xp_earned as old_xp,
    ub.total_xp_earned as new_xp,
    (bb.total_xp_earned - ub.total_xp_earned) as xp_reduction
  FROM balance_backup bb
  CROSS JOIN user_balances ub
  WHERE ub.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
)
SELECT 
  'CORRECTION SUMMARY:' as summary,
  old_neft,
  new_neft,
  neft_reduction as excess_neft_removed,
  old_xp,
  new_xp,
  xp_reduction as excess_xp_removed
FROM correction_summary;

-- Step 8: Optional - Temporarily disable triggers to prevent re-aggregation
SELECT 'OPTIONAL TRIGGER MANAGEMENT:' as trigger_info;
SELECT 'To prevent triggers from re-adding excess values, you may want to:' as step_1;
SELECT '1. ALTER TABLE user_balances DISABLE TRIGGER ALL;' as disable_cmd;
SELECT '2. Make your corrections' as step_2;
SELECT '3. ALTER TABLE user_balances ENABLE TRIGGER ALL;' as enable_cmd;
SELECT 'Only do this if you understand the implications!' as warning;

-- Step 9: Recommendations for preventing future excess values
SELECT 'PREVENTION RECOMMENDATIONS:' as prevention;
SELECT '1. Add validation checks in the comprehensive aggregation function' as rec_1;
SELECT '2. Implement balance change logging to track when excess values appear' as rec_2;
SELECT '3. Add constraints to prevent negative balances or unrealistic values' as rec_3;
SELECT '4. Consider using a balance audit table to track all changes' as rec_4;
SELECT '5. Review and optimize trigger execution order' as rec_5;

SELECT 'MANUAL BALANCE CORRECTION COMPLETED!' as completion_status;
