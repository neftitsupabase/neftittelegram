create or replace function public.upsert_user(
  in_wallet_address text,
  in_email text default null,
  in_display_name text default null,
  in_avatar_url text default null,
  in_provider text default null,
  in_social_provider text default null,
  in_wallet_type text default null,
  in_metadata jsonb default null
)
returns table (
  id uuid,
  wallet_address text,
  email text,
  display_name text,
  avatar_url text,
  provider text,
  social_provider text,
  wallet_type text,
  metadata jsonb,
  created_at timestamptz,
  last_login timestamptz,
  updated_at timestamptz
) as $$
begin
  return query
  insert into public.users (
    wallet_address, email, display_name, avatar_url, provider, social_provider, wallet_type, metadata, last_login, updated_at
  ) values (
    in_wallet_address, in_email, in_display_name, in_avatar_url, in_provider, in_social_provider, in_wallet_type, in_metadata, now(), now()
  )
  on conflict (wallet_address) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        provider = excluded.provider,
        social_provider = excluded.social_provider,
        wallet_type = excluded.wallet_type,
        metadata = excluded.metadata,
        last_login = now(),
        updated_at = now()
  returning 
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
    last_login,
    updated_at;
end;
$$ language plpgsql; 