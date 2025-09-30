import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useUserProfile(walletAddress: string | null) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setProfile(data);
        setLoading(false);
      });
  }, [walletAddress]);

  return { profile, loading, error };
} 