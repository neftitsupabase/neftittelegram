-- Fix ambiguous column reference in stake_nft_with_source function
-- The issue is on line 129 where nft_id reference is ambiguous

CREATE OR REPLACE FUNCTION stake_nft_with_source(
  user_wallet TEXT,
  nft_id TEXT,
  nft_rarity TEXT,
  staking_source TEXT DEFAULT 'offchain',
  transaction_hash TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  daily_reward_amount DECIMAL(10,2);
  result JSON;
  input_nft_id TEXT := nft_id; -- Store parameter in local variable to avoid ambiguity
BEGIN
  -- Validate staking source
  IF staking_source NOT IN ('onchain', 'offchain') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid staking source. Must be onchain or offchain.'
    );
  END IF;

  -- Check if NFT is already staked (FIXED: use local variable to avoid ambiguity)
  IF EXISTS (SELECT 1 FROM staked_nfts WHERE wallet_address = user_wallet AND staked_nfts.nft_id = input_nft_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'NFT is already staked.'
    );
  END IF;

  -- Calculate daily reward based on rarity
  daily_reward_amount := CASE nft_rarity
    WHEN 'Common' THEN 0.1
    WHEN 'Rare' THEN 0.4
    WHEN 'Legendary' THEN 1.0
    WHEN 'Platinum' THEN 2.5
    WHEN 'Silver' THEN 8.0
    WHEN 'Gold' THEN 30.0
    ELSE 0.1
  END;

  -- Insert into staked_nfts with source tracking (FIXED: use local variable)
  INSERT INTO staked_nfts (
    wallet_address, 
    nft_id, 
    nft_rarity, 
    daily_reward, 
    staking_source,
    transaction_hash,
    staked_at
  ) VALUES (
    user_wallet, 
    input_nft_id, 
    nft_rarity, 
    daily_reward_amount,
    staking_source,
    transaction_hash,
    NOW()
  );

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'message', 'NFT staked successfully with ' || staking_source || ' tracking',
    'daily_reward', daily_reward_amount,
    'staking_source', staking_source,
    'transaction_hash', transaction_hash
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to stake NFT: ' || SQLERRM
    );
END;
$$;

-- Grant permissions for the fixed function
GRANT EXECUTE ON FUNCTION stake_nft_with_source(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION stake_nft_with_source(TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Stakes NFT with staking source tracking (onchain/offchain) and optional transaction hash - FIXED ambiguous column reference';
