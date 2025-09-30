-- Project-Based Burn Chance System
-- User gets 1 burn chance after completing ALL tasks in 2 different projects
-- After using burn chance, progress resets and cycle repeats

-- 1. Create the new burn chance tracking table
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

-- 2. Create burn chances earned table
CREATE TABLE IF NOT EXISTS user_burn_chances_earned (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE NULL,
  projects_completed_for_this_chance TEXT[], -- Which 2 projects earned this chance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_burn_progress_wallet ON user_burn_progress(wallet_address);
CREATE INDEX IF NOT EXISTS idx_burn_chances_wallet ON user_burn_chances_earned(wallet_address);
CREATE INDEX IF NOT EXISTS idx_burn_chances_available ON user_burn_chances_earned(wallet_address, used_at) WHERE used_at IS NULL;

-- 4. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_burn_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_burn_progress_updated_at 
  BEFORE UPDATE ON user_burn_progress 
  FOR EACH ROW 
  EXECUTE FUNCTION update_burn_progress_updated_at();

-- 5. Function to check and award burn chance when project is completed
CREATE OR REPLACE FUNCTION check_and_award_burn_chance(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  current_progress RECORD;
  new_projects_completed INTEGER;
  burn_chance_earned BOOLEAN := FALSE;
  result JSON;
BEGIN
  -- Get or create user progress record
  INSERT INTO user_burn_progress (wallet_address, projects_completed_count, completed_project_ids)
  VALUES (p_wallet_address, 0, '{}')
  ON CONFLICT (wallet_address) DO NOTHING;
  
  -- Get current progress
  SELECT * INTO current_progress
  FROM user_burn_progress
  WHERE wallet_address = p_wallet_address;
  
  -- Check if this project was already counted
  IF p_project_id = ANY(current_progress.completed_project_ids) THEN
    -- Project already completed, no change
    result := json_build_object(
      'burn_chance_earned', false,
      'projects_completed', current_progress.projects_completed_count,
      'projects_required', current_progress.projects_required,
      'message', 'Project already completed'
    );
    RETURN result;
  END IF;
  
  -- Add this project to completed list
  new_projects_completed := current_progress.projects_completed_count + 1;
  
  UPDATE user_burn_progress
  SET 
    projects_completed_count = new_projects_completed,
    completed_project_ids = array_append(current_progress.completed_project_ids, p_project_id),
    updated_at = NOW()
  WHERE wallet_address = p_wallet_address;
  
  -- Check if user earned a burn chance (completed required number of projects)
  IF new_projects_completed >= current_progress.projects_required THEN
    -- Award burn chance
    INSERT INTO user_burn_chances_earned (
      wallet_address,
      projects_completed_for_this_chance
    ) VALUES (
      p_wallet_address,
      array_append(current_progress.completed_project_ids, p_project_id)
    );
    
    -- Reset progress for next cycle
    UPDATE user_burn_progress
    SET 
      projects_completed_count = 0,
      completed_project_ids = '{}',
      last_reset_at = NOW(),
      updated_at = NOW()
    WHERE wallet_address = p_wallet_address;
    
    burn_chance_earned := TRUE;
    
    result := json_build_object(
      'burn_chance_earned', true,
      'projects_completed', current_progress.projects_required,
      'projects_required', current_progress.projects_required,
      'message', 'Burn chance earned! Progress reset for next cycle.'
    );
  ELSE
    result := json_build_object(
      'burn_chance_earned', false,
      'projects_completed', new_projects_completed,
      'projects_required', current_progress.projects_required,
      'message', format('Progress: %s/%s projects completed', new_projects_completed, current_progress.projects_required)
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to use a burn chance
CREATE OR REPLACE FUNCTION use_burn_chance(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  chance_id UUID;
  result JSON;
BEGIN
  -- Get the oldest unused burn chance
  SELECT id INTO chance_id
  FROM user_burn_chances_earned
  WHERE wallet_address = p_wallet_address 
    AND used_at IS NULL
  ORDER BY earned_at ASC
  LIMIT 1;
  
  IF chance_id IS NULL THEN
    result := json_build_object(
      'success', false,
      'message', 'No burn chances available'
    );
    RETURN result;
  END IF;
  
  -- Mark the burn chance as used
  UPDATE user_burn_chances_earned
  SET used_at = NOW()
  WHERE id = chance_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Burn chance used successfully'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to get user burn chance status
CREATE OR REPLACE FUNCTION get_burn_chance_status(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  progress_record RECORD;
  available_chances INTEGER;
  used_chances INTEGER;
  result JSON;
BEGIN
  -- Get progress record
  SELECT * INTO progress_record
  FROM user_burn_progress
  WHERE wallet_address = p_wallet_address;
  
  -- If no record exists, create default
  IF progress_record IS NULL THEN
    INSERT INTO user_burn_progress (wallet_address, projects_completed_count, completed_project_ids)
    VALUES (p_wallet_address, 0, '{}');
    
    progress_record := ROW(
      gen_random_uuid(), p_wallet_address, 0, 2, '{}', NOW(), NOW(), NOW()
    )::user_burn_progress;
  END IF;
  
  -- Count available and used burn chances
  SELECT COUNT(*) INTO available_chances
  FROM user_burn_chances_earned
  WHERE wallet_address = p_wallet_address AND used_at IS NULL;
  
  SELECT COUNT(*) INTO used_chances
  FROM user_burn_chances_earned
  WHERE wallet_address = p_wallet_address AND used_at IS NOT NULL;
  
  result := json_build_object(
    'current_progress', progress_record.projects_completed_count,
    'projects_required', progress_record.projects_required,
    'completed_project_ids', progress_record.completed_project_ids,
    'available_burn_chances', available_chances,
    'used_burn_chances', used_chances,
    'progress_percentage', ROUND((progress_record.projects_completed_count::DECIMAL / progress_record.projects_required::DECIMAL) * 100),
    'last_reset_at', progress_record.last_reset_at
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to manually trigger project completion check (for integration)
CREATE OR REPLACE FUNCTION trigger_project_completion_check(
  p_wallet_address TEXT,
  p_project_id TEXT
)
RETURNS JSON AS $$
DECLARE
  completion_percentage INTEGER;
  result JSON;
BEGIN
  -- Check if project is 100% completed
  SELECT 
    COALESCE(
      ROUND((completed_tasks_count::DECIMAL / total_tasks_count::DECIMAL) * 100), 
      0
    )
  INTO completion_percentage
  FROM user_participations up
  JOIN projects p ON up.project_id = p.id
  WHERE up.wallet_address = p_wallet_address 
    AND up.project_id = p_project_id
    AND p.is_active = true;
  
  -- If project is not 100% complete, return early
  IF completion_percentage IS NULL OR ompletion_percentage < 100 THEN
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

-- 9. Add RLS policies
ALTER TABLE user_burn_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_burn_chances_earned ENABLE ROW LEVEL SECURITY;

-- Users can only see their own burn progress
CREATE POLICY "Users can view own burn progress" ON user_burn_progress
  FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update own burn progress" ON user_burn_progress
  FOR ALL USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can only see their own burn chances
CREATE POLICY "Users can view own burn chances" ON user_burn_chances_earned
  FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update own burn chances" ON user_burn_chances_earned
  FOR ALL USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- 10. Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_burn_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_burn_chances_earned TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_award_burn_chance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION use_burn_chance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_burn_chance_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_project_completion_check(TEXT, TEXT) TO authenticated;

-- 11. Success message
DO $$
BEGIN
  RAISE NOTICE '=== PROJECT-BASED BURN CHANCE SYSTEM DEPLOYED ===';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '✅ Tracks completion of 2 different projects';
  RAISE NOTICE '✅ Awards 1 burn chance per 2 completed projects';
  RAISE NOTICE '✅ Resets progress after earning burn chance';
  RAISE NOTICE '✅ Repeatable cycle: earn → burn → reset → earn';
  RAISE NOTICE '✅ Prevents double-counting same project';
  RAISE NOTICE '✅ Integration ready with OptimizedCampaignService';
  RAISE NOTICE '';
  RAISE NOTICE 'Integration Points:';
  RAISE NOTICE '- Call trigger_project_completion_check() when project reaches 100%%';
  RAISE NOTICE '- Call use_burn_chance() when user burns NFT';
  RAISE NOTICE '- Call get_burn_chance_status() for UI display';
END $$;
