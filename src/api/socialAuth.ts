import { supabase } from '@/lib/supabase';
import { generateUniqueUsername } from '@/utils/usernameUtils';

/**
 * Process a social login attempt using the unified authentication system
 * @param provider The social provider (Google, Discord, etc)
 * @param userInfo Additional user information from the provider
 * @returns Auth data including user information and status
 */
export async function processSocialLogin(provider: string, userInfo: any = {}) {
  try {
    console.log(`Processing ${provider} social login with unified auth system`);

    // For Sui, use the raw wallet address; for others, use the social:provider:uniqueId format
    let socialAddress: string;
    if (provider.toLowerCase() === 'sui') {
      socialAddress = userInfo.wallet_address || userInfo.id;
    } else {
      const uniqueId = userInfo.id || userInfo.email || userInfo.sub || Date.now().toString(36);
      socialAddress = `social:${provider.toLowerCase()}:${uniqueId}`;
    }

    // For new users, we will set username after RPC; for existing, keep current
    // Do not rely on provider names, to avoid inconsistent patterns
    const displayName = undefined as unknown as string; // explicitly avoid passing down

    console.log('Social login details:', {
      provider,
      socialAddress,
      displayName,
      email: userInfo.email
    });

    // Use the unified authentication system
    const { data: authResult, error: authError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: socialAddress,
      login_provider: provider.toLowerCase(),
      login_method: 'social',
      user_email: userInfo.email || null,
      // Critical: never pass profile fields so RPC won't overwrite existing user data
      user_name: null,
      user_avatar: null,
      additional_data: {
        provider_info: userInfo,
        social_login: true
      }
    });

    if (authError) {
      console.error('Authentication error:', authError);
      throw authError;
    }

    if (!authResult || authResult.length === 0) {
      throw new Error('Authentication failed - no user data returned');
    }

    const userData = authResult[0];
    console.log('Authentication successful:', {
      user_id: userData.user_id,
      wallet_address: userData.wallet_address,
      display_name: userData.display_name,
      is_new_user: userData.is_new_user
    });

    // Initialize neftit_ username exactly once using metadata.username_initialized flag after RPC, idempotent
    if (userData.is_new_user) {
      try {
        const { data: freshUser } = await supabase
          .from('users')
          .select('wallet_address, display_name, avatar_url, metadata')
          .eq('wallet_address', userData.wallet_address)
          .single();
        const alreadyInitialized = Boolean(freshUser?.metadata?.username_initialized);
        if (!alreadyInitialized) {
          const currentName = freshUser?.display_name;
          const needsNeftitName = !currentName || !String(currentName).toLowerCase().startsWith('neftit_');
          const newName = needsNeftitName ? (await generateUniqueUsername()) : currentName;
          const initialAvatar = freshUser?.avatar_url || (userInfo.picture || userInfo.profile_image_url || userInfo.avatar || '/profilepictures/profileimg1.jpg');
          await supabase
            .from('users')
            .update({
              display_name: newName,
              avatar_url: initialAvatar,
              metadata: {
                ...(freshUser?.metadata || {}),
                username_initialized: true,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('wallet_address', userData.wallet_address);
          // reflect locally
          userData.display_name = newName;
          userData.avatar_url = initialAvatar;
        }
      } catch (e) {
        console.warn('Non-fatal: username initialization check failed (social)', e);
      }
    }

    // Set up local session with the user's primary wallet address
    setupLocalStorage(userData.wallet_address, provider, new Date().toISOString());

    // Ensure first-session profile edit is allowed for social-created accounts
    try {
      if (userData.is_new_user) {
        // Mark this browser session as new to enable first-time editing in UI
        localStorage.setItem('isNewUserSession', 'true');

        // Ensure server-side flag allows one-time edits
        const { data: freshUser } = await supabase
          .from('users')
          .select('metadata')
          .eq('wallet_address', userData.wallet_address)
          .single();
        const currentMetadata = freshUser?.metadata || {};
        if (!currentMetadata.profile_edit_allowed) {
          await supabase
            .from('users')
            .update({
              metadata: { ...currentMetadata, profile_edit_allowed: true },
              updated_at: new Date().toISOString(),
            })
            .eq('wallet_address', userData.wallet_address);
        }
      }
    } catch (metaErr) {
      console.warn('Non-fatal: failed to set first-session edit flags for social signup', metaErr);
    }

    // Keep profile editing enabled for all users - users should be able to edit their profile anytime
    try {
      if (!userData.is_new_user) {
        const { data: freshUser } = await supabase
          .from('users')
          .select('metadata')
          .eq('wallet_address', userData.wallet_address)
          .single();
        const currentMetadata = freshUser?.metadata || {};
        if (!currentMetadata.profile_edit_allowed) {
          await supabase
            .from('users')
            .update({
              metadata: { ...currentMetadata, profile_edit_allowed: true },
              updated_at: new Date().toISOString(),
            })
            .eq('wallet_address', userData.wallet_address);
        }
      }
    } catch (lockErr) {
      console.warn('Non-fatal: failed to ensure profile edit access (social)', lockErr);
    }

    return {
      success: true,
      userData: {
        id: userData.user_id,
        wallet_address: userData.wallet_address,
        email: userData.email,
        display_name: userData.display_name,
        avatar_url: userData.avatar_url,
        provider: provider.toLowerCase(),
        loginMethod: 'social',
        is_new_user: userData.is_new_user,
        connection_type: userData.connection_type,
        address: userData.wallet_address // For compatibility with existing code
      },
      walletAddress: userData.wallet_address,
      isNewUser: userData.is_new_user
    };

  } catch (error: any) {
    console.error(`${provider} social login error:`, error);
    return {
      success: false,
      error: error.message || `${provider} login failed`,
      walletAddress: null
    };
  }
}

// Helper function to set up localStorage
function setupLocalStorage(address: string, provider: string, timestamp: string) {
  localStorage.setItem('walletAddress', address);
  localStorage.setItem('userAddress', address);
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('walletType', 'social');
  localStorage.setItem('socialProvider', provider);
  localStorage.setItem('lastLogin', timestamp);
  localStorage.setItem('lastAuthenticatedWallet', address);
}

/**
 * Get mock OAuth popup behavior for demonstration
 * In production, this would integrate with real OAuth providers
 * @param provider The OAuth provider to simulate
 * @returns Mock user data
 */
export async function getMockOAuthData(provider: string) {
  // Simulate OAuth flow with a delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Generate mock user data based on provider
  const mockUsers: Record<string, any> = {
    google: {
      id: `google-user-${Math.random().toString(36).substring(7)}`,
      name: 'Google User',
      email: `user-${Math.random().toString(36).substring(7)}@gmail.com`,
      picture: 'https://lh3.googleusercontent.com/a/default-user',
      locale: 'en'
    },
    discord: {
      id: `discord-${Math.random().toString(36).substring(7)}`,
      username: 'DiscordUser',
      discriminator: '1234',
      avatar: null,
      email: `discord-${Math.random().toString(36).substring(7)}@example.com`,
    },
    twitter: {
      id: `twitter-${Math.random().toString(36).substring(7)}`,
      name: 'Twitter User',
      username: `user_${Math.random().toString(36).substring(7)}`,
      profile_image_url: 'https://pbs.twimg.com/profile_images/default.jpg'
    },
    apple: {
      id: `apple-${Math.random().toString(36).substring(7)}`,
      name: 'Apple User',
      email: `apple-${Math.random().toString(36).substring(7)}@icloud.com`
    }
  };

  // Return mock user data for the specified provider
  return mockUsers[provider.toLowerCase()] || {
    id: `${provider}-${Math.random().toString(36).substring(7)}`,
    name: `${provider} User`,
    provider
  };
} 