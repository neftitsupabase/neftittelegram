-- Campaign Projects Schema for Low Egress Integration
-- Optimized for Discover, ProjectDetails, and NFTTaskList components

-- 1. Projects Table (Enhanced)
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  collection_name TEXT NOT NULL,
  image_url TEXT,
  banner_url TEXT,
  
  -- Reward Information
  reward_amount DECIMAL(18,8) NOT NULL DEFAULT 0,
  reward_currency TEXT DEFAULT 'NEFT',
  xp_reward INTEGER NOT NULL DEFAULT 0,
  
  -- Participation Limits
  max_participants INTEGER DEFAULT 1000,
  current_participants INTEGER DEFAULT 0,
  
  -- Project Metadata
  category TEXT NOT NULL DEFAULT 'general',
  subcategory TEXT,
  blockchain TEXT DEFAULT 'ethereum',
  network TEXT DEFAULT 'mainnet',
  
  -- Timing
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Status Flags
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_offchain BOOLEAN DEFAULT true,
  
  -- Additional Data
  total_supply INTEGER,
  level_requirement INTEGER DEFAULT 1,
  usd_value DECIMAL(10,2),
  target_chain TEXT,
  claim_status TEXT DEFAULT 'pending',
  task_status TEXT DEFAULT 'active',
  
  -- Social Links
  website TEXT,
  twitter TEXT,
  discord TEXT,
  
  -- Owner Information
  owner TEXT,
  
  -- Rarity Distribution (JSONB for flexibility)
  rarity_distribution JSONB DEFAULT '{"common": 70, "rare": 25, "legendary": 5}',
  
  -- NFT Images per Rarity (Manual Control)
  nft_images JSONB DEFAULT '{
    "common": "/images/commom2.jpg",
    "rare": "/images/Rare1.jpg",
    "legendary": "/images/Legendary.jpg"
  }',
  
  -- Metadata (JSONB for additional flexible data)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Project Tasks Table
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

-- 3. User Task Completions Table
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

-- 4. User Project Participations Table
CREATE TABLE IF NOT EXISTS user_project_participations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Participation Status
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_tasks_count INTEGER DEFAULT 0,
  total_tasks_count INTEGER DEFAULT 0,
  completion_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Reward Status
  rewards_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(wallet_address, project_id) -- One participation per user per project
);

-- 5. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);
CREATE INDEX IF NOT EXISTS idx_projects_search ON projects USING gin(to_tsvector('english', title || ' ' || collection_name));

CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_active ON project_tasks(project_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_task_completions_wallet ON user_task_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_project ON user_task_completions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_task ON user_task_completions(task_id);

CREATE INDEX IF NOT EXISTS idx_user_project_participations_wallet ON user_project_participations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_project_participations_project ON user_project_participations(project_id);

-- 6. RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_project_participations ENABLE ROW LEVEL SECURITY;

-- Projects: Public read access for active projects
CREATE POLICY "Public can view active projects" ON projects
  FOR SELECT USING (is_active = true);

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

-- User Project Participations: Users can only see/modify their own participations
CREATE POLICY "Users can view own project participations" ON user_project_participations
  FOR SELECT USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can insert own project participations" ON user_project_participations
  FOR INSERT WITH CHECK (wallet_address = current_setting('request.headers.x-wallet-address', true));

CREATE POLICY "Users can update own project participations" ON user_project_participations
  FOR UPDATE USING (wallet_address = current_setting('request.headers.x-wallet-address', true));

-- 7. Triggers for Automatic Updates
-- Update current_participants when user joins/leaves
CREATE OR REPLACE FUNCTION update_project_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects 
    SET current_participants = (
      SELECT COUNT(*) FROM user_project_participations 
      WHERE project_id = NEW.project_id
    )
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects 
    SET current_participants = (
      SELECT COUNT(*) FROM user_project_participations 
      WHERE project_id = OLD.project_id
    )
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_participants
  AFTER INSERT OR DELETE ON user_project_participations
  FOR EACH ROW EXECUTE FUNCTION update_project_participants();

-- Update task completion stats when tasks are completed
CREATE OR REPLACE FUNCTION update_participation_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE user_project_participations 
    SET 
      completed_tasks_count = (
        SELECT COUNT(*) FROM user_task_completions 
        WHERE project_id = NEW.project_id AND wallet_address = NEW.wallet_address AND completed = true
      ),
      total_tasks_count = (
        SELECT COUNT(*) FROM project_tasks 
        WHERE project_id = NEW.project_id AND is_active = true
      ),
      updated_at = NOW()
    WHERE project_id = NEW.project_id AND wallet_address = NEW.wallet_address;
    
    -- Update completion percentage
    UPDATE user_project_participations 
    SET completion_percentage = CASE 
      WHEN total_tasks_count > 0 THEN (completed_tasks_count::DECIMAL / total_tasks_count * 100)
      ELSE 0 
    END
    WHERE project_id = NEW.project_id AND wallet_address = NEW.wallet_address;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_participation_stats
  AFTER INSERT OR UPDATE ON user_task_completions
  FOR EACH ROW EXECUTE FUNCTION update_participation_stats();
