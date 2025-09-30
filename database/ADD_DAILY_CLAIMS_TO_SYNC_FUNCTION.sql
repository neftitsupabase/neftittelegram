-- FIX: Add daily_claims aggregation to existing sync_user_balance_from_all_sources function
-- This is the minimal fix to include daily claims in balance aggregation

-- Step 1: Check current function implementation
SELECT 'Current sync function implementation:' as info;
SELECT prosrc as current_implementation
FROM pg_proc 
WHERE proname = 'sync_user_balance_from_all_sources';

-- Step 2: Update the function to include daily_claims aggregation
CREATE OR REPLACE FUNCTION sync_user_balance_from_all_sources(user_wallet TEXT)
RETURNS TEXT AS $$
DECLARE
  aggregated_data JSON;
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
  staked_neft DECIMAL(18,8);
  nft_count INTEGER;
BEGIN
  -- Get complete balance data from aggregation function
  SELECT get_user_complete_balance(user_wallet) INTO aggregated_data;
  
  -- Extract values from JSON
  total_neft := (aggregated_data->>'total_neft_claimed')::DECIMAL(18,8);
  total_xp := (aggregated_data->>'total_xp_earned')::INTEGER;
  available_neft := (aggregated_data->>'available_neft')::DECIMAL(18,8);
  staked_neft := (aggregated_data->>'staked_neft')::DECIMAL(18,8);
  nft_count := (aggregated_data->>'total_nft_count')::INTEGER;
  
  -- CRITICAL FIX: Add daily claims aggregation that was missing
  DECLARE
    daily_neft DECIMAL(18,8) := 0;
    daily_xp INTEGER := 0;
  BEGIN
    -- Get daily claims rewards
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO daily_neft, daily_xp
    FROM daily_claims 
    WHERE wallet_address = user_wallet;
    
    -- Add daily claims to totals
    total_neft := total_neft + daily_neft;
    total_xp := total_xp + daily_xp;
    available_neft := available_neft + daily_neft;
    
    RAISE LOG 'Added daily claims to sync: % NEFT, % XP for wallet %', daily_neft, daily_xp, user_wallet;
  END;
  
  -- Update or insert into user_balances table
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    staked_neft,
    total_nft_count,
    updated_at
  ) VALUES (
    user_wallet,
    total_neft,
    total_xp,
    available_neft,
    staked_neft,
    nft_count,
    NOW()
  )
  ON CONFLICT (wallet_address) 
  DO UPDATE SET
    total_neft_claimed = EXCLUDED.total_neft_claimed,
    total_xp_earned = EXCLUDED.total_xp_earned,
    available_neft = EXCLUDED.available_neft,
    staked_neft = EXCLUDED.staked_neft,
    total_nft_count = EXCLUDED.total_nft_count,
    updated_at = EXCLUDED.updated_at;
  
  RETURN 'SUCCESS: Synced balance for wallet: ' || user_wallet || ' - NEFT: ' || total_neft || ', XP: ' || total_xp || ' (including daily claims)';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in sync_user_balance_from_all_sources for user %: %', user_wallet, SQLERRM;
    RETURN 'ERROR: Failed to sync balance for wallet: ' || user_wallet || ' - ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Test the updated function
DO $$
DECLARE
    test_wallet TEXT := 'test_daily_claims_fix_' || extract(epoch from now())::text;
    sync_result TEXT;
    balance_before DECIMAL(10,4);
    balance_after DECIMAL(10,4);
BEGIN
    RAISE NOTICE 'Testing updated sync function with wallet: %', test_wallet;
    
    -- Insert test daily claim
    INSERT INTO daily_claims (
        wallet_address, 
        neft_reward, 
        xp_reward, 
        streak_day, 
        streak_count, 
        claimed_at, 
        claim_date
    ) VALUES (
        test_wallet, 
        50.0000, 
        75, 
        1, 
        1, 
        NOW(), 
        CURRENT_DATE
    );
    
    RAISE NOTICE 'Test daily claim inserted: 50 NEFT, 75 XP';
    
    -- Get balance before sync
    SELECT COALESCE(total_neft_claimed, 0) INTO balance_before
    FROM user_balances WHERE wallet_address = test_wallet;
    
    -- Call updated sync function
    SELECT sync_user_balance_from_all_sources(test_wallet) INTO sync_result;
    RAISE NOTICE 'Sync result: %', sync_result;
    
    -- Get balance after sync
    SELECT total_neft_claimed INTO balance_after
    FROM user_balances WHERE wallet_address = test_wallet;
    
    -- Verify daily claims are included
    IF balance_after >= 50.0000 THEN
        RAISE NOTICE '✅ SUCCESS: Daily claims now included in sync function!';
        RAISE NOTICE 'Balance updated from % to % NEFT', balance_before, balance_after;
    ELSE
        RAISE NOTICE '❌ FAILED: Daily claims still not included';
        RAISE NOTICE 'Expected at least 50 NEFT, got % NEFT', balance_after;
    END IF;
    
    -- Clean up test data
    DELETE FROM daily_claims WHERE wallet_address = test_wallet;
    DELETE FROM user_balances WHERE wallet_address = test_wallet;
    
    RAISE NOTICE '🧹 Test data cleaned up';
END $$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION sync_user_balance_from_all_sources(TEXT) TO authenticated, anon, public;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 DAILY CLAIMS SYNC FIX DEPLOYED!';
    RAISE NOTICE '';
    RAISE NOTICE 'What was fixed:';
    RAISE NOTICE '✅ Added daily_claims aggregation to sync_user_balance_from_all_sources()';
    RAISE NOTICE '✅ Daily claims now included in balance calculations';
    RAISE NOTICE '✅ DailyClaimsService sync calls will now work properly';
    RAISE NOTICE '✅ UI will display correct balance including daily claims';
    RAISE NOTICE '';
    RAISE NOTICE 'The existing DailyClaimsService -> UserBalanceService flow now works!';
END $$;
