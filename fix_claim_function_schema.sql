-- ============================================================================
-- FIX CLAIM ACHIEVEMENT REWARD FUNCTION - CORRECT SCHEMA
-- The user_balances table has 'last_updated' not 'created_at/updated_at'
-- ============================================================================

-- Update the claim_achievement_reward function with correct schema
CREATE OR REPLACE FUNCTION claim_achievement_reward(
  user_wallet TEXT,
  achievement_key_param TEXT
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  user_achievement_record RECORD;
BEGIN
  -- Get achievement details
  SELECT * INTO achievement_record
  FROM achievements_master am
  WHERE am.achievement_key = achievement_key_param AND am.is_active = TRUE;
  
  IF achievement_record IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement not found or inactive',
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
  END IF;
  
  -- Get user achievement status
  SELECT * INTO user_achievement_record
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF user_achievement_record IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement not started',
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
  END IF;
  
  -- Check if already claimed
  IF user_achievement_record.claimed_at IS NOT NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement already claimed',
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
  END IF;
  
  -- Check if achievement is completed
  IF user_achievement_record.status != 'completed' THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Achievement not completed yet',
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
  END IF;
  
  -- Mark as claimed
  UPDATE user_achievements 
  SET claimed_at = NOW(), updated_at = NOW()
  WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  
  -- Add rewards to user balance (CORRECTED SCHEMA - using last_updated)
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, last_updated)
  VALUES (user_wallet, achievement_record.neft_reward, achievement_record.xp_reward, achievement_record.neft_reward, NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    total_neft_claimed = user_balances.total_neft_claimed + achievement_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + achievement_record.xp_reward,
    available_neft = COALESCE(user_balances.available_neft, 0) + achievement_record.neft_reward,
    last_updated = NOW();
  
  -- Return success with rewards
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Achievement claimed successfully!',
    'neft_reward', achievement_record.neft_reward,
    'xp_reward', achievement_record.xp_reward,
    'nft_reward', achievement_record.nft_reward
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', 'Error claiming achievement reward: ' || SQLERRM,
      'neft_reward', 0,
      'xp_reward', 0,
      'nft_reward', NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION claim_achievement_reward(TEXT, TEXT) TO public;

-- Test the corrected function
SELECT 'Fixed claim function deployed!' as status;
SELECT 'Now run force_achievement_update.sql first, then test claiming' as next_step;
