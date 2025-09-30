-- ============================================================================
-- DEBUG ACHIEVEMENTS - Check what tables exist and test the function
-- ============================================================================

-- Step 1: Check if our tables exist
SELECT 'Checking if tables exist...' as debug_step;

-- Check achievements_master table
SELECT 
  'achievements_master' as table_name,
  COUNT(*) as row_count
FROM achievements_master
WHERE is_active = true;

-- Check if user_achievement_progress table exists
SELECT 
  'user_achievement_progress' as table_name,
  COUNT(*) as row_count
FROM user_achievement_progress;

-- Step 2: Check if required source tables exist
SELECT 'Checking source tables...' as debug_step;

-- Check if projects table exists (for quest achievements)
SELECT 
  'projects' as table_name,
  COUNT(*) as row_count
FROM projects;

-- Check if campaign_reward_claims exists (for quest achievements)
SELECT 
  'campaign_reward_claims' as table_name,
  COUNT(*) as row_count
FROM campaign_reward_claims;

-- Check if user_streaks exists (for check-in achievements)
SELECT 
  'user_streaks' as table_name,
  COUNT(*) as row_count
FROM user_streaks;

-- Check if user_balances exists (for staking achievements)
SELECT 
  'user_balances' as table_name,
  COUNT(*) as row_count
FROM user_balances;

-- Step 3: Create a simple test function to debug
CREATE OR REPLACE FUNCTION test_achievement_status(test_wallet TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Simple test to see if we can query the achievements
  RETURN 'Function works! Wallet: ' || test_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION test_achievement_status(TEXT) TO authenticated, anon, public;

-- Step 4: Test the function exists
SELECT 'Testing basic function...' as debug_step;
SELECT test_achievement_status('test_wallet') as test_result;

SELECT 'DEBUG COMPLETE - Check results above' as final_message;
