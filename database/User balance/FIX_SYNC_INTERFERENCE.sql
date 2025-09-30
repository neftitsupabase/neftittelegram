-- Fix the sync interference that overwrites staking claim rewards
-- The sync_user_balance_from_all_sources function overwrites balance instead of preserving claims

-- 1. First, check which tables have the trigger_comprehensive_balance_sync trigger
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name LIKE '%comprehensive_balance_sync%'
   OR action_statement ILIKE '%sync_user_balance_from_all_sources%';

-- 2. Create a staking-aware version of sync_user_balance_from_all_sources
CREATE OR REPLACE FUNCTION sync_user_balance_preserving_staking_claims(user_wallet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  aggregated_data JSON;
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
  current_staking_claims DECIMAL(18,8) := 0;
  sync_result TEXT;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN 'ERROR: user_wallet parameter cannot be null or empty';
  END IF;

  -- Get current staking claims that might have been just added
  SELECT COALESCE(
    (SELECT SUM(total_nft_claimed + total_token_claimed) 
     FROM staking_rewards 
     WHERE wallet_address = user_wallet AND claimed = true),
    0
  ) INTO current_staking_claims;

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
  
  -- ADD staking claims to the aggregated total (this is what was missing!)
  total_neft := total_neft + current_staking_claims;
  
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
                   ' - NEFT: ' || total_neft || ' (including ' || current_staking_claims || ' staking claims)' ||
                   ', XP: ' || total_xp || 
                   ', Available: ' || available_neft;
                   
  EXCEPTION WHEN OTHERS THEN
    sync_result := 'ERROR updating user_balances: ' || SQLERRM;
  END;
    
  RETURN sync_result;
END;
$$;

-- 3. Create a new trigger function that preserves staking claims
CREATE OR REPLACE FUNCTION trigger_staking_aware_balance_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sync_result TEXT;
  target_wallet TEXT;
BEGIN
  -- Determine the wallet address from the trigger
  IF TG_OP = 'DELETE' THEN
    target_wallet := OLD.wallet_address;
  ELSE
    target_wallet := NEW.wallet_address;
  END IF;
  
  -- Use the staking-aware sync function instead of the overwriting one
  BEGIN
    sync_result := sync_user_balance_preserving_staking_claims(target_wallet);
    
    -- Log the sync result for debugging
    RAISE LOG 'Staking-aware balance sync for % (table: %, op: %): %', 
      target_wallet, TG_TABLE_NAME, TG_OP, sync_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the original transaction
    RAISE LOG 'Staking-aware balance sync failed for % (table: %, op: %): %', 
      target_wallet, TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  
  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 4. Temporarily disable the problematic trigger during staking claims
CREATE OR REPLACE FUNCTION claim_nft_rewards_no_sync_interference(user_wallet TEXT)
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
    -- Disable trigger temporarily
    SET session_replication_role = replica;
    
    -- Calculate total claimable NFT rewards
    SELECT 
        COALESCE(SUM(total_nft_earned - total_nft_claimed), 0),
        COUNT(*)
    INTO total_claimable, reward_count
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND total_nft_earned > total_nft_claimed;
    
    IF total_claimable <= 0 THEN
        -- Re-enable trigger
        SET session_replication_role = DEFAULT;
        
        RETURN json_build_object(
            'success', false,
            'message', 'No NFT rewards to claim',
            'total_claimed', 0,
            'rewards_count', 0
        );
    END IF;
    
    -- Update staking_rewards to mark NFT rewards as claimed
    UPDATE staking_rewards 
    SET 
        total_nft_claimed = total_nft_earned,
        last_updated = NOW()
    WHERE wallet_address = user_wallet 
    AND total_nft_earned > total_nft_claimed;
    
    -- Get current balance
    SELECT COALESCE(total_neft_claimed, 0) 
    INTO current_balance
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Calculate new balance
    new_balance := current_balance + total_claimable;
    
    -- Update user balance with explicit addition
    INSERT INTO user_balances (wallet_address, total_neft_claimed, last_updated)
    VALUES (user_wallet, new_balance, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        total_neft_claimed = current_balance + total_claimable,
        last_updated = NOW();
    
    -- Re-enable trigger
    SET session_replication_role = DEFAULT;
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from NFT staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'rewards_count', reward_count,
        'previous_balance', current_balance,
        'new_balance', new_balance
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Re-enable trigger in case of error
    SET session_replication_role = DEFAULT;
    
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming NFT rewards: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;

-- 5. Create token claim function with same protection
CREATE OR REPLACE FUNCTION claim_token_rewards_no_sync_interference(user_wallet TEXT)
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
    -- Disable trigger temporarily
    SET session_replication_role = replica;
    
    -- Calculate total claimable token rewards
    SELECT 
        COALESCE(SUM(total_token_earned - total_token_claimed), 0),
        COUNT(*)
    INTO total_claimable, reward_count
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
    AND total_token_earned > total_token_claimed;
    
    IF total_claimable <= 0 THEN
        -- Re-enable trigger
        SET session_replication_role = DEFAULT;
        
        RETURN json_build_object(
            'success', false,
            'message', 'No token rewards to claim',
            'total_claimed', 0,
            'rewards_count', 0
        );
    END IF;
    
    -- Update staking_rewards to mark token rewards as claimed
    UPDATE staking_rewards 
    SET 
        total_token_claimed = total_token_earned,
        last_updated = NOW()
    WHERE wallet_address = user_wallet 
    AND total_token_earned > total_token_claimed;
    
    -- Get current balance
    SELECT COALESCE(total_neft_claimed, 0) 
    INTO current_balance
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    -- Calculate new balance
    new_balance := current_balance + total_claimable;
    
    -- Update user balance with explicit addition
    INSERT INTO user_balances (wallet_address, total_neft_claimed, last_updated)
    VALUES (user_wallet, new_balance, NOW())
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        total_neft_claimed = current_balance + total_claimable,
        last_updated = NOW();
    
    -- Re-enable trigger
    SET session_replication_role = DEFAULT;
    
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully claimed %s NEFT from token staking rewards', total_claimable),
        'total_claimed', total_claimable,
        'rewards_count', reward_count,
        'previous_balance', current_balance,
        'new_balance', new_balance
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Re-enable trigger in case of error
    SET session_replication_role = DEFAULT;
    
    RETURN json_build_object(
        'success', false,
        'message', 'Error claiming token rewards: ' || SQLERRM,
        'error', SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_user_balance_preserving_staking_claims(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_nft_rewards_no_sync_interference(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_token_rewards_no_sync_interference(TEXT) TO authenticated, anon, public;

DO $$
BEGIN
    RAISE NOTICE '=== SYNC INTERFERENCE FIX DEPLOYED ===';
    RAISE NOTICE 'The problem: sync_user_balance_from_all_sources overwrites staking claims';
    RAISE NOTICE 'The solution: New claim functions disable triggers during balance updates';
    RAISE NOTICE 'Use these functions instead:';
    RAISE NOTICE '- claim_nft_rewards_no_sync_interference(wallet)';
    RAISE NOTICE '- claim_token_rewards_no_sync_interference(wallet)';
    RAISE NOTICE 'Also created: sync_user_balance_preserving_staking_claims() for future use';
END $$;
