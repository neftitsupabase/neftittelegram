-- ============================================================================
-- TEST CLAIM ACHIEVEMENT FUNCTIONALITY
-- Debug why claim reward isn't working properly
-- ============================================================================

-- First, check if achievements are actually completed and ready to claim
SELECT 'Current achievement status:' as check;
SELECT 
  achievement_key,
  status,
  current_progress,
  completed_at,
  claimed_at,
  updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND status = 'completed'
  
ORDER BY updated_at DESC;

-- Check if achievements_master table has the reward values
SELECT 'Achievement rewards in master table:' as rewards;
SELECT 
  achievement_key,
  neft_reward,
  xp_reward,
  is_active
FROM achievements_master 
WHERE achievement_key IN ('first_stake', 'first_burn', 'first_quest', 'staking_pro');

-- Test the claim function directly
SELECT 'Testing claim function for first_stake:' as test;
SELECT claim_achievement_reward('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', 'first_stake') as claim_result;

-- Check user balance before and after
SELECT 'Current user balance:' as balance;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check if user_balances table exists and has correct structure
SELECT 'User balances table structure:' as structure;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_balances' 
ORDER BY ordinal_position;
