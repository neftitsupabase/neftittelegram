-- Leaderboard Functions for user_nft_collections Table
-- Provides efficient NFT leaderboard queries using database table instead of IPFS

-- Function to get top NFT holders from user_nft_collections table
CREATE OR REPLACE FUNCTION get_top_nft_holders_from_collections(
  p_result_limit INTEGER DEFAULT 10,
  p_current_user_wallet TEXT DEFAULT NULL
)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  profile_image TEXT,
  total_nfts INTEGER,
  rank_position INTEGER,
  is_current_user BOOLEAN
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unc.wallet_address,
    COALESCE(u.display_name, '') as username,
    COALESCE(u.avatar_url, '') as profile_image,
    unc.total_nfts,
    ROW_NUMBER() OVER (ORDER BY unc.total_nfts DESC)::INTEGER as rank_position,
    FALSE as is_current_user
  FROM user_nft_collections unc
  LEFT JOIN users u ON u.wallet_address = unc.wallet_address
  WHERE unc.total_nfts > 0
  ORDER BY unc.total_nfts DESC
  LIMIT p_result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's NFT rank from user_nft_collections table
CREATE OR REPLACE FUNCTION get_user_nft_rank_from_collections(user_wallet TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  profile_image TEXT,
  total_nfts INTEGER,
  rank_position INTEGER
) 
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_lower TEXT;
BEGIN
  -- Normalize wallet address
  v_wallet_lower := LOWER(user_wallet);
  
  RETURN QUERY
  WITH ranked_users AS (
    SELECT 
      unc.wallet_address,
      COALESCE(u.display_name, '') as username,
      COALESCE(u.avatar_url, '') as profile_image,
      unc.total_nfts,
      ROW_NUMBER() OVER (ORDER BY unc.total_nfts DESC)::INTEGER as rank_position
    FROM user_nft_collections unc
    LEFT JOIN users u ON u.wallet_address = unc.wallet_address
    WHERE unc.total_nfts > 0
  )
  SELECT 
    ru.wallet_address,
    ru.username,
    ru.profile_image,
    ru.total_nfts,
    ru.rank_position
  FROM ranked_users ru
  WHERE ru.wallet_address = v_wallet_lower;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_top_nft_holders_from_collections(INTEGER, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_nft_rank_from_collections(TEXT) TO authenticated, anon, service_role;

-- Comments
COMMENT ON FUNCTION get_top_nft_holders_from_collections IS 'Gets top NFT holders from user_nft_collections table with usernames';
COMMENT ON FUNCTION get_user_nft_rank_from_collections IS 'Gets specific user NFT rank from user_nft_collections table';
