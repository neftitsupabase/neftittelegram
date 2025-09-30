-- Update NEFTIT Project Twitter Tasks
-- Project ID: 441faa21-27a3-465c-a05b-bfd94d0259bc

-- Step 1: Check current project status
SELECT 
    p.id,
    p.title,
    p.current_participants,
    p.max_participants
FROM projects p
WHERE p.id = '441faa21-27a3-465c-a05b-bfd94d0259bc';

-- Step 2: Check existing tasks
SELECT 
    id,
    title,
    type,
    action_url,
    is_active,
    sort_order
FROM project_tasks 
WHERE project_id = '441faa21-27a3-465c-a05b-bfd94d0259bc'
ORDER BY sort_order;

-- Step 3: Remove any broken Twitter tasks
DELETE FROM project_tasks 
WHERE project_id = '441faa21-27a3-465c-a05b-bfd94d0259bc' 
AND type IN ('twitter_retweet', 'twitter_post', 'twitter_follow');

-- Step 4: Insert working Twitter tasks

-- Task 1: Twitter Retweet (using working tweet URL)
INSERT INTO project_tasks (
    project_id,
    title,
    description,
    type,
    action_url,
    twitter_username,
    twitter_tweet_id,
    is_active,
    sort_order
) VALUES (
    '441faa21-27a3-465c-a05b-bfd94d0259bc',
    'Retweet Our Launch Post',
    'Help spread the word about NEFTIT by retweeting our campaign launch announcement! Click the link to open Twitter, then retweet the post.',
    'twitter_retweet',
    'https://x.com/neftitxyz/status/1741073654564564992', -- Working tweet URL
    'neftitxyz',
    '1741073654564564992',
    true,
    1
);

-- Task 2: Twitter Post
INSERT INTO project_tasks (
    project_id,
    title,
    description,
    type,
    action_url,
    twitter_username,
    is_active,
    sort_order
) VALUES (
    '441faa21-27a3-465c-a05b-bfd94d0259bc',
    'Tweet About NEFTIT',
    'Share your thoughts about NEFTIT! Include "join neftit" in your tweet. Click the link to compose your tweet.',
    'twitter_post',
    'https://twitter.com/intent/tweet?text=Just%20discovered%20@neftitxyz%20-%20amazing%20NFT%20platform!%20Join%20neftit%20community%20now!%20🚀%20#NEFTIT%20#NFTs%20#Blockchain',
    'neftitxyz',
    true,
    2
);

-- Task 3: Twitter Follow
INSERT INTO project_tasks (
    project_id,
    title,
    description,
    type,
    action_url,
    twitter_username,
    is_active,
    sort_order
) VALUES (
    '441faa21-27a3-465c-a05b-bfd94d0259bc',
    'Follow @neftitxyz on Twitter',
    'Follow our official Twitter account to stay updated with the latest news and announcements!',
    'twitter_follow',
    'https://twitter.com/neftitxyz',
    'neftitxyz',
    true,
    3
);

-- Step 5: Verify tasks were created
SELECT 
    id,
    title,
    type,
    action_url,
    is_active,
    sort_order
FROM project_tasks 
WHERE project_id = '441faa21-27a3-465c-a05b-bfd94d0259bc' 
ORDER BY sort_order;

-- Step 6: Update project metadata
UPDATE projects 
SET 
    updated_at = NOW(),
    task_status = 'active'
WHERE id = '441faa21-27a3-465c-a05b-bfd94d0259bc';

-- Step 7: Show final project status
SELECT 
    p.title,
    p.current_participants,
    p.max_participants,
    p.task_status,
    COUNT(pt.id) as active_task_count,
    STRING_AGG(pt.type, ', ' ORDER BY pt.sort_order) as task_types
FROM projects p
LEFT JOIN project_tasks pt ON p.id = pt.project_id AND pt.is_active = true
WHERE p.id = '441faa21-27a3-465c-a05b-bfd94d0259bc'
GROUP BY p.id, p.title, p.current_participants, p.max_participants, p.task_status;

-- Step 8: Ensure user_task_completions table exists and has proper structure
CREATE TABLE IF NOT EXISTS user_task_completions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    verification_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, task_id)
);

-- Step 9: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_task_completions_wallet ON user_task_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_project ON user_task_completions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_task_completions_task ON user_task_completions(task_id);

-- Step 10: Final verification
SELECT 
    'Project Tasks Updated Successfully!' as status,
    COUNT(*) as total_tasks,
    STRING_AGG(type, ', ' ORDER BY sort_order) as task_types
FROM project_tasks 
WHERE project_id = '441faa21-27a3-465c-a05b-bfd94d0259bc' 
AND is_active = true;
