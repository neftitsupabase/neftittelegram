-- Add Discord-related fields to the tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS discord_user_id TEXT,
ADD COLUMN IF NOT EXISTS discord_guild_id TEXT,
ADD COLUMN IF NOT EXISTS required_role_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN tasks.discord_user_id IS 'Discord user ID for role verification';
COMMENT ON COLUMN tasks.discord_guild_id IS 'Discord server/guild ID where role verification happens';
COMMENT ON COLUMN tasks.required_role_id IS 'Required Discord role ID that user must have';

-- Optional: Create an index for faster lookups on Discord-related queries
CREATE INDEX IF NOT EXISTS idx_tasks_discord_verification 
ON tasks (discord_user_id, discord_guild_id, required_role_id) 
WHERE discord_user_id IS NOT NULL;
