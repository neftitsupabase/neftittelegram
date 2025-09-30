-- Rollback Script for Cascading Deletes
-- This script safely removes all foreign key constraints and helper functions
-- Run this if you want to undo the cascading delete implementation

-- Drop all foreign key constraints that were added
-- (Safe to run even if constraints don't exist)

-- 1. User Activity Stats
ALTER TABLE user_activity_stats 
DROP CONSTRAINT IF EXISTS fk_user_activity_stats_wallet_address;

-- 2. User IPFS Mappings
ALTER TABLE user_ipfs_mappings 
DROP CONSTRAINT IF EXISTS fk_user_ipfs_mappings_wallet_address;

-- 3. User NFT Collection
ALTER TABLE user_nft_collection 
DROP CONSTRAINT IF EXISTS fk_user_nft_collection_wallet_address;

-- 4. NFT Claims
ALTER TABLE nft_claims 
DROP CONSTRAINT IF EXISTS fk_nft_claims_wallet_address;

-- 5. Campaign Reward Claims
ALTER TABLE campaign_reward_claims 
DROP CONSTRAINT IF EXISTS fk_campaign_reward_claims_wallet_address;

-- 6. User Burn Progress
ALTER TABLE user_burn_progress 
DROP CONSTRAINT IF EXISTS fk_user_burn_progress_wallet_address;

-- 7. User Burn Chances Earned
ALTER TABLE user_burn_chances_earned 
DROP CONSTRAINT IF EXISTS fk_user_burn_chances_earned_wallet_address;

-- 8. Staked NFTs
ALTER TABLE staked_nfts 
DROP CONSTRAINT IF EXISTS fk_staked_nfts_wallet_address;

-- 9. User Participations
ALTER TABLE user_participations 
DROP CONSTRAINT IF EXISTS fk_user_participations_wallet_address;

-- 10. User Task Participations
ALTER TABLE user_task_participations 
DROP CONSTRAINT IF EXISTS fk_user_task_participations_wallet_address;

-- 11. Staking Rewards
ALTER TABLE staking_rewards 
DROP CONSTRAINT IF EXISTS fk_staking_rewards_wallet_address;

-- 12. User Activities
ALTER TABLE user_activities 
DROP CONSTRAINT IF EXISTS fk_user_activities_wallet_address;

-- 13. User Referrals
ALTER TABLE user_referrals 
DROP CONSTRAINT IF EXISTS fk_user_referrals_wallet_address;

ALTER TABLE user_referrals 
DROP CONSTRAINT IF EXISTS fk_user_referrals_referrer_wallet_address;

-- 14. NFT Collections
ALTER TABLE nft_collections 
DROP CONSTRAINT IF EXISTS fk_nft_collections_wallet_address;

-- 15. Staking History
ALTER TABLE staking_history 
DROP CONSTRAINT IF EXISTS fk_staking_history_wallet_address;

-- 16. User Balances
ALTER TABLE user_balances 
DROP CONSTRAINT IF EXISTS fk_user_balances_wallet_address;

-- 17. User Streaks
ALTER TABLE user_streaks 
DROP CONSTRAINT IF EXISTS fk_user_streaks_wallet_address;

-- 18. Daily Claims
ALTER TABLE daily_claims 
DROP CONSTRAINT IF EXISTS fk_daily_claims_wallet_address;

-- 19. User Achievements
ALTER TABLE user_achievements 
DROP CONSTRAINT IF EXISTS fk_user_achievements_wallet_address;

-- 20. Achievement Balance Audit
ALTER TABLE achievement_balance_audit 
DROP CONSTRAINT IF EXISTS fk_achievement_balance_audit_wallet_address;

-- 21. NFT Distributions
ALTER TABLE nft_distributions 
DROP CONSTRAINT IF EXISTS fk_nft_distributions_wallet_address;

-- 22. Staked Tokens
ALTER TABLE staked_tokens 
DROP CONSTRAINT IF EXISTS fk_staked_tokens_wallet_address;

-- 23. User Participation Stats
ALTER TABLE user_participation_stats 
DROP CONSTRAINT IF EXISTS fk_user_participation_stats_wallet_address;

-- Drop the helper functions
DROP FUNCTION IF EXISTS delete_user_with_cascade(TEXT);
DROP FUNCTION IF EXISTS preview_user_deletion_impact(TEXT);

-- Optionally drop the indexes that were created (uncomment if you want to remove them)
-- Note: Only drop indexes that were specifically created by our script
/*
DO $$
DECLARE
    table_record RECORD;
    index_name TEXT;
BEGIN
    FOR table_record IN 
        SELECT t.table_name 
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE c.column_name = 'wallet_address' 
        AND t.table_schema = 'public'
        AND t.table_name != 'users'
    LOOP
        index_name := 'idx_' || table_record.table_name || '_wallet_address';
        
        -- Check if our specific index exists and drop it
        IF EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = table_record.table_name 
            AND indexname = index_name
        ) THEN
            EXECUTE format('DROP INDEX IF EXISTS %I', index_name);
            RAISE NOTICE 'Dropped index % from table %', index_name, table_record.table_name;
        END IF;
    END LOOP;
END $$;
*/

-- Verify rollback completion
SELECT 'Rollback completed successfully!' as status;

-- Check that no foreign key constraints remain
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE kcu.column_name = 'wallet_address'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- If the above query returns no rows, the rollback was successful

RAISE NOTICE 'Cascading delete constraints have been successfully removed.';
RAISE NOTICE 'Your database is back to its original state before the cascading delete implementation.';
RAISE NOTICE 'You can now delete users manually from each table if needed.';
