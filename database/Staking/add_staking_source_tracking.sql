-- Add staking source tracking to distinguish onchain vs offchain staking
-- This allows tracking both types while using unified offchain reward system

-- Add staking_source column to staked_nfts table
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS staking_source TEXT DEFAULT 'offchain' 
CHECK (staking_source IN ('onchain', 'offchain'));

-- Add blockchain transaction hash for onchain staking
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Add index for efficient queries by staking source
CREATE INDEX IF NOT EXISTS idx_staked_nfts_staking_source ON staked_nfts(wallet_address, staking_source);

-- Update existing records to have default offchain source
UPDATE staked_nfts 
SET staking_source = 'offchain' 
WHERE staking_source IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN staked_nfts.staking_source IS 'Tracks whether NFT was staked onchain (blockchain) or offchain (database only)';
COMMENT ON COLUMN staked_nfts.transaction_hash IS 'Blockchain transaction hash for onchain staking operations';

-- Update get_user_staking_summary function to include staking source breakdown
CREATE OR REPLACE FUNCTION get_user_staking_summary(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'staked_nfts_count', COALESCE(nft_count, 0),
    'onchain_nfts_count', COALESCE(onchain_nft_count, 0),
    'offchain_nfts_count', COALESCE(offchain_nft_count, 0),
    'staked_tokens_amount', COALESCE(token_amount, 0),
    'total_pending_rewards', COALESCE(pending_rewards, 0),
    'nft_pending_rewards', COALESCE(nft_pending_rewards, 0),
    'token_pending_rewards', COALESCE(token_pending_rewards, 0),
    'daily_nft_rewards', COALESCE(daily_nft_rewards, 0),
    'daily_token_rewards', COALESCE(daily_token_rewards, 0)
  ) INTO result
  FROM (
    SELECT 
      (SELECT COUNT(*) FROM staked_nfts WHERE wallet_address = user_wallet) as nft_count,
      (SELECT COUNT(*) FROM staked_nfts WHERE wallet_address = user_wallet AND staking_source = 'onchain') as onchain_nft_count,
      (SELECT COUNT(*) FROM staked_nfts WHERE wallet_address = user_wallet AND staking_source = 'offchain') as offchain_nft_count,
      (SELECT COALESCE(SUM(amount), 0) FROM staked_tokens WHERE wallet_address = user_wallet) as token_amount,
      (SELECT COALESCE(SUM(reward_amount), 0) FROM staking_rewards WHERE wallet_address = user_wallet AND is_claimed = FALSE) as pending_rewards,
      (SELECT COALESCE(SUM(reward_amount), 0) FROM staking_rewards sr 
       JOIN staked_nfts sn ON sr.source_id = sn.id 
       WHERE sr.wallet_address = user_wallet AND sr.reward_type = 'nft_staking' AND sr.is_claimed = FALSE) as nft_pending_rewards,
      (SELECT COALESCE(SUM(reward_amount), 0) FROM staking_rewards sr 
       JOIN staked_tokens st ON sr.source_id = st.id 
       WHERE sr.wallet_address = user_wallet AND sr.reward_type = 'token_staking' AND sr.is_claimed = FALSE) as token_pending_rewards,
      (SELECT COALESCE(SUM(daily_reward), 0) FROM staked_nfts WHERE wallet_address = user_wallet) as daily_nft_rewards,
      (SELECT COALESCE(SUM(daily_reward), 0) FROM staked_tokens WHERE wallet_address = user_wallet) as daily_token_rewards
  ) summary;
  
  RETURN result;
END;
$$;

-- Create function to get staked NFTs with staking source information
CREATE OR REPLACE FUNCTION get_staked_nfts_with_source(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'nft_id', nft_id,
      'wallet_address', wallet_address,
      'nft_rarity', nft_rarity,
      'daily_reward', daily_reward,
      'staked_at', staked_at,
      'last_reward_calculated', last_reward_calculated,
      'staking_source', staking_source,
      'transaction_hash', transaction_hash
    )
  ), '[]'::json) INTO result
  FROM staked_nfts 
  WHERE wallet_address = user_wallet;
  
  RETURN result;
END;
$$;

-- Grant permissions for new function
GRANT EXECUTE ON FUNCTION get_staked_nfts_with_source(TEXT) TO anon, authenticated, service_role;

-- Update calculate_daily_rewards function to work with both staking sources
-- (No changes needed - it already processes all records in staked_nfts regardless of source)

-- Create indexes for performance optimization with staking source
CREATE INDEX IF NOT EXISTS idx_staked_nfts_source_wallet ON staked_nfts(staking_source, wallet_address);
CREATE INDEX IF NOT EXISTS idx_staked_nfts_transaction_hash ON staked_nfts(transaction_hash) WHERE transaction_hash IS NOT NULL;

COMMENT ON FUNCTION get_staked_nfts_with_source(TEXT) IS 'Returns all staked NFTs with staking source information (onchain/offchain)';

-- Create enhanced stake_nft function with staking source support
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
BEGIN
  -- Validate staking source
  IF staking_source NOT IN ('onchain', 'offchain') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid staking source. Must be onchain or offchain.'
    );
  END IF;

  -- Check if NFT is already staked
  IF EXISTS (SELECT 1 FROM staked_nfts WHERE wallet_address = user_wallet AND nft_id = stake_nft_with_source.nft_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'NFT is already staked.'
    );
  END IF;

  -- Calculate daily reward based on rarity
  daily_reward_amount := CASE nft_rarity
    WHEN 'Common' THEN 1.0
    WHEN 'Rare' THEN 2.0
    WHEN 'Legendary' THEN 5.0
    WHEN 'Platinum' THEN 10.0
    WHEN 'Silver' THEN 3.0
    WHEN 'Gold' THEN 7.0
    ELSE 1.0
  END;

  -- Insert into staked_nfts with source tracking
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
    stake_nft_with_source.nft_id, 
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

-- Grant permissions for new function
GRANT EXECUTE ON FUNCTION stake_nft_with_source(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION stake_nft_with_source(TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Stakes NFT with staking source tracking (onchain/offchain) and optional transaction hash';

-- Create backward compatibility wrapper for existing stake_nft calls
CREATE OR REPLACE FUNCTION stake_nft(
  user_wallet TEXT,
  nft_id TEXT,
  nft_rarity TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call new function with default offchain source
  RETURN stake_nft_with_source(user_wallet, nft_id, nft_rarity, 'offchain', NULL);
END;
$$;

-- Grant permissions for backward compatibility function
GRANT EXECUTE ON FUNCTION stake_nft(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION stake_nft(TEXT, TEXT, TEXT) IS 'Backward compatibility wrapper for stake_nft_with_source with default offchain staking';
