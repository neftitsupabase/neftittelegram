-- ============================================================================
-- UPDATED LEADERBOARD FUNCTIONS WITH USERNAMES
-- Includes usernames from users table for better display
-- ============================================================================

-- Function to get top 10 NEFT holders with usernames
CREATE OR REPLACE FUNCTION get_top_neft_holders_with_usernames(result_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  profile_image TEXT,
  total_neft_claimed DECIMAL(18,8),
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ub.wallet_address,
    COALESCE(u.display_name, 
      CASE 
        WHEN ub.wallet_address LIKE 'social:%' THEN 
          SPLIT_PART(ub.wallet_address, ':', 2) || '_' || SPLIT_PART(ub.wallet_address, ':', 3)
        ELSE 
          SUBSTRING(ub.wallet_address, 1, 6) || '...' || SUBSTRING(ub.wallet_address, LENGTH(ub.wallet_address) - 3)
      END
    ) as username,
    COALESCE(u.avatar_url, '') as profile_image,
    (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) as total_neft_claimed,
    ROW_NUMBER() OVER (ORDER BY (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) DESC)::INTEGER as rank_position
  FROM user_balances ub
  LEFT JOIN user_referrals ur ON ur.wallet_address = ub.wallet_address
  LEFT JOIN users u ON u.wallet_address = ub.wallet_address
  WHERE (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) > 0
  ORDER BY (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top 10 NFT holders with usernames
CREATE OR REPLACE FUNCTION get_top_nft_holders_with_usernames(result_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  profile_image TEXT,
  nft_count INTEGER,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH nft_counts AS (
    SELECT 
      nc.wallet_address,
      COUNT(*)::INTEGER as nft_count
    FROM nft_collections nc
    WHERE nc.is_active = true  -- Only count active (non-burned) NFTs
    GROUP BY nc.wallet_address
    HAVING COUNT(*) > 0
  )
  SELECT 
    nfc.wallet_address,
    COALESCE(u.display_name, 
      CASE 
        WHEN nfc.wallet_address LIKE 'social:%' THEN 
          SPLIT_PART(nfc.wallet_address, ':', 2) || '_' || SPLIT_PART(nfc.wallet_address, ':', 3)
        ELSE 
          SUBSTRING(nfc.wallet_address, 1, 6) || '...' || SUBSTRING(nfc.wallet_address, LENGTH(nfc.wallet_address) - 3)
      END
    ) as username,
    COALESCE(u.avatar_url, '') as profile_image,
    nfc.nft_count,
    ROW_NUMBER() OVER (ORDER BY nfc.nft_count DESC)::INTEGER as rank_position
  FROM nft_counts nfc
  LEFT JOIN users u ON u.wallet_address = nfc.wallet_address
  WHERE nfc.nft_count > 0
  ORDER BY nfc.nft_count DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's rank in NEFT leaderboard with username
CREATE OR REPLACE FUNCTION get_user_neft_rank_with_username(user_wallet TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  profile_image TEXT,
  total_neft_claimed DECIMAL(18,8),
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_users AS (
    SELECT 
      ub.wallet_address,
      (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) as total_neft_claimed,
      ROW_NUMBER() OVER (ORDER BY (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) DESC)::INTEGER as rank_position
    FROM user_balances ub
    LEFT JOIN user_referrals ur ON ur.wallet_address = ub.wallet_address
    WHERE (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) > 0
  )
  SELECT 
    ru.wallet_address,
    COALESCE(u.display_name, 
      CASE 
        WHEN ru.wallet_address LIKE 'social:%' THEN 
          SPLIT_PART(ru.wallet_address, ':', 2) || '_' || SPLIT_PART(ru.wallet_address, ':', 3)
        ELSE 
          SUBSTRING(ru.wallet_address, 1, 6) || '...' || SUBSTRING(ru.wallet_address, LENGTH(ru.wallet_address) - 3)
      END
    ) as username,
    COALESCE(u.avatar_url, '') as profile_image,
    ru.total_neft_claimed,
    ru.rank_position
  FROM ranked_users ru
  LEFT JOIN users u ON u.wallet_address = ru.wallet_address
  WHERE ru.wallet_address = user_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's rank in NFT leaderboard with username
CREATE OR REPLACE FUNCTION get_user_nft_rank_with_username(user_wallet TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  profile_image TEXT,
  nft_count INTEGER,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH nft_counts AS (
    SELECT 
      nc.wallet_address,
      COUNT(*)::INTEGER as nft_count
    FROM nft_collections nc
    WHERE nc.is_active = true  -- Only count active (non-burned) NFTs
    GROUP BY nc.wallet_address
    HAVING COUNT(*) > 0
  ),
  ranked_users AS (
    SELECT 
      nc.wallet_address,
      nc.nft_count,
      ROW_NUMBER() OVER (ORDER BY nc.nft_count DESC)::INTEGER as rank_position
    FROM nft_counts nc
    WHERE nc.nft_count > 0
  )
  SELECT 
    ru.wallet_address,
    COALESCE(u.display_name, 
      CASE 
        WHEN ru.wallet_address LIKE 'social:%' THEN 
          SPLIT_PART(ru.wallet_address, ':', 2) || '_' || SPLIT_PART(ru.wallet_address, ':', 3)
        ELSE 
          SUBSTRING(ru.wallet_address, 1, 6) || '...' || SUBSTRING(ru.wallet_address, LENGTH(ru.wallet_address) - 3)
      END
    ) as username,
    COALESCE(u.avatar_url, '') as profile_image,
    ru.nft_count,
    ru.rank_position
  FROM ranked_users ru
  LEFT JOIN users u ON u.wallet_address = ru.wallet_address
  WHERE ru.wallet_address = user_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_top_neft_holders_with_usernames(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_nft_holders_with_usernames(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_neft_rank_with_username(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_nft_rank_with_username(TEXT) TO anon, authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_top_neft_holders_with_usernames(INTEGER) IS 'Returns top NEFT holders with usernames and profile images';
COMMENT ON FUNCTION get_top_nft_holders_with_usernames(INTEGER) IS 'Returns top NFT holders with usernames and profile images';
COMMENT ON FUNCTION get_user_neft_rank_with_username(TEXT) IS 'Returns specific user rank in NEFT leaderboard with username';
COMMENT ON FUNCTION get_user_nft_rank_with_username(TEXT) IS 'Returns specific user rank in NFT leaderboard with username';
