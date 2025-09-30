-- Fix Column Names in Burn Chance Functions
-- The table schema uses different column names than the functions expect

-- 1. Update get_burn_chance_status function with correct column names
CREATE OR REPLACE FUNCTION get_burn_chance_status(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  completed_project_count INTEGER;
  available_chances INTEGER;
  used_chances INTEGER;
  progress_percentage INTEGER;
  result JSON;
BEGIN
  -- Count completed projects (bypass RLS with SECURITY DEFINER)
  SELECT COUNT(DISTINCT project_id)
  INTO completed_project_count
  FROM user_participations 
  WHERE wallet_address = p_wallet_address 
    AND completion_percentage = 100;

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

  -- If no burn progress record exists, create one
  INSERT INTO user_burn_progress (
    wallet_address, 
    projects_completed_count,
    projects_required,
    completed_project_ids
  ) VALUES (
    p_wallet_address, 
    completed_project_count,
    2,
    '{}'::TEXT[]
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
    'last_reset_at', COALESCE(
      (SELECT updated_at FROM user_burn_progress WHERE wallet_address = p_wallet_address),
      NOW()
    )::text
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update check_and_award_burn_chance function
CREATE OR REPLACE FUNCTION check_and_award_burn_chance(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  completed_project_count INTEGER;
  existing_chances INTEGER;
  result JSON;
BEGIN
  -- Count unique completed projects (bypass RLS)
  SELECT COUNT(DISTINCT project_id)
  INTO completed_project_count
  FROM user_participations 
  WHERE wallet_address = p_wallet_address 
    AND completion_percentage = 100;

  -- Check existing available burn chances
  SELECT COUNT(*)
  INTO existing_chances
  FROM user_burn_chances_earned 
  WHERE wallet_address = p_wallet_address 
    AND used_at IS NULL;

  -- If user has completed 2+ projects and doesn't already have a burn chance, award one
  IF completed_project_count >= 2 AND existing_chances = 0 THEN
    -- Update burn progress
    INSERT INTO user_burn_progress (
      wallet_address,
      projects_completed_count,
      projects_required,
      completed_project_ids
    ) VALUES (
      p_wallet_address,
      completed_project_count,
      2,
      ARRAY[p_project_id]::TEXT[]
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      projects_completed_count = completed_project_count,
      completed_project_ids = CASE 
        WHEN NOT (p_project_id = ANY(user_burn_progress.completed_project_ids))
        THEN array_append(user_burn_progress.completed_project_ids, p_project_id)
        ELSE user_burn_progress.completed_project_ids
      END,
      updated_at = NOW();

    -- Award burn chance
    INSERT INTO user_burn_chances_earned (
      wallet_address,
      projects_completed_for_this_chance
    ) VALUES (
      p_wallet_address,
      ARRAY[p_project_id]::TEXT[]
    );

    result := json_build_object(
      'burn_chance_earned', true,
      'projects_completed', completed_project_count,
      'projects_required', 2,
      'message', format('Burn chance earned! Completed %s projects', completed_project_count)
    );
  ELSE
    result := json_build_object(
      'burn_chance_earned', false,
      'projects_completed', completed_project_count,
      'projects_required', 2,
      'message', format('Progress: %s/2 projects completed', completed_project_count)
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create use_burn_chance function
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

    result := json_build_object(
      'success', true,
      'message', 'Burn chance used successfully'
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

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION get_burn_chance_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_award_burn_chance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION use_burn_chance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_project_completion_check(TEXT, TEXT) TO authenticated;

-- 5. Success message
DO $$
BEGIN
  RAISE NOTICE '=== COLUMN NAMES FIXED ===';
  RAISE NOTICE '✅ Updated functions to use correct table schema';
  RAISE NOTICE '✅ Functions now work with user_burn_chances_earned table';
  RAISE NOTICE '✅ Ready to test burn chance functionality';
END $$;
