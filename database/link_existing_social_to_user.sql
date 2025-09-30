-- Function to link an existing social account to a user account
-- This prevents duplicate user creation and allows linking to existing accounts
CREATE OR REPLACE FUNCTION link_existing_social_to_user(
  target_user_wallet_address TEXT,
  provider_name TEXT,
  provider_id TEXT,
  provider_email TEXT DEFAULT NULL,
  social_address TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  existing_user_record RECORD;
  current_connections JSONB;
BEGIN
  -- First check if the social address already exists in any user account
  SELECT * INTO existing_user_record
  FROM check_existing_user_by_wallet(social_address)
  LIMIT 1;
  
  -- If social address already exists in another user account, return false
  IF existing_user_record.existing_user_wallet_address IS NOT NULL 
     AND existing_user_record.existing_user_wallet_address != target_user_wallet_address THEN
    RETURN FALSE;
  END IF;
  
  -- Get current social connections for target user
  SELECT COALESCE(linked_social_accounts, '[]'::jsonb) INTO current_connections
  FROM users 
  WHERE wallet_address = target_user_wallet_address;
  
  -- Check if social connection already exists for this user
  IF jsonb_path_exists(current_connections, ('$[*] ? (@.provider == "' || provider_name || '")')::jsonpath) THEN
    RETURN FALSE; -- Connection already exists
  END IF;
  
  -- Add new social connection to target user
  UPDATE users 
  SET 
    linked_social_accounts = current_connections || jsonb_build_array(
      jsonb_build_object(
        'provider', provider_name,
        'provider_id', provider_id,
        'email', provider_email,
        'social_address', social_address,
        'connected_at', now(),
        'is_primary', FALSE
      )
    ),
    connection_history = COALESCE(connection_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'action', 'social_linked',
        'provider', provider_name,
        'timestamp', now()
      )
    ),
    updated_at = now()
  WHERE wallet_address = target_user_wallet_address;
  
  RETURN FOUND;
END;
$$;

