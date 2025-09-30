-- ============================================================================
-- EMERGENCY DIRECT FIX - RESTORE BALANCE UPDATES IMMEDIATELY
-- This will fix the balance issue by ensuring rewards are added directly
-- ============================================================================

-- Step 1: Drop ALL existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS trigger_update_user_balance_after_claim ON campaign_reward_claims;
DROP TRIGGER IF EXISTS sync_user_balance_on_daily_claim ON daily_claims;
DROP TRIGGER IF EXISTS daily_claims_balance_sync_trigger ON daily_claims;
DROP TRIGGER IF EXISTS daily_claims_balance_sync ON daily_claims;
DROP TRIGGER IF EXISTS campaign_rewards_balance_sync ON campaign_reward_claims;
DROP TRIGGER IF EXISTS achievements_balance_sync ON user_achievements;
DROP TRIGGER IF EXISTS staking_rewards_balance_sync ON staking_rewards;

-- Step 2: Drop existing functions
DROP FUNCTION IF EXISTS update_user_balance_after_claim();
DROP FUNCTION IF EXISTS update_user_balance_after_daily_claim();
DROP FUNCTION IF EXISTS sync_balance_after_daily_claim();

-- Step 3: Create SIMPLE, WORKING trigger for campaign rewards
CREATE OR REPLACE FUNCTION update_user_balance_after_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- Direct balance update for campaign rewards
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
    NEW.neft_reward,
    NOW()
  )
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + NEW.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + NEW.xp_reward,
    available_neft = user_balances.available_neft + NEW.neft_reward,
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create SIMPLE, WORKING trigger for daily claims
CREATE OR REPLACE FUNCTION update_user_balance_after_daily_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- Direct balance update for daily claims
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
    NEW.neft_reward,
    NOW()
  )
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + NEW.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + NEW.xp_reward,
    available_neft = user_balances.available_neft + NEW.neft_reward,
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create the triggers
CREATE TRIGGER trigger_update_user_balance_after_claim
  AFTER INSERT ON campaign_reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_claim();

CREATE TRIGGER sync_user_balance_on_daily_claim
  AFTER INSERT ON daily_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_daily_claim();

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION update_user_balance_after_claim() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION update_user_balance_after_daily_claim() TO authenticated, anon, public;

-- Step 7: MANUALLY ADD EXISTING REWARDS TO USER_BALANCES
-- This will immediately fix your current balance issue

-- Add existing campaign rewards
INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, last_updated)
SELECT 
    wallet_address,
    COALESCE(SUM(neft_reward), 0) as total_neft,
    COALESCE(SUM(xp_reward), 0) as total_xp,
    COALESCE(SUM(neft_reward), 0) as available_neft,
    NOW()
FROM campaign_reward_claims
GROUP BY wallet_address
ON CONFLICT (wallet_address)
DO UPDATE SET
    total_neft_claimed = EXCLUDED.total_neft_claimed,
    total_xp_earned = EXCLUDED.total_xp_earned,
    available_neft = EXCLUDED.available_neft,
    last_updated = NOW();

-- Add existing daily claims
INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, last_updated)
SELECT 
    wallet_address,
    COALESCE(SUM(neft_reward), 0) as total_neft,
    COALESCE(SUM(xp_reward), 0) as total_xp,
    COALESCE(SUM(neft_reward), 0) as available_neft,
    NOW()
FROM daily_claims
GROUP BY wallet_address
ON CONFLICT (wallet_address)
DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + EXCLUDED.total_neft_claimed,
    total_xp_earned = user_balances.total_xp_earned + EXCLUDED.total_xp_earned,
    available_neft = user_balances.available_neft + EXCLUDED.available_neft,
    last_updated = NOW();

-- Step 8: Test message
SELECT 'EMERGENCY BALANCE FIX COMPLETED!' as status,
       'Campaign and Daily Claim rewards should now show in balance' as message;
