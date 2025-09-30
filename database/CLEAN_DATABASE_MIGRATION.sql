-- ============================================================================
-- CLEAN DATABASE MIGRATION - DAILY CLAIMS WITH 24-HOUR COOLDOWN
-- ============================================================================
-- Step 1: Clean up existing conflicting tables and functions
-- Step 2: Deploy fresh daily claims schema with 24-hour cooldown
-- ============================================================================

-- ============================================================================
-- STEP 1: CLEANUP EXISTING SCHEMA
-- ============================================================================

-- Drop existing functions that might conflict
DROP FUNCTION IF EXISTS process_daily_claim(TEXT);
DROP FUNCTION IF EXISTS calculate_daily_reward(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_user_streak_info(TEXT);
DROP FUNCTION IF EXISTS get_daily_claim_dashboard(TEXT);
DROP FUNCTION IF EXISTS can_claim_daily_reward(TEXT);

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_user_streaks_updated_at ON user_streaks;
DROP TRIGGER IF EXISTS update_user_balances_updated_at ON user_balances;

-- Drop existing tables (in correct order to handle dependencies)
DROP TABLE IF EXISTS daily_claims CASCADE;
DROP TABLE IF EXISTS user_streaks CASCADE;
DROP TABLE IF EXISTS daily_claim_milestones CASCADE;

-- Note: Keep user_balances table as it's used by other systems
-- Just ensure it has the right structure
ALTER TABLE user_balances 
ADD COLUMN IF NOT EXISTS available_neft DECIMAL(18,8) DEFAULT 0;

-- ============================================================================
-- STEP 2: CREATE FRESH DAILY CLAIMS SCHEMA WITH 24-HOUR COOLDOWN
-- ============================================================================

-- User Streaks Table - Enhanced with 24-hour tracking
CREATE TABLE user_streaks (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_claim_date DATE,
  last_claimed_at TIMESTAMP WITH TIME ZONE, -- 24-hour tracking
  total_claims INTEGER DEFAULT 0,
  streak_started_at DATE,
  total_neft_earned DECIMAL(18,8) DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Claims Table - Records each individual claim
CREATE TABLE daily_claims (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  claim_date DATE NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Exact claim time
  streak_count INTEGER NOT NULL,
  base_neft_reward DECIMAL(18,8) DEFAULT 0,
  bonus_neft_reward DECIMAL(18,8) DEFAULT 0,
  base_xp_reward INTEGER DEFAULT 0,
  bonus_xp_reward INTEGER DEFAULT 0,
  nft_reward JSONB,
  reward_tier TEXT,
  UNIQUE(wallet_address, claim_date)
);

-- Daily Claim Milestones Table - Special milestone rewards
CREATE TABLE daily_claim_milestones (
  id BIGSERIAL PRIMARY KEY,
  milestone_day INTEGER NOT NULL UNIQUE,
  milestone_name TEXT NOT NULL,
  milestone_description TEXT,
  base_neft_reward DECIMAL(18,8) DEFAULT 0,
  bonus_neft_reward DECIMAL(18,8) DEFAULT 0,
  base_xp_reward INTEGER DEFAULT 0,
  bonus_xp_reward INTEGER DEFAULT 0,
  nft_reward JSONB,
  is_special_milestone BOOLEAN DEFAULT FALSE,
  icon_name TEXT DEFAULT 'Gift',
  color_scheme TEXT DEFAULT 'from-blue-600 to-blue-400',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_user_streaks_wallet ON user_streaks(wallet_address);
CREATE INDEX idx_user_streaks_last_claimed ON user_streaks(last_claimed_at);
CREATE INDEX idx_daily_claims_wallet_date ON daily_claims(wallet_address, claim_date);
CREATE INDEX idx_daily_claims_claimed_at ON daily_claims(claimed_at DESC);

-- ============================================================================
-- STEP 4: ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_claim_milestones ENABLE ROW LEVEL SECURITY;

-- User Streaks Policies
CREATE POLICY "Users can view own streaks" ON user_streaks
  FOR SELECT USING (
    wallet_address = current_setting('request.headers')::json->>'x-wallet-address'
    OR auth.jwt()->>'wallet_address' = wallet_address
    OR auth.jwt()->>'sub' = wallet_address
  );

CREATE POLICY "Service role can manage all streaks" ON user_streaks
  FOR ALL USING (auth.role() = 'service_role');

-- Daily Claims Policies
CREATE POLICY "Users can view own claims" ON daily_claims
  FOR SELECT USING (
    wallet_address = current_setting('request.headers')::json->>'x-wallet-address'
    OR auth.jwt()->>'wallet_address' = wallet_address
    OR auth.jwt()->>'sub' = wallet_address
  );

CREATE POLICY "Service role can manage all claims" ON daily_claims
  FOR ALL USING (auth.role() = 'service_role');

-- Milestones Policies (public read)
CREATE POLICY "Anyone can view milestones" ON daily_claim_milestones
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage milestones" ON daily_claim_milestones
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- STEP 5: CORE FUNCTIONS WITH 24-HOUR COOLDOWN
-- ============================================================================

-- Calculate Daily Reward Function
CREATE OR REPLACE FUNCTION calculate_daily_reward(streak_count INTEGER, user_wallet TEXT)
RETURNS TABLE(
  base_neft DECIMAL(18,8),
  bonus_neft DECIMAL(18,8),
  base_xp INTEGER,
  bonus_xp INTEGER,
  nft_reward JSONB,
  reward_tier TEXT,
  is_milestone BOOLEAN
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  milestone_data RECORD;
BEGIN
  -- Check if this is a milestone day
  SELECT * INTO milestone_data 
  FROM daily_claim_milestones 
  WHERE milestone_day = streak_count;
  
  IF milestone_data IS NOT NULL THEN
    -- Milestone reward
    RETURN QUERY SELECT 
      milestone_data.base_neft_reward,
      milestone_data.bonus_neft_reward,
      milestone_data.base_xp_reward,
      milestone_data.bonus_xp_reward,
      milestone_data.nft_reward,
      milestone_data.milestone_name,
      TRUE;
  ELSE
    -- Regular reward based on streak
    RETURN QUERY SELECT 
      (10.0 + (streak_count * 0.5))::DECIMAL(18,8), -- Base NEFT
      (CASE WHEN streak_count >= 7 THEN 5.0 ELSE 0.0 END)::DECIMAL(18,8), -- Bonus NEFT
      (50 + (streak_count * 5))::INTEGER, -- Base XP
      (CASE WHEN streak_count >= 7 THEN 25 ELSE 0 END)::INTEGER, -- Bonus XP
      NULL::JSONB,
      (CASE 
        WHEN streak_count >= 30 THEN 'Legendary'
        WHEN streak_count >= 14 THEN 'Epic'
        WHEN streak_count >= 7 THEN 'Rare'
        ELSE 'Basic'
      END)::TEXT,
      FALSE;
  END IF;
END;
$$;

-- Check Claim Eligibility with 24-Hour Cooldown
CREATE OR REPLACE FUNCTION can_claim_daily_reward(user_wallet TEXT)
RETURNS TABLE(
  can_claim BOOLEAN,
  hours_remaining NUMERIC,
  message TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  user_record RECORD;
  hours_since_last_claim NUMERIC;
BEGIN
  -- Get user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  -- If no previous claims, can claim immediately
  IF user_record IS NULL OR user_record.last_claimed_at IS NULL THEN
    RETURN QUERY SELECT TRUE, 0::NUMERIC, 'Ready to claim'::TEXT;
    RETURN;
  END IF;

  -- Calculate hours since last claim
  SELECT EXTRACT(EPOCH FROM (NOW() - user_record.last_claimed_at)) / 3600 INTO hours_since_last_claim;
  
  -- Check if 24 hours have passed
  IF hours_since_last_claim >= 24 THEN
    RETURN QUERY SELECT TRUE, 0::NUMERIC, 'Ready to claim'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      FALSE, 
      ROUND(24 - hours_since_last_claim, 1), 
      CONCAT('Must wait ', ROUND(24 - hours_since_last_claim, 1), ' more hours')::TEXT;
  END IF;
END;
$$;

-- Process Daily Claim with 24-Hour Cooldown
CREATE OR REPLACE FUNCTION process_daily_claim(user_wallet TEXT)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  streak_count INTEGER,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  reward_tier TEXT,
  nft_reward JSONB,
  is_milestone BOOLEAN,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  user_record RECORD;
  reward_data RECORD;
  calculated_streak INTEGER;
  total_reward_neft DECIMAL(18,8);
  total_reward_xp INTEGER;
  hours_since_last_claim NUMERIC;
BEGIN
  -- Get user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  -- Check 24-hour cooldown
  IF user_record IS NOT NULL AND user_record.last_claimed_at IS NOT NULL THEN
    -- Calculate hours since last claim
    SELECT EXTRACT(EPOCH FROM (NOW() - user_record.last_claimed_at)) / 3600 INTO hours_since_last_claim;
    
    -- If less than 24 hours, return error with remaining time
    IF hours_since_last_claim < 24 THEN
      RETURN QUERY SELECT 
        FALSE, 
        CONCAT('Must wait ', ROUND(24 - hours_since_last_claim, 1), ' more hours before next claim')::TEXT,
        COALESCE(user_record.current_streak, 0), 
        0.0::DECIMAL(18,8), 
        0, 
        ''::TEXT, 
        NULL::JSONB, 
        FALSE,
        0.0::DECIMAL(18,8), 
        0;
      RETURN;
    END IF;
  END IF;

  -- Also check daily_claims table for same calendar date (backup check)
  IF EXISTS (SELECT 1 FROM daily_claims WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE) THEN
    RETURN QUERY SELECT 
      FALSE, 'Already claimed today'::TEXT,
      0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE,
      0.0::DECIMAL(18,8), 0;
    RETURN;
  END IF;

  -- Create or update user streak record
  IF user_record IS NULL THEN
    calculated_streak := 1;
    INSERT INTO user_streaks (
      wallet_address, current_streak, longest_streak, last_claim_date, 
      total_claims, streak_started_at, total_neft_earned, total_xp_earned,
      last_claimed_at
    ) VALUES (
      user_wallet, 1, 1, CURRENT_DATE, 1, CURRENT_DATE, 0, 0, NOW()
    );
  ELSE
    -- Calculate streak continuation (24-hour based)
    IF user_record.last_claimed_at IS NOT NULL AND 
       user_record.last_claimed_at >= (NOW() - INTERVAL '48 hours') THEN
      calculated_streak := user_record.current_streak + 1;
    ELSE
      calculated_streak := 1;
    END IF;
  END IF;

  -- Get reward calculation
  SELECT * INTO reward_data FROM calculate_daily_reward(calculated_streak, user_wallet);
  
  total_reward_neft := reward_data.base_neft + reward_data.bonus_neft;
  total_reward_xp := reward_data.base_xp + reward_data.bonus_xp;

  -- Update user streaks with 24-hour timestamp
  UPDATE user_streaks SET
    current_streak = calculated_streak,
    longest_streak = GREATEST(longest_streak, calculated_streak),
    last_claim_date = CURRENT_DATE,
    last_claimed_at = NOW(),
    total_claims = total_claims + 1,
    total_neft_earned = total_neft_earned + total_reward_neft,
    total_xp_earned = total_xp_earned + total_reward_xp,
    updated_at = NOW()
  WHERE wallet_address = user_wallet;

  -- Record the claim
  INSERT INTO daily_claims (
    wallet_address, claim_date, claimed_at, streak_count, 
    base_neft_reward, bonus_neft_reward, 
    base_xp_reward, bonus_xp_reward,
    nft_reward, reward_tier
  ) VALUES (
    user_wallet, CURRENT_DATE, NOW(), calculated_streak,
    reward_data.base_neft, reward_data.bonus_neft,
    reward_data.base_xp, reward_data.bonus_xp,
    reward_data.nft_reward, reward_data.reward_tier
  );

  -- Update user_balances table
  INSERT INTO user_balances (
    wallet_address, 
    total_neft_claimed, 
    total_xp_earned, 
    last_updated
  ) VALUES (
    user_wallet, 
    total_reward_neft, 
    total_reward_xp,
    NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + total_reward_neft,
    total_xp_earned = user_balances.total_xp_earned + total_reward_xp,
    last_updated = NOW();

  -- Return success result
  RETURN QUERY SELECT 
    TRUE,
    'Daily reward claimed successfully!'::TEXT,
    calculated_streak,
    total_reward_neft,
    total_reward_xp,
    reward_data.reward_tier,
    reward_data.nft_reward,
    reward_data.is_milestone,
    total_reward_neft,
    total_reward_xp;
END;
$$;

-- ============================================================================
-- STEP 6: INSERT DEFAULT MILESTONES
-- ============================================================================

INSERT INTO daily_claim_milestones (
  milestone_day, milestone_name, milestone_description,
  base_neft_reward, bonus_neft_reward, base_xp_reward, bonus_xp_reward,
  is_special_milestone, icon_name, color_scheme
) VALUES 
  (7, 'Week Warrior', 'Claimed for 7 consecutive days!', 25.0, 10.0, 150, 50, true, 'Trophy', 'from-yellow-500 to-yellow-300'),
  (14, 'Fortnight Fighter', 'Two weeks of dedication!', 50.0, 25.0, 300, 100, true, 'Medal', 'from-purple-500 to-purple-300'),
  (30, 'Monthly Master', 'A full month of daily claims!', 100.0, 50.0, 600, 200, true, 'Crown', 'from-gold-500 to-gold-300'),
  (100, 'Century Champion', '100 days of commitment!', 250.0, 100.0, 1500, 500, true, 'Star', 'from-rainbow-500 to-rainbow-300')
ON CONFLICT (milestone_day) DO NOTHING;

-- ============================================================================
-- STEP 7: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION calculate_daily_reward(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION can_claim_daily_reward(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated;

-- ============================================================================
-- STEP 8: SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🎯 CLEAN DATABASE MIGRATION COMPLETED! 🎯';
    RAISE NOTICE '';
    RAISE NOTICE '✅ CLEANUP COMPLETED:';
    RAISE NOTICE '   - Removed all conflicting functions and triggers';
    RAISE NOTICE '   - Dropped old daily claims tables';
    RAISE NOTICE '   - Preserved user_balances table';
    RAISE NOTICE '';
    RAISE NOTICE '✅ NEW SCHEMA DEPLOYED:';
    RAISE NOTICE '   - user_streaks (with 24-hour tracking)';
    RAISE NOTICE '   - daily_claims (with exact timestamps)';
    RAISE NOTICE '   - daily_claim_milestones (with default rewards)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ 24-HOUR COOLDOWN FEATURES:';
    RAISE NOTICE '   - True 24-hour intervals between claims';
    RAISE NOTICE '   - Precise remaining time calculations';
    RAISE NOTICE '   - can_claim_daily_reward() helper function';
    RAISE NOTICE '   - Streak logic based on 48-hour window';
    RAISE NOTICE '';
    RAISE NOTICE '✅ MILESTONE SYSTEM:';
    RAISE NOTICE '   - Week Warrior (7 days): 35 NEFT + 200 XP';
    RAISE NOTICE '   - Fortnight Fighter (14 days): 75 NEFT + 400 XP';
    RAISE NOTICE '   - Monthly Master (30 days): 150 NEFT + 800 XP';
    RAISE NOTICE '   - Century Champion (100 days): 350 NEFT + 2000 XP';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 READY TO TEST:';
    RAISE NOTICE '   SELECT * FROM can_claim_daily_reward(''your_wallet'');';
    RAISE NOTICE '   SELECT * FROM process_daily_claim(''your_wallet'');';
END $$;
