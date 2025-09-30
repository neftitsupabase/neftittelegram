-- Fix Working Achievement Functions
-- Create functions that work with existing database structure

-- First, create the achievement initialization function that actually works
CREATE OR REPLACE FUNCTION initialize_user_achievements(user_wallet text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert all 14 achievements for the user
  INSERT INTO user_achievements (
    wallet_address,
    achievement_key,
    title,
    description,
    category,
    required_count,
    current_progress,
    status,
    neft_reward,
    xp_reward,
    created_at,
    updated_at
  ) VALUES
  -- Quest Achievements
  (user_wallet, 'first_quest', 'First Quest', 'Complete your first campaign task', 'quest', 1, 0, 'locked', 100, 50, NOW(), NOW()),
  (user_wallet, 'quest_master', 'Quest Master', 'Complete 10 different projects', 'quest', 10, 0, 'locked', 500, 250, NOW(), NOW()),
  (user_wallet, 'quest_legend', 'Quest Legend', 'Complete 50 different projects', 'quest', 50, 0, 'locked', 1500, 750, NOW(), NOW()),
  
  -- Burn Achievements
  (user_wallet, 'first_burn', 'First Burn', 'Burn your first NFT', 'burn', 1, 0, 'locked', 200, 100, NOW(), NOW()),
  (user_wallet, 'burn_enthusiast', 'Burn Enthusiast', 'Burn 25 NFTs', 'burn', 25, 0, 'locked', 750, 375, NOW(), NOW()),
  (user_wallet, 'burn_master', 'Burn Master', 'Burn 100 NFTs', 'burn', 100, 0, 'locked', 2000, 1000, NOW(), NOW()),
  
  -- Social Achievements
  (user_wallet, 'social_butterfly', 'Social Butterfly', 'Refer 5 friends', 'social', 5, 0, 'locked', 300, 150, NOW(), NOW()),
  
  -- Check-in Achievements
  (user_wallet, 'daily_visitor', 'Daily Visitor', 'Check in for 7 consecutive days', 'checkin', 7, 0, 'locked', 150, 75, NOW(), NOW()),
  (user_wallet, 'dedicated_user', 'Dedicated User', 'Check in for 30 consecutive days', 'checkin', 30, 0, 'locked', 1500, 750, NOW(), NOW()),
  
  -- Staking Achievements
  (user_wallet, 'first_stake', 'First Stake', 'Stake your first NFT', 'staking', 1, 0, 'locked', 250, 125, NOW(), NOW()),
  (user_wallet, 'staking_pro', 'Staking Pro', 'Maintain staking for 30 days', 'staking', 30, 0, 'locked', 1000, 500, NOW(), NOW()),
  
  -- Campaign Achievements
  (user_wallet, 'campaign_participant', 'Campaign Participant', 'Participate in your first campaign', 'campaign', 1, 0, 'locked', 400, 200, NOW(), NOW()),
  (user_wallet, 'campaign_champion', 'Campaign Champion', 'Win 5 campaigns', 'campaign', 5, 0, 'locked', 1000, 500, NOW(), NOW()),
  
  -- Special Achievement
  (user_wallet, 'neftit_pioneer', 'NEFTIT Pioneer', 'Complete all other achievements', 'special', 13, 0, 'locked', 3000, 1500, NOW(), NOW())
  
  ON CONFLICT (wallet_address, achievement_key) DO NOTHING;
  
  RETURN 'Achievements initialized successfully';
END;
$$;

-- Create the working update_achievement_progress function
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
GRANT EXECUTE ON FUNCTION initialize_user_achievements(text) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_user_achievements(text) TO anon;
GRANT EXECUTE ON FUNCTION update_achievement_progress(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress(text, text, integer) TO anon;

-- Test message
SELECT 'Working achievement functions created' as status;
