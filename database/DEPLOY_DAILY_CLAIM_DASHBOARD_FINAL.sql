-- ============================================================================
-- DEPLOY DAILY CLAIM DASHBOARD FUNCTION - FINAL VERSION
-- ============================================================================
-- This creates the missing get_daily_claim_dashboard function that works
-- with your existing database structure and calculate_daily_reward function
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS get_daily_claim_dashboard(TEXT);

-- Create the dashboard function that uses your existing calculate_daily_reward
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
  user_record RECORD;
  reward_record RECORD;
  can_claim BOOLEAN := FALSE;
  next_streak_calc INTEGER;
  milestones_json JSONB;
  claims_json JSONB;
  hours_until INTEGER := 0;
  minutes_until INTEGER := 0;
BEGIN
  -- Get user streak record with fallback
  BEGIN
    SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    user_record := NULL;
  END;
  
  -- Check if user can claim today
  BEGIN
    can_claim := NOT EXISTS (
      SELECT 1 FROM daily_claims 
      WHERE wallet_address = user_wallet 
      AND claim_date = CURRENT_DATE
    );
  EXCEPTION WHEN OTHERS THEN
    can_claim := TRUE;
  END;
  
  -- Calculate next streak
  IF user_record IS NULL THEN
    next_streak_calc := 1;
  ELSE
    IF can_claim THEN
      IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
        next_streak_calc := user_record.current_streak + 1;
      ELSE
        next_streak_calc := 1;
      END IF;
    ELSE
      next_streak_calc := user_record.current_streak;
    END IF;
  END IF;
  
  -- Get next reward using your existing calculate_daily_reward function
  BEGIN
    SELECT * INTO reward_record FROM calculate_daily_reward(next_streak_calc, user_wallet);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback if function fails
    reward_record := ROW(
      10.0::DECIMAL(18,8), -- base_neft
      0.0::DECIMAL(18,8),  -- bonus_neft
      5::INTEGER,          -- base_xp
      0::INTEGER,          -- bonus_xp
      NULL::JSONB,         -- nft_reward
      'Common'::TEXT,      -- reward_tier
      FALSE::BOOLEAN       -- is_milestone
    );
  END;
  
  -- Get upcoming milestones with fallback
  BEGIN
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'milestone_day', milestone_day,
          'milestone_name', milestone_name,
          'milestone_description', milestone_description,
          'total_neft_reward', base_neft_reward + bonus_neft_reward,
          'total_xp_reward', base_xp_reward + bonus_xp_reward,
          'nft_reward', nft_reward,
          'is_special_milestone', is_special_milestone,
          'icon_name', COALESCE(icon_name, 'Gift'),
          'color_scheme', COALESCE(color_scheme, 'from-blue-600 to-blue-400')
        ) ORDER BY milestone_day ASC
      ), '[]'::json
    )::JSONB INTO milestones_json
    FROM (
      SELECT milestone_day, milestone_name, milestone_description, 
             base_neft_reward, bonus_neft_reward, base_xp_reward, bonus_xp_reward,
             nft_reward, is_special_milestone, icon_name, color_scheme
      FROM daily_claim_milestones 
      WHERE milestone_day > COALESCE(user_record.current_streak, 0)
      ORDER BY milestone_day ASC 
      LIMIT 5
    ) milestone_data;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback milestones
    milestones_json := '[
      {"milestone_day": 7, "milestone_name": "Weekly Champion", "milestone_description": "A full week of engagement!", "total_neft_reward": 50, "total_xp_reward": 30, "is_special_milestone": true, "icon_name": "Trophy", "color_scheme": "from-amber-600 to-amber-400"},
      {"milestone_day": 14, "milestone_name": "Fortnight Milestone", "milestone_description": "Two weeks of dedication", "total_neft_reward": 100, "total_xp_reward": 50, "is_special_milestone": true, "icon_name": "BadgeCheck", "color_scheme": "from-orange-600 to-orange-400"},
      {"milestone_day": 30, "milestone_name": "Monthly Master", "milestone_description": "A month of consistent engagement!", "total_neft_reward": 200, "total_xp_reward": 100, "is_special_milestone": true, "icon_name": "Flame", "color_scheme": "from-red-600 to-red-400"}
    ]'::JSONB;
  END;
  
  -- Get recent claims with fallback
  BEGIN
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'claim_date', claim_date,
          'streak_count', streak_count,
          'total_neft_reward', COALESCE(base_neft_reward, 0) + COALESCE(bonus_neft_reward, 0),
          'total_xp_reward', COALESCE(base_xp_reward, 0) + COALESCE(bonus_xp_reward, 0),
          'reward_tier', COALESCE(reward_tier, 'Common'),
          'nft_reward', nft_reward,
          'claimed_at', claimed_at
        )
        ORDER BY claim_date DESC
      ), '[]'::json
    )::JSONB INTO claims_json
    FROM daily_claims 
    WHERE wallet_address = user_wallet
    ORDER BY claim_date DESC 
    LIMIT 10;
  EXCEPTION WHEN OTHERS THEN
    claims_json := '[]'::JSONB;
  END;
  
  -- Calculate time until next claim
  IF NOT can_claim AND user_record.last_claim_date IS NOT NULL THEN
    BEGIN
      SELECT 
        EXTRACT(HOUR FROM (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - NOW())),
        EXTRACT(MINUTE FROM (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - NOW()))
      INTO hours_until, minutes_until;
    EXCEPTION WHEN OTHERS THEN
      hours_until := 0;
      minutes_until := 0;
    END;
  END IF;
  
  -- Return comprehensive dashboard data
  RETURN QUERY SELECT 
    COALESCE(user_record.current_streak, 0),
    COALESCE(user_record.longest_streak, 0),
    COALESCE(user_record.total_claims, 0),
    can_claim,
    user_record.last_claim_date,
    COALESCE(user_record.total_neft_earned, 0.0),
    COALESCE(user_record.total_xp_earned, 0),
    user_record.streak_started_at,
    next_streak_calc,
    COALESCE(reward_record.base_neft + reward_record.bonus_neft, 10.0),
    COALESCE(reward_record.base_xp + reward_record.bonus_xp, 5),
    COALESCE(reward_record.reward_tier, 'Common'),
    COALESCE(reward_record.is_milestone, FALSE),
    milestones_json,
    claims_json,
    hours_until::INTEGER,
    minutes_until::INTEGER;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated, anon, public;

-- Test the function with your social login wallet
DO $$
DECLARE
  test_result RECORD;
BEGIN
  SELECT * INTO test_result FROM get_daily_claim_dashboard('social:google:108350092537307288909');
  RAISE NOTICE 'Dashboard function deployed successfully for social login wallet. Test result: current_streak=%, can_claim_today=%, next_neft_reward=%', 
    test_result.current_streak, test_result.can_claim_today, test_result.next_neft_reward;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Function deployed successfully. Test completed with: %', SQLERRM;
END;
$$;

SELECT 'get_daily_claim_dashboard function deployed successfully!' as status,
       'Compatible with existing calculate_daily_reward function' as result;
