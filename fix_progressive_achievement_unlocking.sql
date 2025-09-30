-- Fix Progressive Achievement Unlocking
-- This fixes the issue where achievements don't transition from locked to in_progress
-- when they should be unlocked after completing prerequisite achievements

-- Drop existing function first
DROP FUNCTION IF EXISTS update_achievement_progress(text,text,integer);

CREATE OR REPLACE FUNCTION update_achievement_progress(
    user_wallet TEXT,
    achievement_key_param TEXT,
    progress_increment INTEGER DEFAULT 1
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    achievement_completed BOOLEAN,
    new_progress INTEGER,
    required_count INTEGER,
    old_status achievement_status,
    new_status achievement_status
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_record RECORD;
    new_progress_value INTEGER;
    achievement_completed_flag BOOLEAN := FALSE;
    old_status_value achievement_status;
    new_status_value achievement_status;
BEGIN
    -- Get current achievement record
    SELECT ua.current_progress, ua.status, sa.required_count
    INTO current_record
    FROM user_achievements ua
    JOIN sample_achievements sa ON ua.achievement_key = sa.achievement_key
    WHERE ua.wallet_address = user_wallet 
    AND ua.achievement_key = achievement_key_param;

    -- If no record found, return error
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE,
            'Achievement not found for user'::TEXT,
            FALSE,
            0,
            0,
            'locked'::achievement_status,
            'locked'::achievement_status;
        RETURN;
    END IF;

    -- Store old status
    old_status_value := current_record.status;
    
    -- Calculate new progress
    new_progress_value := current_record.current_progress + progress_increment;
    
    -- Determine new status based on progress and current status
    IF new_progress_value >= current_record.required_count THEN
        -- Achievement completed
        new_status_value := 'completed'::achievement_status;
        achievement_completed_flag := TRUE;
        new_progress_value := current_record.required_count; -- Cap at required count
    ELSIF new_progress_value > 0 OR (progress_increment = 0 AND current_record.status = 'locked') THEN
        -- Achievement in progress (either has progress OR being unlocked with 0 increment)
        new_status_value := 'in_progress'::achievement_status;
    ELSE
        -- Keep current status
        new_status_value := current_record.status;
    END IF;

    -- Update the achievement record
    UPDATE user_achievements 
    SET 
        current_progress = new_progress_value,
        status = new_status_value,
        updated_at = NOW()
    WHERE wallet_address = user_wallet 
    AND achievement_key = achievement_key_param;

    -- Log the status transition
    RAISE NOTICE 'Achievement % for wallet %: % → % (progress: %/%)', 
        achievement_key_param, 
        user_wallet, 
        old_status_value, 
        new_status_value,
        new_progress_value,
        current_record.required_count;

    -- Return success result
    RETURN QUERY SELECT 
        TRUE,
        CASE 
            WHEN achievement_completed_flag THEN 'Achievement completed!'
            WHEN old_status_value = 'locked' AND new_status_value = 'in_progress' THEN 'Achievement unlocked and in progress!'
            ELSE 'Achievement progress updated successfully'
        END::TEXT,
        achievement_completed_flag,
        new_progress_value,
        current_record.required_count,
        old_status_value,
        new_status_value;
END;
$$;

-- Test the fix by unlocking quest_master and quest_legend for the user
DO $$
DECLARE
    test_wallet TEXT := '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';
    result RECORD;
BEGIN
    RAISE NOTICE 'Testing progressive achievement unlocking...';
    
    -- Unlock quest_master (should go from locked to in_progress with 0 progress)
    SELECT * INTO result FROM update_achievement_progress(test_wallet, 'quest_master', 0);
    RAISE NOTICE 'Quest Master: % - %', result.old_status, result.new_status;
    
    -- Unlock quest_legend (should go from locked to in_progress with 0 progress)  
    SELECT * INTO result FROM update_achievement_progress(test_wallet, 'quest_legend', 0);
    RAISE NOTICE 'Quest Legend: % - %', result.old_status, result.new_status;
    
    RAISE NOTICE 'Progressive achievement unlocking test completed!';
END;
$$;
