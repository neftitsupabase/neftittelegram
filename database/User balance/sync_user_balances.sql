-- ============================================================================
-- SYNC USER_BALANCES TABLE WITH AGGREGATED RESULTS
-- Creates automatic syncing between aggregated rewards and user_balances table
-- ============================================================================

-- Create function to sync user_balances table with aggregated data
CREATE OR REPLACE FUNCTION sync_user_balance(user_wallet TEXT)
RETURNS TEXT AS $$
DECLARE
  balance_data JSON;
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
BEGIN
  -- Get aggregated balance data
  balance_data := get_user_complete_balance(user_wallet);
  
  -- Extract values from JSON
  total_neft := (balance_data->>'total_neft')::DECIMAL(18,8);
  total_xp := (balance_data->>'total_xp')::INTEGER;
  available_neft := (balance_data->>'available_neft')::DECIMAL(18,8);
  
  -- Insert or update user_balances table
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    last_updated
  ) VALUES (
    user_wallet,
    total_neft,
    total_xp,
    available_neft,
    NOW()
  )
  ON CONFLICT (wallet_address) 
  DO UPDATE SET
    total_neft_claimed = EXCLUDED.total_neft_claimed,
    total_xp_earned = EXCLUDED.total_xp_earned,
    available_neft = EXCLUDED.available_neft,
    last_updated = NOW();
    
  RETURN 'Synced balance for wallet: ' || user_wallet || ' - NEFT: ' || total_neft || ', XP: ' || total_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync all user balances
CREATE OR REPLACE FUNCTION sync_all_user_balances()
RETURNS TEXT AS $$
DECLARE
  wallet_record RECORD;
  sync_count INTEGER := 0;
BEGIN
  -- Get all unique wallet addresses from reward tables
  FOR wallet_record IN 
    SELECT DISTINCT wallet_address FROM (
      SELECT wallet_address FROM campaign_reward_claims
      UNION
      SELECT wallet_address FROM daily_claims
      UNION
      SELECT wallet_address FROM user_achievements WHERE claimed_at IS NOT NULL
      UNION
      SELECT wallet_address FROM staking_rewards WHERE is_claimed = true
      UNION
      SELECT wallet_address FROM user_balances -- Include existing balances
    ) AS all_wallets
  LOOP
    -- Sync each wallet
    PERFORM sync_user_balance(wallet_record.wallet_address);
    sync_count := sync_count + 1;
  END LOOP;
  
  RETURN 'Synced balances for ' || sync_count || ' wallets';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to auto-sync when rewards are added
CREATE OR REPLACE FUNCTION trigger_balance_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync the user's balance when any reward is added/updated
  PERFORM sync_user_balance(NEW.wallet_address);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic syncing
-- Campaign rewards trigger
DROP TRIGGER IF EXISTS campaign_rewards_balance_sync ON campaign_reward_claims;
CREATE TRIGGER campaign_rewards_balance_sync
  AFTER INSERT OR UPDATE ON campaign_reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION trigger_balance_sync();

-- Daily claims trigger  
DROP TRIGGER IF EXISTS daily_claims_balance_sync ON daily_claims;
CREATE TRIGGER daily_claims_balance_sync
  AFTER INSERT OR UPDATE ON daily_claims
  FOR EACH ROW
  EXECUTE FUNCTION trigger_balance_sync();

-- Achievements trigger
DROP TRIGGER IF EXISTS achievements_balance_sync ON user_achievements;
CREATE TRIGGER achievements_balance_sync
  AFTER INSERT OR UPDATE ON user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_balance_sync();

-- Staking rewards trigger
DROP TRIGGER IF EXISTS staking_rewards_balance_sync ON staking_rewards;
CREATE TRIGGER staking_rewards_balance_sync
  AFTER INSERT OR UPDATE ON staking_rewards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_balance_sync();

-- Staked tokens trigger (affects available_neft)
DROP TRIGGER IF EXISTS staked_tokens_balance_sync ON staked_tokens;
CREATE TRIGGER staked_tokens_balance_sync
  AFTER INSERT OR UPDATE OR DELETE ON staked_tokens
  FOR EACH ROW
  EXECUTE FUNCTION trigger_balance_sync();

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_user_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_user_balances() TO authenticated;

-- Initial sync for your social login user
SELECT 'Syncing balance for social login user...' as step;
SELECT sync_user_balance('social:google:108350092537307288909');

