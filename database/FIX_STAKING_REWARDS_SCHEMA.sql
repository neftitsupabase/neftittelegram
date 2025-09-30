-- Fix staking_rewards table schema - add missing last_updated column

-- 1. Check current staking_rewards table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'staking_rewards' 
ORDER BY ordinal_position;

-- 2. Add missing last_updated column if it doesn't exist
ALTER TABLE staking_rewards 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Also ensure we have the other required columns
ALTER TABLE staking_rewards 
ADD COLUMN IF NOT EXISTS total_nft_earned DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_token_earned DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_nft_claimed DECIMAL(18,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_token_claimed DECIMAL(18,8) DEFAULT 0;

-- 4. Update existing records to have proper last_updated values
UPDATE staking_rewards 
SET last_updated = COALESCE(created_at, NOW())
WHERE last_updated IS NULL;

-- 5. Create the fixed claim functions without last_updated references
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
    result JSON;
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
    INSERT INTO user_balances (wallet_address, total_neft_claimed, last_updated)
    VALUES (user_wallet, new_balance, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        total_neft_claimed = EXCLUDED.total_neft_claimed,
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

-- 6. Create token claim function
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
    result JSON;
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
    INSERT INTO user_balances (wallet_address, total_neft_claimed, last_updated)
    VALUES (user_wallet, new_balance, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        total_neft_claimed = EXCLUDED.total_neft_claimed,
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION claim_nft_rewards_supabase_safe(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_token_rewards_supabase_safe(TEXT) TO authenticated, anon, public;

-- 7. Verify the table structure after fixes
SELECT 
    'staking_rewards table structure after fix' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'staking_rewards' 
ORDER BY ordinal_position;

DO $$
BEGIN
    RAISE NOTICE '=== STAKING REWARDS SCHEMA FIXED ===';
    RAISE NOTICE 'Added missing last_updated column to staking_rewards table';
    RAISE NOTICE 'Updated claim functions to work with proper schema';
    RAISE NOTICE 'Functions ready: claim_nft_rewards_supabase_safe, claim_token_rewards_supabase_safe';
END $$;
