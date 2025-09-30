-- Onchain NFT Tracking Integration
-- Syncs blockchain NFTs with user_nft_collections table for comprehensive tracking

-- Function to sync onchain NFTs to user collection tracking
CREATE OR REPLACE FUNCTION sync_onchain_nfts_to_collection(
  p_wallet_address TEXT,
  p_onchain_nfts JSONB[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_lower TEXT;
  v_nft JSONB;
  v_rarity TEXT;
  v_total_synced INTEGER := 0;
  v_result JSONB;
  v_counts JSONB;
BEGIN
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Create temporary table for onchain NFT data
  CREATE TEMP TABLE IF NOT EXISTS temp_onchain_nfts (
    token_id TEXT,
    name TEXT,
    rarity TEXT,
    image TEXT,
    metadata_uri TEXT,
    is_staked BOOLEAN DEFAULT false
  ) ON COMMIT DROP;
  
  -- Clear temp table
  DELETE FROM temp_onchain_nfts;
  
  -- Process each onchain NFT
  FOREACH v_nft IN ARRAY p_onchain_nfts
  LOOP
    -- Extract rarity from NFT data (with fallback)
    v_rarity := LOWER(COALESCE(
      v_nft->>'rarity',
      v_nft->'attributes'->0->>'value',
      'common'
    ));
    
    -- Normalize rarity values
    CASE v_rarity
      WHEN 'common' THEN v_rarity := 'common';
      WHEN 'rare' THEN v_rarity := 'rare';
      WHEN 'legendary' THEN v_rarity := 'legendary';
      WHEN 'platinum' THEN v_rarity := 'platinum';
      WHEN 'silver' THEN v_rarity := 'silver';
      WHEN 'gold' THEN v_rarity := 'gold';
      ELSE v_rarity := 'common';
    END CASE;
    
    -- Insert into temp table
    INSERT INTO temp_onchain_nfts (
      token_id,
      name,
      rarity,
      image,
      metadata_uri,
      is_staked
    ) VALUES (
      v_nft->>'tokenId',
      COALESCE(v_nft->>'name', 'NFT #' || (v_nft->>'tokenId')),
      v_rarity,
      v_nft->>'image',
      v_nft->>'metadata_uri',
      COALESCE((v_nft->>'isStaked')::BOOLEAN, false)
    );
    
    v_total_synced := v_total_synced + 1;
  END LOOP;
  
  -- Calculate counts from temp table
  SELECT jsonb_build_object(
    'total_nfts', COUNT(*),
    'common_count', COUNT(*) FILTER (WHERE rarity = 'common'),
    'rare_count', COUNT(*) FILTER (WHERE rarity = 'rare'),
    'legendary_count', COUNT(*) FILTER (WHERE rarity = 'legendary'),
    'platinum_count', COUNT(*) FILTER (WHERE rarity = 'platinum'),
    'silver_count', COUNT(*) FILTER (WHERE rarity = 'silver'),
    'gold_count', COUNT(*) FILTER (WHERE rarity = 'gold'),
    'staked_count', COUNT(*) FILTER (WHERE is_staked = true),
    'available_count', COUNT(*) FILTER (WHERE is_staked = false)
  ) INTO v_counts
  FROM temp_onchain_nfts;
  
  -- Update user_nft_collections with onchain data
  INSERT INTO user_nft_collections (
    wallet_address,
    total_nfts,
    common_count,
    rare_count,
    legendary_count,
    platinum_count,
    silver_count,
    gold_count,
    last_updated,
    metadata
  ) VALUES (
    v_wallet_lower,
    (v_counts->>'total_nfts')::INTEGER,
    (v_counts->>'common_count')::INTEGER,
    (v_counts->>'rare_count')::INTEGER,
    (v_counts->>'legendary_count')::INTEGER,
    (v_counts->>'platinum_count')::INTEGER,
    (v_counts->>'silver_count')::INTEGER,
    (v_counts->>'gold_count')::INTEGER,
    NOW(),
    jsonb_build_object(
      'source', 'onchain_sync',
      'staked_count', v_counts->>'staked_count',
      'available_count', v_counts->>'available_count',
      'last_onchain_sync', NOW()
    )
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive NFT counts (offchain + onchain)
CREATE OR REPLACE FUNCTION get_comprehensive_nft_counts(p_wallet_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_lower TEXT;
  v_offchain_counts JSONB;
  v_onchain_counts JSONB;
  v_cached_counts RECORD;
  v_result JSONB;
BEGIN
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Get offchain counts from distribution log
  SELECT jsonb_build_object(
    'total_nfts', COALESCE(COUNT(*), 0),
    'common_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'common'), 0),
    'rare_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'rare'), 0),
    'legendary_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'legendary'), 0),
    'platinum_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'platinum'), 0),
    'silver_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'silver'), 0),
    'gold_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'gold'), 0)
  ) INTO v_offchain_counts
  FROM nft_cid_distribution_log
  WHERE wallet_address = v_wallet_lower;
  
  -- Get cached onchain counts from user_nft_collections
  SELECT * INTO v_cached_counts
  FROM user_nft_collections
  WHERE wallet_address = v_wallet_lower;
  
  IF v_cached_counts.wallet_address IS NOT NULL THEN
    v_onchain_counts := jsonb_build_object(
      'total_nfts', COALESCE(v_cached_counts.onchain_common_count + v_cached_counts.onchain_rare_count + v_cached_counts.onchain_legendary_count + v_cached_counts.onchain_platinum_count + v_cached_counts.onchain_silver_count + v_cached_counts.onchain_gold_count, 0),
      'common_count', COALESCE(v_cached_counts.onchain_common_count, 0),
      'rare_count', COALESCE(v_cached_counts.onchain_rare_count, 0),
      'legendary_count', COALESCE(v_cached_counts.onchain_legendary_count, 0),
      'platinum_count', COALESCE(v_cached_counts.onchain_platinum_count, 0),
      'silver_count', COALESCE(v_cached_counts.onchain_silver_count, 0),
      'gold_count', COALESCE(v_cached_counts.onchain_gold_count, 0),
      'last_updated', v_cached_counts.last_onchain_sync,
      'metadata', jsonb_build_object(
        'staked_count', v_cached_counts.onchain_staked_count,
        'available_count', COALESCE(v_cached_counts.onchain_common_count + v_cached_counts.onchain_rare_count + v_cached_counts.onchain_legendary_count + v_cached_counts.onchain_platinum_count + v_cached_counts.onchain_silver_count + v_cached_counts.onchain_gold_count, 0) - v_cached_counts.onchain_staked_count,
        'last_onchain_sync', v_cached_counts.last_onchain_sync
      )
      'common_count', COALESCE(v_cached_counts.common_count, 0),
      'rare_count', COALESCE(v_cached_counts.rare_count, 0),
      'legendary_count', COALESCE(v_cached_counts.legendary_count, 0),
      'platinum_count', COALESCE(v_cached_counts.platinum_count, 0),
      'silver_count', COALESCE(v_cached_counts.silver_count, 0),
      'gold_count', COALESCE(v_cached_counts.gold_count, 0),
      'last_updated', v_cached_counts.last_updated,
      'metadata', v_cached_counts.metadata
    );
  ELSE
    v_onchain_counts := jsonb_build_object(
      'total_nfts', 0,
      'common_count', 0,
      'rare_count', 0,
      'legendary_count', 0,
      'platinum_count', 0,
      'silver_count', 0,
      'gold_count', 0
    );
  END IF;
  
  -- Build comprehensive result
  v_result := jsonb_build_object(
    'wallet_address', v_wallet_lower,
    'offchain_counts', v_offchain_counts,
    'onchain_counts', v_onchain_counts,
    'combined_counts', jsonb_build_object(
      'total_nfts', 
        (v_offchain_counts->>'total_nfts')::INTEGER + (v_onchain_counts->>'total_nfts')::INTEGER,
      'common_count', 
        (v_offchain_counts->>'common_count')::INTEGER + (v_onchain_counts->>'common_count')::INTEGER,
      'rare_count', 
        (v_offchain_counts->>'rare_count')::INTEGER + (v_onchain_counts->>'rare_count')::INTEGER,
      'legendary_count', 
        (v_offchain_counts->>'legendary_count')::INTEGER + (v_onchain_counts->>'legendary_count')::INTEGER,
      'platinum_count', 
        (v_offchain_counts->>'platinum_count')::INTEGER + (v_onchain_counts->>'platinum_count')::INTEGER,
      'silver_count', 
        (v_offchain_counts->>'silver_count')::INTEGER + (v_onchain_counts->>'silver_count')::INTEGER,
      'gold_count', 
        (v_offchain_counts->>'gold_count')::INTEGER + (v_onchain_counts->>'gold_count')::INTEGER
    ),
    'has_onchain_data', v_cached_counts.wallet_address IS NOT NULL,
    'needs_onchain_sync', v_cached_counts.wallet_address IS NULL OR 
      v_cached_counts.last_updated < NOW() - INTERVAL '1 hour'
  );
  
  RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_onchain_nfts_to_collection(TEXT, JSONB[]) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_comprehensive_nft_counts(TEXT) TO authenticated, anon, service_role;

-- Comments
COMMENT ON FUNCTION sync_onchain_nfts_to_collection IS 'Syncs onchain NFT data to user_nft_collections table for comprehensive tracking';
COMMENT ON FUNCTION get_comprehensive_nft_counts IS 'Gets comprehensive NFT counts from both offchain and onchain sources';
