-- Debug why referral achievements are not claimable despite having 2 referrals
-- Check the current state of referral achievements for the user

-- Step 1: Check user's referral stats
SELECT 
    wallet_address,
    total_referrals,
    total_neft_earned,
    referral_code
FROM user_referrals 
WHERE wallet_address = 'social:google:108308658811682407572';

-- Step 2: Check user's achievement progress for referral achievements
SELECT 
    ua.achievement_key,
    ua.current_progress,
    ua.status,
    ua.completed_at,
    ua.claimed_at,
    am.required_count,
    am.neft_reward,
    am.xp_reward,
    am.title
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = 'social:google:108308658811682407572'
  AND am.category = 'referral'
ORDER BY ua.achievement_key;

-- Step 3: Check if achievements_master has referral achievements defined
SELECT 
    achievement_key,
    title,
    description,
    category,
    required_count,
    neft_reward,
    xp_reward
FROM achievements_master 
WHERE category = 'referral'
ORDER BY achievement_key;

-- Step 4: Check if user_achievements records exist for this user
SELECT 
    COUNT(*) as total_achievements,
    COUNT(CASE WHEN category = 'referral' THEN 1 END) as referral_achievements
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
WHERE ua.wallet_address = 'social:google:108308658811682407572';

-- Step 5: Manually trigger achievement update (if needed)
-- SELECT update_achievement_progress(
--   'social:google:108308658811682407572',
--   'first_referral', 
--   2
-- );
