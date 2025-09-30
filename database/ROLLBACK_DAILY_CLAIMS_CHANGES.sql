-- ROLLBACK: Revert All Daily Claims Balance Changes
-- This script removes all modifications made to fix daily claims balance updates

-- Step 1: Remove the trigger from daily_claims table
DROP TRIGGER IF EXISTS sync_user_balance_on_daily_claim ON daily_claims;

-- Step 2: Remove the trigger function
DROP FUNCTION IF EXISTS update_user_balance_after_daily_claim();

-- Step 3: Clean up any test data that was inserted
DELETE FROM daily_claims WHERE wallet_address LIKE 'test_trigger_%';
DELETE FROM daily_claims WHERE wallet_address LIKE 'test_wallet_for_debug%';
DELETE FROM user_balances WHERE wallet_address LIKE 'test_trigger_%';
DELETE FROM user_balances WHERE wallet_address LIKE 'test_wallet_for_debug%';

-- Step 4: Verify cleanup
DO $$
BEGIN
    -- Check if trigger was removed
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'daily_claims' 
        AND t.tgname = 'sync_user_balance_on_daily_claim'
    ) THEN
        RAISE NOTICE '✅ Trigger sync_user_balance_on_daily_claim removed from daily_claims table';
    ELSE
        RAISE NOTICE '❌ Trigger still exists on daily_claims table';
    END IF;

    -- Check if trigger function was removed
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'update_user_balance_after_daily_claim'
    ) THEN
        RAISE NOTICE '✅ Function update_user_balance_after_daily_claim removed';
    ELSE
        RAISE NOTICE '❌ Function update_user_balance_after_daily_claim still exists';
    END IF;

    -- Check if test data was cleaned
    IF NOT EXISTS (
        SELECT 1 FROM daily_claims 
        WHERE wallet_address LIKE 'test_%'
    ) THEN
        RAISE NOTICE '✅ Test data cleaned from daily_claims table';
    ELSE
        RAISE NOTICE '❌ Test data still exists in daily_claims table';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🔄 ROLLBACK COMPLETED';
    RAISE NOTICE '';
    RAISE NOTICE 'What was reverted:';
    RAISE NOTICE '✅ Removed trigger from daily_claims table';
    RAISE NOTICE '✅ Removed trigger function';
    RAISE NOTICE '✅ Cleaned up test data';
    RAISE NOTICE '✅ Database restored to original state';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: Existing sync_user_balance_from_all_sources function was preserved';
    RAISE NOTICE 'Note: DailyClaimsService backup sync calls are still active';
END $$;
