-- ============================================================================
-- QUICK FIX: Prevent Multiple Achievement Claims 
-- ============================================================================
-- This fixes the achievement claiming system to prevent multiple claims
-- by updating the function to properly track claimed achievements
-- ============================================================================

-- Step 1: Ensure user_achievement_progress table exists
CREATE TABLE IF NOT EXISTS user_achievement_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  current_progress INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(wallet_address, achievement_key)
);

-- Step 2: Create a simple helper function to check if achievement is claimed
CREATE OR REPLACE FUNCTION is_achievement_claimed(user_wallet TEXT, achievement_key_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT claimed_at FROM user_achievement_progress 
    WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param
    LIMIT 1
  ) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Updated claim function with proper claim prevention
CREATE OR REPLACE FUNCTION claim_achievement(user_wallet TEXT, achievement_key_param TEXT)
RETURNS JSON AS $$
DECLARE
  achievement_data JSON;
  neft_reward_amount DECIMAL(18,8) := 0;
  xp_reward_amount INTEGER := 0;
  achievement_title TEXT := '';
  is_already_claimed BOOLEAN := FALSE;
  campaign_count INTEGER := 0;
  burn_count INTEGER := 0;
  referral_count INTEGER := 0;
  checkin_count INTEGER := 0;
  staked_nfts_count INTEGER := 0;
  staked_tokens_amount DECIMAL(18,8) := 0;
  is_completed BOOLEAN := FALSE;
BEGIN
  -- STEP 1: Check if already claimed
  SELECT is_achievement_claimed(user_wallet, achievement_key_param) INTO is_already_claimed;
  
  IF is_already_claimed THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement already claimed!',
      'neft_reward', 0,
      'xp_reward', 0,
      'title', achievement_key_param
    );
  END IF;

  -- STEP 2: Get user activity data
  SELECT 
    COALESCE(COUNT(DISTINCT project_id), 0)
  INTO campaign_count
  FROM campaign_reward_claims 
  WHERE wallet_address = user_wallet;

  SELECT 
    COALESCE(COUNT(*), 0)
  INTO burn_count
  FROM burn_transactions 
  WHERE wallet_address = user_wallet;

  SELECT 
    COALESCE(COUNT(DISTINCT referred_wallet), 0)
  INTO referral_count
  FROM referral_rewards 
  WHERE referrer_wallet = user_wallet;

  SELECT 
    COALESCE(total_claims, 0)
  INTO checkin_count
  FROM user_streaks 
  WHERE wallet_address = user_wallet
  LIMIT 1;

  SELECT 
    COALESCE(COUNT(*), 0)
  INTO staked_nfts_count
  FROM staked_nfts 
  WHERE wallet_address = user_wallet;

  SELECT 
    COALESCE(SUM(amount), 0)
  INTO staked_tokens_amount
  FROM staked_tokens 
  WHERE wallet_address = user_wallet;

  -- STEP 3: Check if achievement is completed and get rewards
  CASE achievement_key_param
    -- Quest achievements
    WHEN 'first_quest' THEN
      IF campaign_count >= 1 THEN
        is_completed := TRUE;
        neft_reward_amount := 5;
        xp_reward_amount := 5;
        achievement_title := 'First Quest';
      END IF;
    WHEN 'quest_legend' THEN
      IF campaign_count >= 10 THEN
        is_completed := TRUE;
        neft_reward_amount := 70;
        xp_reward_amount := 70;
        achievement_title := 'Quest Legend';
      END IF;
    WHEN 'quest_master' THEN
      IF campaign_count >= 25 THEN
        is_completed := TRUE;
        neft_reward_amount := 150;
        xp_reward_amount := 150;
        achievement_title := 'Quest Master';
      END IF;
    
    -- Burn achievements
    WHEN 'first_burn' THEN
      IF burn_count >= 1 THEN
        is_completed := TRUE;
        neft_reward_amount := 5;
        xp_reward_amount := 5;
        achievement_title := 'First Burn';
      END IF;
    WHEN 'platinum_creator' THEN
      IF burn_count >= 15 THEN
        is_completed := TRUE;
        neft_reward_amount := 30;
        xp_reward_amount := 30;
        achievement_title := 'Platinum Creator';
      END IF;
    WHEN 'silver_master' THEN
      IF burn_count >= 40 THEN
        is_completed := TRUE;
        neft_reward_amount := 80;
        xp_reward_amount := 80;
        achievement_title := 'Silver Master';
      END IF;
    
    -- Referral achievements
    WHEN 'first_referral' THEN
      IF referral_count >= 1 THEN
        is_completed := TRUE;
        neft_reward_amount := 5;
        xp_reward_amount := 5;
        achievement_title := 'First Referral';
      END IF;
    WHEN 'referral_pro' THEN
      IF referral_count >= 10 THEN
        is_completed := TRUE;
        neft_reward_amount := 30;
        xp_reward_amount := 30;
        achievement_title := 'Referral Pro';
      END IF;
    WHEN 'referral_master' THEN
      IF referral_count >= 30 THEN
        is_completed := TRUE;
        neft_reward_amount := 100;
        xp_reward_amount := 100;
        achievement_title := 'Referral Master';
      END IF;
    
    -- Checkin achievements
    WHEN 'checkin_starter' THEN
      IF checkin_count >= 2 THEN
        is_completed := TRUE;
        neft_reward_amount := 5;
        xp_reward_amount := 5;
        achievement_title := 'Check-in Starter';
      END IF;
    WHEN 'checkin_regular' THEN
      IF checkin_count >= 10 THEN
        is_completed := TRUE;
        neft_reward_amount := 30;
        xp_reward_amount := 30;
        achievement_title := 'Regular Visitor';
      END IF;
    WHEN 'checkin_dedicated' THEN
      IF checkin_count >= 30 THEN
        is_completed := TRUE;
        neft_reward_amount := 100;
        xp_reward_amount := 100;
        achievement_title := 'Dedicated User';
      END IF;
    
    -- NFT staking achievements
    WHEN 'first_nft_stake' THEN
      IF staked_nfts_count >= 1 THEN
        is_completed := TRUE;
        neft_reward_amount := 5;
        xp_reward_amount := 5;
        achievement_title := 'First NFT Stake';
      END IF;
    WHEN 'nft_staking_pro' THEN
      IF staked_nfts_count >= 5 THEN
        is_completed := TRUE;
        neft_reward_amount := 30;
        xp_reward_amount := 30;
        achievement_title := 'NFT Staking Pro';
      END IF;
    WHEN 'nft_staking_master' THEN
      IF staked_nfts_count >= 20 THEN
        is_completed := TRUE;
        neft_reward_amount := 100;
        xp_reward_amount := 100;
        achievement_title := 'NFT Staking Master';
      END IF;
    
    -- NEFT staking achievements
    WHEN 'first_neft_stake' THEN
      IF staked_tokens_amount >= 50 THEN
        is_completed := TRUE;
        neft_reward_amount := 5;
        xp_reward_amount := 5;
        achievement_title := 'First NEFT Stake';
      END IF;
    WHEN 'neft_staking_pro' THEN
      IF staked_tokens_amount >= 500 THEN
        is_completed := TRUE;
        neft_reward_amount := 50;
        xp_reward_amount := 50;
        achievement_title := 'NEFT Staking Pro';
      END IF;
    WHEN 'neft_staking_master' THEN
      IF staked_tokens_amount >= 2000 THEN
        is_completed := TRUE;
        neft_reward_amount := 200;
        xp_reward_amount := 200;
        achievement_title := 'NEFT Staking Master';
      END IF;
    
    ELSE
      -- Unknown achievement
      is_completed := FALSE;
  END CASE;

  -- STEP 4: Check if achievement is completed
  IF NOT is_completed THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement not completed yet',
      'neft_reward', 0,
      'xp_reward', 0,
      'title', achievement_key_param
    );
  END IF;

  -- STEP 5: Add rewards to user_balances table
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

  -- STEP 6: Mark achievement as claimed
  INSERT INTO user_achievement_progress (
    wallet_address,
    achievement_key,
    current_progress,
    completed_at,
    claimed_at
  ) VALUES (
    user_wallet,
    achievement_key_param,
    neft_reward_amount::INTEGER,
    NOW(),
    NOW()
  )
  ON CONFLICT (wallet_address, achievement_key)
  DO UPDATE SET
    claimed_at = NOW();

  -- STEP 7: Return success
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

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION is_achievement_claimed(TEXT, TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_achievement(TEXT, TEXT) TO authenticated, anon, public;

SELECT 'QUICK FIX: Achievement claiming system updated - each achievement can only be claimed once!' as status;
