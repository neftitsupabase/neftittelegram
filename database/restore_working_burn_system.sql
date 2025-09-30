-- RESTORE WORKING BURN SYSTEM
-- This will restore your original working burn chance system
-- Run this to undo the mess and get back to working state

-- 1. Drop the problematic functions and tables that were added
DO $$
BEGIN
  RAISE NOTICE 'Restoring original working burn chance system...';
  
  -- Drop the new problematic functions
  DROP FUNCTION IF EXISTS trigger_project_completion_check(TEXT, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS check_and_award_burn_chance(TEXT, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS get_burn_chance_status(TEXT) CASCADE;
  DROP FUNCTION IF EXISTS use_burn_chance(TEXT) CASCADE;
  DROP FUNCTION IF EXISTS award_missing_burn_chances() CASCADE;
  DROP FUNCTION IF EXISTS award_burn_chance_to_user(TEXT) CASCADE;
  DROP FUNCTION IF EXISTS update_burn_progress_updated_at() CASCADE;
  
  -- Drop the problematic tables
  DROP TABLE IF EXISTS user_burn_progress CASCADE;
  DROP TABLE IF EXISTS user_burn_chances_earned CASCADE;
  
  RAISE NOTICE 'Cleaned up problematic burn chance objects';
END $$;

-- 2. Check what's left in your database
SELECT 'Remaining burn-related functions:' as info;
SELECT proname as function_name
FROM pg_proc 
WHERE proname ILIKE '%burn%'
ORDER BY proname;

SELECT 'Remaining burn-related tables:' as info;
SELECT tablename as table_name
FROM pg_tables 
WHERE tablename ILIKE '%burn%'
ORDER BY tablename;

-- 3. Check your complete_project_task function status
SELECT 
  CASE 
    WHEN prosrc LIKE '%trigger_project_completion_check%' THEN 
      '❌ complete_project_task still has burn chance integration - needs fixing'
    ELSE 
      '✅ complete_project_task is clean'
  END as status
FROM pg_proc 
WHERE proname = 'complete_project_task';

-- 4. Restore original complete_project_task if it was modified
-- This will restore the original function without burn chance integration
CREATE OR REPLACE FUNCTION complete_project_task(
  p_wallet_address TEXT,
  p_project_id UUID,
  p_task_id UUID
)
RETURNS JSONB AS $$
DECLARE
  task_exists BOOLEAN;
  project_exists BOOLEAN;
  already_completed BOOLEAN;
  total_tasks INTEGER;
  completed_tasks INTEGER;
  completion_percentage DECIMAL;
  result JSONB;
BEGIN
  -- Validate project exists and is active
  SELECT EXISTS(
    SELECT 1 FROM projects 
    WHERE id = p_project_id AND is_active = true
  ) INTO project_exists;
  
  IF NOT project_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Project not found or inactive'
    );
  END IF;

  -- Validate task exists and belongs to project
  SELECT EXISTS(
    SELECT 1 FROM project_tasks 
    WHERE id = p_task_id AND project_id = p_project_id
  ) INTO task_exists;
  
  IF NOT task_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task not found or does not belong to project'
    );
  END IF;

  -- Check if already completed
  SELECT EXISTS(
    SELECT 1 FROM user_task_completions 
    WHERE wallet_address = p_wallet_address 
      AND task_id = p_task_id
  ) INTO already_completed;
  
  IF already_completed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task already completed'
    );
  END IF;

  -- Mark task as completed
  INSERT INTO user_task_completions (wallet_address, task_id, project_id, completed_at)
  VALUES (p_wallet_address, p_task_id, p_project_id, NOW());

  -- Calculate completion percentage
  SELECT COUNT(*) INTO total_tasks
  FROM project_tasks 
  WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO completed_tasks
  FROM user_task_completions utc
  JOIN project_tasks pt ON utc.task_id = pt.id
  WHERE utc.wallet_address = p_wallet_address 
    AND pt.project_id = p_project_id;

  completion_percentage := CASE 
    WHEN total_tasks > 0 THEN (completed_tasks::DECIMAL / total_tasks::DECIMAL) * 100
    ELSE 0
  END;

  -- Update or insert user participation
  INSERT INTO user_participations (
    wallet_address, 
    project_id, 
    completed_tasks_count, 
    total_tasks_count,
    completion_percentage,
    updated_at
  )
  VALUES (
    p_wallet_address, 
    p_project_id, 
    completed_tasks, 
    total_tasks,
    completion_percentage,
    NOW()
  )
  ON CONFLICT (wallet_address, project_id) 
  DO UPDATE SET
    completed_tasks_count = completed_tasks,
    total_tasks_count = total_tasks,
    completion_percentage = completion_percentage,
    updated_at = NOW();

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'task_completed', true,
    'completion_percentage', completion_percentage,
    'completed_tasks', completed_tasks,
    'total_tasks', total_tasks,
    'project_completed', completion_percentage >= 100
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 SYSTEM RESTORATION COMPLETE';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Removed problematic burn chance functions and tables';
  RAISE NOTICE '✅ Restored original complete_project_task function';
  RAISE NOTICE '✅ Your system is back to working state';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Your original burn chance system should now work';
  RAISE NOTICE '2. Test task completion to ensure it works normally';
  RAISE NOTICE '3. If you want burn chances, we can add them properly later';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Do NOT deploy any more burn chance SQL files until we fix this properly';
END $$;
