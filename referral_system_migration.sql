-- Referral System Database Migration
-- This migration adds referral functionality to the existing database
-- Referral rewards are tracked separately in user_referrals table

-- 1. Create user_referrals table to track referral codes and stats
CREATE TABLE IF NOT EXISTS user_referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    referral_code TEXT NOT NULL UNIQUE,
    total_referrals INTEGER DEFAULT 0,
    total_neft_earned DECIMAL(20,8) DEFAULT 0,
    total_xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create referral_rewards table to track individual referral rewards
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_wallet TEXT NOT NULL,
    referred_wallet TEXT NOT NULL,
    referral_code TEXT NOT NULL,
    neft_reward DECIMAL(20,8) DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(referrer_wallet, referred_wallet)
);

-- 4. Create referral_tracking table to track referral clicks and conversions
CREATE TABLE IF NOT EXISTS referral_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referral_code TEXT NOT NULL,
    referrer_wallet TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    converted BOOLEAN DEFAULT FALSE,
    converted_wallet TEXT,
    converted_at TIMESTAMPTZ
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_referrals_wallet ON user_referrals(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_referrals_code ON user_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_wallet);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_wallet);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_code ON referral_tracking(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);

-- 6. Create function to process referral rewards
CREATE OR REPLACE FUNCTION process_referral_reward(
    referrer_wallet TEXT,
    referred_wallet TEXT,
    neft_reward DECIMAL(20,8) DEFAULT 10,
    xp_reward INTEGER DEFAULT 50
) RETURNS JSON AS $$
DECLARE
    referral_code_val TEXT;
    result JSON;
BEGIN
    -- Get referral code for the referrer
    SELECT referral_code INTO referral_code_val
    FROM user_referrals 
    WHERE wallet_address = referrer_wallet;
    
    IF referral_code_val IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Referrer not found');
    END IF;
    
    -- Check if this referral already exists
    IF EXISTS (
        SELECT 1 FROM referral_rewards 
        WHERE referrer_wallet = referrer_wallet 
        AND referred_wallet = referred_wallet
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Referral already processed');
    END IF;
    
    -- Insert referral reward record
    INSERT INTO referral_rewards (
        referrer_wallet, 
        referred_wallet, 
        referral_code, 
        neft_reward, 
        xp_reward, 
        status,
        completed_at
    ) VALUES (
        referrer_wallet, 
        referred_wallet, 
        referral_code_val, 
        neft_reward, 
        xp_reward, 
        'completed',
        NOW()
    );
    
    -- Update referrer's referral stats
    UPDATE user_referrals SET
        total_referrals = total_referrals + 1,
        total_neft_earned = total_neft_earned + neft_reward,
        total_xp_earned = total_xp_earned + xp_reward,
        updated_at = NOW()
    WHERE wallet_address = referrer_wallet;
    
    result := json_build_object(
        'success', true,
        'referrer_wallet', referrer_wallet,
        'referred_wallet', referred_wallet,
        'neft_reward', neft_reward,
        'xp_reward', xp_reward,
        'referral_code', referral_code_val
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to update referral stats (tracks both NEFT and XP totals)
CREATE OR REPLACE FUNCTION update_referral_stats(
    user_wallet TEXT,
    neft_amount DECIMAL(20,8),
    xp_amount INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update user_referrals with both NEFT and XP totals
    UPDATE user_referrals SET
        total_neft_earned = total_neft_earned + neft_amount,
        total_xp_earned = total_xp_earned + xp_amount,
        updated_at = NOW()
    WHERE wallet_address = user_wallet;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to get user referral data (with both NEFT and XP totals stored)
CREATE OR REPLACE FUNCTION get_user_referral_data(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'referral_code', ur.referral_code,
        'total_referrals', ur.total_referrals,
        'total_neft_earned', ur.total_neft_earned,
        'total_xp_earned', ur.total_xp_earned,
        'last_updated', ur.updated_at
    ) INTO result
    FROM user_referrals ur
    WHERE ur.wallet_address = user_wallet;
    
    RETURN COALESCE(result, json_build_object(
        'referral_code', null,
        'total_referrals', 0,
        'total_neft_earned', 0,
        'total_xp_earned', 0,
        'last_updated', NOW()
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. No user_balances modifications needed - referral system works independently
-- 10. No trigger needed since we're not tracking referral-specific columns in user_balances
-- Referral stats are maintained separately in user_referrals table

-- 11. Enable Row Level Security (RLS) for referral tables
ALTER TABLE user_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;

-- 12. Create RLS policies
-- Policy for user_referrals: users can only see their own referral data
-- 11. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own referral data" ON user_referrals;
DROP POLICY IF EXISTS "Users can update own referral data" ON user_referrals;
DROP POLICY IF EXISTS "Users can view referral rewards" ON referral_rewards;
DROP POLICY IF EXISTS "Users can view referral tracking" ON referral_tracking;
DROP POLICY IF EXISTS "Anyone can insert referral tracking" ON referral_tracking;

-- 12. Recreate policies with IF NOT EXISTS
CREATE POLICY "Users can view own referral data" ON user_referrals
    FOR SELECT USING (wallet_address = current_setting('request.headers')::json->>'x-wallet-address');

CREATE POLICY "Users can update own referral data" ON user_referrals
    FOR UPDATE USING (wallet_address = current_setting('request.headers')::json->>'x-wallet-address');

CREATE POLICY "Users can view referral rewards" ON referral_rewards
    FOR SELECT USING (
        referrer_wallet = current_setting('request.headers')::json->>'x-wallet-address' OR
        referred_wallet = current_setting('request.headers')::json->>'x-wallet-address'
    );

CREATE POLICY "Users can view referral tracking" ON referral_tracking
    FOR SELECT USING (referrer_wallet = current_setting('request.headers')::json->>'x-wallet-address');

CREATE POLICY "Anyone can insert referral tracking" ON referral_tracking
    FOR INSERT WITH CHECK (true);

-- 13. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON user_referrals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON referral_rewards TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON referral_tracking TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_referral_reward TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_referral_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_referral_data TO anon, authenticated;

-- 14. Insert some sample data for testing (optional)
-- This will be removed in production
/*
INSERT INTO user_referrals (wallet_address, referral_code) VALUES 
('0x1234567890123456789012345678901234567890', 'NEFT-ABC123'),
('0x0987654321098765432109876543210987654321', 'NEFT-XYZ789')
ON CONFLICT (wallet_address) DO NOTHING;
*/

COMMENT ON TABLE user_referrals IS 'Stores referral codes and statistics for each user';
COMMENT ON TABLE referral_rewards IS 'Tracks individual referral rewards and their status';
COMMENT ON TABLE referral_tracking IS 'Tracks referral link clicks and conversions';
COMMENT ON FUNCTION process_referral_reward IS 'Processes a successful referral and distributes rewards';
COMMENT ON FUNCTION update_referral_stats IS 'Updates referral statistics in user_referrals table';
COMMENT ON FUNCTION get_user_referral_data IS 'Retrieves complete referral data for a user';

-- Note: Referral rewards are tracked separately in user_referrals table
-- This system works independently of the user_balances table
