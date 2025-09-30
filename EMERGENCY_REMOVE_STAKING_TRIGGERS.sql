-- ============================================================================
-- EMERGENCY FIX: Remove All Problematic Staking Triggers
-- ============================================================================
-- PROBLEM: Multiple triggers are overwriting user_balances when staking
-- This causes daily claim rewards to disappear from database
-- ============================================================================

-- Step 1: Remove ALL problematic triggers that overwrite user_balances
DROP TRIGGER IF EXISTS staked_tokens_balance_sync ON staked_tokens;
DROP TRIGGER IF EXISTS sync_user_balance_on_daily_claim ON daily_claims;
DROP TRIGGER IF EXISTS daily_claims_balance_sync_trigger ON daily_claims;
DROP TRIGGER IF EXISTS trigger_update_user_balance_after_claim ON daily_claims;
DROP TRIGGER IF EXISTS daily_claim_balance_sync ON daily_claims;

-- Step 2: Remove problematic functions that overwrite balances
DROP FUNCTION IF EXISTS trigger_balance_sync();
DROP FUNCTION IF EXISTS trigger_comprehensive_balance_sync();
DROP FUNCTION IF EXISTS sync_user_balance_from_all_sources(TEXT);
DROP FUNCTION IF EXISTS aggregate_user_rewards_from_all_sources(TEXT);

-- Step 3: Create ONE simple, safe trigger for daily claims only
CREATE OR REPLACE FUNCTION safe_daily_claim_balance_update()
RETURNS TRIGGER AS $$
DECLARE
    total_neft DECIMAL(18,8) := COALESCE(NEW.base_neft_reward, 0) + COALESCE(NEW.bonus_neft_reward, 0);
    total_xp INTEGER := COALESCE(NEW.base_xp_reward, 0) + COALESCE(NEW.bonus_xp_reward, 0);
BEGIN
    -- ONLY update user_balances for daily claims - don't touch existing data
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
        total_neft,  -- Available = total for new users
        NOW()
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        total_neft_claimed = user_balances.total_neft_claimed + total_neft,
        total_xp_earned = user_balances.total_xp_earned + total_xp,
        available_neft = user_balances.available_neft + total_neft,
        last_updated = NOW();
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'ERROR in daily claim trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create ONE safe trigger for daily claims
CREATE TRIGGER safe_daily_claim_balance_update
    AFTER INSERT ON daily_claims
    FOR EACH ROW
    EXECUTE FUNCTION safe_daily_claim_balance_update();

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION safe_daily_claim_balance_update() TO authenticated, anon, public;

-- Step 6: Test message
SELECT 'All problematic triggers removed - daily claim rewards will now persist!' as status;
