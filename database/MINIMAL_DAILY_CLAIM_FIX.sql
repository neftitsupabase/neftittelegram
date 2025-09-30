-- ============================================================================
-- MINIMAL DAILY CLAIM FIX - BYPASS ALL SCHEMA ISSUES
-- ============================================================================
-- This creates a completely new function that avoids all schema conflicts
-- ============================================================================

-- Drop any existing triggers that might reference updated_at
DROP TRIGGER IF EXISTS update_user_streaks_updated_at ON user_streaks;

-- Create minimal daily claim function that avoids all problematic columns
CREATE OR REPLACE FUNCTION process_daily_claim(user_wallet TEXT)
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
LANGUAGE plpgsql AS $$
DECLARE
  current_streak_val INTEGER := 1;
  reward_neft DECIMAL(18,8) := 10.0;
  reward_xp INTEGER := 50;
  already_claimed BOOLEAN := FALSE;
BEGIN
  -- Simple check for today's claim using only basic columns
  SELECT EXISTS(
    SELECT 1 FROM daily_claims 
    WHERE wallet_address = user_wallet 
    AND claim_date = CURRENT_DATE
  ) INTO already_claimed;
  
  IF already_claimed THEN
    RETURN QUERY SELECT 
      FALSE, 'Already claimed today'::TEXT,
      0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE,
      0.0::DECIMAL(18,8), 0;
    RETURN;
  END IF;

  -- Get current streak (safe query)
  SELECT COALESCE(current_streak, 0) + 1 
  INTO current_streak_val
  FROM user_streaks 
  WHERE wallet_address = user_wallet;
  
  -- If no record exists, start with streak 1
  IF current_streak_val IS NULL THEN
    current_streak_val := 1;
  END IF;

  -- Calculate rewards based on streak
  reward_neft := 10.0 + (current_streak_val * 0.5);
  reward_xp := 50 + (current_streak_val * 5);

  -- Insert or update user_streaks (only safe columns)
  INSERT INTO user_streaks (
    wallet_address, 
    current_streak, 
    longest_streak, 
    last_claim_date,
    total_claims,
    total_neft_earned,
    total_xp_earned
  ) VALUES (
    user_wallet, 
    current_streak_val, 
    current_streak_val, 
    CURRENT_DATE,
    1,
    reward_neft,
    reward_xp
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    current_streak = current_streak_val,
    longest_streak = GREATEST(user_streaks.longest_streak, current_streak_val),
    last_claim_date = CURRENT_DATE,
    total_claims = COALESCE(user_streaks.total_claims, 0) + 1,
    total_neft_earned = COALESCE(user_streaks.total_neft_earned, 0) + reward_neft,
    total_xp_earned = COALESCE(user_streaks.total_xp_earned, 0) + reward_xp;

  -- Record the claim
  INSERT INTO daily_claims (
    wallet_address, 
    claim_date, 
    streak_count,
    base_neft_reward,
    base_xp_reward,
    reward_tier
  ) VALUES (
    user_wallet, 
    CURRENT_DATE, 
    current_streak_val,
    reward_neft,
    reward_xp,
    'Basic'
  );

  -- Update user_balances
  INSERT INTO user_balances (
    wallet_address, 
    total_neft_claimed, 
    total_xp_earned,
    last_updated
  ) VALUES (
    user_wallet, 
    reward_neft, 
    reward_xp,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + reward_neft,
    total_xp_earned = user_balances.total_xp_earned + reward_xp,
    last_updated = NOW();

  -- Return success
  RETURN QUERY SELECT 
    TRUE,
    'Daily reward claimed successfully!'::TEXT,
    current_streak_val,
    reward_neft,
    reward_xp,
    'Basic'::TEXT,
    NULL::JSONB,
    FALSE,
    reward_neft,
    reward_xp;
END;
$$;

GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'MINIMAL DAILY CLAIM FIX DEPLOYED!';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '✅ Avoids all updated_at references';
    RAISE NOTICE '✅ Simple streak calculation';
    RAISE NOTICE '✅ Basic reward system (10 NEFT + 50 XP base)';
    RAISE NOTICE '✅ No triggers or complex dependencies';
    RAISE NOTICE '✅ Should work immediately';
    RAISE NOTICE 'Test daily claims now!';
END $$;
