-- Function to link an existing wallet address to a user account
-- This prevents duplicate user creation and allows linking to existing accounts
CREATE OR REPLACE FUNCTION link_existing_wallet_to_user(
  target_user_wallet_address TEXT,
  wallet_address_to_link TEXT,
  wallet_type_name TEXT,
  provider_name TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  existing_user_record RECORD;
  current_connections JSONB;
BEGIN
  -- First check if the wallet address already exists in any user account
  SELECT * INTO existing_user_record
  FROM check_existing_user_by_wallet(wallet_address_to_link)
  LIMIT 1;
  
  -- If wallet address already exists in another user account, return false
  IF existing_user_record.existing_user_wallet_address IS NOT NULL 
     AND existing_user_record.existing_user_wallet_address != target_user_wallet_address THEN
    RETURN FALSE;
  END IF;
  
  -- Get current wallet connections for target user
  SELECT COALESCE(linked_wallet_addresses, '[]'::jsonb) INTO current_connections
  FROM users 
  WHERE wallet_address = target_user_wallet_address;
  
  -- Check if wallet connection already exists for this user
  IF jsonb_path_exists(current_connections, ('$[*] ? (@.address == "' || wallet_address_to_link || '")')::jsonpath) THEN
    RETURN FALSE; -- Connection already exists
  END IF;
  
  -- Add new wallet connection to target user
  UPDATE users 
  SET 
    linked_wallet_addresses = current_connections || jsonb_build_array(
      jsonb_build_object(
        'address', wallet_address_to_link,
        'wallet_type', wallet_type_name,
        'connected_at', now(),
        'is_primary', FALSE
      )
    ),
    connection_history = COALESCE(connection_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'action', 'wallet_linked',
        'wallet_type', wallet_type_name,
        'address', wallet_address_to_link,
        'timestamp', now()
      )
    ),
    updated_at = now()
  WHERE wallet_address = target_user_wallet_address;
  
  RETURN FOUND;
END;
$$;

