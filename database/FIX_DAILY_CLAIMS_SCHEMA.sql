-- ============================================================================
-- FIX DAILY CLAIMS SCHEMA - Add ALL missing columns for fresh system
-- The daily_claims table is missing multiple columns needed by fresh functions
-- ============================================================================

-- Add ALL missing columns to daily_claims table
ALTER TABLE daily_claims 
ADD COLUMN IF NOT EXISTS streak_day INTEGER,
ADD COLUMN IF NOT EXISTS neft_reward DECIMAL(18,8),
ADD COLUMN IF NOT EXISTS xp_reward INTEGER,
ADD COLUMN IF NOT EXISTS reward_tier TEXT;

-- Update existing records to have proper default values
UPDATE daily_claims 
SET 
  streak_day = 1,
  neft_reward = 5.0,
  xp_reward = 5,
  reward_tier = 'Day 1'
WHERE streak_day IS NULL;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ DAILY CLAIMS SCHEMA COMPLETELY FIXED!';
    RAISE NOTICE 'Added missing columns: streak_day, neft_reward, xp_reward, reward_tier';
    RAISE NOTICE 'Updated existing records with default values';
    RAISE NOTICE 'Now deploy FRESH_DAILY_CLAIMS_SYSTEM.sql';
END $$;
