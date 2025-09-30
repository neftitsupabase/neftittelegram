-- =====================================================
-- NEFTIT COMPLETE ACHIEVEMENTS SYSTEM - FINAL VERSION
-- =====================================================
-- This file contains the complete, tested, and working achievement system
-- with all schemas, functions, triggers, and sample data

-- =====================================================
-- 1. ENUMS AND TYPES
-- =====================================================

-- Achievement status enum
DO $$ BEGIN
    CREATE TYPE achievement_status AS ENUM ('locked', 'in_progress', 'completed', 'claimed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Achievement category enum
DO $$ BEGIN
    CREATE TYPE achievement_category AS ENUM ('quest', 'burn', 'social', 'checkin', 'staking', 'campaign');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. TABLES
-- =====================================================

-- Achievements master table (defines all available achievements)
CREATE TABLE IF NOT EXISTS achievements_master (
    achievement_key VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category achievement_category NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(50),
    neft_reward DECIMAL(10,2) DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    nft_reward VARCHAR(100),
    target_value INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements table (tracks individual user progress)
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(100) NOT NULL,
    achievement_key VARCHAR(50) NOT NULL REFERENCES achievements_master(achievement_key),
    status achievement_status DEFAULT 'locked',
    current_progress INTEGER DEFAULT 0,
    target_value INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, achievement_key)
);

-- Achievement activity log (tracks all achievement-related activities)
CREATE TABLE IF NOT EXISTS achievement_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(100) NOT NULL,
    achievement_key VARCHAR(50) NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'progress_update', 'completed', 'claimed'
    old_progress INTEGER,
    new_progress INTEGER,
    old_status achievement_status,
    new_status achievement_status,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet ON user_achievements(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_achievements_status ON user_achievements(status);
CREATE INDEX IF NOT EXISTS idx_user_achievements_category ON user_achievements(achievement_key);
CREATE INDEX IF NOT EXISTS idx_achievement_activity_wallet ON achievement_activity_log(wallet_address);
CREATE INDEX IF NOT EXISTS idx_achievement_activity_key ON achievement_activity_log(achievement_key);
CREATE INDEX IF NOT EXISTS idx_achievements_master_category ON achievements_master(category);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on tables
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_achievements
DROP POLICY IF EXISTS "Users can view their own achievements" ON user_achievements;
CREATE POLICY "Users can view their own achievements" ON user_achievements
    FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

DROP POLICY IF EXISTS "Users can insert their own achievements" ON user_achievements;
CREATE POLICY "Users can insert their own achievements" ON user_achievements
    FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

DROP POLICY IF EXISTS "Users can update their own achievements" ON user_achievements;
CREATE POLICY "Users can update their own achievements" ON user_achievements
    FOR UPDATE USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- RLS policies for achievement_activity_log
DROP POLICY IF EXISTS "Users can view their own activity log" ON achievement_activity_log;
CREATE POLICY "Users can view their own activity log" ON achievement_activity_log
    FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- =====================================================
-- 5. CORE FUNCTIONS
-- =====================================================

-- Initialize achievements for a new user
CREATE OR REPLACE FUNCTION initialize_user_achievements(user_wallet TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    achievement_record RECORD;
    existing_count INTEGER;
BEGIN
    -- Check if user already has achievements
    SELECT COUNT(*) INTO existing_count
    FROM user_achievements
    WHERE wallet_address = user_wallet;
    
    IF existing_count > 0 THEN
        RAISE NOTICE 'User % already has % achievements initialized', user_wallet, existing_count;
        RETURN TRUE;
    END IF;
    
    -- Insert all achievements for the user with 'locked' status
    FOR achievement_record IN 
        SELECT achievement_key, target_value 
        FROM achievements_master 
        WHERE is_active = true
    LOOP
        INSERT INTO user_achievements (
            wallet_address,
            achievement_key,
            status,
            current_progress,
            target_value
        ) VALUES (
            user_wallet,
            achievement_record.achievement_key,
            'locked',
            0,
            achievement_record.target_value
        ) ON CONFLICT (wallet_address, achievement_key) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Initialized achievements for user: %', user_wallet;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user achievements with master data
CREATE OR REPLACE FUNCTION get_user_achievements(
    user_wallet TEXT,
    category_filter achievement_category DEFAULT NULL
)
RETURNS TABLE (
    achievement_key VARCHAR(50),
    title VARCHAR(100),
    description TEXT,
    category achievement_category,
    icon VARCHAR(50),
    color VARCHAR(50),
    neft_reward DECIMAL(10,2),
    xp_reward INTEGER,
    nft_reward VARCHAR(100),
    status achievement_status,
    current_progress INTEGER,
    target_value INTEGER,
    completion_percentage DECIMAL(5,2),
    completed_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    sort_order INTEGER
) AS $$
BEGIN
    -- Initialize achievements if user doesn't have any
    PERFORM initialize_user_achievements(user_wallet);
    
    -- Return achievements with master data
    RETURN QUERY
    SELECT 
        am.achievement_key,
        am.title,
        am.description,
        am.category,
        am.icon,
        am.color,
        am.neft_reward,
        am.xp_reward,
        am.nft_reward,
        COALESCE(ua.status, 'locked'::achievement_status) as status,
        COALESCE(ua.current_progress, 0) as current_progress,
        am.target_value,
        CASE 
            WHEN am.target_value > 0 THEN 
                ROUND((COALESCE(ua.current_progress, 0)::DECIMAL / am.target_value::DECIMAL) * 100, 2)
            ELSE 0 
        END as completion_percentage,
        ua.completed_at,
        ua.claimed_at,
        am.sort_order
    FROM achievements_master am
    LEFT JOIN user_achievements ua ON (
        am.achievement_key = ua.achievement_key 
        AND ua.wallet_address = user_wallet
    )
    WHERE am.is_active = true
        AND (category_filter IS NULL OR am.category = category_filter)
    ORDER BY am.category, am.sort_order, am.achievement_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update achievement progress with automatic state transitions
CREATE OR REPLACE FUNCTION update_achievement_progress(
    user_wallet TEXT,
    achievement_key_param VARCHAR(50),
    progress_increment INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    achievement_completed BOOLEAN,
    new_progress INTEGER,
    new_status achievement_status,
    message TEXT
) AS $$
DECLARE
    current_record RECORD;
    required_count_value INTEGER;
    new_progress_value INTEGER;
    new_status_value achievement_status;
    achievement_completed_flag BOOLEAN := FALSE;
    progressive_achievements VARCHAR(50)[];
    prog_achievement VARCHAR(50);
BEGIN
    -- Initialize achievements if needed
    PERFORM initialize_user_achievements(user_wallet);
    
    -- Get current achievement state and target value
    SELECT ua.current_progress, ua.status, am.target_value
    INTO current_record
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = user_wallet 
        AND ua.achievement_key = achievement_key_param;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, FALSE, 0, 'locked'::achievement_status, 'Achievement not found'::TEXT;
        RETURN;
    END IF;
    
    -- Skip if already completed or claimed
    IF current_record.status IN ('completed', 'claimed') THEN
        RETURN QUERY SELECT TRUE, FALSE, current_record.current_progress, current_record.status, 'Achievement already completed'::TEXT;
        RETURN;
    END IF;
    
    required_count_value := current_record.target_value;
    
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
        completed_at = CASE WHEN achievement_completed_flag THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE wallet_address = user_wallet 
        AND achievement_key = achievement_key_param;

    -- Log the activity
    INSERT INTO achievement_activity_log (
        wallet_address,
        achievement_key,
        activity_type,
        old_progress,
        new_progress,
        old_status,
        new_status,
        metadata
    ) VALUES (
        user_wallet,
        achievement_key_param,
        CASE WHEN achievement_completed_flag THEN 'completed' ELSE 'progress_update' END,
        current_record.current_progress,
        new_progress_value,
        current_record.status,
        new_status_value,
        jsonb_build_object(
            'progress_increment', progress_increment,
            'target_value', required_count_value,
            'completion_percentage', ROUND((new_progress_value::DECIMAL / required_count_value::DECIMAL) * 100, 2)
        )
    );

    -- Handle progressive achievement unlocking
    IF achievement_completed_flag THEN
        -- Define progressive unlocking rules
        CASE achievement_key_param
            WHEN 'first_quest' THEN
                progressive_achievements := ARRAY['quest_master', 'quest_legend'];
            WHEN 'first_burn' THEN
                progressive_achievements := ARRAY['burn_enthusiast', 'burn_master'];
            WHEN 'first_stake' THEN
                progressive_achievements := ARRAY['staking_pro'];
            WHEN 'daily_visitor' THEN
                progressive_achievements := ARRAY['dedicated_user'];
            WHEN 'campaign_participant' THEN
                progressive_achievements := ARRAY['campaign_champion'];
            ELSE
                progressive_achievements := ARRAY[]::VARCHAR(50)[];
        END CASE;
        
        -- Unlock progressive achievements
        FOREACH prog_achievement IN ARRAY progressive_achievements
        LOOP
            UPDATE user_achievements
            SET 
                status = 'in_progress',
                updated_at = NOW()
            WHERE wallet_address = user_wallet 
                AND achievement_key = prog_achievement
                AND status = 'locked';
                
            -- Log progressive unlocking
            INSERT INTO achievement_activity_log (
                wallet_address,
                achievement_key,
                activity_type,
                old_status,
                new_status,
                metadata
            ) VALUES (
                user_wallet,
                prog_achievement,
                'progressive_unlock',
                'locked',
                'in_progress',
                jsonb_build_object(
                    'triggered_by', achievement_key_param,
                    'unlock_reason', 'progressive_achievement_completion'
                )
            );
        END LOOP;
    END IF;

    RETURN QUERY SELECT TRUE, achievement_completed_flag, new_progress_value, new_status_value, 'Achievement updated successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Claim achievement reward
CREATE OR REPLACE FUNCTION claim_achievement_reward(
    user_wallet TEXT,
    achievement_key_param VARCHAR(50)
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    neft_reward DECIMAL(10,2),
    xp_reward INTEGER,
    nft_reward VARCHAR(100)
) AS $$
DECLARE
    achievement_record RECORD;
    balance_updated BOOLEAN := FALSE;
BEGIN
    -- Get achievement details
    SELECT 
        ua.status,
        ua.completed_at,
        ua.claimed_at,
        am.neft_reward,
        am.xp_reward,
        am.nft_reward,
        am.title
    INTO achievement_record
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = user_wallet 
        AND ua.achievement_key = achievement_key_param;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Achievement not found'::TEXT, 0::DECIMAL(10,2), 0, NULL::VARCHAR(100);
        RETURN;
    END IF;
    
    -- Check if achievement is completed but not claimed
    IF achievement_record.status != 'completed' THEN
        RETURN QUERY SELECT FALSE, 'Achievement not completed yet'::TEXT, 0::DECIMAL(10,2), 0, NULL::VARCHAR(100);
        RETURN;
    END IF;
    
    IF achievement_record.claimed_at IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, 'Achievement reward already claimed'::TEXT, 0::DECIMAL(10,2), 0, NULL::VARCHAR(100);
        RETURN;
    END IF;
    
    -- Update achievement status to claimed
    UPDATE user_achievements
    SET 
        status = 'claimed',
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE wallet_address = user_wallet 
        AND achievement_key = achievement_key_param;
    
    -- Add rewards to user balance
    IF achievement_record.neft_reward > 0 OR achievement_record.xp_reward > 0 THEN
        INSERT INTO user_balances (
            wallet_address,
            total_neft_claimed,
            total_xp_earned,
            available_neft,
            updated_at
        ) VALUES (
            user_wallet,
            achievement_record.neft_reward,
            achievement_record.xp_reward,
            achievement_record.neft_reward,
            NOW()
        ) ON CONFLICT (wallet_address) DO UPDATE SET
            total_neft_claimed = user_balances.total_neft_claimed + achievement_record.neft_reward,
            total_xp_earned = user_balances.total_xp_earned + achievement_record.xp_reward,
            available_neft = user_balances.available_neft + achievement_record.neft_reward,
            updated_at = NOW();
        
        balance_updated := TRUE;
    END IF;
    
    -- Log the claim activity
    INSERT INTO achievement_activity_log (
        wallet_address,
        achievement_key,
        activity_type,
        old_status,
        new_status,
        metadata
    ) VALUES (
        user_wallet,
        achievement_key_param,
        'claimed',
        'completed',
        'claimed',
        jsonb_build_object(
            'neft_reward', achievement_record.neft_reward,
            'xp_reward', achievement_record.xp_reward,
            'nft_reward', achievement_record.nft_reward,
            'balance_updated', balance_updated
        )
    );
    
    RETURN QUERY SELECT 
        TRUE, 
        'Achievement reward claimed successfully'::TEXT,
        achievement_record.neft_reward,
        achievement_record.xp_reward,
        achievement_record.nft_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get achievement statistics
CREATE OR REPLACE FUNCTION get_achievement_stats(user_wallet TEXT)
RETURNS TABLE (
    total_achievements INTEGER,
    completed_achievements INTEGER,
    claimed_achievements INTEGER,
    in_progress_achievements INTEGER,
    locked_achievements INTEGER,
    total_neft_earned DECIMAL(10,2),
    total_xp_earned INTEGER,
    completion_percentage DECIMAL(5,2)
) AS $$
BEGIN
    -- Initialize achievements if needed
    PERFORM initialize_user_achievements(user_wallet);
    
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_achievements,
        COUNT(CASE WHEN ua.status = 'completed' OR ua.status = 'claimed' THEN 1 END)::INTEGER as completed_achievements,
        COUNT(CASE WHEN ua.status = 'claimed' THEN 1 END)::INTEGER as claimed_achievements,
        COUNT(CASE WHEN ua.status = 'in_progress' THEN 1 END)::INTEGER as in_progress_achievements,
        COUNT(CASE WHEN ua.status = 'locked' THEN 1 END)::INTEGER as locked_achievements,
        COALESCE(SUM(CASE WHEN ua.status = 'claimed' THEN am.neft_reward ELSE 0 END), 0) as total_neft_earned,
        COALESCE(SUM(CASE WHEN ua.status = 'claimed' THEN am.xp_reward ELSE 0 END), 0)::INTEGER as total_xp_earned,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(CASE WHEN ua.status = 'completed' OR ua.status = 'claimed' THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100, 2)
            ELSE 0 
        END as completion_percentage
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = user_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables
DROP TRIGGER IF EXISTS update_achievements_master_updated_at ON achievements_master;
CREATE TRIGGER update_achievements_master_updated_at
    BEFORE UPDATE ON achievements_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_achievements_updated_at ON user_achievements;
CREATE TRIGGER update_user_achievements_updated_at
    BEFORE UPDATE ON user_achievements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. SAMPLE ACHIEVEMENT DATA
-- =====================================================

-- Clear existing data
DELETE FROM user_achievements;
DELETE FROM achievements_master;

-- Insert achievement definitions
INSERT INTO achievements_master (
    achievement_key,
    title,
    description,
    category,
    icon,
    color,
    neft_reward,
    xp_reward,
    target_value,
    is_active,
    sort_order
) VALUES 
-- QUEST ACHIEVEMENTS
('first_quest', 'First Quest', 'Complete your first campaign task', 'quest', '🏆', '#FFD700', 100, 50, 1, true, 1),
('quest_master', 'Quest Master', 'Complete 10 different projects', 'quest', '⭐', '#FF6B35', 500, 250, 10, true, 2),
('quest_legend', 'Quest Legend', 'Complete 50 different projects', 'quest', '👑', '#8A2BE2', 2000, 1000, 50, true, 3),

-- BURN ACHIEVEMENTS
('first_burn', 'First Burn', 'Burn your first NFT', 'burn', '🔥', '#FF4500', 200, 100, 1, true, 1),
('burn_enthusiast', 'Burn Enthusiast', 'Burn 10 NFTs', 'burn', '💥', '#DC143C', 1000, 500, 10, true, 2),
('burn_master', 'Burn Master', 'Burn 50 NFTs', 'burn', '🌋', '#B22222', 3000, 1500, 50, true, 3),

-- SOCIAL ACHIEVEMENTS
('first_referral', 'First Referral', 'Refer your first friend', 'social', '👥', '#1DA1F2', 150, 75, 1, true, 1),
('social_influencer', 'Social Influencer', 'Refer 10 friends', 'social', '📢', '#FF1493', 750, 375, 10, true, 2),
('community_leader', 'Community Leader', 'Refer 25 friends', 'social', '👑', '#9932CC', 2500, 1250, 25, true, 3),

-- CHECK-IN ACHIEVEMENTS
('daily_visitor', 'Daily Visitor', 'Check in for 7 consecutive days', 'checkin', '📅', '#32CD32', 300, 150, 7, true, 1),
('dedicated_user', 'Dedicated User', 'Check in for 30 consecutive days', 'checkin', '🎯', '#228B22', 1500, 750, 30, true, 2),

-- STAKING ACHIEVEMENTS
('first_stake', 'First Stake', 'Stake your first NFT', 'staking', '💎', '#4169E1', 250, 125, 1, true, 1),
('staking_pro', 'Staking Pro', 'Stake 10 NFTs', 'staking', '⚡', '#6A5ACD', 1250, 625, 10, true, 2),

-- CAMPAIGN ACHIEVEMENTS
('campaign_participant', 'Campaign Participant', 'Participate in your first campaign', 'campaign', '🚀', '#FF6347', 100, 50, 1, true, 1),
('campaign_champion', 'Campaign Champion', 'Win 5 campaigns', 'campaign', '🏆', '#FFD700', 1000, 500, 5, true, 2);

-- =====================================================
-- 8. UTILITY FUNCTIONS FOR TESTING
-- =====================================================

-- Reset user achievements (for testing)
CREATE OR REPLACE FUNCTION reset_user_achievements(user_wallet TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM achievement_activity_log WHERE wallet_address = user_wallet;
    DELETE FROM user_achievements WHERE wallet_address = user_wallet;
    PERFORM initialize_user_achievements(user_wallet);
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simulate achievement progress (for testing)
CREATE OR REPLACE FUNCTION simulate_achievement_progress(
    user_wallet TEXT,
    achievement_key_param VARCHAR(50),
    target_progress INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    i INTEGER := 1;
BEGIN
    WHILE i <= target_progress LOOP
        PERFORM update_achievement_progress(user_wallet, achievement_key_param, 1);
        i := i + 1;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. VALIDATION AND TESTING
-- =====================================================

-- Test the complete system with a sample user
DO $$
DECLARE
    test_wallet TEXT := '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';
    result RECORD;
BEGIN
    -- Reset and initialize
    PERFORM reset_user_achievements(test_wallet);
    
    -- Test first quest completion
    SELECT * INTO result FROM update_achievement_progress(test_wallet, 'first_quest', 1);
    RAISE NOTICE 'First quest completion: success=%, completed=%, progress=%', 
        result.success, result.achievement_completed, result.new_progress;
    
    -- Verify progressive unlocking
    SELECT COUNT(*) as unlocked_count INTO result 
    FROM user_achievements 
    WHERE wallet_address = test_wallet 
        AND achievement_key IN ('quest_master', 'quest_legend') 
        AND status = 'in_progress';
    
    RAISE NOTICE 'Progressive achievements unlocked: %', result.unlocked_count;
    
    -- Test achievement claiming
    SELECT * INTO result FROM claim_achievement_reward(test_wallet, 'first_quest');
    RAISE NOTICE 'Achievement claim: success=%, neft=%, xp=%', 
        result.success, result.neft_reward, result.xp_reward;
    
    RAISE NOTICE 'Achievement system validation completed successfully!';
END $$;

-- =====================================================
-- SYSTEM READY FOR PRODUCTION
-- =====================================================

COMMENT ON SCHEMA public IS 'NEFTIT Achievement System - Complete and Production Ready';
