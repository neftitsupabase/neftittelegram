-- ============================================================================
-- COMPLETE ACHIEVEMENT SYSTEM FIX - PROPER STATE TRANSITIONS & INITIALIZATION
-- Fixes locked/in_progress/completed states and ensures proper tracking
-- ============================================================================

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS get_user_achievements(TEXT, TEXT);
DROP FUNCTION IF EXISTS update_achievement_progress(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS claim_achievement_reward(TEXT, TEXT);
DROP FUNCTION IF EXISTS initialize_user_achievements(TEXT);
DROP FUNCTION IF EXISTS get_achievement_stats(TEXT);

-- ============================================================================
-- ENHANCED GET USER ACHIEVEMENTS - PROPER STATE HANDLING
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_achievements(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result_json JSON;
BEGIN
  -- Enhanced CTE with proper state logic
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
      -- Enhanced status logic - ALWAYS show achievements even if no user record exists
      CASE 
        WHEN ua.claimed_at IS NOT NULL THEN 'completed'
        WHEN ua.status = 'completed' AND ua.claimed_at IS NULL THEN 'completed'
        WHEN COALESCE(ua.current_progress, 0) >= am.required_count THEN 'completed'
        WHEN COALESCE(ua.current_progress, 0) > 0 THEN 'in_progress'
        WHEN ua.wallet_address IS NULL THEN 'locked'  -- No user record = locked
        ELSE 'locked'
      END as status,
      ua.completed_at,
      ua.claimed_at,
      -- Enhanced progress calculation
      CASE 
        WHEN ua.claimed_at IS NOT NULL THEN 100
        WHEN COALESCE(ua.current_progress, 0) >= am.required_count THEN 100
        WHEN am.required_count > 0 THEN 
          LEAST(100, ROUND((COALESCE(ua.current_progress, 0)::numeric / am.required_count::numeric) * 100, 2))
        ELSE 0 
      END as progress_percentage
    FROM achievements_master am
    LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
      AND ua.wallet_address = user_wallet
    WHERE am.is_active = TRUE
      AND (category_filter IS NULL OR am.category::text = category_filter)
  )
  SELECT COALESCE(array_to_json(array_agg(row_to_json(achievement_data) ORDER BY 
    -- Sort by status priority: completed (unclaimed) -> in_progress -> completed (claimed) -> locked
    CASE 
      WHEN status = 'completed' AND claimed_at IS NULL THEN 1
      WHEN status = 'in_progress' THEN 2
      WHEN status = 'completed' AND claimed_at IS NOT NULL THEN 3
      WHEN status = 'locked' THEN 4
      ELSE 5
    END,
    category,
    achievement_key
  )), '[]'::json)
  INTO result_json
  FROM achievement_data;

  -- Debug logging
  RAISE NOTICE 'Achievement query result for wallet %: % achievements found', user_wallet, (SELECT COUNT(*) FROM achievement_data);
  
  RETURN result_json;

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
-- ENHANCED UPDATE ACHIEVEMENT PROGRESS - PROPER STATE TRANSITIONS
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
  previous_status TEXT;
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
    -- Create new user achievement record with proper initial state
    INSERT INTO user_achievements (wallet_address, achievement_key, current_progress, status, created_at, updated_at)
    VALUES (user_wallet, achievement_key_param, progress_increment, 
            CASE WHEN progress_increment >= achievement_record.required_count THEN 'completed' ELSE 'in_progress' END, 
            NOW(), NOW());
    
    new_progress := progress_increment;
    previous_status := 'locked';
  ELSE
    -- Don't update if already completed and claimed
    IF user_achievement_record.status = 'completed' AND user_achievement_record.claimed_at IS NOT NULL THEN
      RETURN json_build_object(
        'success', TRUE,
        'message', 'Achievement already completed and claimed',
        'achievement_completed', TRUE,
        'new_progress', user_achievement_record.current_progress,
        'required_count', achievement_record.required_count
      );
    END IF;
    
    -- Update existing record
    previous_status := user_achievement_record.status;
    new_progress := user_achievement_record.current_progress + progress_increment;
    
    UPDATE user_achievements 
    SET current_progress = new_progress, 
        status = CASE WHEN new_progress >= achievement_record.required_count THEN 'completed' ELSE 'in_progress' END,
        updated_at = NOW()
    WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  END IF;
  
  -- Check if achievement is completed
  IF new_progress >= achievement_record.required_count THEN
    achievement_completed := TRUE;
    
    -- Mark as completed with timestamp if not already
    UPDATE user_achievements 
    SET status = 'completed', 
        completed_at = COALESCE(completed_at, NOW()), 
        updated_at = NOW()
    WHERE wallet_address = user_wallet 
      AND achievement_key = achievement_key_param
      AND completed_at IS NULL;
  END IF;
  
  RETURN json_build_object(
    'success', TRUE,
    'achievement_completed', achievement_completed,
    'new_progress', new_progress,
    'required_count', achievement_record.required_count,
    'previous_status', previous_status,
    'current_status', CASE WHEN achievement_completed THEN 'completed' ELSE 'in_progress' END,
    'message', CASE 
      WHEN achievement_completed THEN 'Achievement completed! Ready to claim rewards.'
      WHEN previous_status = 'locked' THEN 'Achievement unlocked and progress started!'
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
-- ENHANCED CLAIM ACHIEVEMENT REWARD - PROPER VALIDATION
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
      'xp_reward', 0
    );
  END IF;
  
  -- Get user achievement status
  SELECT * INTO user_achievement_record
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF user_achievement_record IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement not started. Complete the required actions first.',
      'neft_reward', 0,
      'xp_reward', 0
    );
  END IF;
  
  -- Check if already claimed
  IF user_achievement_record.claimed_at IS NOT NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement reward already claimed',
      'neft_reward', 0,
      'xp_reward', 0
    );
  END IF;
  
  -- Check if achievement is completed (either by status or progress)
  IF user_achievement_record.status != 'completed' AND 
     user_achievement_record.current_progress < achievement_record.required_count THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', FORMAT('Achievement not completed yet. Progress: %s/%s', 
                       user_achievement_record.current_progress, 
                       achievement_record.required_count),
      'neft_reward', 0,
      'xp_reward', 0
    );
  END IF;
  
  -- Mark as claimed
  UPDATE user_achievements 
  SET claimed_at = NOW(), 
      status = 'completed',
      updated_at = NOW()
  WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  
  -- Add rewards to user balance
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
    'message', FORMAT('Achievement "%s" claimed successfully! +%s NEFT, +%s XP', 
                     achievement_record.title,
                     achievement_record.neft_reward, 
                     achievement_record.xp_reward),
    'neft_reward', achievement_record.neft_reward,
    'xp_reward', achievement_record.xp_reward
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Error claiming achievement reward: ' || SQLERRM,
      'neft_reward', 0,
      'xp_reward', 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENHANCED INITIALIZE USER ACHIEVEMENTS - PROPER SETUP
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
    'message', FORMAT('User achievements initialized. %s new achievements added.', initialized_count),
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
-- ENHANCED GET ACHIEVEMENT STATS - ACCURATE COUNTING
-- ============================================================================
CREATE OR REPLACE FUNCTION get_achievement_stats(
  user_wallet TEXT
)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  completed_count INTEGER;
  in_progress_count INTEGER;
  locked_count INTEGER;
  claimed_count INTEGER;
  completion_percentage NUMERIC;
BEGIN
  -- Get total active achievements
  SELECT COUNT(*) INTO total_count
  FROM achievements_master
  WHERE is_active = TRUE;
  
  -- Get completed achievements count (including claimed)
  SELECT COUNT(*) INTO completed_count
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet 
    AND (ua.status = 'completed' OR ua.current_progress >= am.required_count)
    AND am.is_active = TRUE;
  
  -- Get claimed achievements count
  SELECT COUNT(*) INTO claimed_count
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet 
    AND ua.claimed_at IS NOT NULL
    AND am.is_active = TRUE;
  
  -- Get in progress achievements count
  SELECT COUNT(*) INTO in_progress_count
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet 
    AND ua.current_progress > 0
    AND ua.current_progress < am.required_count
    AND ua.status != 'completed'
    AND am.is_active = TRUE;
  
  -- Get locked achievements count
  locked_count := total_count - completed_count - in_progress_count;
  
  -- Calculate completion percentage
  IF total_count > 0 THEN
    completion_percentage := ROUND((completed_count::numeric / total_count::numeric) * 100, 2);
  ELSE
    completion_percentage := 0;
  END IF;
  
  RETURN json_build_object(
    'total', total_count,
    'completed', completed_count,
    'claimed', claimed_count,
    'in_progress', in_progress_count,
    'locked', locked_count,
    'completion_percentage', completion_percentage
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'total', 0,
      'completed', 0,
      'claimed', 0,
      'in_progress', 0,
      'locked', 0,
      'completion_percentage', 0,
      'error', 'Error getting achievement stats: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS TO ALL FUNCTIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION initialize_user_achievements(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO authenticated, anon, public;

-- ============================================================================
-- DEPLOYMENT VERIFICATION
-- ============================================================================
SELECT 'ENHANCED ACHIEVEMENTS SYSTEM DEPLOYED SUCCESSFULLY!' as status;
SELECT 'Fixed Issues:' as fixes;
SELECT '✅ Proper state transitions: locked → in_progress → completed' as fix_1;
SELECT '✅ Enhanced progress calculation and validation' as fix_2;
SELECT '✅ Improved claim validation and error messages' as fix_3;
SELECT '✅ Better achievement sorting and display logic' as fix_4;
SELECT '✅ Accurate statistics counting' as fix_5;
