-- Safe Burn System Deployment Script
-- Handles existing policies and functions gracefully

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own burn transactions" ON burn_transactions;
DROP POLICY IF EXISTS "Service role can manage all burn transactions" ON burn_transactions;

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

-- Add new columns for burn type tracking
ALTER TABLE burn_transactions 
ADD COLUMN IF NOT EXISTS burn_type TEXT DEFAULT 'off_chain' CHECK (burn_type IN ('off_chain', 'on_chain'));

ALTER TABLE burn_transactions 
ADD COLUMN IF NOT EXISTS blockchain_transaction_hash TEXT;

ALTER TABLE burn_transactions 
ADD COLUMN IF NOT EXISTS gas_used BIGINT;

ALTER TABLE burn_transactions 
ADD COLUMN IF NOT EXISTS gas_price TEXT;

-- Update existing records
UPDATE burn_transactions 
SET burn_type = 'off_chain' 
WHERE burn_type IS NULL OR transaction_type = 'cid_pool_burn';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_burn_transactions_wallet 
ON burn_transactions(wallet_address);

CREATE INDEX IF NOT EXISTS idx_burn_transactions_created_at 
ON burn_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_burn_transactions_burn_type 
ON burn_transactions(burn_type);

-- Enable RLS
ALTER TABLE burn_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (fresh)
CREATE POLICY "Users can view their own burn transactions" ON burn_transactions
  FOR SELECT USING (
    wallet_address = LOWER(current_setting('request.headers')::json->>'x-wallet-address')
    OR wallet_address = LOWER(auth.jwt()->>'wallet_address')
    OR wallet_address = LOWER(auth.jwt()->>'sub')
  );

CREATE POLICY "Service role can manage all burn transactions" ON burn_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Base burn function
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
  v_wallet_lower := LOWER(p_wallet_address);
  
  BEGIN
    DELETE FROM nft_cid_distribution_log 
    WHERE wallet_address = v_wallet_lower 
    AND nft_id = ANY(p_burned_nft_ids);
    
    GET DIAGNOSTICS v_burned_count = ROW_COUNT;
    
    IF v_burned_count != array_length(p_burned_nft_ids, 1) THEN
      RAISE EXCEPTION 'Some NFTs not found in user collection. Expected: %, Removed: %', 
        array_length(p_burned_nft_ids, 1), v_burned_count;
    END IF;
    
    INSERT INTO nft_cid_distribution_log (
      nft_id, wallet_address, rarity, cid, distributed_at, distribution_type
    ) VALUES (
      (p_result_nft->>'nft_id')::TEXT,
      v_wallet_lower,
      (p_result_nft->>'rarity')::TEXT,
      (p_result_nft->>'cid')::TEXT,
      (p_result_nft->>'distributed_at')::TIMESTAMP,
      'burn_result'
    );
    
    INSERT INTO burn_transactions (
      id, wallet_address, burned_nft_ids, result_nft_id, 
      transaction_type, burn_type, created_at
    ) VALUES (
      gen_random_uuid(), v_wallet_lower, p_burned_nft_ids,
      (p_result_nft->>'nft_id')::TEXT, 'cid_pool_burn', 'off_chain', NOW()
    );
    
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Burn transaction executed successfully',
      'burned_count', v_burned_count,
      'result_nft_id', (p_result_nft->>'nft_id')::TEXT,
      'wallet_address', v_wallet_lower
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE;
  END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION execute_burn_transaction(TEXT, TEXT[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_burn_transaction(TEXT, TEXT[], JSONB) TO anon;
GRANT EXECUTE ON FUNCTION execute_burn_transaction(TEXT, TEXT[], JSONB) TO service_role;
