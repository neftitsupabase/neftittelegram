-- Analyze burn chance tracking logic for proper project deduction
-- User has 4 completed projects but should only have 2 remaining after using 2 for burn

-- 1. Check current user burn progress
SELECT 
  'Current Burn Progress' as section,
  wallet_address,
  projects_completed_count,
  completed_project_ids,
  last_reset_at,
  updated_at
FROM user_burn_progress 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- 2. Check burn chances earned and used
SELECT 
  'Burn Chances Status' as section,
  wallet_address,
  earned_at,
  used_at,
  project_id,
  CASE WHEN used_at IS NULL THEN 'Available' ELSE 'Used' END as status
FROM user_burn_chances_earned 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
ORDER BY earned_at;

-- 3. Count available vs used burn chances
SELECT 
  'Burn Chances Summary' as section,
  COUNT(*) FILTER (WHERE used_at IS NULL) as available_chances,
  COUNT(*) FILTER (WHERE used_at IS NOT NULL) as used_chances,
  COUNT(*) as total_chances_earned
FROM user_burn_chances_earned
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- 4. Check all completed projects (should be 4)
WITH project_completion_check AS (
  SELECT DISTINCT p.id::TEXT as project_id, p.title as name
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
        WHERE utc.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
          AND pt.project_id = p.id
          AND pt.is_active = true
          AND utc.completed = true
      ) = (
        SELECT COUNT(*) FROM project_tasks pt2
        WHERE pt2.project_id = p.id AND pt2.is_active = true
      )
      OR
      -- Method 2: Check via user_participations - 100% completion required
      EXISTS (
        SELECT 1 FROM user_participations up
        WHERE up.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
          AND up.project_id = p.id
          AND up.completion_percentage = 100
      )
    )
)
SELECT 
  'All Completed Projects' as section,
  COUNT(*) as total_completed_projects,
  array_agg(project_id) as all_completed_project_ids,
  array_agg(name) as all_completed_project_names
FROM project_completion_check;

-- 5. PROBLEM ANALYSIS: The logic should be:
-- - User completes 4 projects total
-- - Every 2 completed projects = 1 burn chance
-- - User should have earned 2 burn chances (4 projects ÷ 2 = 2 chances)
-- - If user used 1 burn chance, they should have 1 remaining
-- - Progress should show: remaining_projects/2 where remaining_projects = total_completed - (used_chances * 2)

-- 6. Proposed fix calculation
WITH burn_analysis AS (
  SELECT 
    -- Total completed projects
    (SELECT COUNT(*) FROM (
      SELECT DISTINCT p.id
      FROM projects p
      WHERE p.is_active = true
        AND (
          (SELECT COUNT(*) FROM project_tasks pt WHERE pt.project_id = p.id AND pt.is_active = true) > 0
          AND
          (SELECT COUNT(*) FROM user_task_completions utc
           JOIN project_tasks pt ON utc.task_id = pt.id
           WHERE utc.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
             AND pt.project_id = p.id AND pt.is_active = true AND utc.completed = true
          ) = (SELECT COUNT(*) FROM project_tasks pt2 WHERE pt2.project_id = p.id AND pt2.is_active = true)
          OR
          EXISTS (SELECT 1 FROM user_participations up
                  WHERE up.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
                    AND up.project_id = p.id AND up.completion_percentage = 100)
        )
    ) completed_projects) as total_completed_projects,
    
    -- Used burn chances
    (SELECT COUNT(*) FROM user_burn_chances_earned 
     WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
       AND used_at IS NOT NULL) as used_burn_chances,
    
    -- Available burn chances
    (SELECT COUNT(*) FROM user_burn_chances_earned 
     WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' 
       AND used_at IS NULL) as available_burn_chances
)
SELECT 
  'Burn Logic Analysis' as section,
  total_completed_projects,
  used_burn_chances,
  available_burn_chances,
  -- Projects "consumed" by used burn chances
  (used_burn_chances * 2) as projects_consumed_by_burns,
  -- Remaining projects available for new burn chances
  (total_completed_projects - (used_burn_chances * 2)) as remaining_projects,
  -- How many new burn chances can be earned from remaining projects
  ((total_completed_projects - (used_burn_chances * 2)) / 2) as potential_new_burn_chances,
  -- What the progress should show (remaining projects mod 2)
  ((total_completed_projects - (used_burn_chances * 2)) % 2) as progress_numerator,
  -- Progress display should be: progress_numerator/2
  CONCAT(((total_completed_projects - (used_burn_chances * 2)) % 2), '/2') as correct_progress_display
FROM burn_analysis;
