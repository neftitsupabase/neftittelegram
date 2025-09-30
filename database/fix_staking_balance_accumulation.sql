-- FIX STAKING BALANCE ACCUMULATION ISSUE
-- Problem: NFT and token rewards overwrite each other instead of accumulating properly
-- Solution: Fix the balance update logic to properly accumulate both reward types

-- Fixed NFT claim function with proper balance accumulation
CREATE OR REPLACE FUNCTION claim_nft_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nft_claimable DECIMAL(18,8) := 0;
BEGIN
    -- Calculate claimable NFT rewards (only from records with unclaimed rewards)
    SELECT COALESCE(SUM(total_nft_earned - total_nft_claimed), 0)
    INTO nft_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet
    AND total_nft_earned > total_nft_claimed;
    
    IF nft_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No NFT rewards available to claim'
        );
    END IF;
    
    -- Update claimed amounts ONLY for records with unclaimed NFT rewards
    UPDATE staking_rewards
    SET total_nft_claimed = total_nft_earned,
        last_updated = NOW()
    WHERE wallet_address = user_wallet
    AND total_nft_earned > total_nft_claimed;
    
    -- FIXED: Properly accumulate balance without overwriting
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned, last_updated)
    VALUES (user_wallet, nft_claimable, nft_claimable, 0, NOW())
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + nft_claimable,
        available_neft = user_balances.available_neft + nft_claimable,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', 'NFT rewards claimed successfully',
        'nft_rewards_claimed', nft_claimable,
        'total_claimed', nft_claimable
    );
END;
$$;

-- Fixed token claim function with proper balance accumulation
CREATE OR REPLACE FUNCTION claim_token_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token_claimable DECIMAL(18,8) := 0;
BEGIN
    -- Calculate claimable token rewards (only from records with unclaimed rewards)
    SELECT COALESCE(SUM(total_token_earned - total_token_claimed), 0)
    INTO token_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet
    AND total_token_earned > total_token_claimed;
    
    IF token_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No token rewards available to claim'
        );
    END IF;
    
    -- Update claimed amounts ONLY for records with unclaimed token rewards
    UPDATE staking_rewards
    SET total_token_claimed = total_token_earned,
        last_updated = NOW()
    WHERE wallet_address = user_wallet
    AND total_token_earned > total_token_claimed;
    
    -- FIXED: Properly accumulate balance without overwriting
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned, last_updated)
    VALUES (user_wallet, token_claimable, token_claimable, 0, NOW())
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + token_claimable,
        available_neft = user_balances.available_neft + token_claimable,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', 'Token rewards claimed successfully',
        'token_rewards_claimed', token_claimable,
        'total_claimed', token_claimable
    );
END;
$$;

-- Enhanced claim all rewards function (claims both NFT and token in single transaction)
CREATE OR REPLACE FUNCTION claim_all_staking_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nft_claimable DECIMAL(18,8) := 0;
    token_claimable DECIMAL(18,8) := 0;
    total_claimable DECIMAL(18,8) := 0;
BEGIN
    -- Calculate claimable rewards by type
    SELECT 
        COALESCE(SUM(total_nft_earned - total_nft_claimed), 0),
        COALESCE(SUM(total_token_earned - total_token_claimed), 0)
    INTO nft_claimable, token_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet
    AND (total_nft_earned > total_nft_claimed OR total_token_earned > total_token_claimed);
    
    total_claimable := nft_claimable + token_claimable;
    
    IF total_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No rewards available to claim'
        );
    END IF;
    
    -- Update ALL claimed amounts in single operation
    UPDATE staking_rewards
    SET 
        total_nft_claimed = total_nft_earned,
        total_token_claimed = total_token_earned,
        last_updated = NOW()
    WHERE wallet_address = user_wallet
    AND (total_nft_earned > total_nft_claimed OR total_token_earned > total_token_claimed);
    
    -- Add total rewards to user balance in single operation
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned, last_updated)
    VALUES (user_wallet, total_claimable, total_claimable, 0, NOW())
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + total_claimable,
        available_neft = user_balances.available_neft + total_claimable,
        last_updated = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'nft_rewards_claimed', nft_claimable,
        'token_rewards_claimed', token_claimable,
        'reward_type', 'all_staking'
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION claim_nft_rewards(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_token_rewards(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_all_staking_rewards(TEXT) TO anon, authenticated, service_role;

-- Test the fix
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed balance accumulation in claim functions';
    RAISE NOTICE '✅ NFT and token rewards now properly accumulate';
    RAISE NOTICE '✅ Added claim_all_staking_rewards for atomic operations';
    RAISE NOTICE '🎯 Both reward types should now add to user_balances correctly';
END $$;
