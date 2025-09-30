-- Onchain NFT Tracking Integration for NEFTIT Platform
-- This file contains functions to sync onchain NFTs to user_nft_collections table
-- and get comprehensive NFT counts combining offchain and onchain data

-- Function to sync onchain NFTs to user_nft_collections table
CREATE OR REPLACE FUNCTION sync_onchain_nfts_to_collection(
  p_wallet_address TEXT,
  p_onchain_nfts JSONB[]
) RETURNS VOID AS $$
DECLARE
  nft_record JSONB;
  rarity_value TEXT;
  is_staked_value BOOLEAN;
  common_total INTEGER := 0;
  rare_total INTEGER := 0;
  legendary_total INTEGER := 0;
  platinum_total INTEGER := 0;
  silver_total INTEGER := 0;
  gold_total INTEGER := 0;
  staked_total INTEGER := 0;
BEGIN
  -- Ensure user exists in user_nft_collections
  INSERT INTO user_nft_collections (wallet_address)
  VALUES (p_wallet_address)
  ON CONFLICT (wallet_address) DO NOTHING;

  -- Process each onchain NFT and count by rarity
  FOREACH nft_record IN ARRAY p_onchain_nfts
  LOOP
    rarity_value := LOWER(COALESCE(nft_record->>'rarity', 'common'));
    is_staked_value := COALESCE((nft_record->>'isStaked')::BOOLEAN, false);
    
    -- Count by rarity
    CASE rarity_value
      WHEN 'common' THEN common_total := common_total + 1;
      WHEN 'rare' THEN rare_total := rare_total + 1;
      WHEN 'legendary' THEN legendary_total := legendary_total + 1;
      WHEN 'platinum' THEN platinum_total := platinum_total + 1;
      WHEN 'silver' THEN silver_total := silver_total + 1;
      WHEN 'gold' THEN gold_total := gold_total + 1;
      ELSE common_total := common_total + 1; -- Default to common
    END CASE;
    
    -- Count staked NFTs
    IF is_staked_value THEN
      staked_total := staked_total + 1;
    END IF;
  END LOOP;

  -- Update user_nft_collections with aggregated onchain counts
  UPDATE user_nft_collections 
  SET 
    onchain_common_count = common_total,
    onchain_rare_count = rare_total,
    onchain_legendary_count = legendary_total,
    onchain_platinum_count = platinum_total,
    onchain_silver_count = silver_total,
    onchain_gold_count = gold_total,
    onchain_staked_count = staked_total,
    last_onchain_sync = NOW()
  WHERE wallet_address = p_wallet_address;

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
  v_cached_counts user_nft_collections%ROWTYPE;
  v_result JSONB;
BEGIN
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Get offchain counts from nft_cid_distribution_log
  SELECT jsonb_build_object(
    'total_nfts', COUNT(*),
    'common_count', COUNT(*) FILTER (WHERE LOWER(rarity) = 'common'),
    'rare_count', COUNT(*) FILTER (WHERE LOWER(rarity) = 'rare'),
    'legendary_count', COUNT(*) FILTER (WHERE LOWER(rarity) = 'legendary'),
    'platinum_count', COUNT(*) FILTER (WHERE LOWER(rarity) = 'platinum'),
    'silver_count', COUNT(*) FILTER (WHERE LOWER(rarity) = 'silver'),
    'gold_count', COUNT(*) FILTER (WHERE LOWER(rarity) = 'gold')
  ) INTO v_offchain_counts
  FROM nft_cid_distribution_log
  WHERE wallet_address = v_wallet_lower;
  
  -- Get cached onchain counts from user_nft_collections
  SELECT * INTO v_cached_counts
  FROM user_nft_collections
  WHERE wallet_address = v_wallet_lower;
  
  IF v_cached_counts.wallet_address IS NOT NULL THEN
    v_onchain_counts := jsonb_build_object(
      'total_nfts', COALESCE(
        v_cached_counts.onchain_common_count + 
        v_cached_counts.onchain_rare_count + 
        v_cached_counts.onchain_legendary_count + 
        v_cached_counts.onchain_platinum_count + 
        v_cached_counts.onchain_silver_count + 
        v_cached_counts.onchain_gold_count, 0),
      'common_count', COALESCE(v_cached_counts.onchain_common_count, 0),
      'rare_count', COALESCE(v_cached_counts.onchain_rare_count, 0),
      'legendary_count', COALESCE(v_cached_counts.onchain_legendary_count, 0),
      'platinum_count', COALESCE(v_cached_counts.onchain_platinum_count, 0),
      'silver_count', COALESCE(v_cached_counts.onchain_silver_count, 0),
      'gold_count', COALESCE(v_cached_counts.onchain_gold_count, 0),
      'staked_count', COALESCE(v_cached_counts.onchain_staked_count, 0),
      'last_updated', v_cached_counts.last_onchain_sync
    );
  ELSE
    v_onchain_counts := jsonb_build_object(
      'total_nfts', 0,
      'common_count', 0,
      'rare_count', 0,
      'legendary_count', 0,
      'platinum_count', 0,
      'silver_count', 0,
      'gold_count', 0,
      'staked_count', 0,
      'last_updated', NULL
    );
  END IF;
  
  -- Combine offchain and onchain counts
  v_result := jsonb_build_object(
    'offchain', COALESCE(v_offchain_counts, jsonb_build_object(
      'total_nfts', 0,
      'common_count', 0,
      'rare_count', 0,
      'legendary_count', 0,
      'platinum_count', 0,
      'silver_count', 0,
      'gold_count', 0
    )),
    'onchain', v_onchain_counts,
    'combined', jsonb_build_object(
      'total_nfts', 
        COALESCE((v_offchain_counts->>'total_nfts')::INTEGER, 0) + 
        COALESCE((v_onchain_counts->>'total_nfts')::INTEGER, 0),
      'common_count', 
        COALESCE((v_offchain_counts->>'common_count')::INTEGER, 0) + 
        COALESCE((v_onchain_counts->>'common_count')::INTEGER, 0),
      'rare_count', 
        COALESCE((v_offchain_counts->>'rare_count')::INTEGER, 0) + 
        COALESCE((v_onchain_counts->>'rare_count')::INTEGER, 0),
      'legendary_count', 
        COALESCE((v_offchain_counts->>'legendary_count')::INTEGER, 0) + 
        COALESCE((v_onchain_counts->>'legendary_count')::INTEGER, 0),
      'platinum_count', 
        COALESCE((v_offchain_counts->>'platinum_count')::INTEGER, 0) + 
        COALESCE((v_onchain_counts->>'platinum_count')::INTEGER, 0),
      'silver_count', 
        COALESCE((v_offchain_counts->>'silver_count')::INTEGER, 0) + 
        COALESCE((v_onchain_counts->>'silver_count')::INTEGER, 0),
      'gold_count', 
        COALESCE((v_offchain_counts->>'gold_count')::INTEGER, 0) + 
        COALESCE((v_onchain_counts->>'gold_count')::INTEGER, 0),
      'staked_count', COALESCE((v_onchain_counts->>'staked_count')::INTEGER, 0),
      'available_count', 
        (COALESCE((v_offchain_counts->>'total_nfts')::INTEGER, 0) + 
         COALESCE((v_onchain_counts->>'total_nfts')::INTEGER, 0)) - 
        COALESCE((v_onchain_counts->>'staked_count')::INTEGER, 0)
    )
  );
  
  RETURN v_result;
END;
$$;
