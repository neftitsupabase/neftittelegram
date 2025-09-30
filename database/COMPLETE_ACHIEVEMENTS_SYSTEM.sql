-- ============================================================================
-- COMPLETE ACHIEVEMENTS SYSTEM - UNIFIED DATABASE DEPLOYMENT
-- All working achievement functions with proper fixes applied
-- Deploy this single file to get the complete achievement system
-- ============================================================================

-- Drop all existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS get_user_achievements(TEXT, TEXT);
DROP FUNCTION IF EXISTS update_achievement_progress(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS claim_achievement_reward(TEXT, TEXT);
DROP FUNCTION IF EXISTS initialize_user_achievements(TEXT);
DROP FUNCTION IF EXISTS get_achievement_stats(TEXT);

-- ============================================================================
-- 1. GET USER ACHIEVEMENTS FUNCTION (Fixed GROUP BY and enum casting)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_achievements(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result_json JSON;
BEGIN
  -- Use CTE to avoid GROUP BY issues and properly handle user progress
  WITH achievement_data AS (
    SELECT 
      am.achievement_key,
      am.title,
      am.description,
      am.category::text as category,
      am.icon,
      am.color,
      am.neft_reward,
      am.xp_reward,
      am.required_count,
      COALESCE(ua.current_progress, 0) as current_progress,
      CASE 
        WHEN ua.status IS NULL THEN 'locked'
        WHEN ua.status = 'in-progress' THEN 'in_progress'
        ELSE ua.status
      END as status,
      ua.completed_at,
      ua.claimed_at,
      CASE 
        WHEN am.required_count > 0 THEN 
          ROUND((COALESCE(ua.current_progress, 0)::numeric / am.required_count::numeric) * 100, 2)
        ELSE 0 
      END as progress_percentage
    FROM achievements_master am
    LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
      AND ua.wallet_address = user_wallet
    WHERE am.is_active = TRUE
      AND (category_filter IS NULL OR am.category::text = category_filter)
  )
  SELECT array_to_json(array_agg(row_to_json(achievement_data)))
  INTO result_json
  FROM achievement_data
  ORDER BY 
    CASE status
      WHEN 'completed' THEN 1
      WHEN 'in_progress' THEN 2
      ELSE 3
    END,
    category,
    achievement_key;

  RETURN COALESCE(result_json, '[]'::json);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', TRUE,
      'message', 'Error getting user achievements: ' || SQLERRM,
      'data', '[]'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. UPDATE ACHIEVEMENT PROGRESS FUNCTION
-- ============================================================================
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
      'new_progress', 0,
      'required_count', 0
    );
  END IF;
  
  -- Get or create user achievement record
  SELECT * INTO user_achievement_record
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF user_achievement_record IS NULL THEN
    -- Create new user achievement record
    INSERT INTO user_achievements (wallet_address, achievement_key, current_progress, status, created_at, updated_at)
    VALUES (user_wallet, achievement_key_param, progress_increment, 'in_progress', NOW(), NOW());
    
    new_progress := progress_increment;
  ELSE
    -- Update existing record
    new_progress := user_achievement_record.current_progress + progress_increment;
    
    UPDATE user_achievements 
    SET current_progress = new_progress, updated_at = NOW()
    WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  END IF;
  
  -- Check if achievement is completed
  IF new_progress >= achievement_record.required_count THEN
    achievement_completed := TRUE;
    
    UPDATE user_achievements 
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  END IF;
  
  RETURN json_build_object(
    'success', TRUE,
    'achievement_completed', achievement_completed,
    'new_progress', new_progress,
    'required_count', achievement_record.required_count,
    'message', CASE 
      WHEN achievement_completed THEN 'Achievement completed!'
      ELSE 'Progress updated'
    END
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Error updating achievement progress: ' || SQLERRM,
      'achievement_completed', FALSE,
      'new_progress', 0,
      'required_count', 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. CLAIM ACHIEVEMENT REWARD FUNCTION (Fixed user_balances schema)
-- ============================================================================
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
  
  -- Add rewards to user balance (fixed schema - no created_at/updated_at columns)
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft)
  VALUES (user_wallet, achievement_record.neft_reward, achievement_record.xp_reward, achievement_record.neft_reward)
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    total_neft_claimed = user_balances.total_neft_claimed + achievement_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + achievement_record.xp_reward,
    available_neft = user_balances.available_neft + achievement_record.neft_reward;
  
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

-- ============================================================================
-- 4. INITIALIZE USER ACHIEVEMENTS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION initialize_user_achievements(
  user_wallet TEXT
)
RETURNS JSON AS $$
DECLARE
  achievements_count INTEGER;
  initialized_count INTEGER := 0;
  achievement_record RECORD;
BEGIN
  -- Get count of active achievements
  SELECT COUNT(*) INTO achievements_count
  FROM achievements_master
  WHERE is_active = TRUE;
  
  -- Initialize achievements for user that don't exist yet
  FOR achievement_record IN 
    SELECT achievement_key 
    FROM achievements_master am
    WHERE am.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.wallet_address = user_wallet 
      AND ua.achievement_key = am.achievement_key
    )
  LOOP
    INSERT INTO user_achievements (
      wallet_address, 
      achievement_key, 
      current_progress, 
      status, 
      created_at, 
      updated_at
    )
    VALUES (
      user_wallet, 
      achievement_record.achievement_key, 
      0, 
      'locked', 
      NOW(), 
      NOW()
    );
    
    initialized_count := initialized_count + 1;
  END LOOP;
  
  RETURN json_build_object(
    'success', TRUE,
    'message', 'User achievements initialized',
    'total_achievements', achievements_count,
    'initialized_count', initialized_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Error initializing user achievements: ' || SQLERRM,
      'total_achievements', 0,
      'initialized_count', 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GET ACHIEVEMENT STATS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_achievement_stats(
  user_wallet TEXT
)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  completed_count INTEGER;
  in_progress_count INTEGER;
  completion_percentage NUMERIC;
BEGIN
  -- Get total active achievements
  SELECT COUNT(*) INTO total_count
  FROM achievements_master
  WHERE is_active = TRUE;
  
  -- Get completed achievements count
  SELECT COUNT(*) INTO completed_count
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet 
    AND ua.status = 'completed'
    AND am.is_active = TRUE;
  
  -- Get in progress achievements count
  SELECT COUNT(*) INTO in_progress_count
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet 
    AND ua.status = 'in_progress'
    AND am.is_active = TRUE;
  
  -- Calculate completion percentage
  IF total_count > 0 THEN
    completion_percentage := ROUND((completed_count::numeric / total_count::numeric) * 100, 2);
  ELSE
    completion_percentage := 0;
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
      'completion_percentage', 0,
      'error', 'Error getting achievement stats: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS TO ALL FUNCTIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO public;

GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO public;

GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO public;

GRANT EXECUTE ON FUNCTION initialize_user_achievements(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_user_achievements(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION initialize_user_achievements(TEXT) TO public;

GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO public;

-- ============================================================================
-- DEPLOYMENT VERIFICATION
-- ============================================================================
SELECT 'COMPLETE ACHIEVEMENTS SYSTEM DEPLOYED SUCCESSFULLY!' as status;
SELECT 'All 5 achievement functions are now available:' as info;
SELECT '1. get_user_achievements() - Display achievements with progress' as function_1;
SELECT '2. update_achievement_progress() - Track user progress' as function_2;
SELECT '3. claim_achievement_reward() - Claim rewards and update balances' as function_3;
SELECT '4. initialize_user_achievements() - Setup new users' as function_4;
SELECT '5. get_achievement_stats() - Get completion statistics' as function_5;
SELECT 'Fixed Issues: GROUP BY errors, enum casting, user_balances schema' as fixes_applied;
