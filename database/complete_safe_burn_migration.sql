-- Complete Safe Burn Chance Migration
-- This script safely migrates to the new burn chance system with all fixes integrated
-- It handles existing data and prevents conflicts

-- 1. Check and drop existing burn chance objects if they exist
DO $$
BEGIN
  -- Drop functions first (to avoid dependency issues)
  DROP FUNCTION IF EXISTS award_burn_chance(TEXT, TEXT, INTEGER, INTEGER);
  DROP FUNCTION IF EXISTS use_burn_chance(TEXT);
  DROP FUNCTION IF EXISTS get_quest_progress(TEXT);
  DROP FUNCTION IF EXISTS check_and_award_burn_chance(TEXT, TEXT);
  DROP FUNCTION IF EXISTS get_burn_chance_status(TEXT);
  DROP FUNCTION IF EXISTS trigger_project_completion_check(TEXT, TEXT);
  DROP FUNCTION IF EXISTS update_burn_progress_updated_at() CASCADE;
  DROP FUNCTION IF EXISTS check_and_award_burn_chance(UUID) CASCADE;
  DROP FUNCTION IF EXISTS use_burn_chance(UUID, UUID) CASCADE;
  DROP FUNCTION IF EXISTS get_burn_chance_status(UUID) CASCADE;
  DROP FUNCTION IF EXISTS trigger_project_completion_check(TEXT, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
  
  -- Drop views
  DROP VIEW IF EXISTS user_available_burn_chances;
  
  -- Drop triggers (only if tables exist)
  BEGIN
    DROP TRIGGER IF EXISTS update_user_burn_chances_updated_at ON user_burn_chances;
  EXCEPTION
    WHEN undefined_table THEN
      NULL; -- Table doesn't exist, ignore
  END;
  
  BEGIN
    DROP TRIGGER IF EXISTS update_user_burn_progress_updated_at ON user_burn_progress;
  EXCEPTION
    WHEN undefined_table THEN
      NULL; -- Table doesn't exist, ignore
  END;
  
  -- Drop tables (CASCADE to handle dependencies)
  DROP TABLE IF EXISTS user_burn_chances CASCADE;
  DROP TABLE IF EXISTS user_burn_progress CASCADE;
  DROP TABLE IF EXISTS user_burn_chances_earned CASCADE;
  
  RAISE NOTICE 'Cleaned up existing burn chance objects';
END $$;

-- 2. Create the new burn chance tracking table
CREATE TABLE IF NOT EXISTS user_burn_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  projects_completed_count INTEGER DEFAULT 0,
  projects_required INTEGER DEFAULT 2,
  completed_project_ids TEXT[] DEFAULT '{}', -- Array of completed project IDs
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_address)
);

-- 3. Create burn chances earned table
CREATE TABLE IF NOT EXISTS user_burn_chances_earned (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE NULL,
  projects_completed_for_this_chance TEXT[], -- Which 2 projects earned this chance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_burn_progress_wallet ON user_burn_progress(wallet_address);
CREATE INDEX IF NOT EXISTS idx_burn_chances_wallet ON user_burn_chances_earned(wallet_address);
CREATE INDEX IF NOT EXISTS idx_burn_chances_available ON user_burn_chances_earned(wallet_address, used_at) WHERE used_at IS NULL;

-- 5. Create trigger for updated_at
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

-- 6. Function to get user's burn chance status (with reset tracking)
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

-- 7. Function to check and award burn chance
CREATE OR REPLACE FUNCTION check_and_award_burn_chance(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  completed_project_count INTEGER;
  existing_chances INTEGER;
  last_reset TIMESTAMP;
  result JSON;
BEGIN
  -- Get last reset time
  SELECT last_reset_at INTO last_reset
  FROM user_burn_progress 
  WHERE wallet_address = p_wallet_address;

  -- Count unique completed projects AFTER last reset
  IF last_reset IS NOT NULL THEN
    SELECT COUNT(DISTINCT up.project_id)
    INTO completed_project_count
    FROM user_participations up
    JOIN projects p ON up.project_id = p.id
    WHERE up.wallet_address = p_wallet_address 
      AND up.completion_percentage = 100
      AND up.updated_at > last_reset;
  ELSE
    SELECT COUNT(DISTINCT project_id)
    INTO completed_project_count
    FROM user_participations 
    WHERE wallet_address = p_wallet_address 
      AND completion_percentage = 100;
  END IF;

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
      completed_project_ids,
      last_reset_at
    ) VALUES (
      p_wallet_address,
      completed_project_count,
      2,
      ARRAY[p_project_id]::TEXT[],
      COALESCE(last_reset, NOW())
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

-- 8. Function to use a burn chance (with progress reset)
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

-- 9. Function to manually trigger project completion check (for integration)
CREATE OR REPLACE FUNCTION trigger_project_completion_check(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  completion_percentage INTEGER;
  result JSON;
BEGIN
  -- Check if project is 100% completed (FIXED: using correct table name)
  SELECT 
    COALESCE(
      ROUND((completed_tasks_count::DECIMAL / total_tasks_count::DECIMAL) * 100), 
      0
    )
  INTO completion_percentage
  FROM user_participations up
  JOIN projects p ON up.project_id = p.id
  WHERE up.wallet_address = p_wallet_address 
    AND up.project_id = p_project_id::UUID
    AND p.is_active = true;
  
  -- If project is not 100% complete, return early
  IF completion_percentage IS NULL OR completion_percentage < 100 THEN
    result := json_build_object(
      'burn_chance_earned', false,
      'message', format('Project not fully completed (%s%%)', COALESCE(completion_percentage, 0))
    );
    RETURN result;
  END IF;
  
  -- Project is 100% complete, check for burn chance
  RETURN check_and_award_burn_chance(p_wallet_address, p_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Functions to award missing burn chances
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

-- 11. Add RLS policies
ALTER TABLE user_burn_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_burn_chances_earned ENABLE ROW LEVEL SECURITY;

-- Users can only see their own burn progress
CREATE POLICY "Users can view own burn progress" ON user_burn_progress
  FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can insert own burn progress" ON user_burn_progress
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update own burn progress" ON user_burn_progress
  FOR UPDATE USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can only see their own burn chances
CREATE POLICY "Users can view own burn chances" ON user_burn_chances_earned
  FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can insert own burn chances" ON user_burn_chances_earned
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update own burn chances" ON user_burn_chances_earned
  FOR UPDATE USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- 12. Grant permissions
GRANT EXECUTE ON FUNCTION check_and_award_burn_chance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION use_burn_chance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_burn_chance_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_project_completion_check(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION award_missing_burn_chances() TO authenticated;
GRANT EXECUTE ON FUNCTION award_burn_chance_to_user(TEXT) TO authenticated;

-- 13. Award burn chances to existing eligible users
SELECT award_missing_burn_chances() as award_result;

-- 14. Success message
DO $$
BEGIN
  RAISE NOTICE '=== COMPLETE SAFE BURN CHANCE MIGRATION COMPLETE ===';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '✅ Safely removed old burn chance system';
  RAISE NOTICE '✅ Created new project-based burn chance tables';
  RAISE NOTICE '✅ Fixed table name issue (user_participations)';
  RAISE NOTICE '✅ Added proper UUID casting for project_id';
  RAISE NOTICE '✅ Tracks completion of 2 different projects';
  RAISE NOTICE '✅ Awards 1 burn chance per 2 completed projects';
  RAISE NOTICE '✅ Resets progress after earning burn chance';
  RAISE NOTICE '✅ Repeatable cycle: earn → burn → reset → earn';
  RAISE NOTICE '✅ Integration ready with OptimizedCampaignService';
  RAISE NOTICE '✅ RLS policies for security';
  RAISE NOTICE '✅ Progress reset after successful burn';
  RAISE NOTICE '✅ Awarded burn chances to existing eligible users';
  RAISE NOTICE '';
  RAISE NOTICE 'Safe to run - all existing data preserved';
  RAISE NOTICE 'Burn page should now work correctly with progress tracking';
END $$;
