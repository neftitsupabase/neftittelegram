-- Achievement Database Functions for Supabase
-- These functions support the AchievementsService frontend integration

-- Function 1: Get User Achievements
-- Returns all achievements for a user with their progress and status
CREATE OR REPLACE FUNCTION get_user_achievements(
  user_wallet TEXT,
  category_filter achievement_category DEFAULT NULL
)
RETURNS TABLE (
  achievement_key TEXT,
  title TEXT,
  description TEXT,
  category achievement_category,
  icon TEXT,
  color TEXT,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  nft_reward TEXT,
  required_count INTEGER,
  current_progress INTEGER,
  status achievement_status,
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  progress_percentage INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    am.achievement_key,
    am.title,
    am.description,
    am.category,
    am.icon,
    am.color,
    am.neft_reward,
    am.xp_reward,
    am.nft_reward,
    am.required_count,
    COALESCE(ua.current_progress, 0) as current_progress,
    COALESCE(ua.status, 'locked'::achievement_status) as status,
    ua.completed_at,
    ua.claimed_at,
    CASE 
      WHEN COALESCE(ua.current_progress, 0) >= am.required_count THEN 100
      WHEN am.required_count > 0 THEN ROUND((COALESCE(ua.current_progress, 0)::DECIMAL / am.required_count::DECIMAL) * 100)
      ELSE 0
    END::INTEGER as progress_percentage
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
    AND ua.wallet_address = user_wallet
  WHERE am.is_active = TRUE
    AND (category_filter IS NULL OR am.category = category_filter)
  ORDER BY 
    am.sort_order ASC,
    am.category ASC,
    am.achievement_key ASC;
END;
$$;

-- Function 2: Update Achievement Progress
-- Updates progress for a specific achievement and returns completion status
CREATE OR REPLACE FUNCTION update_achievement_progress(
  user_wallet TEXT,
  achievement_key_param TEXT,
  progress_increment INTEGER DEFAULT 1
)
RETURNS TABLE (
  achievement_completed BOOLEAN,
  new_progress INTEGER,
  required_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  achievement_required_count INTEGER;
  current_progress_value INTEGER;
  new_progress_value INTEGER;
  is_completed BOOLEAN DEFAULT FALSE;
BEGIN
  -- Get the required count for this achievement
  SELECT am.required_count INTO achievement_required_count
  FROM achievements_master am
  WHERE am.achievement_key = achievement_key_param AND am.is_active = TRUE;
  
  IF achievement_required_count IS NULL THEN
    RAISE EXCEPTION 'Achievement not found or inactive: %', achievement_key_param;
  END IF;
  
  -- Insert or update user achievement progress
  INSERT INTO user_achievements (wallet_address, achievement_key, current_progress, status, updated_at)
  VALUES (user_wallet, achievement_key_param, progress_increment, 'in-progress', NOW())
  ON CONFLICT (wallet_address, achievement_key)
  DO UPDATE SET 
    current_progress = user_achievements.current_progress + progress_increment,
    status = CASE 
      WHEN user_achievements.current_progress + progress_increment >= achievement_required_count THEN 'completed'::achievement_status
      ELSE 'in-progress'::achievement_status
    END,
    completed_at = CASE 
      WHEN user_achievements.current_progress + progress_increment >= achievement_required_count 
        AND user_achievements.completed_at IS NULL 
      THEN NOW()
      ELSE user_achievements.completed_at
    END,
    updated_at = NOW()
  RETURNING user_achievements.current_progress INTO new_progress_value;
  
  -- Check if achievement was completed
  is_completed := new_progress_value >= achievement_required_count;
  
  RETURN QUERY SELECT is_completed, new_progress_value, achievement_required_count;
END;
$$;

-- Function 3: Claim Achievement Reward
-- Claims rewards for a completed achievement
CREATE OR REPLACE FUNCTION claim_achievement_reward(
  user_wallet TEXT,
  achievement_key_param TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  nft_reward TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  achievement_record RECORD;
  user_achievement_record RECORD;
BEGIN
  -- Get achievement details
  SELECT * INTO achievement_record
  FROM achievements_master am
  WHERE am.achievement_key = achievement_key_param AND am.is_active = TRUE;
  
  IF achievement_record IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Achievement not found or inactive', 0::DECIMAL(18,8), 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Get user achievement status
  SELECT * INTO user_achievement_record
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF user_achievement_record IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Achievement not started', 0::DECIMAL(18,8), 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if already claimed
  IF user_achievement_record.claimed_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Achievement already claimed', 0::DECIMAL(18,8), 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if achievement is completed
  IF user_achievement_record.status != 'completed' THEN
    RETURN QUERY SELECT FALSE, 'Achievement not completed yet', 0::DECIMAL(18,8), 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Mark as claimed
  UPDATE user_achievements 
  SET claimed_at = NOW(), updated_at = NOW()
  WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  
  -- Update user balance with achievement rewards
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned)
  VALUES (user_wallet, achievement_record.neft_reward, achievement_record.xp_reward)
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + achievement_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + achievement_record.xp_reward,
    last_updated = NOW();
  
  -- Return success with rewards
  RETURN QUERY SELECT 
    TRUE, 
    'Achievement claimed successfully!', 
    achievement_record.neft_reward,
    achievement_record.xp_reward,
    achievement_record.nft_reward;
END;
$$;

-- Function 4: Initialize User Achievements
-- Creates initial achievement records for a new user (optional helper function)
CREATE OR REPLACE FUNCTION initialize_user_achievements(user_wallet TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Insert locked achievements for all active achievements that don't exist for this user
  INSERT INTO user_achievements (wallet_address, achievement_key, status, current_progress)
  SELECT user_wallet, am.achievement_key, 'locked'::achievement_status, 0
  FROM achievements_master am
  WHERE am.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.wallet_address = user_wallet AND ua.achievement_key = am.achievement_key
    );
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Function 5: Get Achievement Statistics
-- Returns overall achievement statistics for a user
CREATE OR REPLACE FUNCTION get_achievement_stats(user_wallet TEXT)
RETURNS TABLE (
  total INTEGER,
  completed INTEGER,
  in_progress INTEGER,
  completion_percentage INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*)::INTEGER as total_achievements,
      COUNT(CASE WHEN ua.status = 'completed' THEN 1 END)::INTEGER as completed_achievements,
      COUNT(CASE WHEN ua.status = 'in-progress' THEN 1 END)::INTEGER as in_progress_achievements
    FROM achievements_master am
    LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
      AND ua.wallet_address = user_wallet
    WHERE am.is_active = TRUE
  )
  SELECT 
    total_achievements,
    completed_achievements,
    in_progress_achievements,
    CASE 
      WHEN total_achievements > 0 THEN ROUND((completed_achievements::DECIMAL / total_achievements::DECIMAL) * 100)::INTEGER
      ELSE 0
    END as completion_percentage
  FROM stats;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, achievement_category) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_user_achievements(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO authenticated;
