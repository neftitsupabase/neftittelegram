import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getWalletAddress } from '@/utils/authUtils';
import { useWallet as useSuiWallet } from '@suiet/wallet-kit';

export function useWalletConnections() {
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const currentWalletAddress = getWalletAddress();
  
  // Sui wallet hooks
  const { select, address: suiAddress, connected: suiConnected, signMessage } = useSuiWallet();

  // Check if wallet address already exists in any user account
  const checkExistingUserByWallet = async (walletAddress: string) => {
    try {
      const { data, error } = await supabase.rpc('find_user_by_any_address', {
        search_address: walletAddress
      });

      if (error) {
        console.error('Error checking existing user:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error('Error in checkExistingUserByWallet:', err);
      return null;
    }
  };

  // Add wallet connection to existing user account
  const addWalletConnection = async (walletAddress: string, walletType: string) => {
    try {
      if (!currentWalletAddress) {
        throw new Error('No current user session found');
      }

      console.log('🔗 Linking wallet to existing user:', {
        currentWalletAddress,
        newWalletAddress: walletAddress,
        walletType,
        linkMethod: 'wallet'
      });

      const { data, error } = await supabase.rpc('link_additional_provider', {
        target_user_address: currentWalletAddress,
        new_address: walletAddress,
        new_provider: walletType,
        link_method: 'wallet'
      });

      if (error) {
        console.error('Error linking wallet:', error);
        return false;
      }

      console.log('✅ Wallet linked successfully:', data);
      return data;
    } catch (err) {
      console.error('Error in addWalletConnection:', err);
      return false;
    }
  };

  // Connect Sui wallet
  const connectSui = useCallback(async () => {
    if (connecting.sui) return;

    try {
      setConnecting(prev => ({ ...prev, sui: true }));

      toast.info('Connecting Sui wallet... Please approve the connection in your wallet.');

      // IMPORTANT: Set a flag to prevent main authentication flow from triggering
      localStorage.setItem('edit_profile_linking_mode', 'true');
      localStorage.setItem('linking_wallet_type', 'sui');

      // Use the same approach as in the login page
      await select('Suiet'); // Select and trigger wallet modal

      // Wait until connected and address is available
      let tries = 0;
      while ((!suiConnected || !suiAddress) && tries < 20) {
        await new Promise((res) => setTimeout(res, 150));
        tries++;
      }

      if (!suiConnected || !suiAddress) {
        throw new Error('Sui wallet not connected.');
      }

      // Sign a message for verification
      const message = `Sign in to NEFTIT with Sui wallet: ${suiAddress}`;
      const encodedMessage = new TextEncoder().encode(message);
      const result = await signMessage({ message: encodedMessage });

      const walletAddress = `${suiAddress}`;
      console.log('🔗 Sui wallet connected:', walletAddress);
      console.log('👤 Current user wallet address:', currentWalletAddress);

      // Check if this wallet address already exists in any user account
      const existingUser = await checkExistingUserByWallet(walletAddress);
      console.log('🔍 Existing user check result:', existingUser);
      
      if (existingUser && existingUser.existing_user_wallet_address !== currentWalletAddress) {
        // Wallet already connected to another user
        toast.error(`This wallet is already connected to another user account (${existingUser.existing_user_display_name || 'Unknown'})`);
        return;
      }

      // IMPORTANT: Don't use processWalletLogin here as it creates new users
      // Instead, directly link the wallet to the existing user account
      const success = await addWalletConnection(walletAddress, 'sui');
      
      if (success) {
        toast.success('Sui wallet connected successfully!');
        
        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('wallet-connected-additional', {
          detail: { walletName: 'sui', address: walletAddress, type: 'sui' }
        }));

        // IMPORTANT: Don't update localStorage with the new wallet address
        // Keep the original user's wallet address as the primary one
        console.log('✅ Sui wallet linked to existing user account. Original wallet address maintained:', currentWalletAddress);

        // Clean up the linking mode flag
        localStorage.removeItem('edit_profile_linking_mode');
        localStorage.removeItem('linking_wallet_type');

        // Refresh the page to show the new connection
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error('Failed to add Sui wallet connection to account');
      }

    } catch (error) {
      console.error('Sui wallet connection error:', error);
      toast.error('Failed to connect with Sui wallet. Please try again.');
      
      // Clean up the linking mode flag on error
      localStorage.removeItem('edit_profile_linking_mode');
      localStorage.removeItem('linking_wallet_type');
    } finally {
      setConnecting(prev => ({ ...prev, sui: false }));
    }
  }, [connecting.sui, currentWalletAddress, select, suiConnected, suiAddress, signMessage]);

  return {
    connecting,
    connectSui
  };
}
