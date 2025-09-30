-- ============================================================================
-- OPTIMIZED LEADERBOARD FUNCTIONS FOR LOW EGRESS
-- Uses ORDER BY + LIMIT 10 to minimize data transfer
-- Only fetches required fields for UI display
-- ============================================================================

-- Function to get top 10 NEFT holders from user_balances table
-- Returns minimal data: wallet_address, total_neft_claimed, rank
CREATE OR REPLACE FUNCTION get_top_neft_holders(result_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  wallet_address TEXT,
  total_neft_claimed DECIMAL(18,8),
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ub.wallet_address,
    (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) as total_neft_claimed,
    ROW_NUMBER() OVER (ORDER BY (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) DESC)::INTEGER as rank_position
  FROM user_balances ub
  LEFT JOIN user_referrals ur ON ur.wallet_address = ub.wallet_address
  WHERE (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) > 0
  ORDER BY (COALESCE(ub.total_neft_claimed, 0) + COALESCE(ur.total_neft_earned, 0)) DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top 10 NFT holders from burn page collections
-- This function will be updated to work with a new nft_collections table
-- that stores individual NFT records from burn operations
CREATE OR REPLACE FUNCTION get_top_nft_holders(result_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  wallet_address TEXT,
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
  )
  SELECT 
    nfc.wallet_address,
    nfc.nft_count,
    ROW_NUMBER() OVER (ORDER BY nfc.nft_count DESC)::INTEGER as rank_position
  FROM nft_counts nfc
  WHERE nfc.nft_count > 0
  ORDER BY nfc.nft_count DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's rank in NEFT leaderboard (for current user display)
CREATE OR REPLACE FUNCTION get_user_neft_rank(user_wallet TEXT)
RETURNS TABLE (
  wallet_address TEXT,
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
    ru.total_neft_claimed,
    ru.rank_position
  FROM ranked_users ru
  WHERE ru.wallet_address = user_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's rank in NFT leaderboard (for current user display)
CREATE OR REPLACE FUNCTION get_user_nft_rank(user_wallet TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  nft_count INTEGER,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH nft_counts AS (
    SELECT 
      uim.wallet_address,
      COUNT(*)::INTEGER as nft_count
    FROM user_ipfs_mappings uim
    GROUP BY uim.wallet_address
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
    ru.nft_count,
    ru.rank_position
  FROM ranked_users ru
  WHERE ru.wallet_address = user_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_top_neft_holders(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_nft_holders(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_neft_rank(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_nft_rank(TEXT) TO anon, authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_top_neft_holders(INTEGER) IS 'Returns top NEFT holders with minimal data for low egress';
COMMENT ON FUNCTION get_top_nft_holders(INTEGER) IS 'Returns top NFT holders by counting user_ipfs_mappings';
COMMENT ON FUNCTION get_user_neft_rank(TEXT) IS 'Returns specific user rank in NEFT leaderboard';
COMMENT ON FUNCTION get_user_nft_rank(TEXT) IS 'Returns specific user rank in NFT leaderboard';
