-- ============================================================================
-- COMPLETE DAILY CLAIMS DATABASE SCHEMA - PRODUCTION READY
-- ============================================================================
-- This file contains the complete, working database setup for the Daily Claims
-- system with low egress optimizations and all required tables and functions.
-- ============================================================================

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- User Streaks Table - Tracks daily claim streaks
CREATE TABLE IF NOT EXISTS user_streaks (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_claim_date DATE,
  total_claims INTEGER DEFAULT 0,
  streak_started_at DATE,
  total_neft_earned DECIMAL(18,8) DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Claims Table - Records each individual claim
CREATE TABLE IF NOT EXISTS daily_claims (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  claim_date DATE NOT NULL,
  streak_count INTEGER NOT NULL,
  base_neft_reward DECIMAL(18,8) DEFAULT 0,
  bonus_neft_reward DECIMAL(18,8) DEFAULT 0,
  base_xp_reward INTEGER DEFAULT 0,
  bonus_xp_reward INTEGER DEFAULT 0,
  nft_reward JSONB,
  reward_tier TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_address, claim_date)
);

-- Daily Claim Milestones Table - Defines special milestone rewards
CREATE TABLE IF NOT EXISTS daily_claim_milestones (
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

-- User Balances Table - Aggregated user balance tracking
CREATE TABLE IF NOT EXISTS user_balances (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  total_neft_claimed DECIMAL(18,8) DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

-- User Streaks Indexes
CREATE INDEX IF NOT EXISTS idx_user_streaks_wallet ON user_streaks(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_claim ON user_streaks(last_claim_date);

-- Daily Claims Indexes  
CREATE INDEX IF NOT EXISTS idx_daily_claims_wallet_date ON daily_claims(wallet_address, claim_date);
CREATE INDEX IF NOT EXISTS idx_daily_claims_wallet ON daily_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_daily_claims_date_desc ON daily_claims(claim_date DESC);

-- User Balances Indexes
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_claim_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;

-- User Streaks RLS Policies
DROP POLICY IF EXISTS "Users can view own streaks" ON user_streaks;
CREATE POLICY "Users can view own streaks" ON user_streaks
  FOR SELECT USING (
    wallet_address = current_setting('request.headers')::json->>'x-wallet-address'
    OR auth.jwt()->>'wallet_address' = wallet_address
    OR auth.jwt()->>'sub' = wallet_address
  );

DROP POLICY IF EXISTS "Service role can manage all streaks" ON user_streaks;
CREATE POLICY "Service role can manage all streaks" ON user_streaks
  FOR ALL USING (auth.role() = 'service_role');

-- Daily Claims RLS Policies
DROP POLICY IF EXISTS "Users can view own claims" ON daily_claims;
CREATE POLICY "Users can view own claims" ON daily_claims
  FOR SELECT USING (
    wallet_address = current_setting('request.headers')::json->>'x-wallet-address'
    OR auth.jwt()->>'wallet_address' = wallet_address
    OR auth.jwt()->>'sub' = wallet_address
  );

DROP POLICY IF EXISTS "Service role can manage all claims" ON daily_claims;
CREATE POLICY "Service role can manage all claims" ON daily_claims
  FOR ALL USING (auth.role() = 'service_role');

-- Milestones RLS Policies (public read)
DROP POLICY IF EXISTS "Anyone can view milestones" ON daily_claim_milestones;
CREATE POLICY "Anyone can view milestones" ON daily_claim_milestones
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage milestones" ON daily_claim_milestones;
CREATE POLICY "Service role can manage milestones" ON daily_claim_milestones
  FOR ALL USING (auth.role() = 'service_role');

-- User Balances RLS Policies
DROP POLICY IF EXISTS "Users can view own balances" ON user_balances;
CREATE POLICY "Users can view own balances" ON user_balances
  FOR SELECT USING (
    wallet_address = current_setting('request.headers')::json->>'x-wallet-address'
    OR auth.jwt()->>'wallet_address' = wallet_address
    OR auth.jwt()->>'sub' = wallet_address
  );

DROP POLICY IF EXISTS "Service role can manage all balances" ON user_balances;
CREATE POLICY "Service role can manage all balances" ON user_balances
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. CORE FUNCTIONS
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
    -- Regular daily reward (progressive scaling)
    RETURN QUERY SELECT 
      LEAST(10.0 + (streak_count * 2.0), 50.0)::DECIMAL(18,8), -- Base NEFT
      0.0::DECIMAL(18,8), -- Bonus NEFT
      LEAST(5 + streak_count, 25), -- Base XP
      0, -- Bonus XP
      NULL::JSONB, -- NFT reward
      'Daily Starter'::TEXT, -- Reward tier
      FALSE; -- Is milestone
  END IF;
END;
$$;

-- Get User Streak Info Function
CREATE OR REPLACE FUNCTION get_user_streak_info(user_wallet TEXT)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  total_claims INTEGER,
  can_claim_today BOOLEAN,
  last_claim_date DATE
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  user_record RECORD;
  can_claim BOOLEAN := FALSE;
BEGIN
  -- Get user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;
  
  IF user_record IS NULL THEN
    -- New user
    RETURN QUERY SELECT 0, 0, 0, TRUE, NULL::DATE;
  ELSE
    -- Check if user can claim today
    can_claim := NOT EXISTS (
      SELECT 1 FROM daily_claims 
      WHERE wallet_address = user_wallet 
      AND claim_date = CURRENT_DATE
    );
    
    RETURN QUERY SELECT 
      user_record.current_streak,
      user_record.longest_streak,
      user_record.total_claims,
      can_claim,
      user_record.last_claim_date;
  END IF;
END;
$$;

-- Process Daily Claim Function
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
BEGIN
  -- Check if already claimed today
  IF EXISTS (SELECT 1 FROM daily_claims WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE) THEN
    RETURN QUERY SELECT 
      FALSE, 'Already claimed today'::TEXT,
      0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE,
      0.0::DECIMAL(18,8), 0;
    RETURN;
  END IF;

  -- Get or create user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  IF user_record IS NULL THEN
    calculated_streak := 1;
    INSERT INTO user_streaks (
      wallet_address, current_streak, longest_streak, last_claim_date, 
      total_claims, streak_started_at, total_neft_earned, total_xp_earned
    ) VALUES (
      user_wallet, 1, 1, CURRENT_DATE, 1, CURRENT_DATE, 0, 0
    );
  ELSE
    -- Calculate streak continuation
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      calculated_streak := user_record.current_streak + 1;
    ELSE
      calculated_streak := 1;
    END IF;
  END IF;

  -- Get reward calculation
  SELECT * INTO reward_data FROM calculate_daily_reward(calculated_streak, user_wallet);
  
  total_reward_neft := reward_data.base_neft + reward_data.bonus_neft;
  total_reward_xp := reward_data.base_xp + reward_data.bonus_xp;

  -- Update user streaks
  UPDATE user_streaks SET
    current_streak = calculated_streak,
    longest_streak = GREATEST(longest_streak, calculated_streak),
    last_claim_date = CURRENT_DATE,
    total_claims = total_claims + 1,
    total_neft_earned = total_neft_earned + total_reward_neft,
    total_xp_earned = total_xp_earned + total_reward_xp,
    updated_at = NOW()
  WHERE wallet_address = user_wallet;

  -- Record the claim
  INSERT INTO daily_claims (
    wallet_address, claim_date, streak_count, 
    base_neft_reward, bonus_neft_reward, 
    base_xp_reward, bonus_xp_reward,
    nft_reward, reward_tier
  ) VALUES (
    user_wallet, CURRENT_DATE, calculated_streak,
    reward_data.base_neft, reward_data.bonus_neft,
    reward_data.base_xp, reward_data.bonus_xp,
    reward_data.nft_reward, reward_data.reward_tier
  );

  -- Update user_balances table (using actual table schema)
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
-- 5. LOW EGRESS OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Comprehensive Dashboard Function (Single RPC Call)
CREATE OR REPLACE FUNCTION get_daily_claim_dashboard(user_wallet TEXT)
RETURNS TABLE(
  -- Streak Information
  current_streak INTEGER,
  longest_streak INTEGER,
  total_claims INTEGER,
  can_claim_today BOOLEAN,
  last_claim_date DATE,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER,
  streak_started_at DATE,
  
  -- Next Claim Preview
  next_streak INTEGER,
  next_neft_reward DECIMAL(18,8),
  next_xp_reward INTEGER,
  next_reward_tier TEXT,
  next_is_milestone BOOLEAN,
  
  -- Upcoming Milestones (JSON array)
  upcoming_milestones JSONB,
  
  -- Recent Claims History (JSON array)
  recent_claims JSONB,
  
  -- Time calculations
  hours_until_next_claim INTEGER,
  minutes_until_next_claim INTEGER
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  user_record RECORD;
  reward_data RECORD;
  can_claim BOOLEAN := FALSE;
  next_streak_calc INTEGER;
  milestones_json JSONB;
  claims_json JSONB;
  hours_until INTEGER := 0;
  minutes_until INTEGER := 0;
BEGIN
  -- Get user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;
  
  -- Check if user can claim today
  can_claim := NOT EXISTS (
    SELECT 1 FROM daily_claims 
    WHERE wallet_address = user_wallet 
    AND claim_date = CURRENT_DATE
  );
  
  -- Calculate next streak
  IF user_record IS NULL THEN
    next_streak_calc := 1;
  ELSE
    IF can_claim THEN
      IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
        next_streak_calc := user_record.current_streak + 1;
      ELSE
        next_streak_calc := 1;
      END IF;
    ELSE
      next_streak_calc := user_record.current_streak;
    END IF;
  END IF;
  
  -- Get next reward calculation
  SELECT * INTO reward_data FROM calculate_daily_reward(next_streak_calc, user_wallet);
  
  -- Get upcoming milestones (single query, converted to JSON)
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'milestone_day', milestone_day,
        'milestone_name', milestone_name,
        'milestone_description', milestone_description,
        'total_neft_reward', base_neft_reward + bonus_neft_reward,
        'total_xp_reward', base_xp_reward + bonus_xp_reward,
        'nft_reward', nft_reward,
        'is_special_milestone', is_special_milestone,
        'icon_name', icon_name,
        'color_scheme', color_scheme
      ) ORDER BY milestone_day ASC
    ), '[]'::json
  )::JSONB INTO milestones_json
  FROM (
    SELECT milestone_day, milestone_name, milestone_description, 
           base_neft_reward, bonus_neft_reward, base_xp_reward, bonus_xp_reward,
           nft_reward, is_special_milestone, icon_name, color_scheme
    FROM daily_claim_milestones 
    WHERE milestone_day > COALESCE(user_record.current_streak, 0)
    ORDER BY milestone_day ASC 
    LIMIT 5
  ) milestone_data;
  
  -- Get recent claims history (single query, converted to JSON)
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'claim_date', claim_date,
        'streak_count', streak_count,
        'total_neft_reward', base_neft_reward + bonus_neft_reward,
        'total_xp_reward', base_xp_reward + bonus_xp_reward,
        'reward_tier', reward_tier,
        'nft_reward', nft_reward,
        'claimed_at', claimed_at
      )
      ORDER BY claim_date DESC
    ), '[]'::json
  )::JSONB INTO claims_json
  FROM daily_claims 
  WHERE wallet_address = user_wallet
  ORDER BY claim_date DESC 
  LIMIT 10;
  
  -- Calculate time until next claim (if already claimed today)
  IF NOT can_claim AND user_record.last_claim_date IS NOT NULL THEN
    SELECT 
      EXTRACT(HOUR FROM (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - NOW())),
      EXTRACT(MINUTE FROM (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - NOW()))
    INTO hours_until, minutes_until;
  END IF;
  
  -- Return comprehensive dashboard data
  RETURN QUERY SELECT 
    COALESCE(user_record.current_streak, 0),
    COALESCE(user_record.longest_streak, 0),
    COALESCE(user_record.total_claims, 0),
    can_claim,
    user_record.last_claim_date,
    COALESCE(user_record.total_neft_earned, 0.0),
    COALESCE(user_record.total_xp_earned, 0),
    user_record.streak_started_at,
    next_streak_calc,
    reward_data.base_neft + reward_data.bonus_neft,
    reward_data.base_xp + reward_data.bonus_xp,
    reward_data.reward_tier,
    reward_data.is_milestone,
    milestones_json,
    claims_json,
    hours_until::INTEGER,
    minutes_until::INTEGER;
END;
$$;

-- Fast Eligibility Check Function
CREATE OR REPLACE FUNCTION can_claim_daily_reward_fast(user_wallet TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM daily_claims 
    WHERE wallet_address = user_wallet 
    AND claim_date = CURRENT_DATE
  );
END;
$$;

-- Cached Milestones Function
CREATE OR REPLACE FUNCTION get_all_milestones_cached()
RETURNS TABLE(
  day INTEGER,
  name TEXT,
  description TEXT,
  reward TEXT,
  icon TEXT,
  color TEXT,
  isSpecial BOOLEAN
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    milestone_day,
    milestone_name,
    milestone_description,
    CONCAT(
      CASE WHEN base_neft_reward + bonus_neft_reward > 0 
           THEN (base_neft_reward + bonus_neft_reward)::TEXT || ' NEFT' 
           ELSE '' END,
      CASE WHEN base_neft_reward + bonus_neft_reward > 0 AND base_xp_reward + bonus_xp_reward > 0 
           THEN ' + ' ELSE '' END,
      CASE WHEN base_xp_reward + bonus_xp_reward > 0 
           THEN (base_xp_reward + bonus_xp_reward)::TEXT || ' XP' 
           ELSE '' END,
      CASE WHEN nft_reward IS NOT NULL 
           THEN ' + NFT' 
           ELSE '' END
    ),
    icon_name,
    color_scheme,
    is_special_milestone
  FROM daily_claim_milestones
  ORDER BY milestone_day ASC;
END;
$$;

-- ============================================================================
-- 6. SAMPLE MILESTONE DATA
-- ============================================================================

-- Insert default milestones
INSERT INTO daily_claim_milestones (
  milestone_day, milestone_name, milestone_description,
  base_neft_reward, bonus_neft_reward, base_xp_reward, bonus_xp_reward,
  nft_reward, is_special_milestone, icon_name, color_scheme
) VALUES 
  (1, 'Daily Starter', 'Your first daily login reward', 10, 0, 5, 0, NULL, FALSE, 'Gift', 'from-blue-600 to-blue-400'),
  (3, 'Getting Started', 'Three days strong!', 25, 0, 13, 0, NULL, TRUE, 'Star', 'from-yellow-600 to-yellow-400'),
  (7, 'Weekly Champion', 'A full week of engagement!', 50, 0, 30, 0, '{"rarity": "Common", "type": "Reward NFT"}', TRUE, 'Trophy', 'from-amber-600 to-amber-400'),
  (14, 'Fortnight Milestone', 'Two weeks of dedication', 100, 0, 50, 0, '{"rarity": "Rare", "type": "Reward NFT"}', TRUE, 'BadgeCheck', 'from-orange-600 to-orange-400'),
  (30, 'Monthly Master', 'A month of consistent engagement!', 200, 0, 100, 0, '{"rarity": "Epic", "type": "Reward NFT"}', TRUE, 'Flame', 'from-red-600 to-red-400')
ON CONFLICT (milestone_day) DO NOTHING;

-- ============================================================================
-- 7. PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant table permissions
GRANT SELECT ON user_streaks TO authenticated, anon;
GRANT SELECT ON daily_claims TO authenticated, anon;
GRANT SELECT ON daily_claim_milestones TO authenticated, anon;
GRANT SELECT ON user_balances TO authenticated, anon;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION get_user_streak_info(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION process_daily_claim(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_daily_claim_dashboard(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION can_claim_daily_reward_fast(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_all_milestones_cached() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_daily_reward(INTEGER, TEXT) TO authenticated, anon;

-- ============================================================================
-- 8. COMPLETION MESSAGE
-- ============================================================================

SELECT 'Daily Claims Database Schema Setup Complete!' as status,
       'Tables: user_streaks, daily_claims, daily_claim_milestones, user_balances' as tables_created,
       'Functions: get_user_streak_info, process_daily_claim, get_daily_claim_dashboard, can_claim_daily_reward_fast, get_all_milestones_cached' as functions_created,
       'RLS Policies: Enabled with wallet-based access control' as security,
       'Performance: Optimized indexes and low egress functions included' as optimization;
