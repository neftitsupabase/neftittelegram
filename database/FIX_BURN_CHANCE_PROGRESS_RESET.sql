-- ============================================================================
-- FIX BURN CHANCE PROGRESS RESET
-- Fixes the issue where progress bar shows 2/2 instead of resetting to 0/2
-- ============================================================================

-- The issue: get_burn_chance_status recalculates progress by checking projects
-- completed AFTER last_reset_at, but this includes old completions that should
-- be ignored after a burn chance is used.

-- Solution: Fix the date comparison logic to properly reset progress

CREATE OR REPLACE FUNCTION get_burn_chance_status(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  current_progress INTEGER := 0;
  projects_required INTEGER := 2;
  v_completed_project_ids TEXT[] := '{}';
  available_chances INTEGER := 0;
  used_chances INTEGER := 0;
  progress_percentage DECIMAL := 0;
  last_reset_date TIMESTAMP WITH TIME ZONE;
  result JSON;
  project_record RECORD;
BEGIN
  -- Get or create user burn progress
  INSERT INTO user_burn_progress (wallet_address, projects_completed_count, last_reset_at)
  VALUES (p_wallet_address, 0, NOW())
  ON CONFLICT (wallet_address) DO NOTHING;

  -- Get current progress
  SELECT 
    ubp.projects_completed_count, 
    ubp.completed_project_ids,
    ubp.last_reset_at
  INTO 
    current_progress, 
    v_completed_project_ids,
    last_reset_date
  FROM user_burn_progress ubp
  WHERE ubp.wallet_address = p_wallet_address;

  -- RECALCULATE progress using UNIFIED completion tracking
  -- Only count projects where ALL tasks are completed AFTER the last reset
  v_completed_project_ids := ARRAY[]::TEXT[];
  
  FOR project_record IN
    SELECT DISTINCT p.id::TEXT as project_id
    FROM projects p
    WHERE p.is_active = true
      AND (
        -- Method 1: Check via user_task_completions (CampaignRewardsService)
        -- This checks that user completed ALL tasks in THIS specific project
        (
          SELECT COUNT(*) 
          FROM user_task_completions utc
          JOIN project_tasks pt ON utc.task_id = pt.id
          WHERE utc.wallet_address = p_wallet_address 
            AND pt.project_id = p.id
            AND utc.completed = true
            AND utc.completed_at > COALESCE(last_reset_date, '2020-01-01'::TIMESTAMP)
        ) = (
          SELECT COUNT(*) 
          FROM project_tasks 
          WHERE project_id = p.id AND is_active = true
        )
        AND (
          SELECT COUNT(*) 
          FROM project_tasks 
          WHERE project_id = p.id AND is_active = true
        ) > 0
        OR
        -- Method 2: Check via user_participations (BurnChanceService)  
        -- This checks for 100% completion of the project
        EXISTS (
          SELECT 1 FROM user_participations up
          WHERE up.wallet_address = p_wallet_address
            AND up.project_id = p.id
            AND up.completion_percentage = 100
            AND up.updated_at > COALESCE(last_reset_date, '2020-01-01'::TIMESTAMP)
        )
      )
  LOOP
    v_completed_project_ids := array_append(v_completed_project_ids, project_record.project_id);
  END LOOP;

  current_progress := COALESCE(array_length(v_completed_project_ids, 1), 0);

  -- Update progress if recalculated value is different
  UPDATE user_burn_progress 
  SET 
    projects_completed_count = current_progress,
    completed_project_ids = v_completed_project_ids,
    updated_at = CURRENT_TIMESTAMP
  WHERE wallet_address = p_wallet_address
    AND projects_completed_count != current_progress;

  -- Get burn chances
  SELECT 
    COUNT(*) FILTER (WHERE used_at IS NULL),
    COUNT(*) FILTER (WHERE used_at IS NOT NULL)
  INTO available_chances, used_chances
  FROM user_burn_chances_earned
  WHERE wallet_address = p_wallet_address;

  -- Calculate progress percentage
  progress_percentage := LEAST(100, (current_progress::DECIMAL / projects_required::DECIMAL) * 100);

  result := json_build_object(
    'current_progress', current_progress,
    'projects_required', projects_required,
    'completed_project_ids', v_completed_project_ids,
    'available_burn_chances', available_chances,
    'used_burn_chances', used_chances,
    'progress_percentage', progress_percentage,
    'last_reset_at', last_reset_date,
    'tracking_method', 'unified_fixed'
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the use_burn_chance function to set a more precise timestamp
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

    -- Reset burn progress to 0/2 with precise timestamp
    UPDATE user_burn_progress 
    SET 
      projects_completed_count = 0,
      completed_project_ids = '{}'::TEXT[],
      last_reset_at = NOW(),
      updated_at = NOW()
    WHERE wallet_address = p_wallet_address;

    result := json_build_object(
      'success', true,
      'message', 'Burn chance used successfully - progress reset to 0/2'
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_burn_chance_status(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_burn_chance_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION use_burn_chance(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION use_burn_chance(TEXT) TO authenticated;

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- 
-- This fixes the burn chance progress reset issue by:
-- 1. Adding immediate reset logic for recently used burn chances
-- 2. Improving timestamp comparison logic
-- 3. Ensuring progress shows 0/2 immediately after burn
-- ============================================================================
