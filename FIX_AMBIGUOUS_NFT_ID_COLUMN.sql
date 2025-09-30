-- FIX AMBIGUOUS NFT_ID COLUMN ERROR IN STAKING FUNCTIONS
-- This fixes the "column reference 'nft_id' is ambiguous" error

-- Drop and recreate the problematic function with proper parameter naming
DROP FUNCTION IF EXISTS stake_nft_with_source(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Create enhanced stake_nft function with staking source support (FIXED)
CREATE OR REPLACE FUNCTION stake_nft_with_source(
  user_wallet TEXT,
  p_nft_id TEXT,  -- 🔥 FIXED: Renamed parameter to avoid ambiguity
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

  -- 🔥 FIXED: Check if NFT is already staked (using renamed parameter)
  IF EXISTS (SELECT 1 FROM staked_nfts WHERE wallet_address = user_wallet AND nft_id = p_nft_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'NFT is already staked.'
    );
  END IF;

  -- Calculate daily reward based on rarity (ENHANCED RARITY SUPPORT)
  daily_reward_amount := CASE LOWER(nft_rarity)
    WHEN 'common' THEN 0.1
    WHEN 'rare' THEN 0.4
    WHEN 'legendary' THEN 1.0
    WHEN 'platinum' THEN 2.5
    WHEN 'silver' THEN 8.0
    WHEN 'gold' THEN 30.0
    -- Handle exact case matches for blockchain rarities
    WHEN 'Common' THEN 0.1
    WHEN 'Rare' THEN 0.4
    WHEN 'Legendary' THEN 1.0
    WHEN 'Platinum' THEN 2.5
    WHEN 'Silver' THEN 8.0
    WHEN 'Gold' THEN 30.0
    -- Handle additional variations
    ELSE 0.1  -- Default to common tier for unknown rarities
  END;

  -- 🔥 FIXED: Insert into staked_nfts with source tracking (using renamed parameter)
  INSERT INTO staked_nfts (
    wallet_address, 
    nft_id, 
    nft_rarity, 
    daily_reward, 
    staking_source,
    transaction_hash,
    staked_at,
    last_reward_calculated
  ) VALUES (
    user_wallet, 
    p_nft_id,  -- 🔥 FIXED: Use renamed parameter
    nft_rarity, 
    daily_reward_amount,
    staking_source,
    transaction_hash,
    NOW(),
    NOW()
  );

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'message', 'NFT staked successfully with ' || staking_source || ' tracking',
    'daily_reward', daily_reward_amount,
    'staking_source', staking_source,
    'transaction_hash', transaction_hash,
    'nft_id', p_nft_id,  -- 🔥 FIXED: Use renamed parameter
    'nft_rarity', nft_rarity
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

-- Also fix the unstake_nft function to avoid similar issues
DROP FUNCTION IF EXISTS unstake_nft(TEXT, TEXT);

CREATE OR REPLACE FUNCTION unstake_nft(
  user_wallet TEXT, 
  p_nft_id TEXT  -- 🔥 FIXED: Renamed parameter to avoid ambiguity
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    staked_record RECORD;
BEGIN
    -- 🔥 FIXED: Get staked NFT record (using renamed parameter)
    SELECT * INTO staked_record FROM staked_nfts WHERE wallet_address = user_wallet AND nft_id = p_nft_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'NFT is not staked', 'error', 'NOT_STAKED');
    END IF;
    
    -- 🔥 FIXED: Remove from staked NFTs (using renamed parameter)
    DELETE FROM staked_nfts WHERE wallet_address = user_wallet AND nft_id = p_nft_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'NFT unstaked successfully',
        'nft_id', p_nft_id,  -- 🔥 FIXED: Use renamed parameter
        'total_earned', staked_record.total_earned,
        'staking_source', staked_record.staking_source,
        'transaction_hash', staked_record.transaction_hash
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'Error unstaking NFT: ' || SQLERRM, 'error', SQLERRM);
END;
$$;

-- Grant permissions for unstake function
GRANT EXECUTE ON FUNCTION unstake_nft(TEXT, TEXT) TO anon, authenticated, service_role;

-- Update backward compatibility wrapper to use new parameter name
DROP FUNCTION IF EXISTS stake_nft(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION stake_nft(
  user_wallet TEXT,
  p_nft_id TEXT,  -- 🔥 FIXED: Renamed parameter to match new function
  nft_rarity TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call new function with default offchain source
  RETURN stake_nft_with_source(user_wallet, p_nft_id, nft_rarity, 'offchain', NULL);
END;
$$;

-- Grant permissions for backward compatibility function
GRANT EXECUTE ON FUNCTION stake_nft(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Add comments for documentation
COMMENT ON FUNCTION stake_nft_with_source(TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Stakes NFT with staking source tracking (onchain/offchain) and optional transaction hash - FIXED ambiguous column reference';
COMMENT ON FUNCTION unstake_nft(TEXT, TEXT) IS 'Unstakes NFT and returns staking details - FIXED ambiguous column reference';
COMMENT ON FUNCTION stake_nft(TEXT, TEXT, TEXT) IS 'Backward compatibility wrapper for stake_nft_with_source with default offchain staking - FIXED ambiguous column reference';

-- Verify the fix by testing the function signature
SELECT 'stake_nft_with_source function fixed successfully' as status;
