-- Low Egress RPC Functions for Campaign Projects
-- Optimized for Discover, ProjectDetails, and NFTTaskList components

-- 1. Get Projects Dashboard (Discover Page)
-- Single RPC call to get all projects with stats
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
  -- Get total counts for dashboard stats
  SELECT COUNT(*) INTO total_count FROM projects WHERE is_active = true;
  SELECT COUNT(*) INTO active_count FROM projects WHERE is_active = true;
  SELECT COUNT(*) INTO featured_count FROM projects WHERE is_active = true AND is_featured = true;
  
  -- Build main query with filters
  WITH filtered_projects AS (
    SELECT 
      p.*,
      CASE 
        WHEN p.end_date < NOW() THEN 'ended'
        WHEN p.start_date > NOW() THEN 'upcoming'
        ELSE 'active'
      END as status,
      -- Calculate time remaining
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
        'discord', fp.discord
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

-- 2. Get Project Details with Tasks (ProjectDetails Page)
-- Single RPC call to get complete project information
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
  user_participation JSON;
  user_completions JSON;
BEGIN
  -- Get project information
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
  
  -- Return null if project not found
  IF project_data IS NULL THEN
    RETURN json_build_object('error', 'Project not found');
  END IF;
  
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
  
  -- Get user participation data if wallet provided
  IF p_wallet_address IS NOT NULL THEN
    SELECT json_build_object(
      'joined_at', upp.joined_at,
      'completed_tasks_count', upp.completed_tasks_count,
      'total_tasks_count', upp.total_tasks_count,
      'completion_percentage', upp.completion_percentage,
      'rewards_claimed', upp.rewards_claimed,
      'claimed_at', upp.claimed_at
    ) INTO user_participation
    FROM user_project_participations upp
    WHERE upp.project_id = p_project_id AND upp.wallet_address = p_wallet_address;
    
    -- Get user task completions
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
  END IF;
  
  -- Build final result
  SELECT json_build_object(
    'project', project_data,
    'tasks', tasks_data,
    'user_participation', COALESCE(user_participation, 'null'::json),
    'user_completions', COALESCE(user_completions, '{}'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 3. Complete Task (NFTTaskList Component)
-- Single RPC call to complete a task and update participation
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
  -- Validate task exists and is active
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
  
  -- Check if already completed
  SELECT EXISTS(
    SELECT 1 FROM user_task_completions
    WHERE wallet_address = p_wallet_address 
      AND task_id = p_task_id 
      AND completed = true
  ) INTO already_completed;
  
  IF already_completed THEN
    RETURN json_build_object('success', false, 'error', 'Task already completed');
  END IF;
  
  -- Ensure user participation exists
  SELECT EXISTS(
    SELECT 1 FROM user_project_participations
    WHERE wallet_address = p_wallet_address AND project_id = p_project_id
  ) INTO participation_exists;
  
  IF NOT participation_exists THEN
    INSERT INTO user_project_participations (wallet_address, project_id)
    VALUES (p_wallet_address, p_project_id);
  END IF;
  
  -- Insert or update task completion
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
  
  -- Get updated participation stats
  SELECT json_build_object(
    'success', true,
    'completed_tasks_count', upp.completed_tasks_count,
    'total_tasks_count', upp.total_tasks_count,
    'completion_percentage', upp.completion_percentage
  ) INTO result
  FROM user_project_participations upp
  WHERE upp.wallet_address = p_wallet_address AND upp.project_id = p_project_id;
  
  RETURN result;
END;
$$;

-- 4. Get User Project Stats (for authenticated users)
-- Single RPC call to get user's project participation stats
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
        'project_id', upp.project_id,
        'joined_at', upp.joined_at,
        'completed_tasks_count', upp.completed_tasks_count,
        'total_tasks_count', upp.total_tasks_count,
        'completion_percentage', upp.completion_percentage,
        'rewards_claimed', upp.rewards_claimed,
        'claimed_at', upp.claimed_at
      )
    ), '[]'::json)
  ) INTO result
  FROM user_project_participations upp
  WHERE upp.wallet_address = p_wallet_address;
  
  RETURN result;
END;
$$;

-- 5. Search Projects (Enhanced search functionality)
-- Single RPC call for advanced project search
CREATE OR REPLACE FUNCTION search_projects(
  p_query TEXT,
  p_category TEXT DEFAULT 'all',
  p_status TEXT DEFAULT 'all', -- 'active', 'ended', 'upcoming', 'all'
  p_sort_by TEXT DEFAULT 'relevance', -- 'relevance', 'end_date', 'reward', 'participants'
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
  sort_clause TEXT;
BEGIN
  -- Build sort clause
  CASE p_sort_by
    WHEN 'end_date' THEN sort_clause := 'p.end_date ASC NULLS LAST';
    WHEN 'reward' THEN sort_clause := 'p.reward_amount DESC';
    WHEN 'participants' THEN sort_clause := 'p.current_participants DESC';
    ELSE sort_clause := 'ts_rank(to_tsvector(''english'', p.title || '' '' || p.collection_name), plainto_tsquery(''' || p_query || ''')) DESC';
  END CASE;
  
  -- Execute search query
  EXECUTE format('
    WITH search_results AS (
      SELECT 
        p.*,
        CASE 
          WHEN p.end_date < NOW() THEN ''ended''
          WHEN p.start_date > NOW() THEN ''upcoming''
          ELSE ''active''
        END as status,
        CASE 
          WHEN p.end_date > NOW() THEN EXTRACT(EPOCH FROM (p.end_date - NOW()))
          ELSE 0
        END as seconds_remaining,
        ts_rank(to_tsvector(''english'', p.title || '' '' || p.collection_name), plainto_tsquery($1)) as relevance_score
      FROM projects p
      WHERE p.is_active = true
        AND ($2 = ''all'' OR p.category = $2 OR ($2 = ''featured'' AND p.is_featured = true))
        AND ($3 = ''all'' OR 
             ($3 = ''active'' AND p.start_date <= NOW() AND (p.end_date IS NULL OR p.end_date > NOW())) OR
             ($3 = ''ended'' AND p.end_date < NOW()) OR
             ($3 = ''upcoming'' AND p.start_date > NOW()))
        AND ($1 = '''' OR 
             p.title ILIKE ''%%'' || $1 || ''%%'' OR 
             p.collection_name ILIKE ''%%'' || $1 || ''%%'' OR
             to_tsvector(''english'', p.title || '' '' || p.collection_name) @@ plainto_tsquery($1))
      ORDER BY %s
      LIMIT $4 OFFSET $5
    )
    SELECT json_build_object(
      ''results'', COALESCE(json_agg(
        json_build_object(
          ''id'', sr.id,
          ''title'', sr.title,
          ''description'', sr.description,
          ''collection_name'', sr.collection_name,
          ''image_url'', sr.image_url,
          ''banner_url'', sr.banner_url,
          ''reward_amount'', sr.reward_amount,
          ''reward_currency'', sr.reward_currency,
          ''xp_reward'', sr.xp_reward,
          ''max_participants'', sr.max_participants,
          ''current_participants'', sr.current_participants,
          ''category'', sr.category,
          ''blockchain'', sr.blockchain,
          ''start_date'', sr.start_date,
          ''end_date'', sr.end_date,
          ''is_featured'', sr.is_featured,
          ''status'', sr.status,
          ''seconds_remaining'', sr.seconds_remaining,
          ''relevance_score'', sr.relevance_score
        )
      ), ''[]''::json),
      ''total_count'', (SELECT COUNT(*) FROM search_results),
      ''has_more'', (SELECT COUNT(*) FROM search_results) = $4
    )
    FROM search_results sr
  ', sort_clause) 
  INTO result
  USING p_query, p_category, p_status, p_limit, p_offset;
  
  RETURN result;
END;
$$;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_projects_dashboard TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_project_details TO authenticated, anon;
GRANT EXECUTE ON FUNCTION complete_project_task TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_project_stats TO authenticated;
GRANT EXECUTE ON FUNCTION search_projects TO authenticated, anon;
