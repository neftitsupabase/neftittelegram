-- =============================================================================
-- FIX RLS STAKING ISSUE - IMMEDIATE SOLUTION
-- =============================================================================

-- First, let's check current RLS status
SELECT 'Current RLS policies on staked_nfts:' as info;
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'staked_nfts';

-- Fix 1: Update the function to properly bypass RLS
CREATE OR REPLACE FUNCTION get_staked_nfts_with_source(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    -- Validate input
    IF user_wallet IS NULL OR TRIM(user_wallet) = '' THEN
        RETURN '[]'::JSON;
    END IF;

    -- Log the attempt
    RAISE NOTICE 'Getting staked NFTs for wallet: %', user_wallet;

    -- CRITICAL: Temporarily disable RLS for this function
    SET row_security = off;

    -- Get all staked NFTs with source information
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', id,
            'nft_id', nft_id,
            'wallet_address', wallet_address,
            'staked_at', staked_at,
            'daily_rate', daily_rate,
            'total_earned', total_earned,
            'last_claim', last_claim,
            'staking_source', COALESCE(staking_source, 'offchain'),
            'stakingSource', COALESCE(staking_source, 'offchain') -- Legacy compatibility
        )
    ), '[]'::JSON) INTO result
    FROM staked_nfts 
    WHERE LOWER(wallet_address) = LOWER(user_wallet);

    -- Re-enable RLS
    SET row_security = on;

    RAISE NOTICE 'Found % staked NFTs', (SELECT json_array_length(result));
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Re-enable RLS in case of error
    SET row_security = on;
    RAISE NOTICE 'Error in get_staked_nfts_with_source: %', SQLERRM;
    RETURN '[]'::JSON;
END;
$$;

-- Fix 2: Update unstake_nft function with same RLS bypass
CREATE OR REPLACE FUNCTION unstake_nft(
    user_wallet TEXT, 
    nft_id TEXT
)
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

    -- CRITICAL: Temporarily disable RLS for this function
    SET row_security = off;

    -- Get staked NFT record before deletion
    SELECT * INTO staked_record 
    FROM staked_nfts 
    WHERE LOWER(wallet_address) = LOWER(user_wallet) AND nft_id = unstake_nft.nft_id;
    
    IF NOT FOUND THEN
        SET row_security = on;
        RAISE NOTICE 'NFT not found in staked_nfts: % for wallet: %', nft_id, user_wallet;
        RETURN json_build_object(
            'success', false, 
            'message', 'NFT is not currently staked', 
            'error', 'NOT_STAKED'
        );
    END IF;
    
    RAISE NOTICE 'Found staked NFT record: % (staked_at: %)', staked_record.id, staked_record.staked_at;

    -- CRITICAL: Delete the staking record to prevent reward leakage
    DELETE FROM staked_nfts 
    WHERE LOWER(wallet_address) = LOWER(user_wallet) AND nft_id = unstake_nft.nft_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % staking records for NFT: %', deleted_count, nft_id;
    
    -- Re-enable RLS
    SET row_security = on;
    
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
        'total_earned', staked_record.total_earned
    );

EXCEPTION WHEN OTHERS THEN
    -- Re-enable RLS in case of error
    SET row_security = on;
    RAISE NOTICE 'Error unstaking NFT %: %', nft_id, SQLERRM;
    RETURN json_build_object(
        'success', false, 
        'message', 'Error unstaking NFT: ' || SQLERRM, 
        'error', SQLERRM
    );
END;
$$;

-- Fix 3: Grant proper permissions to the functions
GRANT EXECUTE ON FUNCTION get_staked_nfts_with_source(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION unstake_nft(TEXT, TEXT) TO authenticated, anon, public;

-- Test the fix
SELECT 'Testing fixed function:' as test;
SELECT get_staked_nfts_with_source('0xE7c8B6180286abDB598F0F818F5Fd5b4c42b9ac4') as result_fixed;
SELECT get_staked_nfts_with_source('0xe7c8b6180286abdb598f0f818f5fd5b4c42b9ac4') as result_fixed_lower;
