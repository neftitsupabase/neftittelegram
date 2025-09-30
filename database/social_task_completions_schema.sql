-- Social Task Completions Table
-- Tracks completion of social media tasks for achievements

CREATE TABLE IF NOT EXISTS social_task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(wallet_address, achievement_key)
);

-- RLS Policies for Security
ALTER TABLE social_task_completions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own task completions
CREATE POLICY "Users can view own social task completions" ON social_task_completions
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own social task completions" ON social_task_completions
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can update own social task completions" ON social_task_completions
  FOR UPDATE USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_social_task_completions_wallet ON social_task_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_social_task_completions_achievement ON social_task_completions(achievement_key);
CREATE INDEX IF NOT EXISTS idx_social_task_completions_wallet_achievement ON social_task_completions(wallet_address, achievement_key);

-- Comments for Documentation
COMMENT ON TABLE social_task_completions IS 'Tracks completion of social media tasks for achievements';

-- Social Task Completions Table
-- Tracks completion of social media tasks for achievements

CREATE TABLE IF NOT EXISTS social_task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(wallet_address, achievement_key)
);

-- RLS Policies for Security
ALTER TABLE social_task_completions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own task completions
CREATE POLICY "Users can view own social task completions" ON social_task_completions
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own social task completions" ON social_task_completions
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can update own social task completions" ON social_task_completions
  FOR UPDATE USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_social_task_completions_wallet ON social_task_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_social_task_completions_achievement ON social_task_completions(achievement_key);
CREATE INDEX IF NOT EXISTS idx_social_task_completions_wallet_achievement ON social_task_completions(wallet_address, achievement_key);

-- Comments for Documentation
COMMENT ON TABLE social_task_completions IS 'Tracks completion of social media tasks for achievements';
