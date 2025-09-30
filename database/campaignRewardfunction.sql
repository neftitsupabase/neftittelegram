-- Fix Duplicate can_claim_project_reward Functions
-- The issue is there are TWO functions with the same name, and the wrong one is being used

-- 1. Drop all existing versions of the function
DROP FUNCTION IF EXISTS can_claim_project_reward(TEXT, TEXT);
DROP FUNCTION IF EXISTS can_claim_project_reward(TEXT, UUID);

-- 2. Create the correct version (without project end date check)
CREATE OR REPLACE FUNCTION can_claim_project_reward(user_wallet TEXT, proj_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  total_tasks INTEGER;
  completed_tasks INTEGER;
  already_claimed BOOLEAN;
  project_uuid UUID;
BEGIN
  -- Convert proj_id to UUID if it's a string
  BEGIN
    project_uuid := proj_id::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    -- If conversion fails, return false
    RETURN FALSE;
  END;
  
  -- Get total tasks for this project
  SELECT COUNT(*) INTO total_tasks
  FROM project_tasks 
  WHERE project_id = project_uuid AND is_active = true;
  
  -- If no tasks exist, can't claim
  IF total_tasks = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Get completed tasks for this user
  SELECT COUNT(*) INTO completed_tasks
  FROM user_task_completions utc
  WHERE utc.wallet_address = user_wallet 
    AND utc.project_id = project_uuid 
    AND utc.completed = true;
  
  -- Check if already claimed
  SELECT EXISTS(
    SELECT 1 FROM campaign_reward_claims 
    WHERE wallet_address = user_wallet AND project_id = proj_id
  ) INTO already_claimed;
  
  -- Can claim only if:
  -- 1. All tasks are completed AND
  -- 2. Not already claimed
  -- NOTE: We removed the project end date check that was causing issues
  RETURN (completed_tasks = total_tasks) AND NOT already_claimed;
  
EXCEPTION WHEN OTHERS THEN
  -- On any error, return false
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION can_claim_project_reward(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION can_claim_project_reward(TEXT, TEXT) TO anon;
