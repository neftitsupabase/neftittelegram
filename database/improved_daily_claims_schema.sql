-- Enhanced Daily Claims Schema for Supabase
-- Comprehensive daily reward system with proper integration

-- ============================================================================
-- 1. ENHANCED DAILY CLAIMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_count INTEGER NOT NULL DEFAULT 1,
  base_neft_reward DECIMAL(18,8) NOT NULL DEFAULT 0,
  bonus_neft_reward DECIMAL(18,8) NOT NULL DEFAULT 0,
  total_neft_reward DECIMAL(18,8) GENERATED ALWAYS AS (base_neft_reward + bonus_neft_reward) STORED,
  base_xp_reward INTEGER NOT NULL DEFAULT 0,
  bonus_xp_reward INTEGER NOT NULL DEFAULT 0,
  total_xp_reward INTEGER GENERATED ALWAYS AS (base_xp_reward + bonus_xp_reward) STORED,
  nft_reward JSONB, -- Store NFT details as JSON
  reward_tier TEXT NOT NULL,
  multiplier_applied DECIMAL(3,2) DEFAULT 1.0, -- For future premium features
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_timezone TEXT DEFAULT 'UTC',
  
  -- Constraints
  UNIQUE(wallet_address, claim_date),
  CHECK (streak_count > 0),
  CHECK (base_neft_reward >= 0),
  CHECK (bonus_neft_reward >= 0),
  CHECK (base_xp_reward >= 0),
  CHECK (bonus_xp_reward >= 0),
  CHECK (multiplier_applied > 0)
);

-- ============================================================================
-- 2. ENHANCED USER STREAKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_claims INTEGER NOT NULL DEFAULT 0,
  last_claim_date DATE,
  streak_started_at DATE,
  total_neft_earned DECIMAL(18,8) NOT NULL DEFAULT 0,
  total_xp_earned INTEGER NOT NULL DEFAULT 0,
  milestone_rewards_claimed JSONB DEFAULT '[]'::JSONB, -- Track claimed milestones
  user_timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (current_streak >= 0),
  CHECK (longest_streak >= 0),
  CHECK (total_claims >= 0),
  CHECK (total_neft_earned >= 0),
  CHECK (total_xp_earned >= 0)
);

-- ============================================================================
-- 3. DAILY CLAIM MILESTONES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_claim_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  milestone_day INTEGER NOT NULL UNIQUE,
  milestone_name TEXT NOT NULL,
  milestone_description TEXT,
  base_neft_reward DECIMAL(18,8) NOT NULL DEFAULT 0,
  bonus_neft_reward DECIMAL(18,8) NOT NULL DEFAULT 0,
  base_xp_reward INTEGER NOT NULL DEFAULT 0,
  bonus_xp_reward INTEGER NOT NULL DEFAULT 0,
  nft_reward JSONB, -- NFT details for milestone rewards
  is_special_milestone BOOLEAN DEFAULT FALSE,
  icon_name TEXT,
  color_scheme TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CHECK (milestone_day > 0),
  CHECK (base_neft_reward >= 0),
  CHECK (bonus_neft_reward >= 0),
  CHECK (base_xp_reward >= 0),
  CHECK (bonus_xp_reward >= 0)
);

-- ============================================================================
-- 4. INSERT DEFAULT MILESTONES
-- ============================================================================
INSERT INTO daily_claim_milestones (
  milestone_day, milestone_name, milestone_description, 
  base_neft_reward, bonus_neft_reward, base_xp_reward, bonus_xp_reward, 
  nft_reward, is_special_milestone, icon_name, color_scheme
) VALUES 
  (1, 'First Step', 'Welcome to daily rewards!', 10, 0, 5, 0, NULL, FALSE, 'gift', 'blue'),
  (3, 'Getting Started', 'Three days strong!', 15, 10, 8, 5, NULL, TRUE, 'star', 'yellow'),
  (7, 'Weekly Warrior', 'A full week of dedication!', 25, 25, 15, 15, '{"type": "common", "rarity": "common"}', TRUE, 'trophy', 'green'),
  (14, 'Fortnight Champion', 'Two weeks of consistency!', 50, 50, 25, 25, '{"type": "rare", "rarity": "rare"}', TRUE, 'flame', 'orange'),
  (30, 'Monthly Master', 'A full month of commitment!', 100, 100, 50, 50, '{"type": "epic", "rarity": "epic"}', TRUE, 'crown', 'purple'),
  (60, 'Dedication Legend', 'Two months of unwavering dedication!', 200, 200, 100, 100, '{"type": "legendary", "rarity": "legendary"}', TRUE, 'diamond', 'rainbow'),
  (100, 'Centennial Hero', 'One hundred days of excellence!', 500, 500, 250, 250, '{"type": "mythic", "rarity": "mythic"}', TRUE, 'infinity', 'gold')
ON CONFLICT (milestone_day) DO NOTHING;

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================
ALTER TABLE daily_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_claim_milestones ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view own daily claims" ON daily_claims;
DROP POLICY IF EXISTS "Users can insert own daily claims" ON daily_claims;
DROP POLICY IF EXISTS "Users can view own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Users can insert own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Users can update own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Anyone can view milestones" ON daily_claim_milestones;

-- Daily Claims Policies
CREATE POLICY "Users can view own daily claims" ON daily_claims
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own daily claims" ON daily_claims
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- User Streaks Policies
CREATE POLICY "Users can view own streaks" ON user_streaks
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own streaks" ON user_streaks
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can update own streaks" ON user_streaks
  FOR UPDATE USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- Milestones are public read-only
CREATE POLICY "Anyone can view milestones" ON daily_claim_milestones
  FOR SELECT USING (true);

-- ============================================================================
-- 6. ENHANCED REWARD CALCULATION FUNCTION
-- ============================================================================
-- Drop existing function first to avoid signature conflicts
DROP FUNCTION IF EXISTS calculate_daily_reward(INTEGER);

CREATE OR REPLACE FUNCTION calculate_daily_reward(
  streak_count INTEGER,
  user_wallet TEXT DEFAULT NULL
)
RETURNS TABLE(
  base_neft DECIMAL(18,8),
  bonus_neft DECIMAL(18,8),
  base_xp INTEGER,
  bonus_xp INTEGER,
  reward_tier TEXT,
  nft_reward JSONB,
  is_milestone BOOLEAN
) AS $$
DECLARE
  milestone_record RECORD;
  base_daily_neft DECIMAL(18,8);
  base_daily_xp INTEGER;
BEGIN
  -- Calculate base daily rewards (progressive scaling)
  base_daily_neft := GREATEST(10.0, 10.0 + (streak_count * 1.5));
  base_daily_xp := GREATEST(5, 5 + (streak_count::INTEGER / 2));
  
  -- Check if this streak count is a milestone
  SELECT * INTO milestone_record 
  FROM daily_claim_milestones 
  WHERE milestone_day = streak_count;
  
  IF FOUND THEN
    -- Milestone reward
    RETURN QUERY SELECT 
      milestone_record.base_neft_reward,
      milestone_record.bonus_neft_reward,
      milestone_record.base_xp_reward,
      milestone_record.bonus_xp_reward,
      milestone_record.milestone_name,
      milestone_record.nft_reward,
      TRUE;
  ELSE
    -- Regular daily reward
    RETURN QUERY SELECT 
      base_daily_neft,
      0.0::DECIMAL(18,8), -- No bonus for regular days
      base_daily_xp,
      0::INTEGER, -- No bonus XP for regular days
      CASE 
        WHEN streak_count = 1 THEN 'Daily Starter'
        WHEN streak_count <= 7 THEN 'Building Momentum'
        WHEN streak_count <= 30 THEN 'Consistent Performer'
        WHEN streak_count <= 60 THEN 'Dedicated User'
        ELSE 'Legendary Streaker'
      END,
      NULL::JSONB,
      FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. ENHANCED USER STREAK INFO FUNCTION
-- ============================================================================
-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_user_streak_info(TEXT);

CREATE OR REPLACE FUNCTION get_user_streak_info(user_wallet TEXT)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  total_claims INTEGER,
  can_claim_today BOOLEAN,
  last_claim_date DATE,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER,
  next_milestone_day INTEGER,
  next_milestone_name TEXT,
  streak_started_at DATE
)
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  next_milestone RECORD;
BEGIN
  -- Get user streak data
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;
  
  -- Get next milestone
  SELECT milestone_day, milestone_name INTO next_milestone
  FROM daily_claim_milestones 
  WHERE milestone_day > COALESCE(user_record.current_streak, 0)
  ORDER BY milestone_day ASC 
  LIMIT 1;
  
  IF user_record IS NULL THEN
    -- New user
    RETURN QUERY SELECT 
      0, 0, 0, 
      TRUE, -- Can claim today
      NULL::DATE,
      0.0::DECIMAL(18,8),
      0::INTEGER,
      COALESCE(next_milestone.milestone_day, 1),
      COALESCE(next_milestone.milestone_name, 'First Milestone'),
      NULL::DATE;
  ELSE
    RETURN QUERY SELECT 
      user_record.current_streak,
      user_record.longest_streak,
      user_record.total_claims,
      NOT EXISTS (
        SELECT 1 FROM daily_claims 
        WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE
      ),
      user_record.last_claim_date,
      user_record.total_neft_earned,
      user_record.total_xp_earned,
      COALESCE(next_milestone.milestone_day, user_record.current_streak + 1),
      COALESCE(next_milestone.milestone_name, 'Continue Streak'),
      user_record.streak_started_at;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. ENHANCED DAILY CLAIM PROCESSING FUNCTION
-- ============================================================================
-- Fix for ambiguous column reference "current_streak" in process_daily_claim function
-- Error: column reference "current_streak" is ambiguous - could refer to PL/pgSQL variable or table column

-- Drop and recreate the process_daily_claim function with proper variable references
DROP FUNCTION IF EXISTS process_daily_claim(TEXT);

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
AS $$
DECLARE
  calculated_streak INTEGER := 0;  -- Renamed to avoid ambiguity with table column
  last_claim DATE;
  reward_data RECORD;
  user_record RECORD;
  new_total_neft DECIMAL(18,8);
  new_total_xp INTEGER;
  total_reward_neft DECIMAL(18,8);
  total_reward_xp INTEGER;
BEGIN
  -- Check if user can claim today
  IF EXISTS (SELECT 1 FROM daily_claims WHERE wallet_address = user_wallet AND claim_date = CURRENT_DATE) THEN
    RETURN QUERY SELECT FALSE, 'Already claimed today'::TEXT, 0, 0.0::DECIMAL(18,8), 0, ''::TEXT, NULL::JSONB, FALSE, 0.0::DECIMAL(18,8), 0;
    RETURN;
  END IF;

  -- Get or create user streak record
  SELECT * INTO user_record FROM user_streaks WHERE wallet_address = user_wallet;

  IF user_record IS NULL THEN
    -- First time user
    calculated_streak := 1;
    INSERT INTO user_streaks (
      wallet_address, current_streak, longest_streak, last_claim_date, 
      total_claims, streak_started_at, total_neft_earned, total_xp_earned
    ) VALUES (
      user_wallet, 1, 1, CURRENT_DATE, 1, CURRENT_DATE, 0, 0
    );
  ELSE
    -- Check if streak continues or resets
    IF user_record.last_claim_date = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Streak continues
      calculated_streak := user_record.current_streak + 1;
    ELSIF user_record.last_claim_date < CURRENT_DATE - INTERVAL '1 day' OR user_record.last_claim_date IS NULL THEN
      -- Streak broken or first claim, reset to 1
      calculated_streak := 1;
    ELSE
      -- This shouldn't happen, but handle edge case
      calculated_streak := 1;
    END IF;
  END IF;

  -- Calculate reward using the calculated streak
  SELECT * INTO reward_data FROM calculate_daily_reward(calculated_streak, user_wallet);

  -- Calculate total rewards for this claim
  total_reward_neft := reward_data.base_neft + reward_data.bonus_neft;
  total_reward_xp := reward_data.base_xp + reward_data.bonus_xp;

  -- Calculate new totals for user_streaks
  new_total_neft := COALESCE(user_record.total_neft_earned, 0) + total_reward_neft;
  new_total_xp := COALESCE(user_record.total_xp_earned, 0) + total_reward_xp;

  -- Update user streaks with explicit variable references (FIXED - no more ambiguity)
  UPDATE user_streaks SET
    current_streak = calculated_streak,  -- Use variable name directly
    longest_streak = GREATEST(COALESCE(longest_streak, 0), calculated_streak),  -- Use variable name directly
    last_claim_date = CURRENT_DATE,
    total_claims = COALESCE(total_claims, 0) + 1,
    total_neft_earned = new_total_neft,
    total_xp_earned = new_total_xp,
    last_updated = NOW(),
    streak_started_at = CASE 
      WHEN calculated_streak = 1 THEN CURRENT_DATE  -- Use variable name directly
      ELSE COALESCE(streak_started_at, CURRENT_DATE)
    END
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

  -- Update user_balances table (critical for balance display)
  -- Note: Only updating columns that actually exist in the table schema
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
    CASE 
      WHEN reward_data.is_milestone THEN 'Milestone achieved! ' || reward_data.reward_tier || ' unlocked!'
      ELSE 'Daily reward claimed successfully!'
    END,
    calculated_streak,
    total_reward_neft,
    total_reward_xp,
    reward_data.reward_tier,
    reward_data.nft_reward,
    reward_data.is_milestone,
    new_total_neft,
    new_total_xp;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_daily_claim IS 'Fixed daily claim processing - resolved ambiguous column reference error';

-- ============================================================================
-- 9. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_daily_claims_wallet_date ON daily_claims(wallet_address, claim_date);
CREATE INDEX IF NOT EXISTS idx_daily_claims_streak ON daily_claims(streak_count);
CREATE INDEX IF NOT EXISTS idx_user_streaks_wallet ON user_streaks(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak);
CREATE INDEX IF NOT EXISTS idx_milestones_day ON daily_claim_milestones(milestone_day);

-- ============================================================================
-- 10. UTILITY FUNCTIONS
-- ============================================================================

-- Function to get milestone information
CREATE OR REPLACE FUNCTION get_milestone_info(milestone_day INTEGER)
RETURNS TABLE(
  milestone_name TEXT,
  milestone_description TEXT,
  total_neft_reward DECIMAL(18,8),
  total_xp_reward INTEGER,
  nft_reward JSONB,
  is_special_milestone BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.milestone_name,
    m.milestone_description,
    m.base_neft_reward + m.bonus_neft_reward,
    m.base_xp_reward + m.bonus_xp_reward,
    m.nft_reward,
    m.is_special_milestone
  FROM daily_claim_milestones m
  WHERE m.milestone_day = milestone_day;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's claim history
CREATE OR REPLACE FUNCTION get_user_claim_history(
  user_wallet TEXT,
  limit_count INTEGER DEFAULT 30,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
  claim_date DATE,
  streak_count INTEGER,
  total_neft_reward DECIMAL(18,8),
  total_xp_reward INTEGER,
  reward_tier TEXT,
  nft_reward JSONB,
  claimed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.claim_date,
    dc.streak_count,
    dc.total_neft_reward,
    dc.total_xp_reward,
    dc.reward_tier,
    dc.nft_reward,
    dc.claimed_at
  FROM daily_claims dc
  WHERE dc.wallet_address = user_wallet
  ORDER BY dc.claim_date DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE daily_claims IS 'Enhanced daily claim records with base and bonus rewards';
COMMENT ON TABLE user_streaks IS 'Comprehensive user streak tracking with totals and milestones';
COMMENT ON TABLE daily_claim_milestones IS 'Configurable milestone rewards for streak achievements';
COMMENT ON FUNCTION process_daily_claim IS 'Enhanced daily claim processing with campaign rewards integration';
COMMENT ON FUNCTION get_user_streak_info IS 'Comprehensive user streak information with next milestone data';
COMMENT ON FUNCTION calculate_daily_reward IS 'Advanced reward calculation with milestone detection';
