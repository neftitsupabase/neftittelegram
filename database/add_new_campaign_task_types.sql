-- Add New Campaign Task Types Migration
-- This script adds support for the new campaign task types requested by the user

-- Update the task_type enum to include new task types
DO $$ 
BEGIN
    -- Check if the enum type exists and add new values
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
        -- Add new task types to existing enum
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'twitter_follow';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'twitter_retweet';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'twitter_post';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'discord_join';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'discord_role';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'telegram_join';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'visit_website';
        ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'quiz';
    ELSE
        -- Create the enum type with new task types only
        CREATE TYPE task_type AS ENUM (
            'twitter_follow',
            'twitter_retweet', 
            'twitter_post',
            'discord_join',
            'discord_role',
            'telegram_join',
            'visit_website',
            'quiz'
        );
    END IF;
END $$;

-- Add new columns to project_tasks table to support new task types
ALTER TABLE IF EXISTS project_tasks 
ADD COLUMN IF NOT EXISTS telegram_channel_id TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS quiz_questions JSONB,
ADD COLUMN IF NOT EXISTS quiz_passing_score INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS twitter_username TEXT,
ADD COLUMN IF NOT EXISTS twitter_tweet_id TEXT;

-- Update the type column to use the new enum (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'project_tasks' AND column_name = 'type') THEN
        -- Update existing type column to use the enum
        ALTER TABLE project_tasks 
        ALTER COLUMN type TYPE task_type USING type::task_type;
    END IF;
END $$;

-- Create indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_project_tasks_telegram_channel 
ON project_tasks(telegram_channel_id) WHERE telegram_channel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_website_url 
ON project_tasks(website_url) WHERE website_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_twitter_username 
ON project_tasks(twitter_username) WHERE twitter_username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_twitter_tweet_id 
ON project_tasks(twitter_tweet_id) WHERE twitter_tweet_id IS NOT NULL;

-- Add constraints for data validation
DO $$
BEGIN
    -- Add quiz passing score constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'project_tasks' AND constraint_name = 'chk_quiz_passing_score') THEN
        ALTER TABLE project_tasks 
        ADD CONSTRAINT chk_quiz_passing_score 
        CHECK (quiz_passing_score IS NULL OR (quiz_passing_score >= 0 AND quiz_passing_score <= 100));
    END IF;
    
    -- Add quiz questions format constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'project_tasks' AND constraint_name = 'chk_quiz_questions_format') THEN
        ALTER TABLE project_tasks 
        ADD CONSTRAINT chk_quiz_questions_format 
        CHECK (quiz_questions IS NULL OR jsonb_typeof(quiz_questions) = 'array');
    END IF;
END $$;

-- Create a function to validate task configuration based on type
CREATE OR REPLACE FUNCTION validate_task_configuration()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate twitter_follow tasks
    IF NEW.type = 'twitter_follow' AND NEW.twitter_username IS NULL THEN
        RAISE EXCEPTION 'twitter_username is required for twitter_follow tasks';
    END IF;
    
    -- Validate twitter_retweet tasks
    IF NEW.type = 'twitter_retweet' AND NEW.twitter_tweet_id IS NULL THEN
        RAISE EXCEPTION 'twitter_tweet_id is required for twitter_retweet tasks';
    END IF;
    
    -- Validate discord_role tasks
    IF NEW.type = 'discord_role' AND (NEW.discord_guild_id IS NULL OR NEW.required_role_id IS NULL) THEN
        RAISE EXCEPTION 'discord_guild_id and required_role_id are required for discord_role tasks';
    END IF;
    
    -- Validate telegram_join tasks
    IF NEW.type = 'telegram_join' AND NEW.telegram_channel_id IS NULL THEN
        RAISE EXCEPTION 'telegram_channel_id is required for telegram_join tasks';
    END IF;
    
    -- Validate visit_website tasks
    IF NEW.type = 'visit_website' AND NEW.website_url IS NULL THEN
        RAISE EXCEPTION 'website_url is required for visit_website tasks';
    END IF;
    
    -- Validate quiz tasks
    IF NEW.type = 'quiz' AND (NEW.quiz_questions IS NULL OR jsonb_array_length(NEW.quiz_questions) = 0) THEN
        RAISE EXCEPTION 'quiz_questions array is required for quiz tasks';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate task configuration
DROP TRIGGER IF EXISTS trg_validate_task_config ON project_tasks;
CREATE TRIGGER trg_validate_task_config
    BEFORE INSERT OR UPDATE ON project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_task_configuration();

-- Insert sample tasks for each new type (for testing purposes)
INSERT INTO project_tasks (
    project_id, title, description, type, action_url, twitter_username, 
    is_active, sort_order, created_at
) VALUES 
-- Twitter Follow Task
(
    (SELECT id FROM projects LIMIT 1), 
    'Follow @NEFTIT on Twitter', 
    'Follow our official Twitter account to stay updated with the latest news and announcements.',
    'twitter_follow',
    'https://twitter.com/NEFTIT',
    'NEFTIT',
    NULL,
    NULL,
    NULL,
    true,
    1,
    NOW()
),
-- Twitter Retweet Task  
(
    (SELECT id FROM projects LIMIT 1),
    'Retweet Our Launch Post',
    'Help us spread the word by retweeting our campaign launch announcement.',
    'twitter_retweet',
    'https://twitter.com/NEFTIT/status/1234567890',
    'NEFTIT',
    true,
    2,
    NOW()
),
-- Discord Join Task
(
    (SELECT id FROM projects LIMIT 1),
    'Join NEFTIT Discord',
    'Join our Discord community to connect with other users and get support.',
    'discord_join',
    'https://discord.gg/neftit',
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    3,
    NOW()
),
-- Telegram Join Task
(
    (SELECT id FROM projects LIMIT 1),
    'Join NEFTIT Telegram',
    'Join our Telegram channel for real-time updates and community discussions.',
    'telegram_join',
    'https://t.me/neftit',
    NULL,
    true,
    4,
    NOW()
),
-- Visit Website Task
(
    (SELECT id FROM projects LIMIT 1),
    'Visit NEFTIT Website',
    'Explore our official website to learn more about the platform and features.',
    'visit_website',
    'https://neftit.com',
    NULL,
    true,
    5,
    NOW()
),
-- Quiz Task
(
    (SELECT id FROM projects LIMIT 1),
    'Complete NEFTIT Knowledge Quiz',
    'Test your knowledge about NEFTIT and blockchain technology.',
    'quiz',
    NULL,
    NULL,
    true,
    6,
    NOW()
)
ON CONFLICT DO NOTHING;

-- Update the quiz task with sample questions
UPDATE project_tasks 
SET quiz_questions = '[
    {
        "question": "What does NEFTIT stand for?",
        "options": ["NFT Trading Platform", "Blockchain Gaming", "Digital Collectibles", "Crypto Exchange"],
        "correct_answer": 0,
        "points": 10
    },
    {
        "question": "What blockchain does NEFTIT primarily use?",
        "options": ["Bitcoin", "Ethereum", "Polygon", "Solana"],
        "correct_answer": 2,
        "points": 10
    },
    {
        "question": "What can you earn by completing campaigns?",
        "options": ["NEFT Tokens", "XP Points", "NFT Rewards", "All of the above"],
        "correct_answer": 3,
        "points": 15
    }
]'::jsonb,
quiz_passing_score = 80
WHERE type = 'quiz' AND quiz_questions IS NULL;

-- Add sample Telegram channel ID for telegram tasks
UPDATE project_tasks 
SET telegram_channel_id = '@neftit_official'
WHERE type = 'telegram_join' AND telegram_channel_id IS NULL;

-- Add sample website URL for website visit tasks  
UPDATE project_tasks 
SET website_url = 'https://neftit.com'
WHERE type = 'visit_website' AND website_url IS NULL;

-- Add sample Twitter tweet ID for retweet tasks
UPDATE project_tasks 
SET twitter_tweet_id = '1234567890123456789'
WHERE type = 'twitter_retweet' AND twitter_tweet_id IS NULL;

-- Create a view for easy task type reporting
CREATE OR REPLACE VIEW campaign_task_summary AS
SELECT 
    type,
    COUNT(*) as task_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_tasks,
    AVG(sort_order) as avg_sort_order
FROM project_tasks 
GROUP BY type
ORDER BY task_count DESC;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON project_tasks TO authenticated;
GRANT SELECT ON campaign_task_summary TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Campaign task types migration completed successfully!';
    RAISE NOTICE 'Supported task types: twitter_follow, twitter_retweet, twitter_post, discord_join, discord_role, telegram_join, visit_website, quiz';
    RAISE NOTICE 'Legacy task types (twitter, discord, wallet, other) have been removed';
    RAISE NOTICE 'Added validation constraints and indexes for performance';
    RAISE NOTICE 'Created sample tasks for testing purposes';
END $$;
