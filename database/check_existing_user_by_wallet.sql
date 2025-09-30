-- Function to check if a wallet address already exists in any user account
-- This prevents duplicate user creation and allows linking to existing accounts
-- Checks all 3 columns: wallet_address (primary), linked_wallet_addresses (address), linked_social_accounts (social_address)
CREATE OR REPLACE FUNCTION check_existing_user_by_wallet(
  wallet_address_to_check TEXT
) RETURNS TABLE (
  existing_user_wallet_address TEXT,
  existing_user_display_name TEXT,
  existing_user_email TEXT,
  connection_type TEXT,
  connection_details JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Check in primary wallet addresses (wallet_address column - primary key)
  SELECT 
    u.wallet_address as existing_user_wallet_address,
    u.display_name as existing_user_display_name,
    u.email as existing_user_email,
    'primary_wallet' as connection_type,
    jsonb_build_object(
      'wallet_type', u.wallet_type,
      'provider', u.provider,
      'social_provider', u.social_provider,
      'is_primary', true
    ) as connection_details
  FROM users u
  WHERE u.wallet_address = wallet_address_to_check
  
  UNION ALL
  
  -- Check in linked wallet addresses (linked_wallet_addresses column)
  SELECT 
    u.wallet_address as existing_user_wallet_address,
    u.display_name as existing_user_display_name,
    u.email as existing_user_email,
    'linked_wallet' as connection_type,
    jsonb_build_object(
      'linked_wallet_address', linked_wallet->>'address',
      'linked_wallet_type', linked_wallet->>'wallet_type',
      'is_primary', false
    ) as connection_details
  FROM users u,
       jsonb_array_elements(COALESCE(u.linked_wallet_addresses, '[]'::jsonb)) AS linked_wallet
  WHERE linked_wallet->>'address' = wallet_address_to_check
  
  UNION ALL
  
  -- Check in linked social accounts (linked_social_accounts column)
  SELECT 
    u.wallet_address as existing_user_wallet_address,
    u.display_name as existing_user_display_name,
    u.email as existing_user_email,
    'linked_social' as connection_type,
    jsonb_build_object(
      'linked_social_provider', linked_social->>'provider',
      'linked_social_address', linked_social->>'social_address',
      'is_primary', false
    ) as connection_details
  FROM users u,
       jsonb_array_elements(COALESCE(u.linked_social_accounts, '[]'::jsonb)) AS linked_social
  WHERE linked_social->>'social_address' = wallet_address_to_check;
END;
$$;
