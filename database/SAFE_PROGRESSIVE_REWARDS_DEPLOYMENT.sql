-- ============================================================================
-- SAFE PROGRESSIVE DAILY REWARDS DEPLOYMENT
-- Step-by-step deployment to avoid database errors
-- Deploy each section separately and test before proceeding
-- ============================================================================

-- STEP 1: Test the progressive reward calculation function only
-- This is safe to deploy as it doesn't modify existing functions
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_progressive_daily_reward(streak_day INTEGER)
RETURNS TABLE(
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  reward_tier TEXT,
  cycle_day INTEGER
) AS $$
DECLARE
  day_in_cycle INTEGER;
  reward_neft DECIMAL(18,8);
  reward_xp INTEGER;
  tier_name TEXT;
BEGIN
  -- Calculate which day in the 7-day cycle (1-7)
  day_in_cycle := ((streak_day - 1) % 7) + 1;
  
  -- Set rewards based on cycle day
  CASE day_in_cycle
    WHEN 1 THEN
      reward_neft := 5.0;
      reward_xp := 5;
      tier_name := 'Day 1 - Fresh Start';
    WHEN 2 THEN
      reward_neft := 8.0;
      reward_xp := 8;
      tier_name := 'Day 2 - Building Momentum';
    WHEN 3 THEN
      reward_neft := 12.0;
      reward_xp := 12;
      tier_name := 'Day 3 - Getting Stronger';
    WHEN 4 THEN
      reward_neft := 17.0;
      reward_xp := 17;
      tier_name := 'Day 4 - Steady Progress';
    WHEN 5 THEN
      reward_neft := 22.0;
      reward_xp := 22;
      tier_name := 'Day 5 - Consistent Effort';
    WHEN 6 THEN
      reward_neft := 30.0;
      reward_xp := 30;
      tier_name := 'Day 6 - Almost There';
    WHEN 7 THEN
      reward_neft := 35.0;
      reward_xp := 35;
      tier_name := 'Day 7 - Weekly Champion';
    ELSE
      -- Fallback (should never happen)
      reward_neft := 5.0;
      reward_xp := 5;
      tier_name := 'Daily Reward';
  END CASE;
  
  RETURN QUERY SELECT reward_neft, reward_xp, tier_name, day_in_cycle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO public;

-- Test the calculation function
SELECT 'STEP 1: Testing progressive reward calculation...' as test_step;

SELECT 
  day as streak_day,
  neft_reward,
  xp_reward,
  reward_tier,
  cycle_day
FROM generate_series(1, 14) as day,
LATERAL calculate_progressive_daily_reward(day);

-- Success message for Step 1
DO $$
BEGIN
    RAISE NOTICE '✅ STEP 1 COMPLETED: Progressive reward calculation function deployed successfully!';
    RAISE NOTICE 'Next: Deploy STEP 2 only after verifying this works correctly.';
END $$;
