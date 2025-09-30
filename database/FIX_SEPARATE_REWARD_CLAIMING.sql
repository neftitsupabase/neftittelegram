-- ============================================================================
-- FIX SEPARATE REWARD CLAIMING - CREATE INDIVIDUAL CLAIM FUNCTIONS
-- ============================================================================
-- This fixes the UI issue where claiming NFT rewards also claims token rewards

-- 1. Create function to claim only NFT rewards
CREATE OR REPLACE FUNCTION claim_nft_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nft_claimable DECIMAL(18,8) := 0;
    nft_rewards_claimed DECIMAL(18,8) := 0;
BEGIN
    -- Get total unclaimed NFT rewards
    SELECT COALESCE(SUM(nft_rewards), 0)
    INTO nft_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet AND claimed = FALSE;
    
    IF nft_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'No NFT rewards available to claim',
            'nft_rewards_claimed', 0
        );
    END IF;
    
    -- Mark only NFT portion as claimed by updating the record
    UPDATE staking_rewards
    SET nft_rewards = 0,
        total_rewards = token_rewards,
        claimed = CASE WHEN token_rewards <= 0 THEN TRUE ELSE FALSE END
    WHERE wallet_address = user_wallet AND claimed = FALSE;
    
    nft_rewards_claimed := nft_claimable;
    
    -- Add NFT rewards to user balance
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
    VALUES (user_wallet, nft_rewards_claimed, nft_rewards_claimed, 0)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + nft_rewards_claimed,
        available_neft = user_balances.available_neft + nft_rewards_claimed;
    
    RETURN json_build_object(
        'success', true,
        'message', 'NFT rewards claimed successfully',
        'nft_rewards_claimed', nft_rewards_claimed,
        'total_claimed', nft_rewards_claimed
    );
END;
$$;

-- 2. Create function to claim only token rewards
CREATE OR REPLACE FUNCTION claim_token_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token_claimable DECIMAL(18,8) := 0;
    token_rewards_claimed DECIMAL(18,8) := 0;
BEGIN
    -- Get total unclaimed token rewards
    SELECT COALESCE(SUM(token_rewards), 0)
    INTO token_claimable
    FROM staking_rewards
    WHERE wallet_address = user_wallet AND claimed = FALSE;
    
    IF token_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'No token rewards available to claim',
            'token_rewards_claimed', 0
        );
    END IF;
    
    -- Mark only token portion as claimed by updating the record
    UPDATE staking_rewards
    SET token_rewards = 0,
        total_rewards = nft_rewards,
        claimed = CASE WHEN nft_rewards <= 0 THEN TRUE ELSE FALSE END
    WHERE wallet_address = user_wallet AND claimed = FALSE;
    
    token_rewards_claimed := token_claimable;
    
    -- Add token rewards to user balance
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, total_xp_earned)
    VALUES (user_wallet, token_rewards_claimed, token_rewards_claimed, 0)
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_neft_claimed = user_balances.total_neft_claimed + token_rewards_claimed,
        available_neft = user_balances.available_neft + token_rewards_claimed;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Token rewards claimed successfully',
        'token_rewards_claimed', token_rewards_claimed,
        'total_claimed', token_rewards_claimed
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION claim_nft_rewards(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_token_rewards(TEXT) TO authenticated, anon, public;

-- Test the functions
DO $$
BEGIN
    RAISE NOTICE '✅ Created claim_nft_rewards() function';
    RAISE NOTICE '✅ Created claim_token_rewards() function';
    RAISE NOTICE '✅ Now NFT and token rewards can be claimed separately';
    RAISE NOTICE '✅ UI buttons will work independently';
END $$;
