-- ============================================================================
-- FIX SQL GROUP BY ERROR
-- Removes json_agg to avoid GROUP BY issues with LEFT JOIN
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS get_user_achievements(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_user_achievements(TEXT);

-- Create function without json_agg to avoid GROUP BY issues
CREATE OR REPLACE FUNCTION get_user_achievements(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Use array_to_json with array_agg instead of json_agg
  WITH achievement_data AS (
    SELECT 
      am.achievement_key,
      am.title,
      am.description,
      am.category::text as category,
      COALESCE(ua.status, 'locked') as status,
      COALESCE(ua.current_progress, 0) as current_progress,
      am.required_count,
      am.neft_reward,
      am.xp_reward,
      am.nft_reward,
      COALESCE(am.icon, '🏆') as icon,
      COALESCE(am.color, '#FFD700') as color,
      ua.completed_at,
      ua.claimed_at,
      ROUND(
        (COALESCE(ua.current_progress, 0)::DECIMAL / GREATEST(am.required_count, 1)) * 100, 2
      ) as progress_percentage,
      CASE COALESCE(ua.status, 'locked')
        WHEN 'completed' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'locked' THEN 3
        ELSE 4
      END as sort_order
    FROM achievements_master am
    LEFT JOIN user_achievements ua ON (
      ua.achievement_key = am.achievement_key 
      AND ua.wallet_address = user_wallet
    )
    WHERE am.is_active = TRUE
      AND (category_filter IS NULL OR am.category::text = category_filter)
  )
  SELECT array_to_json(array_agg(
    json_build_object(
      'achievement_key', achievement_key,
      'title', title,
      'description', description,
      'category', category,
      'status', status,
      'current_progress', current_progress,
      'required_count', required_count,
      'neft_reward', neft_reward,
      'xp_reward', xp_reward,
      'nft_reward', nft_reward,
      'icon', icon,
      'color', color,
      'completed_at', completed_at,
      'claimed_at', claimed_at,
      'progress_percentage', progress_percentage
    ) ORDER BY sort_order, COALESCE(am.sort_order, 999), achievement_key
  )) INTO result
  FROM achievement_data am;
  
  RETURN COALESCE(result, '[]'::JSON);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', SQLERRM,
      'message', 'SQL execution failed',
      'debug', 'Check query structure',
      'wallet', user_wallet,
      'category_filter', category_filter
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO public;

-- Test the function
SELECT 'Fixed GROUP BY error function deployed!' as status;
SELECT 'Testing function...' as test;
SELECT get_user_achievements('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', NULL) as result;
