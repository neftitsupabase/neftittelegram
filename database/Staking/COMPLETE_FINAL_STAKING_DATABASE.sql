-- COMPLETE FINAL STAKING DATABASE SYSTEM
-- Includes all fixes: permission issues, schema fixes, sync interference protection
-- Production-ready deployment script for NEFTIT staking system

-- =============================================================================
-- 1. COMPLETE SCHEMA DEFINITIONS
-- =============================================================================

-- User balances table (main balance tracking)
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    total_neft_claimed DECIMAL(18,8) DEFAULT 0,
    total_xp_earned INTEGER DEFAULT 0,
    available_neft DECIMAL(18,8) DEFAULT 0,
    staked_neft DECIMAL(18,8) DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staked NFTs table
CREATE TABLE IF NOT EXISTS staked_nfts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    nft_id TEXT NOT NULL,
    nft_name TEXT,
    nft_image TEXT,
    staked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    daily_rate DECIMAL(18,8) DEFAULT 5.0,
    total_earned DECIMAL(18,8) DEFAULT 0,
    last_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, nft_id)
);

-- Staked tokens table
CREATE TABLE IF NOT EXISTS staked_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    amount DECIMAL(18,8) NOT NULL,
    staked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    daily_rate DECIMAL(18,8) DEFAULT 0.1,
    total_earned DECIMAL(18,8) DEFAULT 0,
    last_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staking rewards table (comprehensive reward tracking)
CREATE TABLE IF NOT EXISTS staking_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    reward_date DATE DEFAULT CURRENT_DATE,
    nft_daily_rate DECIMAL(18,8) DEFAULT 0,
    token_daily_rate DECIMAL(18,8) DEFAULT 0,
    total_nft_earned DECIMAL(18,8) DEFAULT 0,
    total_token_earned DECIMAL(18,8) DEFAULT 0,
    total_nft_claimed DECIMAL(18,8) DEFAULT 0,
    total_token_claimed DECIMAL(18,8) DEFAULT 0,
    claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, reward_date)
);

-- User referrals table (for balance calculations)
CREATE TABLE IF NOT EXISTS user_referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    total_neft_earned DECIMAL(18,8) DEFAULT 0,
    total_xp_earned INTEGER DEFAULT 0,
    referral_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staked_nfts_wallet ON staked_nfts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staked_tokens_wallet ON staked_tokens(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staking_rewards_wallet ON staking_rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staking_rewards_date ON staking_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_user_referrals_wallet ON user_referrals(wallet_address);

-- =============================================================================
-- 2. ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE staked_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staked_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE staking_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_referrals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user access
CREATE POLICY IF NOT EXISTS "Users can view own balance" ON user_balances
    FOR SELECT USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');

CREATE POLICY IF NOT EXISTS "Users can update own balance" ON user_balances
    FOR ALL USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');

CREATE POLICY IF NOT EXISTS "Users can view own staked NFTs" ON staked_nfts
    FOR SELECT USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');

CREATE POLICY IF NOT EXISTS "Users can manage own staked NFTs" ON staked_nfts
    FOR ALL USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');

CREATE POLICY IF NOT EXISTS "Users can view own staked tokens" ON staked_tokens
    FOR SELECT USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');

CREATE POLICY IF NOT EXISTS "Users can manage own staked tokens" ON staked_tokens
    FOR ALL USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');

CREATE POLICY IF NOT EXISTS "Users can view own staking rewards" ON staking_rewards
    FOR SELECT USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');

CREATE POLICY IF NOT EXISTS "Users can update own staking rewards" ON staking_rewards
    FOR ALL USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');

CREATE POLICY IF NOT EXISTS "Users can view own referrals" ON user_referrals
    FOR SELECT USING (wallet_address = current_setting('request.headers')::json->>'wallet-address');
