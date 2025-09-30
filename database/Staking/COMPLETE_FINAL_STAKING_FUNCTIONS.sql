-- COMPLETE FINAL STAKING FUNCTIONS
-- All working functions with permission fixes and sync interference protection

-- =============================================================================
-- 3. CORE STAKING FUNCTIONS (SUPABASE-SAFE)
-- =============================================================================

-- Stake NFT function
CREATE OR REPLACE FUNCTION stake_nft(
    user_wallet TEXT,
    nft_id TEXT,
    nft_name TEXT DEFAULT '',
    nft_image TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Check if NFT is already staked
    IF EXISTS (SELECT 1 FROM staked_nfts WHERE wallet_address = user_wallet AND nft_id = nft_id) THEN
        RETURN json_build_object(
            'success', false,
            'message', 'NFT is already staked',
            'error', 'ALREADY_STAKED'
        );
    END IF;
    
    -- Insert staked NFT
    INSERT INTO staked_nfts (
        wallet_address, nft_id, nft_name, nft_image, staked_at, daily_rate, total_earned, last_claim
    ) VALUES (
        user_wallet, nft_id, nft_name, nft_image, NOW(), 5.0, 0, NOW()
    );
    
    RETURN json_build_object(
        'success', true,
        'message', 'NFT staked successfully',
        'nft_id', nft_id,
        'daily_rate', 5.0
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', 'Error staking NFT: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;

-- Unstake NFT function
CREATE OR REPLACE FUNCTION unstake_nft(user_wallet TEXT, nft_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    staked_record RECORD;
BEGIN
    -- Get staked NFT record
    SELECT * INTO staked_record FROM staked_nfts WHERE wallet_address = user_wallet AND nft_id = nft_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'NFT is not staked', 'error', 'NOT_STAKED');
    END IF;
    
    -- Remove from staked NFTs
    DELETE FROM staked_nfts WHERE wallet_address = user_wallet AND nft_id = nft_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'NFT unstaked successfully',
        'nft_id', nft_id,
        'total_earned', staked_record.total_earned
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'Error unstaking NFT: ' || SQLERRM, 'error', SQLERRM);
END;
$$;

-- Stake tokens function
CREATE OR REPLACE FUNCTION stake_tokens(user_wallet TEXT, stake_amount DECIMAL(18,8))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_available DECIMAL(18,8) := 0;
    daily_rate DECIMAL(18,8);
BEGIN
    -- Validate amount
    IF stake_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Stake amount must be greater than 0', 'error', 'INVALID_AMOUNT');
    END IF;
    
    -- Get current available balance
    SELECT COALESCE(available_neft, 0) INTO current_available FROM user_balances WHERE wallet_address = user_wallet;
    
    -- Check sufficient balance
    IF current_available < stake_amount THEN
        RETURN json_build_object(
            'success', false,
            'message', format('Insufficient balance. Available: %s, Required: %s', current_available, stake_amount),
            'error', 'INSUFFICIENT_BALANCE'
        );
    END IF;
    
    -- Calculate daily rate (0.1% per day)
    daily_rate := stake_amount * 0.001;
    
    -- Insert staked tokens
    INSERT INTO staked_tokens (wallet_address, amount, staked_at, daily_rate, total_earned, last_claim)
    VALUES (user_wallet, stake_amount, NOW(), daily_rate, 0, NOW());
    
    -- Update user balance (deduct staked amount)
    UPDATE user_balances 
    SET 
        available_neft = available_neft - stake_amount,
        staked_neft = COALESCE(staked_neft, 0) + stake_amount,
        last_updated = NOW()
    WHERE wallet_address = user_wallet;
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully staked %s NEFT tokens', stake_amount),
        'staked_amount', stake_amount,
        'daily_rate', daily_rate,
        'new_available_balance', current_available - stake_amount
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'Error staking tokens: ' || SQLERRM, 'error', SQLERRM);
END;
$$;

-- Unstake tokens function (supports partial unstaking)
CREATE OR REPLACE FUNCTION unstake_tokens(
    user_wallet TEXT,
    staked_tokens_id UUID,
    unstake_amount DECIMAL(18,8) DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    staked_record RECORD;
    actual_unstake_amount DECIMAL(18,8);
    remaining_amount DECIMAL(18,8);
BEGIN
    -- Get staked tokens record
    SELECT * INTO staked_record FROM staked_tokens WHERE id = staked_tokens_id AND wallet_address = user_wallet;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Staked tokens record not found', 'error', 'NOT_FOUND');
    END IF;
    
    -- Determine actual unstake amount
    IF unstake_amount IS NULL OR unstake_amount >= staked_record.amount THEN
        actual_unstake_amount := staked_record.amount;
        remaining_amount := 0;
    ELSE
        IF unstake_amount <= 0 THEN
            RETURN json_build_object('success', false, 'message', 'Unstake amount must be greater than 0', 'error', 'INVALID_AMOUNT');
        END IF;
        actual_unstake_amount := unstake_amount;
        remaining_amount := staked_record.amount - unstake_amount;
    END IF;
    
    -- Update user balance (add back unstaked amount)
    UPDATE user_balances 
    SET 
        available_neft = COALESCE(available_neft, 0) + actual_unstake_amount,
        staked_neft = GREATEST(0, COALESCE(staked_neft, 0) - actual_unstake_amount),
        last_updated = NOW()
    WHERE wallet_address = user_wallet;
    
    -- Handle partial vs full unstake
    IF remaining_amount > 0 THEN
        UPDATE staked_tokens SET amount = remaining_amount, daily_rate = remaining_amount * 0.001 WHERE id = staked_tokens_id;
    ELSE
        DELETE FROM staked_tokens WHERE id = staked_tokens_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully unstaked %s NEFT tokens', actual_unstake_amount),
        'unstaked_amount', actual_unstake_amount,
        'remaining_staked', remaining_amount,
        'total_earned', staked_record.total_earned,
        'operation_type', CASE WHEN remaining_amount > 0 THEN 'partial' ELSE 'full' END
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'Error unstaking tokens: ' || SQLERRM, 'error', SQLERRM);
END;
$$;

-- =============================================================================
-- 4. REWARD GENERATION FUNCTION
-- =============================================================================

-- Generate daily staking rewards
CREATE OR REPLACE FUNCTION generate_daily_staking_rewards()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    reward_record RECORD;
    rewards_generated INTEGER := 0;
    nft_daily_total DECIMAL(18,8);
    token_daily_total DECIMAL(18,8);
    existing_nft_earned DECIMAL(18,8);
    existing_token_earned DECIMAL(18,8);
BEGIN
    -- Process rewards for each wallet with staked assets
    FOR reward_record IN (
        SELECT DISTINCT wallet_address FROM (
            SELECT wallet_address FROM staked_nfts UNION SELECT wallet_address FROM staked_tokens
        ) AS all_stakers
    ) LOOP
        -- Calculate daily rewards
        SELECT COALESCE(SUM(daily_rate), 0) INTO nft_daily_total FROM staked_nfts WHERE wallet_address = reward_record.wallet_address;
        SELECT COALESCE(SUM(daily_rate), 0) INTO token_daily_total FROM staked_tokens WHERE wallet_address = reward_record.wallet_address;
        
        -- Get existing earned amounts
        SELECT 
            COALESCE(total_nft_earned, 0), COALESCE(total_token_earned, 0)
        INTO existing_nft_earned, existing_token_earned
        FROM staking_rewards WHERE wallet_address = reward_record.wallet_address AND reward_date = CURRENT_DATE;
        
        -- Insert or update staking rewards
        INSERT INTO staking_rewards (
            wallet_address, reward_date, nft_daily_rate, token_daily_rate,
            total_nft_earned, total_token_earned, total_nft_claimed, total_token_claimed,
            claimed, created_at, last_updated
        ) VALUES (
            reward_record.wallet_address, CURRENT_DATE, nft_daily_total, token_daily_total,
            existing_nft_earned + nft_daily_total, existing_token_earned + token_daily_total,
            COALESCE((SELECT total_nft_claimed FROM staking_rewards WHERE wallet_address = reward_record.wallet_address AND reward_date = CURRENT_DATE), 0),
            COALESCE((SELECT total_token_claimed FROM staking_rewards WHERE wallet_address = reward_record.wallet_address AND reward_date = CURRENT_DATE), 0),
            false, NOW(), NOW()
        )
        ON CONFLICT (wallet_address, reward_date) 
        DO UPDATE SET
            nft_daily_rate = EXCLUDED.nft_daily_rate,
            token_daily_rate = EXCLUDED.token_daily_rate,
            total_nft_earned = existing_nft_earned + nft_daily_total,
            total_token_earned = existing_token_earned + token_daily_total,
            last_updated = NOW();
        
        rewards_generated := rewards_generated + 1;
    END LOOP;
    
    RETURN rewards_generated;
END;
$$;
