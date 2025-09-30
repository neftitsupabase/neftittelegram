-- COMPLETE UNIFIED NEFTIT SCHEMA
-- Combines: campaign_projects_schema.sql, campaign_low_egress_functions.sql, 
-- add_new_campaign_task_types.sql, and optimized_services_schema.sql

-- =============================================
-- ENUMS AND TYPES
-- =============================================

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'twitter_follow';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'twitter_retweet';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'twitter_post';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'discord_join';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'discord_role';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'telegram_join';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'visit_website';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'quiz';
    ELSE
        CREATE TYPE task_type AS ENUM (
            'twitter_follow', 'twitter_retweet', 'twitter_post',
            'discord_join', 'discord_role', 'telegram_join',
            'visit_website', 'quiz'
        );
    END IF;
END $$;

-- =============================================
-- CORE TABLES
-- =============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    username TEXT,
    avatar_url TEXT,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    collection_name TEXT NOT NULL,
    image_url TEXT,
    banner_url TEXT,
    reward_amount DECIMAL(18,8) NOT NULL DEFAULT 0,
    reward_currency TEXT DEFAULT 'NEFT',
    xp_reward INTEGER NOT NULL DEFAULT 0,
    max_participants INTEGER DEFAULT 1000,
    current_participants INTEGER DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'general',
    subcategory TEXT,
    blockchain TEXT DEFAULT 'ethereum',
    network TEXT DEFAULT 'mainnet',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_offchain BOOLEAN DEFAULT true,
    total_supply INTEGER,
    level_requirement INTEGER DEFAULT 1,
    usd_value DECIMAL(10,2),
    target_chain TEXT,
    claim_status TEXT DEFAULT 'pending',
    task_status TEXT DEFAULT 'active',
    website TEXT,
    twitter TEXT,
    discord TEXT,
    owner TEXT,
    rarity_distribution JSONB DEFAULT '{"common": 70, "rare": 25, "legendary": 5}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project tasks table
CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type task_type NOT NULL DEFAULT 'visit_website',
    action_url TEXT,
    discord_user_id TEXT,
    discord_guild_id TEXT,
    required_role_id TEXT,
    telegram_channel_id TEXT,
    website_url TEXT,
    quiz_questions JSONB,
    quiz_passing_score INTEGER DEFAULT 70,
    twitter_username TEXT,
    twitter_tweet_id TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User participations table
CREATE TABLE IF NOT EXISTS user_participations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_tasks_count INTEGER DEFAULT 0,
    total_tasks_count INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    rewards_claimed BOOLEAN DEFAULT false,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, project_id)
);

-- User task completions table
CREATE TABLE IF NOT EXISTS user_task_completions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    verification_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, task_id)
);


-- =============================================
-- CONSTRAINTS
-- =============================================

DO $$
BEGIN
    -- Add quiz passing score constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_quiz_passing_score' 
        AND table_name = 'project_tasks'
    ) THEN
        ALTER TABLE project_tasks 
        ADD CONSTRAINT chk_quiz_passing_score 
        CHECK (quiz_passing_score IS NULL OR (quiz_passing_score >= 0 AND quiz_passing_score <= 100));
    END IF;
    
    -- Add quiz questions format constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_quiz_questions_format' 
        AND table_name = 'project_tasks'
    ) THEN
        ALTER TABLE project_tasks 
        ADD CONSTRAINT chk_quiz_questions_format 
        CHECK (quiz_questions IS NULL OR jsonb_typeof(quiz_questions) = 'array');
    END IF;
END $$;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);
CREATE INDEX IF NOT EXISTS idx_projects_search ON projects USING gin(to_tsvector('english', title || ' ' || collection_name));

-- Project tasks indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_active ON project_tasks(project_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_tasks_type ON project_tasks(type);

-- User participations indexes
CREATE INDEX IF NOT EXISTS idx_user_participations_wallet ON user_participations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_participations_project ON user_participations(project_id);

-- User task completions indexes
CREATE INDEX IF NOT EXISTS idx_user_task_completions_wallet ON user_task_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_project ON user_task_completions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_task ON user_task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_completed ON user_task_completions(completed);

-- User balances indexes
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);

-- User achievements indexes
