-- EXECUTE THIS IN SUPABASE SQL EDITOR
-- Fixed Connection Management Functions for Multi-Provider Support

-- Function to get all user connections in a structured format
CREATE OR REPLACE FUNCTION get_user_connections(
  user_wallet_address TEXT
) RETURNS TABLE (
  primary_provider TEXT,
  primary_wallet_address TEXT,
  primary_wallet_type TEXT,
  linked_social_accounts JSONB,
  linked_wallet_addresses JSONB,
  total_connections INTEGER
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
    )::INTEGER as total_connections
  FROM users u
  WHERE u.wallet_address = user_wallet_address;
END;
$$;

-- Function to add a new social account connection to existing user
CREATE OR REPLACE FUNCTION add_social_connection(
  primary_wallet_address TEXT,
  provider_name TEXT,
  provider_id TEXT,
  provider_email TEXT DEFAULT NULL,
  social_address TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  existing_connection JSONB;
  current_connections JSONB;
BEGIN
  -- Get current connections
  SELECT COALESCE(linked_social_accounts, '[]'::jsonb) INTO current_connections
  FROM users 
  WHERE wallet_address = primary_wallet_address;
  
  -- Check if connection already exists
  IF jsonb_path_exists(current_connections, ('$[*] ? (@.provider == "' || provider_name || '")')::jsonpath) THEN
    RETURN FALSE; -- Connection already exists
  END IF;
  
  -- Add new social connection
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
        'action', 'social_connected',
        'provider', provider_name,
        'timestamp', now()
      )
    ),
    updated_at = now()
  WHERE wallet_address = primary_wallet_address;
  
  RETURN FOUND;
END;
$$;

-- Function to add a new wallet connection to existing user
CREATE OR REPLACE FUNCTION add_wallet_connection(
  primary_wallet_address TEXT,
  new_wallet_address TEXT,
  wallet_type_name TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_connections JSONB;
BEGIN
  -- Get current connections
  SELECT COALESCE(linked_wallet_addresses, '[]'::jsonb) INTO current_connections
  FROM users 
  WHERE wallet_address = primary_wallet_address;
  
  -- Check if wallet connection already exists
  IF jsonb_path_exists(current_connections, ('$[*] ? (@.address == "' || new_wallet_address || '")')::jsonpath) THEN
    RETURN FALSE; -- Connection already exists
  END IF;
  
  -- Add new wallet connection
  UPDATE users 
  SET 
    linked_wallet_addresses = current_connections || jsonb_build_array(
      jsonb_build_object(
        'address', new_wallet_address,
        'wallet_type', wallet_type_name,
        'connected_at', now(),
        'is_primary', FALSE
      )
    ),
    connection_history = COALESCE(connection_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'action', 'wallet_connected',
        'wallet_type', wallet_type_name,
        'address', new_wallet_address,
        'timestamp', now()
      )
    ),
    updated_at = now()
  WHERE wallet_address = primary_wallet_address;
  
  RETURN FOUND;
END;
$$;

-- Function to remove a social connection
CREATE OR REPLACE FUNCTION remove_social_connection(
  primary_wallet_address TEXT,
  provider_name TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_connections JSONB;
  filtered_connections JSONB;
BEGIN
  -- Get current connections
  SELECT COALESCE(linked_social_accounts, '[]'::jsonb) INTO current_connections
  FROM users 
  WHERE wallet_address = primary_wallet_address;
  
  -- Filter out the connection to remove
  SELECT jsonb_agg(connection)
  INTO filtered_connections
  FROM jsonb_array_elements(current_connections) AS connection
  WHERE connection->>'provider' != provider_name;
  
  -- Update with filtered connections
  UPDATE users 
  SET 
    linked_social_accounts = COALESCE(filtered_connections, '[]'::jsonb),
    connection_history = COALESCE(connection_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'action', 'social_disconnected',
        'provider', provider_name,
        'timestamp', now()
      )
    ),
    updated_at = now()
  WHERE wallet_address = primary_wallet_address;
  
  RETURN FOUND;
END;
$$;

-- Function to remove a wallet connection
CREATE OR REPLACE FUNCTION remove_wallet_connection(
  primary_wallet_address TEXT,
  wallet_address_to_remove TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_connections JSONB;
  filtered_connections JSONB;
BEGIN
  -- Get current connections
  SELECT COALESCE(linked_wallet_addresses, '[]'::jsonb) INTO current_connections
  FROM users 
  WHERE wallet_address = primary_wallet_address;
  
  -- Filter out the connection to remove
  SELECT jsonb_agg(connection)
  INTO filtered_connections
  FROM jsonb_array_elements(current_connections) AS connection
  WHERE connection->>'address' != wallet_address_to_remove;
  
  -- Update with filtered connections
  UPDATE users 
  SET 
    linked_wallet_addresses = COALESCE(filtered_connections, '[]'::jsonb),
    connection_history = COALESCE(connection_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'action', 'wallet_disconnected',
        'address', wallet_address_to_remove,
        'timestamp', now()
      )
    ),
    updated_at = now()
  WHERE wallet_address = primary_wallet_address;
  
  RETURN FOUND;
END;
$$;

-- Function to check if a specific connection exists
CREATE OR REPLACE FUNCTION connection_exists(
  user_wallet_address TEXT,
  connection_type TEXT, -- 'social' or 'wallet'
  connection_identifier TEXT -- provider name for social, address for wallet
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  connection_found BOOLEAN := FALSE;
BEGIN
  IF connection_type = 'social' THEN
    SELECT EXISTS(
      SELECT 1 FROM users u
      WHERE u.wallet_address = user_wallet_address
      AND (
        u.social_provider = connection_identifier
        OR jsonb_path_exists(
          COALESCE(u.linked_social_accounts, '[]'::jsonb), 
          ('$[*] ? (@.provider == "' || connection_identifier || '")')::jsonpath
        )
      )
    ) INTO connection_found;
  ELSIF connection_type = 'wallet' THEN
    SELECT EXISTS(
      SELECT 1 FROM users u
      WHERE u.wallet_address = user_wallet_address
      AND (
        u.wallet_type = connection_identifier
        OR jsonb_path_exists(
          COALESCE(u.linked_wallet_addresses, '[]'::jsonb), 
          ('$[*] ? (@.wallet_type == "' || connection_identifier || '")')::jsonpath
        )
      )
    ) INTO connection_found;
  END IF;
  
  RETURN connection_found;
END;
$$;
