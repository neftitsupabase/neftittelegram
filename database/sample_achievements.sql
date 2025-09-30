-- Sample Achievement Data for Testing
-- Insert sample achievements into the achievements_master table

INSERT INTO achievements_master (
  achievement_key,
  title,
  description,
  category,
  icon,
  color,
  neft_reward,
  xp_reward,
  nft_reward,
  required_count,
  sort_order
) VALUES 
-- Quest Achievements
('first_quest', 'First Quest', 'Complete your first quest in the platform', 'quest', 'trophy', 'from-blue-600 to-blue-400', 10.0, 100, NULL, 1, 1),
('quest_master', 'Quest Master', 'Complete 10 quests to become a master', 'quest', 'crown', 'from-purple-600 to-purple-400', 50.0, 500, 'Bronze Quest NFT', 10, 2),
('quest_legend', 'Quest Legend', 'Complete 50 quests to achieve legendary status', 'quest', 'star', 'from-gold-600 to-gold-400', 200.0, 2000, 'Gold Quest NFT', 50, 3),

-- Burn Achievements
('first_burn', 'First Burn', 'Burn your first NFT to upgrade it', 'burn', 'flame', 'from-red-600 to-red-400', 15.0, 150, NULL, 1, 4),
('burn_collector', 'Burn Collector', 'Burn 5 NFTs to collect rare upgrades', 'burn', 'fire', 'from-orange-600 to-orange-400', 75.0, 750, 'Burn Master NFT', 5, 5),
('burn_master', 'Burn Master', 'Burn 25 NFTs to master the art of upgrading', 'burn', 'volcano', 'from-red-800 to-red-600', 300.0, 3000, 'Legendary Burn NFT', 25, 6),

-- Social Achievements
('social_butterfly', 'Social Butterfly', 'Connect your social media accounts', 'social', 'users', 'from-pink-600 to-pink-400', 20.0, 200, NULL, 3, 7),
('influencer', 'Influencer', 'Share 10 posts about your achievements', 'social', 'megaphone', 'from-purple-500 to-pink-500', 100.0, 1000, 'Social NFT', 10, 8),

-- Referral Achievements
('first_referral', 'First Referral', 'Refer your first friend to the platform', 'referral', 'user-plus', 'from-green-600 to-green-400', 25.0, 250, NULL, 1, 9),
('referral_champion', 'Referral Champion', 'Refer 10 friends to become a champion', 'referral', 'users-2', 'from-emerald-600 to-emerald-400', 150.0, 1500, 'Referral NFT', 10, 10),

-- Check-in Achievements
('daily_visitor', 'Daily Visitor', 'Check in for 7 consecutive days', 'checkin', 'calendar-check', 'from-blue-500 to-cyan-500', 30.0, 300, NULL, 7, 11),
('weekly_warrior', 'Weekly Warrior', 'Check in for 30 consecutive days', 'checkin', 'calendar', 'from-indigo-600 to-indigo-400', 100.0, 1000, 'Loyalty NFT', 30, 12),
('monthly_master', 'Monthly Master', 'Check in for 100 consecutive days', 'checkin', 'calendar-days', 'from-violet-600 to-violet-400', 500.0, 5000, 'Dedication NFT', 100, 13),

-- Staking Achievements
('first_stake', 'First Stake', 'Stake your first tokens', 'staking', 'coins', 'from-yellow-600 to-yellow-400', 20.0, 200, NULL, 1, 14),
('staking_pro', 'Staking Pro', 'Maintain a stake for 30 days', 'staking', 'piggy-bank', 'from-amber-600 to-amber-400', 100.0, 1000, 'Staking NFT', 30, 15),

-- Campaign Achievements
('campaign_participant', 'Campaign Participant', 'Participate in your first campaign', 'campaign', 'flag', 'from-teal-600 to-teal-400', 15.0, 150, NULL, 1, 16),
('campaign_winner', 'Campaign Winner', 'Win 3 campaigns', 'campaign', 'trophy', 'from-gold-500 to-yellow-500', 200.0, 2000, 'Victory NFT', 3, 17)

ON CONFLICT (achievement_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  neft_reward = EXCLUDED.neft_reward,
  xp_reward = EXCLUDED.xp_reward,
  nft_reward = EXCLUDED.nft_reward,
  required_count = EXCLUDED.required_count,
  sort_order = EXCLUDED.sort_order;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_achievements_master_category ON achievements_master(category);
CREATE INDEX IF NOT EXISTS idx_achievements_master_active ON achievements_master(is_active);
CREATE INDEX IF NOT EXISTS idx_achievements_master_sort ON achievements_master(sort_order);

CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet ON user_achievements(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_achievements_status ON user_achievements(status);
CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet_key ON user_achievements(wallet_address, achievement_key);
