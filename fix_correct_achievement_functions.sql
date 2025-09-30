-- Correct Achievement Functions matching actual database schema
-- Drop existing functions first
DROP FUNCTION IF EXISTS initialize_user_achievements(text);
DROP FUNCTION IF EXISTS update_achievement_progress(text, text, integer);

-- Create initialization function using actual table columns
CREATE OR REPLACE FUNCTION initialize_user_achievements(user_wallet text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert achievements using only columns that exist in user_achievements table
  INSERT INTO user_achievements (
    wallet_address,
    achievement_key,
    status,
    current_progress,
    created_at,
    updated_at
  ) VALUES
  -- Quest Achievements
  (user_wallet, 'first_quest', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'quest_master', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'quest_legend', 'locked', 0, NOW(), NOW()),
  
  -- Burn Achievements
  (user_wallet, 'first_burn', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'burn_enthusiast', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'burn_master', 'locked', 0, NOW(), NOW()),
  
  -- Social Achievements
  (user_wallet, 'social_starter', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'first_referral', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'referral_champion', 'locked', 0, NOW(), NOW()),
  
  -- Check-in Achievements
  (user_wallet, 'daily_visitor', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'dedicated_user', 'locked', 0, NOW(), NOW()),
  
  -- Staking Achievements
  (user_wallet, 'first_stake', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'staking_pro', 'locked', 0, NOW(), NOW()),
  
  -- Campaign Achievements
  (user_wallet, 'campaign_participant', 'locked', 0, NOW(), NOW()),
  (user_wallet, 'campaign_champion', 'locked', 0, NOW(), NOW())
  
  ON CONFLICT (wallet_address, achievement_key) DO NOTHING;
  
  RETURN 'Achievements initialized successfully';
END;
$$;

-- Create update function matching actual schema
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
  user_progress integer := 0;
  required_count_val integer := 1;
  old_status_val text := 'locked';
  new_status_val text := 'locked';
  achievement_completed_val boolean := false;
  neft_reward integer := 0;
  xp_reward integer := 0;
  achievement_title text := '';
BEGIN
  -- Get current progress and status
  SELECT 
    ua.current_progress,
    ua.status::text
  INTO 
    user_progress,
    old_status_val
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet 
    AND ua.achievement_key = achievement_key_param;

  -- If achievement not found, return error
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Achievement not found for user'::text, false, 0, 0, ''::text, ''::text;
    RETURN;
  END IF;

  -- Get achievement details from achievements_master table
  SELECT 
    am.required_count,
    am.neft_reward,
    am.xp_reward,
    am.title
  INTO 
    required_count_val,
    neft_reward,
    xp_reward,
    achievement_title
  FROM achievements_master am
  WHERE am.achievement_key = achievement_key_param;

  -- If achievement definition not found, use defaults
  IF NOT FOUND THEN
    required_count_val := 1;
    neft_reward := 100;
    xp_reward := 50;
    achievement_title := achievement_key_param;
  END IF;

  -- Calculate new progress
  user_progress := user_progress + progress_increment;
  
  -- Determine new status
  IF user_progress >= required_count_val THEN
    new_status_val := 'completed';
    achievement_completed_val := true;
    user_progress := required_count_val; -- Cap at required count
  ELSIF user_progress > 0 THEN
    new_status_val := 'in_progress';
  ELSE
    new_status_val := 'locked';
  END IF;

  -- Update the achievement
  UPDATE user_achievements 
  SET 
    current_progress = user_progress,
    status = new_status_val::achievement_status,
    completed_at = CASE WHEN achievement_completed_val THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE wallet_address = user_wallet 
    AND achievement_key = achievement_key_param;

  -- Log activity for achievement completion
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
        'Achievement Unlocked: ' || COALESCE(achievement_title, achievement_key_param),
        'Completed the ' || COALESCE(achievement_title, achievement_key_param) || ' achievement',
        'Ready to claim ' || neft_reward || ' NEFT and ' || xp_reward || ' XP',
        0, -- Don't add rewards automatically
        0, -- Don't add rewards automatically  
        'completed',
        jsonb_build_object(
          'achievement_key', achievement_key_param,
          'achievement_type', 'completion',
          'neft_reward', neft_reward,
          'xp_reward', xp_reward
        ),
        NOW()
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail achievement update if activity logging fails
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
    user_progress,
    required_count_val,
    old_status_val,
    new_status_val;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION initialize_user_achievements(text) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_user_achievements(text) TO anon;
GRANT EXECUTE ON FUNCTION update_achievement_progress(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress(text, text, integer) TO anon;

-- Test message
SELECT 'Correct achievement functions created for actual schema' as status;
