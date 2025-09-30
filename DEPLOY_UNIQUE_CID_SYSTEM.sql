-- DEPLOY THIS IN SUPABASE SQL EDITOR
-- Unique CID Distribution System for NEFTIT Platform
-- Manages pools of unique CIDs for each rarity tier

-- Create enum for rarity types with all rarities
DO $$ BEGIN
    CREATE TYPE nft_rarity AS ENUM ('common', 'rare', 'legendary', 'platinum', 'silver', 'gold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table to store all available NFT CIDs by rarity
CREATE TABLE IF NOT EXISTS nft_cid_pools (
    id SERIAL PRIMARY KEY,
    rarity nft_rarity NOT NULL,
    cid VARCHAR(100) NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    metadata_cid VARCHAR(100),
    is_distributed BOOLEAN DEFAULT FALSE,
    distributed_to_wallet VARCHAR(100),
    distributed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nft_cid_pools_rarity ON nft_cid_pools (rarity);
CREATE INDEX IF NOT EXISTS idx_nft_cid_pools_available ON nft_cid_pools (rarity, is_distributed);
CREATE INDEX IF NOT EXISTS idx_nft_cid_pools_wallet ON nft_cid_pools (distributed_to_wallet);

-- Table to track CID distribution history
CREATE TABLE IF NOT EXISTS nft_cid_distribution_log (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(100) NOT NULL,
    rarity VARCHAR(20) NOT NULL,
    cid VARCHAR(100) NOT NULL UNIQUE,
    nft_id VARCHAR(50) NOT NULL,
    distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    distribution_method VARCHAR(50) DEFAULT 'campaign_reward'
);

-- Create indexes for distribution log
CREATE INDEX IF NOT EXISTS idx_distribution_log_wallet ON nft_cid_distribution_log (wallet_address);
CREATE INDEX IF NOT EXISTS idx_distribution_log_rarity ON nft_cid_distribution_log (rarity);
CREATE INDEX IF NOT EXISTS idx_distribution_log_cid ON nft_cid_distribution_log (cid);

-- Function to get next available CID for a rarity
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
    -- Get the next available CID for the specified rarity
    RETURN QUERY
    SELECT 
        p.cid,
        p.image_url,
        p.metadata_cid,
        p.id as pool_id
    FROM nft_cid_pools p
    WHERE p.rarity = target_rarity::nft_rarity 
    AND p.is_distributed = FALSE
    ORDER BY p.id ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to mark CID as distributed
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
    
    -- Log the distribution
    INSERT INTO nft_cid_distribution_log (
        wallet_address,
        rarity,
        cid,
        nft_id,
        distributed_at,
        distribution_method
    ) VALUES (
        wallet_address,
        target_rarity,
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

-- Function to get available CID counts for verification
CREATE OR REPLACE FUNCTION get_available_cid_counts()
RETURNS TABLE(
    rarity nft_rarity,
    total_count bigint,
    available_count bigint,
    distributed_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.rarity,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE p.is_distributed = false) as available_count,
        COUNT(*) FILTER (WHERE p.is_distributed = true) as distributed_count
    FROM nft_cid_pools p
    GROUP BY p.rarity
    ORDER BY p.rarity;
END;
$$ LANGUAGE plpgsql;

-- Function to distribute unique NFT to user
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
    
    -- Return complete NFT data
    IF (distribution_result->>'success')::BOOLEAN THEN
        RETURN json_build_object(
            'success', true,
            'nft_data', json_build_object(
                'id', nft_id,
                'name', 'NEFTIT ' || INITCAP(target_rarity) || ' NFT',
                'description', 'Unique ' || target_rarity || ' NFT from NEFTIT platform',
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

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON nft_cid_pools TO authenticated;
GRANT SELECT, INSERT ON nft_cid_distribution_log TO authenticated;
GRANT USAGE ON SEQUENCE nft_cid_pools_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE nft_cid_distribution_log_id_seq TO authenticated;

-- Grant permissions for RPC functions
GRANT EXECUTE ON FUNCTION get_next_available_cid(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_cid_as_distributed(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_cid_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_unique_nft(VARCHAR, VARCHAR) TO authenticated;
