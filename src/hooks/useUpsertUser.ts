import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function useUpsertUser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const upsertUser = async ({
    wallet_address,
    email = null,
    display_name = null,
    avatar_url = null,
    provider = null,
    social_provider = null,
    wallet_type = null,
    metadata = null,
  }: {
    wallet_address: string;
    email?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    provider?: string | null;
    social_provider?: string | null;
    wallet_type?: string | null;
    metadata?: any;
  }) => {
    setLoading(true);
    setError(null);
    setUser(null);

    try {
      // First, try to find existing user
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', wallet_address)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('Error finding user:', findError);
        setError(findError.message);
        setLoading(false);
        return { data: null, error: findError };
      }

      let result;
      if (existingUser) {
        // Update existing user
        const { data, error: updateError } = await supabase
          .from('users')
          .update({
            email: email || existingUser.email,
            display_name: display_name || existingUser.display_name,
            avatar_url: avatar_url || existingUser.avatar_url,
            provider: provider || existingUser.provider,
            social_provider: social_provider || existingUser.social_provider,
            wallet_type: wallet_type || existingUser.wallet_type,
            metadata: metadata || existingUser.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', wallet_address)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating user:', updateError);
          setError(updateError.message);
          setLoading(false);
          return { data: null, error: updateError };
        }

        result = { data: [data], error: null };
      } else {
        // Create new user
        const { data, error: insertError } = await supabase
          .from('users')
          .insert({
            wallet_address,
            email,
            display_name,
            avatar_url,
            provider,
            social_provider,
            wallet_type,
            metadata: metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating user:', insertError);
          setError(insertError.message);
          setLoading(false);
          return { data: null, error: insertError };
        }

        result = { data: [data], error: null };
      }

      if (result.error) {
        setError(result.error.message);
        setUser(null);
      } else {
        setUser(result.data?.[0] || null);
      }

      setLoading(false);
      return result;
    } catch (err) {
      console.error('Upsert user exception:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setUser(null);
      setLoading(false);
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
    }
  };

  return { upsertUser, user, loading, error };
}
