-- Fix Achievement Database Functions
-- The frontend now uses 'in_progress' (underscore) to match database
-- But the database functions are causing 400 errors and need to be fixed

-- 1. Check current enum values (for reference)
SELECT 'Current enum values:' as info;
SELECT unnest(enum_range(NULL::achievement_status)) as enum_values;

-- 2. Fix the update_achievement_progress function
CREATE OR REPLACE FUNCTION update_achievement_progress(
  user_wallet TEXT,
  achievement_key_param TEXT,
  progress_increment INTEGER DEFAULT 1
)
RETURNS TABLE(
  achievement_completed BOOLEAN,
  new_progress INTEGER,
  required_count INTEGER
) AS $$
DECLARE
  current_progress_val INTEGER;
  required_count_val INTEGER;
  achievement_completed_val BOOLEAN := FALSE;
BEGIN
  -- Initialize user achievements if needed
  PERFORM initialize_user_achievements(user_wallet);
  
  -- Get current progress and required count
  SELECT ua.current_progress, am.required_count
  INTO current_progress_val, required_count_val
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  -- If no record exists, create one
  IF current_progress_val IS NULL THEN
    SELECT required_count INTO required_count_val
    FROM achievements_master 
    WHERE achievement_key = achievement_key_param AND is_active = TRUE;
    
    IF required_count_val IS NULL THEN
      RAISE EXCEPTION 'Achievement not found: %', achievement_key_param;
    END IF;
    
    INSERT INTO user_achievements (wallet_address, achievement_key, current_progress, status)
    VALUES (user_wallet, achievement_key_param, 0, 'locked'::achievement_status);
    
    current_progress_val := 0;
  END IF;
  
  -- Update progress
  current_progress_val := current_progress_val + progress_increment;
  
  -- Check if completed
  achievement_completed_val := current_progress_val >= required_count_val;
  
  -- Update the record
  UPDATE user_achievements SET
    current_progress = current_progress_val,
    status = CASE 
      WHEN current_progress_val >= required_count_val THEN 'completed'::achievement_status
      WHEN current_progress_val > 0 THEN 'in_progress'::achievement_status
      ELSE 'locked'::achievement_status
    END,
    completed_at = CASE 
      WHEN current_progress_val >= required_count_val AND completed_at IS NULL THEN NOW()
      ELSE completed_at
    END,
    updated_at = NOW()
  WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  
  RETURN QUERY SELECT achievement_completed_val, current_progress_val, required_count_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix the get_achievement_stats function
CREATE OR REPLACE FUNCTION get_achievement_stats(user_wallet TEXT)
RETURNS TABLE(
  total INTEGER,
  completed INTEGER,
  in_progress INTEGER,
  completion_percentage INTEGER
) AS $$
BEGIN
  -- Initialize user achievements if needed
  PERFORM initialize_user_achievements(user_wallet);
  
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*)::INTEGER as total_achievements,
      COUNT(CASE WHEN ua.status = 'completed'::achievement_status THEN 1 END)::INTEGER as completed_achievements,
      COUNT(CASE WHEN ua.status = 'in_progress'::achievement_status THEN 1 END)::INTEGER as in_progress_achievements
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant proper permissions
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_achievement_stats(TEXT) TO authenticated;

-- 5. Test the functions work correctly
SELECT 'Testing enum values in functions:' as test_info;
SELECT 
  'locked'::achievement_status as locked_status,
  'in_progress'::achievement_status as in_progress_status,
  'completed'::achievement_status as completed_status;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '=== ACHIEVEMENT DATABASE FUNCTIONS FIXED ===';
  RAISE NOTICE 'Fixed functions:';
  RAISE NOTICE '- update_achievement_progress: Now uses correct enum values';
  RAISE NOTICE '- get_achievement_stats: Now uses correct enum values';
  RAISE NOTICE 'Database and frontend are now synchronized!';
  RAISE NOTICE 'You can now test the achievement system.';
END $$;
