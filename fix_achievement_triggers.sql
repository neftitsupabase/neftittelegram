-- ============================================================================
-- FIX ACHIEVEMENT TRIGGERS - MANUALLY UPDATE BASED ON EXISTING ACTIVITIES
-- Since services aren't calling achievement updates, manually trigger them
-- ============================================================================

-- Replace this wallet with your actual wallet address
\set wallet_address '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'

-- 1. Update STAKING achievements (you have 10+ stake activities)
SELECT 'Updating staking achievements...' as status;

SELECT update_achievement_progress(
  :'wallet_address',
  'first_stake',
  10  -- You have way more than 1 stake, so this will complete it
) as first_stake_result;

SELECT update_achievement_progress(
  :'wallet_address',
  'staking_pro', 
  10  -- You have 10+ stakes, this should complete staking_pro too
) as staking_pro_result;

-- 2. Update BURN achievements (you have 6 burn activities)
SELECT 'Updating burn achievements...' as status;

SELECT update_achievement_progress(
  :'wallet_address',
  'first_burn',
  6  -- You have 6 burns, way more than needed for first burn
) as first_burn_result;

-- 3. Update CAMPAIGN achievements (you have 2 campaign activities)
SELECT 'Updating campaign achievements...' as status;

SELECT update_achievement_progress(
  :'wallet_address',
  'first_quest',
  2  -- You have campaign activities
) as first_quest_result;

-- Note: campaign_participant already exists in your activities

-- 4. Check results - get updated achievements
SELECT 'Getting updated achievements...' as final_check;

SELECT get_user_achievements(:'wallet_address', NULL) as updated_achievements;

-- 5. Count achievements by status
SELECT 'Achievement status summary:' as summary;

WITH achievement_data AS (
  SELECT json_array_elements(get_user_achievements(:'wallet_address', NULL)) as achievement
)
SELECT 
  achievement->>'status' as status,
  COUNT(*) as count
FROM achievement_data
GROUP BY achievement->>'status'
ORDER BY 
  CASE achievement->>'status'
    WHEN 'completed' THEN 1
    WHEN 'in_progress' THEN 2  
    WHEN 'locked' THEN 3
  END;
