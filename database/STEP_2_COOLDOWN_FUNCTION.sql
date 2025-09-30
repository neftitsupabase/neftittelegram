-- ============================================================================
-- STEP 2: Add 24-hour cooldown helper function
-- Deploy this only after STEP 1 works correctly
-- This is safe as it's a new function that doesn't modify existing ones
-- ============================================================================

-- Helper function to get time remaining until next claim is available
CREATE OR REPLACE FUNCTION get_claim_cooldown_info(user_wallet TEXT)
RETURNS TABLE(
  can_claim_now BOOLEAN,
  hours_remaining INTEGER,
  minutes_remaining INTEGER,
  next_available_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
DECLARE
  last_claim_time TIMESTAMPTZ;
  next_available TIMESTAMPTZ;
  time_diff INTERVAL;
BEGIN
  -- Get the most recent claim time
  SELECT claimed_at INTO last_claim_time
  FROM daily_claims
  WHERE wallet_address = user_wallet
  ORDER BY claimed_at DESC
  LIMIT 1;

  -- If no previous claims, user can claim immediately
  IF last_claim_time IS NULL THEN
    RETURN QUERY SELECT TRUE, 0, 0, NOW();
    RETURN;
  END IF;

  -- Calculate when next claim will be available (24 hours after last claim)
  next_available := last_claim_time + INTERVAL '24 hours';

  -- If current time is past the next available time, user can claim
  IF NOW() >= next_available THEN
    RETURN QUERY SELECT TRUE, 0, 0, NOW();
    RETURN;
  END IF;

  -- Calculate remaining time
  time_diff := next_available - NOW();
  
  RETURN QUERY SELECT 
    FALSE,
    EXTRACT(HOUR FROM time_diff)::INTEGER,
    EXTRACT(MINUTE FROM time_diff)::INTEGER,
    next_available;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_claim_cooldown_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_claim_cooldown_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_claim_cooldown_info(TEXT) TO public;

-- Test the cooldown function (replace with your actual wallet address)
SELECT 'STEP 2: Testing cooldown function...' as test_step;

-- This should show can_claim_now = true if no previous claims
SELECT * FROM get_claim_cooldown_info('test_wallet_address');

-- Success message for Step 2
DO $$
BEGIN
    RAISE NOTICE '✅ STEP 2 COMPLETED: Cooldown helper function deployed successfully!';
    RAISE NOTICE 'Next: Deploy STEP 3 only after verifying this works correctly.';
END $$;
