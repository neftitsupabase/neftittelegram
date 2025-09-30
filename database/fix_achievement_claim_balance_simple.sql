-- ============================================================================
-- FIX ACHIEVEMENT CLAIM BALANCE UPDATE (SIMPLIFIED)
-- Updates claim_achievement_reward function to properly update available_neft
-- ============================================================================

-- Update the claim_achievement_reward function to include available_neft
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
    available_neft = user_balances.available_neft + achievement_record.neft_reward, -- FIXED: Add to available_neft
    last_updated = NOW();
  
  -- Return success with rewards
  RETURN QUERY SELECT 
    TRUE, 
    'Achievement claimed successfully!', 
    achievement_record.neft_reward,
    achievement_record.xp_reward,
    achievement_record.nft_reward;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO authenticated;

-- Create a simple function to manually sync existing claimed achievements
CREATE OR REPLACE FUNCTION sync_claimed_achievements_to_available_neft()
RETURNS TEXT AS $$
DECLARE
  wallet_record RECORD;
  achievement_neft DECIMAL(18,8);
  sync_count INTEGER := 0;
BEGIN
  -- Loop through all wallets that have claimed achievements
  FOR wallet_record IN 
    SELECT DISTINCT ua.wallet_address
    FROM user_achievements ua
    WHERE ua.status = 'completed' AND ua.claimed_at IS NOT NULL
  LOOP
    -- Calculate total achievement NEFT for this wallet
    SELECT COALESCE(SUM(am.neft_reward), 0)
    INTO achievement_neft
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = wallet_record.wallet_address
      AND ua.status = 'completed'
      AND ua.claimed_at IS NOT NULL;
    
    -- Update available_neft if there are achievement rewards
    IF achievement_neft > 0 THEN
      -- Use the sync_user_balance function to properly update the balance
      PERFORM sync_user_balance(wallet_record.wallet_address);
      sync_count := sync_count + 1;
    END IF;
  END LOOP;
  
  RETURN 'Synced ' || sync_count || ' wallets with claimed achievement rewards';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the updated function
SELECT 'Achievement claim function updated successfully!' as status;
SELECT 'Achievement rewards will now properly update available_neft balance!' as info;

-- Run the sync for existing claimed achievements
SELECT 'Syncing existing claimed achievements...' as step;
SELECT sync_claimed_achievements_to_available_neft();

SELECT 'Achievement claim balance fix completed!' as final_status;
