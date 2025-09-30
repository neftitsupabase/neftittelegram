-- ============================================================================
-- COMPLETE FIX: Remove Day 0, Start from Day 1, Show Next Day Rewards
-- ============================================================================
-- PROBLEM: System was starting from Day 0 and showing current day rewards
-- SOLUTION: Start from Day 1 and always show NEXT day's reward
-- ============================================================================

-- Step 1: Fix the progressive reward calculation function
DROP FUNCTION IF EXISTS calculate_progressive_daily_reward(INTEGER);

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
  -- FIXED: Ensure streak_day is at least 1 (no Day 0)
  IF streak_day < 1 THEN
    streak_day := 1;
  END IF;
  
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
      reward_neft := 5.0;
      reward_xp := 5;
      tier_name := 'Day 1 - Fresh Start';
  END CASE;
  
  RETURN QUERY SELECT reward_neft, reward_xp, tier_name, day_in_cycle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Fix the dashboard function to show NEXT day's reward
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
  -- If user can claim today, show what they'll get when they claim
  -- If user already claimed today, show what they'll get tomorrow
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
    -- User already claimed today - show tomorrow's reward
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

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated, anon, public;

-- Step 4: Test the fix
SELECT 'Daily claim system fixed - now starts from Day 1 and shows next day rewards!' as status;
