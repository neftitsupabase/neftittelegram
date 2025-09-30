-- Optimized Services Database Schema
-- Comprehensive schema for OptimizedCampaignService, OptimizedProjectService, and OptimizedUserService

-- =============================================
-- CORE TABLES (if not already exist)
-- =============================================

-- Projects table (main campaign/project data)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    collection_name TEXT NOT NULL,
    image_url TEXT,
    banner_url TEXT,
    reward_amount DECIMAL(10,2) DEFAULT 0,
    reward_currency TEXT DEFAULT 'NEFT',
    xp_reward INTEGER DEFAULT 0,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    category TEXT NOT NULL,
    subcategory TEXT,
    blockchain TEXT DEFAULT 'Ethereum',
    network TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_offchain BOOLEAN DEFAULT false,
    total_supply INTEGER DEFAULT 0,
    level_requirement INTEGER DEFAULT 1,
    usd_value DECIMAL(10,2),
    target_chain TEXT,
    claim_status TEXT,
    task_status TEXT,
    website TEXT,
    twitter TEXT,
    discord TEXT,
    owner TEXT,
    rarity_distribution JSONB DEFAULT '{"common": 70, "rare": 25, "legendary": 5}',
    metadata JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'upcoming')),
    seconds_remaining INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project tasks (campaign tasks with new task types)
CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN (
        'twitter_follow', 'twitter_retweet', 'twitter_post',
        'discord_join', 'discord_role', 'telegram_join',
        'visit_website', 'quiz'
    )),
    action_url TEXT,
    discord_user_id TEXT,
    discord_guild_id TEXT,
    required_role_id TEXT,
    telegram_channel_id TEXT,
    website_url TEXT,
    quiz_questions JSONB,
    quiz_passing_score INTEGER,
    twitter_username TEXT,
    twitter_tweet_id TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User participations (tracks user involvement in projects)
CREATE TABLE IF NOT EXISTS user_participations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    completed_tasks_count INTEGER DEFAULT 0,
    total_tasks_count INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    rewards_claimed BOOLEAN DEFAULT false,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, project_id)
);

-- User task completions (tracks individual task completions)
CREATE TABLE IF NOT EXISTS user_task_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    verification_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, project_id, task_id)
);

-- Users table (basic user profiles)
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

-- User balances (comprehensive balance tracking)
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    total_neft_claimed DECIMAL(10,4) DEFAULT 0,
    available_neft DECIMAL(10,4) DEFAULT 0,
    total_xp_earned INTEGER DEFAULT 0,
    staked_amount DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_is_featured ON projects(is_featured);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);
CREATE INDEX IF NOT EXISTS idx_projects_search ON projects USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Project tasks indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_type ON project_tasks(type);
CREATE INDEX IF NOT EXISTS idx_project_tasks_is_active ON project_tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_project_tasks_sort_order ON project_tasks(sort_order);

-- User participations indexes
CREATE INDEX IF NOT EXISTS idx_user_participations_wallet ON user_participations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_participations_project ON user_participations(project_id);
CREATE INDEX IF NOT EXISTS idx_user_participations_rewards_claimed ON user_participations(rewards_claimed);

-- User task completions indexes
CREATE INDEX IF NOT EXISTS idx_user_task_completions_wallet ON user_task_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_project ON user_task_completions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_task ON user_task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_completed ON user_task_completions(completed);

-- User balances indexes
CREATE INDEX IF NOT EXISTS idx_user_balances_wallet ON user_balances(wallet_address);

-- =============================================
-- RPC FUNCTIONS FOR OPTIMIZED SERVICES
-- =============================================

-- Function: Get projects dashboard (for Discover page)
CREATE OR REPLACE FUNCTION get_projects_dashboard(
    p_category TEXT DEFAULT 'all',
    p_search_query TEXT DEFAULT '',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_count INTEGER;
    active_count INTEGER;
    featured_count INTEGER;
BEGIN
    -- Get total counts
    SELECT COUNT(*) INTO total_count FROM projects WHERE is_active = true;
    SELECT COUNT(*) INTO active_count FROM projects WHERE is_active = true AND status = 'active';
    SELECT COUNT(*) INTO featured_count FROM projects WHERE is_active = true AND is_featured = true;
    
    -- Build main query
    WITH filtered_projects AS (
        SELECT 
            p.*,
            EXTRACT(EPOCH FROM (p.end_date - NOW()))::INTEGER as seconds_remaining
        FROM projects p
        WHERE p.is_active = true
            AND (p_category = 'all' OR 
                 (p_category = 'featured' AND p.is_featured = true) OR
                 p.category = p_category)
            AND (p_search_query = '' OR 
                 p.title ILIKE '%' || p_search_query || '%' OR
                 p.description ILIKE '%' || p_search_query || '%' OR
                 p.collection_name ILIKE '%' || p_search_query || '%')
        ORDER BY 
            CASE WHEN p.is_featured THEN 0 ELSE 1 END,
            p.end_date DESC NULLS LAST
        LIMIT p_limit OFFSET p_offset
    )
    SELECT json_build_object(
        'projects', COALESCE(json_agg(fp.*), '[]'::json),
        'stats', json_build_object(
            'total_projects', total_count,
            'active_projects', active_count,
            'featured_projects', featured_count
        ),
        'pagination', json_build_object(
            'limit', p_limit,
            'offset', p_offset,
            'has_more', (p_offset + p_limit) < total_count
        )
    ) INTO result
    FROM filtered_projects fp;
    
    RETURN result;
END;
$$;

-- Function: Get project details with user data
CREATE OR REPLACE FUNCTION get_project_details(
    p_project_id UUID,
    p_wallet_address TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    project_data JSON;
    tasks_data JSON;
    user_participation_data JSON;
    user_completions_data JSON;
BEGIN
    -- Get project data
    SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'description', p.description,
        'collection_name', p.collection_name,
        'image_url', p.image_url,
        'banner_url', p.banner_url,
        'reward_amount', p.reward_amount,
        'reward_currency', p.reward_currency,
        'xp_reward', p.xp_reward,
        'max_participants', p.max_participants,
        'current_participants', p.current_participants,
        'category', p.category,
        'subcategory', p.subcategory,
        'blockchain', p.blockchain,
        'network', p.network,
        'start_date', p.start_date,
        'end_date', p.end_date,
        'is_active', p.is_active,
        'is_featured', p.is_featured,
        'is_offchain', p.is_offchain,
        'total_supply', p.total_supply,
        'level_requirement', p.level_requirement,
        'usd_value', p.usd_value,
        'target_chain', p.target_chain,
        'claim_status', p.claim_status,
        'task_status', p.task_status,
        'website', p.website,
        'twitter', p.twitter,
        'discord', p.discord,
        'owner', p.owner,
        'rarity_distribution', p.rarity_distribution,
        'metadata', p.metadata,
        'status', p.status,
        'seconds_remaining', EXTRACT(EPOCH FROM (p.end_date - NOW()))::INTEGER
    ) INTO project_data
    FROM projects p
    WHERE p.id = p_project_id AND p.is_active = true;
    
    IF project_data IS NULL THEN
        RETURN json_build_object('error', 'Project not found');
    END IF;
    
    -- Get tasks data
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
            'telegram_channel_id', pt.telegram_channel_id,
            'website_url', pt.website_url,
            'quiz_questions', pt.quiz_questions,
            'quiz_passing_score', pt.quiz_passing_score,
            'twitter_username', pt.twitter_username,
            'twitter_tweet_id', pt.twitter_tweet_id,
            'is_active', pt.is_active,
            'sort_order', pt.sort_order
        ) ORDER BY pt.sort_order
    ), '[]'::json) INTO tasks_data
    FROM project_tasks pt
    WHERE pt.project_id = p_project_id AND pt.is_active = true;
    
    -- Get user participation data (if wallet provided)
    IF p_wallet_address IS NOT NULL THEN
        SELECT json_build_object(
            'joined_at', up.joined_at,
            'completed_tasks_count', up.completed_tasks_count,
            'total_tasks_count', up.total_tasks_count,
            'completion_percentage', up.completion_percentage,
            'rewards_claimed', up.rewards_claimed,
            'claimed_at', up.claimed_at
        ) INTO user_participation_data
        FROM user_participations up
        WHERE up.wallet_address = p_wallet_address AND up.project_id = p_project_id;
        
        -- Get user task completions
        SELECT COALESCE(json_object_agg(
            utc.task_id,
            json_build_object(
                'completed', utc.completed,
                'completed_at', utc.completed_at,
                'verification_data', utc.verification_data
            )
        ), '{}'::json) INTO user_completions_data
        FROM user_task_completions utc
        WHERE utc.wallet_address = p_wallet_address AND utc.project_id = p_project_id;
    END IF;
    
    -- Build final result
    SELECT json_build_object(
        'project', project_data,
        'tasks', tasks_data,
        'user_participation', user_participation_data,
        'user_completions', COALESCE(user_completions_data, '{}'::json)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Function: Complete project task
CREATE OR REPLACE FUNCTION complete_project_task(
    p_wallet_address TEXT,
    p_project_id UUID,
    p_task_id UUID,
    p_verification_data JSON DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    task_exists BOOLEAN;
    already_completed BOOLEAN;
    total_tasks INTEGER;
    completed_tasks INTEGER;
    completion_percentage DECIMAL(5,2);
BEGIN
    -- Validate task exists and is active
    SELECT EXISTS(
        SELECT 1 FROM project_tasks 
        WHERE id = p_task_id AND project_id = p_project_id AND is_active = true
    ) INTO task_exists;
    
    IF NOT task_exists THEN
        RETURN json_build_object('success', false, 'error', 'Task not found or inactive');
    END IF;
    
    -- Check if already completed
    SELECT completed INTO already_completed
    FROM user_task_completions
    WHERE wallet_address = p_wallet_address AND project_id = p_project_id AND task_id = p_task_id;
    
    IF already_completed THEN
        RETURN json_build_object('success', false, 'error', 'Task already completed');
    END IF;
    
    -- Insert or update task completion
    INSERT INTO user_task_completions (
        wallet_address, project_id, task_id, completed, completed_at, verification_data
    ) VALUES (
        p_wallet_address, p_project_id, p_task_id, true, NOW(), p_verification_data
    )
    ON CONFLICT (wallet_address, project_id, task_id)
    DO UPDATE SET
        completed = true,
        completed_at = NOW(),
        verification_data = p_verification_data;
    
    -- Get total tasks for this project
    SELECT COUNT(*) INTO total_tasks
    FROM project_tasks
    WHERE project_id = p_project_id AND is_active = true;
    
    -- Get completed tasks count
    SELECT COUNT(*) INTO completed_tasks
    FROM user_task_completions
    WHERE wallet_address = p_wallet_address AND project_id = p_project_id AND completed = true;
    
    -- Calculate completion percentage
    completion_percentage := CASE 
        WHEN total_tasks > 0 THEN (completed_tasks::DECIMAL / total_tasks::DECIMAL) * 100
        ELSE 0
    END;
    
    -- Insert or update user participation
    INSERT INTO user_participations (
        wallet_address, project_id, completed_tasks_count, total_tasks_count, completion_percentage
    ) VALUES (
        p_wallet_address, p_project_id, completed_tasks, total_tasks, completion_percentage
    )
    ON CONFLICT (wallet_address, project_id)
    DO UPDATE SET
        completed_tasks_count = completed_tasks,
        total_tasks_count = total_tasks,
        completion_percentage = completion_percentage,
        updated_at = NOW();
    
    RETURN json_build_object(
        'success', true,
        'completed_tasks_count', completed_tasks,
        'total_tasks_count', total_tasks,
        'completion_percentage', completion_percentage
    );
END;
$$;

-- Function: Get user project statistics
CREATE OR REPLACE FUNCTION get_user_project_stats(
    p_wallet_address TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    WITH user_stats AS (
        SELECT 
            COUNT(*) as total_participations,
            COUNT(CASE WHEN up.completion_percentage = 100 THEN 1 END) as completed_projects,
            COUNT(CASE WHEN up.completion_percentage > 0 AND up.completion_percentage < 100 THEN 1 END) as active_participations,
            COUNT(CASE WHEN up.rewards_claimed THEN 1 END) as rewards_claimed_count,
            COALESCE(AVG(up.completion_percentage), 0) as average_completion
        FROM user_participations up
        WHERE up.wallet_address = p_wallet_address
    ),
    participations_list AS (
        SELECT json_agg(
            json_build_object(
                'project_id', up.project_id,
                'project_title', p.title,
                'completion_percentage', up.completion_percentage,
                'rewards_claimed', up.rewards_claimed,
                'joined_at', up.joined_at,
                'claimed_at', up.claimed_at
            ) ORDER BY up.joined_at DESC
        ) as participations
        FROM user_participations up
        JOIN projects p ON p.id = up.project_id
        WHERE up.wallet_address = p_wallet_address
    )
    SELECT json_build_object(
        'total_participations', us.total_participations,
        'completed_projects', us.completed_projects,
        'active_participations', us.active_participations,
        'rewards_claimed_count', us.rewards_claimed_count,
        'average_completion', us.average_completion,
        'participations', COALESCE(pl.participations, '[]'::json)
    ) INTO result
    FROM user_stats us
    CROSS JOIN participations_list pl;
    
    RETURN result;
END;
$$;

-- Function: Search projects with advanced filters
CREATE OR REPLACE FUNCTION search_projects(
    p_query TEXT,
    p_category TEXT DEFAULT 'all',
    p_status TEXT DEFAULT 'all',
    p_sort_by TEXT DEFAULT 'relevance',
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_count INTEGER;
BEGIN
    WITH filtered_projects AS (
        SELECT 
            p.*,
            EXTRACT(EPOCH FROM (p.end_date - NOW()))::INTEGER as seconds_remaining,
            CASE 
                WHEN p_query = '' THEN 1
                ELSE ts_rank(to_tsvector('english', p.title || ' ' || COALESCE(p.description, '')), plainto_tsquery('english', p_query))
            END as relevance_score
        FROM projects p
        WHERE p.is_active = true
            AND (p_category = 'all' OR p.category = p_category)
            AND (p_status = 'all' OR p.status = p_status)
            AND (p_query = '' OR 
                 to_tsvector('english', p.title || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', p_query))
    ),
    sorted_projects AS (
        SELECT *
        FROM filtered_projects
        ORDER BY 
            CASE 
                WHEN p_sort_by = 'relevance' THEN relevance_score
                WHEN p_sort_by = 'newest' THEN EXTRACT(EPOCH FROM created_at)
                WHEN p_sort_by = 'ending_soon' THEN -seconds_remaining
                WHEN p_sort_by = 'reward_amount' THEN reward_amount
                ELSE relevance_score
            END DESC
        LIMIT p_limit OFFSET p_offset
    )
    SELECT 
        COUNT(*) INTO total_count
    FROM filtered_projects;
    
    SELECT json_build_object(
        'results', COALESCE(json_agg(sp.*), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count
    ) INTO result
    FROM sorted_projects sp;
    
    RETURN result;
END;
$$;

-- Function: Get user dashboard data
CREATE OR REPLACE FUNCTION get_user_dashboard_data(
    user_wallet_address TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    WITH user_profile AS (
        SELECT 
            u.id,
            u.wallet_address,
            u.username,
            u.avatar_url,
            u.level,
            u.xp,
            u.created_at,
            u.updated_at
        FROM users u
        WHERE u.wallet_address = user_wallet_address
    ),
    user_balance AS (
        SELECT 
            COALESCE(ub.available_neft, 0) as neft_balance,
            COALESCE(ub.total_xp_earned, 0) as xp_balance,
            COALESCE(ub.staked_amount, 0) as staked_amount
        FROM user_balances ub
        WHERE ub.wallet_address = user_wallet_address
    ),
    user_achievements AS (
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN completed THEN 1 END) as completed,
            CASE 
                WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN completed THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100
                ELSE 0
            END as completion_percentage
        FROM user_achievements ua
        WHERE ua.wallet_address = user_wallet_address
    ),
    recent_activity AS (
        SELECT json_agg(
            json_build_object(
                'id', ua.id,
                'type', ua.activity_type,
                'description', ua.description,
                'created_at', ua.created_at
            ) ORDER BY ua.created_at DESC
        ) as activities
        FROM user_activities ua
        WHERE ua.wallet_address = user_wallet_address
        LIMIT 10
    )
    SELECT json_build_object(
        'profile', row_to_json(up.*),
        'balance', row_to_json(ub.*),
        'achievements', row_to_json(ua.*),
        'recent_activity', COALESCE(ra.activities, '[]'::json)
    ) INTO result
    FROM user_profile up
    CROSS JOIN user_balance ub
    CROSS JOIN user_achievements ua
    CROSS JOIN recent_activity ra;
    
    RETURN result;
END;
$$;

-- =============================================
-- TRIGGERS FOR DATA CONSISTENCY
-- =============================================

-- Update project current_participants when user_participations changes
CREATE OR REPLACE FUNCTION update_project_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE projects 
        SET current_participants = (
            SELECT COUNT(DISTINCT wallet_address) 
            FROM user_participations 
            WHERE project_id = NEW.project_id
        )
        WHERE id = NEW.project_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE projects 
        SET current_participants = (
            SELECT COUNT(DISTINCT wallet_address) 
            FROM user_participations 
            WHERE project_id = OLD.project_id
        )
        WHERE id = OLD.project_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_project_participants
    AFTER INSERT OR DELETE ON user_participations
    FOR EACH ROW EXECUTE FUNCTION update_project_participants();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_project_tasks_updated_at
    BEFORE UPDATE ON project_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_participations_updated_at
    BEFORE UPDATE ON user_participations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_task_completions_updated_at
    BEFORE UPDATE ON user_task_completions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_balances_updated_at
    BEFORE UPDATE ON user_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
