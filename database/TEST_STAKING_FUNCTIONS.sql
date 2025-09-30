-- =============================================================================
-- TEST STAKING FUNCTIONS - DEBUGGING SCRIPT
-- =============================================================================
-- This script tests if the staking functions are working correctly

-- 1. Test if the function exists
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN ('get_staked_nfts_with_source', 'unstake_nft');

-- 2. Check if staked_nfts table has data
SELECT 
    wallet_address,
    nft_id,
    staking_source,
    staked_at,
    daily_rate
FROM staked_nfts 
WHERE wallet_address = '0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4'
LIMIT 10;

-- 3. Test the get_staked_nfts_with_source function directly
SELECT get_staked_nfts_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4');

-- 4. Test with lowercase wallet address (RLS might be case sensitive)
SELECT get_staked_nfts_with_source('0xe7c8b6180286abdb598f0f818f5fd5b4c42b9ac4');

-- 5. Check RLS policies on staked_nfts table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'staked_nfts';

-- 6. Test if we can access staked_nfts table directly
SELECT COUNT(*) as total_staked_nfts FROM staked_nfts;

-- 7. Test function with a simple wallet that might exist
SELECT get_staked_nfts_with_source('test_wallet');
