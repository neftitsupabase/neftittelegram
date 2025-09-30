-- DEBUG BURN CHANCE ISSUE
-- Simple test to understand what's going wrong

-- Test the actual burn chance requirement logic
CREATE OR REPLACE FUNCTION debug_burn_chance_logic(p_wallet_address TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  project_record RECORD;
  completed_projects TEXT[] := '{}';
  project_details JSON[] := '{}';
BEGIN
  -- Check what projects this user has actually completed
  FOR project_record IN
    SELECT 
      p.id::TEXT as project_id,
      p.title,
      (
        SELECT COUNT(*) 
        FROM user_task_completions utc
        JOIN project_tasks pt ON utc.task_id = pt.id
        WHERE utc.wallet_address = p_wallet_address 
          AND pt.project_id = p.id
          AND utc.completed = true
      ) as completed_tasks,
      (
        SELECT COUNT(*) 
        FROM project_tasks 
        WHERE project_id = p.id AND is_active = true
      ) as total_tasks,
      (
        SELECT up.completion_percentage
        FROM user_participations up
        WHERE up.wallet_address = p_wallet_address
          AND up.project_id = p.id
      ) as participation_percentage
    FROM projects p
    WHERE p.is_active = true
  LOOP
    -- Add project details for debugging
    project_details := project_details || json_build_object(
      'project_id', project_record.project_id,
      'title', project_record.title,
      'completed_tasks', project_record.completed_tasks,
      'total_tasks', project_record.total_tasks,
      'participation_percentage', COALESCE(project_record.participation_percentage, 0),
      'is_fully_complete_method1', (project_record.completed_tasks = project_record.total_tasks AND project_record.total_tasks > 0),
      'is_fully_complete_method2', (COALESCE(project_record.participation_percentage, 0) = 100)
    );

    -- Check if project is fully completed by either method
    IF (project_record.completed_tasks = project_record.total_tasks AND project_record.total_tasks > 0)
       OR (COALESCE(project_record.participation_percentage, 0) = 100) THEN
      completed_projects := array_append(completed_projects, project_record.project_id);
    END IF;
  END LOOP;

  result := json_build_object(
    'wallet_address', p_wallet_address,
    'completed_projects_count', array_length(completed_projects, 1),
    'completed_project_ids', completed_projects,
    'should_have_burn_chance', (array_length(completed_projects, 1) >= 2),
    'project_details', project_details,
    'debug_message', CASE 
      WHEN array_length(completed_projects, 1) >= 2 THEN 'User should have burn chance - completed 2+ projects'
      WHEN array_length(completed_projects, 1) = 1 THEN 'User needs 1 more project - only completed 1 project'
      ELSE 'User needs to complete projects - no projects completed'
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_burn_chance_logic(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_burn_chance_logic(TEXT) TO anon;

-- Usage: SELECT debug_burn_chance_logic('your_wallet_address');
