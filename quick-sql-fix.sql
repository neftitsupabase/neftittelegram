-- QUICK SQL FIX for "email ambiguous" error
-- Run this in Supabase SQL Editor immediately

-- Fix the authenticate_or_create_user function
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
      -- Update profile info if provided (FIX: explicitly reference table)
      email = COALESCE(user_email, users.email),
      display_name = COALESCE(user_name, users.display_name),
      avatar_url = COALESCE(user_avatar, users.avatar_url)
    WHERE users.id = existing_user.user_id;
    
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
