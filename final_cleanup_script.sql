-- Final cleanup script - simplified approach
-- This avoids complex queries that might cause errors in Supabase

-- Drop all known problematic objects
DROP TABLE IF EXISTS user_nft_counts_cache CASCADE;
DROP FUNCTION IF EXISTS update_nft_count_cache CASCADE;
DROP FUNCTION IF EXISTS get_top_nft_holders CASCADE;
DROP FUNCTION IF EXISTS get_user_nft_rank CASCADE;
DROP FUNCTION IF EXISTS get_nft_leaderboard CASCADE;
DROP FUNCTION IF EXISTS update_user_nft_count CASCADE;

-- Drop and recreate user_ipfs_mappings table completely
DROP TABLE IF EXISTS user_ipfs_mappings CASCADE;

-- Create fresh user_ipfs_mappings table
CREATE TABLE user_ipfs_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  ipfs_hash TEXT NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_user_ipfs_mappings_wallet_address ON user_ipfs_mappings(wallet_address);

-- Enable RLS with simple policy
ALTER TABLE user_ipfs_mappings ENABLE ROW LEVEL SECURITY;

-- Create the most permissive policy possible
CREATE POLICY "allow_everything" ON user_ipfs_mappings 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- Grant all permissions to all roles
GRANT ALL PRIVILEGES ON user_ipfs_mappings TO anon;
GRANT ALL PRIVILEGES ON user_ipfs_mappings TO authenticated;
GRANT ALL PRIVILEGES ON user_ipfs_mappings TO service_role;
GRANT ALL PRIVILEGES ON user_ipfs_mappings TO public;

-- Test the table with a simple operation
DO $$
BEGIN
  -- Test insert
  INSERT INTO user_ipfs_mappings (wallet_address, ipfs_hash) 
  VALUES ('test_wallet_123', 'test_hash_123');
  
  -- Test update
  UPDATE user_ipfs_mappings 
  SET ipfs_hash = 'updated_hash_123' 
  WHERE wallet_address = 'test_wallet_123';
  
  -- Test delete
  DELETE FROM user_ipfs_mappings WHERE wallet_address = 'test_wallet_123';
  
  RAISE NOTICE 'user_ipfs_mappings table is working correctly';
END $$;
