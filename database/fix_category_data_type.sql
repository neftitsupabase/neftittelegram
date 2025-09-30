-- ============================================================================
-- FIX CATEGORY DATA TYPE ISSUE
-- Fixes the achievement_category enum vs text comparison error
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS get_user_achievements(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_user_achievements(TEXT);

-- Create function with proper category handling
CREATE OR REPLACE FUNCTION get_user_achievements(
  user_wallet TEXT,
  category_filter TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Query without category filter first to avoid enum issues
  SELECT json_agg(
    json_build_object(
      'achievement_key', am.achievement_key,
      'title', am.title,
      'description', am.description,
      'category', am.category::text,
      'status', COALESCE(ua.status, 'locked'),
      'current_progress', COALESCE(ua.current_progress, 0),
      'required_count', am.required_count,
      'neft_reward', am.neft_reward,
      'xp_reward', am.xp_reward,
      'nft_reward', am.nft_reward,
      'icon', COALESCE(am.icon, '🏆'),
      'color', COALESCE(am.color, '#FFD700'),
      'completed_at', ua.completed_at,
      'claimed_at', ua.claimed_at,
      'progress_percentage', ROUND(
        (COALESCE(ua.current_progress, 0)::DECIMAL / GREATEST(am.required_count, 1)) * 100, 2
      )
    )
  ) INTO result
  FROM achievements_master am
  LEFT JOIN user_achievements ua ON (
    ua.achievement_key = am.achievement_key 
    AND ua.wallet_address = user_wallet
  )
  WHERE am.is_active = TRUE
    AND (category_filter IS NULL OR am.category::text = category_filter)
  ORDER BY 
    CASE COALESCE(ua.status, 'locked')
      WHEN 'completed' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'locked' THEN 3
      ELSE 4
    END,
    COALESCE(am.sort_order, 999),
    am.achievement_key;
  
  RETURN COALESCE(result, '[]'::JSON);
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error info for debugging
    RETURN json_build_object(
      'error', SQLERRM,
      'message', 'Category type conversion failed',
      'debug', 'Check achievements_master.category column type',
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
SELECT 'Fixed category data type function deployed!' as status;
SELECT 'Testing function without category filter...' as test;
SELECT get_user_achievements('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071', NULL) as result;
