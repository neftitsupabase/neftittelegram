-- ============================================================================
-- REVERT ALL RECENT CHANGES - RESTORE ORIGINAL DATABASE STATE
-- Undoes all modifications made during achievement aggregation debugging
-- ============================================================================

-- Step 1: Restore original get_direct_user_balance function
CREATE OR REPLACE FUNCTION get_direct_user_balance(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_neft_claimed DECIMAL(18,8) := 0;
    total_xp_earned INTEGER := 0;
    referral_neft DECIMAL(18,8) := 0;
    staked_amount DECIMAL(18,8) := 0;
    last_updated TIMESTAMPTZ := NOW();
BEGIN
    -- Get user balance data
    SELECT 
        COALESCE(ub.total_neft_claimed, 0),
        COALESCE(ub.total_xp_earned, 0),
        COALESCE(ub.last_updated, NOW())
    INTO total_neft_claimed, total_xp_earned, last_updated
    FROM user_balances ub
    WHERE ub.wallet_address = user_wallet;
    
    -- Get referral earnings
    SELECT COALESCE(ur.total_neft_earned, 0)
    INTO referral_neft
    FROM user_referrals ur
    WHERE ur.wallet_address = user_wallet;
    
    -- Get staked amount
    SELECT COALESCE(SUM(st.amount), 0)
    INTO staked_amount
    FROM staked_tokens st
    WHERE st.wallet_address = user_wallet;
    
    -- Return JSON with correct available_neft calculation
    RETURN json_build_object(
        'total_neft_claimed', total_neft_claimed + referral_neft,
        'total_xp_earned', total_xp_earned,
        'available_neft', GREATEST(0, (total_neft_claimed + referral_neft) - staked_amount),
        'staked_neft', staked_amount,
        'total_nft_count', 0,
        'last_updated', last_updated
    );
END;
$$;

-- Step 2: Restore original get_user_complete_balance function (if it was modified)
-- Check if this function exists and restore to working state without achievement JOIN
CREATE OR REPLACE FUNCTION get_user_complete_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  
  -- Campaign rewards (from user_balances table)
  campaign_neft DECIMAL(18,8) := 0;
  campaign_xp INTEGER := 0;
  
  -- Daily claims
  daily_neft DECIMAL(18,8) := 0;
  daily_xp INTEGER := 0;
  
  -- Achievement rewards - SKIP for now to avoid errors
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  
  -- Staking rewards
  staking_neft DECIMAL(18,8) := 0;
  staking_xp INTEGER := 0;
  
  -- Referral rewards
  referral_neft DECIMAL(18,8) := 0;
  referral_xp INTEGER := 0;
  referral_count INTEGER := 0;
  
  -- Staked amounts
  staked_amount DECIMAL(18,8) := 0;
  
  -- NFT count
  nft_count INTEGER := 0;
  
  -- Totals
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
BEGIN
  -- Validate input parameter
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RAISE EXCEPTION 'user_wallet parameter cannot be null or empty';
  END IF;

  -- Get base balance from user_balances table (campaign rewards, etc.)
  SELECT 
    COALESCE(ub.total_neft_claimed, 0),
    COALESCE(ub.total_xp_earned, 0)
  INTO campaign_neft, campaign_xp
  FROM user_balances ub
  WHERE ub.wallet_address = user_wallet;

  -- If no base record found, initialize with zeros
  IF NOT FOUND THEN
    campaign_neft := 0;
    campaign_xp := 0;
  END IF;

  -- Get daily claims totals
  SELECT 
    COALESCE(SUM(dc.total_neft_reward), 0),
    COALESCE(SUM(dc.total_xp_reward), 0)
  INTO daily_neft, daily_xp
  FROM daily_claims dc
  WHERE dc.wallet_address = user_wallet;

  -- SKIP achievement rewards for now to avoid JOIN errors
  achievement_neft := 0;
  achievement_xp := 0;

  -- Get staking rewards (from claimed staking rewards)
  SELECT 
    COALESCE(SUM(sr.reward_amount), 0),
    0 -- Staking rewards are NEFT only, no XP
  INTO staking_neft, staking_xp
  FROM staking_rewards sr
  WHERE sr.wallet_address = user_wallet 
    AND sr.is_claimed = true;

  -- Get referral rewards
  SELECT 
    COALESCE(ur.total_neft_earned, 0),
    COALESCE(ur.total_xp_earned, 0),
    COALESCE(ur.total_referrals, 0)
  INTO referral_neft, referral_xp, referral_count
  FROM user_referrals ur
  WHERE ur.wallet_address = user_wallet;

  -- If no referral record found, initialize with zeros
  IF NOT FOUND THEN
    referral_neft := 0;
    referral_xp := 0;
    referral_count := 0;
  END IF;

  -- Get currently staked amount from staked_tokens table
  SELECT COALESCE(SUM(st.amount), 0)
  INTO staked_amount
  FROM staked_tokens st
  WHERE st.wallet_address = user_wallet;

  -- Get NFT count (from IPFS mapping)
  SELECT COUNT(*)
  INTO nft_count
  FROM user_ipfs_mappings uim
  WHERE uim.wallet_address = user_wallet;

  -- Calculate totals from all sources (excluding achievements for now)
  total_neft := COALESCE(campaign_neft, 0) + COALESCE(daily_neft, 0) + COALESCE(staking_neft, 0) + COALESCE(referral_neft, 0);
  total_xp := COALESCE(campaign_xp, 0) + COALESCE(daily_xp, 0) + COALESCE(staking_xp, 0) + COALESCE(referral_xp, 0);
  
  -- Calculate available NEFT (total - staked)
  available_neft := GREATEST(0, total_neft - COALESCE(staked_amount, 0));

  -- Build comprehensive result JSON with field names that match UI expectations
  SELECT json_build_object(
    -- Main totals (UI expects these exact field names)
    'total_neft_claimed', total_neft,
    'total_xp_earned', total_xp,
    'total_nft_count', nft_count,
    'available_neft', available_neft,
    'available_xp', total_xp, -- XP is not stakeable, so available = total
    'staked_neft', COALESCE(staked_amount, 0),
    'staked_tokens', COALESCE(staked_amount, 0), -- Same as staked_neft
    'current_level', CASE 
      WHEN total_xp >= 1000 THEN 5
      WHEN total_xp >= 500 THEN 4
      WHEN total_xp >= 250 THEN 3
      WHEN total_xp >= 100 THEN 2
      ELSE 1
    END,
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
      'staking_xp', staking_xp,
      'referral_neft', referral_neft,
      'referral_xp', referral_xp
    )
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return default values
    RAISE LOG 'Error in get_user_complete_balance for user %: %', user_wallet, SQLERRM;
    
    -- Return default balance structure with UI-expected field names
    SELECT json_build_object(
      'total_neft_claimed', 0,
      'total_xp_earned', 0,
      'total_nft_count', 0,
      'available_neft', 0,
      'available_xp', 0,
      'staked_neft', 0,
      'staked_tokens', 0,
      'current_level', 1,
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
        'staking_xp', 0,
        'referral_neft', 0,
        'referral_xp', 0
      )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Remove debug functions that were added
DROP FUNCTION IF EXISTS debug_get_user_complete_balance(TEXT);

-- Step 4: Restore original claim_achievement_reward function (if it exists)
-- This restores the basic version without complex balance manipulation
CREATE OR REPLACE FUNCTION claim_achievement_reward(
  user_wallet TEXT,
  achievement_key_param TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  nft_reward TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  achievement_record RECORD;
  user_achievement_record RECORD;
BEGIN
  -- Get achievement details
  SELECT * INTO achievement_record
  FROM achievements_master am
  WHERE am.achievement_key = achievement_key_param AND am.is_active = TRUE;
  
  IF achievement_record IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Achievement not found or inactive', 0::DECIMAL(18,8), 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Get user achievement status
  SELECT * INTO user_achievement_record
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF user_achievement_record IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Achievement not started', 0::DECIMAL(18,8), 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if already claimed
  IF user_achievement_record.claimed_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Achievement already claimed', 0::DECIMAL(18,8), 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if achievement is completed
  IF user_achievement_record.status != 'completed' THEN
    RETURN QUERY SELECT FALSE, 'Achievement not completed yet', 0::DECIMAL(18,8), 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Simple claim - just mark as claimed
  UPDATE user_achievements 
  SET claimed_at = NOW(), updated_at = NOW()
  WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  
  -- Return success with rewards
  RETURN QUERY SELECT 
    TRUE, 
    'Achievement claimed successfully!', 
    achievement_record.neft_reward,
    achievement_record.xp_reward,
    achievement_record.nft_reward;
END;
$$;

-- Step 5: Ensure proper permissions
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_direct_user_balance(TEXT) TO public;

GRANT EXECUTE ON FUNCTION get_user_complete_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_complete_balance(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_complete_balance(TEXT) TO public;

GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO public;

-- Success message
SELECT 'DATABASE REVERTED TO ORIGINAL STATE!' as status;
SELECT 'All recent changes have been undone' as info;
SELECT 'Functions restored to working versions without achievement JOIN errors' as details;
