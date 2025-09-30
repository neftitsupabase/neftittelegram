-- ============================================================================
-- FIX PROCESS_DAILY_CLAIM UPDATED_AT FIELD ERROR
-- ============================================================================
-- Error: record "new" has no field "updated_at"
-- Root Cause: user_streaks table missing updated_at column or function mismatch
-- Solution: Ensure table has updated_at column and fix function
-- ============================================================================

-- First, ensure user_streaks table has updated_at column
ALTER TABLE user_streaks 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add trigger to automatically update updated_at
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

-- Fix the process_daily_claim function to handle missing updated_at gracefully
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
  user_record RECORD;
  reward_data RECORD;
  calculated_streak INTEGER;
  total_reward_neft DECIMAL(18,8);
  total_reward_xp INTEGER;
BEGIN
  -- Check if already claimed today
  IF EXISTS (SELECT 1 FROM daily_claims WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE) THEN
    RETURN QUERY SELECT 
      FALSE, 'Already claimed today'::TEXT,
      0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE,
      0.0::DECIMAL(18,8), 0;
    RETURN;
  END IF;

  -- Get or create user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  IF user_record IS NULL THEN
    calculated_streak := 1;
    INSERT INTO user_streaks (
      wallet_address, current_streak, longest_streak, last_claim_date, 
      total_claims, streak_started_at, total_neft_earned, total_xp_earned,
      created_at, updated_at
    ) VALUES (
      user_wallet, 1, 1, CURRENT_DATE, 1, CURRENT_DATE, 0, 0,
      NOW(), NOW()
    );
  ELSE
    -- Calculate streak continuation
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      calculated_streak := user_record.current_streak + 1;
    ELSE
      calculated_streak := 1;
    END IF;
  END IF;

  -- Get reward calculation
  SELECT * INTO reward_data FROM calculate_daily_reward(calculated_streak, user_wallet);
  
  total_reward_neft := reward_data.base_neft + reward_data.bonus_neft;
  total_reward_xp := reward_data.base_xp + reward_data.bonus_xp;

  -- Update user streaks (trigger will handle updated_at automatically)
  UPDATE user_streaks SET
    current_streak = calculated_streak,
    longest_streak = GREATEST(longest_streak, calculated_streak),
    last_claim_date = CURRENT_DATE,
    total_claims = total_claims + 1,
    total_neft_earned = total_neft_earned + total_reward_neft,
    total_xp_earned = total_xp_earned + total_reward_xp
  WHERE wallet_address = user_wallet;

  -- Record the claim
  INSERT INTO daily_claims (
    wallet_address, claim_date, streak_count, 
    base_neft_reward, bonus_neft_reward, 
    base_xp_reward, bonus_xp_reward,
    nft_reward, reward_tier
  ) VALUES (
    user_wallet, CURRENT_DATE, calculated_streak,
    reward_data.base_neft, reward_data.bonus_neft,
    reward_data.base_xp, reward_data.bonus_xp,
    reward_data.nft_reward, reward_data.reward_tier
  );

  -- Update user_balances table
  INSERT INTO user_balances (
    wallet_address, 
    total_neft_claimed, 
    total_xp_earned, 
    last_updated
  ) VALUES (
    user_wallet, 
    total_reward_neft, 
    total_reward_xp,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + total_reward_neft,
    total_xp_earned = user_balances.total_xp_earned + total_reward_xp,
    last_updated = NOW();

  -- Return success result
  RETURN QUERY SELECT 
    TRUE,
    'Daily reward claimed successfully!'::TEXT,
    calculated_streak,
    total_reward_neft,
    total_reward_xp,
    reward_data.reward_tier,
    reward_data.nft_reward,
    reward_data.is_milestone,
    total_reward_neft,
    total_reward_xp;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'PROCESS_DAILY_CLAIM UPDATED_AT ERROR FIXED!';
    RAISE NOTICE 'Fixed issues:';
    RAISE NOTICE '- Ensured user_streaks table has updated_at column';
    RAISE NOTICE '- Added automatic updated_at trigger';
    RAISE NOTICE '- Fixed process_daily_claim function to handle updated_at properly';
    RAISE NOTICE '- Removed manual updated_at assignment (trigger handles it)';
    RAISE NOTICE 'Daily claims should now work without updated_at errors!';
END $$;
