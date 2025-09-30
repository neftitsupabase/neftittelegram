import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { initiateOAuthLogin, handleOAuthCallback } from '@/api/oauth';
import { authenticateUser } from '@/lib/thirdwebAuth';
import { useUserConnections } from './useUserConnections';
import { getWalletAddress } from '@/utils/authUtils';
import { supabase } from '@/lib/supabase';

export interface ConnectProviderOptions {
  onSuccess?: (provider: string, data: any) => void;
  onError?: (error: string) => void;
  mode?: 'primary' | 'additional'; // primary = new login, additional = add to existing account
}

export function useConnectProvider(options: ConnectProviderOptions = {}) {
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const currentWalletAddress = getWalletAddress();
  
  // Debug current address format
  useEffect(() => {
    if (currentWalletAddress) {
      console.log('🔍 Current wallet address for connecting:', currentWalletAddress);
      console.log('🔍 Address type:', currentWalletAddress.startsWith('social:') ? 'social' : 'wallet');
    }
  }, [currentWalletAddress]);
  
  const { addSocialConnection, addWalletConnection } = useUserConnections(currentWalletAddress);

  // Check if wallet address already exists in any user account using unified system
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

  // Link existing wallet to current user account using unified system
  const linkExistingWalletToUser = async (walletAddress: string, walletType: string) => {
    try {
      if (!currentWalletAddress) {
        throw new Error('No current user session found');
      }

      const { data, error } = await supabase.rpc('link_additional_provider', {
        target_user_address: currentWalletAddress,
        new_address: walletAddress,
        new_provider: walletType,
        link_method: 'wallet'
      });

      if (error) {
        console.error('Error linking existing wallet:', error);
        return false;
      }

      return data;
    } catch (err) {
      console.error('Error in linkExistingWalletToUser:', err);
      return false;
    }
  };

  // Link existing social account to current user account using unified system
  const linkExistingSocialToUser = async (provider: string, providerId: string, email?: string, socialAddress?: string) => {
    try {
      if (!currentWalletAddress) {
        throw new Error('No current user session found');
      }

      const { data, error } = await supabase.rpc('link_additional_provider', {
        target_user_address: currentWalletAddress,
        new_address: socialAddress || `social:${provider}:${providerId}`,
        new_provider: provider,
        link_method: 'social',
        provider_email: email,
        provider_id: providerId
      });

      if (error) {
        console.error('Error linking existing social account:', error);
        return false;
      }

      return data;
    } catch (err) {
      console.error('Error in linkExistingSocialToUser:', err);
      return false;
    }
  };

  const connectSocialProvider = async (provider: string) => {
    if (connecting[provider]) return;

    try {
      setConnecting(prev => ({ ...prev, [provider]: true }));
      setError(null);
      
      const mode = options.mode || (currentWalletAddress ? 'additional' : 'primary');
      
      console.log('🔗 CONNECT SOCIAL PROVIDER:', {
        provider,
        mode,
        currentWalletAddress,
        optionsMode: options.mode
      });
      
      if (mode === 'additional' && !currentWalletAddress) {
        throw new Error('No current user session found for additional connection');
      }

      // CRITICAL: Store connection mode and current user info for callback
      console.log('💾 Storing connection mode:', mode);
      localStorage.setItem('connection_mode', mode);
      
      if (mode === 'additional') {
        console.log('💾 Storing primary wallet address:', currentWalletAddress);
        localStorage.setItem('primary_wallet_address', currentWalletAddress!);
      }
      
      // Verify storage
      console.log('✅ Verification - localStorage contents:', {
        connection_mode: localStorage.getItem('connection_mode'),
        primary_wallet_address: localStorage.getItem('primary_wallet_address')
      });
      
      toast.info(`Connecting to ${provider}...`);
      
      // Handle Telegram differently since it doesn't use OAuth
      if (provider === 'telegram') {
        // Store provider info for Telegram callback
        localStorage.setItem('oauth_provider', provider);
        
        // Try to open Telegram authentication modal first
        const event = new CustomEvent('openTelegramAuth', {
          detail: { mode: 'additional' }
        });
        window.dispatchEvent(event);
        
        // If modal is not available (e.g., in edit profile), use standalone auth
        setTimeout(async () => {
          try {
            const { initiateTelegramAuth, processTelegramAuthSuccess } = await import('@/utils/telegramAuth');
            
            // Check if modal handled the authentication
            const modalHandled = localStorage.getItem('telegram_auth_handled');
            if (modalHandled) {
              localStorage.removeItem('telegram_auth_handled');
              return;
            }
            
            // Use standalone authentication
            console.log('🔗 Using standalone Telegram authentication for edit profile');
            const user = await initiateTelegramAuth();
            await processTelegramAuthSuccess(user, 'additional');
            
            // Call success callback
            if (options.onSuccess) {
              options.onSuccess(provider, user);
            }
            
          } catch (error) {
            console.error('❌ Standalone Telegram authentication failed:', error);
            if (options.onError) {
              options.onError(error instanceof Error ? error.message : 'Telegram authentication failed');
            }
          } finally {
            // Reset connecting state
            setConnecting(prev => ({ ...prev, [provider]: false }));
          }
        }, 100); // Small delay to allow modal to handle if available
        
        // Don't set connecting to false here - let Telegram auth handle it
        return;
      } else {
        // Initiate OAuth login for other providers
        await initiateOAuthLogin(provider);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ ${provider} connection error:`, err);
      toast.error(`Connection failed: ${errorMessage}`);
      setError(errorMessage);
      
      // Only clean up connecting state for non-Telegram providers
      if (provider !== 'telegram') {
        setConnecting(prev => ({ ...prev, [provider]: false }));
      }
      
      // Clean up on error
      localStorage.removeItem('connection_mode');
      localStorage.removeItem('primary_wallet_address');
      
      options.onError?.(errorMessage);
    }
  };

  const connectWalletProvider = async (walletType: string) => {
    if (connecting[walletType]) return;

    try {
      setConnecting(prev => ({ ...prev, [walletType]: true }));
      setError(null);

      const mode = options.mode || (currentWalletAddress ? 'additional' : 'primary');

      if (mode === 'additional' && !currentWalletAddress) {
        throw new Error('No current user session found for additional connection');
      }

      toast.info(`Connecting ${walletType} wallet...`);

      // For additional connections, we need to connect the wallet and add it to existing user
      if (mode === 'additional') {
        // Handle different wallet types
        if (walletType === 'metamask') {
          await connectMetaMask();
        } else if (walletType === 'phantom') {
          await connectPhantom();
        } else if (walletType === 'walletconnect') {
          await connectWalletConnect();
        } else if (walletType === 'coinbase') {
          await connectCoinbase();
        } else if (walletType === 'sui') {
          await connectSui();
        } else {
          throw new Error(`Unsupported wallet type: ${walletType}`);
        }
      } else {
        // Primary connection - handled by existing wallet provider logic
        toast.info('Please use the main wallet connection for primary login');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`${walletType} connection error:`, err);
      toast.error(`Connection failed: ${errorMessage}`);
      setError(errorMessage);
      setConnecting(prev => ({ ...prev, [walletType]: false }));
      options.onError?.(errorMessage);
    }
  };

  // MetaMask connection
  const connectMetaMask = async () => {
    try {
      if (!window.ethereum || !window.ethereum.isMetaMask) {
        throw new Error('MetaMask is not installed. Please install it to continue.');
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const walletAddress = accounts[0];

      if (!walletAddress) {
        throw new Error('No account selected');
      }

      console.log('🔗 MetaMask connected:', walletAddress);

      // Check if this wallet address already exists in any user account
      const existingUser = await checkExistingUserByWallet(walletAddress);
      
      if (existingUser && existingUser.existing_user_wallet_address !== currentWalletAddress) {
        // Wallet already connected to another user
        toast.error(`This wallet is already connected to another user account (${existingUser.existing_user_display_name || 'Unknown'})`);
        throw new Error('Wallet already connected to another user');
      }

      // Add to existing user account
      const success = await addWalletConnection(walletAddress, 'metamask');
      
      if (success) {
        toast.success('MetaMask wallet connected successfully!');
        options.onSuccess?.('metamask', { address: walletAddress, type: 'metamask' });
        
        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('wallet-connected-additional', {
          detail: { walletName: 'metamask', address: walletAddress, type: 'metamask' }
        }));
      } else {
        throw new Error('Failed to add MetaMask connection to account');
      }

    } catch (error) {
      console.error('MetaMask connection error:', error);
      throw error;
    } finally {
      setConnecting(prev => ({ ...prev, metamask: false }));
    }
  };

  // Phantom connection
  const connectPhantom = async () => {
    try {
      const provider = window.solana;
      if (!provider || !provider.isPhantom) {
        throw new Error('Phantom wallet is not installed. Please install it to continue.');
      }

      // Connect to Phantom
      const resp = await provider.connect();
      const walletAddress = resp.publicKey?.toString();

      if (!walletAddress) {
        throw new Error('No account selected');
      }

      console.log('🔗 Phantom connected:', walletAddress);

      // Check if this wallet address already exists in any user account
      const existingUser = await checkExistingUserByWallet(walletAddress);
      
      if (existingUser && existingUser.existing_user_wallet_address !== currentWalletAddress) {
        // Wallet already connected to another user
        toast.error(`This wallet is already connected to another user account (${existingUser.existing_user_display_name || 'Unknown'})`);
        throw new Error('Wallet already connected to another user');
      }

      // Add to existing user account
      const success = await addWalletConnection(walletAddress, 'phantom');
      
      if (success) {
        toast.success('Phantom wallet connected successfully!');
        options.onSuccess?.('phantom', { address: walletAddress, type: 'phantom' });
        
        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('wallet-connected-additional', {
          detail: { walletName: 'phantom', address: walletAddress, type: 'phantom' }
        }));
      } else {
        throw new Error('Failed to add Phantom connection to account');
      }

    } catch (error) {
      console.error('Phantom connection error:', error);
      throw error;
    } finally {
      setConnecting(prev => ({ ...prev, phantom: false }));
    }
  };

  // WalletConnect connection
  const connectWalletConnect = async () => {
    try {
      // For WalletConnect, we'll use a simple approach that works with the existing system
      // Since WalletConnect requires QR code scanning and complex setup, 
      // we'll prompt the user to connect via the main wallet modal
      toast.info('Please connect WalletConnect through the main wallet connection modal first, then return here to link it.');
      
      // Store a flag to indicate we want to link WalletConnect after connection
      localStorage.setItem('link_wallet_after_connect', 'walletconnect');
      
      // Redirect to main page where wallet modal is available
      window.location.href = '/?openWalletModal=true&walletType=walletconnect';
      
    } catch (error) {
      console.error('WalletConnect connection error:', error);
      throw error;
    } finally {
      setConnecting(prev => ({ ...prev, walletconnect: false }));
    }
  };

  // Coinbase Wallet connection
  const connectCoinbase = async () => {
    try {
      // For Coinbase Wallet, we'll use a simplified approach
      toast.info('Coinbase Wallet integration coming soon. Please use MetaMask or Phantom for now.');
      throw new Error('Coinbase Wallet not yet implemented');
    } catch (error) {
      console.error('Coinbase Wallet connection error:', error);
      throw error;
    }
  };

  // Sui wallet connection
  const connectSui = async () => {
    try {
      // For Sui wallet, we'll use a simple approach that works with the existing system
      // Since Sui wallet requires specific setup and signing, 
      // we'll prompt the user to connect via the main wallet modal
      toast.info('Please connect Sui wallet through the main wallet connection modal first, then return here to link it.');
      
      // Store a flag to indicate we want to link Sui after connection
      localStorage.setItem('link_wallet_after_connect', 'sui');
      
      // Redirect to main page where wallet modal is available
      window.location.href = '/?openWalletModal=true&walletType=sui';
      
    } catch (error) {
      console.error('Sui wallet connection error:', error);
      throw error;
    } finally {
      setConnecting(prev => ({ ...prev, sui: false }));
    }
  };

  // Handle OAuth callback for additional connections
  const handleAdditionalOAuthCallback = async () => {
    try {
      const connectionMode = localStorage.getItem('connection_mode');
      const primaryWalletAddress = localStorage.getItem('primary_wallet_address');

      if (connectionMode !== 'additional' || !primaryWalletAddress) {
        // Not an additional connection, handle normally
        return false;
      }

      const result = await handleOAuthCallback();
      
      if (result.success && result.userData) {
        const { provider, name, email, username } = result.userData;
        const socialAddress = result.userData.address;
        const providerId = socialAddress?.split(':')[2] || 'unknown';

        // Check if this social account already exists in any user account
        const existingUser = await checkExistingUserByWallet(socialAddress);
        
        if (existingUser && existingUser.existing_user_wallet_address !== primaryWalletAddress) {
          // Social account already connected to another user
          toast.error(`This ${provider} account is already connected to another user account (${existingUser.existing_user_display_name || 'Unknown'})`);
          throw new Error('Social account already connected to another user');
        }

        // Add as additional connection instead of creating new user
        const success = await addSocialConnection(
          provider,
          providerId,
          email,
          socialAddress,
          username || name || null
        );

        if (success) {
          toast.success(`${provider} account connected successfully!`);
          options.onSuccess?.(provider, result.userData);
          
          // Clean up temporary storage
          localStorage.removeItem('connection_mode');
          localStorage.removeItem('primary_wallet_address');
          
          return true;
        } else {
          throw new Error('Failed to add social connection');
        }
      } else {
        throw new Error(result.error || 'OAuth callback failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Additional OAuth callback error:', err);
      toast.error(`Connection failed: ${errorMessage}`);
      setError(errorMessage);
      options.onError?.(errorMessage);
      
      // Clean up temporary storage
      localStorage.removeItem('connection_mode');
      localStorage.removeItem('primary_wallet_address');
      
      return false;
    }
  };

  const disconnectProvider = async (type: 'social' | 'wallet', identifier: string) => {
    try {
      setError(null);
      
      // Note: This function is not used directly in the current implementation
      // Disconnect is handled directly in EditProfile.tsx via the connection hooks
      console.log(`Disconnect ${type} provider: ${identifier}`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Disconnect error:', err);
      toast.error(`Disconnect failed: ${errorMessage}`);
      setError(errorMessage);
      return false;
    }
  };

  return {
    connecting,
    error,
    connectSocialProvider,
    connectWalletProvider,
    disconnectProvider,
    handleAdditionalOAuthCallback,
    checkExistingUserByWallet,
    linkExistingWalletToUser,
    linkExistingSocialToUser
  };
}
