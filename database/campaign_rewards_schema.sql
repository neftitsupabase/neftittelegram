-- Campaign Rewards Schema for Supabase
-- Tracks campaign reward claims for wallet addresses

-- 1. Campaign Reward Claims Table
-- Stores claimed rewards (NEFT + XP) for each user per project
CREATE TABLE IF NOT EXISTS campaign_reward_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  project_id TEXT NOT NULL, -- References projects table
  neft_reward DECIMAL(18,8) NOT NULL DEFAULT 0, -- NEFT tokens claimed
  xp_reward INTEGER NOT NULL DEFAULT 0, -- XP points claimed
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(wallet_address, project_id), -- Prevent duplicate claims per project
  CHECK (neft_reward >= 0),
  CHECK (xp_reward >= 0)
);

-- 2. User Balances Table
-- Tracks total accumulated NEFT and XP for each wallet
CREATE TABLE IF NOT EXISTS user_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  total_neft_claimed DECIMAL(18,8) NOT NULL DEFAULT 0, -- Total NEFT from campaigns
  total_xp_earned INTEGER NOT NULL DEFAULT 0, -- Total XP from campaigns
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (total_neft_claimed >= 0),
  CHECK (total_xp_earned >= 0)
);

-- 3. RLS Policies for Security
-- Enable RLS on both tables
ALTER TABLE campaign_reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own reward claims
CREATE POLICY "Users can view own reward claims" ON campaign_reward_claims
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own reward claims" ON campaign_reward_claims
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- Policy: Users can only see their own balances
CREATE POLICY "Users can view own balances" ON user_balances
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own balances" ON user_balances
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can update own balances" ON user_balances
  FOR UPDATE USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- 4. Function to Update User Balance After Claim
-- Automatically updates user_balances when a reward is claimed
CREATE OR REPLACE FUNCTION update_user_balance_after_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user balance
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned)
  VALUES (NEW.wallet_address, NEW.neft_reward, NEW.xp_reward)
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + NEW.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + NEW.xp_reward,
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger to Auto-Update User Balance
CREATE TRIGGER trigger_update_user_balance_after_claim
  AFTER INSERT ON campaign_reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_after_claim();

-- 6. Function to Get User's Total Balances
-- Returns total NEFT and XP for a user (for MainNav display)
CREATE OR REPLACE FUNCTION get_user_total_balances(user_wallet TEXT)
RETURNS TABLE(total_neft DECIMAL(18,8), total_xp INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ub.total_neft_claimed, 0) as total_neft,
    COALESCE(ub.total_xp_earned, 0) as total_xp
  FROM user_balances ub
  WHERE ub.wallet_address = user_wallet;
  
  -- If no record exists, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::DECIMAL(18,8), 0::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to Check if User Can Claim Reward
-- Checks if user has already claimed rewards for a specific project
CREATE OR REPLACE FUNCTION can_claim_project_reward(user_wallet TEXT, proj_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  total_tasks INTEGER;
  completed_tasks INTEGER;
  already_claimed BOOLEAN;
  project_uuid UUID;
BEGIN
  -- Convert proj_id to UUID if it's a string
  BEGIN
    project_uuid := proj_id::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    -- If conversion fails, return false
    RETURN FALSE;
  END;
  
  -- Get total tasks for this project
  SELECT COUNT(*) INTO total_tasks
  FROM project_tasks 
  WHERE project_id = project_uuid AND is_active = true;
  
  -- If no tasks exist, can't claim
  IF total_tasks = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Get completed tasks for this user
  SELECT COUNT(*) INTO completed_tasks
  FROM user_task_completions utc
  WHERE utc.wallet_address = user_wallet 
    AND utc.project_id = project_uuid 
    AND utc.completed = true;
  
  -- Check if already claimed
  SELECT EXISTS(
    SELECT 1 FROM campaign_reward_claims 
    WHERE wallet_address = user_wallet AND project_id = proj_id
  ) INTO already_claimed;
  
  -- Can claim only if:
  -- 1. All tasks are completed AND
  -- 2. Not already claimed
  -- NOTE: We removed the project end date check that was causing issues
  RETURN (completed_tasks = total_tasks) AND NOT already_claimed;
  
EXCEPTION WHEN OTHERS THEN
  -- On any error, return false
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_campaign_claims_wallet ON campaign_reward_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_campaign_claims_project ON campaign_reward_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);

-- 9. Comments for Documentation
COMMENT ON TABLE campaign_reward_claims IS 'Tracks individual campaign reward claims per user per project';
COMMENT ON TABLE user_balances IS 'Aggregated NEFT and XP balances for each user from all campaign claims';
COMMENT ON FUNCTION get_user_total_balances IS 'Returns total NEFT and XP balances for a user';
COMMENT ON FUNCTION can_claim_project_reward IS 'Checks if user can claim rewards for a specific project';
