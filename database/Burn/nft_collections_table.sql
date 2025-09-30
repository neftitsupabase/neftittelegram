-- ============================================================================
-- NFT COLLECTIONS TABLE FOR BURN PAGE LEADERBOARD
-- Stores individual NFT records from burn operations for accurate counting
-- ============================================================================

-- Create nft_collections table to track individual NFTs from burn page
CREATE TABLE IF NOT EXISTS nft_collections (
  id SERIAL PRIMARY KEY,
  nft_id TEXT NOT NULL UNIQUE, -- NFT ID from burn service
  wallet_address TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  tier INTEGER NOT NULL,
  metadata_uri TEXT,
  is_active BOOLEAN DEFAULT true, -- false when NFT is burned
  created_from TEXT DEFAULT 'burn', -- 'burn', 'campaign', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  burned_at TIMESTAMP WITH TIME ZONE NULL,
  burn_transaction_id TEXT NULL -- Reference to burn transaction
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_nft_collections_wallet_active 
ON nft_collections(wallet_address, is_active);

CREATE INDEX IF NOT EXISTS idx_nft_collections_active 
ON nft_collections(is_active);

CREATE INDEX IF NOT EXISTS idx_nft_collections_created_at 
ON nft_collections(created_at DESC);

-- Create function to sync NFT data from IPFS burn operations
CREATE OR REPLACE FUNCTION sync_nft_from_burn(
  p_nft_id TEXT,
  p_wallet_address TEXT,
  p_name TEXT,
  p_rarity TEXT,
  p_tier INTEGER,
  p_metadata_uri TEXT DEFAULT NULL,
  p_created_from TEXT DEFAULT 'burn'
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO nft_collections (
    nft_id, wallet_address, name, rarity, tier, 
    metadata_uri, created_from
  ) VALUES (
    p_nft_id, p_wallet_address, p_name, p_rarity, p_tier,
    p_metadata_uri, p_created_from
  )
  ON CONFLICT (nft_id) DO UPDATE SET
    wallet_address = EXCLUDED.wallet_address,
    name = EXCLUDED.name,
    rarity = EXCLUDED.rarity,
    tier = EXCLUDED.tier,
    metadata_uri = EXCLUDED.metadata_uri,
    created_from = EXCLUDED.created_from;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure PostgREST can call this RPC
GRANT EXECUTE ON FUNCTION sync_nft_from_burn(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION sync_nft_from_burn(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) TO authenticated;

-- Create function to mark NFTs as burned
CREATE OR REPLACE FUNCTION mark_nfts_as_burned(
  p_nft_ids TEXT[],
  p_burn_transaction_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE nft_collections 
  SET 
    is_active = false,
    burned_at = NOW(),
    burn_transaction_id = p_burn_transaction_id
  WHERE nft_id = ANY(p_nft_ids)
    AND is_active = true;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get NFT collection stats for a wallet
CREATE OR REPLACE FUNCTION get_wallet_nft_stats(p_wallet_address TEXT)
RETURNS TABLE (
  total_nfts INTEGER,
  active_nfts INTEGER,
  burned_nfts INTEGER,
  rarity_breakdown JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_nfts,
    COUNT(*) FILTER (WHERE is_active = true)::INTEGER as active_nfts,
    COUNT(*) FILTER (WHERE is_active = false)::INTEGER as burned_nfts,
    jsonb_object_agg(
      rarity, 
      jsonb_build_object(
        'total', rarity_count,
        'active', active_count
      )
    ) as rarity_breakdown
  FROM (
    SELECT 
      rarity,
      COUNT(*)::INTEGER as rarity_count,
      COUNT(*) FILTER (WHERE is_active = true)::INTEGER as active_count
    FROM nft_collections 
    WHERE wallet_address = p_wallet_address
    GROUP BY rarity
  ) rarity_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
