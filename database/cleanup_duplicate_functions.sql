-- Clean up duplicate functions and ensure proper function definitions
-- Run this in Supabase SQL Editor to fix the PGRST203 error

-- Drop any existing link_additional_provider functions to avoid conflicts
DROP FUNCTION IF EXISTS link_additional_provider(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS link_additional_provider(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS link_additional_provider(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS link_additional_provider(TEXT, TEXT, TEXT, TEXT);

-- Drop other potentially conflicting functions
DROP FUNCTION IF EXISTS link_existing_social_to_user(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS link_existing_wallet_to_user(TEXT, TEXT, TEXT, TEXT);

-- Recreate the unified link_additional_provider function
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION link_additional_provider(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION link_additional_provider(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

-- Verify the function was created correctly
SELECT 
  proname as function_name,
  proargtypes::regtype[] as parameter_types
FROM pg_proc 
WHERE proname = 'link_additional_provider';
