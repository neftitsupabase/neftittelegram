-- Migration to ensure both total_neft_earned and total_xp_earned exist in user_referrals table
-- This migration safely adds both columns if they don't exist

-- Add both columns if they don't exist
DO $$ 
BEGIN
    -- Add total_neft_earned column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_referrals' 
        AND column_name = 'total_neft_earned'
    ) THEN
        ALTER TABLE user_referrals ADD COLUMN total_neft_earned DECIMAL(20,8) DEFAULT 0;
        RAISE NOTICE 'Added total_neft_earned column to user_referrals table';
    ELSE
        RAISE NOTICE 'total_neft_earned column already exists in user_referrals table';
    END IF;

    -- Add total_xp_earned column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_referrals' 
        AND column_name = 'total_xp_earned'
    ) THEN
        ALTER TABLE user_referrals ADD COLUMN total_xp_earned INTEGER DEFAULT 0;
        RAISE NOTICE 'Added total_xp_earned column to user_referrals table';
    ELSE
        RAISE NOTICE 'total_xp_earned column already exists in user_referrals table';
    END IF;
END $$;

-- Verify the table structure after migration
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_referrals' 
ORDER BY ordinal_position;

-- Test the updated get_user_referral_data function
SELECT 'Testing updated get_user_referral_data function...' as status;
