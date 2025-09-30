-- ============================================================================
-- FIX DAILY CLAIM 24-HOUR COOLDOWN
-- ============================================================================
-- Current Issue: Daily claims only check calendar date, not 24-hour period
-- Solution: Check if 24 hours have passed since last claim timestamp
-- ============================================================================

-- Add claimed_at column to user_streaks if it doesn't exist
ALTER TABLE user_streaks 
ADD COLUMN IF NOT EXISTS last_claimed_at TIMESTAMP WITH TIME ZONE;

-- Update existing records to set last_claimed_at based on last_claim_date
UPDATE user_streaks 
SET last_claimed_at = (last_claim_date + TIME '00:00:00')::TIMESTAMP WITH TIME ZONE
WHERE last_claimed_at IS NULL AND last_claim_date IS NOT NULL;

-- Create 24-hour cooldown daily claim function
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
  hours_since_last_claim NUMERIC;
BEGIN
  -- Get user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  -- Check 24-hour cooldown
  IF user_record IS NOT NULL AND user_record.last_claimed_at IS NOT NULL THEN
    -- Calculate hours since last claim
    SELECT EXTRACT(EPOCH FROM (NOW() - user_record.last_claimed_at)) / 3600 INTO hours_since_last_claim;
    
    -- If less than 24 hours, return error with remaining time
    IF hours_since_last_claim < 24 THEN
      RETURN QUERY SELECT 
        FALSE, 
        CONCAT('Must wait ', ROUND(24 - hours_since_last_claim, 1), ' more hours before next claim')::TEXT,
        COALESCE(user_record.current_streak, 0), 
        0.0::DECIMAL(18,8), 
        0, 
        ''::TEXT, 
        NULL::JSONB, 
        FALSE,
        0.0::DECIMAL(18,8), 
        0;
      RETURN;
    END IF;
  END IF;

  -- Also check daily_claims table for same calendar date (backup check)
  IF EXISTS (SELECT 1 FROM daily_claims WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE) THEN
    RETURN QUERY SELECT 
      FALSE, 'Already claimed today'::TEXT,
      0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE,
      0.0::DECIMAL(18,8), 0;
    RETURN;
  END IF;

  -- Create or update user streak record
  IF user_record IS NULL THEN
    calculated_streak := 1;
    INSERT INTO user_streaks (
      wallet_address, current_streak, longest_streak, last_claim_date, 
      total_claims, streak_started_at, total_neft_earned, total_xp_earned,
      last_claimed_at
    ) VALUES (
      user_wallet, 1, 1, CURRENT_DATE, 1, CURRENT_DATE, 0, 0, NOW()
    );
  ELSE
    -- Calculate streak continuation (24-hour based)
    IF user_record.last_claimed_at IS NOT NULL AND 
       user_record.last_claimed_at >= (NOW() - INTERVAL '48 hours') THEN
      calculated_streak := user_record.current_streak + 1;
    ELSE
      calculated_streak := 1;
    END IF;
  END IF;

  -- Get reward calculation
  SELECT * INTO reward_data FROM calculate_daily_reward(calculated_streak, user_wallet);
  
  total_reward_neft := reward_data.base_neft + reward_data.bonus_neft;
  total_reward_xp := reward_data.base_xp + reward_data.bonus_xp;

  -- Update user streaks with 24-hour timestamp
  UPDATE user_streaks SET
    current_streak = calculated_streak,
    longest_streak = GREATEST(longest_streak, calculated_streak),
    last_claim_date = CURRENT_DATE,
    last_claimed_at = NOW(),
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

-- Create helper function to check claim eligibility
CREATE OR REPLACE FUNCTION can_claim_daily_reward(user_wallet TEXT)
RETURNS TABLE(
  can_claim BOOLEAN,
  hours_remaining NUMERIC,
  message TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  user_record RECORD;
  hours_since_last_claim NUMERIC;
BEGIN
  -- Get user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  -- If no previous claims, can claim immediately
  IF user_record IS NULL OR user_record.last_claimed_at IS NULL THEN
    RETURN QUERY SELECT TRUE, 0::NUMERIC, 'Ready to claim'::TEXT;
    RETURN;
  END IF;

  -- Calculate hours since last claim
  SELECT EXTRACT(EPOCH FROM (NOW() - user_record.last_claimed_at)) / 3600 INTO hours_since_last_claim;
  
  -- Check if 24 hours have passed
  IF hours_since_last_claim >= 24 THEN
    RETURN QUERY SELECT TRUE, 0::NUMERIC, 'Ready to claim'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      FALSE, 
      ROUND(24 - hours_since_last_claim, 1), 
      CONCAT('Must wait ', ROUND(24 - hours_since_last_claim, 1), ' more hours')::TEXT;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION can_claim_daily_reward(TEXT) TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '24-HOUR DAILY CLAIM COOLDOWN IMPLEMENTED!';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '- Added last_claimed_at timestamp column';
    RAISE NOTICE '- 24-hour cooldown between claims (not calendar day)';
    RAISE NOTICE '- can_claim_daily_reward() helper function';
    RAISE NOTICE '- Precise remaining time calculations';
    RAISE NOTICE '- Streak logic based on 48-hour window';
    RAISE NOTICE 'Daily claims now enforce true 24-hour intervals!';
END $$;
