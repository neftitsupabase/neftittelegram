-- ============================================================================
-- FIX BALANCE DISCREPANCY
-- Reset user_balances to correct values based on actual claimed achievements
-- ============================================================================

-- First, check current state
SELECT 'CURRENT STATE:' as status;
SELECT 
  'user_balances' as table_name,
  total_neft_claimed,
  total_xp_earned,
  available_neft
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check which achievements are actually claimed
SELECT 'CLAIMED ACHIEVEMENTS:' as claimed;
SELECT 
  ua.achievement_key,
  ua.claimed_at,
  am.neft_reward,
  am.xp_reward
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.claimed_at IS NOT NULL;

-- Calculate correct totals based on actually claimed achievements
SELECT 'CORRECT TOTALS (based on claimed achievements):' as correct;
SELECT 
  COALESCE(SUM(am.neft_reward), 0) as correct_total_neft,
  COALESCE(SUM(am.xp_reward), 0) as correct_total_xp,
  COALESCE(SUM(am.neft_reward), 0) as correct_available_neft
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.claimed_at IS NOT NULL;

-- Reset user_balances to correct values
UPDATE user_balances 
SET 
  total_neft_claimed = (
    SELECT COALESCE(SUM(am.neft_reward), 0)
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
      AND ua.claimed_at IS NOT NULL
  ),
  total_xp_earned = (
    SELECT COALESCE(SUM(am.xp_reward), 0)
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
      AND ua.claimed_at IS NOT NULL
  ),
  available_neft = (
    SELECT COALESCE(SUM(am.neft_reward), 0)
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
      AND ua.claimed_at IS NOT NULL
  ),
  last_updated = NOW()
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Verify the fix
SELECT 'AFTER FIX:' as after_fix;
SELECT 
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

SELECT 'Balance reset complete! Now claim rewards should work correctly.' as result;
