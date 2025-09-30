-- Fix Referral Balance Integration
-- Problem: Referral rewards (5 NEFT) are not being added to user_balances table
-- Solution: Update the referral functions to properly integrate with user_balances

-- 1. Fix process_referral_with_validation function to update user_balances
CREATE OR REPLACE FUNCTION public.process_referral_with_validation(
  p_referrer_wallet TEXT,
  p_referred_wallet TEXT,
  p_neft_reward NUMERIC DEFAULT 5
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral_code TEXT;
  v_completed_projects INTEGER;
  v_user_exists BOOLEAN;
BEGIN
  -- Validation checks
  IF p_referrer_wallet = p_referred_wallet THEN
    RETURN json_build_object('success', false, 'error', 'Self-referral not allowed');
  END IF;

  -- Get referrer's code and check if referrer exists
  SELECT referral_code INTO v_referral_code
  FROM public.user_referrals 
  WHERE wallet_address = p_referrer_wallet;
  
  IF v_referral_code IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid referrer wallet');
  END IF;

  -- Check if referred user exists in users table (new user validation)
  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE wallet_address = p_referred_wallet
  ) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN json_build_object('success', false, 'error', 'Referred user must be registered');
  END IF;

  -- Check if referred user has completed at least 2 projects (100% completion)
  SELECT COUNT(DISTINCT project_id) INTO v_completed_projects
  FROM public.user_participations 
  WHERE wallet_address = p_referred_wallet 
    AND completion_percentage = 100;

  IF v_completed_projects < 2 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Referred user must complete 2 projects before referral can be processed',
      'completed_projects', v_completed_projects,
      'required_projects', 2
    );
  END IF;

  -- Check if referral already exists
  IF EXISTS(
    SELECT 1 FROM public.referral_rewards 
    WHERE referrer_wallet = p_referrer_wallet 
      AND referred_wallet = p_referred_wallet
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Referral already processed');
  END IF;

  -- Insert referral reward
  INSERT INTO public.referral_rewards (
    referrer_wallet, 
    referred_wallet, 
    referral_code, 
    neft_reward, 
    status, 
    completed_at
  ) VALUES (
    p_referrer_wallet, 
    p_referred_wallet, 
    v_referral_code, 
    p_neft_reward, 
    'completed', 
    NOW()
  );

  -- Update referral aggregates
  UPDATE public.user_referrals 
  SET 
    total_referrals = total_referrals + 1,
    total_neft_earned = total_neft_earned + p_neft_reward,
    updated_at = NOW()
  WHERE wallet_address = p_referrer_wallet;

  -- 🔥 CRITICAL FIX: Add referral rewards to user_balances table (for UI display)
  INSERT INTO public.user_balances (
    wallet_address, 
    total_neft_claimed, 
    available_neft, 
    last_updated
  ) VALUES (
    p_referrer_wallet, 
    p_neft_reward, 
    p_neft_reward, 
    NOW()
  )
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    total_neft_claimed = user_balances.total_neft_claimed + EXCLUDED.total_neft_claimed,
    available_neft = user_balances.available_neft + EXCLUDED.available_neft,
    last_updated = NOW();

  RETURN json_build_object(
    'success', true, 
    'neft_reward', p_neft_reward,
    'completed_projects', v_completed_projects
  );

EXCEPTION 
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Referral already processed');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END $$;

-- 2. Fix the simpler process_referral function (used by QuickReferralFix)
CREATE OR REPLACE FUNCTION public.process_referral(
  p_referrer_wallet TEXT,
  p_referred_wallet TEXT,
  p_neft_reward NUMERIC DEFAULT 5
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral_code TEXT;
BEGIN
  -- Get referrer's code
  SELECT referral_code INTO v_referral_code
  FROM public.user_referrals 
  WHERE wallet_address = p_referrer_wallet;
  
  IF v_referral_code IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid referrer wallet');
  END IF;

  -- Check if referral already exists
  IF EXISTS(
    SELECT 1 FROM public.referral_rewards 
    WHERE referrer_wallet = p_referrer_wallet 
      AND referred_wallet = p_referred_wallet
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Referral already processed');
  END IF;

  -- Insert referral reward
  INSERT INTO public.referral_rewards (
    referrer_wallet, 
    referred_wallet, 
    referral_code, 
    neft_reward, 
    status, 
    completed_at
  ) VALUES (
    p_referrer_wallet, 
    p_referred_wallet, 
    v_referral_code, 
    p_neft_reward, 
    'completed', 
    NOW()
  );

  -- Update referral aggregates
  UPDATE public.user_referrals 
  SET 
    total_referrals = total_referrals + 1,
    total_neft_earned = total_neft_earned + p_neft_reward,
    updated_at = NOW()
  WHERE wallet_address = p_referrer_wallet;

  -- 🔥 CRITICAL FIX: Add referral rewards to user_balances table (for UI display)
  INSERT INTO public.user_balances (
    wallet_address, 
    total_neft_claimed, 
    available_neft, 
    last_updated
  ) VALUES (
    p_referrer_wallet, 
    p_neft_reward, 
    p_neft_reward, 
    NOW()
  )
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    total_neft_claimed = user_balances.total_neft_claimed + EXCLUDED.total_neft_claimed,
    available_neft = user_balances.available_neft + EXCLUDED.available_neft,
    last_updated = NOW();

  RETURN json_build_object('success', true, 'neft_reward', p_neft_reward);

EXCEPTION 
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Referral already processed');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END $$;

-- 3. Update the older process_referral_reward function for consistency
CREATE OR REPLACE FUNCTION public.process_referral_reward(
  referrer_wallet TEXT,
  referred_wallet TEXT,
  neft_reward NUMERIC DEFAULT 5,
  xp_reward INTEGER DEFAULT 0
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    referral_code_val TEXT;
    result JSON;
BEGIN
    -- Get referral code for the referrer
    SELECT referral_code INTO referral_code_val
    FROM user_referrals 
    WHERE wallet_address = referrer_wallet;
    
    IF referral_code_val IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Referrer not found');
    END IF;
    
    -- Check if this referral already exists
    IF EXISTS (
        SELECT 1 FROM referral_rewards 
        WHERE referrer_wallet = referrer_wallet 
        AND referred_wallet = referred_wallet
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Referral already processed');
    END IF;
    
    -- Insert referral reward record
    INSERT INTO referral_rewards (
        referrer_wallet, 
        referred_wallet, 
        referral_code, 
        neft_reward, 
        xp_reward, 
        status,
        completed_at
    ) VALUES (
        referrer_wallet, 
        referred_wallet, 
        referral_code_val, 
        neft_reward, 
        xp_reward, 
        'completed',
        NOW()
    );
    
    -- Update referrer's referral stats
    UPDATE user_referrals SET
        total_referrals = total_referrals + 1,
        total_neft_earned = total_neft_earned + neft_reward,
        total_xp_earned = total_xp_earned + xp_reward,
        updated_at = NOW()
    WHERE wallet_address = referrer_wallet;
    
    -- 🔥 CRITICAL FIX: Add referral rewards to user_balances table (for UI display)
    INSERT INTO public.user_balances (
      wallet_address, 
      total_neft_claimed, 
      available_neft, 
      total_xp_earned,
      available_xp,
      last_updated
    ) VALUES (
      referrer_wallet, 
      neft_reward, 
      neft_reward, 
      xp_reward,
      xp_reward,
      NOW()
    )
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
      total_neft_claimed = user_balances.total_neft_claimed + EXCLUDED.total_neft_claimed,
      available_neft = user_balances.available_neft + EXCLUDED.available_neft,
      total_xp_earned = COALESCE(user_balances.total_xp_earned, 0) + EXCLUDED.total_xp_earned,
      available_xp = COALESCE(user_balances.available_xp, 0) + EXCLUDED.available_xp,
      last_updated = NOW();
    
    result := json_build_object(
        'success', true,
        'referrer_wallet', referrer_wallet,
        'referred_wallet', referred_wallet,
        'neft_reward', neft_reward,
        'xp_reward', xp_reward,
        'referral_code', referral_code_val
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END $$;
