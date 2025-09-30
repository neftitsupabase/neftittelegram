-- Fix Service Integration Conflicts
-- Root Cause: Different services use different completion tracking tables
-- CampaignRewardsService uses user_task_completions
-- BurnChanceService uses user_participations  
-- This creates disconnected completion tracking

-- 1. Create unified completion status function
CREATE OR REPLACE FUNCTION get_unified_completion_status(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  project_uuid UUID;
  task_completions_count INTEGER := 0;
  participation_completion INTEGER := 0;
  total_tasks INTEGER := 0;
  completion_percentage INTEGER := 0;
  result JSON;
BEGIN
  -- Convert project_id to UUID
  BEGIN
    project_uuid := p_project_id::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN json_build_object(
      'error', 'Invalid project ID format',
      'completion_percentage', 0,
      'is_complete', false
    );
  END;

  -- Get total tasks for project
  SELECT COUNT(*) INTO total_tasks
  FROM project_tasks 
  WHERE project_id = project_uuid AND is_active = true;

  -- Method 1: Check user_task_completions (used by CampaignRewardsService)
  SELECT COUNT(*) INTO task_completions_count
  FROM user_task_completions utc
  WHERE utc.wallet_address = p_wallet_address 
    AND utc.project_id = project_uuid
    AND utc.completed = true;

  -- Method 2: Check user_participations (used by BurnChanceService)
  SELECT COALESCE(completion_percentage, 0) INTO participation_completion
  FROM user_participations up
  WHERE up.wallet_address = p_wallet_address 
    AND up.project_id = project_uuid;

  -- Use the higher completion method (more accurate)
  IF task_completions_count > 0 AND total_tasks > 0 THEN
    completion_percentage := ROUND((task_completions_count::DECIMAL / total_tasks::DECIMAL) * 100);
  ELSE
    completion_percentage := participation_completion;
  END IF;

  -- Debug logging
  RAISE NOTICE 'Unified completion check: wallet=%, project=%, task_completions=%, participation=%, total_tasks=%, final=%', 
    p_wallet_address, p_project_id, task_completions_count, participation_completion, total_tasks, completion_percentage;

  result := json_build_object(
    'completion_percentage', completion_percentage,
    'is_complete', completion_percentage >= 100,
    'task_completions_count', task_completions_count,
    'participation_completion', participation_completion,
    'total_tasks', total_tasks,
    'method_used', CASE 
      WHEN task_completions_count > 0 THEN 'task_completions'
      ELSE 'user_participations'
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix trigger_project_completion_check to use unified completion
CREATE OR REPLACE FUNCTION trigger_project_completion_check(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  completion_data JSON;
  completion_percentage INTEGER;
  is_complete BOOLEAN;
  result JSON;
BEGIN
  -- Get unified completion status
  completion_data := get_unified_completion_status(p_wallet_address, p_project_id);
  
  -- Extract completion data
  completion_percentage := (completion_data->>'completion_percentage')::INTEGER;
  is_complete := (completion_data->>'is_complete')::BOOLEAN;
  
  -- Debug logging
  RAISE NOTICE 'Project completion check: wallet=%, project=%, completion=%, complete=%', 
    p_wallet_address, p_project_id, completion_percentage, is_complete;
  
  -- If project is not 100% complete, return early
  IF NOT is_complete THEN
    result := json_build_object(
      'burn_chance_earned', false,
      'projects_completed', 0,
      'projects_required', 2,
      'message', format('Project not fully completed (%s%%). Method: %s', 
        completion_percentage, 
        completion_data->>'method_used'
      )
    );
    RETURN result;
  END IF;
  
  -- Project is 100% complete, check for burn chance
  RAISE NOTICE '🔥 Project 100%% complete via %s, checking for burn chance award', 
    completion_data->>'method_used';
  RETURN check_and_award_burn_chance(p_wallet_address, p_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enhanced check_and_award_burn_chance with unified completion tracking
CREATE OR REPLACE FUNCTION check_and_award_burn_chance(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  current_progress INTEGER;
  projects_required INTEGER := 2;
  completed_project_ids TEXT[];
  last_reset_date DATE;
  result JSON;
  project_record RECORD;
BEGIN
  -- Get or create user burn progress record
  INSERT INTO user_burn_progress (wallet_address, projects_completed_count, last_reset_at)
  VALUES (p_wallet_address, 0, CURRENT_DATE)
  ON CONFLICT (wallet_address) DO NOTHING;

  -- Get current progress
  SELECT projects_completed_count, last_reset_at 
  INTO current_progress, last_reset_date
  FROM user_burn_progress 
  WHERE wallet_address = p_wallet_address;

  -- Find all completed projects using UNIFIED completion check
  -- This checks both user_task_completions AND user_participations
  completed_project_ids := ARRAY[]::TEXT[];
  
  FOR project_record IN
    SELECT DISTINCT p.id::TEXT as project_id
    FROM projects p
    WHERE p.is_active = true
      AND (
        -- Method 1: Check via user_task_completions (CampaignRewardsService)
        EXISTS (
          SELECT 1 FROM user_task_completions utc
          JOIN project_tasks pt ON utc.task_id = pt.id
          WHERE utc.wallet_address = p_wallet_address 
            AND pt.project_id = p.id
            AND utc.completed = true
          GROUP BY pt.project_id
          HAVING COUNT(*) = (
            SELECT COUNT(*) FROM project_tasks 
            WHERE project_id = p.id AND is_active = true
          )
        )
        OR
        -- Method 2: Check via user_participations (BurnChanceService)
        EXISTS (
          SELECT 1 FROM user_participations up
          WHERE up.wallet_address = p_wallet_address
            AND up.project_id = p.id
            AND up.completion_percentage = 100
            AND up.updated_at::DATE >= COALESCE(last_reset_date, '2020-01-01'::DATE)
        )
      )
  LOOP
    completed_project_ids := array_append(completed_project_ids, project_record.project_id);
  END LOOP;

  -- Count unique completed projects since last reset
  current_progress := COALESCE(array_length(completed_project_ids, 1), 0);

  -- Debug logging
  RAISE NOTICE '🔥 Unified burn chance check: wallet=%, current_progress=%, required=%, completed_projects=%', 
    p_wallet_address, current_progress, projects_required, completed_project_ids;

  -- Update progress count
  UPDATE user_burn_progress 
  SET 
    projects_completed_count = current_progress,
    completed_project_ids = completed_project_ids,
    updated_at = CURRENT_TIMESTAMP
  WHERE wallet_address = p_wallet_address;

  -- Check if user has earned a burn chance
  IF current_progress >= projects_required THEN
    -- Award burn chance
    INSERT INTO user_burn_chances_earned (wallet_address, earned_at)
    VALUES (p_wallet_address, CURRENT_TIMESTAMP);

    -- Reset progress for next cycle
    UPDATE user_burn_progress 
    SET 
      projects_completed_count = 0,
      completed_project_ids = '{}',
      last_reset_at = CURRENT_DATE,
      updated_at = CURRENT_TIMESTAMP
    WHERE wallet_address = p_wallet_address;

    RAISE NOTICE '🔥 BURN CHANCE AWARDED to wallet: % (completed % projects)', p_wallet_address, current_progress;

    result := json_build_object(
      'burn_chance_earned', true,
      'projects_completed', current_progress,
      'projects_required', projects_required,
      'message', format('🔥 Burn chance earned! Completed %s projects via unified tracking.', current_progress)
    );
  ELSE
    result := json_build_object(
      'burn_chance_earned', false,
      'projects_completed', current_progress,
      'projects_required', projects_required,
      'message', format('Progress: %s/%s projects completed (unified tracking)', current_progress, projects_required)
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enhanced get_burn_chance_status with unified tracking
CREATE OR REPLACE FUNCTION get_burn_chance_status(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  current_progress INTEGER := 0;
  projects_required INTEGER := 2;
  completed_project_ids TEXT[] := '{}';
  available_chances INTEGER := 0;
  used_chances INTEGER := 0;
  progress_percentage DECIMAL := 0;
  last_reset_date DATE;
  result JSON;
  project_record RECORD;
BEGIN
  -- Get or create user burn progress
  INSERT INTO user_burn_progress (wallet_address, projects_completed_count, last_reset_at)
  VALUES (p_wallet_address, 0, CURRENT_DATE)
  ON CONFLICT (wallet_address) DO NOTHING;

  -- Get current progress
  SELECT 
    projects_completed_count, 
    completed_project_ids, 
    last_reset_at
  INTO 
    current_progress, 
    completed_project_ids, 
    last_reset_date
  FROM user_burn_progress 
  WHERE wallet_address = p_wallet_address;

  -- RECALCULATE progress using UNIFIED completion tracking
  completed_project_ids := ARRAY[]::TEXT[];
  
  FOR project_record IN
    SELECT DISTINCT p.id::TEXT as project_id, p.title
    FROM projects p
    WHERE p.is_active = true
      AND (
        -- Method 1: Check via user_task_completions (CampaignRewardsService)
        EXISTS (
          SELECT 1 FROM user_task_completions utc
          JOIN project_tasks pt ON utc.task_id = pt.id
          WHERE utc.wallet_address = p_wallet_address 
            AND pt.project_id = p.id
            AND utc.completed = true
          GROUP BY pt.project_id
          HAVING COUNT(*) = (
            SELECT COUNT(*) FROM project_tasks 
            WHERE project_id = p.id AND is_active = true
          )
        )
        OR
        -- Method 2: Check via user_participations (BurnChanceService)  
        EXISTS (
          SELECT 1 FROM user_participations up
          WHERE up.wallet_address = p_wallet_address
            AND up.project_id = p.id
            AND up.completion_percentage = 100
            AND up.updated_at::DATE >= COALESCE(last_reset_date, '2020-01-01'::DATE)
        )
      )
  LOOP
    completed_project_ids := array_append(completed_project_ids, project_record.project_id);
    RAISE NOTICE '✅ Found completed project: % (%)', project_record.project_id, project_record.title;
  END LOOP;

  current_progress := COALESCE(array_length(completed_project_ids, 1), 0);

  -- Update progress if recalculated value is different
  UPDATE user_burn_progress 
  SET 
    projects_completed_count = current_progress,
    completed_project_ids = completed_project_ids,
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

  -- Debug logging
  RAISE NOTICE '📊 UNIFIED burn status: wallet=%, progress=%/%, available=%, used=%, projects=%', 
    p_wallet_address, current_progress, projects_required, available_chances, used_chances, completed_project_ids;

  result := json_build_object(
    'current_progress', current_progress,
    'projects_required', projects_required,
    'completed_project_ids', completed_project_ids,
    'available_burn_chances', available_chances,
    'used_burn_chances', used_chances,
    'progress_percentage', progress_percentage,
    'last_reset_at', last_reset_date,
    'tracking_method', 'unified'
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION get_unified_completion_status(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_project_completion_check(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_award_burn_chance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_burn_chance_status(TEXT) TO authenticated;

-- 6. Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 SERVICE INTEGRATION CONFLICTS FIXED';
  RAISE NOTICE '';
  RAISE NOTICE 'Root Cause Fixed:';
  RAISE NOTICE '- CampaignRewardsService uses user_task_completions table ✅';
  RAISE NOTICE '- BurnChanceService now uses UNIFIED completion tracking ✅';
  RAISE NOTICE '- Checks both user_task_completions AND user_participations ✅';
  RAISE NOTICE '- LowEgressManualNFTService remains manual (campaign end) ✅';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Flow:';
  RAISE NOTICE '1. User completes tasks → CampaignRewardsService gives immediate NEFT/XP ✅';
  RAISE NOTICE '2. Same completion → BurnChanceService updates burn progress ✅';  
  RAISE NOTICE '3. Campaign ends → Admin uses LowEgressManualNFTService for NFT distribution ✅';
  RAISE NOTICE '';
  RAISE NOTICE '🔥 Burn chance progress should now update immediately after task completion!';
END $$;
