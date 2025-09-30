-- Create NFT Claims Tracking Table
-- This table tracks which NFTs have been claimed to which blockchains

CREATE TABLE IF NOT EXISTS nft_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nft_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    blockchain_type TEXT NOT NULL CHECK (blockchain_type IN ('ethereum', 'solana', 'sui')),
    transaction_hash TEXT NOT NULL,
    contract_address TEXT,
    token_id TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one NFT can only be claimed once per blockchain per wallet
    UNIQUE(nft_id, wallet_address, blockchain_type)
);

-- If table already exists with different column name, add the missing column
DO $$ 
BEGIN
    -- Check if blockchain_type column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'nft_claims' AND column_name = 'blockchain_type'
    ) THEN
        -- Check if it exists with a different name and rename it
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'nft_claims' AND column_name IN ('blockchain', 'chain_type', 'chain')
        ) THEN
            -- Rename existing column
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nft_claims' AND column_name = 'blockchain') THEN
                ALTER TABLE nft_claims RENAME COLUMN blockchain TO blockchain_type;
            ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nft_claims' AND column_name = 'chain_type') THEN
                ALTER TABLE nft_claims RENAME COLUMN chain_type TO blockchain_type;
            ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nft_claims' AND column_name = 'chain') THEN
                ALTER TABLE nft_claims RENAME COLUMN chain TO blockchain_type;
            END IF;
        ELSE
            -- Add the missing column
            ALTER TABLE nft_claims ADD COLUMN blockchain_type TEXT NOT NULL DEFAULT 'ethereum' CHECK (blockchain_type IN ('ethereum', 'solana', 'sui'));
        END IF;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nft_claims_wallet_address ON nft_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_nft_claims_nft_id ON nft_claims(nft_id);
CREATE INDEX IF NOT EXISTS idx_nft_claims_blockchain_type ON nft_claims(blockchain_type);
CREATE INDEX IF NOT EXISTS idx_nft_claims_claimed_at ON nft_claims(claimed_at);

-- Enable Row Level Security
ALTER TABLE nft_claims ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view their own NFT claims" ON nft_claims;
DROP POLICY IF EXISTS "Users can insert their own NFT claims" ON nft_claims;
DROP POLICY IF EXISTS "Users can update their own NFT claims" ON nft_claims;

-- Create RLS policies
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

CREATE POLICY "Users can update their own NFT claims" ON nft_claims
    FOR UPDATE USING (
        wallet_address = current_setting('request.headers')::json->>'x-wallet-address'
        OR wallet_address = (auth.jwt() ->> 'wallet_address')
        OR wallet_address = (auth.jwt() ->> 'sub')
    );

CREATE POLICY "Service role can access all NFT claims" ON nft_claims
    FOR ALL USING (auth.role() = 'service_role');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_nft_claims_updated_at 
    BEFORE UPDATE ON nft_claims 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create helper function to check claim status
CREATE OR REPLACE FUNCTION check_nft_claim_status(p_wallet_address TEXT, p_nft_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    claim_record nft_claims%ROWTYPE;
    result JSON;
BEGIN
    -- Find existing claim
    SELECT * INTO claim_record
    FROM nft_claims
    WHERE wallet_address = p_wallet_address 
    AND nft_id = p_nft_id
    LIMIT 1;
    
    IF claim_record.id IS NOT NULL THEN
        -- NFT is already claimed
        result := json_build_object(
            'is_claimed', true,
            'can_claim', false,
            'claimed_blockchain', claim_record.blockchain_type,
            'claimed_at', claim_record.claimed_at,
            'transaction_hash', claim_record.transaction_hash,
            'wallet_address', claim_record.wallet_address
        );
    ELSE
        -- NFT is not claimed yet
        result := json_build_object(
            'is_claimed', false,
            'can_claim', true,
            'claimed_blockchain', null,
            'claimed_at', null,
            'transaction_hash', null,
            'wallet_address', p_wallet_address
        );
    END IF;
    
    RETURN result;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON nft_claims TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_nft_claim_status(TEXT, TEXT) TO anon, authenticated, service_role;
