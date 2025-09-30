-- Sample Project Tasks for NEFTIT Campaign System
-- Replace 'YOUR_PROJECT_ID_HERE' with actual project UUID

-- 1. Twitter Follow Task
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
    'Follow @NEFTIT on Twitter',
    'Follow our official Twitter account to stay updated with the latest news and announcements.',
    'twitter_follow',
    'https://twitter.com/NEFTIT',
    'NEFTIT',
    true,
    1
);

-- 2. Twitter Retweet Task
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
    'Help us spread the word by retweeting our campaign launch announcement.',
    'twitter_retweet',
    'https://twitter.com/NEFTIT/status/1234567890',
    'NEFTIT',
    '1234567890123456789',
    true,
    2
);

-- 3. Twitter Post Task
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
    'Share your thoughts about NEFTIT and tag us in your tweet.',
    'twitter_post',
    'https://twitter.com/intent/tweet?text=Just%20discovered%20@NEFTIT%20-%20amazing%20NFT%20platform!',
    'NEFTIT',
    true,
    3
);

-- 4. Discord Join Task
INSERT INTO project_tasks (
    project_id, 
    title, 
    description, 
    type, 
    action_url, 
    discord_guild_id,
    is_active, 
    sort_order
) VALUES (
    '441faa21-27a3-465c-a05b-bfd94d0259bc',
    'Join NEFTIT Discord',
    'Join our Discord community to connect with other users and get support.',
    'discord_join',
    'https://discord.gg/neftit',
    '123456789012345678',
    true,
    4
);

-- 5. Discord Role Task
INSERT INTO project_tasks (
    project_id, 
    title, 
    description, 
    type, 
    action_url, 
    discord_guild_id,
    required_role_id,
    is_active, 
    sort_order
) VALUES (
    '441faa21-27a3-465c-a05b-bfd94d0259bc',
    'Get Verified Role in Discord',
    'Complete verification in our Discord server to get the verified member role.',
    'discord_role',
    'https://discord.gg/neftit',
    '123456789012345678',
    '987654321098765432',
    true,
    5
);

-- 6. Telegram Join Task
INSERT INTO project_tasks (
    project_id, 
    title, 
    description, 
    type, 
    action_url, 
    telegram_channel_id,
    is_active, 
    sort_order
) VALUES (
    '441faa21-27a3-465c-a05b-bfd94d0259bc',
    'Join NEFTIT Telegram',
    'Join our Telegram channel for real-time updates and community discussions.',
    'telegram_join',
    'https://t.me/neftit_official',
    '@neftit_official',
    true,
    6
);

-- 7. Visit Website Task
INSERT INTO project_tasks (
    project_id, 
    title, 
    description, 
    type, 
    action_url, 
    website_url,
    is_active, 
    sort_order
) VALUES (
    '441faa21-27a3-465c-a05b-bfd94d0259bc',
    'Visit NEFTIT Website',
    'Explore our official website to learn more about the platform and features.',
    'visit_website',
    'https://neftit.com',
    'https://neftit.com',
    true,
    7
);

-- 8. Quiz Task
INSERT INTO project_tasks (
    project_id, 
    title, 
    description, 
    type, 
    quiz_questions,
    quiz_passing_score,
    is_active, 
    sort_order
) VALUES (
    '441faa21-27a3-465c-a05b-bfd94d0259bc',
    'Complete NEFTIT Knowledge Quiz',
    'Test your knowledge about NEFTIT and blockchain technology to earn rewards.',
    'quiz',
    '[
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
        },
        {
            "question": "How do you stake tokens on NEFTIT?",
            "options": ["Through MetaMask", "On the Staking page", "Via Discord bot", "Email support"],
            "correct_answer": 1,
            "points": 10
        },
        {
            "question": "What happens when you burn NFTs?",
            "options": ["They are deleted", "You get refund", "You can upgrade rarity", "Nothing happens"],
            "correct_answer": 2,
            "points": 15
        }
    ]'::jsonb,
    80,
    true,
    8
);

-- Additional Social Media Tasks



-- Query to get a project ID (run this first to get actual project ID)
-- SELECT id, title FROM projects WHERE is_active = true LIMIT 1;

-- Query to verify tasks were inserted correctly
-- SELECT id, title, type, is_active, sort_order FROM project_tasks WHERE project_id = 'YOUR_PROJECT_ID_HERE' ORDER BY sort_order;
