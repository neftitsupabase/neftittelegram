-- ============================================================================
-- DEPLOY ALL ACHIEVEMENT RPC FUNCTIONS
-- Fixes 404 errors for missing achievement RPC functions
-- ============================================================================

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS claim_achievement_reward(TEXT, TEXT);

-- Create the claim_achievement_reward function
CREATE OR REPLACE FUNCTION claim_achievement_reward(
  user_wallet TEXT,
  achievement_key_param TEXT
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  user_achievement_record RECORD;
BEGIN
  -- Get achievement details
  SELECT * INTO achievement_record
  FROM achievements_master am
  WHERE am.achievement_key = achievement_key_param AND am.is_active = TRUE;
  
  IF achievement_record IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement not found or inactive',
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
  END IF;
  
  -- Get user achievement status
  SELECT * INTO user_achievement_record
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF user_achievement_record IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement not started',
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
  END IF;
  
  -- Check if already claimed
  IF user_achievement_record.claimed_at IS NOT NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement already claimed',
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
  END IF;
  
  -- Check if achievement is completed
  IF user_achievement_record.status != 'completed' THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement not completed yet',
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
  END IF;
  
  -- Mark as claimed
  UPDATE user_achievements 
  SET claimed_at = NOW(), updated_at = NOW()
  WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  
  -- Add rewards to user balance
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, created_at, updated_at)
  VALUES (user_wallet, achievement_record.neft_reward, achievement_record.xp_reward, achievement_record.neft_reward, NOW(), NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    total_neft_claimed = user_balances.total_neft_claimed + achievement_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + achievement_record.xp_reward,
    available_neft = user_balances.available_neft + achievement_record.neft_reward,
    updated_at = NOW();
  
  -- Return success with rewards
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Achievement claimed successfully!',
    'neft_reward', achievement_record.neft_reward,
    'xp_reward', achievement_record.xp_reward,
    'nft_reward', achievement_record.nft_reward
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Error claiming achievement reward: ' || SQLERRM,
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO public;

-- ============================================================================
-- UPDATE ACHIEVEMENT PROGRESS FUNCTION
-- ============================================================================

-- Drop existing function if it exists with different return type
DROP FUNCTION IF EXISTS update_achievement_progress(TEXT, TEXT, INTEGER);

-- Create the achievement progress function
CREATE OR REPLACE FUNCTION update_achievement_progress(
  user_wallet TEXT,
  achievement_key_param TEXT,
  progress_increment INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  user_achievement_record RECORD;
  new_progress INTEGER;
  achievement_completed BOOLEAN := FALSE;
BEGIN
  -- Get achievement details
  SELECT * INTO achievement_record
  FROM achievements_master am
  WHERE am.achievement_key = achievement_key_param AND am.is_active = TRUE;
  
  IF achievement_record IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement not found or inactive',
      'achievement_completed', FALSE,
      'current_progress', 0,
      'required_count', 0
    );
  END IF;
  
  -- Get or create user achievement record
  SELECT * INTO user_achievement_record
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF user_achievement_record IS NULL THEN
    -- Create new achievement record
    INSERT INTO user_achievements (
      wallet_address,
      achievement_key,
      status,
      current_progress,
      created_at,
      updated_at
    ) VALUES (
      user_wallet,
      achievement_key_param,
      'in_progress',
      progress_increment,
      NOW(),
      NOW()
    );
    
    new_progress := progress_increment;
  ELSE
    -- Update existing record
    new_progress := COALESCE(user_achievement_record.current_progress, 0) + progress_increment;
    
    UPDATE user_achievements 
    SET 
      current_progress = new_progress,
      status = CASE 
        WHEN new_progress >= achievement_record.required_count THEN 'completed'
        ELSE 'in_progress'
      END,
      updated_at = NOW()
    WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  END IF;
  
  -- Check if achievement is completed
  IF new_progress >= achievement_record.required_count THEN
    achievement_completed := TRUE;
    
    -- Mark as completed
    UPDATE user_achievements 
    SET 
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  END IF;
  
  -- Return progress status
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Progress updated successfully',
    'achievement_completed', achievement_completed,
    'current_progress', new_progress,
    'required_count', achievement_record.required_count,
    'achievement_key', achievement_key_param,
    'neft_reward', achievement_record.neft_reward,
    'xp_reward', achievement_record.xp_reward
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Error updating achievement progress: ' || SQLERRM,
      'achievement_completed', FALSE,
      'current_progress', 0,
      'required_count', 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO public;

-- ============================================================================
-- GET USER ACHIEVEMENTS FUNCTION
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_user_achievements(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_user_achievements(TEXT);

-- Create get_user_achievements function
CREATE OR REPLACE FUNCTION get_user_achievements(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'achievement_key', am.achievement_key,
      'title', am.title,
      'description', am.description,
      'category', am.category,
      'status', COALESCE(ua.status, 'locked'),
      'current_progress', COALESCE(ua.current_progress, 0),
      'required_count', am.required_count,
      'neft_reward', am.neft_reward,
      'xp_reward', am.xp_reward,
      'nft_reward', am.nft_reward,
      'icon', am.icon,
      'color', am.color,
      'completed_at', ua.completed_at,
      'claimed_at', ua.claimed_at,
      'progress_percentage', ROUND(
        (COALESCE(ua.current_progress, 0)::DECIMAL / GREATEST(am.required_count, 1)) * 100, 2
      )
    )
  ) INTO result
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON ua.achievement_key = am.achievement_key AND ua.wallet_address = user_wallet
  WHERE am.is_active = TRUE
    AND (category_filter IS NULL OR am.category = category_filter)
  ORDER BY 
    CASE COALESCE(ua.status, 'locked')
      WHEN 'completed' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'locked' THEN 3
      ELSE 4
    END,
    COALESCE(am.sort_order, 999);
  
  RETURN COALESCE(result, '[]'::JSON);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[]'::JSON;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO public;

-- ============================================================================
-- INITIALIZE USER ACHIEVEMENTS FUNCTION
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS initialize_user_achievements(TEXT);

-- Create initialize_user_achievements function
CREATE OR REPLACE FUNCTION initialize_user_achievements(
  user_wallet TEXT
)
RETURNS INTEGER AS $$
DECLARE
  achievement_count INTEGER := 0;
BEGIN
  -- Insert achievements that don't already exist for this user
  INSERT INTO user_achievements (
    wallet_address,
    achievement_key,
    status,
    current_progress,
    created_at,
    updated_at
  )
  SELECT 
    user_wallet,
    am.achievement_key,
    'locked',
    0,
    NOW(),
    NOW()
  FROM achievements_master am
  WHERE am.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.wallet_address = user_wallet 
        AND ua.achievement_key = am.achievement_key
    );
  
  GET DIAGNOSTICS achievement_count = ROW_COUNT;
  
  RETURN achievement_count;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION initialize_user_achievements(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_user_achievements(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION initialize_user_achievements(TEXT) TO public;

-- ============================================================================
-- GET ACHIEVEMENT STATS FUNCTION
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_achievement_stats(TEXT);

-- Create get_achievement_stats function
CREATE OR REPLACE FUNCTION get_achievement_stats(
  user_wallet TEXT
)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER := 0;
  completed_count INTEGER := 0;
  in_progress_count INTEGER := 0;
  completion_percentage DECIMAL := 0;
BEGIN
  -- Get total achievements
  SELECT COUNT(*) INTO total_count
  FROM achievements_master am
  WHERE am.is_active = TRUE;
  
  -- Get completed achievements
  SELECT COUNT(*) INTO completed_count
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet
    AND ua.status = 'completed'
    AND am.is_active = TRUE;
  
  -- Get in-progress achievements
  SELECT COUNT(*) INTO in_progress_count
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet
    AND ua.status = 'in_progress'
    AND am.is_active = TRUE;
  
  -- Calculate completion percentage
  IF total_count > 0 THEN
    completion_percentage := ROUND((completed_count::DECIMAL / total_count) * 100, 2);
  END IF;
  
  RETURN json_build_object(
    'total', total_count,
    'completed', completed_count,
    'in_progress', in_progress_count,
    'completion_percentage', completion_percentage
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'total', 0,
      'completed', 0,
      'in_progress', 0,
      'completion_percentage', 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO public;

-- ============================================================================
-- DEPLOYMENT SUCCESS MESSAGE
-- ============================================================================

SELECT 'ALL ACHIEVEMENT RPC FUNCTIONS DEPLOYED SUCCESSFULLY!' as status;
SELECT 'Functions deployed:' as info;
SELECT '- claim_achievement_reward(user_wallet, achievement_key_param)' as func1;
SELECT '- update_achievement_progress(user_wallet, achievement_key_param, progress_increment)' as func2;
SELECT '- get_user_achievements(user_wallet, category_filter)' as func3;
SELECT '- initialize_user_achievements(user_wallet)' as func4;
SELECT '- get_achievement_stats(user_wallet)' as func5;
SELECT 'Achievement system should now work without 404 errors!' as ready;
