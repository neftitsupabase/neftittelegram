-- ============================================================================
-- FIX ACHIEVEMENT UI STATUS - Show "Claimed" in UI
-- ============================================================================
-- This updates the get_user_achievement_status function to properly return
-- claimed status so the UI can show "Claimed" button correctly
-- ============================================================================

-- Update get_user_achievement_status to show claimed status properly
CREATE OR REPLACE FUNCTION get_user_achievement_status(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  campaign_count INTEGER := 0;
  burn_count INTEGER := 0;
  referral_count INTEGER := 0;
  checkin_count INTEGER := 0;
  staked_nfts_count INTEGER := 0;
  staked_tokens_amount DECIMAL(18,8) := 0;
BEGIN
  -- Get user activity data once
  SELECT COALESCE(COUNT(DISTINCT project_id), 0) INTO campaign_count FROM campaign_reward_claims WHERE wallet_address = user_wallet;
  SELECT COALESCE(COUNT(*), 0) INTO burn_count FROM burn_transactions WHERE wallet_address = user_wallet;
  SELECT COALESCE(COUNT(DISTINCT referred_wallet), 0) INTO referral_count FROM referral_rewards WHERE referrer_wallet = user_wallet;
  SELECT COALESCE(total_claims, 0) INTO checkin_count FROM user_streaks WHERE wallet_address = user_wallet LIMIT 1;
  SELECT COALESCE(COUNT(*), 0) INTO staked_nfts_count FROM staked_nfts WHERE wallet_address = user_wallet;
  SELECT COALESCE(SUM(amount), 0) INTO staked_tokens_amount FROM staked_tokens WHERE wallet_address = user_wallet;

  SELECT json_build_array(
    -- Quest Achievements
    json_build_object(
      'achievement_key', 'first_quest',
      'title', 'First Quest',
      'description', 'Complete your first campaign',
      'category', 'quest',
      'icon', '🎯',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 1,
      'current_progress', campaign_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'first_quest') THEN 'claimed'
        WHEN campaign_count >= 1 THEN 'completed' 
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'first_quest' LIMIT 1),
      'progress_percentage', LEAST(ROUND(campaign_count::DECIMAL / 1 * 100), 100),
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
      'current_progress', campaign_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'quest_legend') THEN 'claimed'
        WHEN campaign_count >= 10 THEN 'completed' 
        WHEN campaign_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'quest_legend' LIMIT 1),
      'progress_percentage', LEAST(ROUND(campaign_count::DECIMAL / 10 * 100), 100),
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
      'current_progress', campaign_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'quest_master') THEN 'claimed'
        WHEN campaign_count >= 25 THEN 'completed' 
        WHEN campaign_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'quest_master' LIMIT 1),
      'progress_percentage', LEAST(ROUND(campaign_count::DECIMAL / 25 * 100), 100),
      'sort_order', 3
    ),
    
    -- Burn Achievements
    json_build_object(
      'achievement_key', 'first_burn',
      'title', 'First Burn',
      'description', 'Complete your first burn transaction',
      'category', 'burn',
      'icon', '🔥',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 1,
      'current_progress', burn_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'first_burn') THEN 'claimed'
        WHEN burn_count >= 1 THEN 'completed' 
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'first_burn' LIMIT 1),
      'progress_percentage', LEAST(ROUND(burn_count::DECIMAL / 1 * 100), 100),
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
      'current_progress', burn_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'platinum_creator') THEN 'claimed'
        WHEN burn_count >= 15 THEN 'completed' 
        WHEN burn_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'platinum_creator' LIMIT 1),
      'progress_percentage', LEAST(ROUND(burn_count::DECIMAL / 15 * 100), 100),
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
      'current_progress', burn_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'silver_master') THEN 'claimed'
        WHEN burn_count >= 40 THEN 'completed' 
        WHEN burn_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'silver_master' LIMIT 1),
      'progress_percentage', LEAST(ROUND(burn_count::DECIMAL / 40 * 100), 100),
      'sort_order', 12
    ),
    
    -- Referral Achievements
    json_build_object(
      'achievement_key', 'first_referral',
      'title', 'First Referral',
      'description', 'Refer your first friend',
      'category', 'referral',
      'icon', '🤝',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 1,
      'current_progress', referral_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'first_referral') THEN 'claimed'
        WHEN referral_count >= 1 THEN 'completed' 
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'first_referral' LIMIT 1),
      'progress_percentage', LEAST(ROUND(referral_count::DECIMAL / 1 * 100), 100),
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
      'current_progress', referral_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'referral_pro') THEN 'claimed'
        WHEN referral_count >= 10 THEN 'completed' 
        WHEN referral_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'referral_pro' LIMIT 1),
      'progress_percentage', LEAST(ROUND(referral_count::DECIMAL / 10 * 100), 100),
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
      'current_progress', referral_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'referral_master') THEN 'claimed'
        WHEN referral_count >= 30 THEN 'completed' 
        WHEN referral_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'referral_master' LIMIT 1),
      'progress_percentage', LEAST(ROUND(referral_count::DECIMAL / 30 * 100), 100),
      'sort_order', 22
    ),
    
    -- Check-in Achievements
    json_build_object(
      'achievement_key', 'checkin_starter',
      'title', 'Check-in Starter',
      'description', 'Check in for 2 days',
      'category', 'checkin',
      'icon', '📅',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 2,
      'current_progress', checkin_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'checkin_starter') THEN 'claimed'
        WHEN checkin_count >= 2 THEN 'completed' 
        WHEN checkin_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'checkin_starter' LIMIT 1),
      'progress_percentage', LEAST(ROUND(checkin_count::DECIMAL / 2 * 100), 100),
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
      'current_progress', checkin_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'checkin_regular') THEN 'claimed'
        WHEN checkin_count >= 10 THEN 'completed' 
        WHEN checkin_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'checkin_regular' LIMIT 1),
      'progress_percentage', LEAST(ROUND(checkin_count::DECIMAL / 10 * 100), 100),
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
      'current_progress', checkin_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'checkin_dedicated') THEN 'claimed'
        WHEN checkin_count >= 30 THEN 'completed' 
        WHEN checkin_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'checkin_dedicated' LIMIT 1),
      'progress_percentage', LEAST(ROUND(checkin_count::DECIMAL / 30 * 100), 100),
      'sort_order', 32
    ),
    
    -- NFT Staking Achievements
    json_build_object(
      'achievement_key', 'first_nft_stake',
      'title', 'First NFT Stake',
      'description', 'Stake one NFT',
      'category', 'staking',
      'icon', '🔒',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 1,
      'current_progress', staked_nfts_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'first_nft_stake') THEN 'claimed'
        WHEN staked_nfts_count >= 1 THEN 'completed' 
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'first_nft_stake' LIMIT 1),
      'progress_percentage', LEAST(ROUND(staked_nfts_count::DECIMAL / 1 * 100), 100),
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
      'current_progress', staked_nfts_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'nft_staking_pro') THEN 'claimed'
        WHEN staked_nfts_count >= 5 THEN 'completed' 
        WHEN staked_nfts_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'nft_staking_pro' LIMIT 1),
      'progress_percentage', LEAST(ROUND(staked_nfts_count::DECIMAL / 5 * 100), 100),
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
      'current_progress', staked_nfts_count,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'nft_staking_master') THEN 'claimed'
        WHEN staked_nfts_count >= 20 THEN 'completed' 
        WHEN staked_nfts_count > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'nft_staking_master' LIMIT 1),
      'progress_percentage', LEAST(ROUND(staked_nfts_count::DECIMAL / 20 * 100), 100),
      'sort_order', 42
    ),
    
    -- NEFT Staking Achievements
    json_build_object(
      'achievement_key', 'first_neft_stake',
      'title', 'First NEFT Stake',
      'description', 'Stake 50 NEFT points',
      'category', 'staking',
      'icon', '💰',
      'neft_reward', 5,
      'xp_reward', 5,
      'required_count', 50,
      'current_progress', staked_tokens_amount,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'first_neft_stake') THEN 'claimed'
        WHEN staked_tokens_amount >= 50 THEN 'completed' 
        WHEN staked_tokens_amount > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'first_neft_stake' LIMIT 1),
      'progress_percentage', LEAST(ROUND(staked_tokens_amount::DECIMAL / 50 * 100), 100),
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
      'current_progress', staked_tokens_amount,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'neft_staking_pro') THEN 'claimed'
        WHEN staked_tokens_amount >= 500 THEN 'completed' 
        WHEN staked_tokens_amount > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'neft_staking_pro' LIMIT 1),
      'progress_percentage', LEAST(ROUND(staked_tokens_amount::DECIMAL / 500 * 100), 100),
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
      'current_progress', staked_tokens_amount,
      'status', CASE 
        WHEN is_achievement_claimed(user_wallet, 'neft_staking_master') THEN 'claimed'
        WHEN staked_tokens_amount >= 2000 THEN 'completed' 
        WHEN staked_tokens_amount > 0 THEN 'in_progress'
        ELSE 'locked' 
      END,
      'claimed_at', (SELECT claimed_at FROM user_achievement_progress WHERE wallet_address = user_wallet AND achievement_key = 'neft_staking_master' LIMIT 1),
      'progress_percentage', LEAST(ROUND(staked_tokens_amount::DECIMAL / 2000 * 100), 100),
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_achievement_status(TEXT) TO authenticated, anon, public;

SELECT 'FIX COMPLETE: UI will now show "claimed" status properly after claiming!' as status;
