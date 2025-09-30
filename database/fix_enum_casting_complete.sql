-- Complete fix for PostgreSQL enum type casting errors in NFT distribution system
-- This script ensures proper enum handling and type casting

-- Create enum type with exception handling (if not exists)
DO $$ 
BEGIN
    CREATE TYPE nft_rarity AS ENUM ('common', 'rare', 'legendary', 'platinum', 'silver', 'gold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to get next available CID for a rarity (with proper enum casting)
CREATE OR REPLACE FUNCTION get_next_available_cid(
    target_rarity VARCHAR(20)
) RETURNS TABLE(
    cid VARCHAR(100),
    image_url TEXT,
    metadata_cid VARCHAR(100),
    pool_id INTEGER
) 
SECURITY DEFINER
AS $$
BEGIN
    -- Get the next available CID for the specified rarity with proper enum casting
    RETURN QUERY
    SELECT 
        p.cid,
        p.image_url,
        p.metadata_cid,
        p.id as pool_id
    FROM nft_cid_pools p
    WHERE p.rarity = target_rarity::nft_rarity 
    AND p.is_distributed = FALSE
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to mark CID as distributed (with proper enum casting)
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
    
    -- Log the distribution with proper enum casting
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
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Function to distribute unique NFT to user (with proper enum casting)
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
BEGIN
    -- Validate rarity input by attempting to cast to enum
    BEGIN
        PERFORM target_rarity::nft_rarity;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid rarity type: ' || target_rarity || '. Valid types: common, rare, legendary, platinum, silver, gold'
        );
    END;

    -- Generate unique NFT ID
    nft_id := 'nft_' || target_rarity || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || (RANDOM() * 1000)::INTEGER;
    
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
    
    -- Mark CID as distributed
    SELECT mark_cid_as_distributed(
        available_cid.cid,
        wallet_address,
        nft_id,
        target_rarity
    ) INTO distribution_result;
    
    -- Return complete NFT data
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
        RETURN distribution_result;
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Distribution failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_next_available_cid(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_available_cid(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_next_available_cid(VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION mark_cid_as_distributed(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO service_role;

COMMENT ON FUNCTION distribute_unique_nft IS 'Distributes unique NFT with proper enum casting and validation';
