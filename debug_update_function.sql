-- ============================================================================
-- DEBUG UPDATE ACHIEVEMENT PROGRESS FUNCTION
-- Check if the function is working and what it returns
-- ============================================================================

-- Test the function directly and see what it returns
SELECT 'Testing update_achievement_progress function...' as test;

SELECT update_achievement_progress(
  '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071',
  'first_stake',
  1
) as function_result;

-- Check if any records were created in user_achievements
SELECT 'Checking user_achievements table after update...' as check;

SELECT 
  achievement_key,
  current_progress,
  status,
  created_at,
  updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
ORDER BY updated_at DESC;

-- Check if user is initialized
SELECT 'Checking if user is initialized...' as init_check;

SELECT initialize_user_achievements('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as init_result;

-- Try update again after initialization
SELECT 'Trying update after initialization...' as retry;

SELECT update_achievement_progress(
  '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071',
  'first_stake',
  1
) as retry_result;

-- Final check
SELECT 'Final check of user_achievements...' as final;

SELECT 
  achievement_key,
  current_progress,
  status,
  updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND achievement_key = 'first_stake';
