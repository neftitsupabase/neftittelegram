-- Fix permission issue - Supabase doesn't allow session_replication_role changes
-- Create alternative approach without disabling triggers

-- 1. Create claim functions that work within Supabase permissions
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
    -- This bypasses the sync function interference
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

-- 2. Create token claim function with same approach
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

-- 3. Alternative approach: Modify the sync function to be staking-aware
-- This preserves existing staking claims when syncing
CREATE OR REPLACE FUNCTION sync_user_balance_from_all_sources(user_wallet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  aggregated_data JSON;
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
  existing_staking_claims DECIMAL(18,8) := 0;
  sync_result TEXT;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN 'ERROR: user_wallet parameter cannot be null or empty';
  END IF;

  -- Get existing staking claims to preserve them
  SELECT COALESCE(
    (SELECT SUM(total_nft_claimed + total_token_claimed) 
     FROM staking_rewards 
     WHERE wallet_address = user_wallet),
    0
  ) INTO existing_staking_claims;

  -- Get aggregated data from all reward sources
  BEGIN
    aggregated_data := aggregate_user_rewards_from_all_sources(user_wallet);
    
    -- Check if aggregation returned an error
    IF aggregated_data->>'error' IS NOT NULL THEN
      RETURN 'ERROR in aggregation: ' || (aggregated_data->>'error');
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN 'ERROR calling aggregation function: ' || SQLERRM;
  END;
  
  -- Extract values from JSON with proper error handling
  BEGIN
    total_neft := COALESCE((aggregated_data->>'total_neft_claimed')::DECIMAL(18,8), 0);
    total_xp := COALESCE((aggregated_data->>'total_xp_earned')::INTEGER, 0);
    available_neft := COALESCE((aggregated_data->>'available_neft')::DECIMAL(18,8), 0);
  EXCEPTION WHEN OTHERS THEN
    RETURN 'ERROR parsing aggregated data: ' || SQLERRM;
  END;
  
  -- ADD existing staking claims to preserve them
  total_neft := total_neft + existing_staking_claims;
  
  -- Insert or update user_balances table with aggregated data + staking claims
  BEGIN
    INSERT INTO user_balances (
      wallet_address,
      total_neft_claimed,
      total_xp_earned,
      available_neft,
      last_updated
    ) VALUES (
      user_wallet,
      total_neft,
      total_xp,
      available_neft,
      NOW()
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET
      total_neft_claimed = EXCLUDED.total_neft_claimed,
      total_xp_earned = EXCLUDED.total_xp_earned,
      available_neft = EXCLUDED.available_neft,
      last_updated = NOW();
      
    sync_result := 'SUCCESS: Synced balance for wallet: ' || user_wallet || 
                   ' - NEFT: ' || total_neft || ' (including ' || existing_staking_claims || ' staking claims)' ||
                   ', XP: ' || total_xp || 
                   ', Available: ' || available_neft;
                   
  EXCEPTION WHEN OTHERS THEN
    sync_result := 'ERROR updating user_balances: ' || SQLERRM;
  END;
    
  RETURN sync_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION claim_nft_rewards_supabase_safe(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_token_rewards_supabase_safe(TEXT) TO authenticated, anon, public;

DO $$
BEGIN
    RAISE NOTICE '=== SUPABASE-SAFE CLAIM FUNCTIONS DEPLOYED ===';
    RAISE NOTICE 'Fixed permission issue by avoiding session_replication_role';
    RAISE NOTICE 'New functions:';
    RAISE NOTICE '- claim_nft_rewards_supabase_safe(wallet)';
    RAISE NOTICE '- claim_token_rewards_supabase_safe(wallet)';
    RAISE NOTICE 'Also updated sync function to preserve staking claims';
END $$;
