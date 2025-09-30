-- ============================================================================
-- FIX: Staking Balance Overwrite Issue
-- ============================================================================
-- PROBLEM: update_staking_balance function overwrites total_xp_earned with 0
-- and messes with total_neft_claimed when staking, causing daily claim rewards to disappear
-- ============================================================================

-- Drop and recreate the update_staking_balance function to preserve existing balances
DROP FUNCTION IF EXISTS update_staking_balance(TEXT, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION update_staking_balance(
    user_wallet TEXT,
    stake_amount DECIMAL(18,8),
    operation TEXT
)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    current_total_neft DECIMAL(18,8) := 0;
    current_available_neft DECIMAL(18,8) := 0;
    current_total_xp INTEGER := 0;
    current_staked_amount DECIMAL(18,8) := 0;
    new_available_neft DECIMAL(18,8) := 0;
    referral_neft DECIMAL(18,8) := 0;
BEGIN
    -- Validate operation
    IF operation NOT IN ('stake', 'unstake') THEN
        RAISE EXCEPTION 'Invalid operation. Must be "stake" or "unstake"';
    END IF;

    -- Validate amount
    IF stake_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;

    -- Get current user balance (PRESERVE existing values)
    SELECT 
        COALESCE(total_neft_claimed, 0),
        COALESCE(available_neft, 0),
        COALESCE(total_xp_earned, 0)  -- CRITICAL: Preserve XP!
    INTO current_total_neft, current_available_neft, current_total_xp
    FROM user_balances 
    WHERE wallet_address = user_wallet;

    -- Get referral earnings
    SELECT COALESCE(total_neft_earned, 0)
    INTO referral_neft
    FROM user_referrals 
    WHERE wallet_address = user_wallet;

    -- Get current staked amount
    SELECT COALESCE(SUM(amount), 0)
    INTO current_staked_amount
    FROM staked_tokens 
    WHERE wallet_address = user_wallet;

    -- Calculate total NEFT including referrals
    current_total_neft := current_total_neft + referral_neft;

    -- Perform operation
    IF operation = 'stake' THEN
        IF current_available_neft < stake_amount THEN
            RAISE EXCEPTION 'Insufficient available balance. Available: %, Required: %', 
                current_available_neft, stake_amount;
        END IF;
        
        -- Calculate new available amount after staking
        new_available_neft := current_available_neft - stake_amount;
        
    ELSE -- unstake
        -- Calculate new available amount after unstaking
        new_available_neft := current_available_neft + stake_amount;
        
        -- Ensure we don't exceed total claimed amount
        IF new_available_neft > current_total_neft THEN
            new_available_neft := current_total_neft;
        END IF;
    END IF;

    -- CRITICAL FIX: Update user_balances WITHOUT overwriting existing values
    INSERT INTO user_balances (
        wallet_address, 
        total_neft_claimed, 
        available_neft, 
        total_xp_earned,  -- PRESERVE existing XP!
        last_updated
    )
    VALUES (
        user_wallet, 
        current_total_neft - referral_neft,  -- Keep original total_neft_claimed
        new_available_neft, 
        current_total_xp,  -- CRITICAL: Don't overwrite with 0!
        NOW()
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        available_neft = new_available_neft,
        last_updated = NOW();
        -- CRITICAL: Don't update total_neft_claimed or total_xp_earned!

    -- Return success result
    RETURN json_build_object(
        'success', true,
        'operation', operation,
        'amount', stake_amount,
        'previous_available', current_available_neft,
        'new_available', new_available_neft,
        'total_neft', current_total_neft,
        'total_xp_preserved', current_total_xp
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'operation', operation,
            'amount', stake_amount
        );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_staking_balance(TEXT, DECIMAL, TEXT) TO authenticated, anon, public;

-- Test message
SELECT 'Staking balance overwrite fix applied - daily claim rewards will now persist!' as status;
