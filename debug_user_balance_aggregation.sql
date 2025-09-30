-- ============================================================================
-- DEBUG USER BALANCE AGGREGATION - IDENTIFY WRONG VALUES
-- Since user_balance service aggregates ALL rewards, let's find what's wrong
-- Expected: Achievement rewards (1300 NEFT) + Other legitimate rewards
-- ============================================================================

-- Step 1: Get current user_balances value
SELECT 'CURRENT USER_BALANCES VALUE:' as current_value;
SELECT 
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Step 2: Break down each reward source to identify wrong values
SELECT 'BREAKDOWN BY REWARD SOURCE:' as breakdown_header;

-- Achievement rewards (should be 1300 NEFT, 650 XP)
SELECT 'ACHIEVEMENT REWARDS:' as source_1;
SELECT 
  'Achievements' as source,
  COALESCE(SUM(am.neft_reward), 0) as neft_amount,
  COALESCE(SUM(am.xp_reward), 0) as xp_amount,
  COUNT(*) as count,
  array_agg(ua.achievement_key || ' (' || am.neft_reward || ' NEFT)') as details
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
  AND ua.status = 'completed' 
  AND ua.claimed_at IS NOT NULL;

-- Daily claims
SELECT 'DAILY CLAIMS:' as source_2;
SELECT 
  'Daily Claims' as source,
  COALESCE(SUM(base_neft_reward + bonus_neft_reward), 0) as neft_amount,
  COALESCE(SUM(base_xp_reward + bonus_xp_reward), 0) as xp_amount,
  COUNT(*) as count,
  'Check if these are legitimate or duplicated' as note
FROM daily_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Campaign rewards
SELECT 'CAMPAIGN REWARDS:' as source_3;
SELECT 
  'Campaign Rewards' as source,
  COALESCE(SUM(neft_reward), 0) as neft_amount,
  COALESCE(SUM(xp_reward), 0) as xp_amount,
  COUNT(*) as count,
  'Check if these are legitimate or duplicated' as note
FROM campaign_reward_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Staking rewards
SELECT 'STAKING REWARDS:' as source_4;
SELECT 
  'Staking Rewards' as source,
  COALESCE(SUM(total_nft_claimed + total_token_claimed), 0) as neft_amount,
  0 as xp_amount,
  COUNT(*) as count,
  'Check if these are legitimate or duplicated' as note
FROM staking_rewards 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
  AND claimed = true;

-- Referral rewards
SELECT 'REFERRAL REWARDS:' as source_5;
SELECT 
  'Referral Rewards' as source,
  COALESCE(SUM(neft_reward), 0) as neft_amount,
  0 as xp_amount,
  COUNT(*) as count,
  'Check if these are legitimate or duplicated' as note
FROM referral_rewards 
WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Step 3: Calculate expected total and compare
SELECT 'EXPECTED vs ACTUAL COMPARISON:' as comparison_header;

WITH source_totals AS (
  SELECT 
    COALESCE((SELECT SUM(am.neft_reward) FROM user_achievements ua JOIN achievements_master am ON ua.achievement_key = am.achievement_key WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.status = 'completed' AND ua.claimed_at IS NOT NULL), 0) as achievement_neft,
    COALESCE((SELECT SUM(am.xp_reward) FROM user_achievements ua JOIN achievements_master am ON ua.achievement_key = am.achievement_key WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.status = 'completed' AND ua.claimed_at IS NOT NULL), 0) as achievement_xp,
    COALESCE((SELECT SUM(base_neft_reward + bonus_neft_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as daily_neft,
    COALESCE((SELECT SUM(base_xp_reward + bonus_xp_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as daily_xp,
    COALESCE((SELECT SUM(neft_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as campaign_neft,
    COALESCE((SELECT SUM(xp_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as campaign_xp,
    COALESCE((SELECT SUM(total_nft_claimed + total_token_claimed) FROM staking_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND claimed = true), 0) as staking_neft,
    COALESCE((SELECT SUM(neft_reward) FROM referral_rewards WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as referral_neft
),
calculated_totals AS (
  SELECT 
    achievement_neft + daily_neft + campaign_neft + staking_neft + referral_neft as expected_total_neft,
    achievement_xp + daily_xp + campaign_xp as expected_total_xp,
    achievement_neft, daily_neft, campaign_neft, staking_neft, referral_neft,
    achievement_xp, daily_xp, campaign_xp
  FROM source_totals
),
actual_balance AS (
  SELECT 
    total_neft_claimed as actual_neft,
    total_xp_earned as actual_xp
  FROM user_balances 
  WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
)
SELECT 
  'Expected Total NEFT' as metric,
  ct.expected_total_neft as expected_value,
  ab.actual_neft as actual_value,
  (ab.actual_neft - ct.expected_total_neft) as difference,
  CASE 
    WHEN ab.actual_neft > ct.expected_total_neft THEN 'EXCESS - Check for duplicates or wrong aggregation'
    WHEN ab.actual_neft < ct.expected_total_neft THEN 'MISSING - Check for missing rewards'
    ELSE 'MATCHES'
  END as status
FROM calculated_totals ct, actual_balance ab

UNION ALL

SELECT 
  'Expected Total XP' as metric,
  ct.expected_total_xp::DECIMAL as expected_value,
  ab.actual_xp::DECIMAL as actual_value,
  (ab.actual_xp - ct.expected_total_xp)::DECIMAL as difference,
  CASE 
    WHEN ab.actual_xp > ct.expected_total_xp THEN 'EXCESS - Check for duplicates or wrong aggregation'
    WHEN ab.actual_xp < ct.expected_total_xp THEN 'MISSING - Check for missing rewards'
    ELSE 'MATCHES'
  END as status
FROM calculated_totals ct, actual_balance ab;

-- Step 4: Check for potential duplicate entries or wrong aggregation
SELECT 'CHECKING FOR POTENTIAL ISSUES:' as issues_header;

-- Check for duplicate achievement claims
SELECT 'DUPLICATE ACHIEVEMENT CLAIMS:' as duplicate_check;
SELECT 
  achievement_key,
  COUNT(*) as claim_count,
  array_agg(claimed_at) as claim_timestamps
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND claimed_at IS NOT NULL
GROUP BY achievement_key
HAVING COUNT(*) > 1;

-- Check for rapid successive claims (potential double-processing)
SELECT 'RAPID SUCCESSIVE CLAIMS:' as rapid_claims;
SELECT 
  table_name,
  claim_time,
  LAG(claim_time) OVER (ORDER BY claim_time) as previous_claim,
  claim_time - LAG(claim_time) OVER (ORDER BY claim_time) as time_diff
FROM (
  SELECT 'achievements' as table_name, claimed_at as claim_time FROM user_achievements WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND claimed_at IS NOT NULL
  UNION ALL
  SELECT 'daily_claims' as table_name, updated_at as claim_time FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  UNION ALL
  SELECT 'campaign_rewards' as table_name, claimed_at as claim_time FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
) all_claims
ORDER BY claim_time;

-- Step 5: Recommendation
SELECT 'NEXT STEPS:' as next_steps_header;
SELECT 'If difference > 0: Look for duplicate entries, wrong reward amounts, or double-processing' as step_1;
SELECT 'If difference < 0: Look for missing rewards or failed aggregation' as step_2;
SELECT 'Check the timestamps to identify when wrong values were added' as step_3;
SELECT 'Review the comprehensive balance aggregation triggers and functions' as step_4;
