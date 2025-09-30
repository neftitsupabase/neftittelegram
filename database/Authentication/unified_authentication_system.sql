-- Unified Authentication System for Multi-Provider Login
-- This system ensures one UUID per user regardless of login method

-- Function to find user by any connection (wallet or social address)
-- FIXED: Proper logic to check primary first, then linked accounts
CREATE OR REPLACE FUNCTION find_user_by_any_address(
  search_address TEXT
) RETURNS TABLE (
  user_id UUID,
  wallet_address TEXT,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  provider TEXT,
  social_provider TEXT,
  wallet_type TEXT,
  metadata JSONB,
  linked_wallet_addresses JSONB,
  linked_social_accounts JSONB,
  created_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  connection_type TEXT,
  is_primary BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  found_record RECORD;
BEGIN
  -- First check if it's the primary wallet address
  SELECT 
    u.id,
    u.wallet_address,
    u.email,
    u.display_name,
    u.avatar_url,
    u.provider,
    u.social_provider,
    u.wallet_type,
    u.metadata,
    u.linked_wallet_addresses,
    u.linked_social_accounts,
    u.created_at,
    u.last_login,
    u.updated_at
  INTO found_record
  FROM users u
  WHERE u.wallet_address = search_address;
  
  IF FOUND THEN
    RETURN QUERY
    SELECT 
      found_record.id as user_id,
      found_record.wallet_address,
      found_record.email,
      found_record.display_name,
      found_record.avatar_url,
      found_record.provider,
      found_record.social_provider,
      found_record.wallet_type,
      found_record.metadata,
      found_record.linked_wallet_addresses,
      found_record.linked_social_accounts,
      found_record.created_at,
      found_record.last_login,
      found_record.updated_at,
      'primary_wallet'::TEXT as connection_type,
      true as is_primary;
    RETURN;
  END IF;
  
  -- Check linked social accounts
  SELECT 
    u.id,
    u.wallet_address,
    u.email,
    u.display_name,
    u.avatar_url,
    u.provider,
    u.social_provider,
    u.wallet_type,
    u.metadata,
    u.linked_wallet_addresses,
    u.linked_social_accounts,
    u.created_at,
    u.last_login,
    u.updated_at
  INTO found_record
  FROM users u,
  jsonb_array_elements(COALESCE(u.linked_social_accounts, '[]'::jsonb)) AS social_conn
  WHERE social_conn->>'social_address' = search_address;
  
  IF FOUND THEN
    RETURN QUERY
    SELECT 
      found_record.id as user_id,
      found_record.wallet_address,
      found_record.email,
      found_record.display_name,
      found_record.avatar_url,
      found_record.provider,
      found_record.social_provider,
      found_record.wallet_type,
      found_record.metadata,
      found_record.linked_wallet_addresses,
      found_record.linked_social_accounts,
      found_record.created_at,
      found_record.last_login,
      found_record.updated_at,
      'linked_social'::TEXT as connection_type,
      false as is_primary;
    RETURN;
  END IF;
  
  -- Check linked wallet addresses
  SELECT 
    u.id,
    u.wallet_address,
    u.email,
    u.display_name,
    u.avatar_url,
    u.provider,
    u.social_provider,
    u.wallet_type,
    u.metadata,
    u.linked_wallet_addresses,
    u.linked_social_accounts,
    u.created_at,
    u.last_login,
    u.updated_at
  INTO found_record
  FROM users u,
  jsonb_array_elements(COALESCE(u.linked_wallet_addresses, '[]'::jsonb)) AS wallet_conn
  WHERE wallet_conn->>'address' = search_address;
  
  IF FOUND THEN
    RETURN QUERY
    SELECT 
      found_record.id as user_id,
      found_record.wallet_address,
      found_record.email,
      found_record.display_name,
      found_record.avatar_url,
      found_record.provider,
      found_record.social_provider,
      found_record.wallet_type,
      found_record.metadata,
      found_record.linked_wallet_addresses,
      found_record.linked_social_accounts,
      found_record.created_at,
      found_record.last_login,
      found_record.updated_at,
      'linked_wallet'::TEXT as connection_type,
      false as is_primary;
    RETURN;
  END IF;
  
  -- No user found with this address
  RETURN;
END;
$$;

-- Debug function to help test the linking system
CREATE OR REPLACE FUNCTION debug_user_search(search_address TEXT)
RETURNS TABLE (
  step_name TEXT,
  found_user_id UUID,
  found_wallet_address TEXT,
  connection_type TEXT,
  search_result JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  primary_result RECORD;
  social_result RECORD;
  wallet_result RECORD;
BEGIN
  -- Step 1: Check primary wallet
  SELECT u.id, u.wallet_address INTO primary_result
  FROM users u WHERE u.wallet_address = search_address;
  
  RETURN QUERY SELECT 
    'primary_check'::TEXT,
    primary_result.id,
    primary_result.wallet_address,
    'primary'::TEXT,
    jsonb_build_object('found', primary_result.id IS NOT NULL);
  
  -- Step 2: Check linked social accounts
  SELECT u.id, u.wallet_address INTO social_result
  FROM users u,
  jsonb_array_elements(COALESCE(u.linked_social_accounts, '[]'::jsonb)) AS social_conn
  WHERE social_conn->>'social_address' = search_address;
  
  RETURN QUERY SELECT 
    'social_check'::TEXT,
    social_result.id,
    social_result.wallet_address,
    'linked_social'::TEXT,
    jsonb_build_object('found', social_result.id IS NOT NULL);
  
  -- Step 3: Check linked wallets
  SELECT u.id, u.wallet_address INTO wallet_result
  FROM users u,
  jsonb_array_elements(COALESCE(u.linked_wallet_addresses, '[]'::jsonb)) AS wallet_conn
  WHERE wallet_conn->>'address' = search_address;
  
  RETURN QUERY SELECT 
    'wallet_check'::TEXT,
    wallet_result.id,
    wallet_result.wallet_address,
    'linked_wallet'::TEXT,
    jsonb_build_object('found', wallet_result.id IS NOT NULL);
END;
$$;

-- Function to authenticate or create user with unified UUID management
CREATE OR REPLACE FUNCTION authenticate_or_create_user(
  login_address TEXT,
  login_provider TEXT,
  login_method TEXT, -- 'social' or 'wallet'
  user_email TEXT DEFAULT NULL,
  user_name TEXT DEFAULT NULL,
  user_avatar TEXT DEFAULT NULL,
  additional_data JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (
  user_id UUID,
  wallet_address TEXT,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_new_user BOOLEAN,
  linked_as_additional BOOLEAN,
  connection_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  existing_user RECORD;
  user_record RECORD;
  new_user_id UUID;
  timestamp_now TIMESTAMPTZ := now();
  formatted_provider TEXT;
  provider_id TEXT;
BEGIN
  -- Normalize provider name
  formatted_provider := lower(login_provider);
  
  -- Extract provider ID from social address format
  IF login_method = 'social' AND login_address LIKE 'social:%' THEN
    provider_id := split_part(login_address, ':', 3);
  ELSE
    provider_id := 'unknown';
  END IF;
  
  -- Check if this address already exists in any form
  SELECT * INTO existing_user FROM find_user_by_any_address(login_address) LIMIT 1;
  
  IF existing_user.user_id IS NOT NULL THEN
    -- User exists - update last login and return existing user
    UPDATE users 
    SET 
      last_login = timestamp_now,
      updated_at = timestamp_now,
      -- Update profile info if provided
      email = COALESCE(user_email, users.email),
      display_name = COALESCE(user_name, users.display_name),
      avatar_url = COALESCE(user_avatar, users.avatar_url)
    WHERE id = existing_user.user_id;
    
    -- Return existing user info
    RETURN QUERY
    SELECT 
      existing_user.user_id,
      existing_user.wallet_address,
      COALESCE(user_email, existing_user.email) as email,
      COALESCE(user_name, existing_user.display_name) as display_name,
      COALESCE(user_avatar, existing_user.avatar_url) as avatar_url,
      false as is_new_user,
      false as linked_as_additional,
      existing_user.connection_type;
    
    RETURN;
  END IF;
  
  -- No existing user found - create new user
  new_user_id := gen_random_uuid();
  
  -- Determine the appropriate display name
  IF user_name IS NULL OR user_name = '' THEN
    IF login_method = 'social' THEN
      user_name := formatted_provider || ' User';
    ELSE
      user_name := substring(login_address, 1, 6) || '...' || right(login_address, 4);
    END IF;
  END IF;
  
  -- Insert new user
  INSERT INTO users (
    id,
    wallet_address,
    email,
    display_name,
    avatar_url,
    provider,
    social_provider,
    wallet_type,
    metadata,
    created_at,
    updated_at,
    last_login
  ) VALUES (
    new_user_id,
    login_address,
    user_email,
    user_name,
    user_avatar,
    formatted_provider,
    CASE WHEN login_method = 'social' THEN formatted_provider ELSE NULL END,
    CASE WHEN login_method = 'wallet' THEN formatted_provider ELSE NULL END,
    additional_data || jsonb_build_object(
      'login_method', login_method,
      'provider_id', provider_id,
      'created_via', login_method || ':' || formatted_provider
    ),
    timestamp_now,
    timestamp_now,
    timestamp_now
  );
  
  -- Return new user info
  RETURN QUERY
  SELECT 
    new_user_id,
    login_address,
    user_email,
    user_name,
    user_avatar,
    true as is_new_user,
    false as linked_as_additional,
    'primary_' || login_method as connection_type;
END;
$$;

-- Function to link additional provider to existing user
CREATE OR REPLACE FUNCTION link_additional_provider(
  target_user_address TEXT,
  new_address TEXT,
  new_provider TEXT,
  link_method TEXT, -- 'social' or 'wallet'
  provider_email TEXT DEFAULT NULL,
  provider_id TEXT DEFAULT NULL,
  provider_username TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  existing_user RECORD;
  existing_connection RECORD;
  current_connections JSONB;
  timestamp_now TIMESTAMPTZ := now();
BEGIN
  -- Check if the new address already exists anywhere
  SELECT * INTO existing_connection FROM find_user_by_any_address(new_address) LIMIT 1;
  
  IF existing_connection.user_id IS NOT NULL THEN
    -- Address already exists in another account or same account
    SELECT * INTO existing_user FROM find_user_by_any_address(target_user_address) LIMIT 1;
    
    IF existing_user.user_id IS NULL THEN
      -- Target user doesn't exist
      RETURN FALSE;
    END IF;
    
    IF existing_connection.user_id != existing_user.user_id THEN
      -- Address belongs to different user
      RETURN FALSE;
    END IF;
    
    -- Address already belongs to same user - no action needed
    RETURN TRUE;
  END IF;
  
  -- Find target user
  SELECT * INTO existing_user FROM find_user_by_any_address(target_user_address) LIMIT 1;
  
  IF existing_user.user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Add connection based on method
  IF link_method = 'social' THEN
    -- Get current social connections
    SELECT COALESCE(linked_social_accounts, '[]'::jsonb) INTO current_connections
    FROM users WHERE id = existing_user.user_id;
    
    -- Check if provider already connected
    IF jsonb_path_exists(
      current_connections, 
      ('$[*] ? (@.provider == "' || new_provider || '")')::jsonpath
    ) THEN
      RETURN FALSE; -- Provider already connected
    END IF;
    
    -- Add social connection
    UPDATE users 
    SET 
      linked_social_accounts = current_connections || jsonb_build_array(
        jsonb_build_object(
          'provider', new_provider,
          'provider_id', COALESCE(provider_id, split_part(new_address, ':', 3)),
          'email', provider_email,
          'username', provider_username,
          'social_address', new_address,
          'connected_at', timestamp_now,
          'is_primary', false
        )
      ),
      connection_history = COALESCE(connection_history, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'action', 'social_linked',
          'provider', new_provider,
          'address', new_address,
          'timestamp', timestamp_now
        )
      ),
      updated_at = timestamp_now
    WHERE id = existing_user.user_id;
    
  ELSIF link_method = 'wallet' THEN
    -- Get current wallet connections
    SELECT COALESCE(linked_wallet_addresses, '[]'::jsonb) INTO current_connections
    FROM users WHERE id = existing_user.user_id;
    
    -- Check if wallet address already connected
    IF jsonb_path_exists(
      current_connections, 
      ('$[*] ? (@.address == "' || new_address || '")')::jsonpath
    ) THEN
      RETURN FALSE; -- Wallet already connected
    END IF;
    
    -- Add wallet connection
    UPDATE users 
    SET 
      linked_wallet_addresses = current_connections || jsonb_build_array(
        jsonb_build_object(
          'address', new_address,
          'wallet_type', new_provider,
          'connected_at', timestamp_now,
          'is_primary', false
        )
      ),
      connection_history = COALESCE(connection_history, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'action', 'wallet_linked',
          'wallet_type', new_provider,
          'address', new_address,
          'timestamp', timestamp_now
        )
      ),
      updated_at = timestamp_now
    WHERE id = existing_user.user_id;
  END IF;
  
  RETURN TRUE;
END;
$$;
