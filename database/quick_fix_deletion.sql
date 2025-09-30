-- Quick Fix for User Deletion Issues
-- Run this to immediately fix deletion problems

-- Step 1: Check if the cascading delete constraints were actually applied
SELECT 
    'Current Foreign Key Constraints:' as info,
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'wallet_address'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Step 2: Force apply cascading deletes if they're missing
-- This handles cases where the previous script might have failed partially

DO $$
DECLARE
    table_record RECORD;
    constraint_exists BOOLEAN;
    orphaned_count BIGINT;
BEGIN
    FOR table_record IN 
        SELECT t.table_name 
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE c.column_name = 'wallet_address' 
        AND t.table_schema = 'public'
        AND t.table_name != 'users'
    LOOP
        -- First, clean up orphaned records (records with wallet_address not in users table)
        EXECUTE format('
            DELETE FROM %I 
            WHERE wallet_address NOT IN (SELECT wallet_address FROM users WHERE wallet_address IS NOT NULL)
        ', table_record.table_name);
        
        GET DIAGNOSTICS orphaned_count = ROW_COUNT;
        IF orphaned_count > 0 THEN
            RAISE NOTICE 'Cleaned up % orphaned records from table: %', orphaned_count, table_record.table_name;
        END IF;
        
        -- Check if CASCADE constraint exists
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            JOIN information_schema.referential_constraints rc 
                ON tc.constraint_name = rc.constraint_name
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = table_record.table_name
                AND kcu.column_name = 'wallet_address'
                AND rc.delete_rule = 'CASCADE'
        ) INTO constraint_exists;
        
        IF NOT constraint_exists THEN
            -- Drop any existing non-cascade constraint
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS fk_%I_wallet_address', 
                          table_record.table_name, table_record.table_name);
            
            -- Add CASCADE constraint (this should now work since orphaned records are cleaned)
            BEGIN
                EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%I_wallet_address FOREIGN KEY (wallet_address) REFERENCES users(wallet_address) ON DELETE CASCADE', 
                              table_record.table_name, table_record.table_name);
                
                RAISE NOTICE 'Added CASCADE constraint to table: %', table_record.table_name;
            EXCEPTION
                WHEN foreign_key_violation THEN
                    RAISE NOTICE 'Skipping CASCADE constraint for table % - still has orphaned data', table_record.table_name;
            END;
        END IF;
    END LOOP;
END $$;

-- Step 3: Create emergency delete function that handles proper deletion order
CREATE OR REPLACE FUNCTION emergency_delete_user(target_wallet_address TEXT)
RETURNS TEXT AS $$
DECLARE
    total_deleted BIGINT := 0;
    table_deleted BIGINT;
    table_exists BOOLEAN;
BEGIN
    -- Delete in proper dependency order to avoid foreign key violations
    
    -- Helper function to check if table exists and has wallet_address column
    CREATE OR REPLACE FUNCTION table_has_wallet_column(table_name TEXT)
    RETURNS BOOLEAN AS $inner$
    BEGIN
        RETURN EXISTS (
            SELECT 1 
            FROM information_schema.tables t
            JOIN information_schema.columns c ON t.table_name = c.table_name
            WHERE t.table_name = table_has_wallet_column.table_name
            AND c.column_name = 'wallet_address'
            AND t.table_schema = 'public'
        );
    END;
    $inner$ LANGUAGE plpgsql;
    
    -- Level 1: Delete from referral_rewards first (it references user_referrals)
    IF table_has_wallet_column('referral_rewards') THEN
        BEGIN
            DELETE FROM referral_rewards WHERE referrer_wallet = target_wallet_address;
            GET DIAGNOSTICS table_deleted = ROW_COUNT;
            total_deleted := total_deleted + table_deleted;
            IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from referral_rewards (referrer_wallet)', table_deleted; END IF;
        EXCEPTION
            WHEN undefined_column THEN
                -- Try wallet_address column
                BEGIN
                    DELETE FROM referral_rewards WHERE wallet_address = target_wallet_address;
                    GET DIAGNOSTICS table_deleted = ROW_COUNT;
                    total_deleted := total_deleted + table_deleted;
                    IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from referral_rewards (wallet_address)', table_deleted; END IF;
                EXCEPTION
                    WHEN undefined_column THEN
                        RAISE NOTICE 'Skipping referral_rewards - no matching column found';
                END;
        END;
    ELSE
        RAISE NOTICE 'Skipping referral_rewards - table does not exist';
    END IF;
    
    -- Level 2: Delete from tables that depend on user_referrals
    IF table_has_wallet_column('user_referrals') THEN
        DELETE FROM user_referrals WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_referrals', table_deleted; END IF;
    ELSE
        RAISE NOTICE 'Skipping user_referrals - table does not exist';
    END IF;
    
    -- Level 3: Delete from all other child tables (only if they exist)
    IF table_has_wallet_column('user_activity_stats') THEN
        DELETE FROM user_activity_stats WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_activity_stats', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_ipfs_mappings') THEN
        DELETE FROM user_ipfs_mappings WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_ipfs_mappings', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('nft_claims') THEN
        DELETE FROM nft_claims WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from nft_claims', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('campaign_reward_claims') THEN
        DELETE FROM campaign_reward_claims WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from campaign_reward_claims', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_burn_progress') THEN
        DELETE FROM user_burn_progress WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_burn_progress', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_burn_chances_earned') THEN
        DELETE FROM user_burn_chances_earned WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_burn_chances_earned', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('staked_nfts') THEN
        DELETE FROM staked_nfts WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from staked_nfts', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_participations') THEN
        DELETE FROM user_participations WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_participations', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_task_completions') THEN
        DELETE FROM user_task_completions WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_task_completions', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('staking_rewards') THEN
        DELETE FROM staking_rewards WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from staking_rewards', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_activities') THEN
        DELETE FROM user_activities WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_activities', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('nft_collections') THEN
        DELETE FROM nft_collections WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from nft_collections', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('staking_history') THEN
        DELETE FROM staking_history WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from staking_history', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_balances') THEN
        DELETE FROM user_balances WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_balances', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_streaks') THEN
        DELETE FROM user_streaks WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_streaks', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('daily_claims') THEN
        DELETE FROM daily_claims WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from daily_claims', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_achievements') THEN
        DELETE FROM user_achievements WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_achievements', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('achievement_balance_audit') THEN
        DELETE FROM achievement_balance_audit WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from achievement_balance_audit', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('nft_distributions') THEN
        DELETE FROM nft_distributions WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from nft_distributions', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('staked_tokens') THEN
        DELETE FROM staked_tokens WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from staked_tokens', table_deleted; END IF;
    END IF;
    
    IF table_has_wallet_column('user_participation_stats') THEN
        DELETE FROM user_participation_stats WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from user_participation_stats', table_deleted; END IF;
    END IF;
    
    -- Finally delete from users table
    IF table_has_wallet_column('users') THEN
        DELETE FROM users WHERE wallet_address = target_wallet_address;
        GET DIAGNOSTICS table_deleted = ROW_COUNT;
        total_deleted := total_deleted + table_deleted;
        IF table_deleted > 0 THEN RAISE NOTICE 'Deleted % records from users', table_deleted; END IF;
    END IF;
    
    -- Clean up helper function
    DROP FUNCTION IF EXISTS table_has_wallet_column(TEXT);
    
    RETURN format('Successfully deleted user and %s related records', total_deleted);
END;
$$ LANGUAGE plpgsql;

-- Usage instructions:
-- 1. First run this script to fix constraints
-- 2. Then try normal deletion again
-- 3. If still failing, use: SELECT emergency_delete_user('wallet_address_here');
DO $$
BEGIN
RAISE NOTICE 'Quick fix applied. Try deleting the user again from Supabase dashboard.';
RAISE NOTICE 'If still failing, use: SELECT emergency_delete_user(''wallet_address_here'');';
END $$;