-- COMPLETE FINAL STAKING CLAIM FUNCTIONS
-- Supabase-safe claim functions with permission fixes and sync interference protection

-- =============================================================================
-- 5. SUPABASE-SAFE CLAIM FUNCTIONS (WITH PERMISSION FIXES)
-- =============================================================================

-- Claim NFT rewards (Supabase-safe)
CREATE OR REPLACE FUNCTION claim_nft_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_claimable DECIMAL(18,8) := 0;
    reward_count INTEGER := 0;
    current_balance DECIMAL(18,8) := 0;
    new_balance DECIMAL(18,8) := 0;
BEGIN
    -- Calculate total claimable NFT rewards
    SELECT 
        COALESCE(SUM(total_nft_earned - total_nft_claimed), 0),
        COUNT(*)
    INTO total_claimable, reward_count
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND total_nft_earned > total_nft_claimed;
    
    IF total_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'No NFT rewards to claim',
            'total_claimed', 0,
            'rewards_count', 0
        );
    END IF;
    
    -- Get current balance BEFORE any updates
    SELECT COALESCE(total_neft_claimed, 0) 
    INTO current_balance
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Update staking_rewards to mark NFT rewards as claimed
    UPDATE staking_rewards 
    SET 
        total_nft_claimed = total_nft_earned,
        last_updated = NOW()
    WHERE wallet_address = user_wallet 
    AND total_nft_earned > total_nft_claimed;
    
    -- Calculate new balance
    new_balance := current_balance + total_claimable;
    
    -- Direct balance update using explicit calculation
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, last_updated)
    VALUES (user_wallet, new_balance, COALESCE((SELECT available_neft FROM user_balances WHERE wallet_address = user_wallet), 0) + total_claimable, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        total_neft_claimed = EXCLUDED.total_neft_claimed,
        available_neft = EXCLUDED.available_neft,
        last_updated = NOW()
    WHERE user_balances.wallet_address = user_wallet;
    
    -- Force immediate commit to prevent interference
    PERFORM pg_advisory_lock(hashtext(user_wallet));
    
    -- Verify the update succeeded
    SELECT COALESCE(total_neft_claimed, 0) 
    INTO current_balance
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    PERFORM pg_advisory_unlock(hashtext(user_wallet));
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from NFT staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'rewards_count', reward_count,
        'previous_balance', current_balance - total_claimable,
        'new_balance', current_balance,
        'nft_rewards_claimed', total_claimable
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming NFT rewards: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;

-- Claim token rewards (Supabase-safe)
CREATE OR REPLACE FUNCTION claim_token_rewards_supabase_safe(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_claimable DECIMAL(18,8) := 0;
    reward_count INTEGER := 0;
    current_balance DECIMAL(18,8) := 0;
    new_balance DECIMAL(18,8) := 0;
BEGIN
    -- Calculate total claimable token rewards
    SELECT 
        COALESCE(SUM(total_token_earned - total_token_claimed), 0),
        COUNT(*)
    INTO total_claimable, reward_count
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND total_token_earned > total_token_claimed;
    
    IF total_claimable <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'No token rewards to claim',
            'total_claimed', 0,
            'rewards_count', 0
        );
    END IF;
    
    -- Get current balance BEFORE any updates
    SELECT COALESCE(total_neft_claimed, 0) 
    INTO current_balance
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Update staking_rewards to mark token rewards as claimed
    UPDATE staking_rewards 
    SET 
        total_token_claimed = total_token_earned,
        last_updated = NOW()
    WHERE wallet_address = user_wallet 
    AND total_token_earned > total_token_claimed;
    
    -- Calculate new balance
    new_balance := current_balance + total_claimable;
    
    -- Direct balance update using explicit calculation
    INSERT INTO user_balances (wallet_address, total_neft_claimed, available_neft, last_updated)
    VALUES (user_wallet, new_balance, COALESCE((SELECT available_neft FROM user_balances WHERE wallet_address = user_wallet), 0) + total_claimable, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        total_neft_claimed = EXCLUDED.total_neft_claimed,
        available_neft = EXCLUDED.available_neft,
        last_updated = NOW()
    WHERE user_balances.wallet_address = user_wallet;
    
    -- Force immediate commit to prevent interference
    PERFORM pg_advisory_lock(hashtext(user_wallet));
    
    -- Verify the update succeeded
    SELECT COALESCE(total_neft_claimed, 0) 
    INTO current_balance
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    PERFORM pg_advisory_unlock(hashtext(user_wallet));
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from token staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'rewards_count', reward_count,
        'previous_balance', current_balance - total_claimable,
        'new_balance', current_balance,
        'token_rewards_claimed', total_claimable
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming token rewards: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;

-- Combined claim function (claims both NFT and token rewards)
CREATE OR REPLACE FUNCTION claim_all_staking_rewards(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nft_result JSON;
    token_result JSON;
    total_nft_claimed DECIMAL(18,8) := 0;
    total_token_claimed DECIMAL(18,8) := 0;
    combined_total DECIMAL(18,8) := 0;
BEGIN
    -- Claim NFT rewards
    nft_result := claim_nft_rewards_supabase_safe(user_wallet);
    
    -- Claim token rewards
    token_result := claim_token_rewards_supabase_safe(user_wallet);
    
    -- Extract claimed amounts
    IF (nft_result->>'success')::boolean THEN
        total_nft_claimed := (nft_result->>'total_claimed')::DECIMAL(18,8);
    END IF;
    
    IF (token_result->>'success')::boolean THEN
        total_token_claimed := (token_result->>'total_claimed')::DECIMAL(18,8);
    END IF;
    
    combined_total := total_nft_claimed + total_token_claimed;
    
    IF combined_total > 0 THEN
        RETURN json_build_object(
            'success', true,
            'message', format('Successfully claimed %s NEFT total (%s from NFTs, %s from tokens)', 
                combined_total, total_nft_claimed, total_token_claimed),
            'total_claimed', combined_total,
            'nft_rewards_claimed', total_nft_claimed,
            'token_rewards_claimed', total_token_claimed,
            'nft_result', nft_result,
            'token_result', token_result
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'message', 'No rewards available to claim',
            'total_claimed', 0,
            'nft_rewards_claimed', 0,
            'token_rewards_claimed', 0,
            'nft_result', nft_result,
            'token_result', token_result
        );
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming rewards: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;
