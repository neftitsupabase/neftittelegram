-- ============================================================================
-- FIX DAILY CLAIM PROGRESSIVE REWARDS - CORRECT 7-DAY CYCLE
-- This fixes the issue where first day gives 10.5 NEFT instead of 5 NEFT
-- ============================================================================

-- Drop the old conflicting functions
DROP FUNCTION IF EXISTS calculate_daily_reward(INTEGER, TEXT);
DROP FUNCTION IF EXISTS process_daily_claim(TEXT);

-- Create the correct progressive reward calculation function
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
  
  -- Set rewards based on cycle day (EXACTLY as requested)
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

-- Create the correct process_daily_claim function
CREATE OR REPLACE FUNCTION process_daily_claim(user_wallet TEXT)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  streak_count INTEGER,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  reward_tier TEXT,
  cycle_day INTEGER,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER
)
SECURITY DEFINER
AS $$
DECLARE
  current_streak INTEGER := 0;
  new_streak INTEGER := 1;
  last_claim_time TIMESTAMPTZ;
  reward_record RECORD;
  current_neft DECIMAL(18,8) := 0;
  current_xp INTEGER := 0;
  current_available_neft DECIMAL(18,8) := 0;
BEGIN
  -- Check for existing claims within 24 hours
  SELECT claimed_at INTO last_claim_time
  FROM daily_claims
  WHERE wallet_address = user_wallet
  ORDER BY claimed_at DESC
  LIMIT 1;

  -- Enforce 24-hour cooldown
  IF last_claim_time IS NOT NULL AND NOW() < (last_claim_time + INTERVAL '24 hours') THEN
    RETURN QUERY SELECT 
      FALSE,
      'You must wait 24 hours between claims',
      0,
      0.0::DECIMAL(18,8),
      0,
      ''::TEXT,
      0,
      0.0::DECIMAL(18,8),
      0;
    RETURN;
  END IF;

  -- Get current streak from user_streaks table
  SELECT us.current_streak INTO current_streak
  FROM user_streaks us
  WHERE us.wallet_address = user_wallet;

  -- If no streak record exists, start at 1
  IF current_streak IS NULL THEN
    current_streak := 0;
  END IF;

  -- Calculate new streak
  new_streak := current_streak + 1;

  -- Get progressive reward for this streak day (CORRECT FUNCTION)
  SELECT * INTO reward_record FROM calculate_progressive_daily_reward(new_streak);

  -- Get current balance from user_balances
  SELECT 
    COALESCE(ub.total_neft_claimed, 0),
    COALESCE(ub.total_xp_earned, 0),
    COALESCE(ub.available_neft, 0)
  INTO current_neft, current_xp, current_available_neft
  FROM user_balances ub
  WHERE ub.wallet_address = user_wallet;

  -- Insert daily claim record
  INSERT INTO daily_claims (
    wallet_address,
    claim_date,
    streak_count,
    neft_reward,
    xp_reward,
    reward_tier,
    claimed_at
  ) VALUES (
    user_wallet,
    CURRENT_DATE,
    new_streak,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    NOW()
  );

  -- Update or create user_streaks record
  INSERT INTO user_streaks (
    wallet_address,
    current_streak,
    longest_streak,
    last_claim_date,
    total_claims,
    streak_started_at,
    total_neft_earned,
    total_xp_earned,
    last_claimed_at
  ) VALUES (
    user_wallet,
    new_streak,
    GREATEST(new_streak, COALESCE((SELECT longest_streak FROM user_streaks WHERE wallet_address = user_wallet), 0)),
    CURRENT_DATE,
    COALESCE((SELECT total_claims FROM user_streaks WHERE wallet_address = user_wallet), 0) + 1,
    CASE 
      WHEN current_streak = 0 THEN CURRENT_DATE 
      ELSE COALESCE((SELECT streak_started_at FROM user_streaks WHERE wallet_address = user_wallet), CURRENT_DATE)
    END,
    current_neft + reward_record.neft_reward,
    current_xp + reward_record.xp_reward,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    current_streak = new_streak,
    longest_streak = GREATEST(new_streak, user_streaks.longest_streak),
    last_claim_date = CURRENT_DATE,
    total_claims = user_streaks.total_claims + 1,
    total_neft_earned = current_neft + reward_record.neft_reward,
    total_xp_earned = current_xp + reward_record.xp_reward,
    last_claimed_at = NOW();

  -- Update user_balances with new totals
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    last_updated
  ) VALUES (
    user_wallet,
    current_neft + reward_record.neft_reward,
    current_xp + reward_record.xp_reward,
    current_available_neft + reward_record.neft_reward,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + reward_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + reward_record.xp_reward,
    available_neft = user_balances.available_neft + reward_record.neft_reward,
    last_updated = NOW();

  -- Return success with reward details
  RETURN QUERY SELECT 
    TRUE,
    'Daily reward claimed successfully!'::TEXT,
    new_streak,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    reward_record.cycle_day,
    current_neft + reward_record.neft_reward,
    current_xp + reward_record.xp_reward;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error if something goes wrong
    RETURN QUERY SELECT 
      FALSE,
      'An error occurred while processing your claim: ' || SQLERRM,
      0,
      0.0::DECIMAL(18,8),
      0,
      ''::TEXT,
      0,
      0.0::DECIMAL(18,8),
      0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create optimized dashboard function for frontend
CREATE OR REPLACE FUNCTION get_daily_claim_dashboard(user_wallet TEXT)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  total_claims INTEGER,
  can_claim_today BOOLEAN,
  last_claim_date DATE,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER,
  streak_started_at DATE,
  next_streak INTEGER,
  next_neft_reward DECIMAL(18,8),
  next_xp_reward INTEGER,
  next_reward_tier TEXT,
  next_is_milestone BOOLEAN,
  hours_until_next_claim INTEGER,
  minutes_until_next_claim INTEGER
)
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  last_claim_time TIMESTAMPTZ;
  next_reward_record RECORD;
  hours_remaining INTEGER;
  minutes_remaining INTEGER;
BEGIN
  -- Get user streak info
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;
  
  -- Get last claim time
  SELECT claimed_at INTO last_claim_time
  FROM daily_claims
  WHERE wallet_address = user_wallet
  ORDER BY claimed_at DESC
  LIMIT 1;

  -- Calculate next streak and reward
  IF user_record IS NULL THEN
    -- New user - first claim
    SELECT * INTO next_reward_record FROM calculate_progressive_daily_reward(1);
  ELSE
    -- Existing user - next streak
    SELECT * INTO next_reward_record FROM calculate_progressive_daily_reward(user_record.current_streak + 1);
  END IF;

  -- Calculate time until next claim
  IF last_claim_time IS NOT NULL THEN
    hours_remaining := GREATEST(0, EXTRACT(EPOCH FROM (last_claim_time + INTERVAL '24 hours' - NOW())) / 3600)::INTEGER;
    minutes_remaining := GREATEST(0, (EXTRACT(EPOCH FROM (last_claim_time + INTERVAL '24 hours' - NOW())) % 3600) / 60)::INTEGER;
  ELSE
    hours_remaining := 0;
    minutes_remaining := 0;
  END IF;

  RETURN QUERY SELECT 
    COALESCE(user_record.current_streak, 0),
    COALESCE(user_record.longest_streak, 0),
    COALESCE(user_record.total_claims, 0),
    (last_claim_time IS NULL OR NOW() >= (last_claim_time + INTERVAL '24 hours')),
    COALESCE(user_record.last_claim_date, NULL),
    COALESCE(user_record.total_neft_earned, 0),
    COALESCE(user_record.total_xp_earned, 0),
    COALESCE(user_record.streak_started_at, NULL),
    COALESCE(user_record.current_streak, 0) + 1,
    next_reward_record.neft_reward,
    next_reward_record.xp_reward,
    next_reward_record.reward_tier,
    FALSE, -- No special milestones for now
    hours_remaining,
    minutes_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated;

-- Test the functions
DO $$
DECLARE
  test_result RECORD;
BEGIN
  -- Test progressive reward calculation
  RAISE NOTICE 'Testing progressive rewards:';
  
  FOR i IN 1..10 LOOP
    SELECT * INTO test_result FROM calculate_progressive_daily_reward(i);
    RAISE NOTICE 'Day %: % NEFT, % XP, Tier: %, Cycle Day: %', 
      i, test_result.neft_reward, test_result.xp_reward, test_result.reward_tier, test_result.cycle_day;
  END LOOP;
END;
$$;
