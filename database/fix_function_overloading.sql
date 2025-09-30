-- ============================================================================
-- FIX FUNCTION OVERLOADING CONFLICT
-- Removes duplicate get_user_achievements functions causing overload error
-- ============================================================================

-- Drop ALL existing versions of get_user_achievements
DROP FUNCTION IF EXISTS get_user_achievements(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_user_achievements(TEXT);
DROP FUNCTION IF EXISTS get_user_achievements(TEXT, public.achievement_category);

-- Create single unified function with TEXT parameter for category
CREATE OR REPLACE FUNCTION get_user_achievements(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result_json JSON;
BEGIN
  -- Enhanced CTE with proper state logic
  SELECT COALESCE(array_to_json(array_agg(
    json_build_object(
      'achievement_key', am.achievement_key,
      'title', am.title,
      'description', am.description,
      'category', am.category::text,
      'icon', am.icon,
      'color', am.color,
      'neft_reward', am.neft_reward,
      'xp_reward', am.xp_reward,
      'required_count', am.required_count,
      'current_progress', COALESCE(ua.current_progress, 0),
      'status', CASE 
        WHEN ua.claimed_at IS NOT NULL THEN 'completed'
        WHEN ua.status = 'completed' AND ua.claimed_at IS NULL THEN 'completed'
        WHEN COALESCE(ua.current_progress, 0) >= am.required_count THEN 'completed'
        WHEN COALESCE(ua.current_progress, 0) > 0 THEN 'in_progress'
        ELSE 'locked'
      END,
      'completed_at', ua.completed_at,
      'claimed_at', ua.claimed_at,
      'progress_percentage', CASE 
        WHEN ua.claimed_at IS NOT NULL THEN 100
        WHEN COALESCE(ua.current_progress, 0) >= am.required_count THEN 100
        WHEN am.required_count > 0 THEN 
          LEAST(100, ROUND((COALESCE(ua.current_progress, 0)::numeric / am.required_count::numeric) * 100, 2))
        ELSE 0 
      END
    ) ORDER BY 
    -- Sort by status priority: completed (unclaimed) -> in_progress -> completed (claimed) -> locked
    CASE 
      WHEN ua.claimed_at IS NOT NULL THEN 3
      WHEN ua.status = 'completed' AND ua.claimed_at IS NULL THEN 1
      WHEN COALESCE(ua.current_progress, 0) > 0 THEN 2
      ELSE 4
    END,
    am.category,
    am.achievement_key
  )), '[]'::json)
  INTO result_json
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
    AND ua.wallet_address = user_wallet
  WHERE am.is_active = TRUE
    AND (category_filter IS NULL OR am.category::text = category_filter);

  -- Debug logging
  RAISE NOTICE 'Achievement query result for wallet %: % achievements found', user_wallet, (
    SELECT COUNT(*) FROM achievements_master am
    LEFT JOIN user_achievements ua ON am.achievement_key = ua.achievement_key 
      AND ua.wallet_address = user_wallet
    WHERE am.is_active = TRUE
      AND (category_filter IS NULL OR am.category::text = category_filter)
  );
  
  RETURN result_json;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', TRUE,
      'message', 'Error getting user achievements: ' || SQLERRM,
      'data', '[]'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to single function
GRANT EXECUTE ON FUNCTION get_user_achievements(TEXT, TEXT) TO authenticated, anon, public;

-- Test the function
SELECT 'Function overloading conflict fixed!' as status;
SELECT 'Testing function...' as test;
SELECT get_user_achievements('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', NULL) as result;
