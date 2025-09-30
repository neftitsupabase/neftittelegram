-- Level System Database Migration
-- Adds level calculation functionality to the existing user_balances table

-- Add level column to user_balances if it doesn't exist
ALTER TABLE user_balances 
ADD COLUMN IF NOT EXISTS current_level INTEGER DEFAULT 1;

-- Create or replace function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level_from_xp(total_xp NUMERIC)
RETURNS INTEGER AS $$
DECLARE
    xp_thresholds INTEGER[] := ARRAY[
        0, 83, 174, 276, 388, 512, 650, 801, 969, 1156,
        1358, 1584, 1833, 2107, 2411, 2746, 3115, 3523, 3973, 4470,
        5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031, 13363,
        14831, 16456, 18247, 20224, 22406, 24815, 27473, 30408, 33648, 37224,
        41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333,
        111945, 123660, 136591, 150872, 166636, 184040, 203254, 224465, 247886, 273742,
        302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032, 668051, 737627,
        814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581, 1629200, 1798808, 1986068
    ];
    level INTEGER := 1;
    i INTEGER;
BEGIN
    -- Handle negative XP
    IF total_xp < 0 THEN
        RETURN 1;
    END IF;
    
    -- Find the highest level where XP requirement is met
    FOR i IN REVERSE array_upper(xp_thresholds, 1)..1 LOOP
        IF total_xp >= xp_thresholds[i] THEN
            level := i;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN level;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create or replace function to update user level based on XP
CREATE OR REPLACE FUNCTION update_user_level(user_wallet TEXT)
RETURNS VOID AS $$
DECLARE
    user_xp NUMERIC;
    calculated_level INTEGER;
BEGIN
    -- Get current total XP for user
    SELECT COALESCE(total_xp_earned, 0) INTO user_xp
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Calculate level from XP
    calculated_level := calculate_level_from_xp(user_xp);
    
    -- Update user's level
    UPDATE user_balances 
    SET current_level = calculated_level,
        last_updated = NOW()
    WHERE wallet_address = user_wallet;
    
    -- Insert record if user doesn't exist
    IF NOT FOUND THEN
        INSERT INTO user_balances (
            wallet_address, 
            current_level, 
            total_xp_earned, 
            last_updated
        ) VALUES (
            user_wallet, 
            calculated_level, 
            0, 
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically update level when XP changes
CREATE OR REPLACE FUNCTION trigger_update_user_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Update level based on new total_xp_earned
    NEW.current_level := calculate_level_from_xp(COALESCE(NEW.total_xp_earned, 0));
    NEW.last_updated := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update level on XP changes
DROP TRIGGER IF EXISTS auto_update_level_on_xp_change ON user_balances;
CREATE TRIGGER auto_update_level_on_xp_change
    BEFORE UPDATE OF total_xp_earned ON user_balances
    FOR EACH ROW
    WHEN (OLD.total_xp_earned IS DISTINCT FROM NEW.total_xp_earned)
    EXECUTE FUNCTION trigger_update_user_level();

-- Create trigger for new inserts
DROP TRIGGER IF EXISTS auto_update_level_on_insert ON user_balances;
CREATE TRIGGER auto_update_level_on_insert
    BEFORE INSERT ON user_balances
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_user_level();

-- Update existing records to have correct levels
UPDATE user_balances 
SET current_level = calculate_level_from_xp(COALESCE(total_xp_earned, 0))
WHERE current_level IS NULL OR current_level != calculate_level_from_xp(COALESCE(total_xp_earned, 0));

-- Update the get_direct_user_balance function to include level
CREATE OR REPLACE FUNCTION get_direct_user_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- First ensure user level is up to date
    PERFORM update_user_level(user_wallet);
    
    -- Get user balance with level
    SELECT json_build_object(
        'total_neft_claimed', COALESCE(total_neft, 0),
        'total_xp_earned', COALESCE(total_xp, 0),
        'total_nft_count', COALESCE(nft_count, 0),
        'available_neft', COALESCE(available_neft, 0),
        'staked_neft', COALESCE(staked_neft, 0),
        'current_level', COALESCE(current_level, 1),
        'last_updated', COALESCE(updated_at, created_at, NOW())
    ) INTO result
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Return default values if user doesn't exist
    IF result IS NULL THEN
        result := json_build_object(
            'total_neft_claimed', 0,
            'total_xp_earned', 0,
            'total_nft_count', 0,
            'available_neft', 0,
            'staked_neft', 0,
            'current_level', 1,
            'last_updated', NOW()
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION calculate_level_from_xp(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_level(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO authenticated;
