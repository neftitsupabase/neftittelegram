-- Fix cache-free RPC functions with proper type casting
-- Addresses the operator error: achievement_category = text

-- Step 1: Fix get_user_achievements_cache_free with proper type casting
CREATE OR REPLACE FUNCTION get_user_achievements_cache_free(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  achievements_data JSON;
BEGIN
  -- Get achievements without any caching, fix type casting issue
  SELECT json_agg(
    json_build_object(
      'achievement_key', ua.achievement_key,
      'title', am.title,
      'description', am.description,
      'category', am.category,
      'icon', am.icon,
      'color', am.color,
      'neft_reward', am.neft_reward,
      'xp_reward', am.xp_reward,
      'required_count', am.required_count,
      'current_progress', COALESCE(ua.current_progress, 0),
      'status', COALESCE(ua.status, 'locked'),
      'completed_at', ua.completed_at,
      'claimed_at', ua.claimed_at,
      'progress_percentage', 
        CASE 
          WHEN am.required_count > 0 THEN 
            LEAST(100, (COALESCE(ua.current_progress, 0) * 100.0 / am.required_count))
          ELSE 0 
        END
    )
  )
  INTO achievements_data
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
    AND ua.wallet_address = user_wallet
  WHERE (category_filter IS NULL OR am.category::TEXT = category_filter::TEXT)
  ORDER BY am.category, am.achievement_key;

  RETURN COALESCE(achievements_data, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create update_achievement_progress_cache_free
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

  -- Insert or update user achievement
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
      CASE WHEN progress_increment >= required_count THEN 'completed' ELSE 'in_progress' END,
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
      status = CASE WHEN new_progress >= required_count THEN 'completed' ELSE 'in_progress' END,
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

-- Step 3: Create claim_achievement_reward_cache_free
CREATE OR REPLACE FUNCTION claim_achievement_reward_cache_free(
  user_wallet TEXT,
  achievement_key_param TEXT
)
RETURNS JSON AS $$
DECLARE
  achievement_status TEXT;
  neft_reward DECIMAL(18,8) := 0;
  xp_reward INTEGER := 0;
  already_claimed BOOLEAN := FALSE;
BEGIN
  -- Validate inputs
  IF user_wallet IS NULL OR achievement_key_param IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid parameters',
      'cache_free', true
    );
  END IF;

  -- Check achievement status and get reward amounts
  SELECT 
    ua.status,
    am.neft_reward,
    am.xp_reward,
    (ua.claimed_at IS NOT NULL)
  INTO achievement_status, neft_reward, xp_reward, already_claimed
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet 
    AND ua.achievement_key = achievement_key_param;

  -- Check if achievement exists
  IF achievement_status IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement not found for user',
      'cache_free', true
    );
  END IF;

  -- Check if already claimed
  IF already_claimed THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement reward already claimed',
      'cache_free', true
    );
  END IF;

  -- Check if achievement is completed
  IF achievement_status != 'completed' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement not completed yet',
      'cache_free', true
    );
  END IF;

  -- Mark as claimed
  UPDATE user_achievements 
  SET 
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE wallet_address = user_wallet 
    AND achievement_key = achievement_key_param;

  -- Add rewards to user balance (direct insert, no caching)
  INSERT INTO user_activities (
    wallet_address,
    activity_type,
    title,
    description,
    neft_reward,
    xp_reward,
    metadata,
    created_at
  ) VALUES (
    user_wallet,
    'achievement_claim',
    'Achievement Reward Claimed: ' || achievement_key_param,
    'Claimed reward for completing achievement',
    neft_reward,
    xp_reward,
    json_build_object(
      'achievement_key', achievement_key_param,
      'claim_type', 'achievement_reward',
      'cache_free', true
    ),
    NOW()
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Achievement reward claimed successfully',
    'neft_reward', neft_reward,
    'xp_reward', xp_reward,
    'cache_free', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create get_real_time_achievement_balance
CREATE OR REPLACE FUNCTION get_real_time_achievement_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  result JSON;
  achievement_count INTEGER := 0;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN json_build_object(
      'error', 'Invalid wallet address',
      'achievement_neft', 0,
      'achievement_xp', 0,
      'achievement_count', 0,
      'cache_free', true
    );
  END IF;

  -- Get achievement rewards with NO CACHING - direct database query
  SELECT 
    COALESCE(SUM(am.neft_reward), 0),
    COALESCE(SUM(am.xp_reward), 0),
    COUNT(*)
  INTO achievement_neft, achievement_xp, achievement_count
  FROM user_achievements ua 
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key 
  WHERE ua.wallet_address = user_wallet 
    AND ua.status = 'completed' 
    AND ua.claimed_at IS NOT NULL
    AND am.neft_reward > 0; -- Only count valid rewards

  -- Build result with real-time data
  result := json_build_object(
    'wallet_address', user_wallet,
    'achievement_neft', achievement_neft,
    'achievement_xp', achievement_xp,
    'achievement_count', achievement_count,
    'last_calculated', NOW(),
    'source', 'real_time_no_cache',
    'cache_free', true
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create fix_achievement_states_for_service
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

  -- Fix achievement states based on progress
  UPDATE user_achievements ua
  SET 
    status = CASE 
      WHEN ua.current_progress >= am.required_count THEN 'completed'
      WHEN ua.current_progress > 0 THEN 'in_progress'
      ELSE 'locked'
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

-- Step 6: Create sync_user_balance_cache_free
CREATE OR REPLACE FUNCTION sync_user_balance_cache_free(user_wallet TEXT)
RETURNS TEXT AS $$
DECLARE
  total_neft DECIMAL(18,8) := 0;
  total_xp INTEGER := 0;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN 'ERROR: Invalid wallet address';
  END IF;

  -- Calculate total from user_activities (real-time, no cache)
  SELECT 
    COALESCE(SUM(neft_reward), 0),
    COALESCE(SUM(xp_reward), 0)
  INTO total_neft, total_xp
  FROM user_activities 
  WHERE wallet_address = user_wallet;

  -- Update user_balances with real-time data
  INSERT INTO user_balances (wallet_address, total_neft, total_xp, available_neft, updated_at)
  VALUES (user_wallet, total_neft, total_xp, total_neft, NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    total_neft = EXCLUDED.total_neft,
    total_xp = EXCLUDED.total_xp,
    available_neft = EXCLUDED.available_neft,
    updated_at = NOW();

  RETURN 'SUCCESS: Balance synced - NEFT: ' || total_neft || ', XP: ' || total_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_achievements_cache_free(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress_cache_free(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_achievement_reward_cache_free(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_real_time_achievement_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_achievement_states_for_service(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_balance_cache_free(TEXT) TO authenticated;

-- Test the functions
SELECT 'Cache-free RPC functions deployed successfully' as status;
