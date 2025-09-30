-- ============================================================================
-- NEW PROGRESSIVE DAILY REWARDS SYSTEM
-- Implements 7-day cycle with progressive rewards that repeat
-- Day 1: 5 NEFT, 5 XP | Day 2: 8 NEFT, 8 XP | Day 3: 12 NEFT, 12 XP
-- Day 4: 17 NEFT, 17 XP | Day 5: 22 NEFT, 22 XP | Day 6: 30 NEFT, 30 XP
-- Day 7: 35 NEFT, 35 XP | Then repeats from Day 1
-- ============================================================================

-- Function to calculate progressive daily rewards based on streak position
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

-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS process_daily_claim(TEXT);

-- Updated process_daily_claim function with new progressive rewards
CREATE OR REPLACE FUNCTION process_daily_claim(user_wallet TEXT)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  streak_count INTEGER,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  reward_tier TEXT,
  nft_reward JSONB,
  is_milestone BOOLEAN,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER,
  cycle_day INTEGER
)
SECURITY DEFINER
AS $$
DECLARE
  current_streak INTEGER := 0;
  last_claim DATE;
  reward_data RECORD;
  user_record RECORD;
  new_total_neft DECIMAL(18,8);
  new_total_xp INTEGER;
  total_reward_neft DECIMAL(18,8);
  total_reward_xp INTEGER;
  progressive_reward RECORD;
BEGIN
  -- Check if user can claim today (date-based check)
  IF EXISTS (SELECT 1 FROM daily_claims WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE) THEN
    RETURN QUERY SELECT FALSE, 'Already claimed today'::TEXT, 0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE, 0.0::DECIMAL(18,8), 0, 0;
    RETURN;
  END IF;

  -- Check 24-hour cooldown period from last claim
  IF EXISTS (
    SELECT 1 FROM daily_claims 
    WHERE wallet_address = user_wallet 
    AND claimed_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Must wait 24 hours between claims'::TEXT, 0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE, 0.0::DECIMAL(18,8), 0, 0;
    RETURN;
  END IF;

  -- Get or create user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  IF user_record IS NULL THEN
    -- Create new streak record
    INSERT INTO user_streaks (
      wallet_address, 
      current_streak, 
      longest_streak, 
      total_claims, 
      last_claim_date,
      streak_started_at
    ) VALUES (
      user_wallet, 
      1, 
      1, 
      1, 
      CURRENT_DATE,
      CURRENT_DATE
    );
    current_streak := 1;
  ELSE
    last_claim := user_record.last_claim_date;
    
    IF last_claim = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Continue streak
      current_streak := user_record.current_streak + 1;
      
      UPDATE user_streaks 
      SET 
        current_streak = current_streak,
        longest_streak = GREATEST(longest_streak, current_streak),
        total_claims = total_claims + 1,
        last_claim_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE wallet_address = user_wallet;
    ELSE
      -- Reset streak (missed a day or more)
      current_streak := 1;
      
      UPDATE user_streaks 
      SET 
        current_streak = 1,
        longest_streak = GREATEST(longest_streak, 1),
        total_claims = total_claims + 1,
        last_claim_date = CURRENT_DATE,
        streak_started_at = CURRENT_DATE,
        updated_at = NOW()
      WHERE wallet_address = user_wallet;
    END IF;
  END IF;

  -- Calculate progressive reward based on current streak
  SELECT * INTO progressive_reward FROM calculate_progressive_daily_reward(current_streak);

  -- Insert daily claim record
  INSERT INTO daily_claims (
    wallet_address,
    claim_date,
    streak_count,
    neft_reward,
    xp_reward,
    reward_tier,
    nft_reward,
    claimed_at
  ) VALUES (
    user_wallet,
    CURRENT_DATE,
    current_streak,
    progressive_reward.neft_reward,
    progressive_reward.xp_reward,
    progressive_reward.reward_tier,
    NULL, -- No NFT rewards in new system
    NOW()
  );

  -- Update user_balances table for UI integration
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    updated_at
  ) VALUES (
    user_wallet,
    progressive_reward.neft_reward,
    progressive_reward.xp_reward,
    progressive_reward.neft_reward,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + progressive_reward.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + progressive_reward.xp_reward,
    available_neft = user_balances.available_neft + progressive_reward.neft_reward,
    updated_at = NOW();

  -- Get updated totals for return
  SELECT 
    COALESCE(SUM(dc.neft_reward), 0),
    COALESCE(SUM(dc.xp_reward), 0)
  INTO total_reward_neft, total_reward_xp
  FROM daily_claims dc
  WHERE dc.wallet_address = user_wallet;

  RETURN QUERY SELECT 
    TRUE,
    format('Claimed %s NEFT and %s XP for day %s of your streak!', 
           progressive_reward.neft_reward, 
           progressive_reward.xp_reward, 
           current_streak),
    current_streak,
    progressive_reward.neft_reward,
    progressive_reward.xp_reward,
    progressive_reward.reward_tier,
    NULL::JSONB, -- No NFT rewards
    FALSE, -- No special milestones in new system
    total_reward_neft,
    total_reward_xp,
    progressive_reward.cycle_day;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get time remaining until next claim is available
CREATE OR REPLACE FUNCTION get_claim_cooldown_info(user_wallet TEXT)
RETURNS TABLE(
  can_claim_now BOOLEAN,
  hours_remaining INTEGER,
  minutes_remaining INTEGER,
  next_available_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
DECLARE
  last_claim_time TIMESTAMPTZ;
  next_available TIMESTAMPTZ;
  time_diff INTERVAL;
BEGIN
  -- Get the most recent claim time
  SELECT claimed_at INTO last_claim_time
  FROM daily_claims
  WHERE wallet_address = user_wallet
  ORDER BY claimed_at DESC
  LIMIT 1;

  -- If no previous claims, user can claim immediately
  IF last_claim_time IS NULL THEN
    RETURN QUERY SELECT TRUE, 0, 0, NOW();
    RETURN;
  END IF;

  -- Calculate when next claim will be available (24 hours after last claim)
  next_available := last_claim_time + INTERVAL '24 hours';

  -- If current time is past the next available time, user can claim
  IF NOW() >= next_available THEN
    RETURN QUERY SELECT TRUE, 0, 0, NOW();
    RETURN;
  END IF;

  -- Calculate remaining time
  time_diff := next_available - NOW();
  
  RETURN QUERY SELECT 
    FALSE,
    EXTRACT(HOUR FROM time_diff)::INTEGER,
    EXTRACT(MINUTE FROM time_diff)::INTEGER,
    next_available;
END;
$$ LANGUAGE plpgsql;

-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_user_streak_info(TEXT);

-- Updated get_user_streak_info function to work with new system
CREATE OR REPLACE FUNCTION get_user_streak_info(user_wallet TEXT)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  total_claims INTEGER,
  can_claim_today BOOLEAN,
  last_claim_date DATE,
  next_neft_reward DECIMAL(18,8),
  next_xp_reward INTEGER,
  next_reward_tier TEXT,
  cycle_day INTEGER
)
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  next_reward RECORD;
  can_claim BOOLEAN := FALSE;
BEGIN
  -- Get user streak information
  SELECT 
    us.current_streak,
    us.longest_streak,
    us.total_claims,
    us.last_claim_date
  INTO user_record
  FROM user_streaks us
  WHERE us.wallet_address = user_wallet;

  -- If no record exists, user can claim and will start at day 1
  IF user_record IS NULL THEN
    SELECT * INTO next_reward FROM calculate_progressive_daily_reward(1);
    
    RETURN QUERY SELECT 
      0, -- current_streak
      0, -- longest_streak
      0, -- total_claims
      TRUE, -- can_claim_today
      NULL::DATE, -- last_claim_date
      next_reward.neft_reward,
      next_reward.xp_reward,
      next_reward.reward_tier,
      next_reward.cycle_day;
    RETURN;
  END IF;

  -- Check if user can claim today (both date and 24-hour cooldown)
  can_claim := (user_record.last_claim_date IS NULL OR user_record.last_claim_date < CURRENT_DATE) 
    AND NOT EXISTS (
      SELECT 1 FROM daily_claims 
      WHERE wallet_address = user_wallet 
      AND claimed_at > NOW() - INTERVAL '24 hours'
    );

  -- Calculate next reward (either for today if can claim, or tomorrow)
  IF can_claim THEN
    -- If can claim today, calculate reward for continuing current streak
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Continue streak
      SELECT * INTO next_reward FROM calculate_progressive_daily_reward(user_record.current_streak + 1);
    ELSE
      -- Reset streak
      SELECT * INTO next_reward FROM calculate_progressive_daily_reward(1);
    END IF;
  ELSE
    -- Already claimed today, show tomorrow's reward
    SELECT * INTO next_reward FROM calculate_progressive_daily_reward(user_record.current_streak + 1);
  END IF;

  RETURN QUERY SELECT 
    user_record.current_streak,
    user_record.longest_streak,
    user_record.total_claims,
    can_claim,
    user_record.last_claim_date,
    next_reward.neft_reward,
    next_reward.xp_reward,
    next_reward.reward_tier,
    next_reward.cycle_day;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO public;

GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO public;

GRANT EXECUTE ON FUNCTION get_user_streak_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_streak_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_streak_info(TEXT) TO public;

GRANT EXECUTE ON FUNCTION get_claim_cooldown_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_claim_cooldown_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_claim_cooldown_info(TEXT) TO public;

-- Test the new progressive reward system
SELECT 'Testing new progressive daily reward system...' as test_header;

-- Test reward calculation for each day of the cycle
SELECT 
  day,
  neft_reward,
  xp_reward,
  reward_tier,
  cycle_day
FROM generate_series(1, 14) as day,
LATERAL calculate_progressive_daily_reward(day);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'NEW PROGRESSIVE DAILY REWARDS SYSTEM DEPLOYED!';
    RAISE NOTICE 'Reward Schedule:';
    RAISE NOTICE '✅ Day 1: 5 NEFT, 5 XP';
    RAISE NOTICE '✅ Day 2: 8 NEFT, 8 XP';
    RAISE NOTICE '✅ Day 3: 12 NEFT, 12 XP';
    RAISE NOTICE '✅ Day 4: 17 NEFT, 17 XP';
    RAISE NOTICE '✅ Day 5: 22 NEFT, 22 XP';
    RAISE NOTICE '✅ Day 6: 30 NEFT, 30 XP';
    RAISE NOTICE '✅ Day 7: 35 NEFT, 35 XP';
    RAISE NOTICE '✅ Cycle repeats every 7 days';
    RAISE NOTICE '✅ Integrated with user_balances table';
    RAISE NOTICE 'Ready for production use!';
END $$;
