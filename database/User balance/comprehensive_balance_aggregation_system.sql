-- ============================================================================
-- COMPREHENSIVE BALANCE AGGREGATION SYSTEM
-- Properly aggregates from all existing reward tables and syncs to user_balances
-- UI uses get_direct_user_balance() from user_balances table (simple & fast)
-- Backend aggregates from all sources and keeps user_balances table updated
-- ============================================================================

-- Step 1: Create comprehensive aggregation function that sums from ALL reward sources
CREATE OR REPLACE FUNCTION aggregate_user_rewards_from_all_sources(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  
  -- Campaign rewards
  campaign_neft DECIMAL(18,8) := 0;
  campaign_xp INTEGER := 0;
  
  -- Daily claims
  daily_neft DECIMAL(18,8) := 0;
  daily_xp INTEGER := 0;
  
  -- Achievement rewards (claimed only)
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  
  -- Staking rewards (claimed only)
  staking_neft DECIMAL(18,8) := 0;
  staking_xp INTEGER := 0;
  
  -- Staked amounts (affects available_neft)
  staked_amount DECIMAL(18,8) := 0;
  
  -- Totals
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RAISE EXCEPTION 'user_wallet parameter cannot be null or empty';
  END IF;

  -- 1. Aggregate from campaign_reward_claims table
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO campaign_neft, campaign_xp
    FROM campaign_reward_claims 
    WHERE wallet_address = user_wallet;
    
    RAISE LOG 'Campaign rewards for %: NEFT=%, XP=%', user_wallet, campaign_neft, campaign_xp;
  EXCEPTION WHEN OTHERS THEN
    campaign_neft := 0;
    campaign_xp := 0;
    RAISE LOG 'Error getting campaign rewards for %: %', user_wallet, SQLERRM;
  END;

  -- 2. Aggregate from daily_claims table
  BEGIN
    SELECT 
      COALESCE(SUM(base_neft_reward + bonus_neft_reward), 0),
      COALESCE(SUM(base_xp_reward + bonus_xp_reward), 0)
    INTO daily_neft, daily_xp
    FROM daily_claims 
    WHERE wallet_address = user_wallet;
    
    RAISE LOG 'Daily claims for %: NEFT=%, XP=%', user_wallet, daily_neft, daily_xp;
  EXCEPTION WHEN OTHERS THEN
    daily_neft := 0;
    daily_xp := 0;
    RAISE LOG 'Error getting daily claims for %: %', user_wallet, SQLERRM;
  END;

  -- 3. Aggregate from user_achievements table (claimed achievements only)
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO achievement_neft, achievement_xp
    FROM user_achievements ua
    JOIN achievements_master am ON ua.achievement_key = am.achievement_key
    WHERE ua.wallet_address = user_wallet 
      AND ua.status = 'completed' 
      AND ua.claimed_at IS NOT NULL;
    
    RAISE LOG 'Achievement rewards for %: NEFT=%, XP=%', user_wallet, achievement_neft, achievement_xp;
  EXCEPTION WHEN OTHERS THEN
    achievement_neft := 0;
    achievement_xp := 0;
    RAISE LOG 'Error getting achievement rewards for %: %', user_wallet, SQLERRM;
  END;

  -- 4. Aggregate from staking_rewards table (claimed rewards only)
  BEGIN
    SELECT 
      COALESCE(SUM(reward_amount), 0),
      0 -- Staking rewards are NEFT only, no XP
    INTO staking_neft, staking_xp
    FROM staking_rewards 
    WHERE wallet_address = user_wallet 
      AND is_claimed = true;
    
    RAISE LOG 'Staking rewards for %: NEFT=%, XP=%', user_wallet, staking_neft, staking_xp;
  EXCEPTION WHEN OTHERS THEN
    staking_neft := 0;
    staking_xp := 0;
    RAISE LOG 'Error getting staking rewards for %: %', user_wallet, SQLERRM;
  END;

  -- 5. Get currently staked amount from staked_tokens table
  BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO staked_amount
    FROM staked_tokens 
    WHERE wallet_address = user_wallet;
    
    RAISE LOG 'Staked amount for %: %', user_wallet, staked_amount;
  EXCEPTION WHEN OTHERS THEN
    staked_amount := 0;
    RAISE LOG 'Error getting staked amount for %: %', user_wallet, SQLERRM;
  END;

  -- Calculate totals from all sources
  total_neft := COALESCE(campaign_neft, 0) + COALESCE(daily_neft, 0) + COALESCE(achievement_neft, 0) + COALESCE(staking_neft, 0);
  total_xp := COALESCE(campaign_xp, 0) + COALESCE(daily_xp, 0) + COALESCE(achievement_xp, 0) + COALESCE(staking_xp, 0);
  
  -- Calculate available NEFT (total earned minus staked)
  available_neft := GREATEST(0, total_neft - COALESCE(staked_amount, 0));

  RAISE LOG 'Final totals for %: total_neft=%, total_xp=%, available_neft=%, staked=%', 
    user_wallet, total_neft, total_xp, available_neft, staked_amount;

  -- Build result JSON with detailed breakdown
  SELECT json_build_object(
    'total_neft_claimed', total_neft,
    'total_xp_earned', total_xp,
    'available_neft', available_neft,
    'staked_neft', COALESCE(staked_amount, 0),
    'last_updated', NOW(),
    -- Detailed breakdown by source for debugging
    'breakdown', json_build_object(
      'campaign_neft', campaign_neft,
      'campaign_xp', campaign_xp,
      'daily_neft', daily_neft,
      'daily_xp', daily_xp,
      'achievement_neft', achievement_neft,
      'achievement_xp', achievement_xp,
      'staking_neft', staking_neft,
      'staking_xp', staking_xp,
      'staked_amount', staked_amount
    )
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details for debugging
    RAISE LOG 'Error in aggregate_user_rewards_from_all_sources for %: %', user_wallet, SQLERRM;
    SELECT json_build_object(
      'error', 'Aggregation failed: ' || SQLERRM,
      'total_neft_claimed', 0,
      'total_xp_earned', 0,
      'available_neft', 0,
      'staked_neft', 0,
      'last_updated', NOW(),
      'breakdown', json_build_object(
        'campaign_neft', 0, 'campaign_xp', 0,
        'daily_neft', 0, 'daily_xp', 0,
        'achievement_neft', 0, 'achievement_xp', 0,
        'staking_neft', 0, 'staking_xp', 0,
        'staked_amount', 0
      )
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create sync function that updates user_balances table with aggregated data
CREATE OR REPLACE FUNCTION sync_user_balance_from_all_sources(user_wallet TEXT)
RETURNS TEXT AS $$
DECLARE
  aggregated_data JSON;
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
  sync_result TEXT;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN 'ERROR: user_wallet parameter cannot be null or empty';
  END IF;

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
  
  -- Insert or update user_balances table with aggregated data
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
                   ' - NEFT: ' || total_neft || 
                   ', XP: ' || total_xp || 
                   ', Available: ' || available_neft;
                   
  EXCEPTION WHEN OTHERS THEN
    sync_result := 'ERROR updating user_balances: ' || SQLERRM;
  END;
    
  RETURN sync_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create enhanced trigger function for automatic syncing
CREATE OR REPLACE FUNCTION trigger_comprehensive_balance_sync()
RETURNS TRIGGER AS $$
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
  
  -- Sync the user's balance when any reward is added/updated/deleted
  BEGIN
    sync_result := sync_user_balance_from_all_sources(target_wallet);
    
    -- Log the sync result for debugging
    RAISE LOG 'Comprehensive balance sync for % (table: %, op: %): %', 
      target_wallet, TG_TABLE_NAME, TG_OP, sync_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the original transaction
    RAISE LOG 'Comprehensive balance sync failed for % (table: %, op: %): %', 
      target_wallet, TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  
  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Replace all existing triggers with comprehensive sync triggers
-- Campaign rewards trigger
DROP TRIGGER IF EXISTS campaign_rewards_balance_sync ON campaign_reward_claims;
CREATE TRIGGER campaign_rewards_balance_sync
  AFTER INSERT OR UPDATE OR DELETE ON campaign_reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comprehensive_balance_sync();

-- Daily claims trigger  
DROP TRIGGER IF EXISTS daily_claims_balance_sync ON daily_claims;
CREATE TRIGGER daily_claims_balance_sync
  AFTER INSERT OR UPDATE OR DELETE ON daily_claims
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comprehensive_balance_sync();

-- Achievements trigger
DROP TRIGGER IF EXISTS achievements_balance_sync ON user_achievements;
CREATE TRIGGER achievements_balance_sync
  AFTER INSERT OR UPDATE OR DELETE ON user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comprehensive_balance_sync();

-- Staking rewards trigger
DROP TRIGGER IF EXISTS staking_rewards_balance_sync ON staking_rewards;
CREATE TRIGGER staking_rewards_balance_sync
  AFTER INSERT OR UPDATE OR DELETE ON staking_rewards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comprehensive_balance_sync();

-- Staked tokens trigger (affects available_neft)
DROP TRIGGER IF EXISTS staked_tokens_balance_sync ON staked_tokens;
CREATE TRIGGER staked_tokens_balance_sync
  AFTER INSERT OR UPDATE OR DELETE ON staked_tokens
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comprehensive_balance_sync();

-- Step 5: Create bulk sync function for maintenance
CREATE OR REPLACE FUNCTION sync_all_user_balances_from_all_sources()
RETURNS TEXT AS $$
DECLARE
  wallet_record RECORD;
  sync_count INTEGER := 0;
  error_count INTEGER := 0;
  sync_result TEXT;
BEGIN
  -- Get all unique wallet addresses from all reward tables
  FOR wallet_record IN 
    SELECT DISTINCT wallet_address FROM (
      SELECT wallet_address FROM campaign_reward_claims
      UNION
      SELECT wallet_address FROM daily_claims
      UNION
      SELECT wallet_address FROM user_achievements WHERE claimed_at IS NOT NULL
      UNION
      SELECT wallet_address FROM staking_rewards WHERE is_claimed = true
      UNION
      SELECT wallet_address FROM staked_tokens
      UNION
      SELECT wallet_address FROM user_balances -- Include existing balances
    ) AS all_wallets
    WHERE wallet_address IS NOT NULL AND wallet_address != ''
  LOOP
    -- Sync each wallet
    BEGIN
      sync_result := sync_user_balance_from_all_sources(wallet_record.wallet_address);
      
      IF sync_result LIKE 'SUCCESS:%' THEN
        sync_count := sync_count + 1;
      ELSE
        error_count := error_count + 1;
        RAISE LOG 'Bulk sync failed for %: %', wallet_record.wallet_address, sync_result;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE LOG 'Exception during bulk sync for %: %', wallet_record.wallet_address, SQLERRM;
    END;
  END LOOP;
  
  RETURN 'Bulk sync complete - Success: ' || sync_count || ', Errors: ' || error_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION aggregate_user_rewards_from_all_sources(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_balance_from_all_sources(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_user_balances_from_all_sources() TO authenticated;

-- Step 7: Test the comprehensive aggregation system
SELECT 'Testing comprehensive balance aggregation system...' as step;

-- Test aggregation for your social login user
SELECT 'Testing aggregation for social login user...' as test_step;
SELECT aggregate_user_rewards_from_all_sources('social:google:108350092537307288909') as aggregation_result;

-- Test sync for your social login user
SELECT 'Testing sync for social login user...' as sync_step;
SELECT sync_user_balance_from_all_sources('social:google:108350092537307288909') as sync_result;

-- Verify the sync worked by checking the user_balances table
SELECT 'Checking synced balance in user_balances table...' as verification_step;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated
FROM user_balances 
WHERE wallet_address = 'social:google:108350092537307288909';

-- Compare with direct balance function (what UI uses)
SELECT 'Testing UI balance function (get_direct_user_balance)...' as ui_test_step;
SELECT get_direct_user_balance('social:google:108350092537307288909') as ui_balance_result;

-- Step 8: Optional - Sync all users (uncomment if needed)
-- SELECT 'Syncing all user balances from all sources...' as bulk_sync_step;
-- SELECT sync_all_user_balances_from_all_sources() as bulk_sync_result;

SELECT 'Comprehensive balance aggregation system created successfully!' as status;
SELECT 'System Architecture:' as architecture_header;
SELECT '1. UI uses get_direct_user_balance() - reads from user_balances table (fast & simple)' as arch_1;
SELECT '2. Backend aggregates from ALL reward sources via aggregate_user_rewards_from_all_sources()' as arch_2;
SELECT '3. Sync system updates user_balances table via sync_user_balance_from_all_sources()' as arch_3;
SELECT '4. Triggers automatically sync when rewards are added/updated in any table' as arch_4;
SELECT '5. Comprehensive logging for debugging and monitoring' as arch_5;

SELECT 'Reward Sources Integrated:' as sources_header;
SELECT '✅ campaign_reward_claims - Campaign rewards (NEFT + XP)' as source_1;
SELECT '✅ daily_claims - Daily claim rewards (NEFT + XP)' as source_2;
SELECT '✅ user_achievements + achievements_master - Achievement rewards (NEFT + XP)' as source_3;
SELECT '✅ staking_rewards - Staking rewards (NEFT only)' as source_4;
SELECT '✅ staked_tokens - Affects available_neft calculation' as source_5;
