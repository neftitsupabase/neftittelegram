-- Fix Automatic Progressive Achievement Unlocking
-- This ensures that when base achievements complete, higher-tier achievements automatically unlock

-- Drop and recreate the function with progressive unlocking logic
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
    required_count_value INTEGER;
BEGIN
    -- Get current achievement record with required count from achievement definitions
    SELECT ua.current_progress, ua.status,
           CASE ua.achievement_key
               WHEN 'first_quest' THEN 1
               WHEN 'quest_master' THEN 10
               WHEN 'quest_legend' THEN 50
               WHEN 'first_burn' THEN 1
               WHEN 'burn_enthusiast' THEN 25
               WHEN 'burn_master' THEN 100
               WHEN 'first_stake' THEN 1
               WHEN 'staking_pro' THEN 30
               WHEN 'campaign_participant' THEN 1
               WHEN 'campaign_champion' THEN 5
               WHEN 'daily_visitor' THEN 7
               WHEN 'dedicated_user' THEN 30
               WHEN 'social_starter' THEN 1
               WHEN 'first_referral' THEN 1
               WHEN 'referral_champion' THEN 10
               ELSE 1
           END as required_count
    INTO current_record
    FROM user_achievements ua
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

    -- Store values
    old_status_value := current_record.status;
    required_count_value := current_record.required_count;
    
    -- Calculate new progress
    new_progress_value := current_record.current_progress + progress_increment;
    
    -- Determine new status based on progress
    IF new_progress_value >= required_count_value THEN
        -- Achievement completed
        new_status_value := 'completed'::achievement_status;
        achievement_completed_flag := TRUE;
        new_progress_value := required_count_value; -- Cap at required count
    ELSIF new_progress_value > 0 THEN
        -- Achievement in progress
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

    -- PROGRESSIVE UNLOCKING LOGIC
    -- When certain achievements complete, automatically unlock related achievements
    IF achievement_completed_flag THEN
        CASE achievement_key_param
            WHEN 'first_quest' THEN
                -- Unlock quest_master and quest_legend
                UPDATE user_achievements 
                SET status = 'in_progress'::achievement_status, updated_at = NOW()
                WHERE wallet_address = user_wallet 
                AND achievement_key IN ('quest_master', 'quest_legend')
                AND status = 'locked'::achievement_status;
                
            WHEN 'first_burn' THEN
                -- Unlock burn_enthusiast and burn_master
                UPDATE user_achievements 
                SET status = 'in_progress'::achievement_status, updated_at = NOW()
                WHERE wallet_address = user_wallet 
                AND achievement_key IN ('burn_enthusiast', 'burn_master')
                AND status = 'locked'::achievement_status;
                
            WHEN 'first_stake' THEN
                -- Unlock staking_pro
                UPDATE user_achievements 
                SET status = 'in_progress'::achievement_status, updated_at = NOW()
                WHERE wallet_address = user_wallet 
                AND achievement_key = 'staking_pro'
                AND status = 'locked'::achievement_status;
                
            WHEN 'campaign_participant' THEN
                -- Unlock campaign_champion
                UPDATE user_achievements 
                SET status = 'in_progress'::achievement_status, updated_at = NOW()
                WHERE wallet_address = user_wallet 
                AND achievement_key = 'campaign_champion'
                AND status = 'locked'::achievement_status;
                
            WHEN 'daily_visitor' THEN
                -- Unlock dedicated_user
                UPDATE user_achievements 
                SET status = 'in_progress'::achievement_status, updated_at = NOW()
                WHERE wallet_address = user_wallet 
                AND achievement_key = 'dedicated_user'
                AND status = 'locked'::achievement_status;
                
            ELSE
                -- No progressive unlocking for this achievement
                NULL;
        END CASE;
        
        RAISE NOTICE 'Achievement % completed for wallet %, progressive unlocking triggered', 
            achievement_key_param, user_wallet;
    END IF;

    -- Return success result
    RETURN QUERY SELECT 
        TRUE,
        CASE 
            WHEN achievement_completed_flag THEN 'Achievement completed!'
            WHEN old_status_value = 'locked' AND new_status_value = 'in_progress' THEN 'Achievement unlocked!'
            ELSE 'Achievement progress updated successfully'
        END::TEXT,
        achievement_completed_flag,
        new_progress_value,
        required_count_value,
        old_status_value,
        new_status_value;
END;
$$;

-- Test the progressive unlocking functionality with your actual wallet
DO $$
DECLARE
    test_wallet TEXT := '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';
    result RECORD;
BEGIN
    RAISE NOTICE 'Testing automatic progressive achievement unlocking...';
    
    -- Complete first_quest (should auto-unlock quest_master and quest_legend)
    SELECT * INTO result FROM update_achievement_progress(test_wallet, 'first_quest', 1);
    RAISE NOTICE 'First Quest: % → % (completed: %)', result.old_status, result.new_status, result.achievement_completed;
    
    -- Check if quest_master and quest_legend were auto-unlocked
    PERFORM 1 FROM user_achievements 
    WHERE wallet_address = test_wallet 
    AND achievement_key IN ('quest_master', 'quest_legend')
    AND status = 'in_progress';
    
    IF FOUND THEN
        RAISE NOTICE '✅ Progressive unlocking working - quest_master and quest_legend auto-unlocked!';
    ELSE
        RAISE NOTICE '❌ Progressive unlocking failed - achievements still locked';
    END IF;
    
    RAISE NOTICE 'Automatic progressive achievement test completed!';
END;
$$;
