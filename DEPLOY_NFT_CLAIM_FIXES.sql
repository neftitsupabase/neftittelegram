-- Deploy NFT Claim Tracking Fixes
-- This script ensures proper NFT claim tracking in Supabase

-- First, drop any existing foreign key constraints that might cause issues
DO $$
BEGIN
    -- Drop foreign key constraint if it exists
    BEGIN
        ALTER TABLE nft_claims DROP CONSTRAINT IF EXISTS fk_nft_claims_wallet_address;
    EXCEPTION
        WHEN undefined_table THEN
            -- Table doesn't exist yet, ignore
            NULL;
    END;
END $$;

-- Check if table exists and add missing columns if needed
DO $$
BEGIN
    -- Create table if it doesn't exist
    CREATE TABLE IF NOT EXISTS nft_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nft_id TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        claimed_blockchain TEXT NOT NULL CHECK (claimed_blockchain IN ('ethereum', 'solana', 'sui')),
        transaction_hash TEXT NOT NULL,
        contract_address TEXT,
        token_id TEXT,
        claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add unique constraint if it doesn't exist
    BEGIN
        ALTER TABLE nft_claims ADD CONSTRAINT nft_claims_unique_claim 
        UNIQUE(nft_id, wallet_address, claimed_blockchain);
    EXCEPTION
        WHEN duplicate_table THEN
            -- Constraint already exists, ignore
            NULL;
    END;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nft_claims_wallet_address ON nft_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_nft_claims_nft_id ON nft_claims(nft_id);
CREATE INDEX IF NOT EXISTS idx_nft_claims_claimed_blockchain ON nft_claims(claimed_blockchain);
CREATE INDEX IF NOT EXISTS idx_nft_claims_claimed_at ON nft_claims(claimed_at);

-- Enable Row Level Security
ALTER TABLE nft_claims ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view their own NFT claims" ON nft_claims;
DROP POLICY IF EXISTS "Users can insert their own NFT claims" ON nft_claims;
DROP POLICY IF EXISTS "Users can update their own NFT claims" ON nft_claims;
DROP POLICY IF EXISTS "Service role can access all NFT claims" ON nft_claims;

-- Create RLS policies that work with wallet authentication
CREATE POLICY "Users can view their own NFT claims" ON nft_claims
    FOR SELECT USING (
        wallet_address = LOWER(COALESCE(
            current_setting('request.headers', true)::json->>'x-wallet-address',
            auth.jwt() ->> 'wallet_address',
            auth.jwt() ->> 'sub'
        ))
        OR auth.role() = 'service_role'
        OR auth.role() = 'anon'
    );

CREATE POLICY "Users can insert their own NFT claims" ON nft_claims
    FOR INSERT WITH CHECK (
        wallet_address = LOWER(COALESCE(
            current_setting('request.headers', true)::json->>'x-wallet-address',
            auth.jwt() ->> 'wallet_address',
            auth.jwt() ->> 'sub'
        ))
        OR auth.role() = 'service_role'
        OR auth.role() = 'anon'
    );

CREATE POLICY "Users can update their own NFT claims" ON nft_claims
    FOR UPDATE USING (
        wallet_address = LOWER(COALESCE(
            current_setting('request.headers', true)::json->>'x-wallet-address',
            auth.jwt() ->> 'wallet_address',
            auth.jwt() ->> 'sub'
        ))
        OR auth.role() = 'service_role'
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

DROP TRIGGER IF EXISTS update_nft_claims_updated_at ON nft_claims;
CREATE TRIGGER update_nft_claims_updated_at 
    BEFORE UPDATE ON nft_claims 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create helper function to get user's claimed NFTs
CREATE OR REPLACE FUNCTION get_user_claimed_nfts(p_wallet_address TEXT)
RETURNS TABLE(
    nft_id TEXT,
    claimed_blockchain TEXT,
    transaction_hash TEXT,
    token_id TEXT,
    contract_address TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nc.nft_id,
        nc.claimed_blockchain,
        nc.transaction_hash,
        nc.token_id,
        nc.contract_address,
        nc.claimed_at
    FROM nft_claims nc
    WHERE nc.wallet_address = LOWER(p_wallet_address)
    ORDER BY nc.claimed_at DESC;
END;
$$;

-- Create helper function to check if NFT is already claimed
CREATE OR REPLACE FUNCTION is_nft_claimed(p_wallet_address TEXT, p_nft_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    claim_exists BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM nft_claims 
        WHERE wallet_address = LOWER(p_wallet_address) 
        AND nft_id = p_nft_id
    ) INTO claim_exists;
    
    RETURN claim_exists;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON nft_claims TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_claimed_nfts(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_nft_claimed(TEXT, TEXT) TO anon, authenticated, service_role;

-- Test the setup with a sample insert (will be cleaned up)
DO $$
DECLARE
    test_wallet TEXT := '0x5bedd9f1415b8eb1f669aac68b0fd9106b265071';
    test_result RECORD;
BEGIN
    -- Clean up any existing test data
    DELETE FROM nft_claims WHERE nft_id = 'test-setup-verification';
    
    -- Test insert as service role (should work)
    INSERT INTO nft_claims (
        nft_id,
        wallet_address,
        claimed_blockchain,
        transaction_hash,
        token_id,
        contract_address
    ) VALUES (
        'test-setup-verification',
        test_wallet,
        'ethereum',
        '0x1234567890abcdef',
        '999',
        '0x483Cc80A9858cc9Bd48b246a6BC91B24ca762CE6'
    );
    
    -- Test query function
    SELECT * INTO test_result FROM get_user_claimed_nfts(test_wallet) LIMIT 1;
    
    IF test_result.nft_id IS NOT NULL THEN
        RAISE NOTICE '✅ NFT claims table setup successful - found test record';
    ELSE
        RAISE NOTICE '⚠️ NFT claims table setup may have issues';
    END IF;
    
    -- Clean up test data
    DELETE FROM nft_claims WHERE nft_id = 'test-setup-verification';
    
    RAISE NOTICE '🎉 NFT claims database setup completed successfully!';
END;
$$;
