-- Fix Burn Progress Reset After Successful Burn
-- After using a burn chance, progress should reset to 0/2

-- 1. Update use_burn_chance function to reset progress
CREATE OR REPLACE FUNCTION use_burn_chance(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  available_chance_id UUID;
  result JSON;
BEGIN
  -- Find an available burn chance
  SELECT id INTO available_chance_id
  FROM user_burn_chances_earned 
  WHERE wallet_address = p_wallet_address 
    AND used_at IS NULL
  LIMIT 1;

  IF available_chance_id IS NOT NULL THEN
    -- Mark the burn chance as used
    UPDATE user_burn_chances_earned 
    SET used_at = NOW()
    WHERE id = available_chance_id;

    -- Reset burn progress to 0/2 (user needs to complete 2 new projects)
    UPDATE user_burn_progress 
    SET 
      projects_completed_count = 0,
      completed_project_ids = '{}'::TEXT[],
      last_reset_at = NOW(),
      updated_at = NOW()
    WHERE wallet_address = p_wallet_address;

    result := json_build_object(
      'success', true,
      'message', 'Burn chance used successfully - progress reset'
    );
  ELSE
    result := json_build_object(
      'success', false,
      'message', 'No burn chances available'
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update get_burn_chance_status to show reset progress correctly
CREATE OR REPLACE FUNCTION get_burn_chance_status(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  completed_project_count INTEGER;
  available_chances INTEGER;
  used_chances INTEGER;
  progress_percentage INTEGER;
  last_reset TIMESTAMP;
  result JSON;
BEGIN
  -- Get last reset time
  SELECT last_reset_at INTO last_reset
  FROM user_burn_progress 
  WHERE wallet_address = p_wallet_address;

  -- Count completed projects AFTER last reset (or all if no reset)
  IF last_reset IS NOT NULL THEN
    -- Count projects completed after last reset
    SELECT COUNT(DISTINCT up.project_id)
    INTO completed_project_count
    FROM user_participations up
    JOIN projects p ON up.project_id = p.id
    WHERE up.wallet_address = p_wallet_address 
      AND up.completion_percentage = 100
      AND up.updated_at > last_reset;
  ELSE
    -- Count all completed projects (no reset yet)
    SELECT COUNT(DISTINCT project_id)
    INTO completed_project_count
    FROM user_participations 
    WHERE wallet_address = p_wallet_address 
      AND completion_percentage = 100;
  END IF;

  -- Count available burn chances (unused entries)
  SELECT COUNT(*)
  INTO available_chances
  FROM user_burn_chances_earned 
  WHERE wallet_address = p_wallet_address 
    AND used_at IS NULL;

  -- Count used burn chances
  SELECT COUNT(*)
  INTO used_chances
  FROM user_burn_chances_earned 
  WHERE wallet_address = p_wallet_address 
    AND used_at IS NOT NULL;

  -- Update burn progress record
  INSERT INTO user_burn_progress (
    wallet_address, 
    projects_completed_count,
    projects_required,
    completed_project_ids,
    last_reset_at
  ) VALUES (
    p_wallet_address, 
    completed_project_count,
    2,
    '{}'::TEXT[],
    COALESCE(last_reset, NOW())
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    projects_completed_count = completed_project_count,
    updated_at = NOW();

  -- Calculate progress percentage
  progress_percentage := LEAST(100, (completed_project_count * 100) / 2);

  -- Build result
  result := json_build_object(
    'current_progress', completed_project_count,
    'projects_required', 2,
    'completed_project_ids', '[]'::json,
    'available_burn_chances', COALESCE(available_chances, 0),
    'used_burn_chances', COALESCE(used_chances, 0),
    'progress_percentage', progress_percentage,
    'last_reset_at', COALESCE(last_reset, NOW())::text
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION use_burn_chance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_burn_chance_status(TEXT) TO authenticated;

-- 4. Success message
DO $$
BEGIN
  RAISE NOTICE '=== BURN PROGRESS RESET FIX COMPLETE ===';
  RAISE NOTICE '✅ Updated use_burn_chance to reset progress after burn';
  RAISE NOTICE '✅ Updated get_burn_chance_status to track progress after reset';
  RAISE NOTICE '✅ Progress will now show 0/2 after successful burn';
  RAISE NOTICE '✅ User must complete 2 NEW projects to earn next burn chance';
END $$;
