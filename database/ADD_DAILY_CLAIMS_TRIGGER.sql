-- ============================================================================
-- ADD DAILY CLAIMS TRIGGER TO SYNC USER_BALANCES
-- Simple trigger approach like other services use
-- Automatically updates user_balances when daily_claims are added
-- ============================================================================

-- Step 1: Create trigger function to update user_balances after daily claim
CREATE OR REPLACE FUNCTION update_user_balance_after_daily_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user balance with daily claim rewards
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, last_updated)
  VALUES (NEW.wallet_address, NEW.neft_reward, NEW.xp_reward, NEW.neft_reward, NOW())
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + NEW.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + NEW.xp_reward,
    available_neft = user_balances.available_neft + NEW.neft_reward,
    last_updated = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger on daily_claims table
DROP TRIGGER IF EXISTS sync_user_balance_on_daily_claim ON daily_claims;

CREATE TRIGGER sync_user_balance_on_daily_claim
  AFTER INSERT ON daily_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_daily_claim();

-- Step 3: Remove the user_balances update from process_daily_claim function
-- Keep the existing function signature but remove the manual balance update
CREATE OR REPLACE FUNCTION process_daily_claim(user_wallet TEXT)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  streak_count INTEGER,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  reward_tier TEXT,
  cycle_day INTEGER,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER
)
SECURITY DEFINER
AS $$
DECLARE
  current_streak INTEGER := 0;
  new_streak INTEGER := 1;
  last_claim_time TIMESTAMPTZ;
  can_claim BOOLEAN := TRUE;
  reward_record RECORD;
  current_neft DECIMAL(18,8) := 0;
  current_xp INTEGER := 0;
BEGIN
  -- Check for existing claims within 24 hours
  SELECT claimed_at INTO last_claim_time
  FROM daily_claims
  WHERE wallet_address = user_wallet
  ORDER BY claimed_at DESC
  LIMIT 1;

  -- Enforce 24-hour cooldown
  IF last_claim_time IS NOT NULL AND NOW() < (last_claim_time + INTERVAL '24 hours') THEN
    RETURN QUERY SELECT 
      FALSE,
      'You must wait 24 hours between claims',
      0,
      0.0::DECIMAL(18,8),
      0,
      ''::TEXT,
      0,
      0.0::DECIMAL(18,8),
      0;
    RETURN;
  END IF;

  -- Get current streak from user_streaks table
  SELECT us.current_streak INTO current_streak
  FROM user_streaks us
  WHERE us.wallet_address = user_wallet;

  -- If no streak record exists, start at 1
  IF current_streak IS NULL THEN
    current_streak := 0;
  END IF;

  -- Calculate new streak
  new_streak := current_streak + 1;

  -- Get progressive reward for this streak day
  SELECT * INTO reward_record FROM calculate_progressive_daily_reward(new_streak);

  -- Insert daily claim record (trigger will update user_balances automatically)
  INSERT INTO daily_claims (
    wallet_address,
    claim_date,
    streak_count,
    streak_day,
    base_neft_reward,
    base_xp_reward,
    neft_reward,
    xp_reward,
    reward_tier,
    claimed_at
  ) VALUES (
    user_wallet,
    CURRENT_DATE,
    new_streak,
    new_streak,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    NOW()
  );

  -- Update or insert user_streaks record
  INSERT INTO user_streaks (
    wallet_address,
    current_streak,
    longest_streak,
    last_claim_date,
    last_claimed_at,
    total_claims,
    total_neft_earned,
    total_xp_earned,
    streak_started_at,
    updated_at
  ) VALUES (
    user_wallet,
    new_streak,
    GREATEST(new_streak, COALESCE((SELECT longest_streak FROM user_streaks WHERE wallet_address = user_wallet), 0)),
    CURRENT_DATE,
    NOW(),
    1,
    reward_record.neft_reward,
    reward_record.xp_reward,
    CASE WHEN new_streak = 1 THEN CURRENT_DATE ELSE COALESCE((SELECT streak_started_at FROM user_streaks WHERE wallet_address = user_wallet), CURRENT_DATE) END,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    current_streak = new_streak,
    longest_streak = GREATEST(new_streak, user_streaks.longest_streak),
    last_claim_date = CURRENT_DATE,
    last_claimed_at = NOW(),
    total_claims = user_streaks.total_claims + 1,
    total_neft_earned = user_streaks.total_neft_earned + reward_record.neft_reward,
    total_xp_earned = user_streaks.total_xp_earned + reward_record.xp_reward,
    updated_at = NOW();

  -- Get final totals for response (from user_balances after trigger update)
  SELECT 
    COALESCE(ub.total_neft_claimed, 0),
    COALESCE(ub.total_xp_earned, 0)
  INTO current_neft, current_xp
  FROM user_balances ub
  WHERE ub.wallet_address = user_wallet;

  -- Return success response
  RETURN QUERY SELECT 
    TRUE,
    'Daily reward claimed successfully!',
    new_streak,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    reward_record.cycle_day,
    current_neft,
    current_xp;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION update_user_balance_after_daily_claim() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_balance_after_daily_claim() TO anon;
GRANT EXECUTE ON FUNCTION update_user_balance_after_daily_claim() TO public;

GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO public;

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DAILY CLAIMS TRIGGER ADDED SUCCESSFULLY!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '✅ Added trigger on daily_claims table';
    RAISE NOTICE '✅ Automatically updates user_balances when daily claim is inserted';
    RAISE NOTICE '✅ Removed manual balance update from process_daily_claim()';
    RAISE NOTICE '✅ Same approach as other services (campaigns, achievements)';
    RAISE NOTICE '';
    RAISE NOTICE 'Now daily claims work like other services:';
    RAISE NOTICE '1. Insert into daily_claims table';
    RAISE NOTICE '2. Trigger automatically updates user_balances';
    RAISE NOTICE '3. UI shows updated balance via get_direct_user_balance()';
    RAISE NOTICE '';
    RAISE NOTICE 'Daily claims now sync to user_balances automatically!';
END $$;
