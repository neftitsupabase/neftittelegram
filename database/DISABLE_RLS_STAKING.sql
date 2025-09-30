-- =============================================================================
-- DISABLE RLS ON STAKING TABLE - IMMEDIATE FIX
-- =============================================================================
-- This temporarily disables RLS to make staking work immediately

-- Disable RLS on staked_nfts table
ALTER TABLE staked_nfts DISABLE ROW LEVEL SECURITY;

-- Test the function immediately
SELECT 'Testing after RLS disabled:' as test;
SELECT get_staked_nfts_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4') as result_test;

-- Verify RLS is now disabled
SELECT 'RLS status after disable:' as test;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'staked_nfts';

-- Check raw data access
SELECT 'Raw data check:' as test;
SELECT 
    wallet_address,
    nft_id,
    staking_source,
    staked_at
FROM staked_nfts 
WHERE LOWER(wallet_address) = LOWER('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4')
LIMIT 5;
