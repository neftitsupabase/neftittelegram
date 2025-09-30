-- TEST: Check if existing daily claims sync system works
-- Fixed version that handles both TEXT and JSON return types

-- Step 1: Check what type of sync function we have
SELECT 
    proname as function_name,
    prorettype::regtype as return_type,
    CASE 
        WHEN prosrc LIKE '%daily_claims%' THEN '✅ Includes daily_claims'
        ELSE '❌ Missing daily_claims aggregation'
    END as daily_claims_check
FROM pg_proc 
WHERE proname = 'sync_user_balance_from_all_sources';

-- Step 2: Test the sync system with proper type handling
DO $$
DECLARE
    test_wallet TEXT := 'test_existing_sync_' || extract(epoch from now())::text;
    sync_result_text TEXT;
    sync_result_json JSON;
    daily_claim_total DECIMAL(10,4);
    function_return_type TEXT;
BEGIN
    RAISE NOTICE 'Testing existing sync system with wallet: %', test_wallet;
    
    -- Check function return type
    SELECT prorettype::regtype INTO function_return_type
    FROM pg_proc 
    WHERE proname = 'sync_user_balance_from_all_sources';
    
    RAISE NOTICE 'Function returns: %', function_return_type;
    
    -- Step 3: Insert a daily claim manually (simulating process_daily_claim)
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
        25.0000, 
        30, 
        1, 
        1, 
        NOW(), 
        CURRENT_DATE
    );
    
    RAISE NOTICE 'Daily claim inserted: 25 NEFT, 30 XP';
    
    -- Step 4: Call sync function based on return type
    IF function_return_type = 'json' THEN
        SELECT sync_user_balance_from_all_sources(test_wallet) INTO sync_result_json;
        RAISE NOTICE 'Sync result (JSON): %', sync_result_json;
        
        -- Check if daily claims are included
        IF (sync_result_json->>'total_neft_claimed')::DECIMAL >= 25.0000 THEN
            RAISE NOTICE '✅ SUCCESS: Daily claims included in JSON sync function';
        ELSE
            RAISE NOTICE '❌ PROBLEM: Daily claims NOT included in JSON sync function';
        END IF;
        
    ELSE
        SELECT sync_user_balance_from_all_sources(test_wallet) INTO sync_result_text;
        RAISE NOTICE 'Sync result (TEXT): %', sync_result_text;
        
        -- Check if sync was successful
        IF sync_result_text LIKE 'SUCCESS%' OR sync_result_text LIKE 'Synced%' THEN
            RAISE NOTICE '✅ Sync function executed successfully';
            
            -- Check user_balances table for the result
            IF EXISTS (SELECT 1 FROM user_balances WHERE wallet_address = test_wallet AND total_neft_claimed >= 25.0000) THEN
                RAISE NOTICE '✅ SUCCESS: Daily claims included in TEXT sync function';
            ELSE
                RAISE NOTICE '❌ PROBLEM: Daily claims NOT included in TEXT sync function';
            END IF;
        ELSE
            RAISE NOTICE '❌ Sync function failed: %', sync_result_text;
        END IF;
    END IF;
    
    -- Step 5: Check daily claims total in database
    SELECT COALESCE(SUM(neft_reward), 0) INTO daily_claim_total
    FROM daily_claims 
    WHERE wallet_address = test_wallet;
    
    RAISE NOTICE 'Total daily claims in database: % NEFT', daily_claim_total;
    
    -- Step 6: Check user_balances table
    IF EXISTS (SELECT 1 FROM user_balances WHERE wallet_address = test_wallet) THEN
        RAISE NOTICE 'user_balances entry: %', (
            SELECT json_build_object(
                'total_neft_claimed', total_neft_claimed,
                'total_xp_earned', total_xp_earned,
                'available_neft', available_neft
            )
            FROM user_balances 
            WHERE wallet_address = test_wallet
        );
    ELSE
        RAISE NOTICE '❌ No user_balances entry created';
    END IF;
    
    -- Step 7: Clean up test data
    DELETE FROM daily_claims WHERE wallet_address = test_wallet;
    DELETE FROM user_balances WHERE wallet_address = test_wallet;
    
    RAISE NOTICE '🧹 Test data cleaned up';
    
END $$;

-- Final diagnosis
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 DIAGNOSIS COMPLETE';
    RAISE NOTICE '';
    RAISE NOTICE 'If the test shows:';
    RAISE NOTICE '✅ SUCCESS = Daily claims are properly aggregated';
    RAISE NOTICE '❌ PROBLEM = Need to add daily_claims to sync function';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps based on results:';
    RAISE NOTICE '1. If SUCCESS: Check DailyClaimsService integration';
    RAISE NOTICE '2. If PROBLEM: Update sync function to include daily_claims table';
END $$;
