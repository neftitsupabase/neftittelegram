-- NFT Blockchain Claims Tracking Schema
-- Prevents users from claiming the same NFT multiple times across different blockchains

-- Table to track which NFTs have been claimed to which blockchains
CREATE TABLE IF NOT EXISTS nft_blockchain_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    nft_id TEXT NOT NULL, -- Original IPFS NFT ID
    blockchain_type TEXT NOT NULL, -- 'ethereum', 'solana', 'sui'
    blockchain_address TEXT, -- Contract/program address where NFT was minted
    transaction_hash TEXT, -- Blockchain transaction hash
    token_id TEXT, -- Blockchain-specific token ID
    wallet_address TEXT NOT NULL, -- User's wallet address on that chain
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, nft_id), -- One claim per user per NFT (across all blockchains)
    CHECK (blockchain_type IN ('ethereum', 'solana', 'sui')),
    CHECK (LENGTH(nft_id) > 0),
    CHECK (LENGTH(user_id) > 0),
    CHECK (LENGTH(wallet_address) > 0)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_nft_claims_user_nft ON nft_blockchain_claims(user_id, nft_id);
CREATE INDEX IF NOT EXISTS idx_nft_claims_blockchain ON nft_blockchain_claims(blockchain_type);
CREATE INDEX IF NOT EXISTS idx_nft_claims_user ON nft_blockchain_claims(user_id);

-- RLS Policies
ALTER TABLE nft_blockchain_claims ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own claims
CREATE POLICY "Users can view own claims" ON nft_blockchain_claims
    FOR SELECT USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.headers', true)::json->>'x-wallet-address'
        )
    );

-- Policy: Users can only insert their own claims
CREATE POLICY "Users can insert own claims" ON nft_blockchain_claims
    FOR INSERT WITH CHECK (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.headers', true)::json->>'x-wallet-address'
        )
    );

-- Function to check if NFT has already been claimed by user
CREATE OR REPLACE FUNCTION check_nft_claim_status(p_user_id TEXT, p_nft_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    claim_record RECORD;
    result JSON;
BEGIN
    -- Check if NFT has been claimed
    SELECT * INTO claim_record
    FROM nft_blockchain_claims
    WHERE user_id = p_user_id AND nft_id = p_nft_id;
    
    IF claim_record IS NULL THEN
        -- NFT not claimed yet
        result := json_build_object(
            'is_claimed', false,
            'can_claim', true,
            'claimed_blockchain', null,
            'claimed_at', null,
            'transaction_hash', null
        );
    ELSE
        -- NFT already claimed
        result := json_build_object(
            'is_claimed', true,
            'can_claim', false,
            'claimed_blockchain', claim_record.blockchain_type,
            'claimed_at', claim_record.claimed_at,
            'transaction_hash', claim_record.transaction_hash,
            'wallet_address', claim_record.wallet_address
        );
    END IF;
    
    RETURN result;
END;
$$;

-- Function to record NFT claim
CREATE OR REPLACE FUNCTION record_nft_claim(
    p_user_id TEXT,
    p_nft_id TEXT,
    p_blockchain_type TEXT,
    p_blockchain_address TEXT,
    p_transaction_hash TEXT,
    p_token_id TEXT,
    p_wallet_address TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_claim RECORD;
    new_claim_id UUID;
BEGIN
    -- Check if already claimed
    SELECT * INTO existing_claim
    FROM nft_blockchain_claims
    WHERE user_id = p_user_id AND nft_id = p_nft_id;
    
    IF existing_claim IS NOT NULL THEN
        -- Already claimed, return error
        RETURN json_build_object(
            'success', false,
            'error', 'NFT already claimed',
            'claimed_blockchain', existing_claim.blockchain_type,
            'claimed_at', existing_claim.claimed_at
        );
    END IF;
    
    -- Record the claim
    INSERT INTO nft_blockchain_claims (
        user_id,
        nft_id,
        blockchain_type,
        blockchain_address,
        transaction_hash,
        token_id,
        wallet_address
    ) VALUES (
        p_user_id,
        p_nft_id,
        p_blockchain_type,
        p_blockchain_address,
        p_transaction_hash,
        p_token_id,
        p_wallet_address
    ) RETURNING id INTO new_claim_id;
    
    RETURN json_build_object(
        'success', true,
        'claim_id', new_claim_id,
        'blockchain_type', p_blockchain_type,
        'transaction_hash', p_transaction_hash
    );
END;
$$;

-- Function to get user's blockchain claims summary
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
    FROM nft_blockchain_claims
    WHERE user_id = p_user_id
    ORDER BY claimed_at DESC;
    
    RETURN COALESCE(claims_data, '[]'::json);
END;
$$;
