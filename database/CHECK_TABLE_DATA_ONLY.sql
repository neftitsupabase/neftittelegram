-- Check user_nft_collections table data only
-- No function calls - just check existing data

-- Step 1: Check if table exists and has data
SELECT 'user_nft_collections table status:' as check_name;
SELECT COUNT(*) as total_records FROM user_nft_collections;
SELECT COUNT(*) as records_with_nfts FROM user_nft_collections WHERE total_nfts > 0;

-- Step 2: Show existing data (if any)
SELECT 'Current top NFT holders:' as check_name;
SELECT 
    wallet_address,
    total_nfts,
    common_count,
    rare_count,
    legendary_count,
    last_updated
FROM user_nft_collections 
WHERE total_nfts > 0
ORDER BY total_nfts DESC 
LIMIT 10;
