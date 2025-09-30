-- Deploy enhanced referral functions to database
-- Run this in your Supabase SQL editor

-- Enhanced referral processing with project completion validation
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

  -- Update aggregates atomically
  UPDATE public.user_referrals 
  SET 
    total_referrals = total_referrals + 1,
    total_neft_earned = total_neft_earned + p_neft_reward,
    updated_at = NOW()
  WHERE wallet_address = p_referrer_wallet;

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

-- Function to check if user is eligible for referral processing
CREATE OR REPLACE FUNCTION public.check_referral_eligibility(
  p_wallet_address TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_completed_projects INTEGER;
  v_user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE wallet_address = p_wallet_address
  ) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN json_build_object(
      'eligible', false, 
      'reason', 'User not registered',
      'completed_projects', 0,
      'required_projects', 2
    );
  END IF;

  -- Count completed projects
  SELECT COUNT(DISTINCT project_id) INTO v_completed_projects
  FROM public.user_participations 
  WHERE wallet_address = p_wallet_address 
    AND completion_percentage = 100;

  RETURN json_build_object(
    'eligible', v_completed_projects >= 2,
    'completed_projects', v_completed_projects,
    'required_projects', 2,
    'remaining_projects', GREATEST(0, 2 - v_completed_projects)
  );
END $$;
