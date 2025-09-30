-- ============================================================================
-- DIAGNOSE: Check current Discord tasks configuration
-- ============================================================================

-- Check all Discord tasks and their configuration
SELECT 
  'CURRENT DISCORD TASKS' as status,
  pt.id,
  pt.title,
  pt.type,
  pt.action_url,
  pt.discord_guild_id,
  pt.required_role_id,
  p.project_name,
  pt.is_active
FROM project_tasks pt
JOIN projects p ON pt.project_id = p.id
WHERE pt.type IN ('discord_join', 'discord_role')
ORDER BY p.project_name, pt.sort_order;

-- Check for missing configuration
SELECT 
  'MISSING CONFIGURATION' as status,
  pt.title,
  pt.type,
  CASE 
    WHEN pt.type = 'discord_join' AND (pt.action_url IS NULL OR pt.action_url = '') THEN 'MISSING ACTION_URL'
    WHEN pt.type = 'discord_join' AND (pt.discord_guild_id IS NULL OR pt.discord_guild_id = '') THEN 'MISSING DISCORD_GUILD_ID'
    WHEN pt.type = 'discord_role' AND (pt.discord_guild_id IS NULL OR pt.discord_guild_id = '') THEN 'MISSING DISCORD_GUILD_ID'
    WHEN pt.type = 'discord_role' AND (pt.required_role_id IS NULL OR pt.required_role_id = '') THEN 'MISSING REQUIRED_ROLE_ID'
    ELSE 'OK'
  END as issue
FROM project_tasks pt
WHERE pt.type IN ('discord_join', 'discord_role')
ORDER BY pt.title;
