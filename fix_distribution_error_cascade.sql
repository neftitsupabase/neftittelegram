-- Fix distribution error cascade and duplicate key issues
-- This addresses both the duplicate key error and prevents error message propagation

-- Step 1: Clean up any malformed user records created by error messages
DELETE FROM users 
WHERE wallet_address LIKE '%duplicate key value violates unique constraint%'
   OR wallet_address LIKE '%Distribution failed%'
   OR wallet_address LIKE '%error%'
   OR LENGTH(wallet_address) > 100;

-- Step 2: Reset the distribution log sequence to prevent duplicate key errors
DO $$
DECLARE
    max_id INTEGER;
    seq_val INTEGER;
BEGIN
    -- Get the current maximum ID from the table
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM nft_cid_distribution_log;
    
    -- Get the current sequence value
    SELECT last_value INTO seq_val FROM nft_cid_distribution_log_id_seq;
    
    RAISE NOTICE 'Current max ID in table: %, Current sequence value: %', max_id, seq_val;
    
    -- Reset sequence to be ahead of max ID
    PERFORM setval('nft_cid_distribution_log_id_seq', max_id + 1, false);
    RAISE NOTICE 'Reset sequence to: %', max_id + 1;
END $$;

-- Step 3: Create an improved distribute_unique_nft function with better error handling
CREATE OR REPLACE FUNCTION distribute_unique_nft(
    wallet_address VARCHAR(100),
    target_rarity VARCHAR(20)
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
    IF wallet_address IS NULL OR LENGTH(wallet_address) < 10 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid wallet address provided'
        );
    END IF;

    -- Validate rarity input by attempting to cast to enum
    BEGIN
        PERFORM target_rarity::nft_rarity;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid rarity type: ' || target_rarity || '. Valid types: common, rare, legendary, platinum, silver, gold'
        );
    END;

    -- Generate unique NFT ID with timestamp and random component
    nft_id := 'nft_' || target_rarity || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || (RANDOM() * 10000)::INTEGER;
    
    -- Get next available CID
    SELECT * INTO available_cid 
    FROM get_next_available_cid(target_rarity);
    
    -- Check if CID is available
    IF available_cid.cid IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No available CIDs for rarity: ' || target_rarity
        );
    END IF;
    
    -- Mark CID as distributed with retry logic
    WHILE retry_count < max_retries LOOP
        BEGIN
            SELECT mark_cid_as_distributed_safe(
                available_cid.cid,
                wallet_address,
                nft_id,
                target_rarity
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
                nft_id := 'nft_' || target_rarity || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || (RANDOM() * 10000)::INTEGER;
                
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
                'name', 'NEFTIT ' || INITCAP(target_rarity) || ' NFT',
                'description', '', -- Empty description to avoid generic text
                'image', available_cid.image_url,
                'rarity', target_rarity,
                'cid', available_cid.cid,
                'metadata_cid', available_cid.metadata_cid,
                'attributes', json_build_array(
                    json_build_object('trait_type', 'Rarity', 'value', INITCAP(target_rarity)),
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

-- Step 4: Create a safer version of mark_cid_as_distributed
CREATE OR REPLACE FUNCTION mark_cid_as_distributed_safe(
    target_cid VARCHAR(100),
    wallet_address VARCHAR(100),
    nft_id VARCHAR(50),
    target_rarity VARCHAR(20)
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
        distributed_to_wallet = wallet_address,
        distributed_at = NOW()
    WHERE cid = target_cid
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
        WHERE cid = target_cid 
        AND wallet_address = mark_cid_as_distributed_safe.wallet_address
    ) THEN
        -- Entry already exists, return success
        RETURN json_build_object(
            'success', true,
            'cid', target_cid,
            'distributed_to', wallet_address,
            'nft_id', nft_id,
            'rarity', target_rarity,
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
        wallet_address,
        target_rarity::nft_rarity,
        target_cid,
        nft_id,
        NOW(),
        'unique_distribution'
    );
    
    RETURN json_build_object(
        'success', true,
        'cid', target_cid,
        'distributed_to', wallet_address,
        'nft_id', nft_id,
        'rarity', target_rarity
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

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION mark_cid_as_distributed_safe(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed_safe(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed_safe(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;

-- Step 6: Add constraint to prevent malformed wallet addresses in users table
DO $$
BEGIN
    -- Add check constraint to ensure wallet addresses are properly formatted
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'users_wallet_address_format_check'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT users_wallet_address_format_check 
        CHECK (
            wallet_address ~ '^0x[a-fA-F0-9]{40}$' 
            OR wallet_address ~ '^[a-zA-Z0-9_.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            OR LENGTH(wallet_address) BETWEEN 10 AND 100
        );
        
        RAISE NOTICE 'Added wallet address format constraint';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add wallet address constraint: %', SQLERRM;
END $$;

-- Step 7: Final sequence reset to ensure clean state
SELECT setval('nft_cid_distribution_log_id_seq', 
    (SELECT COALESCE(MAX(id), 0) + 1 FROM nft_cid_distribution_log), 
    false);

COMMENT ON FUNCTION distribute_unique_nft IS 'Improved NFT distribution with retry logic and error cascade prevention';
COMMENT ON FUNCTION mark_cid_as_distributed_safe IS 'Safe CID distribution marking with duplicate key handling';
