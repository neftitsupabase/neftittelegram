-- ============================================================================
-- DEBUG USER ACHIEVEMENTS TABLE
-- Check if progress is actually being recorded in the database
-- ============================================================================

-- 1. Check if user_achievements table has any records
SELECT 'Checking user_achievements table...' as status;

SELECT COUNT(*) as total_records 
FROM user_achievements;

-- 2. Check records for specific wallet (replace with your actual wallet)
SELECT 'Records for specific wallet:' as info;

SELECT 
  wallet_address,
  achievement_key,
  current_progress,
  status,
  completed_at,
  claimed_at,
  created_at,
  updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'  -- Replace with your wallet
ORDER BY updated_at DESC
LIMIT 10;

-- 3. Check all user_achievements records (last 20)
SELECT 'Recent user_achievements records:' as info;

SELECT 
  wallet_address,
  achievement_key,
  current_progress,
  status,
  completed_at,
  claimed_at,
  updated_at
FROM user_achievements 
ORDER BY updated_at DESC
LIMIT 20;

-- 4. Check if achievements_master table has data
SELECT 'Checking achievements_master table...' as status;

SELECT COUNT(*) as total_achievements 
FROM achievements_master 
WHERE is_active = TRUE;

-- 5. Test update_achievement_progress function directly
SELECT 'Testing update_achievement_progress function...' as test;

SELECT update_achievement_progress(
  '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071',  -- Replace with your wallet
  'first_quest',
  1
) as test_result;

-- 6. Check if the update created a record
SELECT 'Checking if test update created record...' as check;

SELECT 
  achievement_key,
  current_progress,
  status,
  updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'  -- Replace with your wallet
  AND achievement_key = 'first_quest';

-- 7. Check if activity_tracking table exists
SELECT 'Checking if activity_tracking table exists...' as activity_check;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'activity_tracking';

-- Check user_activity_stats table structure and data
SELECT 'Checking user_activity_stats table structure...' as structure_check;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_activities' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check recent records in user_activities
SELECT 'Recent user_activities records:' as activity_data;

SELECT *
FROM user_activities 
ORDER BY created_at DESC
LIMIT 10;

-- Check for your wallet in user_activities
SELECT 'Records for your wallet in user_activities:' as wallet_activity;

SELECT *
FROM user_activities 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'  -- Replace with your wallet
ORDER BY created_at DESC;
