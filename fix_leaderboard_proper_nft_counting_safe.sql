-- ============================================================================
-- LEADERBOARD NFT COUNTING (NO CACHE VERSION)
-- Uses direct IPFS counting via LeaderboardService instead of cache table
-- ============================================================================

-- Drop the cache table if it exists
DROP TABLE IF EXISTS user_nft_counts_cache CASCADE;

-- Remove any functions that used the cache table
DROP FUNCTION IF EXISTS update_nft_count_cache(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_top_nft_holders(INTEGER);
DROP FUNCTION IF EXISTS get_user_nft_rank(TEXT);

-- Note: NFT leaderboard now uses direct IPFS counting via LeaderboardService
-- The LeaderboardService.getTopNFTHolders() method uses enhancedIPFSBurnService.getUserNFTs()
-- This ensures consistency with burn/stake/profile pages that also use direct IPFS data
