-- ============================================================================
-- DEBUG ACHIEVEMENTS EMPTY ARRAY ISSUE
-- Tests to identify why get_user_achievements returns empty array
-- ============================================================================

-- Test 1: Check if achievements_master table has data
SELECT 'TESTING achievements_master table:' as test;
SELECT 
  achievement_key, 
  title, 
  category, 
  is_active,
  required_count,
  neft_reward,
  xp_reward
FROM achievements_master 
WHERE is_active = TRUE
LIMIT 5;

-- Test 2: Check if user_achievements table exists and has data
SELECT 'TESTING user_achievements table:' as test;
SELECT 
  wallet_address,
  achievement_key,
  status,
  current_progress,
  completed_at,
  claimed_at
FROM user_achievements 
LIMIT 5;

-- Test 3: Test get_user_achievements function directly
SELECT 'TESTING get_user_achievements function:' as test;
SELECT get_user_achievements('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', NULL);

-- Test 4: Test LEFT JOIN query manually
SELECT 'TESTING LEFT JOIN query manually:' as test;
SELECT 
  am.achievement_key,
  am.title,
  am.category,
  COALESCE(ua.status, 'locked') as status,
  COALESCE(ua.current_progress, 0) as current_progress,
  am.required_count,
  am.neft_reward,
  am.xp_reward
FROM achievements_master am
LEFT JOIN user_achievements ua ON ua.achievement_key = am.achievement_key 
  AND ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
WHERE am.is_active = TRUE
LIMIT 5;

-- Test 5: Check if function exists
SELECT 'CHECKING if get_user_achievements function exists:' as test;
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'get_user_achievements'
  AND routine_schema = 'public';

-- Test 6: Check function permissions
SELECT 'CHECKING function permissions:' as test;
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges 
WHERE routine_name = 'get_user_achievements';

SELECT 'DEBUG TESTS COMPLETE!' as status;
