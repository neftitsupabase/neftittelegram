-- ============================================================================
-- SAFE NFT LEADERBOARD FUNCTIONS
-- Handles different users table schemas gracefully
-- ============================================================================

-- First, let's create a simple version that doesn't rely on users table columns
-- This ensures it works regardless of your users table structure

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_nft_leaderboard_optimized(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_user_nft_rank_optimized(TEXT);

-- ============================================================================
-- FUNCTION: Get NFT Leaderboard (Safe Version)
-- Works without depending on specific users table columns
-- ============================================================================
CREATE OR REPLACE FUNCTION get_nft_leaderboard_optimized(
    p_limit INTEGER DEFAULT 10,
    p_current_user_wallet TEXT DEFAULT NULL
)
RETURNS TABLE (
    wallet_address TEXT,
    username TEXT,
    profile_image TEXT,
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
            -- Generate username from wallet address (safe fallback)
            CASE 
                WHEN unc.wallet_address LIKE 'social:%' THEN 
                    split_part(unc.wallet_address, ':', 2) || '_' || substring(split_part(unc.wallet_address, ':', 3), 1, 8)
                WHEN unc.wallet_address LIKE '%@%' THEN 
                    split_part(unc.wallet_address, '@', 1)
                WHEN length(unc.wallet_address) > 10 THEN 
                    substring(unc.wallet_address, 1, 6) || '...' || substring(unc.wallet_address, length(unc.wallet_address) - 3)
                ELSE unc.wallet_address
            END as username,
            -- Default profile image
            '/profilepictures/profileimg1.jpg' as profile_image,
            unc.total_nfts,
            unc.offchain_nfts,
            unc.onchain_nfts,
            unc.staked_nfts,
            ROW_NUMBER() OVER (ORDER BY unc.total_nfts DESC, unc.wallet_address) as rank_position
        FROM user_nft_counts unc
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
        combined.profile_image,
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
-- FUNCTION: Get User NFT Rank (Safe Version)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_nft_rank_optimized(
    p_wallet_address TEXT
)
RETURNS TABLE (
    wallet_address TEXT,
    username TEXT,
    profile_image TEXT,
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
            -- Generate username from wallet address (safe fallback)
            CASE 
                WHEN unc.wallet_address LIKE 'social:%' THEN 
                    split_part(unc.wallet_address, ':', 2) || '_' || substring(split_part(unc.wallet_address, ':', 3), 1, 8)
                WHEN unc.wallet_address LIKE '%@%' THEN 
                    split_part(unc.wallet_address, '@', 1)
                WHEN length(unc.wallet_address) > 10 THEN 
                    substring(unc.wallet_address, 1, 6) || '...' || substring(unc.wallet_address, length(unc.wallet_address) - 3)
                ELSE unc.wallet_address
            END as username,
            -- Default profile image
            '/profilepictures/profileimg1.jpg' as profile_image,
            unc.total_nfts,
            unc.offchain_nfts,
            unc.onchain_nfts,
            unc.staked_nfts,
            ROW_NUMBER() OVER (ORDER BY unc.total_nfts DESC, unc.wallet_address) as rank_position
        FROM user_nft_counts unc
        WHERE unc.total_nfts > 0
    )
    SELECT 
        ru.wallet_address,
        ru.username,
        ru.profile_image,
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
-- ENHANCED VERSION: Try to use users table if columns exist
-- This version attempts to join with users table but falls back gracefully
-- ============================================================================
CREATE OR REPLACE FUNCTION get_nft_leaderboard_with_users(
    p_limit INTEGER DEFAULT 10,
    p_current_user_wallet TEXT DEFAULT NULL
)
RETURNS TABLE (
    wallet_address TEXT,
    username TEXT,
    profile_image TEXT,
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
    v_has_display_name BOOLEAN := FALSE;
    v_has_avatar_url BOOLEAN := FALSE;
    v_has_name BOOLEAN := FALSE;
    v_has_image BOOLEAN := FALSE;
BEGIN
    -- Check if users table columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'display_name'
    ) INTO v_has_display_name;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'avatar_url'
    ) INTO v_has_avatar_url;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'name'
    ) INTO v_has_name;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'image'
    ) INTO v_has_image;

    -- Normalize current user wallet
    v_user_wallet_lower := CASE 
        WHEN p_current_user_wallet IS NOT NULL THEN LOWER(p_current_user_wallet)
        ELSE NULL
    END;

    RETURN QUERY
    EXECUTE format('
    WITH ranked_users AS (
        SELECT 
            unc.wallet_address,
            COALESCE(%s, 
                CASE 
                    WHEN unc.wallet_address LIKE ''social:%%'' THEN 
                        split_part(unc.wallet_address, '':'', 2) || ''_'' || substring(split_part(unc.wallet_address, '':'', 3), 1, 8)
                    WHEN unc.wallet_address LIKE ''%%@%%'' THEN 
                        split_part(unc.wallet_address, ''@'', 1)
                    WHEN length(unc.wallet_address) > 10 THEN 
                        substring(unc.wallet_address, 1, 6) || ''...'' || substring(unc.wallet_address, length(unc.wallet_address) - 3)
                    ELSE unc.wallet_address
                END
            ) as username,
            COALESCE(%s, ''/profilepictures/profileimg1.jpg'') as profile_image,
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
        LIMIT $1
    ),
    current_user_data AS (
        SELECT 
            ru.*,
            TRUE as is_current_user,
            2 as sort_order
        FROM ranked_users ru
        WHERE $2 IS NOT NULL 
            AND LOWER(ru.wallet_address) = $2
            AND ru.rank_position > $1
    )
    SELECT 
        combined.wallet_address,
        combined.username,
        combined.profile_image,
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
    ORDER BY combined.sort_order, combined.rank_position',
    -- Dynamic column selection based on what exists
    CASE 
        WHEN v_has_display_name THEN 'u.display_name'
        WHEN v_has_name THEN 'u.name'
        ELSE 'NULL'
    END,
    CASE 
        WHEN v_has_avatar_url THEN 'u.avatar_url'
        WHEN v_has_image THEN 'u.image'
        ELSE 'NULL'
    END
    ) USING p_limit, v_user_wallet_lower;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_nft_leaderboard_optimized(INTEGER, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_nft_rank_optimized(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_nft_leaderboard_with_users(INTEGER, TEXT) TO authenticated, anon, service_role;

-- Test the safe functions
SELECT 'Testing Safe NFT Leaderboard Function:' as test_name;
SELECT 
    wallet_address,
    username,
    total_nfts,
    rank_position,
    is_current_user
FROM get_nft_leaderboard_optimized(5, NULL);

-- Show what we have so far
SELECT 'Current user_nft_counts data:' as test_name;
SELECT COUNT(*) as total_records FROM user_nft_counts;
