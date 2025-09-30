-- Discord Role Cache Table for Egress Optimization
-- This table caches Discord role verification results to reduce API calls

CREATE TABLE IF NOT EXISTS discord_role_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  roles TEXT[] DEFAULT '{}', -- Array of role IDs the user has
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- When cache expires (2 hours)
  
  -- Constraints
  UNIQUE(user_id, guild_id),
  CHECK (expires_at > verified_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discord_cache_user ON discord_role_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_cache_guild ON discord_role_cache(guild_id);
CREATE INDEX IF NOT EXISTS idx_discord_cache_expires ON discord_role_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_discord_cache_user_guild ON discord_role_cache(user_id, guild_id);

-- Create function to automatically clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_discord_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM discord_role_cache 
  WHERE expires_at < NOW();
  
  RAISE NOTICE 'Cleaned up expired Discord role cache entries';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean expired cache (optional)
-- This can be called manually or set up as a cron job
-- SELECT cleanup_expired_discord_cache();

-- Insert sample data structure (for reference)
-- INSERT INTO discord_role_cache (user_id, guild_id, roles, expires_at) VALUES 
-- ('123456789', '1369232763709947914', ARRAY['1369238686436163625', '1382430133692141598'], 
--  NOW() + INTERVAL '2 hours');

-- Query to check cache status
-- SELECT 
--   user_id,
--   guild_id,
--   roles,
--   verified_at,
--   expires_at,
--   CASE 
--     WHEN expires_at > NOW() THEN 'Valid'
--     ELSE 'Expired'
--   END as cache_status
-- FROM discord_role_cache;
