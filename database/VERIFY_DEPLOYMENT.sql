-- =============================================================================
-- VERIFY DEPLOYMENT - Test if RLS fixes are working
-- =============================================================================

-- Test 1: Check if functions exist
SELECT 'Functions exist check:' as test;
SELECT proname FROM pg_proc WHERE proname IN ('get_staked_nfts_with_source', 'unstake_nft');

-- Test 2: Test the fixed function directly
SELECT 'Testing get_staked_nfts_with_source:' as test;
SELECT get_staked_nfts_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4') as result_uppercase;
SELECT get_staked_nfts_with_source('0xe7c8b6180286abdb598f0f818f5fd5b4c42b9ac4') as result_lowercase;

-- Test 3: Check raw table data
SELECT 'Raw staked_nfts data:' as test;
SELECT 
    wallet_address,
    nft_id,
    staking_source,
    staked_at
FROM staked_nfts 
WHERE LOWER(wallet_address) = LOWER('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4')
LIMIT 10;

-- Test 4: Count total records
SELECT 'Total staked NFT records:' as test;
SELECT COUNT(*) as total_records FROM staked_nfts;

-- Test 5: Check RLS status
SELECT 'RLS status:' as test;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'staked_nfts';
