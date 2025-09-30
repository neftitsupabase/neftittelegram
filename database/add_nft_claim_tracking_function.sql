-- Create NFT claim tracking function and table
-- This fixes the missing check_nft_claim_status function error

-- Create nft_claims table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.nft_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nft_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    wallet_address TEXT NOT NULL,
    claimed_blockchain TEXT NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_hash TEXT,
    contract_address TEXT,
    token_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one claim per NFT per user
    UNIQUE(nft_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nft_claims_nft_id ON public.nft_claims(nft_id);
CREATE INDEX IF NOT EXISTS idx_nft_claims_user_id ON public.nft_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_nft_claims_wallet_address ON public.nft_claims(wallet_address);

-- Enable RLS
ALTER TABLE public.nft_claims ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own NFT claims" ON public.nft_claims
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own NFT claims" ON public.nft_claims
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own NFT claims" ON public.nft_claims
    FOR UPDATE USING (auth.uid() = user_id);

-- Create the missing check_nft_claim_status function
CREATE OR REPLACE FUNCTION public.check_nft_claim_status(
    p_nft_id TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_claim_record RECORD;
    v_result JSON;
BEGIN
    -- Use provided user_id or get from auth context
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Check if NFT has been claimed by this user
    SELECT * INTO v_claim_record
    FROM public.nft_claims
    WHERE nft_id = p_nft_id AND user_id = v_user_id;
    
    IF FOUND THEN
        -- NFT already claimed
        v_result := json_build_object(
            'can_claim', false,
            'already_claimed', true,
            'claimed_blockchain', v_claim_record.claimed_blockchain,
            'claimed_at', v_claim_record.claimed_at,
            'transaction_hash', v_claim_record.transaction_hash,
            'contract_address', v_claim_record.contract_address,
            'token_id', v_claim_record.token_id
        );
    ELSE
        -- NFT can be claimed
        v_result := json_build_object(
            'can_claim', true,
            'already_claimed', false,
            'claimed_blockchain', null,
            'claimed_at', null,
            'transaction_hash', null,
            'contract_address', null,
            'token_id', null
        );
    END IF;
    
    RETURN v_result;
END;
$$;

-- Create function to record NFT claim
CREATE OR REPLACE FUNCTION public.record_nft_claim(
    p_nft_id TEXT,
    p_wallet_address TEXT,
    p_blockchain TEXT,
    p_transaction_hash TEXT DEFAULT NULL,
    p_contract_address TEXT DEFAULT NULL,
    p_token_id TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_claim_id UUID;
    v_result JSON;
BEGIN
    -- Use provided user_id or get from auth context
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Insert claim record
    INSERT INTO public.nft_claims (
        nft_id,
        user_id,
        wallet_address,
        claimed_blockchain,
        transaction_hash,
        contract_address,
        token_id
    ) VALUES (
        p_nft_id,
        v_user_id,
        p_wallet_address,
        p_blockchain,
        p_transaction_hash,
        p_contract_address,
        p_token_id
    )
    ON CONFLICT (nft_id, user_id) DO UPDATE SET
        claimed_blockchain = EXCLUDED.claimed_blockchain,
        transaction_hash = EXCLUDED.transaction_hash,
        contract_address = EXCLUDED.contract_address,
        token_id = EXCLUDED.token_id,
        updated_at = NOW()
    RETURNING id INTO v_claim_id;
    
    v_result := json_build_object(
        'success', true,
        'claim_id', v_claim_id,
        'message', 'NFT claim recorded successfully'
    );
    
    RETURN v_result;
END;
$$;

-- Create function to get user's NFT claims
CREATE OR REPLACE FUNCTION public.get_user_nft_claims(
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    nft_id TEXT,
    claimed_blockchain TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE,
    transaction_hash TEXT,
    contract_address TEXT,
    token_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Use provided user_id or get from auth context
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    RETURN QUERY
    SELECT 
        nc.nft_id,
        nc.claimed_blockchain,
        nc.claimed_at,
        nc.transaction_hash,
        nc.contract_address,
        nc.token_id
    FROM public.nft_claims nc
    WHERE nc.user_id = v_user_id
    ORDER BY nc.claimed_at DESC;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nft_claims TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_nft_claim_status(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_nft_claim(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_nft_claims(UUID) TO authenticated;

-- Allow anon access for public functions (if needed)
GRANT EXECUTE ON FUNCTION public.check_nft_claim_status(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.record_nft_claim(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon;
