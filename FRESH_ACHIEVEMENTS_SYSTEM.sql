-- ============================================================================
-- FRESH ACHIEVEMENTS SYSTEM - Based on User Requirements
-- ============================================================================
-- All new achievements with minimal egress design
-- Checks existing user activity without complex triggers
-- ============================================================================

-- Step 1: Drop old achievement system
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS achievements_master CASCADE;
DROP TYPE IF EXISTS achievement_category CASCADE;
DROP TYPE IF EXISTS achievement_status CASCADE;

-- Step 2: Create simple enums
CREATE TYPE achievement_category AS ENUM ('quest', 'burn', 'referral', 'checkin', 'staking');
CREATE TYPE achievement_status AS ENUM ('locked', 'in_progress', 'completed', 'claimed');

-- Step 3: Create simple achievements master table
CREATE TABLE achievements_master (
  achievement_key VARCHAR(50) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  category achievement_category NOT NULL,
  icon VARCHAR(20) DEFAULT '🏆',
  neft_reward INTEGER DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  required_count INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Step 4: Create simple user progress tracking
CREATE TABLE user_achievement_progress (
  wallet_address TEXT NOT NULL,
  achievement_key VARCHAR(50) NOT NULL,
  current_progress INTEGER DEFAULT 0,
  status achievement_status DEFAULT 'locked',
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (wallet_address, achievement_key),
  FOREIGN KEY (achievement_key) REFERENCES achievements_master(achievement_key)
);

-- Step 5: Insert all achievements based on user requirements
INSERT INTO achievements_master (achievement_key, title, description, category, icon, neft_reward, xp_reward, required_count, sort_order) VALUES

-- QUEST ACHIEVEMENTS
('first_quest', 'First Quest', 'Complete your first campaign', 'quest', '🎯', 5, 5, 1, 1),
('quest_legend', 'Quest Legend', 'Complete 10 campaigns', 'quest', '⭐', 70, 70, 10, 2),
('quest_master', 'Quest Master', 'Complete 25 campaigns', 'quest', '👑', 150, 150, 25, 3),

-- NFT BURNING ACHIEVEMENTS
('first_burn', 'First Burn', 'Burn NFTs first time', 'burn', '🔥', 5, 5, 1, 10),
('burn_enthusiast', 'Burn Enthusiast', 'Burn 25 NFTs', 'burn', '🌋', 50, 50, 25, 11),
('burn_master', 'Burn Master', 'Burn 100 NFTs', 'burn', '💥', 200, 200, 100, 12),

-- REFERRAL ACHIEVEMENTS
('first_referral', 'First Referral', 'Refer your first friend', 'referral', '🤝', 5, 5, 1, 20),
('referral_pro', 'Referral Pro', 'Refer 10 friends', 'referral', '👥', 30, 30, 10, 21),
('referral_master', 'Referral Master', 'Refer 30 friends', 'referral', '🌟', 100, 100, 30, 22),

-- CHECK-IN ACHIEVEMENTS
('checkin_starter', 'Check-in Starter', 'Check in for 2 days', 'checkin', '📅', 5, 5, 2, 30),
('checkin_regular', 'Regular Visitor', 'Check in for 10 days', 'checkin', '📈', 30, 30, 10, 31),
('checkin_dedicated', 'Dedicated User', 'Check in for 30 days', 'checkin', '🏅', 100, 100, 30, 32),

-- STAKING ACHIEVEMENTS - NFT Staking
('first_nft_stake', 'First NFT Stake', 'Stake one NFT', 'staking', '🔒', 5, 5, 1, 40),
('nft_staking_pro', 'NFT Staking Pro', 'Stake 10 NFTs', 'staking', '📦', 30, 30, 10, 41),
('nft_staking_master', 'NFT Staking Master', 'Stake 30 NFTs', 'staking', '💎', 100, 100, 30, 42),

-- STAKING ACHIEVEMENTS - NEFT Token Staking
('first_neft_stake', 'First NEFT Stake', 'Stake 50 NEFT points', 'staking', '💰', 5, 5, 50, 43),
('neft_staking_pro', 'NEFT Staking Pro', 'Stake 500 NEFT points', 'staking', '💵', 30, 30, 500, 44),
('neft_staking_master', 'NEFT Staking Master', 'Stake 2000 NEFT points', 'staking', '💸', 100, 100, 2000, 45);

-- Step 6: Create ultra-low egress function to check ALL achievements at once
CREATE OR REPLACE FUNCTION get_user_achievement_status(user_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Get all user stats in ONE query to minimize egress
  WITH user_stats AS (
    SELECT 
      user_wallet as wallet_address,
      
      -- Campaign completions (from existing campaign system)
      COALESCE((
        SELECT COUNT(DISTINCT p.id) 
        FROM projects p 
        WHERE EXISTS (
          SELECT 1 FROM campaign_reward_claims crc 
          WHERE crc.wallet_address = user_wallet 
          AND crc.project_id = p.id::text
        )
      ), 0) as campaigns_completed,
      
      -- NFT burns (you'll need to add burn tracking table or use existing)
      COALESCE((
        SELECT COUNT(*) 
        FROM nft_burns nb 
        WHERE nb.wallet_address = user_wallet
      ), 0) as nfts_burned,
      
      -- Referrals (from existing referral system)
      COALESCE((
        SELECT COUNT(*) 
        FROM referrals r 
        WHERE r.referrer_address = user_wallet 
        AND r.status = 'completed'
      ), 0) as referrals_count,
      
      -- Daily claims (from user_streaks total_claims)
      COALESCE((
        SELECT total_claims 
        FROM user_streaks us 
        WHERE us.wallet_address = user_wallet
      ), 0) as daily_claims_count,
      
      -- NFT staking count (from staked_tokens)
      COALESCE((
        SELECT COUNT(*) 
        FROM staked_tokens st 
        WHERE st.wallet_address = user_wallet
      ), 0) as nfts_staked_count,
      
      -- Current NEFT staking amount (from user_balances)
      COALESCE((
        SELECT staked_neft 
        FROM user_balances ub 
        WHERE ub.wallet_address = user_wallet
      ), 0) as current_neft_staked
  ),
  
  achievement_progress AS (
    SELECT 
      am.achievement_key,
      am.title,
      am.description,
      am.category::text,
      am.icon,
      am.neft_reward,
      am.xp_reward,
      am.required_count,
      am.sort_order,
      
      -- Calculate current progress based on achievement type
      CASE 
        -- Quest achievements
        WHEN am.achievement_key IN ('first_quest', 'quest_legend', 'quest_master') 
        THEN LEAST(us.campaigns_completed, am.required_count)
        
        -- Burn achievements
        WHEN am.achievement_key IN ('first_burn', 'burn_enthusiast', 'burn_master') 
        THEN LEAST(us.nfts_burned, am.required_count)
        
        -- Referral achievements
        WHEN am.achievement_key IN ('first_referral', 'referral_pro', 'referral_master') 
        THEN LEAST(us.referrals_count, am.required_count)
        
        -- Check-in achievements
        WHEN am.achievement_key IN ('checkin_starter', 'checkin_regular', 'checkin_dedicated') 
        THEN LEAST(us.daily_claims_count, am.required_count)
        
        -- NFT staking achievements
        WHEN am.achievement_key IN ('first_nft_stake', 'nft_staking_pro', 'nft_staking_master') 
        THEN LEAST(us.nfts_staked_count, am.required_count)
        
        -- NEFT staking achievements (current staked amount)
        WHEN am.achievement_key IN ('first_neft_stake', 'neft_staking_pro', 'neft_staking_master') 
        THEN CASE WHEN us.current_neft_staked >= am.required_count THEN am.required_count ELSE 0 END
        
        ELSE 0
      END as current_progress,
      
      -- Calculate status
      CASE 
        WHEN uap.claimed_at IS NOT NULL THEN 'claimed'
        WHEN (
          CASE 
            WHEN am.achievement_key IN ('first_quest', 'quest_legend', 'quest_master') 
            THEN us.campaigns_completed >= am.required_count
            
            WHEN am.achievement_key IN ('first_burn', 'burn_enthusiast', 'burn_master') 
            THEN us.nfts_burned >= am.required_count
            
            WHEN am.achievement_key IN ('first_referral', 'referral_pro', 'referral_master') 
            THEN us.referrals_count >= am.required_count
            
            WHEN am.achievement_key IN ('checkin_starter', 'checkin_regular', 'checkin_dedicated') 
            THEN us.daily_claims_count >= am.required_count
            
            WHEN am.achievement_key IN ('first_nft_stake', 'nft_staking_pro', 'nft_staking_master') 
            THEN us.nfts_staked_count >= am.required_count
            
            WHEN am.achievement_key IN ('first_neft_stake', 'neft_staking_pro', 'neft_staking_master') 
            THEN us.current_neft_staked >= am.required_count
            
            ELSE FALSE
          END
        ) THEN 'completed'
        WHEN (
          CASE 
            WHEN am.achievement_key IN ('first_quest', 'quest_legend', 'quest_master') 
            THEN us.campaigns_completed > 0
            
            WHEN am.achievement_key IN ('first_burn', 'burn_enthusiast', 'burn_master') 
            THEN us.nfts_burned > 0
            
            WHEN am.achievement_key IN ('first_referral', 'referral_pro', 'referral_master') 
            THEN us.referrals_count > 0
            
            WHEN am.achievement_key IN ('checkin_starter', 'checkin_regular', 'checkin_dedicated') 
            THEN us.daily_claims_count > 0
            
            WHEN am.achievement_key IN ('first_nft_stake', 'nft_staking_pro', 'nft_staking_master') 
            THEN us.nfts_staked_count > 0
            
            WHEN am.achievement_key IN ('first_neft_stake', 'neft_staking_pro', 'neft_staking_master') 
            THEN us.current_neft_staked > 0
            
            ELSE FALSE
          END
        ) THEN 'in_progress'
        ELSE 'locked'
      END as status,
      
      uap.claimed_at,
      
      -- Calculate progress percentage
      CASE 
        WHEN am.required_count > 0 THEN 
          ROUND((
            CASE 
              WHEN am.achievement_key IN ('first_quest', 'quest_legend', 'quest_master') 
              THEN LEAST(us.campaigns_completed, am.required_count)
              
              WHEN am.achievement_key IN ('first_burn', 'burn_enthusiast', 'burn_master') 
              THEN LEAST(us.nfts_burned, am.required_count)
              
              WHEN am.achievement_key IN ('first_referral', 'referral_pro', 'referral_master') 
              THEN LEAST(us.referrals_count, am.required_count)
              
              WHEN am.achievement_key IN ('checkin_starter', 'checkin_regular', 'checkin_dedicated') 
              THEN LEAST(us.daily_claims_count, am.required_count)
              
              WHEN am.achievement_key IN ('first_nft_stake', 'nft_staking_pro', 'nft_staking_master') 
              THEN LEAST(us.nfts_staked_count, am.required_count)
              
              WHEN am.achievement_key IN ('first_neft_stake', 'neft_staking_pro', 'neft_staking_master') 
              THEN CASE WHEN us.current_neft_staked >= am.required_count THEN am.required_count ELSE 0 END
              
              ELSE 0
            END::DECIMAL / am.required_count::DECIMAL
          ) * 100, 2)
        ELSE 0 
      END as progress_percentage
      
    FROM achievements_master am
    CROSS JOIN user_stats us
    LEFT JOIN user_achievement_progress uap ON am.achievement_key = uap.achievement_key 
      AND uap.wallet_address = user_wallet
    WHERE am.is_active = TRUE
  )
  
  SELECT json_agg(
    json_build_object(
      'achievement_key', achievement_key,
      'title', title,
      'description', description,
      'category', category,
      'icon', icon,
      'neft_reward', neft_reward,
      'xp_reward', xp_reward,
      'required_count', required_count,
      'current_progress', current_progress,
      'status', status,
      'claimed_at', claimed_at,
      'progress_percentage', progress_percentage,
      'sort_order', sort_order
    ) ORDER BY sort_order
  ) INTO result
  FROM achievement_progress;
  
  RETURN COALESCE(result, '[]'::json);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', true,
      'message', 'Error getting achievements: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create simple claim function
CREATE OR REPLACE FUNCTION claim_achievement(user_wallet TEXT, achievement_key_param TEXT)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  is_completed BOOLEAN := FALSE;
BEGIN
  -- Check if achievement is completed
  SELECT 
    am.neft_reward,
    am.xp_reward,
    am.title,
    (
      CASE 
        WHEN uap.claimed_at IS NOT NULL THEN FALSE -- Already claimed
        ELSE (
          CASE 
            WHEN am.achievement_key IN ('first_quest', 'quest_legend', 'quest_master') THEN
              COALESCE((
                SELECT COUNT(DISTINCT p.id) 
                FROM projects p 
                WHERE EXISTS (
                  SELECT 1 FROM campaign_reward_claims crc 
                  WHERE crc.wallet_address = user_wallet 
                  AND crc.project_id = p.id::text
                )
              ), 0) >= am.required_count
            
            WHEN am.achievement_key IN ('first_burn', 'burn_enthusiast', 'burn_master') THEN
              COALESCE((
                SELECT COUNT(*) 
                FROM nft_burns nb 
                WHERE nb.wallet_address = user_wallet
              ), 0) >= am.required_count
            
            WHEN am.achievement_key IN ('first_referral', 'referral_pro', 'referral_master') THEN
              COALESCE((
                SELECT COUNT(*) 
                FROM referrals r 
                WHERE r.referrer_address = user_wallet 
                AND r.status = 'completed'
              ), 0) >= am.required_count
            
            WHEN am.achievement_key IN ('checkin_starter', 'checkin_regular', 'checkin_dedicated') THEN
              COALESCE((
                SELECT total_claims 
                FROM user_streaks us 
                WHERE us.wallet_address = user_wallet
              ), 0) >= am.required_count
            
            WHEN am.achievement_key IN ('first_nft_stake', 'nft_staking_pro', 'nft_staking_master') THEN
              COALESCE((
                SELECT COUNT(*) 
                FROM staked_tokens st 
                WHERE st.wallet_address = user_wallet
              ), 0) >= am.required_count
            
            WHEN am.achievement_key IN ('first_neft_stake', 'neft_staking_pro', 'neft_staking_master') THEN
              COALESCE((
                SELECT staked_neft 
                FROM user_balances ub 
                WHERE ub.wallet_address = user_wallet
              ), 0) >= am.required_count
            
            ELSE FALSE
          END
        )
      END
    ) as is_completed
  INTO achievement_record
  FROM achievements_master am
  LEFT JOIN user_achievement_progress uap ON am.achievement_key = uap.achievement_key 
    AND uap.wallet_address = user_wallet
  WHERE am.achievement_key = achievement_key_param 
    AND am.is_active = TRUE;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement not found'
    );
  END IF;
  
  IF NOT achievement_record.is_completed THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Achievement not completed yet'
    );
  END IF;
  
  -- Mark as claimed
  INSERT INTO user_achievement_progress (wallet_address, achievement_key, status, claimed_at)
  VALUES (user_wallet, achievement_key_param, 'claimed', NOW())
  ON CONFLICT (wallet_address, achievement_key) 
  DO UPDATE SET 
    status = 'claimed',
    claimed_at = NOW(),
    updated_at = NOW();
  
  -- Add rewards to user balance
  INSERT INTO user_balances (wallet_address, total_neft_claimed, total_xp_earned, available_neft, last_updated)
  VALUES (user_wallet, achievement_record.neft_reward, achievement_record.xp_reward, achievement_record.neft_reward, NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET
    total_neft_claimed = user_balances.total_neft_claimed + achievement_record.neft_reward,
    total_xp_earned = user_balances.total_xp_earned + achievement_record.xp_reward,
    available_neft = user_balances.available_neft + achievement_record.neft_reward,
    last_updated = NOW();
  
  RETURN json_build_object(
    'success', true,
    'message', 'Achievement claimed successfully!',
    'neft_reward', achievement_record.neft_reward,
    'xp_reward', achievement_record.xp_reward,
    'title', achievement_record.title
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error claiming achievement: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Grant permissions
GRANT EXECUTE ON FUNCTION get_user_achievement_status(TEXT) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION claim_achievement(TEXT, TEXT) TO authenticated, anon, public;

-- Step 9: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_achievement_progress_wallet ON user_achievement_progress(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_achievement_progress_status ON user_achievement_progress(status);
CREATE INDEX IF NOT EXISTS idx_achievements_master_category ON achievements_master(category);

SELECT 'FRESH ACHIEVEMENTS SYSTEM DEPLOYED SUCCESSFULLY!' as status;
SELECT 
  category,
  COUNT(*) as achievement_count,
  SUM(neft_reward) as total_neft_rewards,
  SUM(xp_reward) as total_xp_rewards
FROM achievements_master 
WHERE is_active = true 
GROUP BY category 
ORDER BY category;
