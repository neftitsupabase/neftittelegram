-- On-Chain Integration Database Schema
-- Tables for logging on-chain transactions and processing contract events

-- Table for logging on-chain staking transactions
CREATE TABLE IF NOT EXISTS onchain_transactions (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL CHECK (action IN ('stake', 'unstake')),
    token_id TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    gas_used TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    network TEXT NOT NULL DEFAULT 'polygon-amoy',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for logging on-chain burn transactions
CREATE TABLE IF NOT EXISTS onchain_burn_transactions (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    token_ids TEXT[] NOT NULL,
    result_rarity TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    gas_used TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    network TEXT NOT NULL DEFAULT 'polygon-amoy',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for logging on-chain NFT claim transactions
CREATE TABLE IF NOT EXISTS onchain_claim_transactions (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    token_ids TEXT[] NOT NULL,
    quantity INTEGER NOT NULL,
    contract_address TEXT NOT NULL,
    gas_used TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    network TEXT NOT NULL DEFAULT 'polygon-amoy',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for storing contract events
CREATE TABLE IF NOT EXISTS contract_events (
    id BIGSERIAL PRIMARY KEY,
    contract_address TEXT NOT NULL,
    event_name TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_args JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    network TEXT NOT NULL DEFAULT 'polygon-amoy',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(transaction_hash, event_name)
);

-- Table for tracking event processing state
CREATE TABLE IF NOT EXISTS event_processing_state (
    id BIGSERIAL PRIMARY KEY,
    contract_type TEXT NOT NULL CHECK (contract_type IN ('nft_drop', 'staking', 'burn')),
    event_name TEXT NOT NULL,
    last_processed_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_type, event_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_onchain_transactions_wallet ON onchain_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_onchain_transactions_hash ON onchain_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_onchain_transactions_timestamp ON onchain_transactions(timestamp);

CREATE INDEX IF NOT EXISTS idx_onchain_burn_transactions_wallet ON onchain_burn_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_onchain_burn_transactions_hash ON onchain_burn_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_onchain_burn_transactions_timestamp ON onchain_burn_transactions(timestamp);

CREATE INDEX IF NOT EXISTS idx_onchain_claim_transactions_wallet ON onchain_claim_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_onchain_claim_transactions_hash ON onchain_claim_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_onchain_claim_transactions_timestamp ON onchain_claim_transactions(timestamp);

CREATE INDEX IF NOT EXISTS idx_contract_events_contract ON contract_events(contract_address);
CREATE INDEX IF NOT EXISTS idx_contract_events_hash ON contract_events(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_contract_events_block ON contract_events(block_number);
CREATE INDEX IF NOT EXISTS idx_contract_events_processed ON contract_events(processed);

CREATE INDEX IF NOT EXISTS idx_event_processing_state_type ON event_processing_state(contract_type, event_name);

-- RLS Policies for security
ALTER TABLE onchain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onchain_burn_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onchain_claim_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_processing_state ENABLE ROW LEVEL SECURITY;

-- Policy for onchain_transactions
CREATE POLICY "Users can view their own onchain transactions" ON onchain_transactions
    FOR SELECT USING (
        wallet_address = LOWER(current_setting('request.headers', true)::json->>'x-wallet-address')
    );

CREATE POLICY "Users can insert their own onchain transactions" ON onchain_transactions
    FOR INSERT WITH CHECK (
        wallet_address = LOWER(current_setting('request.headers', true)::json->>'x-wallet-address')
    );

-- Policy for onchain_burn_transactions
CREATE POLICY "Users can view their own burn transactions" ON onchain_burn_transactions
    FOR SELECT USING (
        wallet_address = LOWER(current_setting('request.headers', true)::json->>'x-wallet-address')
    );

CREATE POLICY "Users can insert their own burn transactions" ON onchain_burn_transactions
    FOR INSERT WITH CHECK (
        wallet_address = LOWER(current_setting('request.headers', true)::json->>'x-wallet-address')
    );

-- Policy for onchain_claim_transactions
CREATE POLICY "Users can view their own claim transactions" ON onchain_claim_transactions
    FOR SELECT USING (
        wallet_address = LOWER(current_setting('request.headers', true)::json->>'x-wallet-address')
    );

CREATE POLICY "Users can insert their own claim transactions" ON onchain_claim_transactions
    FOR INSERT WITH CHECK (
        wallet_address = LOWER(current_setting('request.headers', true)::json->>'x-wallet-address')
    );

-- Policy for contract_events (read-only for authenticated users)
CREATE POLICY "Authenticated users can view contract events" ON contract_events
    FOR SELECT USING (
        current_setting('request.headers', true)::json->>'x-wallet-address' IS NOT NULL
    );

-- Policy for event_processing_state (system use only)
CREATE POLICY "System can manage event processing state" ON event_processing_state
    FOR ALL USING (true);

-- Functions for hybrid integration

-- Function to update NFT counts after on-chain mint
CREATE OR REPLACE FUNCTION update_user_nft_counts_after_mint(
    p_wallet_address TEXT,
    p_rarity TEXT,
    p_token_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert or update user NFT counts
    INSERT INTO user_nft_counts (wallet_address, rarity, count, last_updated)
    VALUES (LOWER(p_wallet_address), LOWER(p_rarity), 1, NOW())
    ON CONFLICT (wallet_address, rarity)
    DO UPDATE SET 
        count = user_nft_counts.count + 1,
        last_updated = NOW();
    
    -- Update total count
    INSERT INTO user_nft_counts (wallet_address, rarity, count, last_updated)
    VALUES (LOWER(p_wallet_address), 'total', 1, NOW())
    ON CONFLICT (wallet_address, rarity)
    DO UPDATE SET 
        count = user_nft_counts.count + 1,
        last_updated = NOW();
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- Function to update NFT counts after on-chain claim
CREATE OR REPLACE FUNCTION update_user_nft_counts_after_claim(
    p_wallet_address TEXT,
    p_rarity_counts JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rarity_key TEXT;
    rarity_count INTEGER;
    total_claimed INTEGER := 0;
BEGIN
    -- Update counts for each rarity
    FOR rarity_key, rarity_count IN SELECT * FROM jsonb_each_text(p_rarity_counts)
    LOOP
        INSERT INTO user_nft_counts (wallet_address, rarity, count, last_updated)
        VALUES (LOWER(p_wallet_address), LOWER(rarity_key), rarity_count, NOW())
        ON CONFLICT (wallet_address, rarity)
        DO UPDATE SET 
            count = user_nft_counts.count + rarity_count,
            last_updated = NOW();
        
        total_claimed := total_claimed + rarity_count;
    END LOOP;
    
    -- Update total count
    INSERT INTO user_nft_counts (wallet_address, rarity, count, last_updated)
    VALUES (LOWER(p_wallet_address), 'total', total_claimed, NOW())
    ON CONFLICT (wallet_address, rarity)
    DO UPDATE SET 
        count = user_nft_counts.count + total_claimed,
        last_updated = NOW();
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- Function to sync staking from contract events
CREATE OR REPLACE FUNCTION sync_staking_from_contract_event(
    p_wallet_address TEXT,
    p_token_id TEXT,
    p_action TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_action = 'stake' THEN
        -- Add to staked_nfts table
        INSERT INTO staked_nfts (wallet_address, nft_id, staked_at)
        VALUES (LOWER(p_wallet_address), p_token_id, NOW())
        ON CONFLICT (wallet_address, nft_id) DO NOTHING;
        
    ELSIF p_action = 'unstake' THEN
        -- Remove from staked_nfts table
        DELETE FROM staked_nfts 
        WHERE wallet_address = LOWER(p_wallet_address) 
        AND nft_id = p_token_id;
    END IF;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- Function to get user's on-chain transaction history
CREATE OR REPLACE FUNCTION get_user_onchain_transactions(
    p_wallet_address TEXT,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    transaction_type TEXT,
    transaction_hash TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'staking'::TEXT as transaction_type,
        t.transaction_hash,
        jsonb_build_object(
            'action', t.action,
            'token_id', t.token_id,
            'contract_address', t.contract_address,
            'gas_used', t.gas_used
        ) as details,
        t.timestamp
    FROM onchain_transactions t
    WHERE t.wallet_address = LOWER(p_wallet_address)
    
    UNION ALL
    
    SELECT 
        'burn'::TEXT as transaction_type,
        b.transaction_hash,
        jsonb_build_object(
            'token_ids', b.token_ids,
            'result_rarity', b.result_rarity,
            'contract_address', b.contract_address,
            'gas_used', b.gas_used
        ) as details,
        b.timestamp
    FROM onchain_burn_transactions b
    WHERE b.wallet_address = LOWER(p_wallet_address)
    
    UNION ALL
    
    SELECT 
        'claim'::TEXT as transaction_type,
        c.transaction_hash,
        jsonb_build_object(
            'token_ids', c.token_ids,
            'quantity', c.quantity,
            'contract_address', c.contract_address,
            'gas_used', c.gas_used
        ) as details,
        c.timestamp
    FROM onchain_claim_transactions c
    WHERE c.wallet_address = LOWER(p_wallet_address)
    
    ORDER BY timestamp DESC
    LIMIT p_limit;
END;
$$;

-- Function to get on-chain integration status
CREATE OR REPLACE FUNCTION get_onchain_integration_status(
    p_wallet_address TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    staking_count INTEGER;
    burn_count INTEGER;
    claim_count INTEGER;
BEGIN
    -- Count transactions by type
    SELECT COUNT(*) INTO staking_count 
    FROM onchain_transactions 
    WHERE wallet_address = LOWER(p_wallet_address);
    
    SELECT COUNT(*) INTO burn_count 
    FROM onchain_burn_transactions 
    WHERE wallet_address = LOWER(p_wallet_address);
    
    SELECT COUNT(*) INTO claim_count 
    FROM onchain_claim_transactions 
    WHERE wallet_address = LOWER(p_wallet_address);
    
    result := jsonb_build_object(
        'has_onchain_activity', (staking_count + burn_count + claim_count) > 0,
        'transaction_counts', jsonb_build_object(
            'staking', staking_count,
            'burn', burn_count,
            'claim', claim_count,
            'total', staking_count + burn_count + claim_count
        ),
        'last_activity', (
            SELECT MAX(timestamp) FROM (
                SELECT timestamp FROM onchain_transactions WHERE wallet_address = LOWER(p_wallet_address)
                UNION ALL
                SELECT timestamp FROM onchain_burn_transactions WHERE wallet_address = LOWER(p_wallet_address)
                UNION ALL
                SELECT timestamp FROM onchain_claim_transactions WHERE wallet_address = LOWER(p_wallet_address)
            ) all_transactions
        )
    );
    
    RETURN result;
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT ON onchain_transactions TO authenticated;
GRANT SELECT, INSERT ON onchain_burn_transactions TO authenticated;
GRANT SELECT, INSERT ON onchain_claim_transactions TO authenticated;
GRANT SELECT ON contract_events TO authenticated;
GRANT ALL ON event_processing_state TO service_role;

GRANT USAGE ON SEQUENCE onchain_transactions_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE onchain_burn_transactions_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE onchain_claim_transactions_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE contract_events_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE event_processing_state_id_seq TO service_role;

GRANT EXECUTE ON FUNCTION update_user_nft_counts_after_mint TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_nft_counts_after_claim TO authenticated;
GRANT EXECUTE ON FUNCTION sync_staking_from_contract_event TO service_role;
GRANT EXECUTE ON FUNCTION get_user_onchain_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION get_onchain_integration_status TO authenticated;
