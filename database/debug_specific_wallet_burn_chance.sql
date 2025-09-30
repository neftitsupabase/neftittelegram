-- Debug Burn Chance System for Specific Wallet
-- Fixed PostgreSQL syntax (removed \set command)

DO $$
DECLARE
  wallet_address TEXT := '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';  -- Your wallet address
BEGIN
  RAISE NOTICE '=== DEBUGGING BURN CHANCE FOR WALLET: % ===', wallet_address;
END $$;

-- Check task completions for your wallet
SELECT 'Your Task Completions:' as info;
SELECT 
  utc.wallet_address,
  pt.project_id,
  p.title as project_title,
  COUNT(*) as completed_tasks,
  (SELECT COUNT(*) FROM project_tasks WHERE project_id = pt.project_id AND is_active = true) as total_tasks,
  CASE 
    WHEN COUNT(*) = (SELECT COUNT(*) FROM project_tasks WHERE project_id = pt.project_id AND is_active = true) 
    THEN '✅ PROJECT COMPLETE' 
    ELSE '❌ INCOMPLETE' 
  END as status
FROM user_task_completions utc
JOIN project_tasks pt ON utc.task_id = pt.id
JOIN projects p ON pt.project_id = p.id
WHERE utc.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND utc.completed = true
  AND p.is_active = true
GROUP BY utc.wallet_address, pt.project_id, p.title
ORDER BY completed_tasks DESC;

-- Check burn progress table
SELECT 'Your Burn Progress:' as info;
SELECT 
  wallet_address,
  projects_completed_count,
  projects_required,
  completed_project_ids,
  last_reset_at,
  created_at,
  updated_at
FROM user_burn_progress 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Check burn chances earned
SELECT 'Your Burn Chances:' as info;
SELECT 
  wallet_address,
  earned_at,
  used_at,
  projects_completed_for_this_chance,
  CASE WHEN used_at IS NULL THEN '✅ AVAILABLE' ELSE '❌ USED' END as status
FROM user_burn_chances_earned 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
ORDER BY earned_at DESC;

-- Test burn chance status function
DO $$
DECLARE
  test_result JSON;
  wallet_addr TEXT := '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';  -- Your wallet
BEGIN
  RAISE NOTICE '=== TESTING BURN CHANCE STATUS ===';
  
  SELECT get_burn_chance_status(wallet_addr) INTO test_result;
  
  RAISE NOTICE 'Current Progress: %', test_result->>'current_progress';
  RAISE NOTICE 'Projects Required: %', test_result->>'projects_required';
  RAISE NOTICE 'Available Burn Chances: %', test_result->>'available_burn_chances';
  RAISE NOTICE 'Progress Percentage: %', test_result->>'progress_percentage';
  RAISE NOTICE 'Completed Project IDs: %', test_result->>'completed_project_ids';
  RAISE NOTICE 'Last Reset: %', test_result->>'last_reset_at';
END $$;

-- Manual project completion check
DO $$
DECLARE
  test_result JSON;
  wallet_addr TEXT := '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';  -- Your wallet
  project_ids TEXT[];
  project_id TEXT;
BEGIN
  RAISE NOTICE '=== MANUAL PROJECT COMPLETION CHECK ===';
  
  -- Get all completed project IDs (fixed column ambiguity)
  SELECT ARRAY_AGG(DISTINCT pt.project_id::TEXT) INTO project_ids
  FROM user_task_completions utc
  JOIN project_tasks pt ON utc.task_id = pt.id
  JOIN projects p ON pt.project_id = p.id
  WHERE utc.wallet_address = wallet_addr
    AND utc.completed = true
    AND p.is_active = true
  GROUP BY pt.project_id
  HAVING COUNT(*) = (
    SELECT COUNT(*) FROM project_tasks pt2
    WHERE pt2.project_id = pt.project_id AND pt2.is_active = true
  );
  
  IF project_ids IS NOT NULL THEN
    RAISE NOTICE 'Found % completed projects: %', array_length(project_ids, 1), project_ids;
    
    -- Test each completed project
    FOREACH project_id IN ARRAY project_ids
    LOOP
      RAISE NOTICE 'Testing project: %', project_id;
      SELECT trigger_project_completion_check(wallet_addr, project_id) INTO test_result;
      RAISE NOTICE 'Result: %', test_result;
    END LOOP;
  ELSE
    RAISE NOTICE 'No fully completed projects found!';
    RAISE NOTICE 'This means either:';
    RAISE NOTICE '1. You have not completed all tasks in any project';
    RAISE NOTICE '2. Projects are not marked as active';
    RAISE NOTICE '3. Task completion data is not in user_task_completions table';
  END IF;
END $$;
