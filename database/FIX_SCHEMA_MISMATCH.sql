-- =============================================================================
-- FIX SCHEMA MISMATCH - Align functions with actual table schema
-- =============================================================================

-- Add missing columns that functions expect
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(18,8) DEFAULT 0;

ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS last_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS nft_name TEXT;

ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS nft_image TEXT;

-- Update existing records with default values
UPDATE staked_nfts 
SET total_earned = 0 
WHERE total_earned IS NULL;

UPDATE staked_nfts 
SET last_claim = last_reward_calculated 
WHERE last_claim IS NULL;

-- Fix the get_staked_nfts_with_source function to use correct column names
CREATE OR REPLACE FUNCTION get_staked_nfts_with_source(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  record_count INTEGER;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR TRIM(user_wallet) = '' THEN
    RETURN '[]'::JSON;
  END IF;

  -- Log the attempt
  RAISE NOTICE 'Getting staked NFTs for wallet: %', user_wallet;

  -- Count records first for debugging
  SELECT COUNT(*) INTO record_count 
  FROM staked_nfts 
  WHERE LOWER(wallet_address) = LOWER(user_wallet);
  
  RAISE NOTICE 'Found % staked NFT records for wallet %', record_count, user_wallet;

  -- Get all staked NFTs with source information using CORRECT column names
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'nft_id', nft_id,
      'wallet_address', wallet_address,
      'nft_rarity', nft_rarity,
      'daily_reward', daily_reward,  -- ✅ Using daily_reward (not daily_rate)
      'staked_at', staked_at,
      'last_reward_calculated', last_reward_calculated,
      'staking_source', COALESCE(staking_source, 'offchain'),
      'stakingSource', COALESCE(staking_source, 'offchain'), -- Legacy compatibility
      'transaction_hash', transaction_hash,
      'total_earned', COALESCE(total_earned, 0),
      'last_claim', COALESCE(last_claim, last_reward_calculated),
      'nft_name', nft_name,
      'nft_image', nft_image
    )
  ), '[]'::JSON) INTO result
  FROM staked_nfts 
  WHERE LOWER(wallet_address) = LOWER(user_wallet);

  RAISE NOTICE 'Returning % staked NFTs', (SELECT json_array_length(result));
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in get_staked_nfts_with_source: %', SQLERRM;
  RETURN '[]'::JSON;
END;
$$;

-- Fix the unstake_nft function to use correct column names
CREATE OR REPLACE FUNCTION unstake_nft(user_wallet TEXT, nft_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    staked_record RECORD;
    deleted_count INTEGER := 0;
BEGIN
    -- Validate inputs
    IF user_wallet IS NULL OR TRIM(user_wallet) = '' THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Invalid wallet address', 
            'error', 'INVALID_WALLET'
        );
    END IF;

    IF nft_id IS NULL OR TRIM(nft_id) = '' THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Invalid NFT ID', 
            'error', 'INVALID_NFT_ID'
        );
    END IF;

    -- Log the unstaking attempt
    RAISE NOTICE 'Attempting to unstake NFT: % for wallet: %', nft_id, user_wallet;

    -- Get staked NFT record before deletion (with qualified column names)
    SELECT * INTO staked_record 
    FROM staked_nfts 
    WHERE LOWER(staked_nfts.wallet_address) = LOWER(user_wallet) 
    AND staked_nfts.nft_id = unstake_nft.nft_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'NFT not found in staked_nfts: % for wallet: %', nft_id, user_wallet;
        RETURN json_build_object(
            'success', false, 
            'message', 'NFT is not currently staked', 
            'error', 'NOT_STAKED'
        );
    END IF;
    
    RAISE NOTICE 'Found staked NFT record: % (staked_at: %)', staked_record.id, staked_record.staked_at;

    -- Delete the staking record
    DELETE FROM staked_nfts 
    WHERE LOWER(staked_nfts.wallet_address) = LOWER(user_wallet) 
    AND staked_nfts.nft_id = unstake_nft.nft_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % staking records for NFT: %', deleted_count, nft_id;
    
    IF deleted_count = 0 THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Failed to remove staking record', 
            'error', 'DELETE_FAILED'
        );
    END IF;

    RETURN json_build_object(
        'success', true, 
        'message', 'NFT unstaked successfully', 
        'nft_id', nft_id,
        'total_earned', COALESCE(staked_record.total_earned, 0)
    );

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error unstaking NFT %: %', nft_id, SQLERRM;
    RETURN json_build_object(
        'success', false, 
        'message', 'Error unstaking NFT: ' || SQLERRM, 
        'error', SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_staked_nfts_with_source(TEXT) TO authenticated, anon, public, service_role;
GRANT EXECUTE ON FUNCTION unstake_nft(TEXT, TEXT) TO authenticated, anon, public, service_role;

-- Test the fixed functions
SELECT 'Testing fixed functions with correct schema:' as test;
SELECT get_staked_nfts_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4') as result_test;
