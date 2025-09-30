-- ============================================================================
-- CHECK ALL NEFT REWARD SOURCES FOR BALANCE DISCREPANCY
-- Identify which tables are contributing to wrong user_balances values
-- ============================================================================

-- Check daily_claims NEFT rewards for this user
SELECT 'DAILY_CLAIMS NEFT REWARDS:' as source;
SELECT 
  SUM(neft_reward) as total_daily_neft,
  SUM(base_neft_reward) as total_base_neft,
  SUM(bonus_neft_reward) as total_bonus_neft,
  COUNT(*) as claim_count
FROM daily_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check staking_rewards NEFT for this user
SELECT 'STAKING_REWARDS NEFT:' as source;
SELECT 
  SUM(total_rewards) as total_staking_neft,
  SUM(total_nft_earned) as total_nft_earned,
  SUM(total_token_earned) as total_token_earned,
  COUNT(*) as staking_entries
FROM staking_rewards 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check user_activities NEFT rewards
SELECT 'USER_ACTIVITIES NEFT REWARDS:' as source;
SELECT 
  SUM(neft_reward) as total_activity_neft,
  COUNT(*) as activity_count,
  array_agg(DISTINCT activity_type) as activity_types
FROM user_activities 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND neft_reward > 0;

-- Check campaign_reward_claims
SELECT 'CAMPAIGN_REWARD_CLAIMS NEFT:' as source;
SELECT 
  SUM(neft_reward) as total_campaign_neft,
  COUNT(*) as campaign_claims
FROM campaign_reward_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check referral_rewards
SELECT 'REFERRAL_REWARDS NEFT:' as source;
SELECT 
  SUM(neft_reward) as total_referral_neft,
  COUNT(*) as referral_count
FROM referral_rewards 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check user_streaks totals
SELECT 'USER_STREAKS TOTALS:' as source;
SELECT 
  total_neft_earned,
  total_xp_earned,
  total_claims
FROM user_streaks 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check user_activity_stats totals
SELECT 'USER_ACTIVITY_STATS TOTALS:' as source;
SELECT 
  total_neft_earned,
  total_xp_earned,
  total_activities,
  total_claims,
  total_stakes,
  total_burns
FROM user_activity_stats 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check user_referrals totals
SELECT 'USER_REFERRALS TOTALS:' as source;
SELECT 
  total_neft_earned,
  total_referrals
FROM user_referrals 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- SUMMARY: Calculate total from all sources
SELECT 'TOTAL FROM ALL SOURCES:' as summary;
SELECT 
  COALESCE((SELECT SUM(neft_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
  COALESCE((SELECT SUM(total_rewards) FROM staking_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
  COALESCE((SELECT SUM(neft_reward) FROM user_activities WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
  COALESCE((SELECT SUM(neft_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
  COALESCE((SELECT SUM(neft_reward) FROM referral_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as total_from_all_sources,
  1300 as expected_achievement_only,
  'Check if balance function is aggregating multiple sources' as note;

-- Check if there's a balance calculation function that might be double-counting
SELECT 'BALANCE CALCULATION FUNCTIONS:' as functions;
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%user_balances%'
   OR routine_definition ILIKE '%total_neft%'
   OR routine_definition ILIKE '%achievement%'
ORDER BY routine_name;
