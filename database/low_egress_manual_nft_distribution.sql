-- Low Egress Manual NFT Distribution System
-- Single RPC functions to minimize database calls and provide manual control over NFT images

-- 1. Add nft_images column to projects table if not exists
ALTER TABLE projects ADD COLUMN IF NOT EXISTS nft_images JSONB DEFAULT '{
  "common": "/images/common1.jpg",
  "rare": "/images/Rare1.jpg",
  "legendary": "/images/Legendary.jpg"
}';

-- 2. Get project distribution preview (Single RPC call)
CREATE OR REPLACE FUNCTION get_project_distribution_preview(
  p_project_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_total_tasks INTEGER;
  v_successful_completers TEXT[];
  v_completer_count INTEGER;
  v_rarity_dist JSONB;
  v_legendary_count INTEGER;
  v_rare_count INTEGER;
  v_common_count INTEGER;
  v_result JSON;
BEGIN
  -- Get project details
  SELECT * INTO v_project
  FROM projects 
  WHERE id = p_project_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;

  -- Get total active tasks for this project
  SELECT COUNT(*) INTO v_total_tasks
  FROM project_tasks 
  WHERE project_id = p_project_id AND is_active = true;

  -- Get users who completed ALL tasks
  SELECT ARRAY_AGG(wallet_address) INTO v_successful_completers
  FROM (
    SELECT wallet_address
    FROM user_task_completions 
    WHERE project_id = p_project_id AND completed = true
    GROUP BY wallet_address
    HAVING COUNT(*) = v_total_tasks
  ) completers;

  -- Handle null array
  v_successful_completers := COALESCE(v_successful_completers, ARRAY[]::TEXT[]);
  v_completer_count := array_length(v_successful_completers, 1);
  v_completer_count := COALESCE(v_completer_count, 0);

  -- Calculate rarity distribution
  v_rarity_dist := COALESCE(v_project.rarity_distribution, '{"common": 70, "rare": 25, "legendary": 5}'::jsonb);
  
  v_legendary_count := FLOOR((v_rarity_dist->>'legendary')::numeric / 100 * v_completer_count);
  v_rare_count := FLOOR((v_rarity_dist->>'rare')::numeric / 100 * v_completer_count);
  v_common_count := v_completer_count - v_legendary_count - v_rare_count;

  -- Build comprehensive result
  v_result := json_build_object(
    'success', true,
    'project', json_build_object(
      'id', v_project.id,
      'title', v_project.title,
      'collection_name', v_project.collection_name,
      'image_url', v_project.image_url,
      'end_date', v_project.end_date,
      'rarity_distribution', v_project.rarity_distribution,
      'nft_images', v_project.nft_images
    ),
    'successful_completers', array_to_json(v_successful_completers),
    'completer_count', v_completer_count,
    'total_tasks', v_total_tasks,
    'distribution_preview', json_build_object(
      'legendary', v_legendary_count,
      'rare', v_rare_count,
      'common', v_common_count,
      'total', v_completer_count
    ),
    'current_nft_images', v_project.nft_images
  );

  RETURN v_result;
END;
$$;

-- 3. Update project NFT images (Single RPC call)
CREATE OR REPLACE FUNCTION update_project_nft_images(
  p_project_id UUID,
  p_nft_images JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update project with new NFT images
  UPDATE projects 
  SET 
    nft_images = p_nft_images,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'NFT images updated successfully',
    'project_id', p_project_id,
    'nft_images', p_nft_images
  );
END;
$$;

-- 4. Execute manual NFT distribution (Single RPC call)
CREATE OR REPLACE FUNCTION execute_manual_nft_distribution(
  p_project_id UUID,
  p_custom_nft_images JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_total_tasks INTEGER;
  v_successful_completers TEXT[];
  v_completer_count INTEGER;
  v_nft_images JSONB;
  v_rarity_dist JSONB;
  v_legendary_count INTEGER;
  v_rare_count INTEGER;
  v_common_count INTEGER;
  v_distributions JSON[];
  v_distribution JSON;
  v_completer TEXT;
  v_rarity TEXT;
  v_image_url TEXT;
  v_nft_id TEXT;
  v_user_index INTEGER := 0;
  v_i INTEGER;
  v_result JSON;
BEGIN
  -- Get project details
  SELECT * INTO v_project
  FROM projects 
  WHERE id = p_project_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;

  -- Update NFT images if custom ones provided
  IF p_custom_nft_images IS NOT NULL THEN
    UPDATE projects 
    SET nft_images = p_custom_nft_images, updated_at = NOW()
    WHERE id = p_project_id;
    
    v_nft_images := p_custom_nft_images;
  ELSE
    v_nft_images := v_project.nft_images;
  END IF;

  -- Get total active tasks
  SELECT COUNT(*) INTO v_total_tasks
  FROM project_tasks 
  WHERE project_id = p_project_id AND is_active = true;

  -- Get successful completers (completed ALL tasks)
  SELECT ARRAY_AGG(wallet_address ORDER BY RANDOM()) INTO v_successful_completers
  FROM (
    SELECT wallet_address
    FROM user_task_completions 
    WHERE project_id = p_project_id AND completed = true
    GROUP BY wallet_address
    HAVING COUNT(*) = v_total_tasks
  ) completers;

  v_successful_completers := COALESCE(v_successful_completers, ARRAY[]::TEXT[]);
  v_completer_count := array_length(v_successful_completers, 1);
  v_completer_count := COALESCE(v_completer_count, 0);

  IF v_completer_count = 0 THEN
    RETURN json_build_object(
      'success', true,
      'message', 'No users completed all tasks successfully',
      'distributed_nfts', 0,
      'distributions', '[]'::json
    );
  END IF;

  -- Calculate rarity distribution
  v_rarity_dist := COALESCE(v_project.rarity_distribution, '{"common": 70, "rare": 25, "legendary": 5}'::jsonb);
  
  v_legendary_count := FLOOR((v_rarity_dist->>'legendary')::numeric / 100 * v_completer_count);
  v_rare_count := FLOOR((v_rarity_dist->>'rare')::numeric / 100 * v_completer_count);
  v_common_count := v_completer_count - v_legendary_count - v_rare_count;

  -- Initialize distributions array
  v_distributions := ARRAY[]::JSON[];

  -- Distribute Legendary NFTs
  FOR v_i IN 1..v_legendary_count LOOP
    IF v_user_index < v_completer_count THEN
      v_user_index := v_user_index + 1;
      v_completer := v_successful_completers[v_user_index];
      v_rarity := 'Legendary';
      v_image_url := v_nft_images->>'legendary';
      v_nft_id := p_project_id || '_' || v_rarity || '_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 9);
      
      v_distribution := json_build_object(
        'wallet_address', v_completer,
        'rarity', v_rarity,
        'image', v_image_url,
        'nft_id', v_nft_id,
        'project_id', p_project_id
      );
      
      v_distributions := array_append(v_distributions, v_distribution);
    END IF;
  END LOOP;

  -- Distribute Rare NFTs
  FOR v_i IN 1..v_rare_count LOOP
    IF v_user_index < v_completer_count THEN
      v_user_index := v_user_index + 1;
      v_completer := v_successful_completers[v_user_index];
      v_rarity := 'Rare';
      v_image_url := v_nft_images->>'rare';
      v_nft_id := p_project_id || '_' || v_rarity || '_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 9);
      
      v_distribution := json_build_object(
        'wallet_address', v_completer,
        'rarity', v_rarity,
        'image', v_image_url,
        'nft_id', v_nft_id,
        'project_id', p_project_id
      );
      
      v_distributions := array_append(v_distributions, v_distribution);
    END IF;
  END LOOP;

  -- Distribute Common NFTs
  FOR v_i IN 1..v_common_count LOOP
    IF v_user_index < v_completer_count THEN
      v_user_index := v_user_index + 1;
      v_completer := v_successful_completers[v_user_index];
      v_rarity := 'Common';
      v_image_url := v_nft_images->>'common';
      v_nft_id := p_project_id || '_' || v_rarity || '_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 9);
      
      v_distribution := json_build_object(
        'wallet_address', v_completer,
        'rarity', v_rarity,
        'image', v_image_url,
        'nft_id', v_nft_id,
        'project_id', p_project_id
      );
      
      v_distributions := array_append(v_distributions, v_distribution);
    END IF;
  END LOOP;

  -- Record distribution processing
  INSERT INTO campaign_end_processing (
    project_id,
    processed_at,
    result,
    success
  ) VALUES (
    p_project_id,
    NOW(),
    json_build_object(
      'success', true,
      'message', 'Manual NFT distribution completed',
      'processed_users', v_completer_count,
      'distributed_nfts', array_length(v_distributions, 1),
      'distribution_type', 'manual_low_egress'
    ),
    true
  ) ON CONFLICT (project_id) DO UPDATE SET
    processed_at = NOW(),
    result = EXCLUDED.result,
    success = EXCLUDED.success;

  -- Build final result
  v_result := json_build_object(
    'success', true,
    'message', 'Manual NFT distribution completed successfully',
    'distributed_nfts', array_length(v_distributions, 1),
    'distributions', array_to_json(v_distributions),
    'project_info', json_build_object(
      'id', v_project.id,
      'title', v_project.title,
      'collection_name', v_project.collection_name
    ),
    'distribution_stats', json_build_object(
      'legendary', v_legendary_count,
      'rare', v_rare_count,
      'common', v_common_count,
      'total', v_completer_count
    )
  );

  RETURN v_result;
END;
$$;

-- 5. Get available NFT images (Single RPC call)
CREATE OR REPLACE FUNCTION get_available_nft_images()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(
    'common_collection', json_build_object(
      'common1', '/images/common1.jpg',
      'common2', '/images/common2.jpg',
      'common3', '/images/common3.jpg'
    ),
    'rare_collection', json_build_object(
      'rare1', '/images/Rare1.jpg',
      'rare2', '/images/Rare2.jpg',
      'rare3', '/images/Rare3.jpg'
    ),
    'premium_collection', json_build_object(
      'legendary', '/images/Legendary.jpg',
      'platinum', '/images/Platinum.jpg',
      'silver', '/images/Silver.jpg',
      'gold', '/images/Gold.jpg'
    )
  );
END;
$$;

-- 6. Update project NFT images and get updated project (Single RPC call)
CREATE OR REPLACE FUNCTION update_project_nft_images_optimized(
  p_project_id UUID,
  p_nft_images JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_project RECORD;
  v_result JSON;
BEGIN
  -- Update and return updated project in single operation
  UPDATE projects 
  SET 
    nft_images = p_nft_images,
    updated_at = NOW()
  WHERE id = p_project_id
  RETURNING * INTO v_updated_project;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;

  v_result := json_build_object(
    'success', true,
    'message', 'NFT images updated successfully',
    'project', json_build_object(
      'id', v_updated_project.id,
      'title', v_updated_project.title,
      'collection_name', v_updated_project.collection_name,
      'nft_images', v_updated_project.nft_images,
      'updated_at', v_updated_project.updated_at
    )
  );

  RETURN v_result;
END;
$$;

-- 7. Get all projects with NFT configuration (Admin dashboard)
CREATE OR REPLACE FUNCTION get_projects_nft_admin_dashboard()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projects JSON;
  v_result JSON;
BEGIN
  -- Get all projects with NFT configuration and completion stats
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'title', p.title,
      'collection_name', p.collection_name,
      'image_url', p.image_url,
      'end_date', p.end_date,
      'is_active', p.is_active,
      'nft_images', p.nft_images,
      'rarity_distribution', p.rarity_distribution,
      'current_participants', p.current_participants,
      'max_participants', p.max_participants,
      'status', CASE 
        WHEN p.end_date < NOW() THEN 'ended'
        WHEN p.start_date > NOW() THEN 'upcoming'
        ELSE 'active'
      END,
      'has_completers', CASE 
        WHEN EXISTS (
          SELECT 1 FROM user_project_participations upp 
          WHERE upp.project_id = p.id AND upp.completion_percentage = 100
        ) THEN true
        ELSE false
      END
    )
  ) INTO v_projects
  FROM projects p
  ORDER BY p.created_at DESC;

  v_result := json_build_object(
    'success', true,
    'projects', COALESCE(v_projects, '[]'::json),
    'total_count', (SELECT COUNT(*) FROM projects)
  );

  RETURN v_result;
END;
$$;

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_nft_images ON projects USING gin(nft_images);
CREATE INDEX IF NOT EXISTS idx_campaign_end_processing_project ON campaign_end_processing(project_id);

-- 9. RLS Policies for admin functions (with IF NOT EXISTS handling)
DO $$
BEGIN
    -- Projects NFT distribution policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'projects' 
        AND policyname = 'Service role can manage NFT distribution'
    ) THEN
        CREATE POLICY "Service role can manage NFT distribution" ON projects
          FOR ALL USING (auth.role() = 'service_role');
    END IF;

    -- Campaign processing policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'campaign_end_processing' 
        AND policyname = 'Service role can manage campaign processing'
    ) THEN
        CREATE POLICY "Service role can manage campaign processing" ON campaign_end_processing
          FOR ALL USING (auth.role() = 'service_role');
    END IF;
END;
$$;

-- Comments
COMMENT ON FUNCTION get_project_distribution_preview IS 'Low egress function to preview NFT distribution for a project with single RPC call';
COMMENT ON FUNCTION execute_manual_nft_distribution IS 'Low egress function to execute manual NFT distribution with custom images in single RPC call';
COMMENT ON FUNCTION update_project_nft_images_optimized IS 'Low egress function to update project NFT images and return updated project in single call';
COMMENT ON FUNCTION get_projects_nft_admin_dashboard IS 'Low egress admin dashboard for managing project NFT configurations';
