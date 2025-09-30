-- Test automatic referral achievement initialization and progress sync
-- This simulates what should happen automatically when referrals are processed

-- Step 1: Check current state before test
SELECT 'BEFORE TEST - Current referral achievements:' as test_phase;
SELECT 
    ua.achievement_key,
    ua.current_progress,
    ua.status,
    ua.completed_at,
    ua.claimed_at,
    ur.total_referrals as actual_referrals
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
LEFT JOIN user_referrals ur ON ur.wallet_address = ua.wallet_address
WHERE ua.wallet_address = 'social:google:108308658811682407572'
  AND am.category = 'referral'
ORDER BY ua.achievement_key;

-- Step 2: Simulate what updateSocialAchievements should do automatically
-- Initialize achievements (this should be idempotent)
SELECT 'STEP 2 - Initializing achievements:' as test_phase;
SELECT initialize_user_achievements('social:google:108308658811682407572') as init_result;

-- Step 3: Update achievement progress to match actual referral count
SELECT 'STEP 3 - Syncing achievement progress with referral count:' as test_phase;

-- Get current referral count
SELECT total_referrals FROM user_referrals WHERE wallet_address = 'social:google:108308658811682407572';

-- Update first_referral achievement progress
SELECT update_achievement_progress(
    'social:google:108308658811682407572',
    'first_referral',
    (SELECT total_referrals FROM user_referrals WHERE wallet_address = 'social:google:108308658811682407572')
) as first_referral_update;

-- Update referral_champion achievement progress  
SELECT update_achievement_progress(
    'social:google:108308658811682407572',
    'referral_champion',
    (SELECT total_referrals FROM user_referrals WHERE wallet_address = 'social:google:108308658811682407572')
) as referral_champion_update;

-- Step 4: Verify final state
SELECT 'AFTER TEST - Final referral achievements state:' as test_phase;
SELECT 
    ua.achievement_key,
    ua.current_progress,
    ua.status,
    ua.completed_at,
    ua.claimed_at,
    am.required_count,
    am.neft_reward,
    am.xp_reward,
    am.title,
    ur.total_referrals as actual_referrals,
    CASE 
        WHEN ua.status = 'completed' AND ua.claimed_at IS NULL THEN 'READY TO CLAIM'
        WHEN ua.status = 'completed' AND ua.claimed_at IS NOT NULL THEN 'ALREADY CLAIMED'
        WHEN ua.status = 'in_progress' THEN 'IN PROGRESS'
        ELSE 'LOCKED'
    END as claim_status
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
LEFT JOIN user_referrals ur ON ur.wallet_address = ua.wallet_address
WHERE ua.wallet_address = 'social:google:108308658811682407572'
  AND am.category = 'referral'
ORDER BY ua.achievement_key;
