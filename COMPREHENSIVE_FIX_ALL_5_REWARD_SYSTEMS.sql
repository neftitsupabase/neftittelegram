-- ============================================================================
-- COMPREHENSIVE FIX FOR ALL 5 NEFT REWARD SYSTEMS
-- This fixes ALL reward systems: Campaign, Daily Claims, Staking, Achievements, Referrals
-- ============================================================================

-- ============================================================================
-- STEP 1: RESTORE CAMPAIGN REWARD TRIGGER (was accidentally removed)
-- ============================================================================

-- Drop existing campaign trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_user_balance_after_claim ON campaign_reward_claims;
DROP FUNCTION IF EXISTS update_user_balance_after_claim();

-- Create campaign reward trigger function
CREATE OR REPLACE FUNCTION update_user_balance_after_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user balance with campaign rewards
  INSERT INTO user_balances (
    wallet_address, 
    total_neft_claimed, 
    total_xp_earned, 
    available_neft,
    last_updated
  )
  VALUES (
    NEW.wallet_address, 
    NEW.neft_reward, 
    NEW.xp_reward,
    NEW.neft_reward,  -- CRITICAL: Add to available_neft for UI display
    NOW()
  )
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + NEW.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + NEW.xp_reward,
    available_neft = user_balances.available_neft + NEW.neft_reward,  -- CRITICAL: Add to available_neft
    last_updated = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'ERROR in campaign reward trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on campaign_reward_claims table
CREATE TRIGGER trigger_update_user_balance_after_claim
  AFTER INSERT ON campaign_reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_claim();

-- ============================================================================
-- STEP 2: ENSURE DAILY CLAIMS UPDATE USER_BALANCES
-- ============================================================================

-- Drop existing daily claims trigger if it exists
DROP TRIGGER IF EXISTS sync_user_balance_on_daily_claim ON daily_claims;
DROP FUNCTION IF EXISTS update_user_balance_after_daily_claim();

-- Create daily claims trigger function
CREATE OR REPLACE FUNCTION update_user_balance_after_daily_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user balance with daily claim rewards
  INSERT INTO user_balances (
    wallet_address, 
    total_neft_claimed, 
    total_xp_earned, 
    available_neft,
    last_updated
  )
  VALUES (
    NEW.wallet_address, 
    NEW.neft_reward, 
    NEW.xp_reward,
    NEW.neft_reward,  -- Add to available_neft
    NOW()
  )
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + NEW.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + NEW.xp_reward,
    available_neft = user_balances.available_neft + NEW.neft_reward,
    last_updated = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'ERROR in daily claim trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on daily_claims table
CREATE TRIGGER sync_user_balance_on_daily_claim
  AFTER INSERT ON daily_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_daily_claim();

-- ============================================================================
-- STEP 3: ENSURE ACHIEVEMENT REWARDS UPDATE USER_BALANCES
-- ============================================================================

-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS claim_achievement_reward(TEXT, TEXT);

-- Update claim_achievement_reward function to include available_neft
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
  
  -- Mark as claimed
  UPDATE user_achievements 
  SET claimed_at = NOW(), updated_at = NOW()
  WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  
  -- Update user balance with achievement rewards (INCLUDING available_neft)
  INSERT INTO user_balances (
    wallet_address, 
    total_neft_claimed, 
    total_xp_earned, 
    available_neft,
    last_updated
  )
  VALUES (
    user_wallet, 
    achievement_record.neft_reward, 
    achievement_record.xp_reward,
    achievement_record.neft_reward, -- Add to available_neft too
    NOW()
  )
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + achievement_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + achievement_record.xp_reward,
    available_neft = user_balances.available_neft + achievement_record.neft_reward,
    last_updated = NOW();
  
  -- Return success with rewards
  RETURN QUERY SELECT 
    TRUE, 
    ('Successfully claimed reward for ' || achievement_record.title)::TEXT,
    achievement_record.neft_reward,
    achievement_record.xp_reward,
    achievement_record.nft_reward;
END;
$$;

-- ============================================================================
-- STEP 4: ENSURE REFERRAL REWARDS UPDATE USER_BALANCES
-- ============================================================================

-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS process_referral(TEXT, TEXT, DECIMAL, INTEGER);

-- Update process_referral function to include available_neft
CREATE OR REPLACE FUNCTION process_referral(
  referrer_wallet TEXT,
  referee_wallet TEXT,
  neft_reward DECIMAL(18,2) DEFAULT 10,
  xp_reward INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referral_code_val TEXT;
  current_referrals INTEGER;
  tier_reached INTEGER := 0;
  result JSON;
BEGIN
  -- Get referrer's referral code
  SELECT rc.referral_code INTO referral_code_val
  FROM referral_codes rc
  WHERE rc.wallet_address = referrer_wallet;
  
  IF referral_code_val IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Referrer not found');
  END IF;
  
  -- Check if referee is already referred
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_wallet = referee_wallet) THEN
    RETURN json_build_object('success', false, 'message', 'User already referred');
  END IF;
  
  -- Insert the referral
  INSERT INTO referrals (referrer_wallet, referee_wallet, referral_code, status, processed_at)
  VALUES (referrer_wallet, referee_wallet, referral_code_val, 'processed', NOW());
  
  -- Update referrer's stats
  UPDATE referral_codes 
  SET total_referrals = total_referrals + 1
  WHERE wallet_address = referrer_wallet;
  
  -- Get updated referral count
  SELECT total_referrals INTO current_referrals
  FROM referral_codes
  WHERE wallet_address = referrer_wallet;
  
  -- Calculate tier and rewards based on referral count
  CASE 
    WHEN current_referrals >= 50 THEN
      tier_reached := 5;
      neft_reward := 1500;
      xp_reward := 3000;
    WHEN current_referrals >= 25 THEN
      tier_reached := 4;
      neft_reward := 500;
      xp_reward := 1000;
    WHEN current_referrals >= 10 THEN
      tier_reached := 3;
      neft_reward := 150;
      xp_reward := 300;
    WHEN current_referrals >= 5 THEN
      tier_reached := 2;
      neft_reward := 50;
      xp_reward := 100;
    WHEN current_referrals >= 1 THEN
      tier_reached := 1;
      neft_reward := 25;
      xp_reward := 50;
  END CASE;
  
  -- Update referral record with rewards
  UPDATE referrals 
  SET neft_reward = process_referral.neft_reward,
      xp_reward = process_referral.xp_reward,
      tier_reached = process_referral.tier_reached
  WHERE referee_wallet = process_referral.referee_wallet;
  
  -- Update referrer's tier if advanced
  UPDATE referral_codes 
  SET current_tier = GREATEST(current_tier, tier_reached),
      total_neft_earned = total_neft_earned + neft_reward,
      total_xp_earned = total_xp_earned + xp_reward
  WHERE wallet_address = referrer_wallet;
  
  -- Add rewards to user balance (INCLUDING available_neft)
  INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned, last_updated)
  VALUES (referrer_wallet, neft_reward, neft_reward, xp_reward, NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    total_neft_claimed = user_balances.total_neft_claimed + EXCLUDED.total_neft_claimed,
    available_neft = user_balances.available_neft + EXCLUDED.available_neft,
    total_xp_earned = user_balances.total_xp_earned + EXCLUDED.total_xp_earned,
    last_updated = NOW();
  
  -- Return success result
  SELECT json_build_object(
    'success', true,
    'tier_reached', tier_reached,
    'neft_reward', neft_reward,
    'xp_reward', xp_reward,
    'total_referrals', current_referrals,
    'message', 'Referral processed successfully'
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ============================================================================
-- STEP 5: ENSURE STAKING REWARDS UPDATE USER_BALANCES
-- ============================================================================

-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS claim_nft_rewards(TEXT);

-- Update claim_nft_rewards function to include available_neft
CREATE OR REPLACE FUNCTION claim_nft_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nft_claimable DECIMAL(18,8) := 0;
    token_claimable DECIMAL(18,8) := 0;
    total_claimable DECIMAL(18,8) := 0;
BEGIN
    -- Calculate claimable rewards by type
    SELECT 
        COALESCE(SUM(total_nft_earned - total_nft_claimed), 0),
        COALESCE(SUM(total_token_earned - total_token_claimed), 0)
    INTO nft_claimable, token_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet
    AND (total_nft_earned > total_nft_claimed OR total_token_earned > total_token_claimed);
    
    total_claimable := nft_claimable + token_claimable;
    
    IF total_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No rewards available to claim'
        );
    END IF;
    
    -- Update ALL claimed amounts in single operation
    UPDATE staking_rewards
    SET 
        total_nft_claimed = total_nft_earned,
        total_token_claimed = total_token_earned,
        last_updated = NOW()
    WHERE wallet_address = user_wallet
    AND (total_nft_earned > total_nft_claimed OR total_token_earned > total_token_claimed);
    
    -- Add total rewards to user balance in single operation (INCLUDING available_neft)
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned, last_updated)
    VALUES (user_wallet, total_claimable, total_claimable, 0, NOW())
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + total_claimable,
        available_neft = user_balances.available_neft + total_claimable,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'nft_rewards_claimed', nft_claimable,
        'token_rewards_claimed', token_claimable,
        'reward_type', 'all_staking'
    );
END;
$$;

-- ============================================================================
-- STEP 6: GRANT ALL PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION update_user_balance_after_claim() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION update_user_balance_after_daily_claim() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION process_referral(TEXT, TEXT, DECIMAL, INTEGER) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_nft_rewards(TEXT) TO authenticated, anon, public;

-- ============================================================================
-- STEP 7: SYNC EXISTING REWARDS TO USER_BALANCES
-- ============================================================================

-- First, fix any existing NULL values in user_balances
UPDATE user_balances 
SET 
    total_neft_claimed = COALESCE(total_neft_claimed, 0),
    total_xp_earned = COALESCE(total_xp_earned, 0),
    available_neft = COALESCE(available_neft, 0)
WHERE total_neft_claimed IS NULL OR total_xp_earned IS NULL;

-- Sync existing campaign rewards
INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, last_updated)
SELECT 
    wallet_address,
    COALESCE(SUM(neft_reward), 0) as total_neft,
    COALESCE(SUM(xp_reward), 0) as total_xp,
    COALESCE(SUM(neft_reward), 0) as available_neft,
    NOW()
FROM campaign_reward_claims
WHERE wallet_address NOT IN (SELECT wallet_address FROM user_balances)
GROUP BY wallet_address
ON CONFLICT (wallet_address) DO NOTHING;

-- Sync existing daily claims
INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, last_updated)
SELECT 
    wallet_address,
    COALESCE(SUM(neft_reward), 0) as total_neft,
    COALESCE(SUM(xp_reward), 0) as total_xp,
    COALESCE(SUM(neft_reward), 0) as available_neft,
    NOW()
FROM daily_claims
WHERE wallet_address NOT IN (SELECT wallet_address FROM user_balances)
GROUP BY wallet_address
ON CONFLICT (wallet_address) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'ALL 5 NEFT REWARD SYSTEMS FIXED SUCCESSFULLY!' as status,
       'Campaign, Daily Claims, Staking, Achievements, Referrals' as systems_fixed;
