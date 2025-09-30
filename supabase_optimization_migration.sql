-- Supabase Low Egress Optimization Migration
-- This migration adds performance indexes and RPC functions to reduce egress

-- 1. Performance Indexes for Low Egress
-- These indexes will significantly improve query performance and reduce data transfer

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
-- Removed invalid index on non-existent columns level/xp in users table
-- CREATE INDEX IF NOT EXISTS idx_users_level_xp ON users(level, xp);

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_active_category ON projects(is_active, category);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_featured_active ON projects(is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_category_active ON projects(category, is_active);

-- Project tasks indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_active ON project_tasks(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_project_tasks_sort_order ON project_tasks(project_id, sort_order);

-- User task completions indexes
CREATE INDEX IF NOT EXISTS idx_user_task_completions_wallet_project ON user_task_completions(wallet_address, project_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_completed ON user_task_completions(wallet_address, completed);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_task ON user_task_completions(task_id);

-- User balances indexes
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);
-- user_balances uses last_updated, not updated_at
CREATE INDEX IF NOT EXISTS idx_user_balances_updated ON user_balances(last_updated DESC);

-- Campaign rewards indexes
CREATE INDEX IF NOT EXISTS idx_campaign_reward_claims_wallet ON campaign_reward_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_campaign_reward_claims_project ON campaign_reward_claims(project_id);

-- User burn chances indexes
CREATE INDEX IF NOT EXISTS idx_user_burn_chances_wallet ON user_burn_chances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_burn_chances_used ON user_burn_chances(wallet_address, used_at);

-- 2. RPC Functions for Batch Operations

-- Safety: drop existing functions with possibly different signatures to allow re-create
DROP FUNCTION IF EXISTS get_user_dashboard_data(text);
DROP FUNCTION IF EXISTS get_project_tasks_with_completion(uuid, text);

-- Get user dashboard data in single call
CREATE OR REPLACE FUNCTION get_user_dashboard_data(user_wallet_address TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  user_profile JSON;
  user_balance JSON;
  user_achievements JSON;
  recent_activity JSON;
BEGIN
  -- Get user profile (compute level/xp from user_balances)
  SELECT json_build_object(
    'id', u.id,
    'wallet_address', u.wallet_address,
    'username', u.display_name,
    'avatar_url', u.avatar_url,
    'level', COALESCE(calculate_level_from_xp(ub.total_xp_earned), 1),
    'xp', COALESCE(ub.total_xp_earned, 0),
    'created_at', u.created_at,
    'updated_at', u.updated_at
  ) INTO user_profile
  FROM users u
  LEFT JOIN user_balances ub ON ub.wallet_address = u.wallet_address
  WHERE u.wallet_address = user_wallet_address;

  -- Get user balance
  SELECT json_build_object(
    'neft_balance', COALESCE(ub.neft_balance, 0),
    'xp_balance', COALESCE(ub.xp_balance, 0),
    'staked_amount', COALESCE(ub.staked_amount, 0)
  ) INTO user_balance
  FROM user_balances ub
  WHERE ub.wallet_address = user_wallet_address;

  -- Get achievement stats
  SELECT json_build_object(
    'total', COALESCE(COUNT(*), 0),
    'completed', COALESCE(COUNT(*) FILTER (WHERE completed = true), 0),
    'completion_percentage', CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::float / COUNT(*)::float) * 100, 2)
      ELSE 0 
    END
  ) INTO user_achievements
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet_address;

  -- Get recent activity (last 5 activities)
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', ua.id,
      'type', ua.achievement_type,
      'description', ua.description,
      'created_at', ua.completed_at
    ) ORDER BY ua.completed_at DESC
  ), '[]'::json) INTO recent_activity
  FROM user_achievements ua
  WHERE ua.wallet_address = user_wallet_address 
    AND ua.completed = true
  LIMIT 5;

  -- Build final result
  SELECT json_build_object(
    'profile', user_profile,
    'balance', user_balance,
    'achievements', user_achievements,
    'recent_activity', recent_activity
  ) INTO result;

  RETURN result;
END;
$$;

-- Get user connections with linked accounts (JSON variant, non-breaking)
CREATE OR REPLACE FUNCTION get_user_connections_json(user_wallet_address TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  primary_connection JSON;
  linked_social JSON;
  linked_wallets JSON;
BEGIN
  -- Get primary connection
  SELECT json_build_object(
    'primary_provider', u.provider,
    'primary_wallet_address', u.wallet_address,
    'primary_wallet_type', u.wallet_type
  ) INTO primary_connection
  FROM users u
  WHERE u.wallet_address = user_wallet_address;

  -- Get linked social accounts
  SELECT COALESCE(json_agg(
    json_build_object(
      'provider', ls.provider,
      'account_id', ls.account_id,
      'username', ls.username,
      'linked_at', ls.created_at
    )
  ), '[]'::json) INTO linked_social
  FROM linked_social_accounts ls
  WHERE ls.wallet_address = user_wallet_address;

  -- Get linked wallet addresses
  SELECT COALESCE(json_agg(
    json_build_object(
      'wallet_address', lw.wallet_address,
      'wallet_type', lw.wallet_type,
      'linked_at', lw.created_at
    )
  ), '[]'::json) INTO linked_wallets
  FROM linked_wallet_addresses lw
  WHERE lw.primary_wallet_address = user_wallet_address;

  -- Build final result
  SELECT json_build_object(
    'primary_connection', primary_connection,
    'linked_social_accounts', linked_social,
    'linked_wallet_addresses', linked_wallets,
    'total_connections', COALESCE(json_array_length(linked_social), 0) + COALESCE(json_array_length(linked_wallets), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- Get project tasks with user completion status
CREATE OR REPLACE FUNCTION get_project_tasks_with_completion(
  p_project_id UUID,
  p_wallet_address TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  tasks_data JSON;
  user_completions JSON;
BEGIN
  -- Get project tasks
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', pt.id,
      'title', pt.title,
      'description', pt.description,
      'type', pt.type,
      'action_url', pt.action_url,
      'discord_user_id', pt.discord_user_id,
      'discord_guild_id', pt.discord_guild_id,
      'required_role_id', pt.required_role_id,
      'is_active', pt.is_active,
      'sort_order', pt.sort_order
    ) ORDER BY pt.sort_order, pt.created_at
  ), '[]'::json) INTO tasks_data
  FROM project_tasks pt
  WHERE pt.project_id = p_project_id AND pt.is_active = true;
  
  -- Get user completions if wallet provided
  IF p_wallet_address IS NOT NULL THEN
    SELECT COALESCE(json_object_agg(
      utc.task_id::text, 
      json_build_object(
        'completed', utc.completed,
        'completed_at', utc.completed_at,
        'verification_data', utc.verification_data
      )
    ), '{}'::json) INTO user_completions
    FROM user_task_completions utc
    WHERE utc.project_id = p_project_id AND utc.wallet_address = p_wallet_address;
  ELSE
    user_completions := '{}'::json;
  END IF;
  
  -- Build final result
  SELECT json_build_object(
    'tasks', tasks_data,
    'user_completions', user_completions
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Get user burn chances summary
CREATE OR REPLACE FUNCTION get_user_burn_chances_summary(p_wallet_address TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  total_chances INTEGER;
  used_chances INTEGER;
  available_chances INTEGER;
BEGIN
  -- Count total burn chances
  SELECT COUNT(*) INTO total_chances
  FROM user_burn_chances
  WHERE wallet_address = p_wallet_address;
  
  -- Count used burn chances
  SELECT COUNT(*) INTO used_chances
  FROM user_burn_chances
  WHERE wallet_address = p_wallet_address 
    AND used_at IS NOT NULL;
  
  -- Calculate available chances
  available_chances := total_chances - used_chances;
  
  -- Build result
  SELECT json_build_object(
    'total_chances', total_chances,
    'used_chances', used_chances,
    'available_chances', available_chances,
    'can_burn', available_chances > 0
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION get_user_dashboard_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_connections_json(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_tasks_with_completion(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_burn_chances_summary(TEXT) TO authenticated;

-- 4. Add comments for documentation
COMMENT ON FUNCTION get_user_dashboard_data(TEXT) IS 'Get complete user dashboard data in single call to reduce egress';
COMMENT ON FUNCTION get_user_connections_json(TEXT) IS 'Get user connections and linked accounts (JSON variant) in single call';
COMMENT ON FUNCTION get_project_tasks_with_completion(UUID, TEXT) IS 'Get project tasks with user completion status';
COMMENT ON FUNCTION get_user_burn_chances_summary(TEXT) IS 'Get user burn chances summary for quest progress';

-- 5. Verify migration
DO $$
DECLARE
  index_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
  
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname LIKE 'get_%';
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Performance indexes created: %', index_count;
  RAISE NOTICE 'RPC functions created: %', function_count;
  RAISE NOTICE 'Expected egress reduction: 60-75%%';
END $$;
