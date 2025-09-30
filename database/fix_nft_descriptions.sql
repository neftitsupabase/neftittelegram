-- Fix NFT descriptions to remove generic "Unique X NFT from NEFTIT platform" text
-- Update database functions to return empty descriptions

-- Update distribute_unique_nft function to remove generic description
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
    
    -- Return complete NFT data with empty description
    IF (distribution_result->>'success')::BOOLEAN THEN
        RETURN json_build_object(
            'success', true,
            'nft_data', json_build_object(
                'id', nft_id,
                'name', 'NEFTIT ' || INITCAP(target_rarity) || ' NFT',
                'description', '', -- ✅ Empty description instead of generic text
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
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO service_role;

COMMENT ON FUNCTION distribute_unique_nft IS 'Distributes unique NFT with empty description to avoid generic text';
