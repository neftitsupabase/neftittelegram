-- ============================================================================
-- BALANCE VALIDATION CHECKS TO DETECT INCONSISTENCIES
-- Comprehensive validation system to identify balance discrepancies
-- ============================================================================

-- Step 1: Create balance validation function
CREATE OR REPLACE FUNCTION validate_user_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  
  -- Current balance from user_balances table
  current_neft DECIMAL(18,8) := 0;
  current_xp INTEGER := 0;
  current_available DECIMAL(18,8) := 0;
  
  -- Calculated balance from source tables
  calculated_neft DECIMAL(18,8) := 0;
  calculated_xp INTEGER := 0;
  calculated_available DECIMAL(18,8) := 0;
  
  -- Individual source totals
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  daily_neft DECIMAL(18,8) := 0;
  daily_xp INTEGER := 0;
  campaign_neft DECIMAL(18,8) := 0;
  campaign_xp INTEGER := 0;
  staking_neft DECIMAL(18,8) := 0;
  referral_neft DECIMAL(18,8) := 0;
  staked_amount DECIMAL(18,8) := 0;
  
  -- Validation results
  neft_difference DECIMAL(18,8);
  xp_difference INTEGER;
  available_difference DECIMAL(18,8);
  validation_status TEXT;
  issues TEXT[] := ARRAY[]::TEXT[];
  
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN json_build_object('error', 'user_wallet parameter cannot be null or empty');
  END IF;

  -- Get current balance from user_balances table
  BEGIN
    SELECT 
      COALESCE(total_neft_claimed, 0),
      COALESCE(total_xp_earned, 0),
      COALESCE(available_neft, 0)
    INTO current_neft, current_xp, current_available
    FROM user_balances 
    WHERE wallet_address = user_wallet;
    
    IF NOT FOUND THEN
      current_neft := 0;
      current_xp := 0;
      current_available := 0;
      issues := array_append(issues, 'No entry in user_balances table');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Error reading user_balances: ' || SQLERRM);
  END;

  -- Calculate from achievements (claimed only)
  BEGIN
    SELECT 
      COALESCE(SUM(am.neft_reward), 0),
      COALESCE(SUM(am.xp_reward), 0)
    INTO achievement_neft, achievement_xp
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = user_wallet 
      AND ua.status = 'completed' 
      AND ua.claimed_at IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Error calculating achievement rewards: ' || SQLERRM);
  END;

  -- Calculate from daily claims
  BEGIN
    SELECT 
      COALESCE(SUM(base_neft_reward + bonus_neft_reward), 0),
      COALESCE(SUM(base_xp_reward + bonus_xp_reward), 0)
    INTO daily_neft, daily_xp
    FROM daily_claims 
    WHERE wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Error calculating daily claims: ' || SQLERRM);
  END;

  -- Calculate from campaign rewards
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO campaign_neft, campaign_xp
    FROM campaign_reward_claims 
    WHERE wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Error calculating campaign rewards: ' || SQLERRM);
  END;

  -- Calculate from staking rewards
  BEGIN
    SELECT 
      COALESCE(SUM(total_nft_claimed + total_token_claimed), 0)
    INTO staking_neft
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
      AND claimed = true;
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Error calculating staking rewards: ' || SQLERRM);
  END;

  -- Calculate from referral rewards
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0)
    INTO referral_neft
    FROM referral_rewards 
    WHERE referrer_wallet = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Error calculating referral rewards: ' || SQLERRM);
  END;

  -- Calculate staked amount
  BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO staked_amount
    FROM staked_tokens 
    WHERE wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Error calculating staked amount: ' || SQLERRM);
  END;

  -- Calculate totals
  calculated_neft := achievement_neft + daily_neft + campaign_neft + staking_neft + referral_neft;
  calculated_xp := achievement_xp + daily_xp + campaign_xp;
  calculated_available := GREATEST(0, calculated_neft - staked_amount);

  -- Calculate differences
  neft_difference := current_neft - calculated_neft;
  xp_difference := current_xp - calculated_xp;
  available_difference := current_available - calculated_available;

  -- Determine validation status
  IF ABS(neft_difference) > 0.00000001 OR ABS(xp_difference) > 0 OR ABS(available_difference) > 0.00000001 THEN
    validation_status := 'INCONSISTENT';
    
    IF neft_difference > 0 THEN
      issues := array_append(issues, 'EXCESS NEFT: ' || neft_difference || ' more than expected');
    ELSIF neft_difference < 0 THEN
      issues := array_append(issues, 'MISSING NEFT: ' || ABS(neft_difference) || ' less than expected');
    END IF;
    
    IF xp_difference > 0 THEN
      issues := array_append(issues, 'EXCESS XP: ' || xp_difference || ' more than expected');
    ELSIF xp_difference < 0 THEN
      issues := array_append(issues, 'MISSING XP: ' || ABS(xp_difference) || ' less than expected');
    END IF;
    
    IF available_difference > 0 THEN
      issues := array_append(issues, 'EXCESS AVAILABLE: ' || available_difference || ' more than expected');
    ELSIF available_difference < 0 THEN
      issues := array_append(issues, 'MISSING AVAILABLE: ' || ABS(available_difference) || ' less than expected');
    END IF;
  ELSE
    validation_status := 'CONSISTENT';
  END IF;

  -- Build result JSON
  SELECT json_build_object(
    'wallet_address', user_wallet,
    'validation_status', validation_status,
    'current_balance', json_build_object(
      'total_neft_claimed', current_neft,
      'total_xp_earned', current_xp,
      'available_neft', current_available
    ),
    'calculated_balance', json_build_object(
      'total_neft_claimed', calculated_neft,
      'total_xp_earned', calculated_xp,
      'available_neft', calculated_available
    ),
    'differences', json_build_object(
      'neft_difference', neft_difference,
      'xp_difference', xp_difference,
      'available_difference', available_difference
    ),
    'source_breakdown', json_build_object(
      'achievement_neft', achievement_neft,
      'achievement_xp', achievement_xp,
      'daily_neft', daily_neft,
      'daily_xp', daily_xp,
      'campaign_neft', campaign_neft,
      'campaign_xp', campaign_xp,
      'staking_neft', staking_neft,
      'referral_neft', referral_neft,
      'staked_amount', staked_amount
    ),
    'issues', issues,
    'validated_at', NOW()
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create bulk validation function for all users
CREATE OR REPLACE FUNCTION validate_all_user_balances()
RETURNS TABLE(
  wallet_address TEXT,
  validation_status TEXT,
  neft_difference DECIMAL(18,8),
  xp_difference INTEGER,
  issue_count INTEGER,
  issues TEXT[]
) AS $$
DECLARE
  wallet_record RECORD;
  validation_result JSON;
BEGIN
  -- Get all unique wallet addresses
  FOR wallet_record IN 
    SELECT DISTINCT ub.wallet_address FROM user_balances ub
    WHERE ub.wallet_address IS NOT NULL AND ub.wallet_address != ''
  LOOP
    -- Validate each wallet
    BEGIN
      validation_result := validate_user_balance(wallet_record.wallet_address);
      
      RETURN QUERY SELECT 
        wallet_record.wallet_address,
        (validation_result->>'validation_status')::TEXT,
        ((validation_result->'differences'->>'neft_difference')::DECIMAL(18,8)),
        ((validation_result->'differences'->>'xp_difference')::INTEGER),
        array_length(ARRAY(SELECT json_array_elements_text(validation_result->'issues')), 1),
        ARRAY(SELECT json_array_elements_text(validation_result->'issues'));
        
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        wallet_record.wallet_address,
        'ERROR'::TEXT,
        0::DECIMAL(18,8),
        0::INTEGER,
        1::INTEGER,
        ARRAY['Validation failed: ' || SQLERRM]::TEXT[];
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Test validation for your specific wallet
SELECT 'BALANCE VALIDATION FOR YOUR WALLET:' as validation_test;
SELECT validate_user_balance('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as validation_result;

-- Step 4: Quick validation summary for your wallet
SELECT 'VALIDATION SUMMARY:' as summary;
WITH validation_data AS (
  SELECT validate_user_balance('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as result
)
SELECT 
  (result->>'validation_status') as status,
  (result->'differences'->>'neft_difference')::DECIMAL as neft_diff,
  (result->'differences'->>'xp_difference')::INTEGER as xp_diff,
  array_length(ARRAY(SELECT json_array_elements_text(result->'issues')), 1) as issue_count,
  ARRAY(SELECT json_array_elements_text(result->'issues')) as issues
FROM validation_data;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION validate_user_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_all_user_balances() TO authenticated;

-- Step 6: Create automated validation check (optional)
CREATE OR REPLACE FUNCTION check_balance_consistency()
RETURNS TEXT AS $$
DECLARE
  inconsistent_count INTEGER;
  total_count INTEGER;
  result_text TEXT;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE validation_status = 'INCONSISTENT'),
    COUNT(*)
  INTO inconsistent_count, total_count
  FROM validate_all_user_balances();
  
  IF inconsistent_count = 0 THEN
    result_text := 'All ' || total_count || ' user balances are consistent';
  ELSE
    result_text := inconsistent_count || ' out of ' || total_count || ' user balances are inconsistent';
  END IF;
  
  RETURN result_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'BALANCE VALIDATION SYSTEM CREATED SUCCESSFULLY!' as status;
SELECT 'Use validate_user_balance(wallet) to check individual users' as usage_1;
SELECT 'Use validate_all_user_balances() to check all users' as usage_2;
SELECT 'Use check_balance_consistency() for quick overview' as usage_3;
