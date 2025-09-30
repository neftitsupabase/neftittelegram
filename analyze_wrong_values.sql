-- ============================================================================
-- ANALYZE WRONG VALUES IN USER_BALANCES
-- Check what values are actually being added vs what should be added
-- ============================================================================

-- Check current user_balances values
SELECT 'Current user_balances values:' as check;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  current_level,
  last_updated
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check what rewards should be in achievements_master
SELECT 'Expected rewards from achievements_master:' as expected;
SELECT 
  achievement_key,
  title,
  neft_reward,
  xp_reward,
  is_active
FROM achievements_master 
WHERE achievement_key IN ('first_stake', 'first_burn', 'first_quest', 'staking_pro')
ORDER BY achievement_key;

-- Check what the UI shows for rewards (from user_achievements join)
SELECT 'UI display values (from get_user_achievements):' as ui_values;
SELECT 
  ua.achievement_key,
  ua.status,
  ua.claimed_at,
  am.neft_reward as master_neft,
  am.xp_reward as master_xp,
  am.neft_reward as displayed_neft,
  am.xp_reward as displayed_xp
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.achievement_key IN ('first_stake', 'first_burn', 'first_quest', 'staking_pro')
ORDER BY ua.achievement_key;

-- Test claim function to see what it returns
SELECT 'Testing claim function return values:' as test;
SELECT claim_achievement_reward('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', 'first_stake') as claim_test;

-- Check user_achievements table structure first
SELECT 'Check user_achievements table structure:' as structure;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_achievements' 
ORDER BY ordinal_position;

-- Check basic user_achievements data (no reward columns)
SELECT 'Check user_achievements data:' as data;
SELECT 
  achievement_key,
  status,
  current_progress,
  claimed_at,
  completed_at,
  updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Sum up what should be total rewards
SELECT 'Expected total rewards:' as totals;
SELECT 
  SUM(am.neft_reward) as total_expected_neft,
  SUM(am.xp_reward) as total_expected_xp
FROM achievements_master am
WHERE am.achievement_key IN ('first_stake', 'first_burn', 'first_quest', 'staking_pro')
  AND am.is_active = TRUE;
