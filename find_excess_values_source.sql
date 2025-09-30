-- ============================================================================
-- FIND EXCESS VALUES SOURCE
-- Identify which specific reward source is adding excess values to user_balances
-- ============================================================================

-- Step 1: Check each reward source individually for duplicates or wrong amounts
SELECT 'CHECKING EACH REWARD SOURCE FOR EXCESS VALUES:' as source_check;

-- Check achievements (should be exactly 1300 NEFT, 650 XP)
SELECT 'ACHIEVEMENT REWARDS ANALYSIS:' as achievement_check;
SELECT 
  ua.achievement_key,
  am.neft_reward,
  am.xp_reward,
  ua.status,
  ua.claimed_at,
  COUNT(*) as claim_count,
  'Expected: 1 claim per achievement' as note
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.claimed_at IS NOT NULL
GROUP BY ua.achievement_key, am.neft_reward, am.xp_reward, ua.status, ua.claimed_at
ORDER BY ua.achievement_key;

-- Check for duplicate achievement claims
SELECT 'DUPLICATE ACHIEVEMENT CLAIMS:' as duplicate_achievements;
SELECT 
  ua.achievement_key,
  COUNT(*) as total_claims,
  array_agg(ua.claimed_at) as claim_timestamps,
  SUM(am.neft_reward) as total_neft_from_duplicates,
  SUM(am.xp_reward) as total_xp_from_duplicates
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.claimed_at IS NOT NULL
GROUP BY ua.achievement_key
HAVING COUNT(*) > 1;

-- Check daily claims for suspicious amounts
SELECT 'DAILY CLAIMS ANALYSIS:' as daily_claims_check;
SELECT 
  claim_date,
  base_neft_reward,
  bonus_neft_reward,
  base_xp_reward,
  bonus_xp_reward,
  (base_neft_reward + bonus_neft_reward) as total_neft_per_day,
  (base_xp_reward + bonus_xp_reward) as total_xp_per_day,
  updated_at,
  'Check for unusually high daily rewards' as note
FROM daily_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
ORDER BY claim_date DESC;

-- Check for duplicate daily claims on same date
SELECT 'DUPLICATE DAILY CLAIMS:' as duplicate_daily;
SELECT 
  claim_date,
  COUNT(*) as claims_per_date,
  SUM(base_neft_reward + bonus_neft_reward) as total_neft_per_date,
  SUM(base_xp_reward + bonus_xp_reward) as total_xp_per_date,
  array_agg(updated_at) as claim_timestamps
FROM daily_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
GROUP BY claim_date
HAVING COUNT(*) > 1;

-- Check campaign rewards for excess
SELECT 'CAMPAIGN REWARDS ANALYSIS:' as campaign_check;
SELECT 
  project_id,
  neft_reward,
  xp_reward,
  claimed_at,
  COUNT(*) as claims_per_project
FROM campaign_reward_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
GROUP BY project_id, neft_reward, xp_reward, claimed_at
ORDER BY claimed_at DESC;

-- Check staking rewards for excess
SELECT 'STAKING REWARDS ANALYSIS:' as staking_check;
SELECT 
  reward_date,
  total_nft_claimed,
  total_token_claimed,
  (total_nft_claimed + total_token_claimed) as total_claimed,
  claimed,
  created_at,
  last_updated
FROM staking_rewards 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND claimed = true
ORDER BY reward_date DESC;

-- Check referral rewards for excess
SELECT 'REFERRAL REWARDS ANALYSIS:' as referral_check;
SELECT 
  referred_wallet,
  neft_reward,
  status,
  completed_at,
  COUNT(*) as referral_count
FROM referral_rewards 
WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
GROUP BY referred_wallet, neft_reward, status, completed_at
ORDER BY completed_at DESC;

-- Step 2: Calculate excess amount per source
SELECT 'EXCESS CALCULATION BY SOURCE:' as excess_calc;

-- Total from each source
WITH source_totals AS (
  SELECT 
    COALESCE((SELECT SUM(am.neft_reward) FROM user_achievements ua JOIN achievements_master am ON ua.achievement_key = am.achievement_key WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.status = 'completed' AND ua.claimed_at IS NOT NULL), 0) as achievement_neft,
    COALESCE((SELECT SUM(base_neft_reward + bonus_neft_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as daily_neft,
    COALESCE((SELECT SUM(neft_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as campaign_neft,
    COALESCE((SELECT SUM(total_nft_claimed + total_token_claimed) FROM staking_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND claimed = true), 0) as staking_neft,
    COALESCE((SELECT SUM(neft_reward) FROM referral_rewards WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as referral_neft,
    (SELECT total_neft_claimed FROM user_balances WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as current_balance
)
SELECT 
  'Achievements' as source,
  achievement_neft as amount,
  CASE WHEN achievement_neft > 1300 THEN 'EXCESS: ' || (achievement_neft - 1300) ELSE 'OK' END as status
FROM source_totals

UNION ALL

SELECT 
  'Daily Claims' as source,
  daily_neft as amount,
  CASE WHEN daily_neft > 0 THEN 'CHECK: ' || daily_neft || ' (verify if legitimate)' ELSE 'None' END as status
FROM source_totals

UNION ALL

SELECT 
  'Campaign Rewards' as source,
  campaign_neft as amount,
  CASE WHEN campaign_neft > 0 THEN 'CHECK: ' || campaign_neft || ' (verify if legitimate)' ELSE 'None' END as status
FROM source_totals

UNION ALL

SELECT 
  'Staking Rewards' as source,
  staking_neft as amount,
  CASE WHEN staking_neft > 0 THEN 'CHECK: ' || staking_neft || ' (verify if legitimate)' ELSE 'None' END as status
FROM source_totals

UNION ALL

SELECT 
  'Referral Rewards' as source,
  referral_neft as amount,
  CASE WHEN referral_neft > 0 THEN 'CHECK: ' || referral_neft || ' (verify if legitimate)' ELSE 'None' END as status
FROM source_totals

UNION ALL

SELECT 
  'TOTAL CALCULATED' as source,
  (achievement_neft + daily_neft + campaign_neft + staking_neft + referral_neft) as amount,
  'Sum of all sources' as status
FROM source_totals

UNION ALL

SELECT 
  'CURRENT BALANCE' as source,
  current_balance as amount,
  'From user_balances table' as status
FROM source_totals

UNION ALL

SELECT 
  'EXCESS AMOUNT' as source,
  (current_balance - (achievement_neft + daily_neft + campaign_neft + staking_neft + referral_neft)) as amount,
  'This is the problem amount' as status
FROM source_totals;

-- Step 3: Identify the most likely culprit
SELECT 'MOST LIKELY EXCESS SOURCE:' as culprit_identification;
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM user_achievements ua WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.claimed_at IS NOT NULL GROUP BY achievement_key HAVING COUNT(*) > 1 LIMIT 1) > 0 
    THEN 'DUPLICATE ACHIEVEMENT CLAIMS - Same achievement claimed multiple times'
    
    WHEN (SELECT COUNT(*) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' GROUP BY claim_date HAVING COUNT(*) > 1 LIMIT 1) > 0 
    THEN 'DUPLICATE DAILY CLAIMS - Multiple claims on same date'
    
    WHEN (SELECT SUM(base_neft_reward + bonus_neft_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') > 1000 
    THEN 'EXCESSIVE DAILY CLAIMS - Daily rewards too high'
    
    WHEN (SELECT COUNT(*) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' GROUP BY project_id HAVING COUNT(*) > 1 LIMIT 1) > 0 
    THEN 'DUPLICATE CAMPAIGN CLAIMS - Same project claimed multiple times'
    
    WHEN (SELECT SUM(total_nft_claimed + total_token_claimed) FROM staking_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND claimed = true) > 1000 
    THEN 'EXCESSIVE STAKING REWARDS - Staking rewards too high'
    
    ELSE 'UNKNOWN SOURCE - Check balance aggregation triggers'
  END as most_likely_culprit;
