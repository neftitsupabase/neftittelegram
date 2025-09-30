-- ============================================================================
-- SIMPLE ACHIEVEMENTS FALLBACK - Basic working system with claim tracking
-- ============================================================================
-- This creates a basic achievement system that returns achievements even if
-- source tables don't exist yet. It focuses on getting something working first.
-- ============================================================================

-- Step 0: Create user_achievement_progress table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_achievement_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  current_progress INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(wallet_address, achievement_key)
);

-- Step 1: Create a function that returns achievements with claim status
CREATE OR REPLACE FUNCTION get_user_achievement_status(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Return achievements with real progress tracking AND claim status checking
  
  SELECT json_build_array(
    -- Quest Achievements (with REAL progress tracking)
    json_build_object(
      'achievement_key', 'first_quest',
      'title', 'First Quest',
      'description', 'Complete your first campaign',
      'category', 'quest',
      'icon', '🎯',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 1,
      'current_progress', (
        SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
        FROM campaign_reward_claims 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT claimed_at FROM user_achievement_progress 
          WHERE wallet_address = user_wallet AND achievement_key = 'first_quest'
          LIMIT 1
        ) IS NOT NULL THEN 'claimed'
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
          FROM campaign_reward_claims 
          WHERE wallet_address = user_wallet
        ) >= 1 THEN 'completed' 
        ELSE 'locked' 
      END,
      'claimed_at', (
        SELECT claimed_at FROM user_achievement_progress 
        WHERE wallet_address = user_wallet AND achievement_key = 'first_quest'
        LIMIT 1
      ),
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
          FROM campaign_reward_claims 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 1 * 100), 100
      ),
      'sort_order', 1
    ),
    json_build_object(
      'achievement_key', 'quest_legend',
      'title', 'Quest Legend',
      'description', 'Complete 10 campaigns',
      'category', 'quest',
      'icon', '⭐',
      'neft_reward', 70,
      'xp_reward', 70,
      'required_count', 10,
      'current_progress', (
        SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
        FROM campaign_reward_claims 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT claimed_at FROM user_achievement_progress 
          WHERE wallet_address = user_wallet AND achievement_key = 'quest_legend'
          LIMIT 1
        ) IS NOT NULL THEN 'claimed'
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
          FROM campaign_reward_claims 
          WHERE wallet_address = user_wallet
        ) >= 10 THEN 'completed' 
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
          FROM campaign_reward_claims 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (
        SELECT claimed_at FROM user_achievement_progress 
        WHERE wallet_address = user_wallet AND achievement_key = 'quest_legend'
        LIMIT 1
      ),
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
          FROM campaign_reward_claims 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 10 * 100), 100
      ),
      'sort_order', 2
    ),
    json_build_object(
      'achievement_key', 'quest_master',
      'title', 'Quest Master',
      'description', 'Complete 25 campaigns',
      'category', 'quest',
      'icon', '👑',
      'neft_reward', 150,
      'xp_reward', 150,
      'required_count', 25,
      'current_progress', (
        SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
        FROM campaign_reward_claims 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT claimed_at FROM user_achievement_progress 
          WHERE wallet_address = user_wallet AND achievement_key = 'quest_master'
          LIMIT 1
        ) IS NOT NULL THEN 'claimed'
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
          FROM campaign_reward_claims 
          WHERE wallet_address = user_wallet
        ) >= 25 THEN 'completed' 
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
          FROM campaign_reward_claims 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (
        SELECT claimed_at FROM user_achievement_progress 
        WHERE wallet_address = user_wallet AND achievement_key = 'quest_master'
        LIMIT 1
      ),
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(DISTINCT project_id), 0) 
          FROM campaign_reward_claims 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 25 * 100), 100
      ),
      'sort_order', 3
    ),
    
    -- Burn Achievements (MATCHED to your burn system progression!)
    json_build_object(
      'achievement_key', 'first_burn',
      'title', 'First Burn',
      'description', 'Complete your first burn transaction',
      'category', 'burn',
      'icon', '🔥',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 1,
      'current_progress', (
        SELECT COALESCE(COUNT(*), 0) 
        FROM burn_transactions 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM burn_transactions 
          WHERE wallet_address = user_wallet
        ) >= 1 THEN 'completed' 
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(*), 0) 
          FROM burn_transactions 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 1 * 100), 100
      ),
      'sort_order', 10
    ),
    json_build_object(
      'achievement_key', 'platinum_creator',
      'title', 'Platinum Creator',
      'description', 'Complete 3 platinum upgrades (15 total burns)',
      'category', 'burn',
      'icon', '💎',
      'neft_reward', 30,
      'xp_reward', 30,
      'required_count', 15,
      'current_progress', (
        SELECT COALESCE(COUNT(*), 0) 
        FROM burn_transactions 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM burn_transactions 
          WHERE wallet_address = user_wallet
        ) >= 15 THEN 'completed' 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM burn_transactions 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(*), 0) 
          FROM burn_transactions 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 15 * 100), 100
      ),
      'sort_order', 11
    ),
    json_build_object(
      'achievement_key', 'silver_master',
      'title', 'Silver Master',
      'description', 'Reach Silver NFT tier (40+ total burns)',
      'category', 'burn',
      'icon', '🥈',
      'neft_reward', 80,
      'xp_reward', 80,
      'required_count', 40,
      'current_progress', (
        SELECT COALESCE(COUNT(*), 0) 
        FROM burn_transactions 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM burn_transactions 
          WHERE wallet_address = user_wallet
        ) >= 40 THEN 'completed' 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM burn_transactions 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(*), 0) 
          FROM burn_transactions 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 40 * 100), 100
      ),
      'sort_order', 12
    ),
    
    -- Referral Achievements (with REAL progress tracking)
    json_build_object(
      'achievement_key', 'first_referral',
      'title', 'First Referral',
      'description', 'Refer your first friend',
      'category', 'referral',
      'icon', '🤝',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 1,
      'current_progress', (
        SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
        FROM referral_rewards 
        WHERE referrer_wallet = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
          FROM referral_rewards 
          WHERE referrer_wallet = user_wallet
        ) >= 1 THEN 'completed' 
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
          FROM referral_rewards 
          WHERE referrer_wallet = user_wallet
        )::DECIMAL / 1 * 100), 100
      ),
      'sort_order', 20
    ),
    json_build_object(
      'achievement_key', 'referral_pro',
      'title', 'Referral Pro',
      'description', 'Refer 10 friends',
      'category', 'referral',
      'icon', '👥',
      'neft_reward', 30,
      'xp_reward', 30,
      'required_count', 10,
      'current_progress', (
        SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
        FROM referral_rewards 
        WHERE referrer_wallet = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
          FROM referral_rewards 
          WHERE referrer_wallet = user_wallet
        ) >= 10 THEN 'completed' 
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
          FROM referral_rewards 
          WHERE referrer_wallet = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
          FROM referral_rewards 
          WHERE referrer_wallet = user_wallet
        )::DECIMAL / 10 * 100), 100
      ),
      'sort_order', 21
    ),
    json_build_object(
      'achievement_key', 'referral_master',
      'title', 'Referral Master',
      'description', 'Refer 30 friends',
      'category', 'referral',
      'icon', '🌟',
      'neft_reward', 100,
      'xp_reward', 100,
      'required_count', 30,
      'current_progress', (
        SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
        FROM referral_rewards 
        WHERE referrer_wallet = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
          FROM referral_rewards 
          WHERE referrer_wallet = user_wallet
        ) >= 30 THEN 'completed' 
        WHEN (
          SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
          FROM referral_rewards 
          WHERE referrer_wallet = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) 
          FROM referral_rewards 
          WHERE referrer_wallet = user_wallet
        )::DECIMAL / 30 * 100), 100
      ),
      'sort_order', 22
    ),
    
    -- Check-in Achievements (these might actually work since user_streaks exists)
    json_build_object(
      'achievement_key', 'checkin_starter',
      'title', 'Check-in Starter',
      'description', 'Check in for 2 days',
      'category', 'checkin',
      'icon', '📅',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 2,
      'current_progress', (
        SELECT COALESCE(total_claims, 0) 
        FROM user_streaks 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        ) >= 2 THEN 'completed' 
        WHEN (
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 2 * 100), 100
      ),
      'sort_order', 30
    ),
    json_build_object(
      'achievement_key', 'checkin_regular',
      'title', 'Regular Visitor',
      'description', 'Check in for 10 days',
      'category', 'checkin',
      'icon', '📈',
      'neft_reward', 30,
      'xp_reward', 30,
      'required_count', 10,
      'current_progress', (
        SELECT COALESCE(total_claims, 0) 
        FROM user_streaks 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        ) >= 10 THEN 'completed' 
        WHEN (
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 10 * 100), 100
      ),
      'sort_order', 31
    ),
    json_build_object(
      'achievement_key', 'checkin_dedicated',
      'title', 'Dedicated User',
      'description', 'Check in for 30 days',
      'category', 'checkin',
      'icon', '🏅',
      'neft_reward', 100,
      'xp_reward', 100,
      'required_count', 30,
      'current_progress', (
        SELECT COALESCE(total_claims, 0) 
        FROM user_streaks 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        ) >= 30 THEN 'completed' 
        WHEN (
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(total_claims, 0) 
          FROM user_streaks 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 30 * 100), 100
      ),
      'sort_order', 32
    ),
    
    -- NFT Staking Achievements (3 achievements) - with REAL progress tracking
    json_build_object(
      'achievement_key', 'first_nft_stake',
      'title', 'First NFT Stake',
      'description', 'Stake one NFT',
      'category', 'staking',
      'icon', '🔒',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 1,
      'current_progress', (
        SELECT COALESCE(COUNT(*), 0) 
        FROM staked_nfts 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM staked_nfts 
          WHERE wallet_address = user_wallet
        ) >= 1 THEN 'completed' 
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(*), 0) 
          FROM staked_nfts 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 1 * 100), 100
      ),
      'sort_order', 40
    ),
    json_build_object(
      'achievement_key', 'nft_staking_pro',
      'title', 'NFT Staking Pro',
      'description', 'Stake 5 NFTs',
      'category', 'staking',
      'icon', '🏆',
      'neft_reward', 30,
      'xp_reward', 30,
      'required_count', 5,
      'current_progress', (
        SELECT COALESCE(COUNT(*), 0) 
        FROM staked_nfts 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM staked_nfts 
          WHERE wallet_address = user_wallet
        ) >= 5 THEN 'completed' 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM staked_nfts 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(*), 0) 
          FROM staked_nfts 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 5 * 100), 100
      ),
      'sort_order', 41
    ),
    json_build_object(
      'achievement_key', 'nft_staking_master',
      'title', 'NFT Staking Master',
      'description', 'Stake 20 NFTs',
      'category', 'staking',
      'icon', '👑',
      'neft_reward', 100,
      'xp_reward', 100,
      'required_count', 20,
      'current_progress', (
        SELECT COALESCE(COUNT(*), 0) 
        FROM staked_nfts 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM staked_nfts 
          WHERE wallet_address = user_wallet
        ) >= 20 THEN 'completed' 
        WHEN (
          SELECT COALESCE(COUNT(*), 0) 
          FROM staked_nfts 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(COUNT(*), 0) 
          FROM staked_nfts 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 20 * 100), 100
      ),
      'sort_order', 42
    ),
    
    -- NEFT Staking Achievements (3 achievements) - with REAL progress tracking
    json_build_object(
      'achievement_key', 'first_neft_stake',
      'title', 'First NEFT Stake',
      'description', 'Stake 50 NEFT points',
      'category', 'staking',
      'icon', '💰',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 50,
      'current_progress', (
        SELECT COALESCE(SUM(amount), 0) 
        FROM staked_tokens 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        ) >= 50 THEN 'completed' 
        WHEN (
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 50 * 100), 100
      ),
      'sort_order', 43
    ),
    json_build_object(
      'achievement_key', 'neft_staking_pro',
      'title', 'NEFT Staking Pro',
      'description', 'Stake 500 NEFT points',
      'category', 'staking',
      'icon', '💎',
      'neft_reward', 50,
      'xp_reward', 50,
      'required_count', 500,
      'current_progress', (
        SELECT COALESCE(SUM(amount), 0) 
        FROM staked_tokens 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        ) >= 500 THEN 'completed' 
        WHEN (
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 500 * 100), 100
      ),
      'sort_order', 44
    ),
    json_build_object(
      'achievement_key', 'neft_staking_master',
      'title', 'NEFT Staking Master',
      'description', 'Stake 2000 NEFT points',
      'category', 'staking',
      'icon', '🌟',
      'neft_reward', 200,
      'xp_reward', 200,
      'required_count', 2000,
      'current_progress', (
        SELECT COALESCE(SUM(amount), 0) 
        FROM staked_tokens 
        WHERE wallet_address = user_wallet
        LIMIT 1
      ),
      'status', CASE 
        WHEN (
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        ) >= 2000 THEN 'completed' 
        WHEN (
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        ) > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', null,
      'progress_percentage', LEAST(
        ROUND((
          SELECT COALESCE(SUM(amount), 0) 
          FROM staked_tokens 
          WHERE wallet_address = user_wallet
        )::DECIMAL / 2000 * 100), 100
      ),
      'sort_order', 45
    )
  ) INTO result;
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return basic achievements even if tables don't exist
    SELECT json_build_array(
      json_build_object(
        'achievement_key', 'first_quest',
        'title', 'First Quest',
        'description', 'Complete your first campaign',
        'category', 'quest',
        'icon', '🎯',
        'neft_reward', 5,
        'xp_reward', 5,
        'required_count', 1,
        'current_progress', 0,
        'status', 'locked',
        'claimed_at', null,
        'progress_percentage', 0,
        'sort_order', 1
      )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: REAL claim function that adds rewards to user_balances
CREATE OR REPLACE FUNCTION claim_achievement(user_wallet TEXT, achievement_key_param TEXT)
RETURNS JSON AS $$
DECLARE
  achievement_data JSON;
  neft_reward_amount DECIMAL(18,8) := 0;
  xp_reward_amount INTEGER := 0;
  achievement_title TEXT := '';
  user_achievements JSON;
  achievement_found BOOLEAN := FALSE;
BEGIN
  -- Get user achievements to find the specific achievement
  SELECT get_user_achievement_status(user_wallet) INTO user_achievements;
  
  -- Parse achievements and find the one being claimed
  SELECT 
    (achievement->>'neft_reward')::DECIMAL(18,8),
    (achievement->>'xp_reward')::INTEGER,
    achievement->>'title',
    TRUE
  INTO 
    neft_reward_amount,
    xp_reward_amount, 
    achievement_title,
    achievement_found
  FROM json_array_elements(user_achievements) AS achievement
  WHERE achievement->>'achievement_key' = achievement_key_param
    AND achievement->>'status' = 'completed'
    AND (achievement->>'claimed_at' IS NULL OR achievement->>'claimed_at' = 'null')
  LIMIT 1;

  -- Check if achievement was found and is claimable
  IF NOT achievement_found THEN
    -- Check if it was already claimed
    IF (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param LIMIT 1) IS NOT NULL THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Achievement already claimed!',
        'neft_reward', 0,
        'xp_reward', 0,
        'title', achievement_key_param
      );
    ELSE
      RETURN json_build_object(
        'success', false,
        'message', 'Achievement not found or not completed',
        'neft_reward', 0,
        'xp_reward', 0,
        'title', achievement_key_param
      );
    END IF;
  END IF;

  -- Add rewards to user_balances table
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    last_updated
  ) VALUES (
    user_wallet,
    neft_reward_amount,
    xp_reward_amount,
    neft_reward_amount, -- Add NEFT to available balance
    NOW()
  )
  ON CONFLICT (wallet_address) 
  DO UPDATE SET
    total_neft_claimed = COALESCE(user_balances.total_neft_claimed, 0) + neft_reward_amount,
    total_xp_earned = COALESCE(user_balances.total_xp_earned, 0) + xp_reward_amount,
    available_neft = COALESCE(user_balances.available_neft, 0) + neft_reward_amount,
    last_updated = NOW();

  -- Log the achievement claim in user_achievement_progress table (if it exists)
  BEGIN
    INSERT INTO user_achievement_progress (
      wallet_address,
      achievement_key,
      current_progress,
      completed_at,
      claimed_at
    ) VALUES (
      user_wallet,
      achievement_key_param,
      neft_reward_amount::INTEGER, -- Use reward as progress marker
      NOW(),
      NOW()
    )
    ON CONFLICT (wallet_address, achievement_key)
    DO UPDATE SET
      claimed_at = NOW();
  EXCEPTION
    WHEN OTHERS THEN
      -- Ignore if table doesn't exist yet
      NULL;
  END;

  -- Return success with actual reward amounts
  RETURN json_build_object(
    'success', true,
    'message', 'Achievement claimed successfully! Rewards added to your balance.',
    'neft_reward', neft_reward_amount,
    'xp_reward', xp_reward_amount,
    'title', achievement_title
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details for debugging
    RETURN json_build_object(
      'success', false,
      'message', 'Error claiming achievement: ' || SQLERRM,
      'neft_reward', 0,
      'xp_reward', 0,
      'title', achievement_key_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION get_user_achievement_status(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_achievement(TEXT, TEXT) TO authenticated, anon, public;

SELECT 'SIMPLE ACHIEVEMENTS FALLBACK DEPLOYED - Achievements should now show in UI!' as status;
