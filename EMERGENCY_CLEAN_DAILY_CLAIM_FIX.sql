-- ============================================================================
-- EMERGENCY CLEAN FIX: Daily Claim System
-- This removes ALL conflicting triggers and creates a working system
-- ============================================================================

-- STEP 1: REMOVE ALL CONFLICTING TRIGGERS AND FUNCTIONS
DROP TRIGGER IF EXISTS sync_user_balance_on_daily_claim ON daily_claims;
DROP TRIGGER IF EXISTS daily_claims_balance_sync_trigger ON daily_claims;
DROP TRIGGER IF EXISTS daily_claims_balance_sync ON daily_claims;
DROP TRIGGER IF EXISTS trigger_daily_claims_cache_free_sync ON daily_claims;
DROP TRIGGER IF EXISTS trigger_daily_claims_balance_sync_validated ON daily_claims;
DROP TRIGGER IF EXISTS update_daily_claims_updated_at ON daily_claims;
DROP TRIGGER IF EXISTS trigger_daily_claims_updated_at ON daily_claims;

DROP FUNCTION IF EXISTS update_user_balance_after_daily_claim() CASCADE;
DROP FUNCTION IF EXISTS sync_balance_after_daily_claim() CASCADE;
DROP FUNCTION IF EXISTS trigger_cache_free_balance_sync() CASCADE;

-- STEP 2: DROP AND RECREATE THE CORRECT FUNCTIONS
DROP FUNCTION IF EXISTS calculate_progressive_daily_reward(INTEGER);
DROP FUNCTION IF EXISTS process_daily_claim(TEXT);

-- Create the CORRECT progressive reward function
CREATE OR REPLACE FUNCTION calculate_progressive_daily_reward(streak_day INTEGER)
RETURNS TABLE(
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  reward_tier TEXT,
  cycle_day INTEGER
)
SECURITY DEFINER
AS $$
DECLARE
  day_in_cycle INTEGER;
  reward_neft DECIMAL(18,8);
  reward_xp INTEGER;
  tier_name TEXT;
BEGIN
  -- Calculate which day in the 7-day cycle (1-7)
  day_in_cycle := ((streak_day - 1) % 7) + 1;
  
  -- EXACT REWARDS AS REQUESTED
  CASE day_in_cycle
    WHEN 1 THEN
      reward_neft := 5.0;
      reward_xp := 5;
      tier_name := 'Day 1 - Fresh Start';
    WHEN 2 THEN
      reward_neft := 8.0;
      reward_xp := 8;
      tier_name := 'Day 2 - Building Momentum';
    WHEN 3 THEN
      reward_neft := 12.0;
      reward_xp := 12;
      tier_name := 'Day 3 - Getting Stronger';
    WHEN 4 THEN
      reward_neft := 17.0;
      reward_xp := 17;
      tier_name := 'Day 4 - Steady Progress';
    WHEN 5 THEN
      reward_neft := 22.0;
      reward_xp := 22;
      tier_name := 'Day 5 - Consistent Effort';
    WHEN 6 THEN
      reward_neft := 30.0;
      reward_xp := 30;
      tier_name := 'Day 6 - Almost There';
    WHEN 7 THEN
      reward_neft := 35.0;
      reward_xp := 35;
      tier_name := 'Day 7 - Weekly Champion';
    ELSE
      reward_neft := 5.0;
      reward_xp := 5;
      tier_name := 'Day 1 - Fresh Start';
  END CASE;
  
  RETURN QUERY SELECT reward_neft, reward_xp, tier_name, day_in_cycle;
END;
$$ LANGUAGE plpgsql;

-- Create the CORRECT process_daily_claim function
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
  reward_record RECORD;
  current_neft DECIMAL(18,8) := 0;
  current_xp INTEGER := 0;
  current_available_neft DECIMAL(18,8) := 0;
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

  -- FIXED: If no streak record exists OR current_streak is 0, start at 1
  IF current_streak IS NULL OR current_streak = 0 THEN
    current_streak := 0;  -- This will make new_streak = 1
  END IF;

  -- Calculate new streak
  new_streak := current_streak + 1;

  -- Get progressive reward for this streak day
  SELECT * INTO reward_record FROM calculate_progressive_daily_reward(new_streak);

  -- Get current balance from user_balances
  SELECT 
    COALESCE(ub.total_neft_claimed, 0),
    COALESCE(ub.total_xp_earned, 0),
    COALESCE(ub.available_neft, 0)
  INTO current_neft, current_xp, current_available_neft
  FROM user_balances ub
  WHERE ub.wallet_address = user_wallet;

  -- Insert daily claim record (SIMPLE SCHEMA)
  INSERT INTO daily_claims (
    wallet_address,
    claim_date,
    streak_count,
    neft_reward,
    xp_reward,
    reward_tier,
    claimed_at
  ) VALUES (
    user_wallet,
    CURRENT_DATE,
    new_streak,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    NOW()
  );

  -- Update or create user_streaks record
  INSERT INTO user_streaks (
    wallet_address,
    current_streak,
    longest_streak,
    last_claim_date,
    total_claims,
    streak_started_at,
    total_neft_earned,
    total_xp_earned,
    last_claimed_at
  ) VALUES (
    user_wallet,
    new_streak,
    GREATEST(new_streak, COALESCE((SELECT longest_streak FROM user_streaks WHERE wallet_address = user_wallet), 0)),
    CURRENT_DATE,
    COALESCE((SELECT total_claims FROM user_streaks WHERE wallet_address = user_wallet), 0) + 1,
    CASE 
      WHEN current_streak = 0 THEN CURRENT_DATE 
      ELSE COALESCE((SELECT streak_started_at FROM user_streaks WHERE wallet_address = user_wallet), CURRENT_DATE)
    END,
    current_neft + reward_record.neft_reward,
    current_xp + reward_record.xp_reward,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    current_streak = new_streak,
    longest_streak = GREATEST(new_streak, user_streaks.longest_streak),
    last_claim_date = CURRENT_DATE,
    total_claims = user_streaks.total_claims + 1,
    total_neft_earned = current_neft + reward_record.neft_reward,
    total_xp_earned = current_xp + reward_record.xp_reward,
    last_claimed_at = NOW();

  -- DIRECTLY UPDATE user_balances (NO TRIGGERS)
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    last_updated
  ) VALUES (
    user_wallet,
    current_neft + reward_record.neft_reward,
    current_xp + reward_record.xp_reward,
    current_available_neft + reward_record.neft_reward,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + reward_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + reward_record.xp_reward,
    available_neft = user_balances.available_neft + reward_record.neft_reward,
    last_updated = NOW();

  -- Return success with reward details
  RETURN QUERY SELECT 
    TRUE,
    'Daily reward claimed successfully!'::TEXT,
    new_streak,
    reward_record.neft_reward,
    reward_record.xp_reward,
    reward_record.reward_tier,
    reward_record.cycle_day,
    current_neft + reward_record.neft_reward,
    current_xp + reward_record.xp_reward;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error if something goes wrong
    RETURN QUERY SELECT 
      FALSE,
      'An error occurred while processing your claim: ' || SQLERRM,
      0,
      0.0::DECIMAL(18,8),
      0,
      ''::TEXT,
      0,
      0.0::DECIMAL(18,8),
      0;
END;
$$ LANGUAGE plpgsql;

-- STEP 3: RESET YOUR USER TO START FRESH
UPDATE user_streaks 
SET 
    current_streak = 0,  -- This will make next claim = day 1
    last_claim_date = NULL,
    streak_started_at = NULL,
    total_neft_earned = 0,
    total_xp_earned = 0
WHERE wallet_address = '0x7780E03eF5709441fA566e138B498100C2c7B9F2';

-- Clear today's claim
DELETE FROM daily_claims 
WHERE wallet_address = '0x7780E03eF5709441fA566e138B498100C2c7B9F2' 
AND claim_date = CURRENT_DATE;

-- Reset user balance
UPDATE user_balances 
SET 
    total_neft_claimed = 0,
    total_xp_earned = 0,
    available_neft = 0,
    last_updated = NOW()
WHERE wallet_address = '0x7780E03eF5709441fA566e138B498100C2c7B9F2';

-- STEP 4: TEST THE FUNCTIONS
SELECT 'Testing progressive rewards:' as info;
SELECT * FROM calculate_progressive_daily_reward(1);  -- Should be 5 NEFT + 5 XP
SELECT * FROM calculate_progressive_daily_reward(2);  -- Should be 8 NEFT + 8 XP

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_progressive_daily_reward(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;
