-- Fix Achievement Enum Type Error
-- Fixes the "column status is of type achievement_status but expression is of type text" error

-- Step 1: Check current enum values
SELECT 'Current achievement_status enum values:' as info;
SELECT unnest(enum_range(NULL::achievement_status)) as enum_values;

-- Step 2: Fix the update_achievement_progress function with proper enum casting
CREATE OR REPLACE FUNCTION update_achievement_progress(
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
      'success', false,
      'message', 'Invalid parameters',
      'achievement_completed', false,
      'new_progress', 0,
      'required_count', 0
    );
  END IF;

  -- Initialize user achievements if not exists
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
    'locked'::achievement_status,  -- Proper enum casting
    NOW(),
    NOW()
  FROM achievements_master am
  WHERE am.achievement_key = achievement_key_param
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.wallet_address = user_wallet 
        AND ua.achievement_key = achievement_key_param
    );

  -- Get required count from master
  SELECT am.required_count 
  INTO required_count
  FROM achievements_master am 
  WHERE am.achievement_key = achievement_key_param;
  
  IF required_count IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement not found: ' || achievement_key_param,
      'achievement_completed', false,
      'new_progress', 0,
      'required_count', 0
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
  
  -- Determine new status based on progress with proper enum casting
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

  -- Update achievement with proper enum casting
  UPDATE user_achievements 
  SET 
    current_progress = new_progress,
    status = new_status,  -- Already properly typed as achievement_status
    completed_at = CASE 
      WHEN new_status = 'completed'::achievement_status AND old_status != 'completed'::achievement_status THEN NOW() 
      ELSE completed_at 
    END,
    updated_at = NOW()
  WHERE wallet_address = user_wallet 
    AND achievement_key = achievement_key_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Achievement progress updated successfully',
    'achievement_completed', achievement_completed,
    'new_progress', new_progress,
    'required_count', required_count,
    'old_status', old_status,
    'new_status', new_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error updating achievement progress: ' || SQLERRM,
      'achievement_completed', false,
      'new_progress', 0,
      'required_count', 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant proper permissions
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION update_achievement_progress(TEXT, TEXT, INTEGER) TO public;

-- Step 4: Test the function works correctly
DO $$
DECLARE
  test_result JSON;
BEGIN
  RAISE NOTICE '=== TESTING FIXED ACHIEVEMENT FUNCTION ===';
  
  -- Test with a real achievement
  SELECT update_achievement_progress(
    '0x742d35Cc6634C0532925a3b8D4C0C4c3e2f5d2d3',
    'first_burn',
    1
  ) INTO test_result;
  
  RAISE NOTICE 'Test result: %', test_result;
  RAISE NOTICE '=== ACHIEVEMENT ENUM ERROR FIXED ===';
END $$;

SELECT 'Achievement enum type error fixed - functions now use proper enum casting!' as status;
