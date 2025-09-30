-- Simple Achievement Activity Logging Fix
-- Update the existing update_achievement_progress function to include activity logging

CREATE OR REPLACE FUNCTION update_achievement_progress(
  user_wallet text,
  achievement_key_param text,
  progress_increment integer DEFAULT 1
)
RETURNS TABLE(
  success boolean,
  message text,
  achievement_completed boolean,
  new_progress integer,
  required_count integer,
  old_status text,
  new_status text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_progress integer := 0;
  required_count_val integer := 1;
  old_status_val text := 'locked';
  new_status_val text := 'locked';
  achievement_completed_val boolean := false;
  achievement_title text := '';
  neft_reward integer := 0;
  xp_reward integer := 0;
BEGIN
  -- Get current achievement status from user_achievements table
  SELECT 
    ua.current_progress,
    ua.status::text,
    ua.required_count,
    ua.title,
    ua.neft_reward,
    ua.xp_reward
  INTO 
    current_progress,
    old_status_val,
    required_count_val,
    achievement_title,
    neft_reward,
    xp_reward
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet 
    AND ua.achievement_key = achievement_key_param;

  -- If achievement not found, return error
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Achievement not found for user'::text, false, 0, 0, ''::text, ''::text;
    RETURN;
  END IF;

  -- Calculate new progress
  current_progress := current_progress + progress_increment;
  
  -- Determine new status
  IF current_progress >= required_count_val THEN
    new_status_val := 'completed';
    achievement_completed_val := true;
    current_progress := required_count_val; -- Cap at required count
  ELSIF current_progress > 0 THEN
    new_status_val := 'in_progress';
  ELSE
    new_status_val := 'locked';
  END IF;

  -- Update the achievement
  UPDATE user_achievements 
  SET 
    current_progress = current_progress,
    status = new_status_val::achievement_status,
    updated_at = NOW()
  WHERE wallet_address = user_wallet 
    AND achievement_key = achievement_key_param;

  -- Log activity for achievement completion (NOT for unlocking)
  IF achievement_completed_val AND old_status_val != 'completed' THEN
    BEGIN
      -- Log achievement completion activity
      INSERT INTO user_activities (
        wallet_address,
        activity_type,
        activity_title,
        activity_description,
        details,
        neft_reward,
        xp_reward,
        status,
        metadata,
        created_at
      ) VALUES (
        user_wallet,
        'achievement',
        'Achievement Unlocked: ' || achievement_title,
        'Completed the ' || achievement_title || ' achievement',
        'Ready to claim ' || neft_reward || ' NEFT and ' || xp_reward || ' XP',
        0, -- Don't add rewards automatically
        0, -- Don't add rewards automatically  
        'completed',
        jsonb_build_object(
          'achievement_key', achievement_key_param,
          'achievement_type', 'completion'
        ),
        NOW()
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail achievement update if activity logging fails
      -- Just continue silently
      NULL;
    END;
  END IF;

  -- Return success result
  RETURN QUERY SELECT 
    true,
    CASE 
      WHEN achievement_completed_val THEN 'Achievement completed!'
      WHEN new_status_val = 'in_progress' AND old_status_val = 'locked' THEN 'Achievement unlocked!'
      ELSE 'Progress updated!'
    END::text,
    achievement_completed_val,
    current_progress,
    required_count_val,
    old_status_val,
    new_status_val;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_achievement_progress(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress(text, text, integer) TO anon;

-- Test message
SELECT 'Simple achievement activity logging function updated' as status;
