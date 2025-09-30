-- Auto-Reset Serial Numbers When Rows Are Deleted
-- Multiple approaches for resetting SERIAL/AUTO_INCREMENT values

-- APPROACH 1: Reset sequence to start from 1 (Manual)
-- Use this when you want to reset the sequence immediately after deleting rows

-- For nft_cid_pools table
CREATE OR REPLACE FUNCTION reset_nft_cid_pools_sequence()
RETURNS VOID AS $$
BEGIN
    -- Reset the sequence to start from 1
    PERFORM setval('nft_cid_pools_id_seq', 1, false);
    
    -- If there are existing rows, set sequence to max(id) + 1
    PERFORM setval('nft_cid_pools_id_seq', 
        COALESCE((SELECT MAX(id) FROM nft_cid_pools), 0) + 1, 
        false);
END;
$$ LANGUAGE plpgsql;

-- For nft_cid_distribution_log table
CREATE OR REPLACE FUNCTION reset_distribution_log_sequence()
RETURNS VOID AS $$
BEGIN
    -- Reset the sequence to start from 1
    PERFORM setval('nft_cid_distribution_log_id_seq', 1, false);
    
    -- If there are existing rows, set sequence to max(id) + 1
    PERFORM setval('nft_cid_distribution_log_id_seq', 
        COALESCE((SELECT MAX(id) FROM nft_cid_distribution_log), 0) + 1, 
        false);
END;
$$ LANGUAGE plpgsql;

-- APPROACH 2: Automatic trigger-based reset (Runs automatically on DELETE)
-- This will automatically reset sequence when all rows are deleted

CREATE OR REPLACE FUNCTION auto_reset_sequence_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if table is now empty after delete
    IF NOT EXISTS (SELECT 1 FROM nft_cid_pools LIMIT 1) THEN
        -- Reset sequence to 1 if table is empty
        PERFORM setval('nft_cid_pools_id_seq', 1, false);
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for nft_cid_pools
DROP TRIGGER IF EXISTS trigger_auto_reset_nft_cid_pools ON nft_cid_pools;
CREATE TRIGGER trigger_auto_reset_nft_cid_pools
    AFTER DELETE ON nft_cid_pools
    FOR EACH ROW
    EXECUTE FUNCTION auto_reset_sequence_on_delete();

-- Similar trigger for distribution log
CREATE OR REPLACE FUNCTION auto_reset_distribution_log_sequence_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if table is now empty after delete
    IF NOT EXISTS (SELECT 1 FROM nft_cid_distribution_log LIMIT 1) THEN
        -- Reset sequence to 1 if table is empty
        PERFORM setval('nft_cid_distribution_log_id_seq', 1, false);
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for distribution log
DROP TRIGGER IF EXISTS trigger_auto_reset_distribution_log ON nft_cid_distribution_log;
CREATE TRIGGER trigger_auto_reset_distribution_log
    AFTER DELETE ON nft_cid_distribution_log
    FOR EACH ROW
    EXECUTE FUNCTION auto_reset_distribution_log_sequence_on_delete();

-- APPROACH 3: Reorder IDs to be sequential (1, 2, 3, ...) after deletions
-- This actually changes existing ID values to be sequential

CREATE OR REPLACE FUNCTION reorder_table_ids(table_name TEXT)
RETURNS VOID AS $$
DECLARE
    sql_query TEXT;
BEGIN
    -- Create temporary sequence for reordering
    sql_query := format('
        WITH ordered_rows AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id) as new_id
            FROM %I
        )
        UPDATE %I 
        SET id = ordered_rows.new_id
        FROM ordered_rows
        WHERE %I.id = ordered_rows.id;
    ', table_name, table_name, table_name);
    
    EXECUTE sql_query;
    
    -- Reset sequence to continue from max ID + 1
    sql_query := format('
        SELECT setval(''%I_id_seq'', 
            COALESCE((SELECT MAX(id) FROM %I), 0) + 1, 
            false);
    ', table_name, table_name);
    
    EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql;

-- APPROACH 4: Complete table reset (Delete all + Reset sequence)
-- Use this to completely clear and reset a table

CREATE OR REPLACE FUNCTION complete_table_reset(table_name TEXT)
RETURNS VOID AS $$
DECLARE
    sql_query TEXT;
BEGIN
    -- Delete all rows
    sql_query := format('DELETE FROM %I;', table_name);
    EXECUTE sql_query;
    
    -- Reset sequence to 1
    sql_query := format('SELECT setval(''%I_id_seq'', 1, false);', table_name);
    EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql;

-- USAGE EXAMPLES:

-- Manual reset (call after deleting rows):
-- SELECT reset_nft_cid_pools_sequence();
-- SELECT reset_distribution_log_sequence();

-- Reorder existing IDs to be sequential:
-- SELECT reorder_table_ids('nft_cid_pools');
-- SELECT reorder_table_ids('nft_cid_distribution_log');

-- Complete reset (delete all + reset sequence):
-- SELECT complete_table_reset('nft_cid_pools');
-- SELECT complete_table_reset('nft_cid_distribution_log');

-- Grant permissions
GRANT EXECUTE ON FUNCTION reset_nft_cid_pools_sequence() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_distribution_log_sequence() TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_table_ids(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_table_reset(TEXT) TO authenticated;
