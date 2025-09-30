-- Drop existing function first
DROP FUNCTION IF EXISTS public.execute_manual_nft_distribution(UUID, JSONB);

-- Create RPC function for manual NFT distribution
-- This function handles the database side of manual NFT distribution

CREATE OR REPLACE FUNCTION public.execute_manual_nft_distribution(
    p_project_id UUID,
    p_user_rarity_assignments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_project_record RECORD;
    v_assignment JSONB;
    v_result JSONB;
    v_distributions JSONB[] := '{}';
    v_distribution_count INTEGER := 0;
BEGIN
    -- Validate project exists
    SELECT * INTO v_project_record
    FROM projects 
    WHERE id = p_project_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Project not found',
            'project_id', p_project_id
        );
    END IF;
    
    -- Process each user assignment
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_user_rarity_assignments)
    LOOP
        -- Create distribution record
        INSERT INTO nft_distributions (
            id,
            project_id,
            wallet_address,
            rarity,
            nft_id,
            image,
            distributed_at,
            distribution_type
        ) VALUES (
            gen_random_uuid(),
            p_project_id,
            v_assignment->>'wallet_address',
            v_assignment->>'rarity',
            'nft_' || gen_random_uuid()::text,
            '/images/' || (v_assignment->>'rarity') || '2.jpg',
            NOW(),
            'manual'
        );
        
        -- Add to distributions array
        v_distributions := v_distributions || jsonb_build_object(
            'wallet_address', v_assignment->>'wallet_address',
            'rarity', v_assignment->>'rarity',
            'nft_id', 'nft_' || gen_random_uuid()::text,
            'image', '/images/' || (v_assignment->>'rarity') || '2.jpg'
        );
        
        v_distribution_count := v_distribution_count + 1;
    END LOOP;
    
    -- Return success result
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Manual NFT distribution completed successfully',
        'distributed_nfts', v_distribution_count,
        'distributions', v_distributions,
        'project_info', jsonb_build_object(
            'title', v_project_record.title,
            'collection_name', v_project_record.collection_name
        ),
        'distribution_stats', jsonb_build_object(
            'total', v_distribution_count,
            'common', (SELECT COUNT(*) FROM jsonb_array_elements(v_distributions) WHERE value->>'rarity' = 'common'),
            'rare', (SELECT COUNT(*) FROM jsonb_array_elements(v_distributions) WHERE value->>'rarity' = 'rare'),
            'legendary', (SELECT COUNT(*) FROM jsonb_array_elements(v_distributions) WHERE value->>'rarity' = 'legendary')
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Error during distribution: ' || SQLERRM,
        'error_code', SQLSTATE
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.execute_manual_nft_distribution(UUID, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.execute_manual_nft_distribution(UUID, JSONB) TO authenticated;

-- Create nft_distributions table if it doesn't exist
CREATE TABLE IF NOT EXISTS nft_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    wallet_address TEXT NOT NULL,
    rarity TEXT NOT NULL,
    nft_id TEXT NOT NULL,
    image TEXT NOT NULL,
    distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    distribution_type TEXT DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_nft_distributions_wallet_address ON nft_distributions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_nft_distributions_project_id ON nft_distributions(project_id);
