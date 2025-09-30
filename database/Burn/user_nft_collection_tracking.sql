-- User NFT Collection Count Tracking System
-- Maintains accurate counts and ensures complete NFT removal during burns

-- Create user NFT collection summary table
CREATE TABLE IF NOT EXISTS user_nft_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  total_nfts INTEGER DEFAULT 0,
  common_count INTEGER DEFAULT 0,
  rare_count INTEGER DEFAULT 0,
  legendary_count INTEGER DEFAULT 0,
  platinum_count INTEGER DEFAULT 0,
  silver_count INTEGER DEFAULT 0,
  gold_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_nft_collections_wallet 
ON user_nft_collections(wallet_address);

-- Function to get user's current NFT counts from distribution log
CREATE OR REPLACE FUNCTION get_user_nft_counts(p_wallet_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_lower TEXT;
  v_counts JSONB;
BEGIN
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Count NFTs by rarity from distribution log
  SELECT jsonb_build_object(
    'total_nfts', COALESCE(COUNT(*), 0),
    'common_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'common'), 0),
    'rare_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'rare'), 0),
    'legendary_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'legendary'), 0),
    'platinum_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'platinum'), 0),
    'silver_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'silver'), 0),
    'gold_count', COALESCE(COUNT(*) FILTER (WHERE rarity = 'gold'), 0),
    'wallet_address', v_wallet_lower
  ) INTO v_counts
  FROM nft_cid_distribution_log
  WHERE wallet_address = v_wallet_lower;
  
  RETURN v_counts;
END;
$$;

-- Function to sync user NFT collection counts
CREATE OR REPLACE FUNCTION sync_user_nft_collection(p_wallet_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_lower TEXT;
  v_counts JSONB;
  v_result JSONB;
BEGIN
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Get current counts from distribution log
  v_counts := get_user_nft_counts(v_wallet_lower);
  
  -- Update or insert collection summary
  INSERT INTO user_nft_collections (
    wallet_address,
    total_nfts,
    common_count,
    rare_count,
    legendary_count,
    platinum_count,
    silver_count,
    gold_count,
    last_updated
  ) VALUES (
    v_wallet_lower,
    (v_counts->>'total_nfts')::INTEGER,
    (v_counts->>'common_count')::INTEGER,
    (v_counts->>'rare_count')::INTEGER,
    (v_counts->>'legendary_count')::INTEGER,
    (v_counts->>'platinum_count')::INTEGER,
    (v_counts->>'silver_count')::INTEGER,
    (v_counts->>'gold_count')::INTEGER,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_nfts = EXCLUDED.total_nfts,
    common_count = EXCLUDED.common_count,
    rare_count = EXCLUDED.rare_count,
    legendary_count = EXCLUDED.legendary_count,
    platinum_count = EXCLUDED.platinum_count,
    silver_count = EXCLUDED.silver_count,
    gold_count = EXCLUDED.gold_count,
    last_updated = NOW();
  
  -- Return updated counts
  v_result := jsonb_build_object(
    'success', true,
    'wallet_address', v_wallet_lower,
    'counts', v_counts,
    'synced_at', NOW()
  );
  
  RETURN v_result;
END;
$$;

-- Enhanced burn transaction function with complete NFT removal and count tracking
CREATE OR REPLACE FUNCTION execute_burn_transaction_with_tracking(
  p_wallet_address TEXT,
  p_burned_nft_ids TEXT[],
  p_result_nft JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_burned_count INTEGER;
  v_wallet_lower TEXT;
  v_burned_nfts JSONB[];
  v_nft_record RECORD;
  v_before_counts JSONB;
  v_after_counts JSONB;
BEGIN
  -- Normalize wallet address
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Get counts before burn
  v_before_counts := get_user_nft_counts(v_wallet_lower);
  
  -- Start transaction
  BEGIN
    -- 1. Validate that user owns all NFTs to be burned
    SELECT COUNT(*) INTO v_burned_count
    FROM nft_cid_distribution_log 
    WHERE wallet_address = v_wallet_lower 
    AND nft_id = ANY(p_burned_nft_ids);
    
    IF v_burned_count != array_length(p_burned_nft_ids, 1) THEN
      RAISE EXCEPTION 'User does not own all specified NFTs. Expected: %, Found: %', 
        array_length(p_burned_nft_ids, 1), v_burned_count;
    END IF;
    
    -- 2. Collect burned NFT data for audit trail
    FOR v_nft_record IN 
      SELECT nft_id, rarity, cid, distributed_at
      FROM nft_cid_distribution_log 
      WHERE wallet_address = v_wallet_lower 
      AND nft_id = ANY(p_burned_nft_ids)
    LOOP
      v_burned_nfts := v_burned_nfts || jsonb_build_object(
        'nft_id', v_nft_record.nft_id,
        'rarity', v_nft_record.rarity,
        'cid', v_nft_record.cid,
        'distributed_at', v_nft_record.distributed_at
      );
    END LOOP;
    
    -- 3. Remove burned NFTs from distribution log (COMPLETE REMOVAL)
    DELETE FROM nft_cid_distribution_log 
    WHERE wallet_address = v_wallet_lower 
    AND nft_id = ANY(p_burned_nft_ids);
    
    GET DIAGNOSTICS v_burned_count = ROW_COUNT;
    
    -- 4. Add result NFT to distribution log
    INSERT INTO nft_cid_distribution_log (
      nft_id,
      wallet_address,
      rarity,
      cid,
      distributed_at,
      distribution_type
    ) VALUES (
      (p_result_nft->>'nft_id')::TEXT,
      v_wallet_lower,
      (p_result_nft->>'rarity')::TEXT,
      (p_result_nft->>'cid')::TEXT,
      (p_result_nft->>'distributed_at')::TIMESTAMP,
      'burn_result'
    );
    
    -- 5. Log detailed burn transaction
    INSERT INTO burn_transactions (
      id,
      wallet_address,
      burned_nft_ids,
      result_nft_id,
      transaction_type,
      created_at,
      metadata
    ) VALUES (
      gen_random_uuid(),
      v_wallet_lower,
      p_burned_nft_ids,
      (p_result_nft->>'nft_id')::TEXT,
      'cid_pool_burn_tracked',
      NOW(),
      jsonb_build_object(
        'burned_nfts', v_burned_nfts,
        'result_nft', p_result_nft,
        'before_counts', v_before_counts
      )
    );
    
    -- 6. Update user NFT collection counts
    PERFORM sync_user_nft_collection(v_wallet_lower);
    
    -- Get counts after burn
    v_after_counts := get_user_nft_counts(v_wallet_lower);
    
    -- Return success result with count tracking
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Burn transaction executed successfully with count tracking',
      'burned_count', v_burned_count,
      'result_nft_id', (p_result_nft->>'nft_id')::TEXT,
      'wallet_address', v_wallet_lower,
      'before_counts', v_before_counts,
      'after_counts', v_after_counts,
      'count_difference', jsonb_build_object(
        'total_nfts', (v_after_counts->>'total_nfts')::INTEGER - (v_before_counts->>'total_nfts')::INTEGER,
        'burned_nfts', array_length(p_burned_nft_ids, 1),
        'result_nfts', 1
      )
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback and return error
    RAISE;
  END;
END;
$$;

-- Function to get user's complete NFT collection status
CREATE OR REPLACE FUNCTION get_user_collection_status(p_wallet_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_lower TEXT;
  v_live_counts JSONB;
  v_cached_counts RECORD;
  v_result JSONB;
BEGIN
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Get live counts from distribution log
  v_live_counts := get_user_nft_counts(v_wallet_lower);
  
  -- Get cached counts from collection table
  SELECT * INTO v_cached_counts
  FROM user_nft_collections
  WHERE wallet_address = v_wallet_lower;
  
  -- Build comprehensive status
  v_result := jsonb_build_object(
    'wallet_address', v_wallet_lower,
    'live_counts', v_live_counts,
    'cached_counts', CASE 
      WHEN v_cached_counts.wallet_address IS NOT NULL THEN
        jsonb_build_object(
          'total_nfts', v_cached_counts.total_nfts,
          'common_count', v_cached_counts.common_count,
          'rare_count', v_cached_counts.rare_count,
          'legendary_count', v_cached_counts.legendary_count,
          'platinum_count', v_cached_counts.platinum_count,
          'silver_count', v_cached_counts.silver_count,
          'gold_count', v_cached_counts.gold_count,
          'last_updated', v_cached_counts.last_updated
        )
      ELSE NULL
    END,
    'counts_match', CASE 
      WHEN v_cached_counts.wallet_address IS NOT NULL THEN
        v_cached_counts.total_nfts = (v_live_counts->>'total_nfts')::INTEGER
      ELSE false
    END,
    'needs_sync', CASE 
      WHEN v_cached_counts.wallet_address IS NULL THEN true
      WHEN v_cached_counts.total_nfts != (v_live_counts->>'total_nfts')::INTEGER THEN true
      ELSE false
    END
  );
  
  RETURN v_result;
END;
$$;

-- Trigger to auto-sync collection counts when distribution log changes
CREATE OR REPLACE FUNCTION trigger_sync_nft_collection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync counts for affected wallet address
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_user_nft_collection(OLD.wallet_address);
    RETURN OLD;
  ELSE
    PERFORM sync_user_nft_collection(NEW.wallet_address);
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger on distribution log
DROP TRIGGER IF EXISTS trigger_nft_collection_sync ON nft_cid_distribution_log;
CREATE TRIGGER trigger_nft_collection_sync
  AFTER INSERT OR UPDATE OR DELETE ON nft_cid_distribution_log
  FOR EACH ROW EXECUTE FUNCTION trigger_sync_nft_collection();

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_nft_counts(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION sync_user_nft_collection(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION execute_burn_transaction_with_tracking(TEXT, TEXT[], JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_collection_status(TEXT) TO authenticated, anon, service_role;

-- RLS policies for user_nft_collections
ALTER TABLE user_nft_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own NFT collection counts" ON user_nft_collections
  FOR SELECT USING (
    wallet_address = LOWER(current_setting('request.headers')::json->>'x-wallet-address')
    OR wallet_address = LOWER(auth.jwt()->>'wallet_address')
    OR wallet_address = LOWER(auth.jwt()->>'sub')
  );

CREATE POLICY "Service role can manage all NFT collection counts" ON user_nft_collections
  FOR ALL USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE user_nft_collections IS 'Tracks accurate NFT collection counts per user';
COMMENT ON FUNCTION get_user_nft_counts IS 'Gets live NFT counts from distribution log';
COMMENT ON FUNCTION sync_user_nft_collection IS 'Syncs NFT collection counts to summary table';
COMMENT ON FUNCTION execute_burn_transaction_with_tracking IS 'Enhanced burn function with complete NFT removal and count tracking';
COMMENT ON FUNCTION get_user_collection_status IS 'Gets comprehensive NFT collection status for debugging';
