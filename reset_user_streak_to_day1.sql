-- ============================================================================
-- EMERGENCY FIX: Reset user streak to start fresh
-- This will reset your streak to day 1 so you get 5 NEFT + 5 XP
-- ============================================================================

-- Check current streak status
SELECT 
    wallet_address,
    current_streak,
    longest_streak,
    total_claims,
    last_claim_date,
    streak_started_at,
    total_neft_earned,
    total_xp_earned
FROM user_streaks 
WHERE wallet_address = '0x7780E03eF5709441fA566e138B498100C2c7B9F2';

-- Check daily claims history
SELECT 
    wallet_address,
    claim_date,
    streak_count,
    neft_reward,
    xp_reward,
    reward_tier,
    claimed_at
FROM daily_claims 
WHERE wallet_address = '0x7780E03eF5709441fA566e138B498100C2c7B9F2'
ORDER BY claimed_at DESC;

-- Check user balance
SELECT 
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    last_updated
FROM user_balances 
WHERE wallet_address = '0x7780E03eF5709441fA566e138B498100C2c7B9F2';

-- RESET STREAK TO DAY 1 (run this to fix the issue)
UPDATE user_streaks 
SET 
    current_streak = 0,  -- Reset to 0 so next claim will be day 1
    last_claim_date = NULL,  -- Clear last claim date
    streak_started_at = NULL  -- Clear streak start
WHERE wallet_address = '0x7780E03eF5709441fA566e138B498100C2c7B9F2';

-- Also clear today's claim so you can claim again
DELETE FROM daily_claims 
WHERE wallet_address = '0x7780E03eF5709441fA566e138B498100C2c7B9F2' 
AND claim_date = CURRENT_DATE;

-- Test the progressive reward function
SELECT * FROM calculate_progressive_daily_reward(1);  -- Should return 5 NEFT + 5 XP
SELECT * FROM calculate_progressive_daily_reward(2);  -- Should return 8 NEFT + 8 XP
