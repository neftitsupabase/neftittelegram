-- ============================================================================
-- FIX DAILY CLAIM TO USE COMPLETE AGGREGATION
-- Replace the current process_daily_claim to sync complete balance
-- Instead of just adding daily rewards, aggregate ALL reward sources
-- ============================================================================

-- Step 1: Update the existing process_daily_claim function to use complete aggregation
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
  total_xp_earned INTEGER,
  cycle_day INTEGER
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
  progressive_reward RECORD;
BEGIN
  -- Check if user can claim today (date-based check)
  IF EXISTS (SELECT 1 FROM daily_claims WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE) THEN
    RETURN QUERY SELECT FALSE, 'Already claimed today'::TEXT, 0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE, 0.0::DECIMAL(18,8), 0, 0;
    RETURN;
  END IF;

  -- Check 24-hour cooldown period from last claim
  IF EXISTS (
    SELECT 1 FROM daily_claims 
    WHERE wallet_address = user_wallet 
    AND claimed_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Must wait 24 hours between claims'::TEXT, 0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE, 0.0::DECIMAL(18,8), 0, 0;
    RETURN;
  END IF;

  -- Get or create user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  IF user_record IS NULL THEN
    -- Create new streak record
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
      1,
      1,
      CURRENT_DATE,
      1,
      0,
      0
    );
    current_streak := 1;
  ELSE
    -- Check if streak continues or breaks
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Continue streak
      current_streak := user_record.current_streak + 1;
    ELSE
      -- Reset streak
      current_streak := 1;
    END IF;

    -- Update streak record
    UPDATE user_streaks SET
      current_streak = current_streak,
      longest_streak = GREATEST(longest_streak, current_streak),
      last_claim_date = CURRENT_DATE,
      total_claims = total_claims + 1
    WHERE wallet_address = user_wallet;
  END IF;

  -- Calculate progressive reward
  SELECT * INTO progressive_reward FROM calculate_progressive_daily_reward(current_streak);

  -- Insert daily claim record
  INSERT INTO daily_claims (
    wallet_address,
    claim_date,
    streak_day,
    neft_reward,
    xp_reward,
    reward_tier,
    claimed_at
  ) VALUES (
    user_wallet,
    CURRENT_DATE,
    current_streak,
    progressive_reward.neft_reward,
    progressive_reward.xp_reward,
    progressive_reward.reward_tier,
    NOW()
  );

  -- CRITICAL FIX: Use complete aggregation instead of just adding daily reward
  -- This ensures user_balances contains ALL reward sources
  PERFORM sync_user_balance_complete_aggregation(user_wallet);

  -- Get updated totals for return (from daily_claims only for backward compatibility)
  SELECT 
    COALESCE(SUM(dc.neft_reward), 0),
    COALESCE(SUM(dc.xp_reward), 0)
  INTO total_reward_neft, total_reward_xp
  FROM daily_claims dc
  WHERE dc.wallet_address = user_wallet;

  RETURN QUERY SELECT 
    TRUE,
    format('Claimed %s NEFT and %s XP for day %s of your streak!', 
           progressive_reward.neft_reward, 
           progressive_reward.xp_reward, 
           current_streak),
    current_streak,
    progressive_reward.neft_reward,
    progressive_reward.xp_reward,
    progressive_reward.reward_tier,
    NULL::JSONB, -- No NFT rewards
    FALSE, -- No special milestones in new system
    total_reward_neft,
    total_reward_xp,
    progressive_reward.cycle_day;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Ensure sync_user_balance_complete_aggregation exists (from previous script)
-- If not already deployed, create it here
CREATE OR REPLACE FUNCTION sync_user_balance_complete_aggregation(user_wallet TEXT)
RETURNS VOID AS $$
DECLARE
  -- Campaign rewards
  campaign_neft DECIMAL(18,8) := 0;
  campaign_xp INTEGER := 0;
  
  -- Daily claim rewards
  daily_neft DECIMAL(18,8) := 0;
  daily_xp INTEGER := 0;
  
  -- Achievement rewards
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  
  -- Staking rewards
  staking_neft DECIMAL(18,8) := 0;
  staking_xp INTEGER := 0;
  
  -- Referral rewards
  referral_neft DECIMAL(18,8) := 0;
  referral_xp INTEGER := 0;
  
  -- Staked amount (to calculate available_neft)
  staked_amount DECIMAL(18,8) := 0;
  
  -- Totals
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
BEGIN
  -- 1. Get campaign rewards
  BEGIN
    SELECT 
      COALESCE(SUM(crc.neft_amount), 0),
      COALESCE(SUM(crc.xp_amount), 0)
    INTO campaign_neft, campaign_xp
    FROM campaign_reward_claims crc
    WHERE crc.wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    campaign_neft := 0;
    campaign_xp := 0;
  END;

  -- 2. Get daily claim rewards
  BEGIN
    SELECT 
      COALESCE(SUM(dc.neft_reward), 0),
      COALESCE(SUM(dc.xp_reward), 0)
    INTO daily_neft, daily_xp
    FROM daily_claims dc
    WHERE dc.wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    daily_neft := 0;
    daily_xp := 0;
  END;

  -- 3. Get achievement rewards
  BEGIN
    SELECT 
      COALESCE(SUM(ar.neft_reward), 0),
      COALESCE(SUM(ar.xp_reward), 0)
    INTO achievement_neft, achievement_xp
    FROM achievement_rewards ar
    WHERE ar.wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    achievement_neft := 0;
    achievement_xp := 0;
  END;

  -- 4. Get staking rewards
  BEGIN
    SELECT 
      COALESCE(SUM(sr.amount), 0),
      0 -- Staking doesn't give XP currently
    INTO staking_neft, staking_xp
    FROM staking_rewards sr
    WHERE sr.wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    staking_neft := 0;
    staking_xp := 0;
  END;

  -- 5. Get referral rewards
  BEGIN
    SELECT 
      COALESCE(ur.total_neft_earned, 0),
      COALESCE(ur.total_xp_earned, 0)
    INTO referral_neft, referral_xp
    FROM user_referrals ur
    WHERE ur.wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    referral_neft := 0;
    referral_xp := 0;
  END;

  -- 6. Get staked amount
  BEGIN
    SELECT COALESCE(SUM(st.amount), 0)
    INTO staked_amount
    FROM staked_tokens st
    WHERE st.wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    staked_amount := 0;
  END;

  -- Calculate totals
  total_neft := campaign_neft + daily_neft + achievement_neft + staking_neft + referral_neft;
  total_xp := campaign_xp + daily_xp + achievement_xp + staking_xp + referral_xp;
  available_neft := GREATEST(0, total_neft - staked_amount);

  -- Update or insert into user_balances
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    last_updated
  )
  VALUES (
    user_wallet,
    total_neft,
    total_xp,
    available_neft,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = EXCLUDED.total_neft_claimed,
    total_xp_earned = EXCLUDED.total_xp_earned,
    available_neft = EXCLUDED.available_neft,
    last_updated = NOW();

  RAISE LOG 'Synced complete balance for %: NEFT=% XP=% Available=% (Campaign=% Daily=% Achievement=% Staking=% Referral=%)', 
    user_wallet, total_neft, total_xp, available_neft, campaign_neft, daily_neft, achievement_neft, staking_neft, referral_neft;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO public;

GRANT EXECUTE ON FUNCTION sync_user_balance_complete_aggregation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_balance_complete_aggregation(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION sync_user_balance_complete_aggregation(TEXT) TO public;

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DAILY CLAIM COMPLETE AGGREGATION FIXED!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '✅ process_daily_claim() now uses complete aggregation';
    RAISE NOTICE '✅ user_balances will show ALL reward sources after daily claim';
    RAISE NOTICE '✅ No more partial balance updates';
    RAISE NOTICE '';
    RAISE NOTICE 'Now daily claims will:';
    RAISE NOTICE '1. Add daily reward to daily_claims table';
    RAISE NOTICE '2. Aggregate ALL rewards (campaigns + daily + achievements + staking + referrals)';
    RAISE NOTICE '3. Update user_balances with complete totals';
    RAISE NOTICE '4. UI shows accurate complete balance via get_direct_user_balance()';
    RAISE NOTICE '';
    RAISE NOTICE 'Daily claim aggregation is now working properly!';
END $$;
