-- =============================================================================
-- FIX COMPLETE STAKING SCHEMA - Work with existing tables
-- =============================================================================

-- Your existing staked_nfts schema is perfect, just need to add missing columns
ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(18,8) DEFAULT 0;

ALTER TABLE staked_nfts 
ADD COLUMN IF NOT EXISTS last_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Your existing staked_tokens schema is also good, add missing columns
ALTER TABLE staked_tokens 
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(18,8) DEFAULT 0;

ALTER TABLE staked_tokens 
ADD COLUMN IF NOT EXISTS last_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records with default values
UPDATE staked_nfts 
SET total_earned = 0, last_claim = last_reward_calculated 
WHERE total_earned IS NULL OR last_claim IS NULL;

UPDATE staked_tokens 
SET total_earned = 0, last_claim = last_reward_calculated 
WHERE total_earned IS NULL OR last_claim IS NULL;

-- Fix get_staked_nfts_with_source function for your EXACT schema
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

  -- Get all staked NFTs using YOUR EXACT column names
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
      'transaction_hash', transaction_hash,        -- ✅ Your existing column
      'total_earned', COALESCE(total_earned, 0),   -- ✅ Added column
      'last_claim', COALESCE(last_claim, last_reward_calculated) -- ✅ Added column
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

-- Create function to get staked tokens (for token staking)
CREATE OR REPLACE FUNCTION get_staked_tokens_with_source(user_wallet TEXT)
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
  RAISE NOTICE 'Getting staked tokens for wallet: %', user_wallet;

  -- Count records first for debugging
  SELECT COUNT(*) INTO record_count 
  FROM staked_tokens 
  WHERE LOWER(wallet_address) = LOWER(user_wallet);
  
  RAISE NOTICE 'Found % staked token records for wallet %', record_count, user_wallet;

  -- Get all staked tokens using YOUR EXACT column names
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'wallet_address', wallet_address,
      'amount', amount,                            -- ✅ Your existing column
      'apr_rate', COALESCE(apr_rate, 20.00),      -- ✅ Your existing column
      'daily_reward', daily_reward,                -- ✅ Your existing column
      'staked_at', staked_at,                      -- ✅ Your existing column
      'last_reward_calculated', last_reward_calculated, -- ✅ Your existing column
      'total_earned', COALESCE(total_earned, 0),   -- ✅ Added column
      'last_claim', COALESCE(last_claim, last_reward_calculated) -- ✅ Added column
    )
  ), '[]'::JSON) INTO result
  FROM staked_tokens 
  WHERE LOWER(wallet_address) = LOWER(user_wallet);

  RAISE NOTICE 'Returning % staked token records', (SELECT json_array_length(result));
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in get_staked_tokens_with_source: %', SQLERRM;
  RETURN '[]'::JSON;
END;
$$;

-- Fix unstake_nft function for your schema
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

    -- Get staked NFT record before deletion
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

-- Create unstake_tokens function for token staking
CREATE OR REPLACE FUNCTION unstake_tokens(user_wallet TEXT, amount_to_unstake DECIMAL(18,8))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    staked_record RECORD;
    total_staked DECIMAL(18,8) := 0;
    updated_count INTEGER := 0;
BEGIN
    -- Validate inputs
    IF user_wallet IS NULL OR TRIM(user_wallet) = '' THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Invalid wallet address', 
            'error', 'INVALID_WALLET'
        );
    END IF;

    IF amount_to_unstake IS NULL OR amount_to_unstake <= 0 THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Invalid unstake amount', 
            'error', 'INVALID_AMOUNT'
        );
    END IF;

    -- Get total staked amount
    SELECT COALESCE(SUM(amount), 0) INTO total_staked
    FROM staked_tokens 
    WHERE LOWER(wallet_address) = LOWER(user_wallet);
    
    IF total_staked = 0 THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'No tokens currently staked', 
            'error', 'NOT_STAKED'
        );
    END IF;
    
    IF amount_to_unstake > total_staked THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Cannot unstake more than staked amount', 
            'error', 'INSUFFICIENT_STAKED'
        );
    END IF;

    -- For simplicity, remove the oldest staking record that covers the amount
    -- In production, you might want more sophisticated logic
    DELETE FROM staked_tokens 
    WHERE id IN (
        SELECT id FROM staked_tokens 
        WHERE LOWER(wallet_address) = LOWER(user_wallet)
        AND amount <= amount_to_unstake
        ORDER BY staked_at ASC
        LIMIT 1
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count = 0 THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Failed to unstake tokens', 
            'error', 'UNSTAKE_FAILED'
        );
    END IF;

    RETURN json_build_object(
        'success', true, 
        'message', 'Tokens unstaked successfully', 
        'amount_unstaked', amount_to_unstake
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false, 
        'message', 'Error unstaking tokens: ' || SQLERRM, 
        'error', SQLERRM
    );
END;
$$;

-- Grant permissions to all functions
GRANT EXECUTE ON FUNCTION get_staked_nfts_with_source(TEXT) TO authenticated, anon, public, service_role;
GRANT EXECUTE ON FUNCTION get_staked_tokens_with_source(TEXT) TO authenticated, anon, public, service_role;
GRANT EXECUTE ON FUNCTION unstake_nft(TEXT, TEXT) TO authenticated, anon, public, service_role;
GRANT EXECUTE ON FUNCTION unstake_tokens(TEXT, DECIMAL) TO authenticated, anon, public, service_role;

-- Test both functions
SELECT 'Testing staked NFTs function:' as test;
SELECT get_staked_nfts_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4') as nft_result;

SELECT 'Testing staked tokens function:' as test;
SELECT get_staked_tokens_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4') as token_result;

-- Show table structures for verification
SELECT 'staked_nfts columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'staked_nfts' 
ORDER BY ordinal_position;

SELECT 'staked_tokens columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'staked_tokens' 
ORDER BY ordinal_position;
