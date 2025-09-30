-- ============================================================================
-- FIX: Daily Claim Balance Integration
-- ============================================================================
-- This script fixes the critical issue where daily claim rewards are not
-- properly integrated with the user_balances table, causing UI display issues.
-- 
-- Root Cause: process_daily_claim function only updates user_streaks and daily_claims
-- tables but never updates user_balances table that the UI reads from.
--
-- Solution: Modify process_daily_claim to also update user_balances table
-- ============================================================================

-- Drop and recreate the process_daily_claim function with balance integration
DROP FUNCTION IF EXISTS process_daily_claim(TEXT);

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
AS $$
DECLARE
  current_streak INTEGER := 0;
  last_claim DATE;
  reward_data RECORD;
  user_record RECORD;
  new_total_neft DECIMAL(18,8);
  new_total_xp INTEGER;
  total_reward_neft DECIMAL(18,8);
  total_reward_xp INTEGER;
BEGIN
  -- Check if user can claim today
  IF EXISTS (SELECT 1 FROM daily_claims WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE) THEN
    RETURN QUERY SELECT FALSE, 'Already claimed today'::TEXT, 0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE, 0.0::DECIMAL(18,8), 0;
    RETURN;
  END IF;

  -- Get or create user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  IF user_record IS NULL THEN
    -- First time user
    current_streak := 1;
    INSERT INTO user_streaks (
      wallet_address, current_streak, longest_streak, last_claim_date, 
      total_claims, streak_started_at, total_neft_earned, total_xp_earned
    ) VALUES (
      user_wallet, 1, 1, CURRENT_DATE, 1, CURRENT_DATE, 0, 0
    );
  ELSE
    -- Check if streak continues or resets
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Streak continues
      current_streak := user_record.current_streak + 1;
    ELSIF user_record.last_claim_date < CURRENT_DATE - INTERVAL '1 day' OR user_record.last_claim_date IS NULL THEN
      -- Streak broken or first claim, reset to 1
      current_streak := 1;
    ELSE
      -- This shouldn't happen, but handle edge case
      current_streak := 1;
    END IF;
  END IF;

  -- Calculate reward
  SELECT * INTO reward_data FROM calculate_daily_reward(current_streak, user_wallet);

  -- Calculate total rewards for this claim
  total_reward_neft := reward_data.base_neft + reward_data.bonus_neft;
  total_reward_xp := reward_data.base_xp + reward_data.bonus_xp;

  -- Calculate new totals for user_streaks
  new_total_neft := COALESCE(user_record.total_neft_earned, 0) + total_reward_neft;
  new_total_xp := COALESCE(user_record.total_xp_earned, 0) + total_reward_xp;

  -- Update user streaks using proper variable references to avoid ambiguity
  UPDATE user_streaks us SET
    current_streak = process_daily_claim.current_streak,
    longest_streak = GREATEST(COALESCE(us.longest_streak, 0), process_daily_claim.current_streak),
    last_claim_date = CURRENT_DATE,
    total_claims = COALESCE(us.total_claims, 0) + 1,
    total_neft_earned = new_total_neft,
    total_xp_earned = new_total_xp,
    last_updated = NOW(),
    streak_started_at = CASE 
      WHEN process_daily_claim.current_streak = 1 THEN CURRENT_DATE 
      ELSE COALESCE(us.streak_started_at, CURRENT_DATE)
    END
  WHERE us.wallet_address = user_wallet;

  -- Record the claim
  INSERT INTO daily_claims (
    wallet_address, claim_date, streak_count, 
    base_neft_reward, bonus_neft_reward, 
    base_xp_reward, bonus_xp_reward,
    nft_reward, reward_tier
  ) VALUES (
    user_wallet, CURRENT_DATE, current_streak,
    reward_data.base_neft, reward_data.bonus_neft,
    reward_data.base_xp, reward_data.bonus_xp,
    reward_data.nft_reward, reward_data.reward_tier
  );

  -- ============================================================================
  -- CRITICAL FIX: Update user_balances table
  -- ============================================================================
  -- This is the missing piece that caused balance display issues
  -- Insert or update user_balances with the daily claim rewards
  INSERT INTO user_balances (
    wallet_address, 
    total_neft_claimed, 
    total_xp_earned, 
    available_neft,
    available_xp,
    last_updated
  ) VALUES (
    user_wallet, 
    total_reward_neft, 
    total_reward_xp,
    total_reward_neft, -- Available NEFT = total claimed (not staked)
    total_reward_xp,   -- Available XP = total earned
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + total_reward_neft,
    total_xp_earned = user_balances.total_xp_earned + total_reward_xp,
    available_neft = user_balances.available_neft + total_reward_neft,
    available_xp = user_balances.available_xp + total_reward_xp,
    last_updated = NOW();

  -- Return success result
  RETURN QUERY SELECT 
    TRUE, 
    CASE 
      WHEN reward_data.is_milestone THEN 'Milestone achieved! ' || reward_data.reward_tier || ' unlocked!'
      ELSE 'Daily reward claimed successfully!'
    END,
    current_streak,
    total_reward_neft,
    total_reward_xp,
    reward_data.reward_tier,
    reward_data.nft_reward,
    reward_data.is_milestone,
    new_total_neft,
    new_total_xp;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_daily_claim IS 'Enhanced daily claim processing with user_balances integration - FIXED VERSION';

-- ============================================================================
-- Additional helper function to sync existing daily claims to user_balances
-- ============================================================================
-- This function can be used to backfill user_balances with existing daily claim data
-- if needed (run once to sync historical data)

CREATE OR REPLACE FUNCTION sync_daily_claims_to_user_balances()
RETURNS TEXT
SECURITY DEFINER
AS $$
DECLARE
  claim_record RECORD;
  sync_count INTEGER := 0;
BEGIN
  -- Loop through all daily claims and ensure they're reflected in user_balances
  FOR claim_record IN 
    SELECT 
      wallet_address,
      SUM(base_neft_reward + bonus_neft_reward) as total_neft,
      SUM(base_xp_reward + bonus_xp_reward) as total_xp
    FROM daily_claims 
    GROUP BY wallet_address
  LOOP
    -- Insert or update user_balances
    INSERT INTO user_balances (
      wallet_address, 
      total_neft_claimed, 
      total_xp_earned, 
      available_neft,
      available_xp,
      last_updated
    ) VALUES (
      claim_record.wallet_address, 
      claim_record.total_neft, 
      claim_record.total_xp,
      claim_record.total_neft,
      claim_record.total_xp,
      NOW()
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      -- Only update if the daily claim totals are higher (to avoid overwriting other sources)
      total_neft_claimed = GREATEST(user_balances.total_neft_claimed, claim_record.total_neft),
      total_xp_earned = GREATEST(user_balances.total_xp_earned, claim_record.total_xp),
      available_neft = GREATEST(user_balances.available_neft, claim_record.total_neft),
      available_xp = GREATEST(user_balances.available_xp, claim_record.total_xp),
      last_updated = NOW();
    
    sync_count := sync_count + 1;
  END LOOP;
  
  RETURN 'Synced ' || sync_count || ' user balances with daily claim data';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_daily_claims_to_user_balances IS 'One-time sync function to backfill user_balances with existing daily claim data';
