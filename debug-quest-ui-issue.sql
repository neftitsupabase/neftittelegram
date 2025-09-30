-- Debug script to check quest achievement UI vs database mismatch
-- Run this in Supabase SQL Editor

-- 1. Check current quest achievement status in database
SELECT 
    achievement_key,
    status,
    current_progress,
    target_value,
    created_at,
    updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
    AND achievement_key IN ('first_quest', 'quest_master', 'quest_legend')
ORDER BY achievement_key;

-- 2. Check what the RPC function returns (what UI uses)
SELECT * FROM get_user_achievements('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', 'quest');

-- 3. Check achievements master data
SELECT 
    achievement_key,
    title,
    description,
    target_value,
    is_active
FROM achievements_master 
WHERE achievement_key IN ('first_quest', 'quest_master', 'quest_legend')
ORDER BY achievement_key;

-- 4. Force refresh quest achievements to ensure progressive unlocking
SELECT update_achievement_progress(
    '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071',
    'first_quest',
    0  -- No increment, just trigger progressive unlocking
);

-- 5. Check status after refresh
SELECT 
    achievement_key,
    status,
    current_progress,
    updated_at
FROM user_achievements 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071'
    AND achievement_key IN ('first_quest', 'quest_master', 'quest_legend')
ORDER BY achievement_key;
