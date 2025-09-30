-- ============================================================================
-- UPDATE: Add metadata to get_user_connections function
-- This allows Discord verification to check both linked accounts AND primary account
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS get_user_connections(TEXT);

-- Create updated function that includes metadata
CREATE OR REPLACE FUNCTION get_user_connections(
  user_wallet_address TEXT
) RETURNS TABLE (
  primary_provider TEXT,
  primary_wallet_address TEXT,
  primary_wallet_type TEXT,
  linked_social_accounts JSONB,
  linked_wallet_addresses JSONB,
  total_connections INTEGER,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.social_provider as primary_provider,
    u.wallet_address as primary_wallet_address,
    u.wallet_type as primary_wallet_type,
    COALESCE(u.linked_social_accounts, '[]'::jsonb) as linked_social_accounts,
    COALESCE(u.linked_wallet_addresses, '[]'::jsonb) as linked_wallet_addresses,
    (
      COALESCE(jsonb_array_length(u.linked_social_accounts), 0) + 
      COALESCE(jsonb_array_length(u.linked_wallet_addresses), 0) + 1
    )::INTEGER as total_connections,
    COALESCE(u.metadata, '{}'::jsonb) as metadata
  FROM users u
  WHERE u.wallet_address = user_wallet_address;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_connections(TEXT) TO authenticated, anon, public;

SELECT 'get_user_connections function updated with metadata support!' as status;
