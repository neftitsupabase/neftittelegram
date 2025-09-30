-- Fix Achievement Tracking - Proper State Management
-- Ensures achievements properly track: locked → in_progress → completed

-- Step 1: Initialize all achievements for users (if not exists)
CREATE OR REPLACE FUNCTION initialize_user_achievements_complete(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  initialized_count INTEGER := 0;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN json_build_object(
      'error', 'Invalid wallet address',
      'initialized_count', 0
    );
  END IF;

  -- Insert missing achievements for user with locked status
  INSERT INTO user_achievements (
    wallet_address,
    achievement_key,
    current_progress,
    status,
    created_at,
    updated_at
  )
  SELECT 
    user_wallet,
    am.achievement_key,
    0,
    'locked'::achievement_status,
    NOW(),
    NOW()
  FROM achievements_master am
  WHERE NOT EXISTS (
    SELECT 1 FROM user_achievements ua 
    WHERE ua.wallet_address = user_wallet 
      AND ua.achievement_key = am.achievement_key
  );

  GET DIAGNOSTICS initialized_count = ROW_COUNT;

  RETURN json_build_object(
    'initialized_count', initialized_count,
    'wallet_address', user_wallet,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Enhanced achievement progress update with proper state tracking
CREATE OR REPLACE FUNCTION update_achievement_progress_cache_free(
  user_wallet TEXT,
  achievement_key_param TEXT,
  progress_increment INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
  current_progress INTEGER := 0;
  required_count INTEGER := 0;
  new_progress INTEGER := 0;
  achievement_completed BOOLEAN := FALSE;
  old_status achievement_status;
  new_status achievement_status;
BEGIN
  -- Validate inputs
  IF user_wallet IS NULL OR achievement_key_param IS NULL THEN
    RETURN json_build_object(
      'error', 'Invalid parameters',
      'cache_free', true
    );
  END IF;

  -- Initialize user achievements if not exists
  PERFORM initialize_user_achievements_complete(user_wallet);

  -- Get required count from master
  SELECT am.required_count 
  INTO required_count
  FROM achievements_master am 
  WHERE am.achievement_key = achievement_key_param;
  
  IF required_count IS NULL THEN
    RETURN json_build_object(
      'error', 'Achievement not found',
      'cache_free', true
    );
  END IF;

  -- Get current progress and status
  SELECT ua.current_progress, ua.status
  INTO current_progress, old_status
  FROM user_achievements ua 
  WHERE ua.wallet_address = user_wallet 
    AND ua.achievement_key = achievement_key_param;

  -- Calculate new progress
  new_progress := COALESCE(current_progress, 0) + progress_increment;
  
  -- Determine new status based on progress
  IF new_progress >= required_count THEN
    new_status := 'completed'::achievement_status;
    achievement_completed := TRUE;
  ELSIF new_progress > 0 THEN
    new_status := 'in_progress'::achievement_status;
    achievement_completed := FALSE;
  ELSE
    new_status := 'locked'::achievement_status;
    achievement_completed := FALSE;
  END IF;

  -- Update achievement with proper state transition
  UPDATE user_achievements 
  SET 
    current_progress = new_progress,
    status = new_status,
    completed_at = CASE 
      WHEN new_status = 'completed' AND old_status != 'completed' THEN NOW() 
      ELSE completed_at 
    END,
    updated_at = NOW()
  WHERE wallet_address = user_wallet 
    AND achievement_key = achievement_key_param;

  RETURN json_build_object(
    'achievement_completed', achievement_completed,
    'new_progress', new_progress,
    'required_count', required_count,
    'old_status', old_status,
    'new_status', new_status,
    'cache_free', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Enhanced get_user_achievements with proper status display
CREATE OR REPLACE FUNCTION get_user_achievements_cache_free(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  achievements_data JSON;
BEGIN
  -- Initialize user achievements if not exists
  PERFORM initialize_user_achievements_complete(user_wallet);

  -- Get achievements with proper status tracking
  WITH achievement_data AS (
    SELECT 
      COALESCE(ua.achievement_key, am.achievement_key) as achievement_key,
      am.title,
      am.description,
      am.category,
      am.icon,
      am.color,
      am.neft_reward,
      am.xp_reward,
      am.required_count,
      COALESCE(ua.current_progress, 0) as current_progress,
      COALESCE(ua.status, 'locked'::achievement_status) as status,
      ua.completed_at,
      ua.claimed_at,
      CASE 
        WHEN am.required_count > 0 THEN 
          LEAST(100, (COALESCE(ua.current_progress, 0) * 100.0 / am.required_count))
        ELSE 0 
      END as progress_percentage
    FROM achievements_master am
    LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
      AND ua.wallet_address = user_wallet
    WHERE (category_filter IS NULL OR am.category::TEXT = category_filter::TEXT)
    ORDER BY 
      CASE am.category 
        WHEN 'quest' THEN 1
        WHEN 'staking' THEN 2
        WHEN 'burn' THEN 3
        WHEN 'social' THEN 4
        WHEN 'referral' THEN 5
        WHEN 'checkin' THEN 6
        WHEN 'campaign' THEN 7
        ELSE 8
      END,
      am.achievement_key
  )
  SELECT json_agg(
    json_build_object(
      'achievement_key', achievement_key,
      'title', title,
      'description', description,
      'category', category,
      'icon', icon,
      'color', color,
      'neft_reward', neft_reward,
      'xp_reward', xp_reward,
      'required_count', required_count,
      'current_progress', current_progress,
      'status', status,
      'completed_at', completed_at,
      'claimed_at', claimed_at,
      'progress_percentage', progress_percentage
    )
  )
  INTO achievements_data
  FROM achievement_data;

  RETURN COALESCE(achievements_data, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Enhanced achievement stats with proper counting
CREATE OR REPLACE FUNCTION get_achievement_stats(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER := 0;
  completed_count INTEGER := 0;
  in_progress_count INTEGER := 0;
  locked_count INTEGER := 0;
  completion_percentage DECIMAL(5,2) := 0;
BEGIN
  -- Initialize user achievements if not exists
  PERFORM initialize_user_achievements_complete(user_wallet);

  -- Get achievement counts by status
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN COALESCE(ua.status, 'locked') = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN COALESCE(ua.status, 'locked') = 'in_progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN COALESCE(ua.status, 'locked') = 'locked' THEN 1 END) as locked
  INTO total_count, completed_count, in_progress_count, locked_count
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
    AND ua.wallet_address = user_wallet;

  -- Calculate completion percentage
  IF total_count > 0 THEN
    completion_percentage := ROUND((completed_count * 100.0 / total_count), 2);
  END IF;

  RETURN json_build_object(
    'total', total_count,
    'completed', completed_count,
    'in_progress', in_progress_count,
    'locked', locked_count,
    'completion_percentage', completion_percentage
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Fix achievement states for existing users
CREATE OR REPLACE FUNCTION fix_achievement_states_for_service(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  fixed_count INTEGER := 0;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN json_build_object(
      'error', 'Invalid wallet address',
      'integration_ready', false
    );
  END IF;

  -- Initialize missing achievements first
  PERFORM initialize_user_achievements_complete(user_wallet);

  -- Fix achievement states based on current progress
  UPDATE user_achievements ua
  SET 
    status = CASE 
      WHEN ua.current_progress >= am.required_count THEN 'completed'::achievement_status
      WHEN ua.current_progress > 0 THEN 'in_progress'::achievement_status
      ELSE 'locked'::achievement_status
    END,
    completed_at = CASE 
      WHEN ua.current_progress >= am.required_count AND ua.completed_at IS NULL THEN NOW()
      ELSE ua.completed_at
    END,
    updated_at = NOW()
  FROM achievements_master am
  WHERE ua.achievement_key = am.achievement_key
    AND ua.wallet_address = user_wallet;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  RETURN json_build_object(
    'fixed_achievements', fixed_count,
    'integration_ready', true,
    'cache_free', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION initialize_user_achievements_complete(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_achievements_cache_free(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress_cache_free(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_achievement_states_for_service(TEXT) TO authenticated;

-- Test the achievement tracking
SELECT 'Achievement tracking fixed - proper state management implemented' as status;
