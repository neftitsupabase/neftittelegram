-- ============================================================================
-- DEBUG BALANCE FLOW - Find why UI shows 0 but user_balances has values
-- Tests the complete data flow from database to UI
-- ============================================================================

-- Step 1: Check what's actually in user_balances table
SELECT 'STEP 1: Raw data in user_balances table' as debug_step;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  staked_neft,
  updated_at
FROM user_balances 
WHERE total_neft_claimed > 0 OR total_xp_earned > 0
ORDER BY updated_at DESC
LIMIT 5;

-- Step 2: Test get_direct_user_balance function with a real wallet
DO $$
DECLARE
  test_wallet TEXT;
  balance_result JSON;
BEGIN
  -- Find a wallet with actual balance data
  SELECT wallet_address INTO test_wallet
  FROM user_balances 
  WHERE total_neft_claimed > 0 
  LIMIT 1;

  IF test_wallet IS NOT NULL THEN
    RAISE NOTICE 'STEP 2: Testing get_direct_user_balance with wallet: %', test_wallet;
    
    -- Test the function
    SELECT get_direct_user_balance(test_wallet) INTO balance_result;
    
    RAISE NOTICE 'Function result: %', balance_result;
    RAISE NOTICE 'total_neft_claimed: %', balance_result->>'total_neft_claimed';
    RAISE NOTICE 'total_xp_earned: %', balance_result->>'total_xp_earned';
    RAISE NOTICE 'available_neft: %', balance_result->>'available_neft';
  ELSE
    RAISE NOTICE 'No wallet found with balance data';
  END IF;
END $$;

-- Step 3: Test with your social login wallet specifically
SELECT 'STEP 3: Testing with social login wallet' as debug_step;
SELECT get_direct_user_balance('social:google:108350092537307288909') as social_wallet_result;

-- Step 4: Check if referrals are affecting the calculation
SELECT 'STEP 4: Checking referral data' as debug_step;
SELECT 
  wallet_address,
  total_neft_earned,
  total_xp_earned,
  total_referrals,
  created_at
FROM user_referrals
WHERE total_neft_earned > 0 OR total_xp_earned > 0
LIMIT 5;

-- Step 5: Check staked_tokens table (affects available_neft calculation)
SELECT 'STEP 5: Checking staked tokens' as debug_step;
SELECT 
  wallet_address,
  amount,
  staked_at
FROM staked_tokens
WHERE amount > 0
LIMIT 5;

-- Step 6: Test function permissions
SELECT 'STEP 6: Checking function permissions' as debug_step;
SELECT 
  proname as function_name,
  proowner,
  proacl as permissions
FROM pg_proc 
WHERE proname = 'get_direct_user_balance';

-- Step 7: Check if function exists and is accessible
SELECT 'STEP 7: Function accessibility test' as debug_step;
SELECT routine_name, routine_type, security_type
FROM information_schema.routines 
WHERE routine_name = 'get_direct_user_balance';

-- Step 8: Manual calculation to verify logic
DO $$
DECLARE
  test_wallet TEXT := 'social:google:108350092537307288909';
  user_neft DECIMAL(18,8);
  user_xp INTEGER;
  referral_neft DECIMAL(18,8);
  staked_amount DECIMAL(18,8);
  final_total DECIMAL(18,8);
  final_available DECIMAL(18,8);
BEGIN
  RAISE NOTICE 'STEP 8: Manual calculation for wallet: %', test_wallet;
  
  -- Get base balance
  SELECT 
    COALESCE(total_neft_claimed, 0),
    COALESCE(total_xp_earned, 0)
  INTO user_neft, user_xp
  FROM user_balances 
  WHERE wallet_address = test_wallet;
  
  RAISE NOTICE 'Base balance - NEFT: %, XP: %', user_neft, user_xp;
  
  -- Get referrals
  SELECT COALESCE(total_neft_earned, 0)
  INTO referral_neft
  FROM user_referrals 
  WHERE wallet_address = test_wallet;
  
  RAISE NOTICE 'Referral NEFT: %', referral_neft;
  
  -- Get staked amount
  SELECT COALESCE(SUM(amount), 0)
  INTO staked_amount
  FROM staked_tokens 
  WHERE wallet_address = test_wallet;
  
  RAISE NOTICE 'Staked amount: %', staked_amount;
  
  -- Calculate totals
  final_total := COALESCE(user_neft, 0) + COALESCE(referral_neft, 0);
  final_available := GREATEST(0, final_total - COALESCE(staked_amount, 0));
  
  RAISE NOTICE 'Final total NEFT: %', final_total;
  RAISE NOTICE 'Final available NEFT: %', final_available;
  RAISE NOTICE 'Final XP: %', user_xp;
END $$;

-- Step 9: Check for RLS (Row Level Security) issues
SELECT 'STEP 9: Checking RLS policies' as debug_step;
SELECT 
  tablename,
  rowsecurity,
  forcerowsecurity
FROM pg_tables 
WHERE tablename IN ('user_balances', 'user_referrals', 'staked_tokens');

-- Step 10: Test function with different user contexts
SELECT 'STEP 10: Testing function execution context' as debug_step;
SELECT current_user as current_database_user;
SELECT session_user as session_database_user;
