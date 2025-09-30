-- Create NFT Claims table for tracking claimed NFTs
create table IF NOT EXISTS public.nft_claims (
  id uuid not null default gen_random_uuid (),
  nft_id text not null,
  user_id uuid null,
  wallet_address text not null,
  claimed_blockchain text not null,
  claimed_at timestamp with time zone null default now(),
  transaction_hash text null,
  contract_address text null,
  token_id text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  blockchain_type text not null default 'Polygon'::text,
  constraint nft_claims_pkey primary key (id),
  constraint nft_claims_nft_id_user_id_key unique (nft_id, user_id),
  constraint fk_nft_claims_wallet_address foreign KEY (wallet_address) references users (wallet_address) on delete CASCADE,
  constraint nft_claims_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint nft_claims_blockchain_type_check check (
    (
      blockchain_type = any (
        array[
          'ethereum'::text,
          'solana'::text,
          'sui'::text,
          'polygon'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_nft_claims_blockchain_type on public.nft_claims using btree (blockchain_type) TABLESPACE pg_default;

create index IF not exists idx_nft_claims_claimed_at on public.nft_claims using btree (claimed_at) TABLESPACE pg_default;

create index IF not exists idx_nft_claims_nft_id on public.nft_claims using btree (nft_id) TABLESPACE pg_default;

create index IF not exists idx_nft_claims_user_id on public.nft_claims using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_nft_claims_wallet_address on public.nft_claims using btree (wallet_address) TABLESPACE pg_default;

-- Create trigger only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_nft_claims_updated_at'
    ) THEN
        CREATE TRIGGER update_nft_claims_updated_at BEFORE
        UPDATE ON nft_claims FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column ();
    END IF;
END $$;

-- Enable RLS (Row Level Security) if not already enabled
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'nft_claims' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.nft_claims ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view their own NFT claims" ON public.nft_claims;
DROP POLICY IF EXISTS "Users can insert their own NFT claims" ON public.nft_claims;
DROP POLICY IF EXISTS "Users can update their own NFT claims" ON public.nft_claims;

-- Create RLS policies
CREATE POLICY "Users can view their own NFT claims" ON public.nft_claims
  FOR SELECT USING (auth.uid() = user_id OR wallet_address = (SELECT wallet_address FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their own NFT claims" ON public.nft_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id OR wallet_address = (SELECT wallet_address FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their own NFT claims" ON public.nft_claims
  FOR UPDATE USING (auth.uid() = user_id OR wallet_address = (SELECT wallet_address FROM users WHERE id = auth.uid()));
