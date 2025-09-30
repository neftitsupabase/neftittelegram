-- Award Missing Burn Chances
-- This function manually awards burn chances to users who completed 2+ projects but don't have burn chances

-- 1. Function to award burn chances to eligible users
CREATE OR REPLACE FUNCTION award_missing_burn_chances()
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  awarded_count INTEGER := 0;
  result JSON;
BEGIN
  -- Find users who completed 2+ projects but have no available burn chances
  FOR user_record IN
    SELECT 
      up.wallet_address,
      COUNT(DISTINCT up.project_id) as completed_projects,
      COALESCE(bc.available_chances, 0) as current_chances
    FROM user_participations up
    LEFT JOIN (
      SELECT 
        wallet_address,
        COUNT(*) as available_chances
      FROM user_burn_chances_earned 
      WHERE used_at IS NULL
      GROUP BY wallet_address
    ) bc ON up.wallet_address = bc.wallet_address
    WHERE up.completion_percentage = 100
    GROUP BY up.wallet_address, bc.available_chances
    HAVING COUNT(DISTINCT up.project_id) >= 2 
      AND COALESCE(bc.available_chances, 0) = 0
  LOOP
    -- Award burn chance to this user
    INSERT INTO user_burn_chances_earned (
      wallet_address,
      projects_completed_for_this_chance
    ) VALUES (
      user_record.wallet_address,
      '{}'::TEXT[]  -- Empty array since we're awarding retroactively
    );

    -- Update burn progress
    INSERT INTO user_burn_progress (
      wallet_address,
      projects_completed_count,
      projects_required,
      completed_project_ids
    ) VALUES (
      user_record.wallet_address,
      user_record.completed_projects,
      2,
      '{}'::TEXT[]
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      projects_completed_count = user_record.completed_projects,
      updated_at = NOW();

    awarded_count := awarded_count + 1;
    
    RAISE NOTICE 'Awarded burn chance to wallet: % (% completed projects)', 
      user_record.wallet_address, user_record.completed_projects;
  END LOOP;

  result := json_build_object(
    'success', true,
    'burn_chances_awarded', awarded_count,
    'message', format('Awarded %s burn chances to eligible users', awarded_count)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to award burn chance to specific user
CREATE OR REPLACE FUNCTION award_burn_chance_to_user(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  completed_projects INTEGER;
  existing_chances INTEGER;
  result JSON;
BEGIN
  -- Count completed projects
  SELECT COUNT(DISTINCT project_id)
  INTO completed_projects
  FROM user_participations 
  WHERE wallet_address = p_wallet_address 
    AND completion_percentage = 100;

  -- Count existing available burn chances
  SELECT COUNT(*)
  INTO existing_chances
  FROM user_burn_chances_earned 
  WHERE wallet_address = p_wallet_address 
    AND used_at IS NULL;

  -- Award burn chance if eligible and doesn't have one
  IF completed_projects >= 2 AND existing_chances = 0 THEN
    -- Award burn chance
    INSERT INTO user_burn_chances_earned (
      wallet_address,
      projects_completed_for_this_chance
    ) VALUES (
      p_wallet_address,
      '{}'::TEXT[]
    );

    -- Update burn progress
    INSERT INTO user_burn_progress (
      wallet_address,
      projects_completed_count,
      projects_required,
      completed_project_ids
    ) VALUES (
      p_wallet_address,
      completed_projects,
      2,
      '{}'::TEXT[]
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      projects_completed_count = completed_projects,
      updated_at = NOW();

    result := json_build_object(
      'success', true,
      'message', format('Burn chance awarded! User has %s completed projects', completed_projects)
    );
  ELSE
    result := json_build_object(
      'success', false,
      'message', format('User has %s completed projects and %s available burn chances', completed_projects, existing_chances)
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION award_missing_burn_chances() TO authenticated;
GRANT EXECUTE ON FUNCTION award_burn_chance_to_user(TEXT) TO authenticated;

-- 4. Run the function to award missing burn chances
SELECT award_missing_burn_chances() as award_result;

-- 5. Success message
DO $$
BEGIN
  RAISE NOTICE '=== BURN CHANCE AWARD COMPLETE ===';
  RAISE NOTICE '✅ Created functions to award missing burn chances';
  RAISE NOTICE '✅ Automatically awarded burn chances to eligible users';
  RAISE NOTICE '✅ Users with 2+ completed projects should now have burn chances';
  RAISE NOTICE '✅ Burn page should now show burn button enabled';
END $$;
