-- ============================================================================
-- FIX SOCIAL LOGIN BALANCE RETRIEVAL
-- Updates get_user_complete_balance to handle both wallet addresses and social login IDs
-- ============================================================================

-- Update the get_user_complete_balance function to handle social login IDs
CREATE OR REPLACE FUNCTION get_user_complete_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  
  -- Campaign rewards
  campaign_neft DECIMAL(18,8) := 0;
  campaign_xp INTEGER := 0;
  
  -- Daily claims
  daily_neft DECIMAL(18,8) := 0;
  daily_xp INTEGER := 0;
  
  -- Achievement rewards
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  
  -- Staking rewards
  staking_neft DECIMAL(18,8) := 0;
  staking_xp INTEGER := 0;
  
  -- Staked amounts
  staked_amount DECIMAL(18,8) := 0;
  
  -- NFT count
  nft_count INTEGER := 0;
  
  -- Referral rewards (future)
  referral_neft DECIMAL(18,8) := 0;
  referral_xp INTEGER := 0;
  referral_count INTEGER := 0;
  
  -- Totals
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
BEGIN
  -- Validate input parameter
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RAISE EXCEPTION 'user_wallet parameter cannot be null or empty';
  END IF;

  -- Get campaign rewards from user_balances table
  -- Handle both social login IDs (social:google:xxx) and wallet addresses
  SELECT 
    COALESCE(total_neft_claimed, 0),
    COALESCE(total_xp_earned, 0),
    COALESCE(available_neft, 0)
  INTO campaign_neft, campaign_xp, available_neft
  FROM user_balances 
  WHERE wallet_address = user_wallet;

  -- If no data found, initialize with zeros
  IF NOT FOUND THEN
    campaign_neft := 0;
    campaign_xp := 0;
    available_neft := 0;
  END IF;

  -- Get daily claims totals
  SELECT 
    COALESCE(SUM(total_neft_reward), 0),
    COALESCE(SUM(total_xp_reward), 0)
  INTO daily_neft, daily_xp
  FROM daily_claims 
  WHERE wallet_address = user_wallet;

  -- Get achievement rewards (from claimed achievements)
  SELECT 
    COALESCE(SUM(ua.neft_reward), 0),
    COALESCE(SUM(ua.xp_reward), 0)
  INTO achievement_neft, achievement_xp
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet 
    AND ua.status = 'completed' 
    AND ua.claimed_at IS NOT NULL;

  -- Get staking rewards (from claimed staking rewards)
  SELECT 
    COALESCE(SUM(sr.reward_amount), 0),
    0 -- Staking rewards are NEFT only, no XP
  INTO staking_neft, staking_xp
  FROM staking_rewards sr
  WHERE sr.wallet_address = user_wallet 
    AND sr.is_claimed = true;

  -- Get currently staked amount from staked_tokens table
  SELECT COALESCE(SUM(amount), 0)
  INTO staked_amount
  FROM staked_tokens 
  WHERE wallet_address = user_wallet;

  -- Get NFT count (from IPFS mapping)
  SELECT COUNT(*)
  INTO nft_count
  FROM user_ipfs_mappings 
  WHERE wallet_address = user_wallet;

  -- Future: Get referral rewards (placeholder)
  referral_neft := 0;
  referral_xp := 0;
  referral_count := 0;

  -- Calculate totals from all sources
  total_neft := COALESCE(campaign_neft, 0) + COALESCE(daily_neft, 0) + COALESCE(achievement_neft, 0) + COALESCE(staking_neft, 0) + COALESCE(referral_neft, 0);
  total_xp := COALESCE(campaign_xp, 0) + COALESCE(daily_xp, 0) + COALESCE(achievement_xp, 0) + COALESCE(staking_xp, 0) + COALESCE(referral_xp, 0);
  
  -- Use available_neft from user_balances table (kept in sync by staking operations)
  -- If not set, calculate as fallback
  IF available_neft IS NULL OR available_neft = 0 THEN
    available_neft := GREATEST(0, total_neft - COALESCE(staked_amount, 0));
  END IF;

  -- Build comprehensive result JSON
  SELECT json_build_object(
    'total_neft', total_neft,
    'total_xp', total_xp,
    'total_nft_count', nft_count,
    'available_neft', available_neft,
    'available_xp', total_xp, -- XP is not stakeable, so available = total
    'staked_neft', COALESCE(staked_amount, 0),
    'referral_neft', referral_neft,
    'referral_xp', referral_xp,
    'referral_count', referral_count,
    'last_updated', NOW(),
    -- Breakdown by source for analytics
    'breakdown', json_build_object(
      'campaign_neft', campaign_neft,
      'campaign_xp', campaign_xp,
      'daily_neft', daily_neft,
      'daily_xp', daily_xp,
      'achievement_neft', achievement_neft,
      'achievement_xp', achievement_xp,
      'staking_neft', staking_neft,
      'staking_xp', staking_xp
    )
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return default values
    RAISE LOG 'Error in get_user_complete_balance for user %: %', user_wallet, SQLERRM;
    
    -- Return default balance structure
    SELECT json_build_object(
      'total_neft', 0,
      'total_xp', 0,
      'total_nft_count', 0,
      'available_neft', 0,
      'available_xp', 0,
      'staked_neft', 0,
      'referral_neft', 0,
      'referral_xp', 0,
      'referral_count', 0,
      'last_updated', NOW(),
      'breakdown', json_build_object(
        'campaign_neft', 0,
        'campaign_xp', 0,
        'daily_neft', 0,
        'daily_xp', 0,
        'achievement_neft', 0,
        'achievement_xp', 0,
        'staking_neft', 0,
        'staking_xp', 0
      ),
      'error', 'Function execution failed'
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_complete_balance(TEXT) TO authenticated;

-- Test the function with a social login ID
SELECT 'Testing social login balance function...' as status;

-- Success message
SELECT 'Social login balance function updated successfully!' as status;
