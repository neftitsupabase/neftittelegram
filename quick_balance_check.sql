-- ============================================================================
-- QUICK BALANCE CHECK WITHOUT FUNCTIONS
-- Direct SQL queries to validate your balance without creating functions
-- ============================================================================

-- Step 1: Get current balance from user_balances table
SELECT 'CURRENT BALANCE FROM USER_BALANCES:' as current_balance;
SELECT 
  wallet_address,
  total_neft_claimed as current_neft,
  total_xp_earned as current_xp,
  available_neft as current_available,
  last_updated
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Step 2: Calculate expected balance from all sources
SELECT 'CALCULATED BALANCE FROM ALL SOURCES:' as calculated_balance;

-- Achievements (should be 1300 NEFT, 650 XP)
WITH source_calculations AS (
  SELECT 
    COALESCE((
      SELECT SUM(am.neft_reward) 
      FROM user_achievements ua 
      JOIN achievements_master am ON ua.achievement_key = am.achievement_key 
      WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
        AND ua.status = 'completed' 
        AND ua.claimed_at IS NOT NULL
    ), 0) as achievement_neft,
    
    COALESCE((
      SELECT SUM(am.xp_reward) 
      FROM user_achievements ua 
      JOIN achievements_master am ON ua.achievement_key = am.achievement_key 
      WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
        AND ua.status = 'completed' 
        AND ua.claimed_at IS NOT NULL
    ), 0) as achievement_xp,
    
    COALESCE((
      SELECT SUM(base_neft_reward + bonus_neft_reward) 
      FROM daily_claims 
      WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
    ), 0) as daily_neft,
    
    COALESCE((
      SELECT SUM(base_xp_reward + bonus_xp_reward) 
      FROM daily_claims 
      WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
    ), 0) as daily_xp,
    
    COALESCE((
      SELECT SUM(neft_reward) 
      FROM campaign_reward_claims 
      WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
    ), 0) as campaign_neft,
    
    COALESCE((
      SELECT SUM(xp_reward) 
      FROM campaign_reward_claims 
      WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
    ), 0) as campaign_xp,
    
    COALESCE((
      SELECT SUM(total_nft_claimed + total_token_claimed) 
      FROM staking_rewards 
      WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
        AND claimed = true
    ), 0) as staking_neft,
    
    COALESCE((
      SELECT SUM(neft_reward) 
      FROM referral_rewards 
      WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
    ), 0) as referral_neft,
    
    COALESCE((
      SELECT SUM(amount) 
      FROM staked_tokens 
      WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
    ), 0) as staked_amount
)
SELECT 
  achievement_neft,
  achievement_xp,
  daily_neft,
  daily_xp,
  campaign_neft,
  campaign_xp,
  staking_neft,
  referral_neft,
  staked_amount,
  '---' as separator,
  (achievement_neft + daily_neft + campaign_neft + staking_neft + referral_neft) as calculated_total_neft,
  (achievement_xp + daily_xp + campaign_xp) as calculated_total_xp,
  GREATEST(0, (achievement_neft + daily_neft + campaign_neft + staking_neft + referral_neft) - staked_amount) as calculated_available_neft
FROM source_calculations;

-- Step 3: Direct comparison
SELECT 'BALANCE COMPARISON:' as comparison;
WITH current_balance AS (
  SELECT 
    COALESCE(total_neft_claimed, 0) as current_neft,
    COALESCE(total_xp_earned, 0) as current_xp,
    COALESCE(available_neft, 0) as current_available
  FROM user_balances 
  WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
),
calculated_balance AS (
  SELECT 
    COALESCE((SELECT SUM(am.neft_reward) FROM user_achievements ua JOIN achievements_master am ON ua.achievement_key = am.achievement_key WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.status = 'completed' AND ua.claimed_at IS NOT NULL), 0) +
    COALESCE((SELECT SUM(base_neft_reward + bonus_neft_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
    COALESCE((SELECT SUM(neft_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
    COALESCE((SELECT SUM(total_nft_claimed + total_token_claimed) FROM staking_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND claimed = true), 0) +
    COALESCE((SELECT SUM(neft_reward) FROM referral_rewards WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as calculated_neft,
    
    COALESCE((SELECT SUM(am.xp_reward) FROM user_achievements ua JOIN achievements_master am ON ua.achievement_key = am.achievement_key WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.status = 'completed' AND ua.claimed_at IS NOT NULL), 0) +
    COALESCE((SELECT SUM(base_xp_reward + bonus_xp_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
    COALESCE((SELECT SUM(xp_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) as calculated_xp
)
SELECT 
  'Current (user_balances)' as source,
  cb.current_neft as neft_value,
  cb.current_xp as xp_value,
  cb.current_available as available_value
FROM current_balance cb

UNION ALL

SELECT 
  'Calculated (from sources)' as source,
  calc.calculated_neft as neft_value,
  calc.calculated_xp as xp_value,
  GREATEST(0, calc.calculated_neft - COALESCE((SELECT SUM(amount) FROM staked_tokens WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0)) as available_value
FROM calculated_balance calc

UNION ALL

SELECT 
  'Difference' as source,
  (cb.current_neft - calc.calculated_neft) as neft_value,
  (cb.current_xp - calc.calculated_xp) as xp_value,
  (cb.current_available - GREATEST(0, calc.calculated_neft - COALESCE((SELECT SUM(amount) FROM staked_tokens WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0))) as available_value
FROM current_balance cb, calculated_balance calc;

-- Step 4: Identify the problem source
SELECT 'PROBLEM IDENTIFICATION:' as problem_id;
SELECT 
  CASE 
    WHEN (SELECT total_neft_claimed FROM user_balances WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') > 
         (SELECT COALESCE(SUM(am.neft_reward), 0) FROM user_achievements ua JOIN achievements_master am ON ua.achievement_key = am.achievement_key WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.status = 'completed' AND ua.claimed_at IS NOT NULL) +
         COALESCE((SELECT SUM(base_neft_reward + bonus_neft_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
         COALESCE((SELECT SUM(neft_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
         COALESCE((SELECT SUM(total_nft_claimed + total_token_claimed) FROM staking_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND claimed = true), 0) +
         COALESCE((SELECT SUM(neft_reward) FROM referral_rewards WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0)
    THEN 'EXCESS VALUES - user_balances has more than it should'
    WHEN (SELECT total_neft_claimed FROM user_balances WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') < 
         (SELECT COALESCE(SUM(am.neft_reward), 0) FROM user_achievements ua JOIN achievements_master am ON ua.achievement_key = am.achievement_key WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND ua.status = 'completed' AND ua.claimed_at IS NOT NULL) +
         COALESCE((SELECT SUM(base_neft_reward + bonus_neft_reward) FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
         COALESCE((SELECT SUM(neft_reward) FROM campaign_reward_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0) +
         COALESCE((SELECT SUM(total_nft_claimed + total_token_claimed) FROM staking_rewards WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' AND claimed = true), 0) +
         COALESCE((SELECT SUM(neft_reward) FROM referral_rewards WHERE referrer_wallet = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'), 0)
    THEN 'MISSING VALUES - user_balances has less than it should'
    ELSE 'VALUES MATCH - no discrepancy detected'
  END as problem_status;
