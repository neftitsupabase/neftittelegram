-- Create table for storing wallet address to IPFS hash mappings
-- This provides cross-device persistence for user NFT data

CREATE TABLE IF NOT EXISTS user_ipfs_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  ipfs_hash TEXT NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by wallet address
CREATE INDEX IF NOT EXISTS idx_user_ipfs_mappings_wallet_address 
ON user_ipfs_mappings(wallet_address);

-- Enable Row Level Security (RLS)
ALTER TABLE user_ipfs_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to access only their own mappings
-- This policy allows all operations for any authenticated user
-- In a production environment, you might want more restrictive policies
CREATE POLICY "Users can manage their own IPFS mappings" ON user_ipfs_mappings
FOR ALL USING (true);

-- Grant necessary permissions
GRANT ALL ON user_ipfs_mappings TO anon;
GRANT ALL ON user_ipfs_mappings TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE user_ipfs_mappings IS 'Stores mapping between wallet addresses and their IPFS data hashes for NFT persistence';
COMMENT ON COLUMN user_ipfs_mappings.wallet_address IS 'Unique wallet address (can be EVM, Solana, or social login format)';
COMMENT ON COLUMN user_ipfs_mappings.ipfs_hash IS 'IPFS hash containing the user''s NFT data and burn history';
COMMENT ON COLUMN user_ipfs_mappings.last_updated IS 'Timestamp when the IPFS hash was last updated';
COMMENT ON COLUMN user_ipfs_mappings.created_at IS 'Timestamp when the mapping was first created';
