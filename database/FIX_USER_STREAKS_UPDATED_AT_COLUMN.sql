-- ============================================================================
-- FIX USER_STREAKS UPDATED_AT COLUMN ERROR
-- ============================================================================
-- Error: record "new" has no field "updated_at"
-- Root Cause: user_streaks table missing updated_at column but trigger expects it
-- Solution: Add updated_at column and ensure trigger works properly
-- ============================================================================

-- Add updated_at column to user_streaks table if it doesn't exist
ALTER TABLE user_streaks 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have updated_at values
UPDATE user_streaks 
SET updated_at = COALESCE(updated_at, NOW()) 
WHERE updated_at IS NULL;

-- Ensure the trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_user_streaks_updated_at ON user_streaks;

-- Create trigger for automatic updated_at updates
CREATE TRIGGER update_user_streaks_updated_at
    BEFORE UPDATE ON user_streaks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Also ensure daily_claims table has updated_at if needed
ALTER TABLE daily_claims 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing daily_claims records
UPDATE daily_claims 
SET updated_at = COALESCE(updated_at, claimed_at, NOW()) 
WHERE updated_at IS NULL;

-- Create trigger for daily_claims if needed
DROP TRIGGER IF EXISTS update_daily_claims_updated_at ON daily_claims;
CREATE TRIGGER update_daily_claims_updated_at
    BEFORE UPDATE ON daily_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Test that the columns exist
DO $$
DECLARE
    user_streaks_has_updated_at BOOLEAN;
    daily_claims_has_updated_at BOOLEAN;
BEGIN
    -- Check if user_streaks has updated_at column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_streaks' 
        AND column_name = 'updated_at'
    ) INTO user_streaks_has_updated_at;
    
    -- Check if daily_claims has updated_at column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_claims' 
        AND column_name = 'updated_at'
    ) INTO daily_claims_has_updated_at;
    
    RAISE NOTICE 'user_streaks has updated_at column: %', user_streaks_has_updated_at;
    RAISE NOTICE 'daily_claims has updated_at column: %', daily_claims_has_updated_at;
    
    IF user_streaks_has_updated_at AND daily_claims_has_updated_at THEN
        RAISE NOTICE 'SUCCESS: All required updated_at columns are present!';
    ELSE
        RAISE NOTICE 'WARNING: Some updated_at columns may still be missing';
    END IF;
END;
$$;

SELECT 'user_streaks updated_at column issue fixed!' as status,
       'Added missing updated_at column and proper triggers' as result;
