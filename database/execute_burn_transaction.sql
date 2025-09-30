-- Execute Burn Transaction RPC Function for CID Pool System
-- Handles atomic burn operations with database-only updates

CREATE OR REPLACE FUNCTION execute_burn_transaction(
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
    
    -- 3. Log burn transaction in burn_transactions table (if exists)
    INSERT INTO burn_transactions (
      id,
      wallet_address,
      burned_nft_ids,
      result_nft_id,
      transaction_type,
      created_at
    ) VALUES (
      gen_random_uuid(),
      v_wallet_lower,
      p_burned_nft_ids,
      (p_result_nft->>'nft_id')::TEXT,
      'cid_pool_burn',
      NOW()
    ) ON CONFLICT DO NOTHING; -- Ignore if table doesn't exist
    
    -- Return success result
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Burn transaction executed successfully',
      'burned_count', v_burned_count,
      'result_nft_id', (p_result_nft->>'nft_id')::TEXT,
      'wallet_address', v_wallet_lower
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback and return error
    RAISE;
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_burn_transaction(TEXT, TEXT[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_burn_transaction(TEXT, TEXT[], JSONB) TO anon;
GRANT EXECUTE ON FUNCTION execute_burn_transaction(TEXT, TEXT[], JSONB) TO service_role;

-- Create burn_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS burn_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  burned_nft_ids TEXT[] NOT NULL,
  result_nft_id TEXT NOT NULL,
  transaction_type TEXT DEFAULT 'cid_pool_burn',
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_burn_transactions_wallet 
ON burn_transactions(wallet_address);

CREATE INDEX IF NOT EXISTS idx_burn_transactions_created_at 
ON burn_transactions(created_at DESC);

-- Add RLS policy for burn_transactions
ALTER TABLE burn_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own burn transactions" ON burn_transactions
  FOR SELECT USING (
    wallet_address = LOWER(current_setting('request.headers')::json->>'x-wallet-address')
    OR wallet_address = LOWER(auth.jwt()->>'wallet_address')
    OR wallet_address = LOWER(auth.jwt()->>'sub')
  );

CREATE POLICY "Service role can manage all burn transactions" ON burn_transactions
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON FUNCTION execute_burn_transaction IS 'Atomically executes burn transaction by removing burned NFTs and adding result NFT to distribution log';
COMMENT ON TABLE burn_transactions IS 'Tracks all burn transactions for audit and history purposes';
