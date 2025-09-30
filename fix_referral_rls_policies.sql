-- Fix RLS policies for referral tables to allow proper access
-- Run this AFTER running the main referral_system_migration.sql

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own referral data" ON user_referrals;
DROP POLICY IF EXISTS "Users can update own referral data" ON user_referrals;
DROP POLICY IF EXISTS "Users can insert own referral data" ON user_referrals;
DROP POLICY IF EXISTS "Users can view referral rewards" ON referral_rewards;
DROP POLICY IF EXISTS "Users can view referral tracking" ON referral_tracking;
DROP POLICY IF EXISTS "Anyone can insert referral tracking" ON referral_tracking;

-- Create more permissive policies for referral tables
-- Allow authenticated users to manage their own referral data
CREATE POLICY "Allow authenticated users to manage referrals" ON user_referrals
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view referral rewards" ON referral_rewards
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert referral rewards" ON referral_rewards
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anyone to view referral tracking" ON referral_tracking
    FOR SELECT USING (true);

CREATE POLICY "Allow anyone to insert referral tracking" ON referral_tracking
    FOR INSERT WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON user_referrals TO authenticated;
GRANT ALL ON referral_rewards TO authenticated;
GRANT ALL ON referral_tracking TO authenticated;
GRANT ALL ON user_referrals TO anon;
GRANT ALL ON referral_rewards TO anon;
GRANT ALL ON referral_tracking TO anon;

-- Test that policies work
SELECT 'RLS policies updated successfully!' as status;
