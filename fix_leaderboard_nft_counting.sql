-- ============================================================================
-- FIX LEADERBOARD NFT COUNTING INCONSISTENCY
-- Makes both functions use user_ipfs_mappings as the single source of truth
-- ============================================================================

-- Fixed function to get top 10 NFT holders from user_ipfs_mappings table
-- This matches the get_user_nft_rank function for consistency
CREATE OR REPLACE FUNCTION get_top_nft_holders(result_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  wallet_address TEXT,
  nft_count INTEGER,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH nft_counts AS (
    SELECT 
      uim.wallet_address,
      COUNT(*)::INTEGER as nft_count
    FROM user_ipfs_mappings uim
    GROUP BY uim.wallet_address
  )
  SELECT 
    nc.wallet_address,
    nc.nft_count,
    ROW_NUMBER() OVER (ORDER BY nc.nft_count DESC)::INTEGER as rank_position
  FROM nft_counts nc
  WHERE nc.nft_count > 0
  ORDER BY nc.nft_count DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_top_nft_holders(INTEGER) TO anon, authenticated;

-- Update function comment
COMMENT ON FUNCTION get_top_nft_holders(INTEGER) IS 'Returns top NFT holders by counting user_ipfs_mappings (consistent with user rank function)';

-- Optional: Create a function to sync missing NFTs from IPFS to nft_collections
-- This can be used if you want to populate nft_collections for other purposes
CREATE OR REPLACE FUNCTION sync_all_nfts_from_ipfs()
RETURNS INTEGER AS $$
DECLARE
  sync_count INTEGER := 0;
  nft_record RECORD;
BEGIN
  -- Loop through all IPFS mappings and sync to nft_collections
  FOR nft_record IN 
    SELECT 
      uim.wallet_address,
      uim.ipfs_hash,
      'Unknown' as name,
      'Common' as rarity,
      1 as tier
    FROM user_ipfs_mappings uim
    LEFT JOIN nft_collections nc ON nc.nft_id = uim.ipfs_hash
    WHERE nc.nft_id IS NULL -- Only sync missing ones
  LOOP
    INSERT INTO nft_collections (
      nft_id, wallet_address, name, rarity, tier, created_from
    ) VALUES (
      nft_record.ipfs_hash, 
      nft_record.wallet_address, 
      nft_record.name, 
      nft_record.rarity, 
      nft_record.tier,
      'ipfs_sync'
    )
    ON CONFLICT (nft_id) DO NOTHING;
    
    sync_count := sync_count + 1;
  END LOOP;
  
  RETURN sync_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for sync function
GRANT EXECUTE ON FUNCTION sync_all_nfts_from_ipfs() TO anon, authenticated;
