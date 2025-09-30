-- ============================================================================
-- FIX ACHIEVEMENT CLAIM BALANCE UPDATE
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

-- Test with a sample achievement claim (if you have any completed achievements)
SELECT 'Achievement claim function updated successfully!' as status;
SELECT 'Achievement rewards will now properly update available_neft balance!' as info;

-- Optional: Sync existing claimed achievements to fix any missing available_neft
-- This will add any previously claimed achievement rewards to available_neft
UPDATE user_balances 
SET available_neft = available_neft + (
  SELECT COALESCE(SUM(am.neft_reward), 0)
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_balances.wallet_address
    AND ua.status = 'completed'
    AND ua.claimed_at IS NOT NULL
) - (
  -- Subtract what's already been counted in available_neft from achievements
  SELECT COALESCE(
    (get_user_complete_balance(user_balances.wallet_address)->>'breakdown'->>'achievement_neft')::DECIMAL(18,8), 
    0
  )
)
WHERE wallet_address IN (
  SELECT DISTINCT wallet_address 
  FROM user_achievements 
  WHERE status = 'completed' AND claimed_at IS NOT NULL
);

SELECT 'Existing claimed achievements synced to available_neft!' as sync_status;
