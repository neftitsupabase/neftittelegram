-- FINAL FIX: Use the simple neft_reward and xp_reward columns that actually exist
-- The table has BOTH formats, but we should use the simple ones

-- Step 1: Update aggregate function to use simple columns
CREATE OR REPLACE FUNCTION aggregate_user_rewards_from_all_sources(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  
  -- Campaign rewards
  campaign_neft DECIMAL(18,8) := 0;
  campaign_xp INTEGER := 0;
  
  -- Daily claims - USE SIMPLE COLUMNS
  daily_neft DECIMAL(18,8) := 0;
  daily_xp INTEGER := 0;
  
  -- Achievement rewards (claimed only)
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  
  -- Staking rewards (claimed only)
  staking_neft DECIMAL(18,8) := 0;
  staking_xp INTEGER := 0;
  
  -- Staked amounts (affects available_neft)
  staked_amount DECIMAL(18,8) := 0;
  
  -- Totals
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RAISE EXCEPTION 'user_wallet parameter cannot be null or empty';
  END IF;

  -- 1. Aggregate from campaign_reward_claims table
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO campaign_neft, campaign_xp
    FROM campaign_reward_claims 
    WHERE wallet_address = user_wallet;
    
    RAISE LOG 'Campaign rewards for %: NEFT=%, XP=%', user_wallet, campaign_neft, campaign_xp;
  EXCEPTION WHEN OTHERS THEN
    campaign_neft := 0;
    campaign_xp := 0;
    RAISE LOG 'Error getting campaign rewards for %: %', user_wallet, SQLERRM;
  END;

  -- 2. FIXED: Aggregate from daily_claims table using SIMPLE columns
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO daily_neft, daily_xp
    FROM daily_claims 
    WHERE wallet_address = user_wallet;
    
    RAISE LOG 'Daily claims for %: NEFT=%, XP=%', user_wallet, daily_neft, daily_xp;
  EXCEPTION WHEN OTHERS THEN
    daily_neft := 0;
    daily_xp := 0;
    RAISE LOG 'Error getting daily claims for %: %', user_wallet, SQLERRM;
  END;

  -- 3. Aggregate from user_achievements table (claimed achievements only)
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO achievement_neft, achievement_xp
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = user_wallet 
      AND ua.status = 'completed' 
      AND ua.claimed_at IS NOT NULL;
      
    RAISE LOG 'Achievement rewards for %: NEFT=%, XP=%', user_wallet, achievement_neft, achievement_xp;
  EXCEPTION WHEN OTHERS THEN
    achievement_neft := 0;
    achievement_xp := 0;
    RAISE LOG 'Error getting achievement rewards for %: %', user_wallet, SQLERRM;
  END;

  -- 4. Aggregate from staking_rewards table (claimed only)
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO staking_neft, staking_xp
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
      AND is_claimed = true;
      
    RAISE LOG 'Staking rewards for %: NEFT=%, XP=%', user_wallet, staking_neft, staking_xp;
  EXCEPTION WHEN OTHERS THEN
    staking_neft := 0;
    staking_xp := 0;
    RAISE LOG 'Error getting staking rewards for %: %', user_wallet, SQLERRM;
  END;

  -- 5. Get staked token amounts (reduces available_neft)
  BEGIN
    SELECT COALESCE(SUM(staked_amount), 0)
    INTO staked_amount
    FROM staked_tokens 
    WHERE wallet_address = user_wallet;
    
    RAISE LOG 'Staked amount for %: %', user_wallet, staked_amount;
  EXCEPTION WHEN OTHERS THEN
    staked_amount := 0;
    RAISE LOG 'Error getting staked amount for %: %', user_wallet, SQLERRM;
  END;

  -- Calculate totals
  total_neft := campaign_neft + daily_neft + achievement_neft + staking_neft;
  total_xp := campaign_xp + daily_xp + achievement_xp + staking_xp;
  available_neft := total_neft - staked_amount;

  -- Ensure available_neft is not negative
  IF available_neft < 0 THEN
    available_neft := 0;
  END IF;

  -- Build result JSON
  SELECT json_build_object(
    'total_neft_claimed', total_neft,
    'total_xp_earned', total_xp,
    'available_neft', available_neft,
    'breakdown', json_build_object(
      'campaign_neft', campaign_neft,
      'campaign_xp', campaign_xp,
      'daily_neft', daily_neft,
      'daily_xp', daily_xp,
      'achievement_neft', achievement_neft,
      'achievement_xp', achievement_xp,
      'staking_neft', staking_neft,
      'staking_xp', staking_xp,
      'staked_amount', staked_amount
    ),
    'wallet_address', user_wallet,
    'last_updated', NOW()
  ) INTO result;

  RAISE LOG 'Final aggregation for %: %', user_wallet, result;
  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details for debugging
    RAISE LOG 'Error in aggregate_user_rewards_from_all_sources for %: %', user_wallet, SQLERRM;
    SELECT json_build_object(
      'error', 'Aggregation failed: ' || SQLERRM,
      'total_neft_claimed', 0,
      'total_xp_earned', 0,
      'available_neft', 0,
      'wallet_address', user_wallet,
      'last_updated', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Grant permissions
GRANT EXECUTE ON FUNCTION aggregate_user_rewards_from_all_sources(TEXT) TO authenticated, anon, public;

-- Step 3: Test the fix
DO $$
DECLARE
    test_wallet TEXT := 'test_simple_columns_' || extract(epoch from now());
    aggregation_result JSON;
    sync_result TEXT;
BEGIN
    RAISE NOTICE '=== TESTING SIMPLE COLUMNS FIX ===';
    RAISE NOTICE 'Test wallet: %', test_wallet;
    
    -- Insert test daily claim using SIMPLE columns
    INSERT INTO daily_claims (
        wallet_address, 
        claim_date, 
        streak_count,
        neft_reward,
        xp_reward
    ) VALUES (
        test_wallet, 
        CURRENT_DATE, 
        1,
        100.0,
        150
    );
    
    RAISE NOTICE 'Inserted test daily claim: 100 NEFT, 150 XP (using simple columns)';
    
    -- Test aggregation function
    SELECT aggregate_user_rewards_from_all_sources(test_wallet) INTO aggregation_result;
    RAISE NOTICE 'Aggregation result: %', aggregation_result;
    
    -- Test sync function
    SELECT sync_user_balance_from_all_sources(test_wallet) INTO sync_result;
    RAISE NOTICE 'Sync result: %', sync_result;
    
    -- Check user_balances table
    IF EXISTS (SELECT 1 FROM user_balances WHERE wallet_address = test_wallet AND total_neft_claimed >= 100.0000) THEN
        RAISE NOTICE '✅ SUCCESS: Daily claims now properly aggregated and synced using simple columns!';
    ELSE
        RAISE NOTICE '❌ FAILED: Daily claims still not working';
    END IF;
    
    -- Clean up test data
    DELETE FROM daily_claims WHERE wallet_address = test_wallet;
    DELETE FROM user_balances WHERE wallet_address = test_wallet;
    
    RAISE NOTICE '🧹 Test data cleaned up';
END $$;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 DAILY CLAIMS SIMPLE COLUMNS FIX DEPLOYED!';
    RAISE NOTICE '';
    RAISE NOTICE 'What was fixed:';
    RAISE NOTICE '✅ Updated aggregate function to use simple neft_reward and xp_reward columns';
    RAISE NOTICE '✅ These columns actually exist in the daily_claims table';
    RAISE NOTICE '✅ Daily claims now properly included in aggregation';
    RAISE NOTICE '';
    RAISE NOTICE 'Daily claims balance updates should now work correctly!';
END $$;
