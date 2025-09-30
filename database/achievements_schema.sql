-- Achievements Schema for Supabase
-- Tracks user achievements and progress for wallet addresses

-- 1. Achievement Categories Enum
CREATE TYPE achievement_category AS ENUM ('quest', 'burn', 'social', 'referral', 'checkin', 'staking', 'campaign');
CREATE TYPE achievement_status AS ENUM ('locked', 'in-progress', 'completed');

-- 2. Achievements Master Table
-- Defines all available achievements in the system
CREATE TABLE IF NOT EXISTS achievements_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  achievement_key TEXT NOT NULL UNIQUE, -- Unique identifier for the achievement
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category achievement_category NOT NULL,
  icon TEXT, -- Icon name or URL
  color TEXT DEFAULT 'from-blue-600 to-blue-400',
  neft_reward DECIMAL(18,8) DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  nft_reward TEXT, -- NFT type if applicable
  required_count INTEGER DEFAULT 1, -- How many times action needs to be performed
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (neft_reward >= 0),
  CHECK (xp_reward >= 0),
  CHECK (required_count > 0)
);

-- 3. User Achievements Table
-- Tracks individual user progress on achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  achievement_key TEXT NOT NULL REFERENCES achievements_master(achievement_key),
  status achievement_status DEFAULT 'locked',
  current_progress INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(wallet_address, achievement_key),
  CHECK (current_progress >= 0)
);

-- 4. RLS Policies for Security
ALTER TABLE achievements_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view achievements master (public data)
CREATE POLICY "Anyone can view achievements master" ON achievements_master
  FOR SELECT USING (is_active = TRUE);

-- Policy: Users can only see their own achievement progress
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own achievements" ON user_achievements
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can update own achievements" ON user_achievements
  FOR UPDATE USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- 5. Function to Initialize User Achievements
-- Creates achievement records for a new user
CREATE OR REPLACE FUNCTION initialize_user_achievements(user_wallet TEXT)
RETURNS INTEGER AS $$
DECLARE
  achievement_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  -- Insert all active achievements for the user if they don't exist
  FOR achievement_record IN 
    SELECT achievement_key FROM achievements_master WHERE is_active = TRUE
  LOOP
    INSERT INTO user_achievements (wallet_address, achievement_key, status)
    VALUES (user_wallet, achievement_record.achievement_key, 'locked')
    ON CONFLICT (wallet_address, achievement_key) DO NOTHING;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to Update Achievement Progress
-- Updates progress for a specific achievement
CREATE OR REPLACE FUNCTION update_achievement_progress(
  user_wallet TEXT,
  achievement_key_param TEXT,
  progress_increment INTEGER DEFAULT 1
)
RETURNS TABLE(
  achievement_completed BOOLEAN,
  new_progress INTEGER,
  required_count INTEGER
) AS $$
DECLARE
  current_progress_val INTEGER;
  required_count_val INTEGER;
  achievement_completed_val BOOLEAN := FALSE;
BEGIN
  -- Get current progress and required count
  SELECT ua.current_progress, am.required_count
  INTO current_progress_val, required_count_val
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF NOT FOUND THEN
    -- Initialize achievement if it doesn't exist
    PERFORM initialize_user_achievements(user_wallet);
    current_progress_val := 0;
    SELECT am.required_count INTO required_count_val
    FROM achievements_master am WHERE am.achievement_key = achievement_key_param;
  END IF;
  
  -- Update progress
  current_progress_val := current_progress_val + progress_increment;
  
  -- Check if achievement is completed
  IF current_progress_val >= required_count_val THEN
    achievement_completed_val := TRUE;
    
    UPDATE user_achievements SET
      current_progress = current_progress_val,
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  ELSE
    UPDATE user_achievements SET
      current_progress = current_progress_val,
      status = CASE WHEN current_progress_val > 0 THEN 'in_progress' ELSE 'locked' END,
      updated_at = NOW()
    WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  END IF;
  
  RETURN QUERY SELECT achievement_completed_val, current_progress_val, required_count_val;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to Claim Achievement Reward
-- Claims rewards for a completed achievement
CREATE OR REPLACE FUNCTION claim_achievement_reward(
  user_wallet TEXT,
  achievement_key_param TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  nft_reward TEXT
) AS $$
DECLARE
  achievement_data RECORD;
BEGIN
  -- Get achievement data and check if it can be claimed
  SELECT 
    am.neft_reward, am.xp_reward, am.nft_reward, am.title,
    ua.status, ua.claimed_at
  INTO achievement_data
  FROM user_achievements ua
  JOIN achievements_master am ON ua.achievement_key = am.achievement_key
  WHERE ua.wallet_address = user_wallet AND ua.achievement_key = achievement_key_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Achievement not found'::TEXT, 0.0::DECIMAL(18,8), 0::INTEGER, NULL::TEXT;
    RETURN;
  END IF;
  
  IF achievement_data.status != 'completed' THEN
    RETURN QUERY SELECT FALSE, 'Achievement not completed yet'::TEXT, 0.0::DECIMAL(18,8), 0::INTEGER, NULL::TEXT;
    RETURN;
  END IF;
  
  IF achievement_data.claimed_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Achievement reward already claimed'::TEXT, 0.0::DECIMAL(18,8), 0::INTEGER, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Update user balance with achievement rewards
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned)
  VALUES (user_wallet, achievement_data.neft_reward, achievement_data.xp_reward)
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + achievement_data.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + achievement_data.xp_reward,
    last_updated = NOW();
  
  -- Mark as claimed
  UPDATE user_achievements SET
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE wallet_address = user_wallet AND achievement_key = achievement_key_param;
  
  -- Return success with reward details
  RETURN QUERY SELECT 
    TRUE, 
    ('Successfully claimed reward for ' || achievement_data.title)::TEXT,
    achievement_data.neft_reward,
    achievement_data.xp_reward,
    achievement_data.nft_reward;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to Get User Achievements
-- Returns user's achievements with progress and master data
CREATE OR REPLACE FUNCTION get_user_achievements(
  user_wallet TEXT,
  category_filter achievement_category DEFAULT NULL
)
RETURNS TABLE(
  achievement_key TEXT,
  title TEXT,
  description TEXT,
  category achievement_category,
  icon TEXT,
  color TEXT,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  nft_reward TEXT,
  required_count INTEGER,
  current_progress INTEGER,
  status achievement_status,
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  progress_percentage INTEGER
) AS $$
BEGIN
  -- Initialize achievements for user if needed
  PERFORM initialize_user_achievements(user_wallet);
  
  RETURN QUERY
  SELECT 
    am.achievement_key,
    am.title,
    am.description,
    am.category,
    am.icon,
    am.color,
    am.neft_reward,
    am.xp_reward,
    am.nft_reward,
    am.required_count,
    COALESCE(ua.current_progress, 0),
    COALESCE(ua.status, 'locked'),
    ua.completed_at,
    ua.claimed_at,
    CASE 
      WHEN am.required_count > 0 THEN 
        LEAST(100, (COALESCE(ua.current_progress, 0) * 100 / am.required_count))
      ELSE 0 
    END AS progress_percentage
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
    AND ua.wallet_address = user_wallet
  WHERE am.is_active = TRUE
    AND (category_filter IS NULL OR am.category = category_filter)
  ORDER BY am.sort_order, am.title;
END;
$$ LANGUAGE plpgsql;

-- 9. Insert Default Achievements
-- Populate the achievements master table with default achievements
INSERT INTO achievements_master (achievement_key, title, description, category, icon, color, neft_reward, xp_reward, required_count, sort_order) VALUES
-- Quest Achievements
('first_quest', 'First Quest', 'Complete your first quest', 'quest', 'Trophy', 'from-blue-600 to-blue-400', 100, 50, 1, 1),
('quest_master', 'Quest Master', 'Complete 10 quests', 'quest', 'Star', 'from-purple-600 to-purple-400', 500, 250, 10, 2),
('quest_legend', 'Quest Legend', 'Complete 50 quests', 'quest', 'Crown', 'from-yellow-600 to-yellow-400', 2000, 1000, 50, 3),

-- Burn Achievements
('first_burn', 'First Burn', 'Burn your first NFT', 'burn', 'Flame', 'from-red-600 to-red-400', 150, 75, 1, 10),
('burn_enthusiast', 'Burn Enthusiast', 'Burn 25 NFTs', 'burn', 'Fire', 'from-orange-600 to-orange-400', 750, 375, 25, 11),
('burn_master', 'Burn Master', 'Burn 100 NFTs', 'burn', 'Zap', 'from-red-700 to-red-500', 3000, 1500, 100, 12),

-- Social Achievements
('social_starter', 'Social Starter', 'Share on social media', 'social', 'Share', 'from-green-600 to-green-400', 100, 50, 1, 20),
('influencer', 'Influencer', 'Get 10 referrals', 'social', 'Users', 'from-teal-600 to-teal-400', 1000, 500, 10, 21),

-- Check-in Achievements
('daily_visitor', 'Daily Visitor', 'Login for 7 consecutive days', 'checkin', 'Calendar', 'from-indigo-600 to-indigo-400', 300, 150, 7, 30),
('dedicated_user', 'Dedicated User', 'Login for 30 consecutive days', 'checkin', 'CalendarCheck', 'from-purple-600 to-purple-400', 1500, 750, 30, 31),

-- Staking Achievements
('first_stake', 'First Stake', 'Stake your first NFT or tokens', 'staking', 'Lock', 'from-blue-600 to-blue-400', 200, 100, 1, 40),
('staking_pro', 'Staking Pro', 'Stake for 30 days continuously', 'staking', 'TrendingUp', 'from-green-600 to-green-400', 1000, 500, 30, 41),

-- Campaign Achievements
('campaign_participant', 'Campaign Participant', 'Participate in your first campaign', 'campaign', 'Flag', 'from-pink-600 to-pink-400', 250, 125, 1, 50),
('campaign_champion', 'Campaign Champion', 'Win 5 campaigns', 'campaign', 'Award', 'from-yellow-600 to-yellow-400', 2500, 1250, 5, 51)

ON CONFLICT (achievement_key) DO NOTHING;

-- 10. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_achievements_master_category ON achievements_master(category);
CREATE INDEX IF NOT EXISTS idx_achievements_master_active ON achievements_master(is_active);
CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet ON user_achievements(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_achievements_status ON user_achievements(status);
CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet_status ON user_achievements(wallet_address, status);

-- 11. Comments for Documentation
COMMENT ON TABLE achievements_master IS 'Master list of all available achievements';
COMMENT ON TABLE user_achievements IS 'Individual user progress on achievements';
COMMENT ON FUNCTION initialize_user_achievements IS 'Creates achievement records for a new user';
COMMENT ON FUNCTION update_achievement_progress IS 'Updates progress for a specific achievement';
COMMENT ON FUNCTION claim_achievement_reward IS 'Claims rewards for a completed achievement';
COMMENT ON FUNCTION get_user_achievements IS 'Returns user achievements with progress and master data';
