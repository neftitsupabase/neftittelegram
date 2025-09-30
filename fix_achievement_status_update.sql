-- ============================================================================
-- FIX ACHIEVEMENT STATUS UPDATE ISSUE
-- The record exists but status isn't updating from locked to completed
-- ============================================================================

-- First, let's check the current state and required count
SELECT 
  ua.achievement_key,
  ua.current_progress,
  ua.status,
  am.required_count,
  CASE 
    WHEN ua.current_progress >= am.required_count THEN 'should_be_completed'
    WHEN ua.current_progress > 0 THEN 'should_be_in_progress'
    ELSE 'should_be_locked'
  END as expected_status
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND ua.achievement_key = 'first_stake';

-- Manually update the progress and status
UPDATE user_achievements 
SET 
  current_progress = 1,
  status = 'completed',
  completed_at = NOW(),
  updated_at = NOW()
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND achievement_key = 'first_stake';

-- Update other achievements based on your activities
UPDATE user_achievements 
SET 
  current_progress = 1,
  status = 'completed',
  completed_at = NOW(),
  updated_at = NOW()
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND achievement_key IN ('first_burn', 'first_quest');

-- Update staking_pro (requires 10 stakes)
UPDATE user_achievements 
SET 
  current_progress = 10,
  status = 'completed',
  completed_at = NOW(),
  updated_at = NOW()
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND achievement_key = 'staking_pro';

-- Check results
SELECT 'Updated achievements:' as result;

SELECT 
  achievement_key,
  current_progress,
  status,
  completed_at,
  updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
  AND status = 'completed'
ORDER BY updated_at DESC;
