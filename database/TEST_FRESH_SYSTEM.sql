-- ============================================================================
-- TEST FRESH DAILY CLAIMS SYSTEM
-- Quick test to verify functions are working
-- ============================================================================

-- Test 1: Check if functions exist
SELECT 'Testing function existence...' as test;

-- Test calculate_progressive_daily_reward
SELECT 'Day 1 reward:' as test, * FROM calculate_progressive_daily_reward(1);
SELECT 'Day 7 reward:' as test, * FROM calculate_progressive_daily_reward(7);
SELECT 'Day 8 reward (should be Day 1):' as test, * FROM calculate_progressive_daily_reward(8);

-- Test 2: Check dashboard for your wallet (replace with actual wallet)
SELECT 'Dashboard test:' as test;
SELECT * FROM get_daily_claim_dashboard('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071');

-- Test 3: Check if user_streaks table has data
SELECT 'User streaks data:' as test;
SELECT * FROM user_streaks WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Test 4: Check if daily_claims table has data  
SELECT 'Daily claims data:' as test;
SELECT * FROM daily_claims WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071' ORDER BY claimed_at DESC LIMIT 5;

-- Success message
SELECT 'Fresh system test completed!' as result;
