-- Fix Achievements Integration
-- This script ensures proper achievements functionality and claim button enablement

-- 1. Ensure user_balances table exists and is properly configured
CREATE TABLE IF NOT EXISTS user_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  total_neft_claimed DECIMAL(18,8) NOT NULL DEFAULT 0,
  total_xp_earned INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (total_neft_claimed >= 0),
  CHECK (total_xp_earned >= 0)
);

-- 2. Update the claim_achievement_reward function to properly handle user balances
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
  
  -- Update user balance with achievement rewards FIRST
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned)
  VALUES (user_wallet, achievement_record.neft_reward, achievement_record.xp_reward)
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + achievement_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + achievement_record.xp_reward,
    last_updated = NOW();
  
  -- Mark as claimed AFTER successful balance update
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

-- 3. Create a function to manually trigger achievement progress for testing
CREATE OR REPLACE FUNCTION test_staking_achievement(user_wallet TEXT)
RETURNS TABLE (
  achievement_key TEXT,
  old_progress INTEGER,
  new_progress INTEGER,
  required_count INTEGER,
  completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result RECORD;
BEGIN
  -- Update first_stake achievement
  SELECT * INTO result
  FROM update_achievement_progress(user_wallet, 'first_stake', 1);
  
  RETURN QUERY SELECT 
    'first_stake'::TEXT,
    GREATEST(0, result.new_progress - 1),
    result.new_progress,
    result.required_count,
    result.achievement_completed;
END;
$$;

-- 4. Create a function to get detailed achievement status for debugging
CREATE OR REPLACE FUNCTION debug_user_achievements(user_wallet TEXT)
RETURNS TABLE (
  achievement_key TEXT,
  title TEXT,
  status achievement_status,
  current_progress INTEGER,
  required_count INTEGER,
  progress_percentage INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  can_claim BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    am.achievement_key,
    am.title,
    COALESCE(ua.status, 'locked'::achievement_status) as status,
    COALESCE(ua.current_progress, 0) as current_progress,
    am.required_count,
    CASE 
      WHEN COALESCE(ua.current_progress, 0) >= am.required_count THEN 100
      WHEN am.required_count > 0 THEN ROUND((COALESCE(ua.current_progress, 0)::DECIMAL / am.required_count::DECIMAL) * 100)
      ELSE 0
    END::INTEGER as progress_percentage,
    ua.completed_at,
    ua.claimed_at,
    (COALESCE(ua.status, 'locked'::achievement_status) = 'completed' AND ua.claimed_at IS NULL) as can_claim
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
    AND ua.wallet_address = user_wallet
  WHERE am.is_active = TRUE
  ORDER BY am.sort_order ASC, am.category ASC;
END;
$$;

-- 5. Ensure proper permissions
GRANT EXECUTE ON FUNCTION test_staking_achievement(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_user_achievements(TEXT) TO authenticated;

-- 6. Insert/Update the first_stake achievement if it doesn't exist or is incorrect
INSERT INTO achievements_master (achievement_key, title, description, category, icon, color, neft_reward, xp_reward, required_count, sort_order) 
VALUES ('first_stake', 'First Stake', 'Stake your first NFT or tokens', 'staking', 'Lock', 'from-blue-600 to-blue-400', 200, 100, 1, 40)
ON CONFLICT (achievement_key) 
DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  neft_reward = EXCLUDED.neft_reward,
  xp_reward = EXCLUDED.xp_reward,
  required_count = EXCLUDED.required_count,
  is_active = TRUE;

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet_key ON user_achievements(wallet_address, achievement_key);
CREATE INDEX IF NOT EXISTS idx_user_achievements_status ON user_achievements(status) WHERE status = 'completed';

-- 8. Comments for documentation
COMMENT ON FUNCTION test_staking_achievement IS 'Manually trigger staking achievement progress for testing';
COMMENT ON FUNCTION debug_user_achievements IS 'Get detailed achievement status for debugging';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Achievements integration fix completed successfully!';
  RAISE NOTICE 'You can now test with: SELECT * FROM test_staking_achievement(''your_wallet_address'');';
  RAISE NOTICE 'Debug with: SELECT * FROM debug_user_achievements(''your_wallet_address'');';
END $$;
