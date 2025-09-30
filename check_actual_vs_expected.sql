-- ============================================================================
-- CHECK ACTUAL VS EXPECTED VALUES
-- Compare what's in user_balances vs what should be there
-- ============================================================================

-- What's currently in user_balances
SELECT 'ACTUAL VALUES in user_balances:' as actual;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- What SHOULD be there (expected totals)
SELECT 'EXPECTED VALUES:' as expected;
SELECT 
  '1450.00' as expected_total_neft,
  '725' as expected_total_xp,
  '1450.00' as expected_available_neft;

-- Calculate the difference
SELECT 'DIFFERENCE (Actual - Expected):' as difference;
SELECT 
  ub.total_neft_claimed - 1450.00 as neft_difference,
  ub.total_xp_earned - 725 as xp_difference,
  ub.available_neft - 1450.00 as available_neft_difference
FROM user_balances ub
WHERE ub.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check which achievements are marked as claimed
SELECT 'CLAIMED ACHIEVEMENTS:' as claimed;
SELECT 
  ua.achievement_key,
  ua.claimed_at,
  am.neft_reward,
  am.xp_reward
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.claimed_at IS NOT NULL
ORDER BY ua.claimed_at;

-- Test what claim function would return for unclaimed achievements
SELECT 'TEST CLAIM FUNCTION:' as test;
SELECT 
  ua.achievement_key,
  ua.status,
  ua.claimed_at,
  claim_achievement_reward('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', ua.achievement_key) as claim_result
FROM user_achievements ua
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.status = 'completed'
  AND ua.claimed_at IS NULL
LIMIT 1;
