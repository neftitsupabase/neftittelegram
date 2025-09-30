-- Deploy missing campaign_end_processing table for LowEgressManualNFTService
-- This table is required for the manual NFT distribution functionality

-- 1. Create campaign_end_processing table
CREATE TABLE IF NOT EXISTS campaign_end_processing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT false,
    total_completers INTEGER DEFAULT 0,
    processing_details JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id)
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_end_processing_project ON campaign_end_processing(project_id);
CREATE INDEX IF NOT EXISTS idx_campaign_end_processing_success ON campaign_end_processing(success);

-- 3. Enable RLS
ALTER TABLE campaign_end_processing ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (with IF NOT EXISTS handling)
DO $$
BEGIN
    -- Service role policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'campaign_end_processing' 
        AND policyname = 'Service role can manage campaign processing'
    ) THEN
        CREATE POLICY "Service role can manage campaign processing" ON campaign_end_processing
          FOR ALL USING (auth.role() = 'service_role');
    END IF;

    -- View policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'campaign_end_processing' 
        AND policyname = 'Anyone can view campaign end processing'
    ) THEN
        CREATE POLICY "Anyone can view campaign end processing" ON campaign_end_processing
            FOR SELECT USING (true);
    END IF;

    -- Insert policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'campaign_end_processing' 
        AND policyname = 'Authenticated users can insert campaign end processing'
    ) THEN
        CREATE POLICY "Authenticated users can insert campaign end processing" ON campaign_end_processing
            FOR INSERT WITH CHECK (true);
    END IF;
END;
$$;

-- 5. Grant permissions
GRANT SELECT, INSERT, UPDATE ON campaign_end_processing TO authenticated;
GRANT SELECT, INSERT, UPDATE ON campaign_end_processing TO service_role;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'campaign_end_processing table deployed successfully!';
    RAISE NOTICE 'LowEgressManualNFTService can now record distribution results.';
END;
$$;
