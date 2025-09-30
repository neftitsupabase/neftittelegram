-- Fix NEFTIT Project Twitter Tasks
-- Project ID: 441faa21-27a3-465c-a05b-bfd94d0259bc

-- First, let's check what tasks currently exist
SELECT id, title, type, action_url, is_active FROM project_tasks 
WHERE project_id = '441faa21-27a3-465c-a05b-bfd94d0259bc';

-- Remove any existing broken Twitter tasks
DELETE FROM project_tasks 
WHERE project_id = '441faa21-27a3-465c-a05b-bfd94d0259bc' 
AND type IN ('twitter_retweet', 'twitter_post');

-- Insert working Twitter tasks

-- 1. Twitter Retweet Task (using a working tweet URL)
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
    'Help spread the word about NEFTIT by retweeting our campaign launch announcement!',
    'twitter_retweet',
    'https://x.com/neftitxyz/status/1741073654564564992', -- Using a working tweet URL
    'neftitxyz',
    '1741073654564564992',
    true,
    1
);

-- 2. Twitter Post Task
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
    'Share your thoughts about NEFTIT and include "join neftit" in your tweet!',
    'twitter_post',
    'https://twitter.com/intent/tweet?text=Just%20discovered%20@neftitxyz%20-%20amazing%20NFT%20platform!%20Join%20neftit%20community%20now!%20🚀%20#NEFTIT%20#NFTs%20#Blockchain',
    'neftitxyz',
    true,
    2
);

-- 3. Twitter Follow Task
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

-- Verify the tasks were created
SELECT id, title, type, action_url, is_active, sort_order 
FROM project_tasks 
WHERE project_id = '441faa21-27a3-465c-a05b-bfd94d0259bc' 
ORDER BY sort_order;

-- Update the project to ensure it has the correct task count
UPDATE projects 
SET current_participants = (
    SELECT COUNT(DISTINCT wallet_address) 
    FROM user_project_participations 
    WHERE project_id = '441faa21-27a3-465c-a05b-bfd94d0259bc'
)
WHERE id = '441faa21-27a3-465c-a05b-bfd94d0259bc';

-- Show final project status
SELECT 
    p.title,
    p.current_participants,
    p.max_participants,
    COUNT(pt.id) as task_count
FROM projects p
LEFT JOIN project_tasks pt ON p.id = pt.project_id AND pt.is_active = true
WHERE p.id = '441faa21-27a3-465c-a05b-bfd94d0259bc'
GROUP BY p.id, p.title, p.current_participants, p.max_participants;
