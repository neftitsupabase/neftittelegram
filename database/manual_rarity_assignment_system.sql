-- Manual Rarity Assignment System for NFT Distribution
-- Allows manual selection of which users get which rarity NFTs

-- 1. Get project participants with completion status
CREATE OR REPLACE FUNCTION get_project_participants_with_completion(
  p_project_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_total_tasks INTEGER;
  v_participants JSON[];
  v_participant JSON;
  v_completion_data RECORD;
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

  -- Get total active tasks
  SELECT COUNT(*) INTO v_total_tasks
  FROM project_tasks 
  WHERE project_id = p_project_id AND is_active = true;

  -- Initialize participants array
  v_participants := ARRAY[]::JSON[];

  -- Get all participants with their completion status
  FOR v_completion_data IN
    SELECT 
      up.wallet_address,
      up.joined_at,
      COUNT(utc.task_id) as completed_tasks,
      ROUND((COUNT(utc.task_id)::numeric / v_total_tasks::numeric) * 100, 2) as completion_percentage,
      CASE WHEN COUNT(utc.task_id) = v_total_tasks THEN true ELSE false END as fully_completed,
      ARRAY_AGG(utc.task_id) FILTER (WHERE utc.completed = true) as completed_task_ids
    FROM user_participations up
    LEFT JOIN user_task_completions utc ON up.wallet_address = utc.wallet_address 
      AND up.project_id = utc.project_id AND utc.completed = true
    WHERE up.project_id = p_project_id
    GROUP BY up.wallet_address, up.joined_at
    ORDER BY completion_percentage DESC, up.joined_at ASC
  LOOP
    v_participant := json_build_object(
      'wallet_address', v_completion_data.wallet_address,
      'joined_at', v_completion_data.joined_at,
      'completed_tasks', v_completion_data.completed_tasks,
      'total_tasks', v_total_tasks,
      'completion_percentage', v_completion_data.completion_percentage,
      'fully_completed', v_completion_data.fully_completed,
      'completed_task_ids', v_completion_data.completed_task_ids,
      'eligible_for_nft', v_completion_data.fully_completed
    );
    
    v_participants := array_append(v_participants, v_participant);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'project', json_build_object(
      'id', v_project.id,
      'title', v_project.title,
      'collection_name', v_project.collection_name,
      'total_tasks', v_total_tasks,
      'current_participants', v_project.current_participants,
      'nft_images', v_project.nft_images,
      'rarity_distribution', v_project.rarity_distribution
    ),
    'participants', array_to_json(v_participants),
    'stats', json_build_object(
      'total_participants', array_length(v_participants, 1),
      'eligible_participants', (
        SELECT COUNT(*) 
        FROM unnest(v_participants) p 
        WHERE (p->>'fully_completed')::boolean = true
      )
    )
  );
END;
$$;

-- 2. Execute manual NFT distribution with specific user-rarity assignments
CREATE OR REPLACE FUNCTION execute_manual_rarity_distribution(
  p_project_id UUID,
  p_user_rarity_assignments JSONB, -- [{"wallet_address": "0x123", "rarity": "Legendary"}, ...]
  p_custom_nft_images JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_total_tasks INTEGER;
  v_nft_images JSONB;
  v_distributions JSON[];
  v_distribution JSON;
  v_assignment JSONB;
  v_wallet_address TEXT;
  v_rarity TEXT;
  v_image_url TEXT;
  v_nft_id TEXT;
  v_user_completed_tasks INTEGER;
  v_distributed_count INTEGER := 0;
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

  -- Initialize distributions array
  v_distributions := ARRAY[]::JSON[];

  -- Process each user-rarity assignment
  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_user_rarity_assignments)
  LOOP
    v_wallet_address := v_assignment->>'wallet_address';
    v_rarity := v_assignment->>'rarity';
    
    -- Validate user completed all tasks
    SELECT COUNT(*) INTO v_user_completed_tasks
    FROM user_task_completions 
    WHERE project_id = p_project_id 
      AND wallet_address = v_wallet_address 
      AND completed = true;
    
    -- Only distribute if user completed ALL tasks
    IF v_user_completed_tasks = v_total_tasks THEN
      -- Get image URL for rarity
      CASE v_rarity
        WHEN 'Legendary' THEN v_image_url := v_nft_images->>'legendary';
        WHEN 'Rare' THEN v_image_url := v_nft_images->>'rare';
        WHEN 'Common' THEN v_image_url := v_nft_images->>'common';
        ELSE v_image_url := v_nft_images->>'common'; -- Default to common
      END CASE;
      
      -- Generate unique NFT ID
      v_nft_id := p_project_id || '_' || v_rarity || '_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 9);
      
      -- Create distribution record
      v_distribution := json_build_object(
        'wallet_address', v_wallet_address,
        'rarity', v_rarity,
        'image', v_image_url,
        'nft_id', v_nft_id,
        'project_id', p_project_id,
        'assigned_manually', true
      );
      
      v_distributions := array_append(v_distributions, v_distribution);
      v_distributed_count := v_distributed_count + 1;
    ELSE
      -- Log users who didn't complete all tasks
      RAISE NOTICE 'User % did not complete all tasks (%/%), skipping NFT distribution', 
        v_wallet_address, v_user_completed_tasks, v_total_tasks;
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
      'message', 'Manual rarity distribution completed',
      'processed_users', v_distributed_count,
      'distributed_nfts', v_distributed_count,
      'distribution_type', 'manual_rarity_assignment'
    ),
    true
  ) ON CONFLICT (project_id) DO UPDATE SET
    processed_at = NOW(),
    result = EXCLUDED.result,
    success = EXCLUDED.success;

  -- Build final result
  v_result := json_build_object(
    'success', true,
    'message', format('Manual rarity distribution completed: %s NFTs distributed', v_distributed_count),
    'distributed_nfts', v_distributed_count,
    'distributions', array_to_json(v_distributions),
    'project_info', json_build_object(
      'id', v_project.id,
      'title', v_project.title,
      'collection_name', v_project.collection_name
    ),
    'distribution_stats', json_build_object(
      'total_assigned', v_distributed_count,
      'distribution_type', 'manual_rarity_assignment'
    )
  );

  RETURN v_result;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION get_project_participants_with_completion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_manual_rarity_distribution(UUID, JSONB, JSONB) TO authenticated;

-- Comments
COMMENT ON FUNCTION get_project_participants_with_completion IS 'Get all project participants with task completion status for manual rarity assignment';
COMMENT ON FUNCTION execute_manual_rarity_distribution IS 'Execute NFT distribution with manual user-specific rarity assignments';
