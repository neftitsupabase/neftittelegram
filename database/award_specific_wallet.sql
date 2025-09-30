-- Award burn chance to specific wallet that has 2 completed projects
-- Wallet: 0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071

-- 1. Award burn chance to the specific wallet
SELECT award_burn_chance_to_user('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as award_result;

-- 2. Verify the burn chance was awarded
SELECT 'Verifying burn chance awarded...' as verification_step;
SELECT 
  wallet_address,
  earned_at,
  used_at,
  projects_completed_for_this_chance
FROM user_burn_chances_earned 
WHERE wallet_address = '0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071';

-- 3. Test get_burn_chance_status for this wallet
SELECT 'Testing burn chance status...' as test_step;
SELECT get_burn_chance_status('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as status_result;

-- 4. Parse the JSON to see individual fields
SELECT 'Parsing status JSON...' as parse_step;
WITH status_data AS (
  SELECT get_burn_chance_status('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071') as status_json
)
SELECT 
  status_json->>'current_progress' as current_progress,
  status_json->>'projects_required' as projects_required,
  status_json->>'available_burn_chances' as available_burn_chances,
  status_json->>'used_burn_chances' as used_burn_chances,
  status_json->>'progress_percentage' as progress_percentage
FROM status_data;
