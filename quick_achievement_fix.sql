-- ============================================================================
-- QUICK ACHIEVEMENT FIX - Run this to manually trigger your achievements
-- ============================================================================

-- Update staking achievements (you have 10+ stakes)
SELECT update_achievement_progress(
  '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071',
  'first_stake',
  1
) as first_stake_update;

SELECT update_achievement_progress(
  '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', 
  'staking_pro',
  10
) as staking_pro_update;

-- Update burn achievements (you have 6 burns)
SELECT update_achievement_progress(
  '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071',
  'first_burn', 
  1
) as first_burn_update;

-- Update quest achievements (you have campaign activities)
SELECT update_achievement_progress(
  '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071',
  'first_quest',
  1
) as first_quest_update;

-- Check results
SELECT get_user_achievements('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', NULL) as final_result;
