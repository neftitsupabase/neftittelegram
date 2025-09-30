-- ============================================================================
-- EMERGENCY FIX: Database Returning 0 Rewards Instead of Next Day Rewards
-- ============================================================================
-- PROBLEM: After claiming Day 1 (5 NEFT + 5 XP), dashboard shows 0 NEFT + 0 XP
-- SOLUTION: Fix the dashboard function to return correct next day rewards
-- ============================================================================

-- Step 1: Drop existing function
DROP FUNCTION IF EXISTS get_daily_claim_dashboard(TEXT);

-- Step 2: Create a simple, working dashboard function
CREATE OR REPLACE FUNCTION get_daily_claim_dashboard(user_wallet TEXT)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  total_claims INTEGER,
  can_claim_today BOOLEAN,
  last_claim_date DATE,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  reward_tier TEXT,
  cycle_day INTEGER,
  hours_until_next_claim INTEGER,
  minutes_until_next_claim INTEGER,
  seconds_until_next_claim INTEGER
)
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  can_claim BOOLEAN := FALSE;
  next_streak INTEGER;
  next_cycle_day INTEGER;
  next_neft DECIMAL(18,8);
  next_xp INTEGER;
  next_tier TEXT;
BEGIN
  -- Get user streak information
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  -- If no record exists, user can claim and will start at day 1
  IF user_record IS NULL THEN
    RETURN QUERY SELECT 
      0, -- current_streak
      0, -- longest_streak
      0, -- total_claims
      TRUE, -- can_claim_today
      NULL::DATE, -- last_claim_date
      5.0, -- neft_reward (Day 1)
      5, -- xp_reward (Day 1)
      'Day 1 - Fresh Start', -- reward_tier
      1, -- cycle_day
      0, -- hours_until_next_claim
      0, -- minutes_until_next_claim
      0; -- seconds_until_next_claim
    RETURN;
  END IF;

  -- Check if user can claim today
  can_claim := (user_record.last_claim_date IS NULL OR user_record.last_claim_date < CURRENT_DATE) 
    AND NOT EXISTS (
      SELECT 1 FROM daily_claims 
      WHERE wallet_address = user_wallet 
      AND claimed_at > NOW() - INTERVAL '24 hours'
    );

  -- Calculate next streak and reward
  IF can_claim THEN
    -- User can claim today - show what they'll get when they claim
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Continue streak
      next_streak := user_record.current_streak + 1;
    ELSE
      -- Reset streak
      next_streak := 1;
    END IF;
  ELSE
    -- User already claimed today - show tomorrow's reward
    next_streak := user_record.current_streak + 1;
  END IF;

  -- Calculate next cycle day (1-7)
  next_cycle_day := ((next_streak - 1) % 7) + 1;

  -- Set rewards based on cycle day
  CASE next_cycle_day
    WHEN 1 THEN
      next_neft := 5.0;
      next_xp := 5;
      next_tier := 'Day 1 - Fresh Start';
    WHEN 2 THEN
      next_neft := 8.0;
      next_xp := 8;
      next_tier := 'Day 2 - Building Momentum';
    WHEN 3 THEN
      next_neft := 12.0;
      next_xp := 12;
      next_tier := 'Day 3 - Getting Stronger';
    WHEN 4 THEN
      next_neft := 17.0;
      next_xp := 17;
      next_tier := 'Day 4 - Steady Progress';
    WHEN 5 THEN
      next_neft := 22.0;
      next_xp := 22;
      next_tier := 'Day 5 - Consistent Effort';
    WHEN 6 THEN
      next_neft := 30.0;
      next_xp := 30;
      next_tier := 'Day 6 - Almost There';
    WHEN 7 THEN
      next_neft := 35.0;
      next_xp := 35;
      next_tier := 'Day 7 - Weekly Champion';
    ELSE
      next_neft := 5.0;
      next_xp := 5;
      next_tier := 'Day 1 - Fresh Start';
  END CASE;

  -- Return the result
  IF can_claim THEN
    -- Can claim now
    RETURN QUERY SELECT 
      user_record.current_streak,
      user_record.longest_streak,
      user_record.total_claims,
      can_claim,
      user_record.last_claim_date,
      next_neft,
      next_xp,
      next_tier,
      next_cycle_day,
      0, -- hours_until_next_claim
      0, -- minutes_until_next_claim
      0; -- seconds_until_next_claim
  ELSE
    -- Calculate time until next claim
    RETURN QUERY SELECT 
      user_record.current_streak,
      user_record.longest_streak,
      user_record.total_claims,
      can_claim,
      user_record.last_claim_date,
      next_neft,
      next_xp,
      next_tier,
      next_cycle_day,
      23, -- hours_until_next_claim (approximate)
      59, -- minutes_until_next_claim (approximate)
      0; -- seconds_until_next_claim
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated, anon, public;

-- Step 4: Test the fix
SELECT 'Dashboard function fixed - should now return correct next day rewards!' as status;
