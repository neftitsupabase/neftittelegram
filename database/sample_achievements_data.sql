-- ============================================================================
-- SAMPLE ACHIEVEMENTS DATA - COMPLETE ACHIEVEMENT DEFINITIONS
-- Creates all achievement categories with proper rewards and requirements
-- ============================================================================

-- Clear existing data safely (handle foreign key constraints)
-- First delete user achievements that reference the master achievements
DELETE FROM user_achievements WHERE achievement_key IN (
  SELECT achievement_key FROM achievements_master
);

-- Then delete the master achievements
DELETE FROM achievements_master WHERE 1=1;

-- Insert comprehensive achievement definitions
INSERT INTO achievements_master (
  achievement_key, 
  title, 
  description, 
  category, 
  icon, 
  color, 
  neft_reward, 
  xp_reward, 
  required_count, 
  is_active
) VALUES 

-- QUEST ACHIEVEMENTS
('first_quest', 'First Quest', 'Complete your first campaign task', 'quest', '🏆', '#FFD700', 100, 50, 1, true),
('quest_master', 'Quest Master', 'Complete 10 different projects', 'quest', '⭐', '#FF6B35', 500, 250, 10, true),
('quest_legend', 'Quest Legend', 'Complete 50 different projects', 'quest', '👑', '#8A2BE2', 2000, 1000, 50, true),

-- BURN ACHIEVEMENTS  
('first_burn', 'First Burn', 'Burn your first NFT to upgrade it', 'burn', '🔥', '#FF4500', 150, 75, 1, true),
('burn_enthusiast', 'Burn Enthusiast', 'Burn 25 NFTs total', 'burn', '🌋', '#DC143C', 750, 375, 25, true),
('burn_master', 'Burn Master', 'Burn 100 NFTs total', 'burn', '🔥', '#B22222', 3000, 1500, 100, true),

-- SOCIAL ACHIEVEMENTS
('social_starter', 'Social Starter', 'Share NEFTIT on social media', 'social', '📢', '#1DA1F2', 100, 50, 1, true),

-- REFERRAL ACHIEVEMENTS  
('first_referral', 'First Referral', 'Refer your first friend to NEFTIT', 'referral', '🎉', '#32CD32', 250, 125, 1, true),
('referral_champion', 'Referral Champion', 'Refer 10 friends to NEFTIT', 'referral', '👑', '#FFD700', 1500, 750, 10, true),

-- CHECK-IN ACHIEVEMENTS
('daily_visitor', 'Daily Visitor', 'Claim daily rewards for 7 consecutive days', 'checkin', '📅', '#4169E1', 300, 150, 1, true),
('dedicated_user', 'Dedicated User', 'Claim daily rewards for 30 consecutive days', 'checkin', '🏅', '#FF1493', 1500, 750, 1, true),

-- STAKING ACHIEVEMENTS
('first_stake', 'First Stake', 'Stake your first NFT or tokens', 'staking', '🔒', '#9370DB', 200, 100, 1, true),
('staking_pro', 'Staking Pro', 'Stake 10 times total', 'staking', '🏆', '#DAA520', 1000, 500, 10, true),

-- CAMPAIGN ACHIEVEMENTS
('campaign_participant', 'Campaign Participant', 'Participate in your first campaign', 'campaign', '🚩', '#FF69B4', 250, 125, 1, true),
('campaign_champion', 'Campaign Champion', 'Win 5 campaigns', 'campaign', '🏆', '#FFD700', 2500, 1250, 5, true);

-- Verify data insertion
SELECT 'SAMPLE ACHIEVEMENTS DATA INSERTED SUCCESSFULLY!' as status;
SELECT 
  category,
  COUNT(*) as achievement_count,
  SUM(neft_reward) as total_neft_rewards,
  SUM(xp_reward) as total_xp_rewards
FROM achievements_master 
WHERE is_active = true 
GROUP BY category 
ORDER BY category;

SELECT 'Achievement Categories:' as info;
SELECT DISTINCT category FROM achievements_master WHERE is_active = true ORDER BY category;
