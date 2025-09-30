-- ============================================================================
-- FRESH DAILY CLAIMS SYSTEM - Complete Progressive 7-Day Rewards
-- Clean implementation with proper user_balances integration
-- ============================================================================

-- Drop existing functions to start fresh
DROP FUNCTION IF EXISTS get_daily_claim_dashboard(TEXT);
DROP FUNCTION IF EXISTS process_daily_claim(TEXT);
DROP FUNCTION IF EXISTS calculate_progressive_daily_reward(INTEGER);

-- Progressive reward calculation function
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
      tier_name := 'Day 1';
    WHEN 2 THEN
      reward_neft := 8.0;
      reward_xp := 8;
      tier_name := 'Day 2';
    WHEN 3 THEN
      reward_neft := 12.0;
      reward_xp := 12;
      tier_name := 'Day 3';
    WHEN 4 THEN
      reward_neft := 17.0;
      reward_xp := 17;
      tier_name := 'Day 4';
    WHEN 5 THEN
      reward_neft := 22.0;
      reward_xp := 22;
      tier_name := 'Day 5';
    WHEN 6 THEN
      reward_neft := 30.0;
      reward_xp := 30;
      tier_name := 'Day 6';
    WHEN 7 THEN
      reward_neft := 35.0;
      reward_xp := 35;
      tier_name := 'Day 7';
    ELSE
      reward_neft := 5.0;
      reward_xp := 5;
      tier_name := 'Day 1';
  END CASE;
  
  RETURN QUERY SELECT reward_neft, reward_xp, tier_name, day_in_cycle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main daily claim processing function
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
  can_claim BOOLEAN := TRUE;
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

  -- Get progressive reward for this streak day
  SELECT * INTO reward_record FROM calculate_progressive_daily_reward(new_streak);

  -- Insert daily claim record
  INSERT INTO daily_claims (
    wallet_address,
    claim_date,
    streak_count,
    streak_day,
    base_neft_reward,
    base_xp_reward,
    neft_reward,
    xp_reward,
    reward_tier,
    claimed_at
  ) VALUES (
    user_wallet,
    CURRENT_DATE,
    new_streak,
    new_streak,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    NOW()
  );

  -- Update or insert user_streaks record
  INSERT INTO user_streaks (
    wallet_address,
    current_streak,
    longest_streak,
    last_claim_date,
    last_claimed_at,
    total_claims,
    total_neft_earned,
    total_xp_earned,
    streak_started_at,
    updated_at
  ) VALUES (
    user_wallet,
    new_streak,
    GREATEST(new_streak, COALESCE((SELECT longest_streak FROM user_streaks WHERE wallet_address = user_wallet), 0)),
    CURRENT_DATE,
    NOW(),
    1,
    reward_record.neft_reward,
    reward_record.xp_reward,
    CASE WHEN new_streak = 1 THEN CURRENT_DATE ELSE COALESCE((SELECT streak_started_at FROM user_streaks WHERE wallet_address = user_wallet), CURRENT_DATE) END,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    current_streak = new_streak,
    longest_streak = GREATEST(new_streak, user_streaks.longest_streak),
    last_claim_date = CURRENT_DATE,
    last_claimed_at = NOW(),
    total_claims = user_streaks.total_claims + 1,
    total_neft_earned = user_streaks.total_neft_earned + reward_record.neft_reward,
    total_xp_earned = user_streaks.total_xp_earned + reward_record.xp_reward,
    updated_at = NOW();

  -- Get current balances for updating user_balances
  SELECT 
    COALESCE(ub.total_neft_claimed, 0),
    COALESCE(ub.total_xp_earned, 0),
    COALESCE(ub.available_neft, 0)
  INTO current_neft, current_xp, current_available_neft
  FROM user_balances ub
  WHERE ub.wallet_address = user_wallet;

  -- Update user_balances table for UI integration
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft
  ) VALUES (
    user_wallet,
    current_neft + reward_record.neft_reward,
    current_xp + reward_record.xp_reward,
    current_available_neft + reward_record.neft_reward
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + reward_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + reward_record.xp_reward,
    available_neft = user_balances.available_neft + reward_record.neft_reward;

  -- Get final totals for response
  SELECT 
    COALESCE(ub.total_neft_claimed, 0),
    COALESCE(ub.total_xp_earned, 0)
  INTO current_neft, current_xp
  FROM user_balances ub
  WHERE ub.wallet_address = user_wallet;

  -- Return success response
  RETURN QUERY SELECT 
    TRUE,
    'Daily reward claimed successfully!',
    new_streak,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    reward_record.cycle_day,
    current_neft,
    current_xp;
END;
$$ LANGUAGE plpgsql;

-- Dashboard function for UI
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
  upcoming_milestones JSONB,
  recent_claims JSONB,
  hours_until_next_claim INTEGER,
  minutes_until_next_claim INTEGER
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  streak_count INTEGER := 0;
  longest_count INTEGER := 0;
  total_count INTEGER := 0;
  claim_date DATE := NULL;
  neft_earned DECIMAL(18,8) := 0.0;
  xp_earned INTEGER := 0;
  started_at DATE := NULL;
  can_claim BOOLEAN := TRUE;
  next_streak_calc INTEGER := 1;
  reward_record RECORD;
  hours_until INTEGER := 0;
  minutes_until INTEGER := 0;
  last_claim_time TIMESTAMPTZ;
BEGIN
  -- Get user streak data
  SELECT 
    COALESCE(us.current_streak, 0),
    COALESCE(us.longest_streak, 0),
    COALESCE(us.total_claims, 0),
    us.last_claim_date,
    COALESCE(us.total_neft_earned, 0.0),
    COALESCE(us.total_xp_earned, 0),
    us.streak_started_at
  INTO 
    streak_count,
    longest_count,
    total_count,
    claim_date,
    neft_earned,
    xp_earned,
    started_at
  FROM user_streaks us 
  WHERE us.wallet_address = user_wallet;

  -- Check 24-hour cooldown
  SELECT claimed_at INTO last_claim_time
  FROM daily_claims
  WHERE wallet_address = user_wallet
  ORDER BY claimed_at DESC
  LIMIT 1;

  IF last_claim_time IS NOT NULL AND NOW() < (last_claim_time + INTERVAL '24 hours') THEN
    can_claim := FALSE;
    
    -- Calculate remaining time
    DECLARE
      total_seconds INTEGER;
      next_available TIMESTAMPTZ;
    BEGIN
      next_available := last_claim_time + INTERVAL '24 hours';
      total_seconds := EXTRACT(EPOCH FROM (next_available - NOW()))::INTEGER;
      
      IF total_seconds > 0 THEN
        hours_until := total_seconds / 3600;
        minutes_until := (total_seconds % 3600) / 60;
      END IF;
    END;
  END IF;

  -- Calculate next streak
  IF can_claim THEN
    next_streak_calc := streak_count + 1;
  ELSE
    next_streak_calc := streak_count;
  END IF;
  
  -- Get next reward
  SELECT * INTO reward_record FROM calculate_progressive_daily_reward(next_streak_calc);
  
  -- Return dashboard data
  RETURN QUERY SELECT
    streak_count,
    longest_count,
    total_count,
    can_claim,
    claim_date,
    neft_earned,
    xp_earned,
    started_at,
    next_streak_calc,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    FALSE, -- next_is_milestone
    '[]'::JSONB, -- upcoming_milestones
    '[]'::JSONB, -- recent_claims
    hours_until,
    minutes_until;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated, anon, public;

-- Test the system
DO $$
BEGIN
    RAISE NOTICE '✅ FRESH DAILY CLAIMS SYSTEM DEPLOYED!';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '- 7-day progressive rewards (5→8→12→17→22→30→35 NEFT/XP)';
    RAISE NOTICE '- 24-hour cooldown enforcement';
    RAISE NOTICE '- Proper user_balances integration';
    RAISE NOTICE '- Compatible with existing DailyClaim UI';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions available:';
    RAISE NOTICE '- calculate_progressive_daily_reward(streak_day)';
    
    RAISE NOTICE '- process_daily_claim(wallet_address)';
    RAISE NOTICE '- get_daily_claim_dashboard(wallet_address)';
END $$;
