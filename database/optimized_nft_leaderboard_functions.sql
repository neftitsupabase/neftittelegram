-- ============================================================================
-- OPTIMIZED NFT LEADERBOARD FUNCTIONS
-- Real-time, scalable, low-egress NFT counting for leaderboards
-- ============================================================================

-- Create the user_nft_counts table for efficient tracking
CREATE TABLE IF NOT EXISTS user_nft_counts (
    wallet_address TEXT PRIMARY KEY,
    offchain_nfts INTEGER DEFAULT 0,
    onchain_nfts INTEGER DEFAULT 0,
    total_nfts INTEGER DEFAULT 0,
    staked_nfts INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_nft_counts_total_nfts ON user_nft_counts(total_nfts DESC);
CREATE INDEX IF NOT EXISTS idx_user_nft_counts_wallet ON user_nft_counts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_nft_counts_updated ON user_nft_counts(last_updated);

-- Enable RLS
ALTER TABLE user_nft_counts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view all NFT counts" ON user_nft_counts;
CREATE POLICY "Users can view all NFT counts" ON user_nft_counts
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own NFT counts" ON user_nft_counts;
CREATE POLICY "Users can update their own NFT counts" ON user_nft_counts
    FOR ALL USING (true);

-- ============================================================================
-- FUNCTION: Get NFT Leaderboard (Optimized)
-- Returns top N users + current user's rank if not in top N
-- ============================================================================
CREATE OR REPLACE FUNCTION get_nft_leaderboard_optimized(
    p_limit INTEGER DEFAULT 10,
    p_current_user_wallet TEXT DEFAULT NULL
)
RETURNS TABLE (
    wallet_address TEXT,
    username TEXT,
    total_nfts INTEGER,
    offchain_nfts INTEGER,
    onchain_nfts INTEGER,
    staked_nfts INTEGER,
    rank_position BIGINT,
    is_current_user BOOLEAN
) 
SECURITY DEFINER
AS $$
DECLARE
    v_user_wallet_lower TEXT;
BEGIN
    -- Normalize current user wallet
    v_user_wallet_lower := CASE 
        WHEN p_current_user_wallet IS NOT NULL THEN LOWER(p_current_user_wallet)
        ELSE NULL
    END;

    RETURN QUERY
    WITH ranked_users AS (
        SELECT 
            unc.wallet_address,
            COALESCE(u.display_name, '') as username,
            unc.total_nfts,
            unc.offchain_nfts,
            unc.onchain_nfts,
            unc.staked_nfts,
            ROW_NUMBER() OVER (ORDER BY unc.total_nfts DESC, unc.wallet_address) as rank_position
        FROM user_nft_counts unc
        LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(unc.wallet_address)
        WHERE unc.total_nfts > 0
    ),
    top_users AS (
        SELECT 
            ru.*,
            FALSE as is_current_user,
            1 as sort_order
        FROM ranked_users ru
        ORDER BY ru.rank_position
        LIMIT p_limit
    ),
    current_user_data AS (
        SELECT 
            ru.*,
            TRUE as is_current_user,
            2 as sort_order
        FROM ranked_users ru
        WHERE v_user_wallet_lower IS NOT NULL 
            AND LOWER(ru.wallet_address) = v_user_wallet_lower
            AND ru.rank_position > p_limit
    )
    SELECT 
        combined.wallet_address,
        combined.username,
        combined.total_nfts,
        combined.offchain_nfts,
        combined.onchain_nfts,
        combined.staked_nfts,
        combined.rank_position,
        combined.is_current_user
    FROM (
        SELECT * FROM top_users
        UNION ALL
        SELECT * FROM current_user_data
    ) combined
    ORDER BY combined.sort_order, combined.rank_position;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get User NFT Rank (Optimized)
-- Returns specific user's rank and stats
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_nft_rank_optimized(
    p_wallet_address TEXT
)
RETURNS TABLE (
    wallet_address TEXT,
    username TEXT,
    total_nfts INTEGER,
    offchain_nfts INTEGER,
    onchain_nfts INTEGER,
    staked_nfts INTEGER,
    rank_position BIGINT
) 
SECURITY DEFINER
AS $$
DECLARE
    v_user_wallet_lower TEXT;
BEGIN
    v_user_wallet_lower := LOWER(p_wallet_address);

    RETURN QUERY
    WITH ranked_users AS (
        SELECT 
            unc.wallet_address,
            COALESCE(u.display_name, '') as username,
            unc.total_nfts,
            unc.offchain_nfts,
            unc.onchain_nfts,
            unc.staked_nfts,
            ROW_NUMBER() OVER (ORDER BY unc.total_nfts DESC, unc.wallet_address) as rank_position
        FROM user_nft_counts unc
        LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(unc.wallet_address)
        WHERE unc.total_nfts > 0
    )
    SELECT 
        ru.wallet_address,
        ru.username,
        ru.total_nfts,
        ru.offchain_nfts,
        ru.onchain_nfts,
        ru.staked_nfts,
        ru.rank_position
    FROM ranked_users ru
    WHERE LOWER(ru.wallet_address) = v_user_wallet_lower;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get NFT Statistics
-- Returns overall NFT statistics for analytics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_nft_statistics()
RETURNS TABLE (
    total_users BIGINT,
    total_nfts BIGINT,
    total_offchain BIGINT,
    total_onchain BIGINT,
    total_staked BIGINT
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_users,
        COALESCE(SUM(unc.total_nfts), 0)::BIGINT as total_nfts,
        COALESCE(SUM(unc.offchain_nfts), 0)::BIGINT as total_offchain,
        COALESCE(SUM(unc.onchain_nfts), 0)::BIGINT as total_onchain,
        COALESCE(SUM(unc.staked_nfts), 0)::BIGINT as total_staked
    FROM user_nft_counts unc
    WHERE unc.total_nfts > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update NFT Count (Trigger Helper)
-- Updates the last_updated timestamp when counts change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_nft_count_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_nft_count_timestamp ON user_nft_counts;
CREATE TRIGGER trigger_update_nft_count_timestamp
    BEFORE UPDATE ON user_nft_counts
    FOR EACH ROW
    EXECUTE FUNCTION update_nft_count_timestamp();

-- Grant permissions
GRANT ALL ON TABLE user_nft_counts TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_nft_leaderboard_optimized(INTEGER, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_nft_rank_optimized(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_nft_statistics() TO authenticated, anon, service_role;

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test the leaderboard function
SELECT 'Testing NFT Leaderboard Function:' as test_name;
SELECT 
    wallet_address,
    username,
    total_nfts,
    offchain_nfts,
    onchain_nfts,
    rank_position,
    is_current_user
FROM get_nft_leaderboard_optimized(10, NULL);

-- Test user rank function
SELECT 'Testing User Rank Function:' as test_name;
-- Replace with an actual wallet address from your system
-- SELECT * FROM get_user_nft_rank_optimized('0x1234567890123456789012345678901234567890');

-- Test statistics function
SELECT 'Testing Statistics Function:' as test_name;
SELECT * FROM get_nft_statistics();

-- Show current table structure
SELECT 'Current user_nft_counts table:' as test_name;
SELECT 
    wallet_address,
    total_nfts,
    offchain_nfts,
    onchain_nfts,
    staked_nfts,
    last_updated
FROM user_nft_counts 
ORDER BY total_nfts DESC 
LIMIT 5;
