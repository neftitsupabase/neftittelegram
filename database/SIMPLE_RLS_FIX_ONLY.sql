-- =============================================================================
-- SIMPLE RLS FIX ONLY - Just fix the function to work with your existing schema
-- =============================================================================

-- Your existing schema is perfect! Just need to fix the function to work with RLS disabled

-- Update get_staked_nfts_with_source to work with your EXACT existing schema
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

  -- Get all staked NFTs using YOUR EXISTING column names
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'nft_id', nft_id,
      'wallet_address', wallet_address,
      'nft_rarity', nft_rarity,                    -- ✅ Your existing column
      'daily_reward', daily_reward,                -- ✅ Your existing column  
      'staked_at', staked_at,                      -- ✅ Your existing column
      'last_reward_calculated', last_reward_calculated, -- ✅ Your existing column
      'staking_source', COALESCE(staking_source, 'offchain'), -- ✅ Your existing column
      'stakingSource', COALESCE(staking_source, 'offchain'),  -- Legacy compatibility
      'transaction_hash', transaction_hash         -- ✅ Your existing column
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_staked_nfts_with_source(TEXT) TO authenticated, anon, public, service_role;

-- Test the function
SELECT 'Testing function with your existing schema:' as test;
SELECT get_staked_nfts_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4') as result_test;
