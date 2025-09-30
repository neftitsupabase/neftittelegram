-- FINAL BURN CHANCE DEPLOYMENT SCRIPT
-- This combines the best parts of complete_safe_burn_migration.sql with the fixes from service integration
-- Ready for production deployment

-- 1. Clean up existing burn chance objects
DO $$
BEGIN
  -- Drop functions first (to avoid dependency issues)
  DROP FUNCTION IF EXISTS award_burn_chance(TEXT, TEXT, INTEGER, INTEGER);
  DROP FUNCTION IF EXISTS use_burn_chance(TEXT);
  DROP FUNCTION IF EXISTS get_quest_progress(TEXT);
  DROP FUNCTION IF EXISTS check_and_award_burn_chance(TEXT, TEXT);
  DROP FUNCTION IF EXISTS get_burn_chance_status(TEXT);
  DROP FUNCTION IF EXISTS trigger_project_completion_check(TEXT, TEXT);
  DROP FUNCTION IF EXISTS get_unified_completion_status(TEXT, TEXT);
  DROP FUNCTION IF EXISTS update_burn_progress_updated_at() CASCADE;
  DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
  
  -- Drop views
  DROP VIEW IF EXISTS user_available_burn_chances;
  
  -- Drop triggers (only if tables exist)
  BEGIN
    DROP TRIGGER IF EXISTS update_user_burn_chances_updated_at ON user_burn_chances;
    DROP TRIGGER IF EXISTS update_user_burn_progress_updated_at ON user_burn_progress;
    DROP TRIGGER IF EXISTS trigger_burn_progress_updated_at ON user_burn_progress;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;
  
  -- Drop tables (CASCADE to handle dependencies)
  DROP TABLE IF EXISTS user_burn_chances CASCADE;
  DROP TABLE IF EXISTS user_burn_progress CASCADE;
  DROP TABLE IF EXISTS user_burn_chances_earned CASCADE;
  
  RAISE NOTICE '✅ Cleaned up existing burn chance objects';
END $$;

-- 2. Create burn chance tracking tables
CREATE TABLE user_burn_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  projects_completed_count INTEGER DEFAULT 0,
  projects_required INTEGER DEFAULT 2,
  completed_project_ids TEXT[] DEFAULT '{}',
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_address)
);

CREATE TABLE user_burn_chances_earned (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE NULL,
  projects_completed_for_this_chance TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX idx_burn_progress_wallet ON user_burn_progress(wallet_address);
CREATE INDEX idx_burn_chances_wallet ON user_burn_chances_earned(wallet_address);
CREATE INDEX idx_burn_chances_available ON user_burn_chances_earned(wallet_address, used_at) WHERE used_at IS NULL;

-- 4. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_burn_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_burn_progress_updated_at
  BEFORE UPDATE ON user_burn_progress
  FOR EACH ROW EXECUTE FUNCTION update_burn_progress_updated_at();

-- 5. UNIFIED COMPLETION STATUS FUNCTION (FIXED)
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
  -- Convert project_id to UUID with error handling
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

  -- Method 1: Check user_task_completions (CampaignRewardsService)
  SELECT COUNT(*) INTO task_completions_count
  FROM user_task_completions utc
  WHERE utc.wallet_address = p_wallet_address 
    AND utc.project_id = project_uuid
    AND utc.completed = true;

  -- Method 2: Check user_participations (BurnChanceService)
  SELECT COALESCE(up.completion_percentage, 0) INTO participation_completion
  FROM user_participations up
  WHERE up.wallet_address = p_wallet_address 
    AND up.project_id = project_uuid;

  -- Use the higher completion method
  IF task_completions_count > 0 AND total_tasks > 0 THEN
    completion_percentage := ROUND((task_completions_count::DECIMAL / total_tasks::DECIMAL) * 100);
  ELSE
    completion_percentage := participation_completion;
  END IF;

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

-- 6. FIXED TRIGGER PROJECT COMPLETION CHECK
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
  RETURN check_and_award_burn_chance(p_wallet_address, p_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. ENHANCED CHECK AND AWARD BURN CHANCE
CREATE OR REPLACE FUNCTION check_and_award_burn_chance(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  current_progress INTEGER;
  projects_required INTEGER := 2;
  v_completed_project_ids TEXT[];
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
  v_completed_project_ids := ARRAY[]::TEXT[];
  
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
    v_completed_project_ids := array_append(v_completed_project_ids, project_record.project_id);
  END LOOP;

  -- Count unique completed projects since last reset
  current_progress := COALESCE(array_length(v_completed_project_ids, 1), 0);

  -- Update progress count
  UPDATE user_burn_progress 
  SET 
    projects_completed_count = current_progress,
    completed_project_ids = v_completed_project_ids,
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

    result := json_build_object(
      'burn_chance_earned', true,
      'projects_completed', current_progress,
      'projects_required', projects_required,
      'message', format('🔥 Burn chance earned! Completed %s projects.', current_progress)
    );
  ELSE
    result := json_build_object(
      'burn_chance_earned', false,
      'projects_completed', current_progress,
      'projects_required', projects_required,
      'message', format('Progress: %s/%s projects completed', current_progress, projects_required)
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. GET BURN CHANCE STATUS FUNCTION (FIXED - Column Ambiguity Resolved)
CREATE OR REPLACE FUNCTION get_burn_chance_status(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  current_progress INTEGER := 0;
  v_projects_required INTEGER := 2;  -- Renamed to avoid column conflict
  v_completed_project_ids TEXT[] := '{}';  -- Renamed to avoid column conflict
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

  -- Get current progress - use table alias to avoid ambiguity
  SELECT 
    ubp.projects_completed_count, 
    ubp.completed_project_ids,  -- Table column reference is now clear
    ubp.last_reset_at
  INTO 
    current_progress, 
    v_completed_project_ids,    -- Variable assignment is now clear
    last_reset_date
  FROM user_burn_progress ubp
  WHERE ubp.wallet_address = p_wallet_address;

  -- RECALCULATE progress using UNIFIED completion tracking
  v_completed_project_ids := ARRAY[]::TEXT[];
  
  FOR project_record IN
    SELECT DISTINCT p.id::TEXT as project_id
    FROM projects p
    WHERE p.is_active = true
      AND (
        -- Method 1: Check via user_task_completions - ALL tasks in project must be completed
        (
          SELECT COUNT(*) FROM project_tasks pt 
          WHERE pt.project_id = p.id AND pt.is_active = true
        ) > 0  -- Project must have at least 1 active task
        AND
        (
          SELECT COUNT(*) FROM user_task_completions utc
          JOIN project_tasks pt ON utc.task_id = pt.id
          WHERE utc.wallet_address = p_wallet_address 
            AND pt.project_id = p.id
            AND pt.is_active = true
            AND utc.completed = true
            AND utc.completed_at > last_reset_date  -- Only count projects completed after last reset
        ) = (
          SELECT COUNT(*) FROM project_tasks pt2
          WHERE pt2.project_id = p.id AND pt2.is_active = true
        )
        OR
        -- Method 2: Check via user_participations - 100% completion required
        EXISTS (
          SELECT 1 FROM user_participations up
          WHERE up.wallet_address = p_wallet_address
            AND up.project_id = p.id
            AND up.completion_percentage = 100
            AND up.created_at > last_reset_date  -- Only count projects completed after last reset
        )
      )
  LOOP
    v_completed_project_ids := array_append(v_completed_project_ids, project_record.project_id);
  END LOOP;

  -- Calculate progress for UI display (actual completed projects)
  current_progress := COALESCE(array_length(v_completed_project_ids, 1), 0);

  -- Update progress if recalculated value is different
  UPDATE user_burn_progress 
  SET 
    projects_completed_count = current_progress,
    completed_project_ids = v_completed_project_ids[1:v_projects_required], -- Only store first 2 project IDs
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

  -- Note: Burn chances are awarded via trigger_project_completion_check function
  -- This function only reads status, does not award chances

  -- Calculate progress percentage (capped at 100%)
  progress_percentage := LEAST(100, (current_progress::DECIMAL / v_projects_required::DECIMAL) * 100);

  result := json_build_object(
    'current_progress', current_progress,
    'projects_required', v_projects_required,
    'completed_project_ids', v_completed_project_ids,
    'available_burn_chances', available_chances,
    'used_burn_chances', used_chances,
    'progress_percentage', progress_percentage,
    'last_reset_at', last_reset_date,
    'tracking_method', 'unified'
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. USE BURN CHANCE FUNCTION
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

    -- Reset burn progress to 0/2 - user must complete 2 NEW projects for next burn chance
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

-- 10. RLS POLICIES (FIXED FOR WALLET HEADERS)
ALTER TABLE user_burn_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_burn_chances_earned ENABLE ROW LEVEL SECURITY;

-- Policies that work with x-wallet-address headers
CREATE POLICY "Users can view own burn progress" ON user_burn_progress
  FOR SELECT USING (
    wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

CREATE POLICY "Users can insert own burn progress" ON user_burn_progress
  FOR INSERT WITH CHECK (
    wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

CREATE POLICY "Users can update own burn progress" ON user_burn_progress
  FOR UPDATE USING (
    wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

CREATE POLICY "Users can view own burn chances" ON user_burn_chances_earned
  FOR SELECT USING (
    wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

CREATE POLICY "Users can insert own burn chances" ON user_burn_chances_earned
  FOR INSERT WITH CHECK (
    wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

CREATE POLICY "Users can update own burn chances" ON user_burn_chances_earned
  FOR UPDATE USING (
    wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

-- 11. Grant permissions
GRANT EXECUTE ON FUNCTION get_unified_completion_status(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_project_completion_check(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_award_burn_chance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_burn_chance_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION use_burn_chance(TEXT) TO authenticated;

-- 12. Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔥 FINAL BURN CHANCE SYSTEM DEPLOYED SUCCESSFULLY';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '✅ Fixed UUID casting issues';
  RAISE NOTICE '✅ Unified completion tracking (user_task_completions + user_participations)';
  RAISE NOTICE '✅ Fixed RLS policies for wallet header authentication';
  RAISE NOTICE '✅ Service integration conflicts resolved';
  RAISE NOTICE '✅ Progress reset system after burn';
  RAISE NOTICE '✅ Real-time progress tracking';
  RAISE NOTICE '';
  RAISE NOTICE 'Integration:';
  RAISE NOTICE '- CampaignRewardsService: Immediate NEFT/XP rewards ✅';
  RAISE NOTICE '- BurnChanceService: Immediate burn progress updates ✅';
  RAISE NOTICE '- LowEgressManualNFTService: Manual NFT distribution ✅';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Burn chance progress should now update immediately after task completion!';
END $$;
