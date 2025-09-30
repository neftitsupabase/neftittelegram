-- Simple test to isolate the balance overwrite issue
-- This will help us identify exactly where the problem occurs

-- 1. First, let's manually test the balance accumulation logic
-- Replace with your actual wallet address
DO $$
DECLARE
    test_wallet TEXT := 'YOUR_WALLET_ADDRESS_HERE'; -- REPLACE THIS!
    initial_balance DECIMAL(18,8);
    test_amount1 DECIMAL(18,8) := 10.50;
    test_amount2 DECIMAL(18,8) := 5.25;
    balance_after_first DECIMAL(18,8);
    balance_after_second DECIMAL(18,8);
BEGIN
    -- Get initial balance
    SELECT COALESCE(total_neft_claimed, 0) INTO initial_balance
    FROM user_balances WHERE wallet_address = test_wallet;
    
    RAISE NOTICE '=== BALANCE ACCUMULATION TEST ===';
    RAISE NOTICE 'Initial balance: %', initial_balance;
    
    -- Test first addition
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
    VALUES (test_wallet, test_amount1, test_amount1, 0)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = COALESCE(user_balances.total_neft_claimed, 0) + test_amount1,
        available_neft = COALESCE(user_balances.available_neft, 0) + test_amount1;
    
    SELECT COALESCE(total_neft_claimed, 0) INTO balance_after_first
    FROM user_balances WHERE wallet_address = test_wallet;
    
    RAISE NOTICE 'After adding %: % (expected: %)', test_amount1, balance_after_first, initial_balance + test_amount1;
    
    -- Test second addition
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
    VALUES (test_wallet, test_amount2, test_amount2, 0)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = COALESCE(user_balances.total_neft_claimed, 0) + test_amount2,
        available_neft = COALESCE(user_balances.available_neft, 0) + test_amount2;
    
    SELECT COALESCE(total_neft_claimed, 0) INTO balance_after_second
    FROM user_balances WHERE wallet_address = test_wallet;
    
    RAISE NOTICE 'After adding %: % (expected: %)', test_amount2, balance_after_second, balance_after_first + test_amount2;
    
    -- Check if accumulation worked
    IF balance_after_second = initial_balance + test_amount1 + test_amount2 THEN
        RAISE NOTICE '✅ Balance accumulation works correctly';
    ELSE
        RAISE NOTICE '❌ Balance accumulation FAILED';
        RAISE NOTICE 'Expected: %, Got: %', initial_balance + test_amount1 + test_amount2, balance_after_second;
    END IF;
END $$;

-- 2. Check if UserBalanceService is interfering
-- Look for any functions that might reset or overwrite balances
SELECT 
    routine_name, 
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%user_balances%'
AND routine_definition ILIKE '%total_neft_claimed%'
AND routine_type = 'FUNCTION';

-- 3. Check for any triggers on user_balances
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'user_balances';

-- 4. Simple replacement of claim functions with minimal logic
DROP FUNCTION IF EXISTS simple_claim_nft(TEXT);
CREATE FUNCTION simple_claim_nft(user_wallet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance DECIMAL(18,8);
    claim_amount DECIMAL(18,8) := 1.0; -- Fixed test amount
    new_balance DECIMAL(18,8);
BEGIN
    -- Get current balance
    SELECT COALESCE(total_neft_claimed, 0) INTO current_balance
    FROM user_balances WHERE wallet_address = user_wallet;
    
    -- Simple addition
    UPDATE user_balances 
    SET total_neft_claimed = total_neft_claimed + claim_amount,
        available_neft = available_neft + claim_amount
    WHERE wallet_address = user_wallet;
    
    -- If no record exists, create one
    IF NOT FOUND THEN
        INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
        VALUES (user_wallet, claim_amount, claim_amount, 0);
    END IF;
    
    -- Get new balance
    SELECT COALESCE(total_neft_claimed, 0) INTO new_balance
    FROM user_balances WHERE wallet_address = user_wallet;
    
    RETURN format('Before: %s, Added: %s, After: %s', current_balance, claim_amount, new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION simple_claim_nft(TEXT) TO authenticated, anon, public;

DO $$
BEGIN
    RAISE NOTICE '=== SIMPLE BALANCE TEST READY ===';
    RAISE NOTICE '1. Replace YOUR_WALLET_ADDRESS_HERE with your actual wallet';
    RAISE NOTICE '2. Run the DO block to test balance accumulation';
    RAISE NOTICE '3. Test simple claim: SELECT simple_claim_nft(''your_wallet'');';
    RAISE NOTICE '4. Check for interfering functions and triggers';
END $$;
