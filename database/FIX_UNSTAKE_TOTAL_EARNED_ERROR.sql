-- Fix the unstake_nft function to remove total_earned dependency
-- Since rewards are tracked in staking_rewards table, not staked_nfts table

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

    -- ✅ FIXED: Removed total_earned since rewards are tracked in staking_rewards table
    RETURN json_build_object(
        'success', true, 
        'message', 'NFT unstaked successfully', 
        'nft_id', nft_id,
        'staked_duration_hours', EXTRACT(EPOCH FROM (NOW() - staked_record.staked_at)) / 3600
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
GRANT EXECUTE ON FUNCTION unstake_nft(TEXT, TEXT) TO authenticated, anon, public, service_role;

-- Test the fixed function
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ FIXED unstake_nft function:';
    RAISE NOTICE '• Removed total_earned dependency';
    RAISE NOTICE '• Rewards are tracked in staking_rewards table';
    RAISE NOTICE '• Function now returns staked_duration_hours instead';
    RAISE NOTICE '';
END $$;
