-- 1. Get or create referral profile
CREATE OR REPLACE FUNCTION public.get_or_create_referral_profile(
  p_wallet_address TEXT
) RETURNS TABLE (
  referral_code TEXT,
  total_referrals INTEGER,
  total_neft_earned NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Try to get existing profile
  SELECT ur.referral_code, ur.total_referrals, ur.total_neft_earned
  INTO referral_code, total_referrals, total_neft_earned
  FROM public.user_referrals ur
  WHERE ur.wallet_address = p_wallet_address;

  -- Create if doesn't exist
  IF NOT FOUND THEN
    v_code := 'NEFT-' || UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 8));
    
    INSERT INTO public.user_referrals (wallet_address, referral_code, total_referrals, total_neft_earned)
    VALUES (p_wallet_address, v_code, 0, 0)
    RETURNING user_referrals.referral_code, user_referrals.total_referrals, user_referrals.total_neft_earned
    INTO referral_code, total_referrals, total_neft_earned;
  END IF;

  RETURN NEXT;
END $$;

-- 2. Process referral atomically
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

  -- Insert referral reward (will fail on duplicate due to constraint)
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

  RETURN json_build_object('success', true, 'neft_reward', p_neft_reward);

EXCEPTION 
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Referral already processed');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END $$;

-- 3. Validate referral code
CREATE OR REPLACE FUNCTION public.validate_referral_code(
  p_code TEXT
) RETURNS TABLE (
  wallet_address TEXT,
  is_valid BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ur.wallet_address, TRUE as is_valid
  FROM public.user_referrals ur
  WHERE ur.referral_code = p_code
  LIMIT 1;
$$;