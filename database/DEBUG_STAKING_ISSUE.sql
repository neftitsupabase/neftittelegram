-- =============================================================================
-- DEBUG STAKING ISSUE - IMMEDIATE TEST
-- =============================================================================

-- Test 1: Check if function exists and works
SELECT 'Testing function existence...' as test;
SELECT get_staked_nfts_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4') as result_uppercase;
SELECT get_staked_nfts_with_source('0xe7c8b6180286abdb598f0f818f5fd5b4c42b9ac4') as result_lowercase;

-- Test 2: Check raw table data
SELECT 'Checking raw table data...' as test;
SELECT 
    wallet_address,
    nft_id,
    staking_source,
    staked_at
FROM staked_nfts 
WHERE wallet_address ILIKE '%0xe7c8b6180286abdb598f0f818f5fd5b4c42b9ac4%'
   OR wallet_address ILIKE '%0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4%'
LIMIT 10;

-- Test 3: Check all wallet addresses in table
SELECT 'All wallet addresses in staked_nfts:' as test;
SELECT DISTINCT wallet_address FROM staked_nfts LIMIT 10;

-- Test 4: Count total records
SELECT 'Total staked NFT records:' as test;
SELECT COUNT(*) as total_records FROM staked_nfts;

-- Test 5: Test function with any existing wallet
SELECT 'Testing with first wallet found:' as test;
SELECT get_staked_nfts_with_source(
    (SELECT wallet_address FROM staked_nfts LIMIT 1)
) as result_first_wallet;
