-- DEBUG: Why daily claims balance sync is not working after Option 1 deployment
-- This script will help identify the root cause

-- Step 1: Check which aggregation function is currently deployed
SELECT 'Current aggregation function source:' as debug_step;
SELECT prosrc as current_function_source
FROM pg_proc 
WHERE proname = 'aggregate_user_rewards_from_all_sources';

-- Step 2: Check which sync function is currently deployed  
SELECT 'Current sync function source:' as debug_step;
SELECT prosrc as current_sync_function_source
FROM pg_proc 
WHERE proname = 'sync_user_balance_from_all_sources';

-- Step 3: Check daily_claims table structure
SELECT 'Daily claims table columns:' as debug_step;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_claims' 
ORDER BY ordinal_position;

-- Step 4: Test with actual daily claims data
DO $$
DECLARE
    test_wallet TEXT := 'test_debug_wallet_' || extract(epoch from now());
    aggregation_result JSON;
    sync_result TEXT;
    balance_before RECORD;
    balance_after RECORD;
BEGIN
    RAISE NOTICE '=== DEBUGGING DAILY CLAIMS SYNC ISSUE ===';
    RAISE NOTICE 'Test wallet: %', test_wallet;
    
    -- Check balance before (should be empty)
    SELECT total_neft_claimed, total_xp_earned INTO balance_before
    FROM user_balances WHERE wallet_address = test_wallet;
    
    IF balance_before IS NULL THEN
        RAISE NOTICE 'No existing balance record (expected)';
    ELSE
        RAISE NOTICE 'Existing balance: NEFT=%, XP=%', balance_before.total_neft_claimed, balance_before.total_xp_earned;
    END IF;
    
    -- Insert test daily claim with correct column names
    INSERT INTO daily_claims (
        wallet_address, 
        claim_date, 
        streak_count,
        base_neft_reward, 
        bonus_neft_reward,
        base_xp_reward, 
        bonus_xp_reward
    ) VALUES (
        test_wallet, 
        CURRENT_DATE, 
        1,
        50.0, 
        25.0,
        100, 
        50
    );
    
    RAISE NOTICE 'Inserted test daily claim: 75 NEFT (50+25), 150 XP (100+50)';
    
    -- Test aggregation function directly
    BEGIN
        SELECT aggregate_user_rewards_from_all_sources(test_wallet) INTO aggregation_result;
        RAISE NOTICE 'Aggregation result: %', aggregation_result;
        
        -- Check if daily claims are included
        IF (aggregation_result->>'total_neft_claimed')::DECIMAL >= 75.0 THEN
            RAISE NOTICE '✅ Daily claims ARE included in aggregation';
        ELSE
            RAISE NOTICE '❌ Daily claims NOT included in aggregation';
            RAISE NOTICE 'Expected: 75+ NEFT, Got: % NEFT', aggregation_result->>'total_neft_claimed';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Aggregation function failed: %', SQLERRM;
    END;
    
    -- Test sync function
    BEGIN
        SELECT sync_user_balance_from_all_sources(test_wallet) INTO sync_result;
        RAISE NOTICE 'Sync result: %', sync_result;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Sync function failed: %', SQLERRM;
    END;
    
    -- Check balance after sync
    SELECT total_neft_claimed, total_xp_earned INTO balance_after
    FROM user_balances WHERE wallet_address = test_wallet;
    
    IF balance_after IS NULL THEN
        RAISE NOTICE '❌ No balance record created after sync';
    ELSE
        RAISE NOTICE 'Balance after sync: NEFT=%, XP=%', balance_after.total_neft_claimed, balance_after.total_xp_earned;
        
        IF balance_after.total_neft_claimed >= 75.0 THEN
            RAISE NOTICE '✅ SUCCESS: Daily claims properly synced to user_balances!';
        ELSE
            RAISE NOTICE '❌ FAILED: Daily claims not reflected in user_balances';
        END IF;
    END IF;
    
    -- Clean up test data
    DELETE FROM daily_claims WHERE wallet_address = test_wallet;
    DELETE FROM user_balances WHERE wallet_address = test_wallet;
    
    RAISE NOTICE '🧹 Test data cleaned up';
    RAISE NOTICE '=== DEBUG COMPLETE ===';
END $$;
