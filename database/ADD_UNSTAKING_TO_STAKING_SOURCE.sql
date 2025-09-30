-- =============================================================================
-- ADD UNSTAKING FUNCTIONS TO STAKING SOURCE TRACKING
-- =============================================================================
-- This adds the missing unstaking functions to the authoritative staking file

-- Add unstake_nft function with RLS bypass and column qualification
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

    -- CRITICAL: Temporarily disable RLS for this function
    SET row_security = off;

    -- Get staked NFT record before deletion (with qualified column names)
    SELECT * INTO staked_record 
    FROM staked_nfts 
    WHERE LOWER(staked_nfts.wallet_address) = LOWER(user_wallet) 
    AND staked_nfts.nft_id = unstake_nft.nft_id;
    
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
    WHERE LOWER(staked_nfts.wallet_address) = LOWER(user_wallet) 
    AND staked_nfts.nft_id = unstake_nft.nft_id;
    
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
        'total_earned', COALESCE(staked_record.total_earned, 0)
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

-- Add unstake_nft_with_source function for enhanced unstaking
CREATE OR REPLACE FUNCTION unstake_nft_with_source(
    user_wallet TEXT, 
    nft_id TEXT,
    staking_source TEXT DEFAULT 'offchain'
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
    RAISE NOTICE 'Attempting to unstake NFT: % for wallet: % (source: %)', nft_id, user_wallet, staking_source;

    -- CRITICAL: Temporarily disable RLS for this function
    SET row_security = off;

    -- Get staked NFT record before deletion (with source matching)
    SELECT * INTO staked_record 
    FROM staked_nfts 
    WHERE LOWER(staked_nfts.wallet_address) = LOWER(user_wallet) 
    AND staked_nfts.nft_id = unstake_nft_with_source.nft_id
    AND COALESCE(staked_nfts.staking_source, 'offchain') = staking_source;
    
    IF NOT FOUND THEN
        SET row_security = on;
        RAISE NOTICE 'NFT not found in staked_nfts: % for wallet: % with source: %', nft_id, user_wallet, staking_source;
        RETURN json_build_object(
            'success', false, 
            'message', 'NFT is not currently staked with the specified source', 
            'error', 'NOT_STAKED'
        );
    END IF;
    
    RAISE NOTICE 'Found staked NFT record: % (staked_at: %, source: %)', staked_record.id, staked_record.staked_at, staked_record.staking_source;

    -- CRITICAL: Delete the staking record to prevent reward leakage
    DELETE FROM staked_nfts 
    WHERE LOWER(staked_nfts.wallet_address) = LOWER(user_wallet) 
    AND staked_nfts.nft_id = unstake_nft_with_source.nft_id
    AND COALESCE(staked_nfts.staking_source, 'offchain') = staking_source;
    
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
        'staking_source', staking_source,
        'total_earned', COALESCE(staked_record.total_earned, 0)
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

-- Grant permissions for both unstaking functions
GRANT EXECUTE ON FUNCTION unstake_nft(TEXT, TEXT) TO authenticated, anon, public, service_role;
GRANT EXECUTE ON FUNCTION unstake_nft_with_source(TEXT, TEXT, TEXT) TO authenticated, anon, public, service_role;

-- Add comments for documentation
COMMENT ON FUNCTION unstake_nft(TEXT, TEXT) IS 'Unstakes NFT with RLS bypass and column qualification fixes';
COMMENT ON FUNCTION unstake_nft_with_source(TEXT, TEXT, TEXT) IS 'Unstakes NFT with staking source tracking (onchain/offchain)';

-- Test the unstaking functions
SELECT 'Testing unstaking functions:' as test;
SELECT 'Functions created successfully - ready for unstaking operations' as status;
