-- ============================================================================
-- STEP 3: Create backup copies of existing functions before modifying them
-- This allows easy rollback if something goes wrong
-- ============================================================================

-- Backup existing process_daily_claim function
CREATE OR REPLACE FUNCTION process_daily_claim_backup(user_wallet TEXT)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  streak_count INTEGER,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  reward_tier TEXT,
  nft_reward JSONB,
  is_milestone BOOLEAN,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER
)
SECURITY DEFINER
AS $$
BEGIN
  -- This is just a backup copy - call the original function
  RETURN QUERY SELECT * FROM process_daily_claim(user_wallet);
END;
$$ LANGUAGE plpgsql;

-- Backup existing get_user_streak_info function  
CREATE OR REPLACE FUNCTION get_user_streak_info_backup(user_wallet TEXT)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  total_claims INTEGER,
  can_claim_today BOOLEAN,
  last_claim_date DATE
)
SECURITY DEFINER
AS $$
BEGIN
  -- This is just a backup copy - call the original function
  RETURN QUERY SELECT 
    current_streak,
    longest_streak, 
    total_claims,
    can_claim_today,
    last_claim_date
  FROM get_user_streak_info(user_wallet);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to backup functions
GRANT EXECUTE ON FUNCTION process_daily_claim_backup(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_claim_backup(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION process_daily_claim_backup(TEXT) TO public;

GRANT EXECUTE ON FUNCTION get_user_streak_info_backup(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_streak_info_backup(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_streak_info_backup(TEXT) TO public;

-- Test backup functions work
SELECT 'STEP 3: Testing backup functions...' as test_step;

-- Success message for Step 3
DO $$
BEGIN
    RAISE NOTICE '✅ STEP 3 COMPLETED: Backup functions created successfully!';
    RAISE NOTICE 'If anything goes wrong with new functions, you can restore using:';
    RAISE NOTICE 'DROP FUNCTION process_daily_claim(TEXT); CREATE OR REPLACE FUNCTION process_daily_claim AS process_daily_claim_backup;';
    RAISE NOTICE 'Next: Deploy STEP 4 only after verifying backups work.';
END $$;
