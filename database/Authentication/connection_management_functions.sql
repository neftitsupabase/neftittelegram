-- Connection Management Functions for Multi-Provider Support
-- These functions handle adding, removing, and querying user connections

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
BEGIN
  -- Check if connection already exists
  SELECT jsonb_array_elements(linked_social_accounts) INTO existing_connection
  FROM users 
  WHERE wallet_address = primary_wallet_address
  AND jsonb_array_elements(linked_social_accounts)->>'provider' = provider_name;
  
  IF existing_connection IS NOT NULL THEN
    RETURN FALSE; -- Connection already exists
  END IF;
  
  -- Add new social connection
  UPDATE users 
  SET 
    linked_social_accounts = linked_social_accounts || jsonb_build_array(
      jsonb_build_object(
        'provider', provider_name,
        'provider_id', provider_id,
        'email', provider_email,
        'social_address', social_address,
        'connected_at', now(),
        'is_primary', FALSE
      )
    ),
    connection_history = connection_history || jsonb_build_array(
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
  existing_connection JSONB;
BEGIN
  -- Check if wallet connection already exists
  SELECT jsonb_array_elements(linked_wallet_addresses) INTO existing_connection
  FROM users 
  WHERE wallet_address = primary_wallet_address
  AND jsonb_array_elements(linked_wallet_addresses)->>'address' = new_wallet_address;
  
  IF existing_connection IS NOT NULL THEN
    RETURN FALSE; -- Connection already exists
  END IF;
  
  -- Add new wallet connection
  UPDATE users 
  SET 
    linked_wallet_addresses = linked_wallet_addresses || jsonb_build_array(
      jsonb_build_object(
        'address', new_wallet_address,
        'wallet_type', wallet_type_name,
        'connected_at', now(),
        'is_primary', FALSE
      )
    ),
    connection_history = connection_history || jsonb_build_array(
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
BEGIN
  UPDATE users 
  SET 
    linked_social_accounts = (
      SELECT jsonb_agg(connection)
      FROM jsonb_array_elements(linked_social_accounts) AS connection
      WHERE connection->>'provider' != provider_name
    ),
    connection_history = connection_history || jsonb_build_array(
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
BEGIN
  UPDATE users 
  SET 
    linked_wallet_addresses = (
      SELECT jsonb_agg(connection)
      FROM jsonb_array_elements(linked_wallet_addresses) AS connection
      WHERE connection->>'address' != wallet_address_to_remove
    ),
    connection_history = connection_history || jsonb_build_array(
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
    u.linked_social_accounts,
    u.linked_wallet_addresses,
    (
      COALESCE(jsonb_array_length(u.linked_social_accounts), 0) + 
      COALESCE(jsonb_array_length(u.linked_wallet_addresses), 0) + 1
    )::INTEGER as total_connections
  FROM users u
  WHERE u.wallet_address = user_wallet_address;
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
      SELECT 1 FROM users u,
      jsonb_array_elements(u.linked_social_accounts) AS social_conn
      WHERE u.wallet_address = user_wallet_address
      AND social_conn->>'provider' = connection_identifier
    ) INTO connection_found;
  ELSIF connection_type = 'wallet' THEN
    SELECT EXISTS(
      SELECT 1 FROM users u,
      jsonb_array_elements(u.linked_wallet_addresses) AS wallet_conn
      WHERE u.wallet_address = user_wallet_address
      AND wallet_conn->>'address' = connection_identifier
    ) INTO connection_found;
  END IF;
  
  RETURN connection_found;
END;
$$;

-- Function to find user by any connected address (social or wallet)
CREATE OR REPLACE FUNCTION find_user_by_any_connection(
  search_address TEXT
) RETURNS TABLE (
  id UUID,
  wallet_address TEXT,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  provider TEXT,
  social_provider TEXT,
  wallet_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First check if it's the primary wallet address
  RETURN QUERY
  SELECT u.id, u.wallet_address, u.email, u.display_name, u.avatar_url, 
         u.provider, u.social_provider, u.wallet_type, u.metadata,
         u.created_at, u.last_login, u.updated_at
  FROM users u
  WHERE u.wallet_address = search_address;
  
  -- If not found, check linked social accounts
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT u.id, u.wallet_address, u.email, u.display_name, u.avatar_url, 
           u.provider, u.social_provider, u.wallet_type, u.metadata,
           u.created_at, u.last_login, u.updated_at
    FROM users u,
    jsonb_array_elements(u.linked_social_accounts) AS social_conn
    WHERE social_conn->>'social_address' = search_address;
  END IF;
  
  -- If still not found, check linked wallet addresses
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT u.id, u.wallet_address, u.email, u.display_name, u.avatar_url, 
           u.provider, u.social_provider, u.wallet_type, u.metadata,
           u.created_at, u.last_login, u.updated_at
    FROM users u,
    jsonb_array_elements(u.linked_wallet_addresses) AS wallet_conn
    WHERE wallet_conn->>'address' = search_address;
  END IF;
END;
$$;
