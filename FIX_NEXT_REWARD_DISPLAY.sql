-- ============================================================================
-- CRITICAL FIX: Next Reward Display After Day 1 Claim
-- ============================================================================
-- PROBLEM: After claiming Day 1 (5 NEFT + 5 XP), "Next Reward" still shows Day 1 rewards
-- SOLUTION: Fix the dashboard function to show Day 2 rewards (8 NEFT + 8 XP) after Day 1 claim
-- ============================================================================

-- Step 1: Drop and recreate the dashboard function with correct logic
DROP FUNCTION IF EXISTS get_daily_claim_dashboard(TEXT);

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
  next_reward RECORD;
  can_claim BOOLEAN := FALSE;
  next_claim_time TIMESTAMP;
  time_diff INTERVAL;
BEGIN
  -- Get user streak information
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  -- If no record exists, user can claim and will start at day 1
  IF user_record IS NULL THEN
    SELECT * INTO next_reward FROM calculate_progressive_daily_reward(1);
    
    RETURN QUERY SELECT 
      0, -- current_streak (0 means no claims yet)
      0, -- longest_streak
      0, -- total_claims
      TRUE, -- can_claim_today
      NULL::DATE, -- last_claim_date
      next_reward.neft_reward, -- Day 1 reward (5 NEFT + 5 XP)
      next_reward.xp_reward,
      next_reward.reward_tier,
      next_reward.cycle_day,
      0, -- hours_until_next_claim
      0, -- minutes_until_next_claim
      0; -- seconds_until_next_claim
    RETURN;
  END IF;

  -- Check if user can claim today (both date and 24-hour cooldown)
  can_claim := (user_record.last_claim_date IS NULL OR user_record.last_claim_date < CURRENT_DATE) 
    AND NOT EXISTS (
      SELECT 1 FROM daily_claims 
      WHERE wallet_address = user_wallet 
      AND claimed_at > NOW() - INTERVAL '24 hours'
    );

  -- CRITICAL FIX: Always show NEXT day's reward
  -- If user already claimed today (can_claim = FALSE), show tomorrow's reward
  -- If user can claim today (can_claim = TRUE), show what they'll get when they claim
  IF can_claim THEN
    -- User can claim today - show what they'll get when they claim
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Continue streak - reward for next streak day
      SELECT * INTO next_reward FROM calculate_progressive_daily_reward(user_record.current_streak + 1);
    ELSE
      -- Reset streak - reward for day 1
      SELECT * INTO next_reward FROM calculate_progressive_daily_reward(1);
    END IF;
  ELSE
    -- User already claimed today - show tomorrow's reward (next day in cycle)
    -- THIS IS THE KEY FIX: After claiming Day 1, show Day 2 rewards
    SELECT * INTO next_reward FROM calculate_progressive_daily_reward(user_record.current_streak + 1);
  END IF;

  -- Calculate time until next claim
  IF can_claim THEN
    -- Can claim now
    RETURN QUERY SELECT 
      user_record.current_streak,
      user_record.longest_streak,
      user_record.total_claims,
      can_claim,
      user_record.last_claim_date,
      next_reward.neft_reward,
      next_reward.xp_reward,
      next_reward.reward_tier,
      next_reward.cycle_day,
      0, -- hours_until_next_claim
      0, -- minutes_until_next_claim
      0; -- seconds_until_next_claim
  ELSE
    -- Calculate time until next claim (24 hours from last claim)
    SELECT claimed_at + INTERVAL '24 hours' INTO next_claim_time
    FROM daily_claims 
    WHERE wallet_address = user_wallet 
    ORDER BY claimed_at DESC 
    LIMIT 1;
    
    time_diff := next_claim_time - NOW();
    
    RETURN QUERY SELECT 
      user_record.current_streak,
      user_record.longest_streak,
      user_record.total_claims,
      can_claim,
      user_record.last_claim_date,
      next_reward.neft_reward,
      next_reward.xp_reward,
      next_reward.reward_tier,
      next_reward.cycle_day,
      EXTRACT(HOUR FROM time_diff)::INTEGER,
      EXTRACT(MINUTE FROM time_diff)::INTEGER,
      EXTRACT(SECOND FROM time_diff)::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Grant permissions
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated, anon, public;

-- Step 3: Test the fix
SELECT 'Next reward display fixed - after Day 1 claim, will show Day 2 rewards!' as status;
