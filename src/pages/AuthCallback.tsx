import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleOAuthCallback } from '@/api/oauth';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function processOAuthRedirect() {
      try {
        console.log('🔄 Processing OAuth redirect with unified auth system...');

        // Handle OAuth callback
        const result = await handleOAuthCallback();

        if (!result.success) {
          console.error('❌ OAuth callback failed:', result.error);
          toast.error(result.error || 'Authentication failed');
          navigate('/');
          return;
        }

        console.log('✅ OAuth callback successful:', result);

        // Check if this is an additional connection mode
        const connectionMode = localStorage.getItem('connection_mode');
        const primaryWalletAddress = localStorage.getItem('primary_wallet_address');

        console.log('🔗 Connection mode check:', {
          connectionMode,
          primaryWalletAddress,
          hasUserData: !!result.userData
        });

        if (connectionMode === 'additional' && primaryWalletAddress && result.userData) {
          console.log('🔗 ADDITIONAL CONNECTION MODE - linking to existing account');

          // Use unified system to link additional provider
          const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
            target_user_address: primaryWalletAddress,
            new_address: result.userData.address,
            new_provider: result.userData.provider || 'unknown',
            link_method: 'social',
            provider_email: result.userData.email || null,
            provider_id: result.userData.address?.split(':')[2] || 'unknown',
            provider_username: result.userData.username || result.userData.name || null
          });

          if (linkError) {
            console.error('❌ Failed to link additional social account:', linkError);
            toast.error('Failed to link social account. It may already be connected to another user.');
          } else if (linkResult) {
            console.log('✅ Successfully linked additional social account');
            // Use the correct provider name from localStorage or result
            const providerName = localStorage.getItem('oauth_provider') || result.userData.provider || 'Unknown';
            toast.success(`${providerName.charAt(0).toUpperCase() + providerName.slice(1)} account linked successfully!`);
          } else {
            console.warn('⚠️ Link operation returned false - account may already be linked');
            const providerName = localStorage.getItem('oauth_provider') || result.userData.provider || 'Unknown';
            toast.warning(`${providerName.charAt(0).toUpperCase() + providerName.slice(1)} account is already connected.`);
          }

          // Clean up temporary storage
          localStorage.removeItem('connection_mode');
          localStorage.removeItem('primary_wallet_address');
          localStorage.removeItem('oauth_provider');

          // Redirect back to edit profile
          navigate('/edit-profile');
          return;
        }

        // Standard PRIMARY login flow (not additional connection)
        console.log('🚀 PRIMARY LOGIN MODE - processing with unified auth');
        console.log('Social address:', result.userData?.address);

        // The unified auth system already handled user creation/detection in the social auth process
        // We just need to set up the session and redirect

        if (result.userData && result.userData.wallet_address) {
          // Set up local session
          localStorage.setItem('walletAddress', result.userData.wallet_address);
          localStorage.setItem('userAddress', result.userData.wallet_address);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('walletType', 'social');
          localStorage.setItem('socialProvider', result.userData.provider || 'unknown');
          localStorage.setItem('lastLogin', new Date().toISOString());
          localStorage.setItem('lastAuthenticatedWallet', result.userData.wallet_address);

          if (result.userData.is_new_user) {
            console.log('🎉 New user created successfully');
            toast.success(`Welcome! Your ${result.userData.provider} account has been linked.`);
          } else {
            console.log('👋 Existing user logged in successfully');
            toast.success(`Welcome back! Logged in with ${result.userData.provider}.`);
          }

          // Redirect to discover page after successful login
          console.log('🚀 Redirecting to discover page...');
          window.location.replace('/discover');
        } else {
          throw new Error('No user data received from authentication');
        }

      } catch (error: any) {
        console.error('❌ OAuth processing error:', error);
        toast.error('Authentication failed. Please try again.');

        // Clean up any temporary storage
        localStorage.removeItem('connection_mode');
        localStorage.removeItem('primary_wallet_address');

        navigate('/');
      }
    }

    processOAuthRedirect();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-white mb-2">Completing Authentication...</h2>
        <p className="text-gray-400">Please wait while we set up your account.</p>
      </div>
    </div>
  );
} 