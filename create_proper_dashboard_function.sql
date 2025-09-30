-- ============================================================================
-- CREATE PROPER DASHBOARD FUNCTION
-- This creates a working dashboard function that uses the correct progressive rewards
-- ============================================================================

-- Drop existing dashboard function
DROP FUNCTION IF EXISTS get_daily_claim_dashboard(TEXT);

-- Create the correct dashboard function
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
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated;

-- Test the dashboard function
SELECT 'Testing dashboard function:' as info;
SELECT * FROM get_daily_claim_dashboard('0x7780E03eF5709441fA566e138B498100C2c7B9F2');
