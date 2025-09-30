-- Identify which sync function is overwriting staking claim rewards
-- The balance functions list shows multiple sync functions that could interfere

-- 1. Check the most likely culprits
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name IN (
    'sync_user_balance_from_all_sources',
    'update_staking_balance', 
    'sync_staking_balance',
    'trigger_comprehensive_balance_sync',
    'sync_available_neft'
)
AND routine_type = 'FUNCTION';

-- 2. Check if these functions are called by triggers
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE action_statement ILIKE '%sync_user_balance%'
   OR action_statement ILIKE '%update_staking_balance%'
   OR action_statement ILIKE '%sync_staking_balance%'
   OR action_statement ILIKE '%sync_available_neft%';

-- 3. Test if sync functions overwrite manual balance updates
CREATE OR REPLACE FUNCTION test_sync_interference(user_wallet TEXT)
RETURNS TABLE(
    test_step TEXT,
    balance_before DECIMAL(18,8),
    balance_after DECIMAL(18,8),
    notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    initial_balance DECIMAL(18,8);
    after_manual_update DECIMAL(18,8);
    after_sync DECIMAL(18,8);
    test_amount DECIMAL(18,8) := 10.0;
BEGIN
    -- Step 1: Get initial balance
    SELECT COALESCE(total_neft_claimed, 0) INTO initial_balance
    FROM user_balances WHERE wallet_address = user_wallet;
    
    RETURN QUERY SELECT 
        'Initial'::TEXT, 
        initial_balance, 
        initial_balance, 
        'Starting balance'::TEXT;
    
    -- Step 2: Manual balance update (like our claim function does)
    UPDATE user_balances 
    SET total_neft_claimed = total_neft_claimed + test_amount
    WHERE wallet_address = user_wallet;
    
    SELECT COALESCE(total_neft_claimed, 0) INTO after_manual_update
    FROM user_balances WHERE wallet_address = user_wallet;
    
    RETURN QUERY SELECT 
        'After Manual Update'::TEXT, 
        initial_balance, 
        after_manual_update, 
        format('Added %s manually', test_amount)::TEXT;
    
    -- Step 3: Call sync function to see if it overwrites
    BEGIN
        PERFORM sync_user_balance_from_all_sources(user_wallet);
        
        SELECT COALESCE(total_neft_claimed, 0) INTO after_sync
        FROM user_balances WHERE wallet_address = user_wallet;
        
        RETURN QUERY SELECT 
            'After Sync Function'::TEXT, 
            after_manual_update, 
            after_sync, 
            CASE 
                WHEN after_sync = after_manual_update THEN '✅ No interference'
                ELSE format('❌ INTERFERENCE! Expected: %s, Got: %s', after_manual_update, after_sync)
            END::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Sync Function Error'::TEXT, 
            after_manual_update, 
            after_manual_update, 
            'Function failed or not found'::TEXT;
    END;
    
    -- Step 4: Test update_staking_balance if it exists
    BEGIN
        PERFORM update_staking_balance(user_wallet);
        
        SELECT COALESCE(total_neft_claimed, 0) INTO after_sync
        FROM user_balances WHERE wallet_address = user_wallet;
        
        RETURN QUERY SELECT 
            'After Staking Balance Update'::TEXT, 
            after_manual_update, 
            after_sync, 
            CASE 
                WHEN after_sync = after_manual_update THEN '✅ No interference'
                ELSE format('❌ INTERFERENCE! Expected: %s, Got: %s', after_manual_update, after_sync)
            END::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Staking Balance Update Error'::TEXT, 
            after_manual_update, 
            after_manual_update, 
            'Function failed or not found'::TEXT;
    END;
    
    -- Cleanup: Restore original balance
    UPDATE user_balances 
    SET total_neft_claimed = initial_balance
    WHERE wallet_address = user_wallet;
END;
$$;

-- 4. Check if UserBalanceService calls any of these functions
CREATE OR REPLACE FUNCTION find_balance_service_calls()
RETURNS TABLE(
    function_name TEXT,
    calls_sync_functions BOOLEAN,
    sync_calls TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        routine_name::TEXT,
        (routine_definition ILIKE '%sync_user_balance%' OR 
         routine_definition ILIKE '%update_staking_balance%' OR
         routine_definition ILIKE '%sync_staking_balance%'),
        CASE 
            WHEN routine_definition ILIKE '%sync_user_balance%' THEN 'sync_user_balance'
            WHEN routine_definition ILIKE '%update_staking_balance%' THEN 'update_staking_balance'  
            WHEN routine_definition ILIKE '%sync_staking_balance%' THEN 'sync_staking_balance'
            ELSE 'none'
        END::TEXT
    FROM information_schema.routines 
    WHERE routine_name IN ('add_user_balance', 'get_user_complete_balance', 'process_daily_claim')
    AND routine_type = 'FUNCTION';
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION test_sync_interference(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION find_balance_service_calls() TO authenticated, anon, public;

DO $$
BEGIN
    RAISE NOTICE '=== SYNC INTERFERENCE ANALYSIS READY ===';
    RAISE NOTICE 'Run with your wallet:';
    RAISE NOTICE '1. SELECT * FROM test_sync_interference(''your_wallet'');';
    RAISE NOTICE '2. SELECT * FROM find_balance_service_calls();';
    RAISE NOTICE '3. Check sync function definitions above';
    RAISE NOTICE '4. Check triggers that call sync functions';
END $$;
