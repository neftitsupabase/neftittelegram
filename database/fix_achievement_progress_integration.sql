-- ============================================================================
-- FIX ACHIEVEMENT PROGRESS INTEGRATION
-- Creates/updates RPC function for achievement progress tracking
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

-- Create helper function to get user achievements
CREATE OR REPLACE FUNCTION get_user_achievements(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'achievement_key', ua.achievement_key,
      'title', am.title,
      'description', am.description,
      'status', ua.status,
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
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet
    AND am.is_active = TRUE
  ORDER BY 
    CASE ua.status 
      WHEN 'completed' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'locked' THEN 3
      ELSE 4
    END,
    am.sort_order;
  
  RETURN COALESCE(result, '[]'::JSON);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[]'::JSON;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT) TO public;

-- Test the functions
SELECT 'Achievement progress integration functions created!' as status;
SELECT 'Functions available:' as info;
SELECT '- update_achievement_progress(wallet, achievement_key, increment)' as func1;
SELECT '- get_user_achievements(wallet)' as func2;
SELECT 'Services can now properly track achievement progress!' as ready;
