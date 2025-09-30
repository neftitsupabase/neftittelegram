-- Fix claim functions to properly handle multiple staking_rewards records
-- Issue: When claiming, we need to only update records that have unclaimed rewards

-- 1. Fix NFT claim function
DROP FUNCTION IF EXISTS claim_nft_rewards(TEXT);

CREATE FUNCTION claim_nft_rewards(user_wallet TEXT)
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
    SET total_nft_claimed = total_nft_earned
    WHERE wallet_address = user_wallet
    AND total_nft_earned > total_nft_claimed;
    
    -- Add to user balance (this correctly adds to existing balance)
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
    VALUES (user_wallet, nft_claimable, nft_claimable, 0)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + nft_claimable,
        available_neft = user_balances.available_neft + nft_claimable;
    
    RETURN json_build_object(
        'success', true,
        'message', 'NFT rewards claimed successfully',
        'nft_rewards_claimed', nft_claimable,
        'total_claimed', nft_claimable
    );
END;
$$;

-- 2. Fix token claim function
DROP FUNCTION IF EXISTS claim_token_rewards(TEXT);

CREATE FUNCTION claim_token_rewards(user_wallet TEXT)
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
    SET total_token_claimed = total_token_earned
    WHERE wallet_address = user_wallet
    AND total_token_earned > total_token_claimed;
    
    -- Add to user balance (this correctly adds to existing balance)
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
    VALUES (user_wallet, token_claimable, token_claimable, 0)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + token_claimable,
        available_neft = user_balances.available_neft + token_claimable;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Token rewards claimed successfully',
        'token_rewards_claimed', token_claimable,
        'total_claimed', token_claimable
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION claim_nft_rewards(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_token_rewards(TEXT) TO authenticated, anon, public;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed claim functions to only update records with unclaimed rewards';
    RAISE NOTICE '✅ Both NFT and token rewards will now properly accumulate in user balance';
    RAISE NOTICE '✅ No more overwriting of previously claimed rewards';
END $$;
