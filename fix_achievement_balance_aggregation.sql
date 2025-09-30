-- ============================================================================
-- FIX ACHIEVEMENT BALANCE AGGREGATION ISSUE
-- The comprehensive_balance_aggregation_system.sql is aggregating from ALL sources
-- This causes wrong values because it includes daily_claims, staking_rewards, etc.
-- For achievements, we should ONLY count claimed achievement rewards
-- ============================================================================

-- PROBLEM IDENTIFIED:
-- The aggregate_user_rewards_from_all_sources() function aggregates from:
-- 1. campaign_reward_claims (lines 43-57)
-- 2. daily_claims (lines 59-73) 
-- 3. user_achievements (lines 75-92) ✅ This is correct
-- 4. staking_rewards (lines 94-109)
-- 5. staked_tokens (lines 111-122)

-- This means your balance includes MORE than just achievement rewards!

-- Let's check what each source contributes for your wallet:
SELECT 'DEBUGGING BALANCE SOURCES FOR YOUR WALLET:' as debug_header;

-- 1. Check campaign rewards
SELECT 'CAMPAIGN REWARDS:' as source_1;
SELECT 
  COALESCE(SUM(neft_reward), 0) as campaign_neft,
  COALESCE(SUM(xp_reward), 0) as campaign_xp,
  COUNT(*) as campaign_count
FROM campaign_reward_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- 2. Check daily claims
SELECT 'DAILY CLAIMS:' as source_2;
SELECT 
  COALESCE(SUM(base_neft_reward + bonus_neft_reward), 0) as daily_neft,
  COALESCE(SUM(base_xp_reward + bonus_xp_reward), 0) as daily_xp,
  COUNT(*) as daily_count
FROM daily_claims 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- 3. Check achievement rewards (this should be 1300 NEFT, 650 XP)
SELECT 'ACHIEVEMENT REWARDS (EXPECTED 1300 NEFT, 650 XP):' as source_3;
SELECT 
  COALESCE(SUM(neft_reward), 0) as achievement_neft,
  COALESCE(SUM(xp_reward), 0) as achievement_xp,
  COUNT(*) as achievement_count
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
  AND ua.status = 'completed' 
  AND ua.claimed_at IS NOT NULL;

-- 4. Check staking rewards
SELECT 'STAKING REWARDS:' as source_4;
SELECT 
  COALESCE(SUM(reward_amount), 0) as staking_neft,
  COUNT(*) as staking_count
FROM staking_rewards 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
  AND is_claimed = true;

-- 5. Check staked tokens
SELECT 'STAKED TOKENS:' as source_5;
SELECT 
  COALESCE(SUM(amount), 0) as staked_amount,
  COUNT(*) as staked_count
FROM staked_tokens 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- TOTAL FROM COMPREHENSIVE SYSTEM (what's causing wrong values)
SELECT 'TOTAL FROM COMPREHENSIVE SYSTEM:' as comprehensive_total;
SELECT aggregate_user_rewards_from_all_sources('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as comprehensive_result;

-- SOLUTION: Create achievement-only balance function
CREATE OR REPLACE FUNCTION get_achievement_only_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
BEGIN
  -- Only aggregate from claimed achievements
  SELECT 
    COALESCE(SUM(am.neft_reward), 0),
    COALESCE(SUM(am.xp_reward), 0)
  INTO achievement_neft, achievement_xp
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet 
    AND ua.status = 'completed' 
    AND ua.claimed_at IS NOT NULL;

  -- Build result JSON
  SELECT json_build_object(
    'total_neft_claimed', achievement_neft,
    'total_xp_earned', achievement_xp,
    'available_neft', achievement_neft, -- All achievement NEFT is available
    'source', 'achievements_only',
    'last_updated', NOW()
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the achievement-only function
SELECT 'ACHIEVEMENT-ONLY BALANCE (CORRECT):' as correct_balance;
SELECT get_achievement_only_balance('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as achievement_only_result;

-- Compare current user_balances vs achievement-only
SELECT 'COMPARISON - CURRENT vs ACHIEVEMENT-ONLY:' as comparison;
SELECT 
  'Current user_balances' as source,
  ub.total_neft_claimed as current_neft,
  ub.total_xp_earned as current_xp,
  ub.available_neft as current_available
FROM user_balances ub
WHERE ub.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'

UNION ALL

SELECT 
  'Achievement-only (correct)' as source,
  (get_achievement_only_balance('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->>'total_neft_claimed')::DECIMAL as correct_neft,
  (get_achievement_only_balance('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->>'total_xp_earned')::INTEGER as correct_xp,
  (get_achievement_only_balance('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071')->>'available_neft')::DECIMAL as correct_available;

-- RECOMMENDATION:
SELECT 'RECOMMENDATION:' as recommendation_header;
SELECT 'The comprehensive balance system is aggregating from multiple sources.' as issue;
SELECT 'For achievement UI, use get_achievement_only_balance() function instead.' as solution_1;
SELECT 'Or modify the comprehensive system to have separate functions for different contexts.' as solution_2;
SELECT 'Achievement balance should ONLY include claimed achievement rewards.' as solution_3;
