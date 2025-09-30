-- Fix NFT Claim Tracking Function
-- This creates the record_nft_claim function with the exact parameter names expected by NFTClaimTrackingService

-- First, ensure the nft_claims table exists with the correct structure
CREATE TABLE IF NOT EXISTS nft_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nft_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    blockchain_type TEXT NOT NULL CHECK (blockchain_type IN ('ethereum', 'solana', 'sui')),
    transaction_hash TEXT NOT NULL,
    blockchain_address TEXT,
    token_id TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one NFT can only be claimed once per blockchain per wallet
    UNIQUE(nft_id, wallet_address, blockchain_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nft_claims_wallet_address ON nft_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_nft_claims_nft_id ON nft_claims(nft_id);
CREATE INDEX IF NOT EXISTS idx_nft_claims_blockchain_type ON nft_claims(blockchain_type);

-- Enable Row Level Security
ALTER TABLE nft_claims ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own NFT claims" ON nft_claims;
DROP POLICY IF EXISTS "Users can insert their own NFT claims" ON nft_claims;
DROP POLICY IF EXISTS "Users can update their own NFT claims" ON nft_claims;
DROP POLICY IF EXISTS "Service role can access all NFT claims" ON nft_claims;

-- Create RLS policies that work with wallet headers
CREATE POLICY "Users can view their own NFT claims" ON nft_claims
    FOR SELECT USING (
        wallet_address = current_setting('request.headers')::json->>'x-wallet-address'
        OR wallet_address = (auth.jwt() ->> 'wallet_address')
        OR wallet_address = (auth.jwt() ->> 'sub')
    );

CREATE POLICY "Users can insert their own NFT claims" ON nft_claims
    FOR INSERT WITH CHECK (
        wallet_address = current_setting('request.headers')::json->>'x-wallet-address'
        OR wallet_address = (auth.jwt() ->> 'wallet_address')
        OR wallet_address = (auth.jwt() ->> 'sub')
    );

CREATE POLICY "Service role can access all NFT claims" ON nft_claims
    FOR ALL USING (auth.role() = 'service_role');

-- Create the record_nft_claim function with exact parameter names expected by NFTClaimTrackingService
CREATE OR REPLACE FUNCTION record_nft_claim(
    p_blockchain_address TEXT,
    p_blockchain_type TEXT,
    p_nft_id TEXT,
    p_token_id TEXT,
    p_transaction_hash TEXT,
    p_user_id TEXT,
    p_wallet_address TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_claim RECORD;
    new_claim_id UUID;
    result JSON;
BEGIN
    -- Check if already claimed by this wallet for this NFT
    SELECT * INTO existing_claim
    FROM nft_claims
    WHERE wallet_address = p_wallet_address 
    AND nft_id = p_nft_id 
    AND blockchain_type = p_blockchain_type;
    
    IF existing_claim IS NOT NULL THEN
        -- Already claimed, return existing claim info
        result := json_build_object(
            'success', false,
            'error', 'NFT already claimed to this blockchain',
            'claim_id', existing_claim.id,
            'blockchain_type', existing_claim.blockchain_type,
            'transaction_hash', existing_claim.transaction_hash,
            'claimed_blockchain', existing_claim.blockchain_type,
            'claimed_at', existing_claim.claimed_at
        );
        RETURN result;
    END IF;
    
    -- Record the new claim
    INSERT INTO nft_claims (
        nft_id,
        wallet_address,
        blockchain_type,
        transaction_hash,
        blockchain_address,
        token_id
    ) VALUES (
        p_nft_id,
        p_wallet_address,
        p_blockchain_type,
        p_transaction_hash,
        p_blockchain_address,
        p_token_id
    ) RETURNING id INTO new_claim_id;
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'claim_id', new_claim_id,
        'blockchain_type', p_blockchain_type,
        'transaction_hash', p_transaction_hash,
        'claimed_blockchain', p_blockchain_type,
        'claimed_at', NOW()
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'claim_id', null,
            'blockchain_type', p_blockchain_type,
            'transaction_hash', p_transaction_hash
        );
        RETURN result;
END;
$$;

-- Create function to get user's blockchain claims (expected by NFTClaimTrackingService)
CREATE OR REPLACE FUNCTION get_user_blockchain_claims(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    claims_data JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'nft_id', nft_id,
            'blockchain_type', blockchain_type,
            'transaction_hash', transaction_hash,
            'token_id', token_id,
            'wallet_address', wallet_address,
            'claimed_at', claimed_at
        )
    ) INTO claims_data
    FROM nft_claims
    WHERE wallet_address = p_user_id
    ORDER BY claimed_at DESC;
    
    RETURN COALESCE(claims_data, '[]'::json);
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON nft_claims TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_nft_claim(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_blockchain_claims(TEXT) TO anon, authenticated, service_role;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_nft_claims_updated_at ON nft_claims;
CREATE TRIGGER update_nft_claims_updated_at 
    BEFORE UPDATE ON nft_claims 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
