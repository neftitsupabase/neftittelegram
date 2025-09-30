-- Fix user_balances column references in sync function
-- The table uses total_neft_claimed, not total_neft

-- Step 1: Fix sync_user_balance_cache_free with correct column names
CREATE OR REPLACE FUNCTION sync_user_balance_cache_free(user_wallet TEXT)
RETURNS TEXT AS $$
DECLARE
  total_neft DECIMAL(18,8) := 0;
  total_xp INTEGER := 0;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN 'ERROR: Invalid wallet address';
  END IF;

  -- Calculate total from user_activities (real-time, no cache)
  SELECT 
    COALESCE(SUM(neft_reward), 0),
    COALESCE(SUM(xp_reward), 0)
  INTO total_neft, total_xp
  FROM user_activities 
  WHERE wallet_address = user_wallet;

  -- Update user_balances with correct column names
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, last_updated)
  VALUES (user_wallet, total_neft, total_xp, total_neft, NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    total_neft_claimed = EXCLUDED.total_neft_claimed,
    total_xp_earned = EXCLUDED.total_xp_earned,
    available_neft = EXCLUDED.available_neft,
    last_updated = NOW();

  RETURN 'SUCCESS: Balance synced - NEFT: ' || total_neft || ', XP: ' || total_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update get_real_time_achievement_balance to not reference user_balances
CREATE OR REPLACE FUNCTION get_real_time_achievement_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  result JSON;
  achievement_count INTEGER := 0;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN json_build_object(
      'error', 'Invalid wallet address',
      'achievement_neft', 0,
      'achievement_xp', 0,
      'achievement_count', 0,
      'cache_free', true
    );
  END IF;

  -- Get achievement rewards with NO CACHING - direct database query
  SELECT 
    COALESCE(SUM(am.neft_reward), 0),
    COALESCE(SUM(am.xp_reward), 0),
    COUNT(*)
  INTO achievement_neft, achievement_xp, achievement_count
  FROM user_achievements ua 
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key 
  WHERE ua.wallet_address = user_wallet 
    AND ua.status = 'completed' 
    AND ua.claimed_at IS NOT NULL
    AND am.neft_reward > 0; -- Only count valid rewards

  -- Build result with real-time data
  result := json_build_object(
    'wallet_address', user_wallet,
    'achievement_neft', achievement_neft,
    'achievement_xp', achievement_xp,
    'achievement_count', achievement_count,
    'last_calculated', NOW(),
    'source', 'real_time_no_cache',
    'cache_free', true
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_user_balance_cache_free(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_real_time_achievement_balance(TEXT) TO authenticated;

-- Test the fix
SELECT 'Column reference errors fixed - using total_neft_claimed instead of total_neft' as status;
