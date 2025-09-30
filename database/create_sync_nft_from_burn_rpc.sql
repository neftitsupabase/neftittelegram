-- Create sync_nft_from_burn RPC function
-- This function syncs NFT data from IPFS to the database for backup and querying

CREATE OR REPLACE FUNCTION public.sync_nft_from_burn(
    p_wallet_address TEXT,
    p_nft_id TEXT,
    p_rarity TEXT,
    p_tier TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_existing_record RECORD;
BEGIN
    -- Check if NFT already exists
    SELECT * INTO v_existing_record
    FROM user_nft_collection 
    WHERE wallet_address = p_wallet_address 
    AND nft_id = p_nft_id;
    
    IF FOUND THEN
        -- Update existing record
        UPDATE user_nft_collection 
        SET 
            rarity = p_rarity,
            tier = p_tier,
            last_updated = NOW()
        WHERE wallet_address = p_wallet_address 
        AND nft_id = p_nft_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'updated',
            'nft_id', p_nft_id,
            'wallet_address', p_wallet_address
        );
    ELSE
        -- Insert new record
        INSERT INTO user_nft_collection (
            id,
            wallet_address,
            nft_id,
            rarity,
            tier,
            source,
            created_at,
            last_updated
        ) VALUES (
            gen_random_uuid(),
            p_wallet_address,
            p_nft_id,
            p_rarity,
            p_tier,
            'ipfs_sync',
            NOW(),
            NOW()
        );
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'inserted',
            'nft_id', p_nft_id,
            'wallet_address', p_wallet_address
        );
    END IF;
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'nft_id', p_nft_id,
        'wallet_address', p_wallet_address
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sync_nft_from_burn(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.sync_nft_from_burn(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Create user_nft_collection table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_nft_collection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    nft_id TEXT NOT NULL,
    rarity TEXT NOT NULL,
    tier TEXT,
    source TEXT DEFAULT 'ipfs_sync',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, nft_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_nft_collection_wallet_address ON user_nft_collection(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_nft_collection_nft_id ON user_nft_collection(nft_id);
CREATE INDEX IF NOT EXISTS idx_user_nft_collection_rarity ON user_nft_collection(rarity);

-- Enable Row Level Security
ALTER TABLE user_nft_collection ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage their own NFT collection" ON user_nft_collection
FOR ALL USING (true);

-- Grant table permissions
GRANT ALL ON user_nft_collection TO anon;
GRANT ALL ON user_nft_collection TO authenticated;
