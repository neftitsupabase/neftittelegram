-- Fix missing referral achievement records for user with 2 referrals
-- The debug shows user has 2 total achievements but 0 referral achievements

-- Step 1: Initialize referral achievements for the user if missing
INSERT INTO user_achievements (wallet_address, achievement_key, current_progress, status)
SELECT 
    'social:google:108308658811682407572',
    am.achievement_key,
    0,
    'locked'
FROM achievements_master am
WHERE am.category = 'referral'
  AND NOT EXISTS (
    SELECT 1 FROM user_achievements ua 
    WHERE ua.wallet_address = 'social:google:108308658811682407572' 
      AND ua.achievement_key = am.achievement_key
  );

-- Step 2: Update first_referral achievement progress to match actual referral count
UPDATE user_achievements 
SET 
    current_progress = (
        SELECT total_referrals 
        FROM user_referrals 
        WHERE wallet_address = 'social:google:108308658811682407572'
    ),
    status = CASE 
        WHEN (
            SELECT total_referrals 
            FROM user_referrals 
            WHERE wallet_address = 'social:google:108308658811682407572'
        ) >= 1 THEN 'completed'
        ELSE 'locked'
    END,
    completed_at = CASE 
        WHEN (
            SELECT total_referrals 
            FROM user_referrals 
            WHERE wallet_address = 'social:google:108308658811682407572'
        ) >= 1 THEN NOW()
        ELSE NULL
    END
WHERE wallet_address = 'social:google:108308658811682407572'
  AND achievement_key = 'first_referral';

-- Step 3: Update referral_champion achievement progress
UPDATE user_achievements 
SET 
    current_progress = (
        SELECT total_referrals 
        FROM user_referrals 
        WHERE wallet_address = 'social:google:108308658811682407572'
    ),
    status = CASE 
        WHEN (
            SELECT total_referrals 
            FROM user_referrals 
            WHERE wallet_address = 'social:google:108308658811682407572'
        ) >= 10 THEN 'completed'
        WHEN (
            SELECT total_referrals 
            FROM user_referrals 
            WHERE wallet_address = 'social:google:108308658811682407572'
        ) >= 1 THEN 'in_progress'
        ELSE 'locked'
    END,
    completed_at = CASE 
        WHEN (
            SELECT total_referrals 
            FROM user_referrals 
            WHERE wallet_address = 'social:google:108308658811682407572'
        ) >= 10 THEN NOW()
        ELSE NULL
    END
WHERE wallet_address = 'social:google:108308658811682407572'
  AND achievement_key = 'referral_champion';

-- Step 4: Verify the fix
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
    ur.total_referrals as actual_referrals
FROM user_achievements ua
JOIN achievements_master am ON ua.achievement_key = am.achievement_key
LEFT JOIN user_referrals ur ON ur.wallet_address = ua.wallet_address
WHERE ua.wallet_address = 'social:google:108308658811682407572'
  AND am.category = 'referral'
ORDER BY ua.achievement_key;
