-- Test Unified Completion Tracking Logic
-- This script tests if the fix will actually work with real data

-- 1. Test function to check current completion data
CREATE OR REPLACE FUNCTION test_completion_data(
  p_wallet_address TEXT,
  p_project_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  task_completions_count INTEGER;
  participation_records INTEGER;
  project_record RECORD;
BEGIN
  -- If no specific project, test with any active project
  IF p_project_id IS NULL THEN
    SELECT id::TEXT INTO p_project_id 
    FROM projects 
    WHERE is_active = true 
    LIMIT 1;
  END IF;

  -- Check user_task_completions data
  SELECT COUNT(*) INTO task_completions_count
  FROM user_task_completions utc
  WHERE utc.wallet_address = p_wallet_address 
    AND utc.project_id = p_project_id::UUID
    AND utc.completed = true;

  -- Check user_participations data  
  SELECT COUNT(*) INTO participation_records
  FROM user_participations up
  WHERE up.wallet_address = p_wallet_address 
    AND up.project_id = p_project_id::UUID;

  -- Get project info
  SELECT title, id INTO project_record
  FROM projects 
  WHERE id = p_project_id::UUID;

  result := json_build_object(
    'wallet_address', p_wallet_address,
    'project_id', p_project_id,
    'project_title', project_record.title,
    'task_completions_count', task_completions_count,
    'participation_records', participation_records,
    'has_task_completions', task_completions_count > 0,
    'has_participation', participation_records > 0,
    'data_source_available', CASE 
      WHEN task_completions_count > 0 THEN 'user_task_completions'
      WHEN participation_records > 0 THEN 'user_participations'
      ELSE 'none'
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Test the unified completion logic
CREATE OR REPLACE FUNCTION test_unified_logic(
  p_wallet_address TEXT
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  completed_projects TEXT[] := ARRAY[]::TEXT[];
  project_record RECORD;
  method_1_count INTEGER := 0;
  method_2_count INTEGER := 0;
BEGIN
  -- Test Method 1: user_task_completions approach
  FOR project_record IN
    SELECT DISTINCT p.id::TEXT as project_id, p.title
    FROM projects p
    WHERE p.is_active = true
      AND EXISTS (
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
  LOOP
    completed_projects := array_append(completed_projects, project_record.project_id);
    method_1_count := method_1_count + 1;
    RAISE NOTICE '✅ Method 1 found completed project: % (%)', project_record.project_id, project_record.title;
  END LOOP;

  -- Test Method 2: user_participations approach
  FOR project_record IN
    SELECT DISTINCT p.id::TEXT as project_id, p.title
    FROM projects p
    WHERE p.is_active = true
      AND EXISTS (
        SELECT 1 FROM user_participations up
        WHERE up.wallet_address = p_wallet_address
          AND up.project_id = p.id
          AND up.completion_percentage = 100
      )
  LOOP
    IF NOT (project_record.project_id = ANY(completed_projects)) THEN
      completed_projects := array_append(completed_projects, project_record.project_id);
    END IF;
    method_2_count := method_2_count + 1;
    RAISE NOTICE '✅ Method 2 found completed project: % (%)', project_record.project_id, project_record.title;
  END LOOP;

  result := json_build_object(
    'wallet_address', p_wallet_address,
    'method_1_projects', method_1_count,
    'method_2_projects', method_2_count,
    'total_unique_projects', array_length(completed_projects, 1),
    'completed_project_ids', completed_projects,
    'unified_tracking_works', array_length(completed_projects, 1) > 0,
    'primary_method', CASE 
      WHEN method_1_count > 0 THEN 'user_task_completions'
      WHEN method_2_count > 0 THEN 'user_participations'
      ELSE 'none'
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Test with sample wallet addresses
DO $$
DECLARE
  test_wallets TEXT[] := ARRAY[
    'your_wallet_address_here',  -- Replace with actual wallet
    'test_wallet_1',
    'test_wallet_2'
  ];
  wallet TEXT;
  test_result JSON;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TESTING UNIFIED COMPLETION TRACKING';
  RAISE NOTICE '';
  
  FOREACH wallet IN ARRAY test_wallets
  LOOP
    RAISE NOTICE '--- Testing wallet: % ---', wallet;
    
    -- Test completion data availability
    SELECT test_completion_data(wallet) INTO test_result;
    RAISE NOTICE 'Data check: %', test_result;
    
    -- Test unified logic
    SELECT test_unified_logic(wallet) INTO test_result;
    RAISE NOTICE 'Unified logic: %', test_result;
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '🔍 Check the logs above to see if unified tracking will work';
  RAISE NOTICE 'If you see completed projects, the fix should work!';
END $$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION test_completion_data(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION test_unified_logic(TEXT) TO authenticated;
