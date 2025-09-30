-- ============================================================================
-- REALTIME LEADERBOARD FUNCTIONS WITH COMPLETE BALANCE CALCULATION
-- Uses complete balance aggregation for accurate real-time data
-- Low egress with proper indexing and efficient queries
-- ============================================================================

-- Function to get top 10 NEFT holders with real-time balances and usernames
CREATE OR REPLACE FUNCTION get_top_neft_holders_realtime(result_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  profile_image TEXT,
  total_neft_claimed DECIMAL(18,8),
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH user_balances_complete AS (
    SELECT 
      ub.wallet_address,
      -- Complete NEFT calculation: campaign + daily + achievement + staking + referral
      (
        COALESCE(ub.total_neft_claimed, 0) +  -- Campaign rewards
        COALESCE(ur.total_neft_earned, 0) +   -- Referral rewards
        COALESCE(daily_claims.total_neft, 0) + -- Daily claims
        COALESCE(achievements.total_neft, 0) + -- Achievement rewards
        COALESCE(staking_rewards.total_neft, 0) -- Staking rewards
      ) as total_neft_claimed
    FROM user_balances ub
    LEFT JOIN user_referrals ur ON ur.wallet_address = ub.wallet_address
    LEFT JOIN (
      SELECT 
        wallet_address,
        SUM(total_neft_reward) as total_neft
      FROM daily_claims 
      GROUP BY wallet_address
    ) daily_claims ON daily_claims.wallet_address = ub.wallet_address
    LEFT JOIN (
      SELECT 
        wallet_address,
        SUM(neft_reward) as total_neft
      FROM user_achievements 
      WHERE status = 'completed' AND claimed_at IS NOT NULL
      GROUP BY wallet_address
    ) achievements ON achievements.wallet_address = ub.wallet_address
    LEFT JOIN (
      SELECT 
        wallet_address,
        SUM(reward_amount) as total_neft
      FROM staking_rewards 
      WHERE is_claimed = true
      GROUP BY wallet_address
    ) staking_rewards ON staking_rewards.wallet_address = ub.wallet_address
    WHERE (
      COALESCE(ub.total_neft_claimed, 0) + 
      COALESCE(ur.total_neft_earned, 0) + 
      COALESCE(daily_claims.total_neft, 0) + 
      COALESCE(achievements.total_neft, 0) + 
      COALESCE(staking_rewards.total_neft, 0)
    ) > 0
  ),
  ranked_users AS (
    SELECT 
      ubc.wallet_address,
      ubc.total_neft_claimed,
      ROW_NUMBER() OVER (ORDER BY ubc.total_neft_claimed DESC)::INTEGER as rank_position
    FROM user_balances_complete ubc
  )
  SELECT 
    ru.wallet_address,
    COALESCE(u.username, 
      CASE 
        WHEN ru.wallet_address LIKE 'social:%' THEN 
          SPLIT_PART(ru.wallet_address, ':', 2) || '_' || SPLIT_PART(ru.wallet_address, ':', 3)
        ELSE 
          SUBSTRING(ru.wallet_address, 1, 6) || '...' || SUBSTRING(ru.wallet_address, LENGTH(ru.wallet_address) - 3)
      END
    ) as username,
    COALESCE(u.profile_image, '') as profile_image,
    ru.total_neft_claimed,
    ru.rank_position
  FROM ranked_users ru
  LEFT JOIN users u ON u.wallet_address = ru.wallet_address
  ORDER BY ru.total_neft_claimed DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top 10 NFT holders with real-time counts and usernames
CREATE OR REPLACE FUNCTION get_top_nft_holders_realtime(result_limit INTEGER DEFAULT 10)
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
      uim.wallet_address,
      COUNT(*)::INTEGER as nft_count
    FROM user_ipfs_mappings uim
    GROUP BY uim.wallet_address
    HAVING COUNT(*) > 0
  ),
  ranked_users AS (
    SELECT 
      nc.wallet_address,
      nc.nft_count,
      ROW_NUMBER() OVER (ORDER BY nc.nft_count DESC)::INTEGER as rank_position
    FROM nft_counts nc
  )
  SELECT 
    ru.wallet_address,
    COALESCE(u.username, 
      CASE 
        WHEN ru.wallet_address LIKE 'social:%' THEN 
          SPLIT_PART(ru.wallet_address, ':', 2) || '_' || SPLIT_PART(ru.wallet_address, ':', 3)
        ELSE 
          SUBSTRING(ru.wallet_address, 1, 6) || '...' || SUBSTRING(ru.wallet_address, LENGTH(ru.wallet_address) - 3)
      END
    ) as username,
    COALESCE(u.profile_image, '') as profile_image,
    ru.nft_count,
    ru.rank_position
  FROM ranked_users ru
  LEFT JOIN users u ON u.wallet_address = ru.wallet_address
  ORDER BY ru.nft_count DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's rank in NEFT leaderboard with real-time balance
CREATE OR REPLACE FUNCTION get_user_neft_rank_realtime(user_wallet TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  profile_image TEXT,
  total_neft_claimed DECIMAL(18,8),
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH user_balances_complete AS (
    SELECT 
      ub.wallet_address,
      -- Complete NEFT calculation: campaign + daily + achievement + staking + referral
      (
        COALESCE(ub.total_neft_claimed, 0) +  -- Campaign rewards
        COALESCE(ur.total_neft_earned, 0) +   -- Referral rewards
        COALESCE(daily_claims.total_neft, 0) + -- Daily claims
        COALESCE(achievements.total_neft, 0) + -- Achievement rewards
        COALESCE(staking_rewards.total_neft, 0) -- Staking rewards
      ) as total_neft_claimed
    FROM user_balances ub
    LEFT JOIN user_referrals ur ON ur.wallet_address = ub.wallet_address
    LEFT JOIN (
      SELECT 
        wallet_address,
        SUM(total_neft_reward) as total_neft
      FROM daily_claims 
      GROUP BY wallet_address
    ) daily_claims ON daily_claims.wallet_address = ub.wallet_address
    LEFT JOIN (
      SELECT 
        wallet_address,
        SUM(neft_reward) as total_neft
      FROM user_achievements 
      WHERE status = 'completed' AND claimed_at IS NOT NULL
      GROUP BY wallet_address
    ) achievements ON achievements.wallet_address = ub.wallet_address
    LEFT JOIN (
      SELECT 
        wallet_address,
        SUM(reward_amount) as total_neft
      FROM staking_rewards 
      WHERE is_claimed = true
      GROUP BY wallet_address
    ) staking_rewards ON staking_rewards.wallet_address = ub.wallet_address
    WHERE (
      COALESCE(ub.total_neft_claimed, 0) + 
      COALESCE(ur.total_neft_earned, 0) + 
      COALESCE(daily_claims.total_neft, 0) + 
      COALESCE(achievements.total_neft, 0) + 
      COALESCE(staking_rewards.total_neft, 0)
    ) > 0
  ),
  ranked_users AS (
    SELECT 
      ubc.wallet_address,
      ubc.total_neft_claimed,
      ROW_NUMBER() OVER (ORDER BY ubc.total_neft_claimed DESC)::INTEGER as rank_position
    FROM user_balances_complete ubc
  )
  SELECT 
    ru.wallet_address,
    COALESCE(u.username, 
      CASE 
        WHEN ru.wallet_address LIKE 'social:%' THEN 
          SPLIT_PART(ru.wallet_address, ':', 2) || '_' || SPLIT_PART(ru.wallet_address, ':', 3)
        ELSE 
          SUBSTRING(ru.wallet_address, 1, 6) || '...' || SUBSTRING(ru.wallet_address, LENGTH(ru.wallet_address) - 3)
      END
    ) as username,
    COALESCE(u.profile_image, '') as profile_image,
    ru.total_neft_claimed,
    ru.rank_position
  FROM ranked_users ru
  LEFT JOIN users u ON u.wallet_address = ru.wallet_address
  WHERE ru.wallet_address = user_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's rank in NFT leaderboard with real-time count
CREATE OR REPLACE FUNCTION get_user_nft_rank_realtime(user_wallet TEXT)
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
      uim.wallet_address,
      COUNT(*)::INTEGER as nft_count
    FROM user_ipfs_mappings uim
    GROUP BY uim.wallet_address
    HAVING COUNT(*) > 0
  ),
  ranked_users AS (
    SELECT 
      nc.wallet_address,
      nc.nft_count,
      ROW_NUMBER() OVER (ORDER BY nc.nft_count DESC)::INTEGER as rank_position
    FROM nft_counts nc
  )
  SELECT 
    ru.wallet_address,
    COALESCE(u.username, 
      CASE 
        WHEN ru.wallet_address LIKE 'social:%' THEN 
          SPLIT_PART(ru.wallet_address, ':', 2) || '_' || SPLIT_PART(ru.wallet_address, ':', 3)
        ELSE 
          SUBSTRING(ru.wallet_address, 1, 6) || '...' || SUBSTRING(ru.wallet_address, LENGTH(ru.wallet_address) - 3)
      END
    ) as username,
    COALESCE(u.profile_image, '') as profile_image,
    ru.nft_count,
    ru.rank_position
  FROM ranked_users ru
  LEFT JOIN users u ON u.wallet_address = ru.wallet_address
  WHERE ru.wallet_address = user_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_top_neft_holders_realtime(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_nft_holders_realtime(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_neft_rank_realtime(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_nft_rank_realtime(TEXT) TO anon, authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_top_neft_holders_realtime(INTEGER) IS 'Returns top NEFT holders with real-time complete balance calculation';
COMMENT ON FUNCTION get_top_nft_holders_realtime(INTEGER) IS 'Returns top NFT holders with real-time NFT counts';
COMMENT ON FUNCTION get_user_neft_rank_realtime(TEXT) IS 'Returns specific user rank in NEFT leaderboard with real-time balance';
COMMENT ON FUNCTION get_user_nft_rank_realtime(TEXT) IS 'Returns specific user rank in NFT leaderboard with real-time count';

-- Create indexes for better performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_referrals_wallet ON user_referrals(wallet_address);
CREATE INDEX IF NOT EXISTS idx_daily_claims_wallet ON daily_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet ON user_achievements(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staking_rewards_wallet ON staking_rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_ipfs_mappings_wallet ON user_ipfs_mappings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
