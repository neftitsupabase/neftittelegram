-- COMPLETE UNIFIED NEFTIT SCHEMA - PART 2
-- RPC Functions and Triggers

-- =============================================
-- RPC FUNCTIONS (LOW EGRESS OPTIMIZED)
-- =============================================

-- Function: Get projects dashboard (Discover page)
CREATE OR REPLACE FUNCTION get_projects_dashboard(
    p_category TEXT DEFAULT 'all',
    p_search_query TEXT DEFAULT '',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
    total_count INTEGER;
    active_count INTEGER;
    featured_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM projects WHERE is_active = true;
    SELECT COUNT(*) INTO active_count FROM projects WHERE is_active = true;
    SELECT COUNT(*) INTO featured_count FROM projects WHERE is_active = true AND is_featured = true;
    
    WITH filtered_projects AS (
        SELECT 
            p.*,
            CASE 
                WHEN p.end_date < NOW() THEN 'ended'
                WHEN p.start_date > NOW() THEN 'upcoming'
                ELSE 'active'
            END as status,
            CASE 
                WHEN p.end_date > NOW() THEN EXTRACT(EPOCH FROM (p.end_date - NOW()))
                ELSE 0
            END as seconds_remaining
        FROM projects p
        WHERE p.is_active = true
            AND (p_category = 'all' OR p.category = p_category OR (p_category = 'featured' AND p.is_featured = true))
            AND (p_search_query = '' OR 
                 p.title ILIKE '%' || p_search_query || '%' OR 
                 p.collection_name ILIKE '%' || p_search_query || '%')
        ORDER BY 
            p.is_featured DESC,
            p.end_date ASC NULLS LAST,
            p.created_at DESC
        LIMIT p_limit OFFSET p_offset
    )
    SELECT json_build_object(
        'projects', COALESCE(json_agg(
            json_build_object(
                'id', fp.id,
                'title', fp.title,
                'description', fp.description,
                'collection_name', fp.collection_name,
                'image_url', fp.image_url,
                'banner_url', fp.banner_url,
                'reward_amount', fp.reward_amount,
                'reward_currency', fp.reward_currency,
                'xp_reward', fp.xp_reward,
                'max_participants', fp.max_participants,
                'current_participants', fp.current_participants,
                'category', fp.category,
                'blockchain', fp.blockchain,
                'start_date', fp.start_date,
                'end_date', fp.end_date,
                'is_active', fp.is_active,
                'is_featured', fp.is_featured,
                'status', fp.status,
                'seconds_remaining', fp.seconds_remaining,
                'website', fp.website,
                'twitter', fp.twitter,
                'discord', fp.discord,
                'rarity_distribution', fp.rarity_distribution,
                'metadata', fp.metadata
            )
        ), '[]'::json),
        'stats', json_build_object(
            'total_projects', total_count,
            'active_projects', active_count,
            'featured_projects', featured_count
        ),
        'pagination', json_build_object(
            'limit', p_limit,
            'offset', p_offset,
            'has_more', (SELECT COUNT(*) FROM filtered_projects) = p_limit
        )
    ) INTO result
    FROM filtered_projects fp;
    
    RETURN result;
END;
$$;

-- Function: Get project details with tasks and user data
CREATE OR REPLACE FUNCTION get_project_details(
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
    project_data JSON;
    tasks_data JSON;
    user_participation_data JSON;
    user_completions_data JSON;
BEGIN
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
        'status', CASE 
            WHEN p.end_date < NOW() THEN 'ended'
            WHEN p.start_date > NOW() THEN 'upcoming'
            ELSE 'active'
        END,
        'seconds_remaining', CASE 
            WHEN p.end_date > NOW() THEN EXTRACT(EPOCH FROM (p.end_date - NOW()))
            ELSE 0
        END
    ) INTO project_data
    FROM projects p
    WHERE p.id = p_project_id AND p.is_active = true;
    
    IF project_data IS NULL THEN
        RETURN json_build_object('error', 'Project not found');
    END IF;
    
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
        ) ORDER BY pt.sort_order, pt.created_at
    ), '[]'::json) INTO tasks_data
    FROM project_tasks pt
    WHERE pt.project_id = p_project_id AND pt.is_active = true;
    
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
        WHERE up.project_id = p_project_id AND up.wallet_address = p_wallet_address;
        
        SELECT COALESCE(json_object_agg(
            utc.task_id::text, 
            json_build_object(
                'completed', utc.completed,
                'completed_at', utc.completed_at,
                'verification_data', utc.verification_data
            )
        ), '{}'::json) INTO user_completions_data
        FROM user_task_completions utc
        WHERE utc.wallet_address = p_wallet_address AND utc.project_id = p_project_id;
    END IF;
    
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
    p_verification_data JSON DEFAULT '{}'::json
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
    task_exists BOOLEAN;
    already_completed BOOLEAN;
    participation_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM project_tasks pt
        JOIN projects p ON p.id = pt.project_id
        WHERE pt.id = p_task_id 
            AND pt.project_id = p_project_id 
            AND pt.is_active = true 
            AND p.is_active = true
    ) INTO task_exists;
    
    IF NOT task_exists THEN
        RETURN json_build_object('success', false, 'error', 'Task not found or inactive');
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM user_task_completions
        WHERE wallet_address = p_wallet_address 
            AND task_id = p_task_id 
            AND completed = true
    ) INTO already_completed;
    
    IF already_completed THEN
        RETURN json_build_object('success', false, 'error', 'Task already completed');
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM user_participations
        WHERE wallet_address = p_wallet_address AND project_id = p_project_id
    ) INTO participation_exists;
    
    IF NOT participation_exists THEN
        INSERT INTO user_participations (wallet_address, project_id)
        VALUES (p_wallet_address, p_project_id);
    END IF;
    
    INSERT INTO user_task_completions (
        wallet_address, project_id, task_id, completed, completed_at, verification_data
    ) VALUES (
        p_wallet_address, p_project_id, p_task_id, true, NOW(), p_verification_data
    )
    ON CONFLICT (wallet_address, task_id) 
    DO UPDATE SET 
        completed = true,
        completed_at = NOW(),
        verification_data = p_verification_data,
        updated_at = NOW();
    
    SELECT json_build_object(
        'success', true,
        'completed_tasks_count', up.completed_tasks_count,
        'total_tasks_count', up.total_tasks_count,
        'completion_percentage', up.completion_percentage
    ) INTO result
    FROM user_participations up
    WHERE up.wallet_address = p_wallet_address AND up.project_id = p_project_id;
    
    RETURN result;
END;
$$;

-- Function: Get user project stats
CREATE OR REPLACE FUNCTION get_user_project_stats(
    p_wallet_address TEXT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_participations', COUNT(*),
        'completed_projects', COUNT(*) FILTER (WHERE completion_percentage = 100),
        'active_participations', COUNT(*) FILTER (WHERE completion_percentage < 100 AND completion_percentage > 0),
        'rewards_claimed_count', COUNT(*) FILTER (WHERE rewards_claimed = true),
        'average_completion', COALESCE(AVG(completion_percentage), 0),
        'participations', COALESCE(json_agg(
            json_build_object(
                'project_id', up.project_id,
                'joined_at', up.joined_at,
                'completed_tasks_count', up.completed_tasks_count,
                'total_tasks_count', up.total_tasks_count,
                'completion_percentage', up.completion_percentage,
                'rewards_claimed', up.rewards_claimed,
                'claimed_at', up.claimed_at
            )
        ), '[]'::json)
    ) INTO result
    FROM user_participations up
    WHERE up.wallet_address = p_wallet_address;
    
    RETURN result;
END;
$$;

-- Function: Search projects
CREATE OR REPLACE FUNCTION search_projects(
    p_query TEXT,
    p_category TEXT DEFAULT 'all',
    p_status TEXT DEFAULT 'all',
    p_sort_by TEXT DEFAULT 'relevance',
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
    total_count INTEGER;
BEGIN
    WITH sorted_projects AS (
        SELECT 
            p.*,
            CASE 
                WHEN p.end_date < NOW() THEN 'ended'
                WHEN p.start_date > NOW() THEN 'upcoming'
                ELSE 'active'
            END as status,
            CASE 
                WHEN p.end_date > NOW() THEN EXTRACT(EPOCH FROM (p.end_date - NOW()))
                ELSE 0
            END as seconds_remaining
        FROM projects p
        WHERE p.is_active = true
            AND (p_category = 'all' OR p.category = p_category OR (p_category = 'featured' AND p.is_featured = true))
            AND (p_status = 'all' OR 
                 (p_status = 'active' AND p.start_date <= NOW() AND (p.end_date IS NULL OR p.end_date > NOW())) OR
                 (p_status = 'ended' AND p.end_date < NOW()) OR
                 (p_status = 'upcoming' AND p.start_date > NOW()))
            AND (p_query = '' OR 
                 p.title ILIKE '%' || p_query || '%' OR 
                 p.collection_name ILIKE '%' || p_query || '%')
        ORDER BY 
            CASE p_sort_by
                WHEN 'end_date' THEN p.end_date
                WHEN 'reward' THEN NULL
                WHEN 'participants' THEN NULL
                ELSE p.created_at
            END DESC NULLS LAST
        LIMIT p_limit OFFSET p_offset
    )
    SELECT COUNT(*) INTO total_count FROM sorted_projects;
    
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
            COUNT(CASE WHEN ua.completed THEN 1 END) as completed,
            CASE 
                WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN ua.completed THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100
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
-- VALIDATION FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION validate_task_configuration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'twitter_follow' AND NEW.twitter_username IS NULL THEN
        RAISE EXCEPTION 'twitter_username is required for twitter_follow tasks';
    END IF;
    
    IF NEW.type = 'twitter_retweet' AND NEW.twitter_tweet_id IS NULL THEN
        RAISE EXCEPTION 'twitter_tweet_id is required for twitter_retweet tasks';
    END IF;
    
    IF NEW.type = 'discord_role' AND (NEW.discord_guild_id IS NULL OR NEW.required_role_id IS NULL) THEN
        RAISE EXCEPTION 'discord_guild_id and required_role_id are required for discord_role tasks';
    END IF;
    
    IF NEW.type = 'telegram_join' AND NEW.telegram_channel_id IS NULL THEN
        RAISE EXCEPTION 'telegram_channel_id is required for telegram_join tasks';
    END IF;
    
    IF NEW.type = 'visit_website' AND NEW.website_url IS NULL THEN
        RAISE EXCEPTION 'website_url is required for visit_website tasks';
    END IF;
    
    IF NEW.type = 'quiz' AND (NEW.quiz_questions IS NULL OR jsonb_array_length(NEW.quiz_questions) = 0) THEN
        RAISE EXCEPTION 'quiz_questions array is required for quiz tasks';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Update project participants when user joins/leaves
CREATE OR REPLACE FUNCTION update_project_participants()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Update participation stats when tasks are completed
CREATE OR REPLACE FUNCTION update_participation_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE user_participations 
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
        
        UPDATE user_participations 
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

-- Create triggers
DROP TRIGGER IF EXISTS trg_validate_task_config ON project_tasks;
CREATE TRIGGER trg_validate_task_config
    BEFORE INSERT OR UPDATE ON project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_task_configuration();

CREATE TRIGGER trigger_update_project_participants
    AFTER INSERT OR DELETE ON user_participations
    FOR EACH ROW EXECUTE FUNCTION update_project_participants();

CREATE TRIGGER trigger_update_participation_stats
    AFTER INSERT OR UPDATE ON user_task_completions
    FOR EACH ROW EXECUTE FUNCTION update_participation_stats();

-- Updated at triggers
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

-- =============================================
-- PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION get_projects_dashboard TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_project_details TO authenticated, anon;
GRANT EXECUTE ON FUNCTION complete_project_task TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_project_stats TO authenticated;
GRANT EXECUTE ON FUNCTION search_projects TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_dashboard_data TO authenticated;

-- Table permissions
GRANT SELECT, INSERT, UPDATE ON projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON project_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_participations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_task_completions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_activities TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'COMPLETE UNIFIED NEFTIT SCHEMA deployed successfully!';
    RAISE NOTICE 'Includes: Projects, Tasks, Users, Balances, Achievements, Activities';
    RAISE NOTICE 'RPC Functions: Dashboard, Project Details, Task Completion, User Stats, Search';
    RAISE NOTICE 'Task Types: twitter_follow, twitter_retweet, twitter_post, discord_join, discord_role, telegram_join, visit_website, quiz';
    RAISE NOTICE 'Ready for production deployment!';
END $$;
