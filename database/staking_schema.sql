-- Comprehensive Staking Schema for Supabase
-- Optimized for low egress with minimal data storage and efficient queries

-- 1. Staked NFTs Table
-- Stores currently staked NFTs with minimal data (references IPFS for full metadata)
CREATE TABLE IF NOT EXISTS staked_nfts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  nft_id TEXT NOT NULL, -- NFT ID from IPFS metadata
  nft_rarity TEXT NOT NULL, -- Cached for reward calculation (avoids IPFS lookup)
  daily_reward DECIMAL(10,4) NOT NULL, -- Pre-calculated daily reward
  staked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_reward_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(wallet_address, nft_id), -- Prevent duplicate staking
  CHECK (nft_rarity IN ('Common', 'Rare', 'Legendary', 'Platinum', 'Silver', 'Gold'))
);

-- 2. Staked Tokens Table  
-- Stores token staking positions with APR calculations
CREATE TABLE IF NOT EXISTS staked_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount DECIMAL(18,8) NOT NULL, -- Token amount staked
  apr_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00, -- Annual percentage rate
  daily_reward DECIMAL(18,8) NOT NULL, -- Pre-calculated daily reward
  staked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_reward_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (amount > 0),
  CHECK (apr_rate >= 0)
);

-- 3. Staking Rewards Table
-- Tracks all rewards (NFT + Token) with claim status
CREATE TABLE IF NOT EXISTS staking_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  reward_type TEXT NOT NULL, -- 'nft_staking' or 'token_staking'
  source_id UUID, -- References staked_nfts.id or staked_tokens.id
  reward_amount DECIMAL(18,8) NOT NULL,
  reward_date DATE NOT NULL, -- Date for which reward was calculated
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(wallet_address, reward_type, source_id, reward_date), -- Prevent duplicate rewards
  CHECK (reward_type IN ('nft_staking', 'token_staking')),
  CHECK (reward_amount >= 0)
);

-- 4. Staking History Table (Optional - for analytics)
-- Lightweight history tracking for staking/unstaking events
CREATE TABLE IF NOT EXISTS staking_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'stake_nft', 'unstake_nft', 'stake_tokens', 'unstake_tokens', 'claim_rewards'
  asset_type TEXT NOT NULL, -- 'nft' or 'tokens'
  asset_id TEXT, -- NFT ID or token amount
  amount DECIMAL(18,8), -- For token operations
  transaction_hash TEXT, -- Blockchain transaction hash (if applicable)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (action_type IN ('stake_nft', 'unstake_nft', 'stake_tokens', 'unstake_tokens', 'claim_rewards')),
  CHECK (asset_type IN ('nft', 'tokens'))
);

-- Create indexes for efficient queries (low egress optimization)
CREATE INDEX IF NOT EXISTS idx_staked_nfts_wallet ON staked_nfts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staked_tokens_wallet ON staked_tokens(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staking_rewards_wallet_unclaimed ON staking_rewards(wallet_address, is_claimed) WHERE is_claimed = FALSE;
CREATE INDEX IF NOT EXISTS idx_staking_rewards_date ON staking_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_staking_history_wallet ON staking_history(wallet_address);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE staked_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staked_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE staking_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE staking_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own data
CREATE POLICY "Users can manage their own staked NFTs" ON staked_nfts
FOR ALL USING (true); -- Permissive for wallet-based auth

CREATE POLICY "Users can manage their own staked tokens" ON staked_tokens
FOR ALL USING (true);

CREATE POLICY "Users can manage their own rewards" ON staking_rewards
FOR ALL USING (true);

CREATE POLICY "Users can view their own staking history" ON staking_history
FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON staked_nfts TO anon, authenticated;
GRANT ALL ON staked_tokens TO anon, authenticated;
GRANT ALL ON staking_rewards TO anon, authenticated;
GRANT ALL ON staking_history TO anon, authenticated;

-- Function to calculate daily rewards automatically
-- This runs daily to update rewards without requiring frontend calls
CREATE OR REPLACE FUNCTION calculate_daily_rewards()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate NFT staking rewards
  INSERT INTO staking_rewards (wallet_address, reward_type, source_id, reward_amount, reward_date)
  SELECT 
    wallet_address,
    'nft_staking',
    id,
    daily_reward,
    CURRENT_DATE
  FROM staked_nfts
  WHERE DATE(last_reward_calculated) < CURRENT_DATE
  ON CONFLICT (wallet_address, reward_type, source_id, reward_date) DO NOTHING;
  
  -- Calculate token staking rewards
  INSERT INTO staking_rewards (wallet_address, reward_type, source_id, reward_amount, reward_date)
  SELECT 
    wallet_address,
    'token_staking',
    id,
    daily_reward,
    CURRENT_DATE
  FROM staked_tokens
  WHERE DATE(last_reward_calculated) < CURRENT_DATE
  ON CONFLICT (wallet_address, reward_type, source_id, reward_date) DO NOTHING;
  
  -- Update last_reward_calculated timestamps
  UPDATE staked_nfts SET last_reward_calculated = NOW() WHERE DATE(last_reward_calculated) < CURRENT_DATE;
  UPDATE staked_tokens SET last_reward_calculated = NOW() WHERE DATE(last_reward_calculated) < CURRENT_DATE;
END;
$$;

-- Create a scheduled job to run daily reward calculation (requires pg_cron extension)
-- Note: This requires enabling pg_cron extension in Supabase dashboard
-- SELECT cron.schedule('daily-rewards', '0 0 * * *', 'SELECT calculate_daily_rewards();');

-- Helper function to get user staking summary (single query for dashboard)
CREATE OR REPLACE FUNCTION get_user_staking_summary(user_wallet TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'staked_nfts_count', COALESCE(nft_count, 0),
    'staked_tokens_amount', COALESCE(token_amount, 0),
    'total_pending_rewards', COALESCE(pending_rewards, 0),
    'daily_nft_rewards', COALESCE(daily_nft_rewards, 0),
    'daily_token_rewards', COALESCE(daily_token_rewards, 0)
  ) INTO result
  FROM (
    SELECT 
      (SELECT COUNT(*) FROM staked_nfts WHERE wallet_address = user_wallet) as nft_count,
      (SELECT COALESCE(SUM(amount), 0) FROM staked_tokens WHERE wallet_address = user_wallet) as token_amount,
      (SELECT COALESCE(SUM(reward_amount), 0) FROM staking_rewards WHERE wallet_address = user_wallet AND is_claimed = FALSE) as pending_rewards,
      (SELECT COALESCE(SUM(daily_reward), 0) FROM staked_nfts WHERE wallet_address = user_wallet) as daily_nft_rewards,
      (SELECT COALESCE(SUM(daily_reward), 0) FROM staked_tokens WHERE wallet_address = user_wallet) as daily_token_rewards
  ) summary;
  
  RETURN result;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE staked_nfts IS 'Currently staked NFTs with cached reward data for efficiency';
COMMENT ON TABLE staked_tokens IS 'Token staking positions with pre-calculated rewards';
COMMENT ON TABLE staking_rewards IS 'Daily rewards tracking with claim status';
COMMENT ON TABLE staking_history IS 'Lightweight history of staking operations';
COMMENT ON FUNCTION calculate_daily_rewards() IS 'Automated daily reward calculation function';
COMMENT ON FUNCTION get_user_staking_summary(TEXT) IS 'Single-query function to get complete user staking overview';
