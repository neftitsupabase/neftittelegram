-- FINAL LEADERBOARD SETUP - Low egress with current user rank
-- Shows top 10 + current user's actual rank if not in top 10

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
      COALESCE(u.avatar_url, '') as profile_image,
      unc.total_nfts,
      ROW_NUMBER() OVER (ORDER BY unc.total_nfts DESC)::INTEGER as rank_position
    FROM user_nft_collections unc
    LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(unc.wallet_address)
    WHERE unc.total_nfts > 0
  ),
  final_result AS (
    -- Top users
    (SELECT 
      ru.wallet_address,
      ru.username,
      ru.profile_image,
      ru.total_nfts,
      ru.rank_position,
      FALSE as is_current_user,
      1 as sort_order
    FROM ranked_users ru
    ORDER BY ru.rank_position
    LIMIT p_result_limit)
    
    UNION ALL
    
    -- Current user if not in top results
    (SELECT 
      ru.wallet_address,
      ru.username,
      ru.profile_image,
      ru.total_nfts,
      ru.rank_position,
      TRUE as is_current_user,
      2 as sort_order
    FROM ranked_users ru
    WHERE v_user_wallet_lower IS NOT NULL 
      AND ru.wallet_address = v_user_wallet_lower
      AND ru.rank_position > p_result_limit)
  )
  SELECT 
    fr.wallet_address,
    fr.username,
    fr.profile_image,
    fr.total_nfts,
    fr.rank_position,
    fr.is_current_user
  FROM final_result fr
  ORDER BY fr.sort_order, fr.rank_position;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_top_nft_holders_from_collections(INTEGER, TEXT) TO authenticated, anon, service_role;

-- Test with your existing data
SELECT 'NFT Leaderboard Result (Top 10):' as test;
SELECT 
  wallet_address,
  username,
  total_nfts,
  rank_position,
  is_current_user
FROM get_top_nft_holders_from_collections(10, NULL);

-- Test with current user not in top 10 (simulate user with lower rank)
SELECT 'Test: User not in top 10 (shows actual rank at end):' as test;
SELECT 
  wallet_address,
  username,
  total_nfts,
  rank_position,
  is_current_user
FROM get_top_nft_holders_from_collections(1, 'social:google:108308658811682407572');
