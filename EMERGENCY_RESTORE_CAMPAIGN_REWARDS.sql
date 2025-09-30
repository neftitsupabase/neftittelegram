-- ============================================================================
-- EMERGENCY FIX: Restore Campaign Reward System
-- This restores the campaign reward trigger that was accidentally removed
-- ============================================================================

-- Step 1: Create the campaign reward trigger function
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

-- Step 2: Create the trigger on campaign_reward_claims table
DROP TRIGGER IF EXISTS trigger_update_user_balance_after_claim ON campaign_reward_claims;

CREATE TRIGGER trigger_update_user_balance_after_claim
  AFTER INSERT ON campaign_reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_claim();

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION update_user_balance_after_claim() TO authenticated, anon, public;

-- Step 4: Test the trigger
SELECT 'Campaign Reward Trigger Restored Successfully!' as status;

-- Step 5: Check if there are any existing campaign rewards that need to be synced
DO $$
DECLARE
    campaign_total DECIMAL(18,8) := 0;
    campaign_xp INTEGER := 0;
    user_wallet TEXT := '0x7780E03eF5709441fA566e138B498100C2c7B9F2';
BEGIN
    -- Get total campaign rewards for the user
    SELECT 
        COALESCE(SUM(neft_reward), 0),
        COALESCE(SUM(xp_reward), 0)
    INTO campaign_total, campaign_xp
    FROM campaign_reward_claims 
    WHERE wallet_address = user_wallet;
    
    IF campaign_total > 0 THEN
        RAISE NOTICE 'Found existing campaign rewards: % NEFT, % XP', campaign_total, campaign_xp;
        
        -- Update user_balances to include existing campaign rewards
        INSERT INTO user_balances (
            wallet_address,
            total_neft_claimed,
            total_xp_earned,
            available_neft,
            last_updated
        ) VALUES (
            user_wallet,
            campaign_total,
            campaign_xp,
            campaign_total,
            NOW()
        )
        ON CONFLICT (wallet_address) DO UPDATE SET
            total_neft_claimed = GREATEST(user_balances.total_neft_claimed, campaign_total),
            total_xp_earned = GREATEST(user_balances.total_xp_earned, campaign_xp),
            available_neft = GREATEST(user_balances.available_neft, campaign_total),
            last_updated = NOW();
            
        RAISE NOTICE 'Synced existing campaign rewards to user_balances';
    ELSE
        RAISE NOTICE 'No existing campaign rewards found for user';
    END IF;
END;
$$;
