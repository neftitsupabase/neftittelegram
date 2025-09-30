-- Campaign Tasks Migration
-- This migration ensures all projects have campaign tasks and the correct schema is in place

-- 1. Ensure project_tasks table exists with correct schema
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'other', -- 'twitter', 'discord', 'wallet', 'other'
  
  -- Task Configuration
  action_url TEXT,
  discord_user_id TEXT,
  discord_guild_id TEXT,
  required_role_id TEXT,
  
  -- Task Status
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ensure user_task_completions table exists
CREATE TABLE IF NOT EXISTS user_task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  
  -- Completion Status
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Verification Data
  verification_data JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(wallet_address, task_id) -- Prevent duplicate completions
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_active ON project_tasks(project_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_tasks_sort ON project_tasks(project_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_user_task_completions_wallet ON user_task_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_project ON user_task_completions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_task ON user_task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_completed ON user_task_completions(wallet_address, project_id, completed);

-- 4. Enable RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_completions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
-- Project Tasks: Public read access for active tasks of active projects
CREATE POLICY "Public can view active project tasks" ON project_tasks
  FOR SELECT USING (
    is_active = true AND 
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_tasks.project_id AND projects.is_active = true)
  );

-- User Task Completions: Users can only see/modify their own completions
CREATE POLICY "Users can view own task completions" ON user_task_completions
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own task completions" ON user_task_completions
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can update own task completions" ON user_task_completions
  FOR UPDATE USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- 6. Add social media columns to projects table if they don't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS twitter TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS discord TEXT;

-- 7. Create default campaign tasks for all existing projects that don't have tasks
-- Note: We'll create generic tasks since social links might not exist yet
INSERT INTO project_tasks (project_id, title, description, type, action_url, sort_order)
SELECT 
  p.id,
  'Follow Project on Social Media',
  'Follow the project on social media to stay updated with latest news and announcements',
  'other',
  NULL,
  1
FROM projects p
WHERE p.is_active = true 
  AND NOT EXISTS (
    SELECT 1 FROM project_tasks pt 
    WHERE pt.project_id = p.id AND pt.type = 'other' AND pt.title = 'Follow Project on Social Media'
  );

INSERT INTO project_tasks (project_id, title, description, type, action_url, sort_order)
SELECT 
  p.id,
  'Join Community',
  'Join the project community to connect with other members and get exclusive updates',
  'other',
  NULL,
  2
FROM projects p
WHERE p.is_active = true 
  AND NOT EXISTS (
    SELECT 1 FROM project_tasks pt 
    WHERE pt.project_id = p.id AND pt.type = 'other' AND pt.title = 'Join Community'
  );

INSERT INTO project_tasks (project_id, title, description, type, action_url, sort_order)
SELECT 
  p.id,
  'Learn More About Project',
  'Visit the project resources to learn more about the project and its goals',
  'other',
  NULL,
  3
FROM projects p
WHERE p.is_active = true 
  AND NOT EXISTS (
    SELECT 1 FROM project_tasks pt 
    WHERE pt.project_id = p.id AND pt.type = 'other' AND pt.title = 'Learn More About Project'
  );

-- 8. Create a function to get project tasks with user completion status
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

-- 9. Grant permissions
GRANT SELECT ON project_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_task_completions TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_tasks_with_completion(UUID, TEXT) TO authenticated;

-- 10. Add comments for documentation
COMMENT ON TABLE project_tasks IS 'Campaign tasks for each project that users can complete to earn rewards';
COMMENT ON TABLE user_task_completions IS 'Tracks user completion status for project tasks';
COMMENT ON FUNCTION get_project_tasks_with_completion(UUID, TEXT) IS 'Get project tasks with user completion status for a specific wallet';

-- 11. Verify migration
DO $$
DECLARE
  project_count INTEGER;
  task_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO project_count FROM projects WHERE is_active = true;
  SELECT COUNT(*) INTO task_count FROM project_tasks;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Active projects: %', project_count;
  RAISE NOTICE 'Total campaign tasks: %', task_count;
END $$;
