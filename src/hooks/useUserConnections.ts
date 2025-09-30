import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface SocialConnection {
  provider: string;
  provider_id: string;
  email?: string;
  social_address?: string;
  connected_at: string;
  is_primary: boolean;
  metadata?: {
    username?: string;
    [key: string]: any;
  };
}

export interface WalletConnection {
  address: string;
  wallet_type: string;
  connected_at: string;
  is_primary: boolean;
}

export interface UserConnections {
  primary_provider: string;
  primary_wallet_address: string;
  primary_wallet_type: string;
  linked_social_accounts: SocialConnection[];
  linked_wallet_addresses: WalletConnection[];
  total_connections: number;
  metadata?: {
    created_via?: string;
    provider_info?: {
      provider_id?: string;
      email?: string;
      full_name?: string;
      name?: string;
      user_name?: string;
      preferred_username?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export function useUserConnections(walletAddress: string | null) {
  const [connections, setConnections] = useState<UserConnections | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!walletAddress) {
      setConnections(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('get_user_connections', {
        user_wallet_address: walletAddress
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const connectionData = data[0];
        setConnections({
          primary_provider: connectionData.primary_provider,
          primary_wallet_address: connectionData.primary_wallet_address,
          primary_wallet_type: connectionData.primary_wallet_type,
          linked_social_accounts: connectionData.linked_social_accounts || [],
          linked_wallet_addresses: connectionData.linked_wallet_addresses || [],
          total_connections: connectionData.total_connections,
          metadata: connectionData.metadata || {}
        });
      } else {
        setConnections(null);
      }
    } catch (err) {
      console.error('Error fetching user connections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [walletAddress]);

  const addSocialConnection = async (
    provider: string,
    providerId: string,
    email?: string,
    socialAddress?: string,
    username?: string
  ): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const { data, error } = await supabase.rpc('link_additional_provider', {
        target_user_address: walletAddress,
        new_address: socialAddress || `social:${provider}:${providerId}`,
        new_provider: provider,
        link_method: 'social',
        provider_email: email,
        provider_id: providerId,
        provider_username: username || null
      });

      if (error) throw error;

      if (data) {
        // Refresh connections after successful addition
        await fetchConnections();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error adding social connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to add social connection');
      return false;
    }
  };

  const addWalletConnection = async (
    newWalletAddress: string,
    walletType: string
  ): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const { data, error } = await supabase.rpc('link_additional_provider', {
        target_user_address: walletAddress,
        new_address: newWalletAddress,
        new_provider: walletType,
        link_method: 'wallet'
      });

      if (error) throw error;

      if (data) {
        // Refresh connections after successful addition
        await fetchConnections();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error adding wallet connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to add wallet connection');
      return false;
    }
  };

  const removeSocialConnection = async (provider: string): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const { data, error } = await supabase.rpc('remove_social_connection', {
        primary_wallet_address: walletAddress,
        provider_name: provider
      });

      if (error) throw error;

      if (data) {
        // Refresh connections after successful removal
        await fetchConnections();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error removing social connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove social connection');
      return false;
    }
  };

  const removeWalletConnection = async (addressToRemove: string): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const { data, error } = await supabase.rpc('remove_wallet_connection', {
        primary_wallet_address: walletAddress,
        wallet_address_to_remove: addressToRemove
      });

      if (error) throw error;

      if (data) {
        // Refresh connections after successful removal
        await fetchConnections();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error removing wallet connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove wallet connection');
      return false;
    }
  };

  const checkConnectionExists = async (
    connectionType: 'social' | 'wallet',
    identifier: string
  ): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const { data, error } = await supabase.rpc('connection_exists', {
        user_wallet_address: walletAddress,
        connection_type: connectionType,
        connection_identifier: identifier
      });

      if (error) throw error;
      return data || false;
    } catch (err) {
      console.error('Error checking connection existence:', err);
      return false;
    }
  };

  return {
    connections,
    loading,
    error,
    addSocialConnection,
    addWalletConnection,
    removeSocialConnection,
    removeWalletConnection,
    checkConnectionExists,
    refetch: fetchConnections
  };
}
