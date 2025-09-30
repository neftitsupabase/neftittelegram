-- Fix Campaign Reward Claim Logic
-- The current can_claim_project_reward function only checks if rewards were claimed
-- but doesn't verify if all tasks are completed. This causes "Already Claimed" to show
-- for projects where tasks aren't completed.

-- Replace the existing function with proper task completion validation
CREATE OR REPLACE FUNCTION can_claim_project_reward(user_wallet TEXT, proj_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  total_tasks INTEGER;
  completed_tasks INTEGER;
  already_claimed BOOLEAN;
BEGIN
  -- Convert proj_id to UUID if it's a string
  DECLARE
    project_uuid UUID;
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
  RETURN (completed_tasks = total_tasks) AND NOT already_claimed;
  
EXCEPTION WHEN OTHERS THEN
  -- On any error, return false
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION can_claim_project_reward(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION can_claim_project_reward(TEXT, TEXT) TO anon;
