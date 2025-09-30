-- ============================================================================
-- FIX: Daily Claim Dashboard Function - Correct Reward Calculation
-- ============================================================================
-- PROBLEM: Dashboard function might not be returning correct rewards for display
-- This ensures the dashboard shows exactly what the user will get when they claim
-- ============================================================================

-- Drop and recreate the dashboard function to ensure correct reward calculation
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

  -- Calculate NEXT reward (what user will get when they claim next)
  -- FIXED: Always show the NEXT day's reward, not current day's reward
  IF can_claim THEN
    -- If can claim today, show what they'll get when they claim
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Continue streak - reward for next streak day
      SELECT * INTO next_reward FROM calculate_progressive_daily_reward(user_record.current_streak + 1);
    ELSE
      -- Reset streak - reward for day 1
      SELECT * INTO next_reward FROM calculate_progressive_daily_reward(1);
    END IF;
  ELSE
    -- Already claimed today, show tomorrow's reward (next day in cycle)
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated, anon, public;

-- Test message
SELECT 'Daily claim dashboard function fixed - rewards will now display correctly!' as status;
