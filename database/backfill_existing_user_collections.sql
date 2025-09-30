-- Backfill existing user collections for users who already have NFTs
-- This ensures all existing users show up in user_nft_collections table

-- Function to initialize user collection entry with zero counts
CREATE OR REPLACE FUNCTION initialize_user_collection_entry(p_wallet_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_lower TEXT;
  v_result JSONB;
BEGIN
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Insert initial entry with zero counts (will be updated by sync functions)
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
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    NOW(),
    jsonb_build_object(
      'source', 'initialization',
      'initialized_at', NOW(),
      'needs_sync', true
    )
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    last_updated = NOW(),
    metadata = COALESCE(user_nft_collections.metadata, '{}'::jsonb) || jsonb_build_object(
      'last_initialization_check', NOW()
    );
  
  v_result := jsonb_build_object(
    'success', true,
    'wallet_address', v_wallet_lower,
    'action', 'initialized',
    'timestamp', NOW()
  );
  
  RETURN v_result;
END;
$$;

-- Function to backfill all existing users from various sources
CREATE OR REPLACE FUNCTION backfill_all_existing_user_collections()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_total_processed INTEGER := 0;
  v_total_initialized INTEGER := 0;
  v_total_updated INTEGER := 0;
  v_result JSONB;
BEGIN
  
  -- Process users from nft_cid_distribution_log (offchain NFT owners)
  FOR v_user_record IN 
    SELECT DISTINCT wallet_address 
    FROM nft_cid_distribution_log 
    WHERE wallet_address IS NOT NULL
  LOOP
    PERFORM initialize_user_collection_entry(v_user_record.wallet_address);
    v_total_processed := v_total_processed + 1;
  END LOOP;
  
  -- Process users from user_balances (active users)
  FOR v_user_record IN 
    SELECT DISTINCT wallet_address 
    FROM user_balances 
    WHERE wallet_address IS NOT NULL
  LOOP
    PERFORM initialize_user_collection_entry(v_user_record.wallet_address);
    v_total_processed := v_total_processed + 1;
  END LOOP;
  
  -- Process users from staked_nfts (staking users)
  FOR v_user_record IN 
    SELECT DISTINCT wallet_address 
    FROM staked_nfts 
    WHERE wallet_address IS NOT NULL
  LOOP
    PERFORM initialize_user_collection_entry(v_user_record.wallet_address);
    v_total_processed := v_total_processed + 1;
  END LOOP;
  
  -- Process users from burn_transactions (burning users)
  FOR v_user_record IN 
    SELECT DISTINCT wallet_address 
    FROM burn_transactions 
    WHERE wallet_address IS NOT NULL
  LOOP
    PERFORM initialize_user_collection_entry(v_user_record.wallet_address);
    v_total_processed := v_total_processed + 1;
  END LOOP;
  
  -- Process users from campaign_participations (campaign users)
  FOR v_user_record IN 
    SELECT DISTINCT wallet_address 
    FROM user_participations 
    WHERE wallet_address IS NOT NULL
  LOOP
    PERFORM initialize_user_collection_entry(v_user_record.wallet_address);
    v_total_processed := v_total_processed + 1;
  END LOOP;
  
  -- Process users from daily_claims (daily claim users)
  FOR v_user_record IN 
    SELECT DISTINCT wallet_address 
    FROM daily_claims 
    WHERE wallet_address IS NOT NULL
  LOOP
    PERFORM initialize_user_collection_entry(v_user_record.wallet_address);
    v_total_processed := v_total_processed + 1;
  END LOOP;
  
  -- Get final counts
  SELECT COUNT(*) INTO v_total_initialized FROM user_nft_collections;
  
  -- Sync offchain counts for all users
  FOR v_user_record IN 
    SELECT wallet_address FROM user_nft_collections
  LOOP
    PERFORM sync_user_nft_collection(v_user_record.wallet_address);
    v_total_updated := v_total_updated + 1;
  END LOOP;
  
  v_result := jsonb_build_object(
    'success', true,
    'total_processed', v_total_processed,
    'total_initialized', v_total_initialized,
    'total_updated', v_total_updated,
    'message', 'All existing users have been backfilled and synced',
    'completed_at', NOW()
  );
  
  RETURN v_result;
END;
$$;

-- Function to get users who need onchain sync (have no metadata or old sync)
CREATE OR REPLACE FUNCTION get_users_needing_onchain_sync()
RETURNS TABLE(
  wallet_address TEXT,
  total_nfts INTEGER,
  last_updated TIMESTAMP,
  needs_sync_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unc.wallet_address,
    unc.total_nfts,
    unc.last_updated,
    CASE 
      WHEN unc.metadata IS NULL THEN 'no_metadata'
      WHEN unc.metadata->>'source' != 'onchain_sync' THEN 'not_onchain_synced'
      WHEN unc.last_updated < NOW() - INTERVAL '24 hours' THEN 'stale_data'
      ELSE 'unknown'
    END as needs_sync_reason
  FROM user_nft_collections unc
  WHERE 
    unc.metadata IS NULL 
    OR unc.metadata->>'source' != 'onchain_sync'
    OR unc.last_updated < NOW() - INTERVAL '24 hours';
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION initialize_user_collection_entry(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION backfill_all_existing_user_collections() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_users_needing_onchain_sync() TO authenticated, anon, service_role;

-- Comments
COMMENT ON FUNCTION initialize_user_collection_entry IS 'Initialize user collection entry with zero counts for existing users';
COMMENT ON FUNCTION backfill_all_existing_user_collections IS 'Backfill all existing users from various platform tables';
COMMENT ON FUNCTION get_users_needing_onchain_sync IS 'Get users who need onchain NFT sync based on metadata and timestamps';

-- Example usage:
-- SELECT backfill_all_existing_user_collections();
-- SELECT * FROM get_users_needing_onchain_sync();
