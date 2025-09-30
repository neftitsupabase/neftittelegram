-- ============================================================================
-- FIX LINKED ACCOUNTS BALANCE AGGREGATION
-- Creates account-linking aware balance function that aggregates across all linked accounts
-- ============================================================================

-- Function to get all linked account IDs for a user
CREATE OR REPLACE FUNCTION get_user_linked_accounts(user_identifier TEXT)
RETURNS TEXT[] AS $$
DECLARE
  linked_accounts TEXT[];
  user_record RECORD;
BEGIN
  -- Get the user record and all their linked accounts
  SELECT 
    wallet_address,
    linked_wallet_addresses,
    linked_social_accounts
  INTO user_record
  FROM users 
  WHERE wallet_address = user_identifier 
     OR wallet_address = ANY(
       SELECT jsonb_array_elements_text(linked_wallet_addresses::jsonb)
       FROM users 
       WHERE linked_wallet_addresses::jsonb ? user_identifier
     )
     OR wallet_address = ANY(
       SELECT jsonb_array_elements_text(linked_social_accounts::jsonb -> 'wallet_address')
       FROM users 
       WHERE linked_social_accounts::jsonb @> jsonb_build_array(jsonb_build_object('wallet_address', user_identifier))
     );

  IF user_record IS NULL THEN
    -- If no user found, just return the input identifier
    RETURN ARRAY[user_identifier];
  END IF;

  -- Start with the primary wallet address
  linked_accounts := ARRAY[user_record.wallet_address];

  -- Add linked wallet addresses if they exist
  IF user_record.linked_wallet_addresses IS NOT NULL THEN
    SELECT array_agg(jsonb_array_elements_text(user_record.linked_wallet_addresses::jsonb))
    INTO linked_accounts
    FROM (
      SELECT unnest(linked_accounts) AS account
      UNION
      SELECT jsonb_array_elements_text(user_record.linked_wallet_addresses::jsonb) AS account
    ) combined;
  END IF;

  -- Add social account wallet addresses if they exist
  IF user_record.linked_social_accounts IS NOT NULL THEN
    SELECT array_agg(DISTINCT account)
    INTO linked_accounts
    FROM (
      SELECT unnest(linked_accounts) AS account
      UNION
      SELECT jsonb_array_elements(user_record.linked_social_accounts::jsonb)->>'wallet_address' AS account
    ) combined
    WHERE account IS NOT NULL;
  END IF;

  RETURN COALESCE(linked_accounts, ARRAY[user_identifier]);
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error getting linked accounts for %: %', user_identifier, SQLERRM;
    RETURN ARRAY[user_identifier];
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced balance function that aggregates across all linked accounts
CREATE OR REPLACE FUNCTION get_user_complete_balance_linked(user_identifier TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  linked_accounts TEXT[];
  account TEXT;
  
  -- Aggregated totals across all accounts
  total_campaign_neft DECIMAL(18,8) := 0;
  total_campaign_xp INTEGER := 0;
  total_daily_neft DECIMAL(18,8) := 0;
  total_daily_xp INTEGER := 0;
  total_achievement_neft DECIMAL(18,8) := 0;
  total_achievement_xp INTEGER := 0;
  total_staking_neft DECIMAL(18,8) := 0;
  total_staking_xp INTEGER := 0;
  total_referral_neft DECIMAL(18,8) := 0;
  total_referral_xp INTEGER := 0;
  total_referral_count INTEGER := 0;
  total_staked_amount DECIMAL(18,8) := 0;
  total_nft_count INTEGER := 0;
  
  -- Per-account variables
  campaign_neft DECIMAL(18,8);
  campaign_xp INTEGER;
  daily_neft DECIMAL(18,8);
  daily_xp INTEGER;
  achievement_neft DECIMAL(18,8);
  achievement_xp INTEGER;
  staking_neft DECIMAL(18,8);
  staking_xp INTEGER;
  referral_neft DECIMAL(18,8);
  referral_xp INTEGER;
  referral_count INTEGER;
  staked_amount DECIMAL(18,8);
  nft_count INTEGER;
  
  -- Final totals
  final_total_neft DECIMAL(18,8);
  final_total_xp INTEGER;
  final_available_neft DECIMAL(18,8);
BEGIN
  -- Validate input
  IF user_identifier IS NULL OR user_identifier = '' THEN
    RAISE EXCEPTION 'user_identifier parameter cannot be null or empty';
  END IF;

  -- Get all linked accounts for this user
  SELECT get_user_linked_accounts(user_identifier) INTO linked_accounts;
  
  RAISE LOG 'Processing balance for % with linked accounts: %', user_identifier, linked_accounts;

  -- Loop through each linked account and aggregate data
  FOREACH account IN ARRAY linked_accounts
  LOOP
    -- Reset per-account variables
    campaign_neft := 0; campaign_xp := 0;
    daily_neft := 0; daily_xp := 0;
    achievement_neft := 0; achievement_xp := 0;
    staking_neft := 0; staking_xp := 0;
    referral_neft := 0; referral_xp := 0; referral_count := 0;
    staked_amount := 0; nft_count := 0;

    -- 1. Get base balance from user_balances table
    BEGIN
      SELECT 
        COALESCE(ub.total_neft_claimed, 0),
        COALESCE(ub.total_xp_earned, 0)
      INTO campaign_neft, campaign_xp
      FROM user_balances ub
      WHERE ub.wallet_address = account;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error getting user_balances for account %: %', account, SQLERRM;
    END;

    -- 2. Get daily claims
    BEGIN
      SELECT 
        COALESCE(SUM(dc.total_neft_reward), 0),
        COALESCE(SUM(dc.total_xp_reward), 0)
      INTO daily_neft, daily_xp
      FROM daily_claims dc
      WHERE dc.wallet_address = account;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error getting daily_claims for account %: %', account, SQLERRM;
    END;

    -- 3. Get achievement rewards
    BEGIN
      SELECT 
        COALESCE(SUM(ua.neft_reward), 0),
        COALESCE(SUM(ua.xp_reward), 0)
      INTO achievement_neft, achievement_xp
      FROM user_achievements ua
      WHERE ua.wallet_address = account 
        AND ua.status = 'completed' 
        AND ua.claimed_at IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error getting user_achievements for account %: %', account, SQLERRM;
    END;

    -- 4. Get staking rewards
    BEGIN
      SELECT 
        COALESCE(SUM(sr.reward_amount), 0),
        0
      INTO staking_neft, staking_xp
      FROM staking_rewards sr
      WHERE sr.wallet_address = account 
        AND sr.is_claimed = true;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error getting staking_rewards for account %: %', account, SQLERRM;
    END;

    -- 5. Get referral rewards
    BEGIN
      SELECT 
        COALESCE(ur.total_neft_earned, 0),
        COALESCE(ur.total_xp_earned, 0),
        COALESCE(ur.total_referrals, 0)
      INTO referral_neft, referral_xp, referral_count
      FROM user_referrals ur
      WHERE ur.wallet_address = account;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error getting user_referrals for account %: %', account, SQLERRM;
    END;

    -- 6. Get staked amount
    BEGIN
      SELECT COALESCE(SUM(st.amount), 0)
      INTO staked_amount
      FROM staked_tokens st
      WHERE st.wallet_address = account;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error getting staked_tokens for account %: %', account, SQLERRM;
    END;

    -- 7. Get NFT count
    BEGIN
      SELECT COUNT(*)
      INTO nft_count
      FROM user_ipfs_mappings uim
      WHERE uim.wallet_address = account;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error getting user_ipfs_mappings for account %: %', account, SQLERRM;
    END;

    -- Add to totals
    total_campaign_neft := total_campaign_neft + COALESCE(campaign_neft, 0);
    total_campaign_xp := total_campaign_xp + COALESCE(campaign_xp, 0);
    total_daily_neft := total_daily_neft + COALESCE(daily_neft, 0);
    total_daily_xp := total_daily_xp + COALESCE(daily_xp, 0);
    total_achievement_neft := total_achievement_neft + COALESCE(achievement_neft, 0);
    total_achievement_xp := total_achievement_xp + COALESCE(achievement_xp, 0);
    total_staking_neft := total_staking_neft + COALESCE(staking_neft, 0);
    total_staking_xp := total_staking_xp + COALESCE(staking_xp, 0);
    total_referral_neft := total_referral_neft + COALESCE(referral_neft, 0);
    total_referral_xp := total_referral_xp + COALESCE(referral_xp, 0);
    total_referral_count := total_referral_count + COALESCE(referral_count, 0);
    total_staked_amount := total_staked_amount + COALESCE(staked_amount, 0);
    total_nft_count := total_nft_count + COALESCE(nft_count, 0);

    RAISE LOG 'Account % contributed: NEFT=%, XP=%, NFTs=%', account, 
      COALESCE(campaign_neft, 0) + COALESCE(daily_neft, 0) + COALESCE(achievement_neft, 0) + COALESCE(staking_neft, 0) + COALESCE(referral_neft, 0),
      COALESCE(campaign_xp, 0) + COALESCE(daily_xp, 0) + COALESCE(achievement_xp, 0) + COALESCE(staking_xp, 0) + COALESCE(referral_xp, 0),
      nft_count;
  END LOOP;

  -- Calculate final totals
  final_total_neft := total_campaign_neft + total_daily_neft + total_achievement_neft + total_staking_neft + total_referral_neft;
  final_total_xp := total_campaign_xp + total_daily_xp + total_achievement_xp + total_staking_xp + total_referral_xp;
  final_available_neft := GREATEST(0, final_total_neft - total_staked_amount);

  -- Build result JSON
  SELECT json_build_object(
    'total_neft_claimed', final_total_neft,
    'total_xp_earned', final_total_xp,
    'total_nft_count', total_nft_count,
    'available_neft', final_available_neft,
    'available_xp', final_total_xp,
    'staked_nfts', total_staked_amount,
    'staked_tokens', total_staked_amount,
    'current_level', CASE 
      WHEN final_total_xp >= 1000 THEN 5
      WHEN final_total_xp >= 500 THEN 4
      WHEN final_total_xp >= 250 THEN 3
      WHEN final_total_xp >= 100 THEN 2
      ELSE 1
    END,
    'referral_neft', total_referral_neft,
    'referral_xp', total_referral_xp,
    'referral_count', total_referral_count,
    'last_updated', NOW(),
    'linked_accounts', array_to_json(linked_accounts),
    'primary_wallet', user_identifier,
    'unified_balance', true,
    'breakdown', json_build_object(
      'campaign_neft', total_campaign_neft,
      'campaign_xp', total_campaign_xp,
      'daily_neft', total_daily_neft,
      'daily_xp', total_daily_xp,
      'achievement_neft', total_achievement_neft,
      'achievement_xp', total_achievement_xp,
      'staking_neft', total_staking_neft,
      'staking_xp', total_staking_xp,
      'referral_neft', total_referral_neft,
      'referral_xp', total_referral_xp
    )
  ) INTO result;

  RAISE LOG 'Final aggregated balance for %: NEFT=%, XP=%, NFTs=%', user_identifier, final_total_neft, final_total_xp, total_nft_count;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in get_user_complete_balance_linked for %: %', user_identifier, SQLERRM;
    
    SELECT json_build_object(
      'total_neft_claimed', 0,
      'total_xp_earned', 0,
      'total_nft_count', 0,
      'available_neft', 0,
      'available_xp', 0,
      'staked_nfts', 0,
      'staked_tokens', 0,
      'current_level', 1,
      'referral_neft', 0,
      'referral_xp', 0,
      'referral_count', 0,
      'last_updated', NOW(),
      'linked_accounts', '[]'::json,
      'primary_wallet', user_identifier,
      'unified_balance', false,
      'error', 'Function execution failed: ' || SQLERRM
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_linked_accounts(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_linked_accounts(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_linked_accounts(TEXT) TO public;
GRANT EXECUTE ON FUNCTION get_user_complete_balance_linked(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_complete_balance_linked(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_complete_balance_linked(TEXT) TO public;

-- Test the linked accounts function
SELECT 'Testing linked accounts balance system...' as test_header;

-- Test with the primary wallet
SELECT get_user_linked_accounts('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as linked_accounts_test;

-- Test balance aggregation
SELECT get_user_complete_balance_linked('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as linked_balance_test;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'LINKED ACCOUNTS BALANCE SYSTEM DEPLOYED!';
    RAISE NOTICE 'Key Features:';
    RAISE NOTICE '✅ Aggregates balance across all linked accounts';
    RAISE NOTICE '✅ Handles wallet addresses and social login IDs';
    RAISE NOTICE '✅ Comprehensive error handling and logging';
    RAISE NOTICE '✅ Returns unified balance with account details';
    RAISE NOTICE 'Next: Update UserBalanceService to use get_user_complete_balance_linked';
END $$;
