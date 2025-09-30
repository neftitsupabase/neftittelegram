-- Fix duplicate key violation in nft_cid_distribution_log table
-- This addresses the "duplicate key value violates unique constraint 'nft_cid_distribution_log_pkey'" error

-- Step 1: Check current sequence value and table max ID
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
    
    -- If sequence is behind the max ID, reset it
    IF seq_val <= max_id THEN
        PERFORM setval('nft_cid_distribution_log_id_seq', max_id + 1, false);
        RAISE NOTICE 'Reset sequence to: %', max_id + 1;
    END IF;
END $$;

-- Step 2: Update the mark_cid_as_distributed function to handle duplicate key errors
CREATE OR REPLACE FUNCTION mark_cid_as_distributed(
    target_cid VARCHAR(100),
    wallet_address VARCHAR(100),
    nft_id VARCHAR(50),
    target_rarity VARCHAR(20)
) RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    pool_record RECORD;
    result JSON;
    retry_count INTEGER := 0;
    max_retries INTEGER := 3;
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
    
    -- Log the distribution with retry logic for duplicate key errors
    WHILE retry_count < max_retries LOOP
        BEGIN
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
            
            -- If we get here, the insert was successful
            EXIT;
            
        EXCEPTION 
            WHEN unique_violation THEN
                -- Handle duplicate key error
                retry_count := retry_count + 1;
                
                IF retry_count >= max_retries THEN
                    -- Check if this exact record already exists
                    IF EXISTS (
                        SELECT 1 FROM nft_cid_distribution_log 
                        WHERE wallet_address = mark_cid_as_distributed.wallet_address
                        AND cid = target_cid 
                        AND nft_id = mark_cid_as_distributed.nft_id
                    ) THEN
                        -- Record already exists, treat as success
                        RAISE NOTICE 'Distribution record already exists for CID: %, NFT ID: %', target_cid, nft_id;
                        EXIT;
                    ELSE
                        -- Reset sequence and try again
                        PERFORM setval('nft_cid_distribution_log_id_seq', 
                            (SELECT COALESCE(MAX(id), 0) + 1 FROM nft_cid_distribution_log), 
                            false);
                        
                        IF retry_count < max_retries THEN
                            RAISE NOTICE 'Retrying distribution log insert (attempt %/%)', retry_count + 1, max_retries;
                            -- Small delay before retry
                            PERFORM pg_sleep(0.1);
                        ELSE
                            RAISE EXCEPTION 'Failed to insert distribution log after % retries: %', max_retries, SQLERRM;
                        END IF;
                    END IF;
                END IF;
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'cid', target_cid,
        'distributed_to', wallet_address,
        'nft_id', nft_id,
        'rarity', target_rarity
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Distribution failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a function to safely reset the sequence when needed
CREATE OR REPLACE FUNCTION reset_distribution_log_sequence_safe()
RETURNS VOID AS $$
DECLARE
    max_id INTEGER;
    current_seq INTEGER;
BEGIN
    -- Get current max ID
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM nft_cid_distribution_log;
    
    -- Get current sequence value
    SELECT last_value INTO current_seq FROM nft_cid_distribution_log_id_seq;
    
    -- Only reset if sequence is behind
    IF current_seq <= max_id THEN
        PERFORM setval('nft_cid_distribution_log_id_seq', max_id + 1, false);
        RAISE NOTICE 'Sequence reset from % to %', current_seq, max_id + 1;
    ELSE
        RAISE NOTICE 'Sequence is already ahead: % > %', current_seq, max_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION reset_distribution_log_sequence_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_distribution_log_sequence_safe() TO anon;
GRANT EXECUTE ON FUNCTION reset_distribution_log_sequence_safe() TO service_role;

-- Step 5: Run the sequence fix immediately
SELECT reset_distribution_log_sequence_safe();

COMMENT ON FUNCTION mark_cid_as_distributed IS 'Distributes CID with duplicate key error handling and retry logic';
COMMENT ON FUNCTION reset_distribution_log_sequence_safe IS 'Safely resets distribution log sequence to prevent duplicate key errors';
