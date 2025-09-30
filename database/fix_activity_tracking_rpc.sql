-- Fix Activity Tracking RPC Functions and Permissions
-- This script ensures all RPC functions exist with proper permissions

-- 1. Ensure the activity_type enum exists
DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM ('task', 'claim', 'burn', 'stake', 'unstake', 'campaign', 'daily_claim', 'achievement');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Ensure the activity_status enum exists
DO $$ BEGIN
    CREATE TYPE activity_status AS ENUM ('completed', 'pending', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Ensure user_activities table exists
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  activity_type activity_type NOT NULL,
  activity_title TEXT NOT NULL,
  activity_description TEXT,
  details TEXT,
  neft_reward DECIMAL(18,8) DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  nft_reward TEXT,
  status activity_status DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CHECK (neft_reward >= 0),
  CHECK (xp_reward >= 0)
);

-- 4. Ensure user_activity_stats table exists
CREATE TABLE IF NOT EXISTS user_activity_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  total_activities INTEGER NOT NULL DEFAULT 0,
  total_tasks_completed INTEGER NOT NULL DEFAULT 0,
  total_claims INTEGER NOT NULL DEFAULT 0,
  total_burns INTEGER NOT NULL DEFAULT 0,
  total_stakes INTEGER NOT NULL DEFAULT 0,
  total_neft_earned DECIMAL(18,8) NOT NULL DEFAULT 0,
  total_xp_earned INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CHECK (total_activities >= 0),
  CHECK (total_tasks_completed >= 0),
  CHECK (total_claims >= 0),
  CHECK (total_burns >= 0),
  CHECK (total_stakes >= 0),
  CHECK (total_neft_earned >= 0),
  CHECK (total_xp_earned >= 0)
);

-- 5. Enable RLS on tables
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_stats ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own activities" ON user_activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON user_activities;
DROP POLICY IF EXISTS "Users can view own activity stats" ON user_activity_stats;
DROP POLICY IF EXISTS "Users can insert own activity stats" ON user_activity_stats;
DROP POLICY IF EXISTS "Users can update own activity stats" ON user_activity_stats;

-- 7. Create RLS policies that allow access based on wallet address
CREATE POLICY "Users can view own activities" ON user_activities
  FOR SELECT USING (
    wallet_address = current_setting('request.headers.x-wallet-address', true)
    OR current_setting('request.headers.x-wallet-address', true) IS NULL
  );

CREATE POLICY "Users can insert own activities" ON user_activities
  FOR INSERT WITH CHECK (
    wallet_address = current_setting('request.headers.x-wallet-address', true)
    OR current_setting('request.headers.x-wallet-address', true) IS NULL
  );

CREATE POLICY "Users can view own activity stats" ON user_activity_stats
  FOR SELECT USING (
    wallet_address = current_setting('request.headers.x-wallet-address', true)
    OR current_setting('request.headers.x-wallet-address', true) IS NULL
  );

CREATE POLICY "Users can insert own activity stats" ON user_activity_stats
  FOR INSERT WITH CHECK (
    wallet_address = current_setting('request.headers.x-wallet-address', true)
    OR current_setting('request.headers.x-wallet-address', true) IS NULL
  );

CREATE POLICY "Users can update own activity stats" ON user_activity_stats
  FOR UPDATE USING (
    wallet_address = current_setting('request.headers.x-wallet-address', true)
    OR current_setting('request.headers.x-wallet-address', true) IS NULL
  );

-- 8. Drop existing RPC functions if they exist
DROP FUNCTION IF EXISTS log_user_activity(TEXT, activity_type, TEXT, TEXT, TEXT, DECIMAL, INTEGER, TEXT, activity_status, JSONB);
DROP FUNCTION IF EXISTS get_user_activities(TEXT, activity_type, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_user_activity_statistics(TEXT);

-- 9. Create the log_user_activity RPC function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION log_user_activity(
  user_wallet TEXT,
  activity_type_param activity_type,
  title TEXT,
  description TEXT DEFAULT NULL,
  details_param TEXT DEFAULT NULL,
  neft_reward_param DECIMAL(18,8) DEFAULT 0,
  xp_reward_param INTEGER DEFAULT 0,
  nft_reward_param TEXT DEFAULT NULL,
  status_param activity_status DEFAULT 'completed',
  metadata_param JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  activity_id UUID;
BEGIN
  -- Insert the activity
  INSERT INTO user_activities (
    wallet_address, activity_type, activity_title, activity_description, 
    details, neft_reward, xp_reward, nft_reward, status, metadata
  ) VALUES (
    user_wallet, activity_type_param, title, description, 
    details_param, neft_reward_param, xp_reward_param, nft_reward_param, status_param, metadata_param
  ) RETURNING id INTO activity_id;

  -- Update or create activity statistics
  INSERT INTO user_activity_stats (
    wallet_address, total_activities, 
    total_tasks_completed, total_claims, total_burns, total_stakes,
    total_neft_earned, total_xp_earned, last_activity_at
  ) VALUES (
    user_wallet, 1,
    CASE WHEN activity_type_param = 'task' THEN 1 ELSE 0 END,
    CASE WHEN activity_type_param IN ('claim', 'daily_claim', 'achievement') THEN 1 ELSE 0 END,
    CASE WHEN activity_type_param = 'burn' THEN 1 ELSE 0 END,
    CASE WHEN activity_type_param IN ('stake', 'unstake') THEN 1 ELSE 0 END,
    neft_reward_param, xp_reward_param, NOW()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    total_activities = user_activity_stats.total_activities + 1,
    total_tasks_completed = user_activity_stats.total_tasks_completed + 
      CASE WHEN activity_type_param = 'task' THEN 1 ELSE 0 END,
    total_claims = user_activity_stats.total_claims + 
      CASE WHEN activity_type_param IN ('claim', 'daily_claim', 'achievement') THEN 1 ELSE 0 END,
    total_burns = user_activity_stats.total_burns + 
      CASE WHEN activity_type_param = 'burn' THEN 1 ELSE 0 END,
    total_stakes = user_activity_stats.total_stakes + 
      CASE WHEN activity_type_param IN ('stake', 'unstake') THEN 1 ELSE 0 END,
    total_neft_earned = user_activity_stats.total_neft_earned + neft_reward_param,
    total_xp_earned = user_activity_stats.total_xp_earned + xp_reward_param,
    last_activity_at = NOW();

  RETURN activity_id;
END;
$$;

-- 10. Create the get_user_activities RPC function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_user_activities(
  user_wallet TEXT,
  activity_type_filter activity_type DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  type activity_type,
  activity_title TEXT,
  activity_description TEXT,
  details TEXT,
  neft_reward DECIMAL(18,8),
  xp_reward INTEGER,
  nft_reward TEXT,
  status activity_status,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.id,
    ua.activity_type as type,
    ua.activity_title,
    ua.activity_description,
    ua.details,
    ua.neft_reward,
    ua.xp_reward,
    ua.nft_reward,
    ua.status,
    ua.metadata,
    ua.created_at
  FROM user_activities ua
  WHERE ua.wallet_address = user_wallet
    AND (activity_type_filter IS NULL OR ua.activity_type = activity_type_filter)
  ORDER BY ua.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 11. Create the get_user_activity_statistics RPC function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_user_activity_statistics(user_wallet TEXT)
RETURNS TABLE (
  total_activities INTEGER,
  total_tasks_completed INTEGER,
  total_claims INTEGER,
  total_burns INTEGER,
  total_stakes INTEGER,
  total_neft_earned DECIMAL(18,8),
  total_xp_earned INTEGER,
  last_activity_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uas.total_activities,
    uas.total_tasks_completed,
    uas.total_claims,
    uas.total_burns,
    uas.total_stakes,
    uas.total_neft_earned,
    uas.total_xp_earned,
    uas.last_activity_at
  FROM user_activity_stats uas
  WHERE uas.wallet_address = user_wallet;
  
  -- If no stats exist, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0.0::DECIMAL(18,8), 0, NULL::TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$;

-- 12. Grant execute permissions on RPC functions to authenticated users and anon
GRANT EXECUTE ON FUNCTION log_user_activity(TEXT, activity_type, TEXT, TEXT, TEXT, DECIMAL, INTEGER, TEXT, activity_status, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_activities(TEXT, activity_type, INTEGER, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_activity_statistics(TEXT) TO authenticated, anon;

-- 13. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_activities_wallet_address ON user_activities(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_wallet_address ON user_activity_stats(wallet_address);

-- 14. Add comments
COMMENT ON FUNCTION log_user_activity IS 'Logs a new user activity and updates statistics with SECURITY DEFINER';
COMMENT ON FUNCTION get_user_activities IS 'Returns paginated user activities with optional filtering with SECURITY DEFINER';
COMMENT ON FUNCTION get_user_activity_statistics IS 'Returns aggregated activity statistics for a user with SECURITY DEFINER';
