-- ============================================================================
-- UNIFIED BALANCE SYSTEM FOR MULTI-ACCOUNT AUTHENTICATION
-- Ensures same balance display for primary wallet and all linked connections
-- Solves: Primary wallet shows 0, social accounts show correct balance
-- ============================================================================

-- Step 1: Create unified user account resolution function
CREATE OR REPLACE FUNCTION get_primary_user_id(input_wallet TEXT)
RETURNS TEXT AS $$
DECLARE
  primary_wallet TEXT;
  user_record RECORD;
BEGIN
  -- First, try to find if this is already a primary wallet
  SELECT wallet_address INTO primary_wallet
  FROM users 
  WHERE wallet_address = input_wallet;
  
  IF FOUND THEN
    RETURN primary_wallet;
  END IF;
  
  -- Check if this wallet is linked to another primary account
  SELECT wallet_address INTO primary_wallet
  FROM users 
  WHERE linked_wallet_addresses @> to_jsonb(ARRAY[input_wallet])
     OR linked_social_accounts @> to_jsonb(ARRAY[input_wallet]);
  
  IF FOUND THEN
    RETURN primary_wallet;
  END IF;
  
  -- If not found anywhere, return the input wallet (will be treated as primary)
  RETURN input_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create function to get all linked accounts for a user
CREATE OR REPLACE FUNCTION get_all_user_accounts(primary_wallet TEXT)
RETURNS TEXT[] AS $$
DECLARE
  all_accounts TEXT[] := ARRAY[primary_wallet];
  linked_wallets JSONB;
  linked_socials JSONB;
BEGIN
  -- Get linked accounts from users table
  SELECT 
    COALESCE(linked_wallet_addresses, '[]'::jsonb),
    COALESCE(linked_social_accounts, '[]'::jsonb)
  INTO linked_wallets, linked_socials
  FROM users 
  WHERE wallet_address = primary_wallet;
  
  -- Add linked wallet addresses
  IF linked_wallets IS NOT NULL THEN
    SELECT array_cat(all_accounts, ARRAY(SELECT jsonb_array_elements_text(linked_wallets)))
    INTO all_accounts;
  END IF;
  
  -- Add linked social accounts
  IF linked_socials IS NOT NULL THEN
    SELECT array_cat(all_accounts, ARRAY(SELECT jsonb_array_elements_text(linked_socials)))
    INTO all_accounts;
  END IF;
  
  RETURN all_accounts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create unified balance aggregation function
CREATE OR REPLACE FUNCTION get_unified_user_balance(input_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  primary_wallet TEXT;
  all_accounts TEXT[];
  account TEXT;
  
  -- Aggregated totals from all linked accounts
  total_neft DECIMAL(18,8) := 0;
  total_xp INTEGER := 0;
  total_referral_neft DECIMAL(18,8) := 0;
  total_staked DECIMAL(18,8) := 0;
  total_nfts INTEGER := 0;
  
  -- Temporary variables for each account
  account_neft DECIMAL(18,8);
  account_xp INTEGER;
  account_referral DECIMAL(18,8);
  account_staked DECIMAL(18,8);
  account_nfts INTEGER;
  
  result JSON;
BEGIN
  -- Get the primary user ID
  primary_wallet := get_primary_user_id(input_wallet);
  
  -- Get all linked accounts
  all_accounts := get_all_user_accounts(primary_wallet);
  
  RAISE LOG 'Unified balance for input: %, primary: %, all accounts: %', 
    input_wallet, primary_wallet, all_accounts;
  
  -- Aggregate balances from all linked accounts
  FOREACH account IN ARRAY all_accounts
  LOOP
    -- Reset variables
    account_neft := 0;
    account_xp := 0;
    account_referral := 0;
    account_staked := 0;
    account_nfts := 0;
    
    -- Get balance from user_balances table
    BEGIN
      SELECT 
        COALESCE(ub.total_neft_claimed, 0),
        COALESCE(ub.total_xp_earned, 0)
      INTO account_neft, account_xp
      FROM user_balances ub
      WHERE ub.wallet_address = account;
    EXCEPTION WHEN OTHERS THEN
      -- Continue if table doesn't exist or other error
      NULL;
    END;
    
    -- Get daily claims
    BEGIN
      SELECT 
        COALESCE(SUM(dc.total_neft_reward), 0),
        COALESCE(SUM(dc.total_xp_reward), 0)
      INTO account_neft, account_xp
      FROM daily_claims dc
      WHERE dc.wallet_address = account;
      
      total_neft := total_neft + account_neft;
      total_xp := total_xp + account_xp;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Get achievement rewards
    BEGIN
      SELECT 
        COALESCE(SUM(ua.neft_reward), 0),
        COALESCE(SUM(ua.xp_reward), 0)
      INTO account_neft, account_xp
      FROM user_achievements ua
      WHERE ua.wallet_address = account 
        AND ua.status = 'completed' 
        AND ua.claimed_at IS NOT NULL;
      
      total_neft := total_neft + account_neft;
      total_xp := total_xp + account_xp;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Get staking rewards
    BEGIN
      SELECT COALESCE(SUM(sr.reward_amount), 0)
      INTO account_neft
      FROM staking_rewards sr
      WHERE sr.wallet_address = account 
        AND sr.is_claimed = true;
      
      total_neft := total_neft + account_neft;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Get referral rewards
    BEGIN
      SELECT COALESCE(ur.total_neft_earned, 0)
      INTO account_referral
      FROM user_referrals ur
      WHERE ur.wallet_address = account;
      
      total_referral_neft := total_referral_neft + account_referral;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Get staked tokens
    BEGIN
      SELECT COALESCE(SUM(st.amount), 0)
      INTO account_staked
      FROM staked_tokens st
      WHERE st.wallet_address = account;
      
      total_staked := total_staked + account_staked;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Get NFT count
    BEGIN
      SELECT COUNT(*)
      INTO account_nfts
      FROM user_ipfs_mappings uim
      WHERE uim.wallet_address = account;
      
      total_nfts := total_nfts + account_nfts;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    RAISE LOG 'Account % contributed: NEFT=%, XP=%, Referral=%, Staked=%, NFTs=%', 
      account, account_neft, account_xp, account_referral, account_staked, account_nfts;
  END LOOP;
  
  -- Add referrals to total NEFT
  total_neft := total_neft + total_referral_neft;
  
  -- Build unified result
  SELECT json_build_object(
    'total_neft_claimed', total_neft,
    'total_xp_earned', total_xp,
    'total_nft_count', total_nfts,
    'available_neft', GREATEST(0, total_neft - total_staked),
    'available_xp', total_xp,
    'staked_neft', total_staked,
    'staked_tokens', total_staked,
    'current_level', CASE 
      WHEN total_xp >= 1000 THEN 5
      WHEN total_xp >= 500 THEN 4
      WHEN total_xp >= 250 THEN 3
      WHEN total_xp >= 100 THEN 2
      ELSE 1
    END,
    'referral_neft', total_referral_neft,
    'referral_xp', 0,
    'referral_count', 0,
    'last_updated', NOW(),
    'primary_wallet', primary_wallet,
    'linked_accounts', array_to_json(all_accounts),
    'unified_balance', true
  ) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in get_unified_user_balance for %: %', input_wallet, SQLERRM;
    
    SELECT json_build_object(
      'total_neft_claimed', 0,
      'total_xp_earned', 0,
      'total_nft_count', 0,
      'available_neft', 0,
      'available_xp', 0,
      'staked_neft', 0,
      'staked_tokens', 0,
      'current_level', 1,
      'referral_neft', 0,
      'referral_xp', 0,
      'referral_count', 0,
      'last_updated', NOW(),
      'primary_wallet', input_wallet,
      'linked_accounts', ARRAY[input_wallet],
      'unified_balance', true,
      'error', 'Unified balance calculation failed'
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create function to sync unified balance to primary account
CREATE OR REPLACE FUNCTION sync_unified_balance(input_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  primary_wallet TEXT;
  unified_balance JSON;
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
  staked_neft DECIMAL(18,8);
BEGIN
  -- Get primary wallet
  primary_wallet := get_primary_user_id(input_wallet);
  
  -- Get unified balance
  unified_balance := get_unified_user_balance(input_wallet);
  
  -- Extract values
  total_neft := (unified_balance->>'total_neft_claimed')::DECIMAL(18,8);
  total_xp := (unified_balance->>'total_xp_earned')::INTEGER;
  available_neft := (unified_balance->>'available_neft')::DECIMAL(18,8);
  staked_neft := (unified_balance->>'staked_neft')::DECIMAL(18,8);
  
  -- Update user_balances table for primary wallet
  INSERT INTO user_balances (
    wallet_address,
    total_neft_claimed,
    total_xp_earned,
    available_neft,
    staked_neft,
    updated_at
  ) VALUES (
    primary_wallet,
    total_neft,
    total_xp,
    available_neft,
    staked_neft,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = EXCLUDED.total_neft_claimed,
    total_xp_earned = EXCLUDED.total_xp_earned,
    available_neft = EXCLUDED.available_neft,
    staked_neft = EXCLUDED.staked_neft,
    updated_at = NOW();
  
  RETURN json_build_object(
    'success', true,
    'input_wallet', input_wallet,
    'primary_wallet', primary_wallet,
    'total_neft_claimed', total_neft,
    'total_xp_earned', total_xp,
    'synced_at', NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'input_wallet', input_wallet
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create function to link accounts
CREATE OR REPLACE FUNCTION link_account_to_primary(primary_wallet TEXT, new_account TEXT, account_type TEXT DEFAULT 'wallet')
RETURNS JSON AS $$
DECLARE
  current_linked_wallets JSONB;
  current_linked_socials JSONB;
  updated_wallets JSONB;
  updated_socials JSONB;
BEGIN
  -- Get current linked accounts
  SELECT 
    COALESCE(linked_wallet_addresses, '[]'::jsonb),
    COALESCE(linked_social_accounts, '[]'::jsonb)
  INTO current_linked_wallets, current_linked_socials
  FROM users 
  WHERE wallet_address = primary_wallet;
  
  -- Add new account to appropriate array
  IF account_type = 'social' THEN
    -- Add to social accounts if not already present
    IF NOT (current_linked_socials @> to_jsonb(ARRAY[new_account])) THEN
      updated_socials := current_linked_socials || to_jsonb(ARRAY[new_account]);
      
      UPDATE users 
      SET linked_social_accounts = updated_socials,
          updated_at = NOW()
      WHERE wallet_address = primary_wallet;
    END IF;
  ELSE
    -- Add to wallet addresses if not already present
    IF NOT (current_linked_wallets @> to_jsonb(ARRAY[new_account])) THEN
      updated_wallets := current_linked_wallets || to_jsonb(ARRAY[new_account]);
      
      UPDATE users 
      SET linked_wallet_addresses = updated_wallets,
          updated_at = NOW()
      WHERE wallet_address = primary_wallet;
    END IF;
  END IF;
  
  -- Sync unified balance after linking
  PERFORM sync_unified_balance(primary_wallet);
  
  RETURN json_build_object(
    'success', true,
    'primary_wallet', primary_wallet,
    'linked_account', new_account,
    'account_type', account_type,
    'linked_at', NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'primary_wallet', primary_wallet,
      'new_account', new_account
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION get_primary_user_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_primary_user_id(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_primary_user_id(TEXT) TO public;

GRANT EXECUTE ON FUNCTION get_all_user_accounts(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_user_accounts(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_all_user_accounts(TEXT) TO public;

GRANT EXECUTE ON FUNCTION get_unified_user_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_user_balance(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_unified_user_balance(TEXT) TO public;

GRANT EXECUTE ON FUNCTION sync_unified_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_unified_balance(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION sync_unified_balance(TEXT) TO public;

GRANT EXECUTE ON FUNCTION link_account_to_primary(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION link_account_to_primary(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION link_account_to_primary(TEXT, TEXT, TEXT) TO public;




DO $$
BEGIN
    RAISE NOTICE 'UNIFIED BALANCE SYSTEM DEPLOYED!';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '✅ Resolves primary user ID from any linked account';
    RAISE NOTICE '✅ Aggregates balance from all linked accounts';
    RAISE NOTICE '✅ Shows same balance for primary wallet and social accounts';
    RAISE NOTICE '✅ Account linking system for profile editing';
    RAISE NOTICE '✅ Automatic balance synchronization';
    RAISE NOTICE 'Next: Update UserBalanceService to use get_unified_user_balance()';
END $$;
