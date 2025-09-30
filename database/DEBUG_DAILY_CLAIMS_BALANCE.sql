-- DEBUG: Daily Claims Balance Update Issue
-- This script checks if the trigger system is properly deployed

-- 1. Check if trigger function exists
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE proname = 'update_user_balance_after_daily_claim';

-- 2. Check if trigger exists on daily_claims table
SELECT 
    t.tgname as trigger_name,
    t.tgenabled as trigger_enabled,
    c.relname as table_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'daily_claims'
AND t.tgname = 'sync_user_balance_on_daily_claim';

-- 3. Check recent daily_claims entries
SELECT 
    wallet_address,
    neft_reward,
    xp_reward,
    claimed_at,
    streak_day
FROM daily_claims 
ORDER BY claimed_at DESC 
LIMIT 5;

-- 4. Check corresponding user_balances entries
SELECT 
    ub.wallet_address,
    ub.total_neft_claimed,
    ub.total_xp_earned,
    ub.available_neft,
    ub.last_updated
FROM user_balances ub
WHERE ub.wallet_address IN (
    SELECT wallet_address 
    FROM daily_claims 
    ORDER BY claimed_at DESC 
    LIMIT 5
);

-- 5. Test trigger manually (if needed)
-- This will show if the trigger function works
DO $$
DECLARE
    test_wallet TEXT := 'test_wallet_for_debug';
    test_neft DECIMAL(10,4) := 10.0000;
    test_xp INTEGER := 15;
BEGIN
    -- Clean up test data first
    DELETE FROM daily_claims WHERE wallet_address = test_wallet;
    DELETE FROM user_balances WHERE wallet_address = test_wallet;
    
    -- Insert test daily claim (should trigger balance update)
    INSERT INTO daily_claims (wallet_address, neft_reward, xp_reward, streak_day, streak_count, claimed_at, claim_date)
    VALUES (test_wallet, test_neft, test_xp, 1, 1, NOW(), CURRENT_DATE);
    
    -- Check if user_balances was updated
    IF EXISTS (SELECT 1 FROM user_balances WHERE wallet_address = test_wallet) THEN
        RAISE NOTICE '✅ TRIGGER WORKING: user_balances updated automatically';
        
        -- Show the balance
        DECLARE
            balance_neft DECIMAL(10,4);
            balance_xp INTEGER;
        BEGIN
            SELECT total_neft_claimed, total_xp_earned 
            INTO balance_neft, balance_xp
            FROM user_balances 
            WHERE wallet_address = test_wallet;
            
            RAISE NOTICE 'Balance: % NEFT, % XP', balance_neft, balance_xp;
        END;
    ELSE
        RAISE NOTICE '❌ TRIGGER NOT WORKING: user_balances not updated';
    END IF;
    
    -- Clean up test data
    DELETE FROM daily_claims WHERE wallet_address = test_wallet;
    DELETE FROM user_balances WHERE wallet_address = test_wallet;
END $$;

-- 6. Check if sync_user_balance_from_all_sources function exists (backup sync)
SELECT 
    proname as function_name,
    proargnames as argument_names
FROM pg_proc 
WHERE proname = 'sync_user_balance_from_all_sources';
