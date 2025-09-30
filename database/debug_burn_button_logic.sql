-- Debug Burn Button Logic Issue
-- Test what burnChanceData is actually returning

-- 1. Test get_burn_chance_status with your actual wallet
SELECT 'Testing get_burn_chance_status with wallet...' as debug_step;

-- Replace with your actual wallet address
SELECT get_burn_chance_status('your_wallet_address') as status_result;

-- 2. Check what the function returns in detail
SELECT 'Parsing JSON response...' as debug_step;

-- This will show the individual fields
WITH status_data AS (
  SELECT get_burn_chance_status('your_wallet_address') as status_json
)
SELECT 
  status_json->>'current_progress' as current_progress,
  status_json->>'projects_required' as projects_required,
  status_json->>'available_burn_chances' as available_burn_chances,
  status_json->>'used_burn_chances' as used_burn_chances,
  status_json->>'progress_percentage' as progress_percentage
FROM status_data;

-- 3. Check if burn chances were actually awarded
SELECT 'Checking user_burn_chances_earned table...' as debug_step;
SELECT 
  wallet_address,
  earned_at,
  used_at,
  projects_completed_for_this_chance
FROM user_burn_chances_earned 
ORDER BY earned_at DESC
LIMIT 5;

-- 4. Manual check - should user have burn chances?
SELECT 'Manual calculation - should user have burn chances?' as debug_step;
SELECT 
  wallet_address,
  COUNT(DISTINCT project_id) as completed_projects,
  CASE 
    WHEN COUNT(DISTINCT project_id) >= 2 THEN 'YES - Should have burn chance'
    ELSE 'NO - Need more projects'
  END as should_have_burn_chance
FROM user_participations 
WHERE completion_percentage = 100
GROUP BY wallet_address
ORDER BY completed_projects DESC;
