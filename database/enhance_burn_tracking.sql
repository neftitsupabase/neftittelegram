-- Enhanced Burn Tracking: Off-Chain vs On-Chain Identification
-- Adds proper burn type tracking and blockchain transaction support

-- Update burn_transactions table to support both off-chain and on-chain burns
ALTER TABLE burn_transactions 
ADD COLUMN IF NOT EXISTS burn_type TEXT DEFAULT 'off_chain' CHECK (burn_type IN ('off_chain', 'on_chain'));

ALTER TABLE burn_transactions 
ADD COLUMN IF NOT EXISTS blockchain_transaction_hash TEXT;

ALTER TABLE burn_transactions 
ADD COLUMN IF NOT EXISTS gas_used BIGINT;

ALTER TABLE burn_transactions 
ADD COLUMN IF NOT EXISTS gas_price TEXT;

-- Update existing records to have proper burn_type
UPDATE burn_transactions 
SET burn_type = 'off_chain' 
WHERE burn_type IS NULL OR transaction_type = 'cid_pool_burn';

-- Create index for burn_type queries
CREATE INDEX IF NOT EXISTS idx_burn_transactions_burn_type 
ON burn_transactions(burn_type);

CREATE INDEX IF NOT EXISTS idx_burn_transactions_blockchain_hash 
ON burn_transactions(blockchain_transaction_hash) 
WHERE blockchain_transaction_hash IS NOT NULL;

-- Update the execute_burn_transaction function to include burn_type
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
  v_transaction_id UUID;
BEGIN
  -- Normalize wallet address
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Start transaction
  BEGIN
    -- 1. Remove burned NFTs from distribution log
    DELETE FROM nft_cid_distribution_log 
    WHERE wallet_address = v_wallet_lower 
    AND nft_id = ANY(p_burned_nft_ids);
    
    GET DIAGNOSTICS v_burned_count = ROW_COUNT;
    
    -- Validate that all NFTs were found and removed
    IF v_burned_count != array_length(p_burned_nft_ids, 1) THEN
      RAISE EXCEPTION 'Some NFTs not found in user collection. Expected: %, Removed: %', 
        array_length(p_burned_nft_ids, 1), v_burned_count;
    END IF;
    
    -- 2. Add result NFT to distribution log
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
    
    -- 3. Log burn transaction with proper burn_type
    INSERT INTO burn_transactions (
      id,
      wallet_address,
      burned_nft_ids,
      result_nft_id,
      transaction_type,
      burn_type,
      created_at,
      metadata
    ) VALUES (
      gen_random_uuid(),
      v_wallet_lower,
      p_burned_nft_ids,
      (p_result_nft->>'nft_id')::TEXT,
      'cid_pool_burn',
      'off_chain', -- Clearly mark as off-chain burn
      NOW(),
      jsonb_build_object(
        'burn_method', 'cid_pool',
        'storage_type', 'ipfs',
        'result_nft_cid', (p_result_nft->>'cid')::TEXT
      )
    ) RETURNING id INTO v_transaction_id;
    
    -- Return success result with transaction ID
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Off-chain burn transaction executed successfully',
      'burned_count', v_burned_count,
      'result_nft_id', (p_result_nft->>'nft_id')::TEXT,
      'wallet_address', v_wallet_lower,
      'transaction_id', v_transaction_id,
      'burn_type', 'off_chain'
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback and return error
    RAISE;
  END;
END;
$$;

-- Function to log on-chain burn transactions
CREATE OR REPLACE FUNCTION log_onchain_burn_transaction(
  p_wallet_address TEXT,
  p_burned_nft_ids TEXT[],
  p_blockchain_tx_hash TEXT,
  p_gas_used BIGINT DEFAULT NULL,
  p_gas_price TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_wallet_lower TEXT;
  v_transaction_id UUID;
BEGIN
  v_wallet_lower := LOWER(p_wallet_address);
  
  -- Log on-chain burn transaction
  INSERT INTO burn_transactions (
    id,
    wallet_address,
    burned_nft_ids,
    result_nft_id,
    transaction_type,
    burn_type,
    blockchain_transaction_hash,
    gas_used,
    gas_price,
    created_at,
    metadata
  ) VALUES (
    gen_random_uuid(),
    v_wallet_lower,
    p_burned_nft_ids,
    'blockchain_burn', -- No result NFT for pure burns
    'blockchain_burn',
    'on_chain', -- Clearly mark as on-chain burn
    p_blockchain_tx_hash,
    p_gas_used,
    p_gas_price,
    NOW(),
    jsonb_build_object(
      'burn_method', 'smart_contract',
      'storage_type', 'blockchain',
      'blockchain_network', 'ethereum'
    )
  ) RETURNING id INTO v_transaction_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'On-chain burn transaction logged successfully',
    'transaction_id', v_transaction_id,
    'blockchain_tx_hash', p_blockchain_tx_hash,
    'burn_type', 'on_chain'
  );
  
  RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION execute_burn_transaction_with_tracking(TEXT, TEXT[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_burn_transaction_with_tracking(TEXT, TEXT[], JSONB) TO anon;
GRANT EXECUTE ON FUNCTION execute_burn_transaction_with_tracking(TEXT, TEXT[], JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION log_onchain_burn_transaction(TEXT, TEXT[], TEXT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_onchain_burn_transaction(TEXT, TEXT[], TEXT, BIGINT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION log_onchain_burn_transaction(TEXT, TEXT[], TEXT, BIGINT, TEXT) TO service_role;

-- Query functions to identify burn types
CREATE OR REPLACE FUNCTION get_user_burn_history(p_wallet_address TEXT)
RETURNS TABLE (
  transaction_id UUID,
  burn_type TEXT,
  burned_nft_count INTEGER,
  blockchain_tx_hash TEXT,
  created_at TIMESTAMP,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id,
    bt.burn_type,
    array_length(bt.burned_nft_ids, 1) as burned_nft_count,
    bt.blockchain_transaction_hash,
    bt.created_at,
    bt.metadata
  FROM burn_transactions bt
  WHERE bt.wallet_address = LOWER(p_wallet_address)
  ORDER BY bt.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_burn_history(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_burn_history(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_burn_history(TEXT) TO service_role;

-- Comments
COMMENT ON COLUMN burn_transactions.burn_type IS 'Identifies if burn is off_chain (IPFS) or on_chain (blockchain)';
COMMENT ON COLUMN burn_transactions.blockchain_transaction_hash IS 'Ethereum/Polygon transaction hash for on-chain burns';
COMMENT ON FUNCTION execute_burn_transaction_with_tracking IS 'Enhanced function that tracks off-chain burns with proper burn_type';
COMMENT ON FUNCTION log_onchain_burn_transaction IS 'Logs on-chain burn transactions with blockchain details';
COMMENT ON FUNCTION get_user_burn_history IS 'Returns user burn history with burn type identification';
