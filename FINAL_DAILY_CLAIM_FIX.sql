-- ============================================================================
-- FINAL DAILY CLAIM FIX - NO MORE DOUBLE REWARDS!
-- ============================================================================
-- This script ensures daily claims work correctly with proper balance updates
-- and prevents double/triple rewards from multiple triggers
-- ============================================================================

-- Step 1: Remove ALL conflicting triggers to prevent double rewards
DROP TRIGGER IF EXISTS sync_user_balance_on_daily_claim ON daily_claims;
DROP TRIGGER IF EXISTS daily_claims_balance_sync_trigger ON daily_claims;
DROP TRIGGER IF EXISTS trigger_update_user_balance_after_claim ON daily_claims;

-- Step 2: Create ONE simple, working trigger function
CREATE OR REPLACE FUNCTION sync_daily_claim_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total reward amounts
  DECLARE
    total_neft DECIMAL(18,8) := COALESCE(NEW.base_neft_reward, 0) + COALESCE(NEW.bonus_neft_reward, 0);
    total_xp INTEGER := COALESCE(NEW.base_xp_reward, 0) + COALESCE(NEW.bonus_xp_reward, 0);
  BEGIN
    -- Insert or update user_balances with daily claim rewards
    INSERT INTO user_balances (
      wallet_address, 
      total_neft_claimed, 
      total_xp_earned, 
      available_neft,
      last_updated
    )
    VALUES (
      NEW.wallet_address, 
      total_neft, 
      total_xp,
      total_neft,  -- Available NEFT = total NEFT claimed
      NOW()
    )
    ON CONFLICT (wallet_address)
    DO UPDATE SET
      total_neft_claimed = user_balances.total_neft_claimed + total_neft,
      total_xp_earned = user_balances.total_xp_earned + total_xp,
      available_neft = user_balances.available_neft + total_neft,  -- Add to available for staking
      last_updated = NOW();
    
    RETURN NEW;
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'ERROR in daily claim trigger: %', SQLERRM;
    RETURN NEW; -- Don't fail the daily claim if balance update fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create ONE trigger on daily_claims table
CREATE TRIGGER daily_claim_balance_sync
  AFTER INSERT ON daily_claims
  FOR EACH ROW
  EXECUTE FUNCTION sync_daily_claim_balance();

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION sync_daily_claim_balance() TO authenticated, anon, public;

-- Step 5: Test message
SELECT 'Daily claim balance fix applied - should now show correct rewards!' as status;
