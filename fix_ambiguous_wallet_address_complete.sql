-- Fix ambiguous wallet_address column reference by dropping and recreating functions
-- This addresses the "column reference 'wallet_address' is ambiguous" error

-- Step 1: Drop existing functions first
DROP FUNCTION IF EXISTS distribute_unique_nft(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS mark_cid_as_distributed_safe(VARCHAR, VARCHAR, VARCHAR, VARCHAR);

-- Step 2: Create distribute_unique_nft function with proper parameter naming
CREATE OR REPLACE FUNCTION distribute_unique_nft(
    p_wallet_address VARCHAR(100),
    p_target_rarity VARCHAR(20)
) RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    available_cid RECORD;
    nft_id VARCHAR(50);
    distribution_result JSON;
    retry_count INTEGER := 0;
    max_retries INTEGER := 3;
BEGIN
    -- Input validation
    IF p_wallet_address IS NULL OR LENGTH(p_wallet_address) < 10 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid wallet address provided'
        );
    END IF;

    -- Validate rarity input by attempting to cast to enum
    BEGIN
        PERFORM p_target_rarity::nft_rarity;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid rarity type: ' || p_target_rarity || '. Valid types: common, rare, legendary, platinum, silver, gold'
        );
    END;

    -- Generate unique NFT ID with timestamp and random component
    nft_id := 'nft_' || p_target_rarity || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || (RANDOM() * 10000)::INTEGER;
    
    -- Get next available CID
    SELECT * INTO available_cid 
    FROM get_next_available_cid(p_target_rarity);
    
    -- Check if CID is available
    IF available_cid.cid IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No available CIDs for rarity: ' || p_target_rarity
        );
    END IF;
    
    -- Mark CID as distributed with retry logic
    WHILE retry_count < max_retries LOOP
        BEGIN
            SELECT mark_cid_as_distributed_safe(
                available_cid.cid,
                p_wallet_address,
                nft_id,
                p_target_rarity
            ) INTO distribution_result;
            
            -- If successful, exit loop
            IF (distribution_result->>'success')::boolean THEN
                EXIT;
            END IF;
            
            -- If failed due to duplicate key, retry
            IF distribution_result->>'error' LIKE '%duplicate key%' THEN
                retry_count := retry_count + 1;
                
                -- Reset sequence and try again
                PERFORM setval('nft_cid_distribution_log_id_seq', 
                    (SELECT COALESCE(MAX(id), 0) + 1 FROM nft_cid_distribution_log), 
                    false);
                
                -- Generate new NFT ID for retry
                nft_id := 'nft_' || p_target_rarity || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || (RANDOM() * 10000)::INTEGER;
                
                -- Small delay before retry
                PERFORM pg_sleep(0.1);
            ELSE
                -- Non-duplicate error, exit with error
                RETURN distribution_result;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            retry_count := retry_count + 1;
            
            IF retry_count >= max_retries THEN
                RETURN json_build_object(
                    'success', false,
                    'error', 'Distribution failed after retries: ' || SQLERRM
                );
            END IF;
            
            -- Reset sequence and retry
            PERFORM setval('nft_cid_distribution_log_id_seq', 
                (SELECT COALESCE(MAX(id), 0) + 1 FROM nft_cid_distribution_log), 
                false);
            
            PERFORM pg_sleep(0.1);
        END;
    END LOOP;
    
    -- Return complete NFT data if successful
    IF (distribution_result->>'success')::boolean THEN
        RETURN json_build_object(
            'success', true,
            'nft_data', json_build_object(
                'id', nft_id,
                'name', 'NEFTIT ' || INITCAP(p_target_rarity) || ' NFT',
                'description', '', -- Empty description to avoid generic text
                'image', available_cid.image_url,
                'rarity', p_target_rarity,
                'cid', available_cid.cid,
                'metadata_cid', available_cid.metadata_cid,
                'attributes', json_build_array(
                    json_build_object('trait_type', 'Rarity', 'value', INITCAP(p_target_rarity)),
                    json_build_object('trait_type', 'Platform', 'value', 'NEFTIT'),
                    json_build_object('trait_type', 'Unique ID', 'value', nft_id)
                )
            )
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to distribute NFT after ' || max_retries || ' attempts'
        );
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Unexpected error during distribution: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create mark_cid_as_distributed_safe function with proper parameter naming
CREATE OR REPLACE FUNCTION mark_cid_as_distributed_safe(
    p_target_cid VARCHAR(100),
    p_wallet_address VARCHAR(100),
    p_nft_id VARCHAR(50),
    p_target_rarity VARCHAR(20)
) RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    pool_record RECORD;
BEGIN
    -- Update the pool record
    UPDATE nft_cid_pools 
    SET 
        is_distributed = TRUE,
        distributed_to_wallet = p_wallet_address,
        distributed_at = NOW()
    WHERE cid = p_target_cid
    AND is_distributed = FALSE
    RETURNING * INTO pool_record;
    
    -- Check if update was successful
    IF pool_record.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'CID not found or already distributed'
        );
    END IF;
    
    -- Check if distribution log entry already exists
    IF EXISTS (
        SELECT 1 FROM nft_cid_distribution_log 
        WHERE cid = p_target_cid 
        AND wallet_address = p_wallet_address
    ) THEN
        -- Entry already exists, return success
        RETURN json_build_object(
            'success', true,
            'cid', p_target_cid,
            'distributed_to', p_wallet_address,
            'nft_id', p_nft_id,
            'rarity', p_target_rarity,
            'note', 'Distribution log entry already existed'
        );
    END IF;
    
    -- Insert into distribution log
    INSERT INTO nft_cid_distribution_log (
        wallet_address,
        rarity,
        cid,
        nft_id,
        distributed_at,
        distribution_method
    ) VALUES (
        p_wallet_address,
        p_target_rarity::nft_rarity,
        p_target_cid,
        p_nft_id,
        NOW(),
        'unique_distribution'
    );
    
    RETURN json_build_object(
        'success', true,
        'cid', p_target_cid,
        'distributed_to', p_wallet_address,
        'nft_id', p_nft_id,
        'rarity', p_target_rarity
    );
    
EXCEPTION 
    WHEN unique_violation THEN
        -- Handle duplicate key gracefully
        RETURN json_build_object(
            'success', false,
            'error', 'duplicate key violation - sequence may need reset'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Database error: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION mark_cid_as_distributed_safe(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed_safe(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed_safe(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;

-- Step 5: Reset sequence to ensure clean state
SELECT setval('nft_cid_distribution_log_id_seq', 
    (SELECT COALESCE(MAX(id), 0) + 1 FROM nft_cid_distribution_log), 
    false);

COMMENT ON FUNCTION distribute_unique_nft IS 'Fixed NFT distribution with proper parameter naming to avoid ambiguous column references';
COMMENT ON FUNCTION mark_cid_as_distributed_safe IS 'Fixed CID distribution marking with proper parameter naming to avoid ambiguous column references';
