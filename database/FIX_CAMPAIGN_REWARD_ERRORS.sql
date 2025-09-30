-- ============================================================================
-- FIX CAMPAIGN REWARD CLAIM ERRORS
-- Addresses 404 and 400 errors when claiming campaign rewards
-- ============================================================================

-- 1. Create missing campaign_end_processing table
CREATE TABLE IF NOT EXISTS campaign_end_processing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT false,
    total_completers INTEGER DEFAULT 0,
    processing_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id)
);

-- 2. Ensure campaign_reward_claims table has correct structure
-- Fix potential column type mismatches causing 400 errors
DO $$
BEGIN
    -- Check if project_id column is TEXT instead of UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaign_reward_claims' 
        AND column_name = 'project_id' 
        AND data_type = 'text'
    ) THEN
        -- Drop and recreate with correct UUID type
        ALTER TABLE campaign_reward_claims DROP CONSTRAINT IF EXISTS campaign_reward_claims_project_id_fkey;
        ALTER TABLE campaign_reward_claims ALTER COLUMN project_id TYPE UUID USING project_id::UUID;
        ALTER TABLE campaign_reward_claims ADD CONSTRAINT campaign_reward_claims_project_id_fkey 
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Create the missing can_claim_project_reward RPC function
CREATE OR REPLACE FUNCTION can_claim_project_reward(
    user_wallet TEXT,
    proj_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    already_claimed BOOLEAN := false;
    total_tasks INTEGER := 0;
    completed_tasks INTEGER := 0;
BEGIN
    -- Check if user has already claimed rewards for this project
    SELECT EXISTS(
        SELECT 1 FROM campaign_reward_claims 
        WHERE wallet_address = user_wallet AND project_id = proj_id
    ) INTO already_claimed;
    
    IF already_claimed THEN
        RETURN false;
    END IF;
    
    -- Get total number of active tasks for this project
    SELECT COUNT(*)
    INTO total_tasks
    FROM project_tasks 
    WHERE project_id = proj_id AND is_active = true;
    
    -- If no tasks, user cannot claim
    IF total_tasks = 0 THEN
        RETURN false;
    END IF;
    
    -- Get number of completed tasks by this user
    SELECT COUNT(*)
    INTO completed_tasks
    FROM user_task_completions utc
    JOIN project_tasks pt ON utc.task_id = pt.id
    WHERE utc.wallet_address = user_wallet 
        AND pt.project_id = proj_id 
        AND utc.completed = true
        AND pt.is_active = true;
    
    -- User can claim if they completed all tasks
    RETURN completed_tasks = total_tasks;
END;
$$;

-- 4. Create function to record campaign end processing
CREATE OR REPLACE FUNCTION record_campaign_end_processing(
    proj_id UUID,
    completers_count INTEGER DEFAULT 0,
    processing_success BOOLEAN DEFAULT true,
    details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processing_id UUID;
BEGIN
    INSERT INTO campaign_end_processing (
        project_id,
        success,
        total_completers,
        processing_details
    ) VALUES (
        proj_id,
        processing_success,
        completers_count,
        details
    )
    ON CONFLICT (project_id) DO UPDATE SET
        success = EXCLUDED.success,
        total_completers = EXCLUDED.total_completers,
        processing_details = EXCLUDED.processing_details,
        processed_at = NOW()
    RETURNING id INTO processing_id;
    
    RETURN processing_id;
END;
$$;

-- 5. Create function to check campaign end processing status
CREATE OR REPLACE FUNCTION get_campaign_end_processing(proj_id UUID)
RETURNS TABLE(
    id UUID,
    project_id UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    success BOOLEAN,
    total_completers INTEGER,
    processing_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cep.id,
        cep.project_id,
        cep.processed_at,
        cep.success,
        cep.total_completers,
        cep.processing_details
    FROM campaign_end_processing cep
    WHERE cep.project_id = proj_id;
END;
$$;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_end_processing_project ON campaign_end_processing(project_id);
CREATE INDEX IF NOT EXISTS idx_campaign_end_processing_success ON campaign_end_processing(success);
CREATE INDEX IF NOT EXISTS idx_campaign_reward_claims_wallet_project ON campaign_reward_claims(wallet_address, project_id);

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION can_claim_project_reward(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_campaign_end_processing(UUID, INTEGER, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_end_processing(UUID) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON campaign_end_processing TO authenticated;
GRANT SELECT, INSERT, UPDATE ON campaign_reward_claims TO authenticated;

-- 8. Enable RLS on new table
ALTER TABLE campaign_end_processing ENABLE ROW LEVEL SECURITY;

-- RLS policy for campaign_end_processing
CREATE POLICY "Anyone can view campaign end processing" ON campaign_end_processing
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert campaign end processing" ON campaign_end_processing
    FOR INSERT WITH CHECK (true);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'CAMPAIGN REWARD ERRORS FIXED!';
    RAISE NOTICE 'Fixed issues:';
    RAISE NOTICE '- Created missing campaign_end_processing table';
    RAISE NOTICE '- Fixed campaign_reward_claims project_id column type';
    RAISE NOTICE '- Added can_claim_project_reward RPC function';
    RAISE NOTICE '- Added campaign end processing functions';
    RAISE NOTICE '- Added proper indexes and permissions';
    RAISE NOTICE 'Campaign reward claiming should now work properly!';
END $$;
