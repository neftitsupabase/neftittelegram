-- ============================================================================
-- INTEGRATED ACHIEVEMENT SYSTEM FIX
-- Removes caching, fixes AchievementService integration, solves balance issues
-- ============================================================================

-- Step 1: Create cache-free achievement balance function that integrates with AchievementService
CREATE OR REPLACE FUNCTION get_real_time_achievement_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  result JSON;
  achievement_count INTEGER := 0;
BEGIN
  -- Validate input
  IF user_wallet IS NULL OR user_wallet = '' THEN
    RETURN json_build_object(
      'error', 'Invalid wallet address',
      'achievement_neft', 0,
      'achievement_xp', 0,
      'achievement_count', 0,
      'cache_free', true
    );
  END IF;

  -- Get achievement rewards with NO CACHING - direct database query
  SELECT 
    COALESCE(SUM(am.neft_reward), 0),
    COALESCE(SUM(am.xp_reward), 0),
    COUNT(*)
  INTO achievement_neft, achievement_xp, achievement_count
  FROM user_achievements ua 
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key 
  WHERE ua.wallet_address = user_wallet 
    AND ua.status = 'completed' 
    AND ua.claimed_at IS NOT NULL
    AND am.neft_reward > 0; -- Only count valid rewards

  -- Build result with real-time data
  result := json_build_object(
    'wallet_address', user_wallet,
    'achievement_neft', achievement_neft,
    'achievement_xp', achievement_xp,
    'achievement_count', achievement_count,
    'last_calculated', NOW(),
    'source', 'real_time_no_cache',
    'cache_free', true
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Fix achievement state validation to work with AchievementService
CREATE OR REPLACE FUNCTION fix_achievement_states_for_service(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  fixed_count INTEGER := 0;
  inconsistent_achievements RECORD;
  result JSON;
BEGIN
  -- Fix completed achievements without claimed_at timestamp
  UPDATE user_achievements 
  SET claimed_at = NOW() 
  WHERE wallet_address = user_wallet 
    AND status = 'completed' 
    AND claimed_at IS NULL;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  -- Fix claimed achievements without completed status
  UPDATE user_achievements 
  SET status = 'completed' 
  WHERE wallet_address = user_wallet 
    AND status != 'completed' 
    AND claimed_at IS NOT NULL;

  -- Return fix summary
  result := json_build_object(
    'wallet_address', user_wallet,
    'fixed_achievements', fixed_count,
    'timestamp', NOW(),
    'integration_ready', true
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create cache-free comprehensive balance aggregation
CREATE OR REPLACE FUNCTION get_cache_free_user_balance(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  
  -- All reward sources (NO CACHING)
  campaign_neft DECIMAL(18,8) := 0;
  campaign_xp INTEGER := 0;
  daily_neft DECIMAL(18,8) := 0;
  daily_xp INTEGER := 0;
  achievement_neft DECIMAL(18,8) := 0;
  achievement_xp INTEGER := 0;
  staking_neft DECIMAL(18,8) := 0;
  referral_neft DECIMAL(18,8) := 0;
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

  -- 1. Get real-time achievement rewards (NO CACHE)
  SELECT 
    (get_real_time_achievement_balance(user_wallet)->>'achievement_neft')::DECIMAL,
    (get_real_time_achievement_balance(user_wallet)->>'achievement_xp')::INTEGER
  INTO achievement_neft, achievement_xp;

  -- 2. Campaign rewards (direct query, no cache)
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0),
      COALESCE(SUM(xp_reward), 0)
    INTO campaign_neft, campaign_xp
    FROM campaign_reward_claims 
    WHERE wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    campaign_neft := 0;
    campaign_xp := 0;
  END;

  -- 3. Daily claims (direct query, no cache)
  BEGIN
    SELECT 
      COALESCE(SUM(base_neft_reward + bonus_neft_reward), 0),
      COALESCE(SUM(base_xp_reward + bonus_xp_reward), 0)
    INTO daily_neft, daily_xp
    FROM daily_claims 
    WHERE wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    daily_neft := 0;
    daily_xp := 0;
  END;

  -- 4. Staking rewards (direct query, no cache)
  BEGIN
    SELECT 
      COALESCE(SUM(total_nft_claimed + total_token_claimed), 0)
    INTO staking_neft
    FROM staking_rewards 
    WHERE wallet_address = user_wallet AND claimed = true;
  EXCEPTION WHEN OTHERS THEN
    staking_neft := 0;
  END;

  -- 5. Referral rewards (direct query, no cache)
  BEGIN
    SELECT 
      COALESCE(SUM(neft_reward), 0)
    INTO referral_neft
    FROM referral_rewards 
    WHERE referrer_wallet = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    referral_neft := 0;
  END;

  -- 6. Staked amounts (direct query, no cache)
  BEGIN
    SELECT 
      COALESCE(SUM(amount), 0)
    INTO staked_amount
    FROM staked_tokens 
    WHERE wallet_address = user_wallet;
  EXCEPTION WHEN OTHERS THEN
    staked_amount := 0;
  END;

  -- Calculate totals
  total_neft := GREATEST(0, campaign_neft + daily_neft + achievement_neft + staking_neft + referral_neft);
  total_xp := GREATEST(0, campaign_xp + daily_xp + achievement_xp);
  available_neft := GREATEST(0, total_neft - staked_amount);

  -- Build cache-free result
  result := json_build_object(
    'wallet_address', user_wallet,
    'total_neft_claimed', total_neft,
    'total_xp_earned', total_xp,
    'available_neft', available_neft,
    'staked_neft', COALESCE(staked_amount, 0),
    'last_updated', NOW(),
    'cache_free', true,
    'real_time', true,
    -- Detailed breakdown by source
    'breakdown', json_build_object(
      'campaign_neft', campaign_neft,
      'campaign_xp', campaign_xp,
      'daily_neft', daily_neft,
      'daily_xp', daily_xp,
      'achievement_neft', achievement_neft,
      'achievement_xp', achievement_xp,
      'staking_neft', staking_neft,
      'referral_neft', referral_neft,
      'staked_amount', staked_amount
    )
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create cache-free sync function for AchievementService integration
CREATE OR REPLACE FUNCTION sync_user_balance_cache_free(user_wallet TEXT)
RETURNS TEXT AS $$
DECLARE
  balance_data JSON;
  total_neft DECIMAL(18,8);
  total_xp INTEGER;
  available_neft DECIMAL(18,8);
  sync_result TEXT;
  old_neft DECIMAL(18,8) := 0;
  old_xp INTEGER := 0;
BEGIN
  -- Fix achievement states first
  PERFORM fix_achievement_states_for_service(user_wallet);

  -- Get current balance for comparison
  SELECT total_neft_claimed, total_xp_earned 
  INTO old_neft, old_xp
  FROM user_balances 
  WHERE wallet_address = user_wallet;

  -- Get cache-free aggregated data
  balance_data := get_cache_free_user_balance(user_wallet);
  
  -- Extract values
  total_neft := (balance_data->>'total_neft_claimed')::DECIMAL(18,8);
  total_xp := (balance_data->>'total_xp_earned')::INTEGER;
  available_neft := (balance_data->>'available_neft')::DECIMAL(18,8);
  
  -- Update user_balances table with cache-free data
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
    ON CONFLICT (wallet_address) DO UPDATE SET
      total_neft_claimed = EXCLUDED.total_neft_claimed,
      total_xp_earned = EXCLUDED.total_xp_earned,
      available_neft = EXCLUDED.available_neft,
      last_updated = NOW();
      
    sync_result := 'SUCCESS: Cache-free sync for wallet: ' || user_wallet || 
                   ' - NEFT: ' || total_neft || ' (was: ' || COALESCE(old_neft, 0) || ')' ||
                   ', XP: ' || total_xp || ' (was: ' || COALESCE(old_xp, 0) || ')' ||
                   ', Available: ' || available_neft || ' [CACHE-FREE]';
                   
  EXCEPTION WHEN OTHERS THEN
    sync_result := 'ERROR updating user_balances: ' || SQLERRM;
  END;
    
  RETURN sync_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create AchievementService-compatible RPC functions (cache-free)
CREATE OR REPLACE FUNCTION get_user_achievements_cache_free(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  achievements_data JSON;
BEGIN
  -- Get achievements without any caching
  SELECT json_agg(
    json_build_object(
      'achievement_key', ua.achievement_key,
      'title', am.title,
      'description', am.description,
      'category', am.category,
      'icon', am.icon,
      'color', am.color,
      'neft_reward', am.neft_reward,
      'xp_reward', am.xp_reward,
      'required_count', am.required_count,
      'current_progress', COALESCE(ua.current_progress, 0),
      'status', COALESCE(ua.status, 'locked'),
      'completed_at', ua.completed_at,
      'claimed_at', ua.claimed_at,
      'progress_percentage', 
        CASE 
          WHEN am.required_count > 0 THEN 
            LEAST(100, (COALESCE(ua.current_progress, 0) * 100.0 / am.required_count))
          ELSE 0 
        END
    )
  )
  INTO achievements_data
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
    AND ua.wallet_address = user_wallet
  WHERE (category_filter IS NULL OR am.category = category_filter)
  ORDER BY am.category, am.achievement_key;

  RETURN COALESCE(achievements_data, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Update achievement progress function (cache-free)
CREATE OR REPLACE FUNCTION update_achievement_progress_cache_free(
  user_wallet TEXT,
  achievement_key_param TEXT,
  progress_increment INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
  current_progress INTEGER := 0;
  required_count INTEGER := 0;
  new_progress INTEGER := 0;
  achievement_completed BOOLEAN := FALSE;
  result JSON;
BEGIN
  -- Get current achievement data
  SELECT 
    COALESCE(ua.current_progress, 0),
    am.required_count
  INTO current_progress, required_count
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
    AND ua.wallet_address = user_wallet
  WHERE am.achievement_key = achievement_key_param;

  -- Calculate new progress
  new_progress := current_progress + progress_increment;
  
  -- Check if achievement is completed
  achievement_completed := (new_progress >= required_count);

  -- Insert or update user achievement (no caching)
  INSERT INTO user_achievements (
    wallet_address,
    achievement_key,
    current_progress,
    status,
    completed_at
  ) VALUES (
    user_wallet,
    achievement_key_param,
    new_progress,
    CASE WHEN achievement_completed THEN 'completed' ELSE 'in_progress' END,
    CASE WHEN achievement_completed THEN NOW() ELSE NULL END
  )
  ON CONFLICT (wallet_address, achievement_key) DO UPDATE SET
    current_progress = EXCLUDED.current_progress,
    status = EXCLUDED.status,
    completed_at = CASE 
      WHEN EXCLUDED.status = 'completed' AND user_achievements.completed_at IS NULL 
      THEN NOW() 
      ELSE user_achievements.completed_at 
    END,
    updated_at = NOW();

  -- Build result
  result := json_build_object(
    'achievement_completed', achievement_completed,
    'new_progress', new_progress,
    'required_count', required_count,
    'cache_free', true
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Claim achievement reward function (cache-free)
CREATE OR REPLACE FUNCTION claim_achievement_reward_cache_free(
  user_wallet TEXT,
  achievement_key_param TEXT
)
RETURNS JSON AS $$
DECLARE
  achievement_status TEXT;
  neft_reward DECIMAL(18,8) := 0;
  xp_reward INTEGER := 0;
  already_claimed BOOLEAN := FALSE;
  result JSON;
BEGIN
  -- Check achievement status and rewards
  SELECT 
    ua.status,
    am.neft_reward,
    am.xp_reward,
    (ua.claimed_at IS NOT NULL)
  INTO achievement_status, neft_reward, xp_reward, already_claimed
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet 
    AND ua.achievement_key = achievement_key_param;

  -- Validate claim
  IF achievement_status IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement not found',
      'cache_free', true
    );
  END IF;

  IF achievement_status != 'completed' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement not completed yet',
      'cache_free', true
    );
  END IF;

  IF already_claimed THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement reward already claimed',
      'cache_free', true
    );
  END IF;

  -- Claim the reward (no caching)
  UPDATE user_achievements 
  SET claimed_at = NOW()
  WHERE wallet_address = user_wallet 
    AND achievement_key = achievement_key_param;

  -- Sync user balance immediately (cache-free)
  PERFORM sync_user_balance_cache_free(user_wallet);

  -- Return success result
  result := json_build_object(
    'success', true,
    'message', 'Achievement reward claimed successfully',
    'neft_reward', neft_reward,
    'xp_reward', xp_reward,
    'cache_free', true
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Remove any existing caching triggers and replace with cache-free versions
DROP TRIGGER IF EXISTS trigger_user_achievements_balance_sync_validated ON user_achievements;
DROP TRIGGER IF EXISTS trigger_daily_claims_balance_sync_validated ON daily_claims;
DROP TRIGGER IF EXISTS trigger_campaign_rewards_balance_sync_validated ON campaign_reward_claims;
DROP TRIGGER IF EXISTS trigger_staking_rewards_balance_sync_validated ON staking_rewards;
DROP TRIGGER IF EXISTS trigger_referral_rewards_balance_sync_validated ON referral_rewards;

-- Create cache-free trigger function
CREATE OR REPLACE FUNCTION trigger_cache_free_balance_sync()
RETURNS TRIGGER AS $$
DECLARE
  affected_wallet TEXT;
  sync_result TEXT;
BEGIN
  -- Get the affected wallet address
  IF TG_OP = 'DELETE' THEN
    affected_wallet := OLD.wallet_address;
  ELSE
    affected_wallet := NEW.wallet_address;
  END IF;
  
  -- Only sync if wallet address is valid
  IF affected_wallet IS NOT NULL AND affected_wallet != '' THEN
    -- Use cache-free sync function
    SELECT sync_user_balance_cache_free(affected_wallet) INTO sync_result;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new cache-free triggers
CREATE TRIGGER trigger_user_achievements_cache_free_sync
  AFTER INSERT OR UPDATE OR DELETE ON user_achievements
  FOR EACH ROW EXECUTE FUNCTION trigger_cache_free_balance_sync();

CREATE TRIGGER trigger_daily_claims_cache_free_sync
  AFTER INSERT OR UPDATE OR DELETE ON daily_claims
  FOR EACH ROW EXECUTE FUNCTION trigger_cache_free_balance_sync();

CREATE TRIGGER trigger_campaign_rewards_cache_free_sync
  AFTER INSERT OR UPDATE OR DELETE ON campaign_reward_claims
  FOR EACH ROW EXECUTE FUNCTION trigger_cache_free_balance_sync();

CREATE TRIGGER trigger_staking_rewards_cache_free_sync
  AFTER INSERT OR UPDATE OR DELETE ON staking_rewards
  FOR EACH ROW EXECUTE FUNCTION trigger_cache_free_balance_sync();

CREATE TRIGGER trigger_referral_rewards_cache_free_sync
  AFTER INSERT OR UPDATE OR DELETE ON referral_rewards
  FOR EACH ROW EXECUTE FUNCTION trigger_cache_free_balance_sync();

-- Step 9: Fix the specific user's balance and achievement states
SELECT 'FIXING ACHIEVEMENT STATES AND SYNCING CACHE-FREE BALANCE...' as status;

-- Fix achievement states for the user
SELECT fix_achievement_states_for_service('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as state_fix_result;

-- Sync with cache-free function
SELECT sync_user_balance_cache_free('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as cache_free_sync_result;

-- Step 10: Verify the cache-free fix
SELECT 'VERIFICATION - CACHE-FREE ACHIEVEMENT BALANCE:' as verification;
SELECT get_real_time_achievement_balance('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as real_time_achievement_balance;

SELECT 'VERIFICATION - CACHE-FREE COMPREHENSIVE BALANCE:' as comprehensive_verification;
SELECT get_cache_free_user_balance('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as cache_free_comprehensive_balance;

SELECT 'VERIFICATION - USER_BALANCES TABLE (UPDATED):' as table_verification;
SELECT 
  wallet_address,
  total_neft_claimed,
  total_xp_earned,
  available_neft,
  last_updated
FROM user_balances 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- Grant permissions for AchievementService integration
GRANT EXECUTE ON FUNCTION get_real_time_achievement_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_achievement_states_for_service(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cache_free_user_balance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_balance_cache_free(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_achievements_cache_free(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_achievement_progress_cache_free(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_achievement_reward_cache_free(TEXT, TEXT) TO authenticated;

SELECT 'INTEGRATED CACHE-FREE ACHIEVEMENT SYSTEM FIX COMPLETED!' as completion_status;
SELECT 'System now provides:' as features_header;
SELECT '✅ Cache-free real-time achievement balance calculation' as feature_1;
SELECT '✅ AchievementService-compatible RPC functions' as feature_2;
SELECT '✅ Automatic achievement state consistency fixing' as feature_3;
SELECT '✅ Cache-free comprehensive balance aggregation' as feature_4;
SELECT '✅ Real-time triggers without caching issues' as feature_5;
SELECT '✅ Direct database queries for all operations' as feature_6;
SELECT '✅ Proper integration with existing AchievementService' as feature_7;
