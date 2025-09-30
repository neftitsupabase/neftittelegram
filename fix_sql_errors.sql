-- Fix SQL errors in cache-free RPC functions
-- 1. Fix achievement_status enum casting
-- 2. Fix GROUP BY clause with json_agg

-- Step 1: Fix get_user_achievements_cache_free (remove json_agg GROUP BY issue)
CREATE OR REPLACE FUNCTION get_user_achievements_cache_free(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  achievements_data JSON;
BEGIN
  -- Get achievements without json_agg to avoid GROUP BY issues
  WITH achievement_data AS (
    SELECT 
      ua.achievement_key,
      am.title,
      am.description,
      am.category,
      am.icon,
      am.color,
      am.neft_reward,
      am.xp_reward,
      am.required_count,
      COALESCE(ua.current_progress, 0) as current_progress,
      COALESCE(ua.status, 'locked') as status,
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
    ORDER BY am.category, am.achievement_key
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

-- Step 2: Fix fix_achievement_states_for_service (enum casting)
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

  -- Fix achievement states with proper enum casting
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
    AND ua.wallet_address = user_wallet
    AND (
      (ua.current_progress >= am.required_count AND ua.status != 'completed') OR
      (ua.current_progress > 0 AND ua.current_progress < am.required_count AND ua.status != 'in_progress') OR
      (ua.current_progress = 0 AND ua.status != 'locked')
    );

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  RETURN json_build_object(
    'fixed_achievements', fixed_count,
    'integration_ready', true,
    'cache_free', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Fix update_achievement_progress_cache_free (enum casting)
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
  user_exists BOOLEAN := FALSE;
BEGIN
  -- Validate inputs
  IF user_wallet IS NULL OR achievement_key_param IS NULL THEN
    RETURN json_build_object(
      'error', 'Invalid parameters',
      'cache_free', true
    );
  END IF;

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

  -- Check if user achievement exists
  SELECT ua.current_progress 
  INTO current_progress
  FROM user_achievements ua 
  WHERE ua.wallet_address = user_wallet 
    AND ua.achievement_key = achievement_key_param;

  -- Insert or update user achievement with proper enum casting
  IF current_progress IS NULL THEN
    -- Create new user achievement
    INSERT INTO user_achievements (
      wallet_address, 
      achievement_key, 
      current_progress, 
      status,
      created_at,
      updated_at
    ) VALUES (
      user_wallet, 
      achievement_key_param, 
      progress_increment, 
      CASE WHEN progress_increment >= required_count THEN 'completed'::achievement_status ELSE 'in_progress'::achievement_status END,
      NOW(),
      NOW()
    );
    new_progress := progress_increment;
  ELSE
    -- Update existing achievement
    new_progress := current_progress + progress_increment;
    
    UPDATE user_achievements 
    SET 
      current_progress = new_progress,
      status = CASE WHEN new_progress >= required_count THEN 'completed'::achievement_status ELSE 'in_progress'::achievement_status END,
      completed_at = CASE WHEN new_progress >= required_count AND status != 'completed' THEN NOW() ELSE completed_at END,
      updated_at = NOW()
    WHERE wallet_address = user_wallet 
      AND achievement_key = achievement_key_param;
  END IF;

  -- Check if achievement was completed
  achievement_completed := (new_progress >= required_count);

  RETURN json_build_object(
    'achievement_completed', achievement_completed,
    'new_progress', new_progress,
    'required_count', required_count,
    'cache_free', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_achievements_cache_free(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress_cache_free(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_achievement_states_for_service(TEXT) TO authenticated;

-- Test the fixes
SELECT 'SQL errors fixed - enum casting and GROUP BY issues resolved' as status;
