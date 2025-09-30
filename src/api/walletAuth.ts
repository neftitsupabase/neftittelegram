import { supabase } from '@/lib/supabase';
import { generateUniqueUsername } from '@/utils/usernameUtils';

/**
 * Process a wallet login attempt using the unified authentication system
 * @param walletAddress The wallet address
 * @param walletType The wallet type (metamask, phantom, walletconnect, sui)
 * @param userInfo Additional user information
 * @returns Auth data including user information and status
 */
export async function processWalletLogin(walletAddress: string, walletType: string, userInfo: any = {}) {
  try {
    console.log(`Processing ${walletType} wallet login with unified auth system`);
    console.log('Wallet login details:', {
      walletType,
      walletAddress: walletAddress.substring(0, 10) + '...',
      userInfo
    });
    
    // For new users, generate a unique username
    // For existing users, use their current display name
    let displayName = userInfo.name || userInfo.displayName;
    
    // If no display name provided, generate a unique username for new users
    if (!displayName) {
      displayName = await generateUniqueUsername();
      console.log('Generated unique username for new user:', displayName);
    }
    
    // Use the unified authentication system
    const { data: authResult, error: authError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: walletAddress,
      login_provider: walletType.toLowerCase(),
      login_method: 'wallet',
      user_email: userInfo.email || null,
      // Critical: never pass profile fields so RPC won't overwrite existing user data
      user_name: null,
      user_avatar: null,
      additional_data: {
        wallet_info: userInfo,
        wallet_login: true,
        wallet_type: walletType
      }
    });
    
    if (authError) {
      console.error('Wallet authentication error:', authError);
      throw authError;
    }
    
    if (!authResult || authResult.length === 0) {
      throw new Error('Wallet authentication failed - no user data returned');
    }
    
    const userData = authResult[0];
    console.log('Wallet authentication successful:', {
      user_id: userData.user_id,
      wallet_address: userData.wallet_address,
      display_name: userData.display_name,
      is_new_user: userData.is_new_user
    });
    
    // If this is a brand new user, initialize neftit_ username exactly once using a metadata flag
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
          const initialName = needsNeftitName ? (await generateUniqueUsername()) : currentName as string;
          const initialAvatar = freshUser?.avatar_url || (userInfo.avatar_url || '/profilepictures/profileimg1.jpg');
          await supabase
            .from('users')
            .update({
              display_name: initialName,
              avatar_url: initialAvatar,
              metadata: {
                ...(freshUser?.metadata || {}),
                username_initialized: true,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('wallet_address', userData.wallet_address);
          // Reflect in local object for downstream consumers
          userData.display_name = initialName;
          userData.avatar_url = initialAvatar;
        }
      } catch (initErr) {
        console.warn('Non-fatal: failed to set initial profile fields for new wallet user', initErr);
      }
    }

    // Set up local session with the user's primary wallet address
    setupLocalStorage(userData.wallet_address, walletType, new Date().toISOString());

    // Ensure first-session profile edit is allowed for wallet-created accounts
    try {
      if (userData.is_new_user) {
        // Mark this browser session as new to enable first-time editing in UI
        localStorage.setItem('isNewUserSession', 'true');

        // Ensure server-side flag allows one-time edits
        const currentMetadata = userData.metadata || {};
        if (!currentMetadata.profile_edit_allowed) {
          await supabase
            .from('users')
            .update({
              metadata: {
                ...currentMetadata,
                profile_edit_allowed: true,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('wallet_address', userData.wallet_address);
        }
      } else {
        // Keep profile editing enabled for existing users - users should be able to edit their profile anytime
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
      console.warn('Non-fatal: failed to set first-session edit flags for wallet signup', metaErr);
    }
    
    return {
      success: true,
      userData: {
        id: userData.user_id, 
        wallet_address: userData.wallet_address,
        email: userData.email,
        display_name: userData.display_name,
        avatar_url: userData.avatar_url,
        provider: walletType.toLowerCase(),
        loginMethod: 'wallet',
        is_new_user: userData.is_new_user,
        connection_type: userData.connection_type,
        address: userData.wallet_address // For compatibility with existing code
      },
      walletAddress: userData.wallet_address,
      isNewUser: userData.is_new_user
    };
    
  } catch (error: any) {
    console.error(`${walletType} wallet login error:`, error);
    return {
      success: false,
      error: error.message || `${walletType} wallet login failed`,
      walletAddress: null
    };
  }
}

// Helper function to set up localStorage
function setupLocalStorage(address: string, walletType: string, timestamp: string) {
  localStorage.setItem('walletAddress', address);
  localStorage.setItem('userAddress', address);
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('walletType', walletType === 'sui' ? 'sui' : 'evm');
  localStorage.setItem('lastLogin', timestamp);
  localStorage.setItem('lastAuthenticatedWallet', address);
  
  // Store wallet-specific info
  if (walletType === 'sui') {
    localStorage.setItem('socialProvider', 'sui');
  }
}
