-- Fix RLS permissions for user_ipfs_mappings table
-- This allows the enhanced-nft-distribution.html tool to work properly

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can manage their own IPFS mappings" ON user_ipfs_mappings;

-- Create permissive policy for anonymous access (needed for distribution tool)
CREATE POLICY "Allow anonymous access to IPFS mappings" ON user_ipfs_mappings
FOR ALL USING (true);

-- Ensure proper permissions are granted
GRANT ALL ON user_ipfs_mappings TO anon;
GRANT ALL ON user_ipfs_mappings TO authenticated;
GRANT ALL ON user_ipfs_mappings TO service_role;

-- Verify table structure (should already exist)
\d user_ipfs_mappings;
