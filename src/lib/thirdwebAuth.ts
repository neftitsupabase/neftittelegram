import { supabase, createSupabaseClient } from './supabase';

// Configure auth with domain for verification
const domain = import.meta.env.VITE_AUTH_DOMAIN || window.location.origin;

interface AuthPayload {
  provider?: string;
  loginMethod?: string;
  timestamp?: string;
  [key: string]: any;
}

interface UserData {
  wallet_address: string;
  metadata: AuthPayload;
  updated_at: string;
  last_login: string;
  display_name: string;
  wallet_type?: string;
  created_at?: string;
}

/**
 * Handles post-authentication actions like navigation
 * @param address The authenticated wallet address
 * @param userData User data returned from authentication
 */
export function handlePostAuth(address: string, userData: any) {
  // Set essential authentication state
  localStorage.setItem('walletAddress', address);
  localStorage.setItem('isAuthenticated', 'true');

  // Detect wallet type if available (especially for MetaMask)
  if (window.ethereum?.isMetaMask) {
    localStorage.setItem('walletType', 'metamask');

    // Attempt to update wallet type in database
    try {
      supabase
        .from('users')
        .update({ wallet_type: 'metamask' })
        .filter('wallet_address', 'eq', address)
        .then(({ error }) => {
          if (error) console.error('Error updating wallet type:', error);
        });
    } catch (e) {
      console.error('Failed to update wallet type:', e);
    }
  }

  // Optional: Add timestamp for login tracking
  localStorage.setItem('lastLogin', new Date().toISOString());

  console.log('Authentication complete, user data and state updated');
}

/**
 * Authenticates a user and syncs their data with Supabase
 * @param address The wallet address or social login ID
 * @param payload Additional auth data
 * @returns Object indicating success/failure and any error messages
 */
export async function authenticateUser(
  address: string,
  payload: AuthPayload = {}
): Promise<{ success: boolean; error?: string; userData?: any }> {
  try {
    console.log(`🚀 Authenticating user with unified system - address: ${address}`);
    console.log("🎯 Payload:", payload);

    // Check if we have a valid Supabase client
    if (!supabase) {
      console.error('Supabase client not initialized');
      return {
        success: false,
        error: 'Database connection not available'
      };
    }

    // Create a display name based on available data
    const displayName = payload.name ||
      payload.email?.split('@')[0] ||
      address.substring(0, 6) + '...' + address.substring(address.length - 4);

    // Determine if this is a social login or wallet login
    const loginMethod = payload.loginMethod || (address.startsWith('social:') ? 'social' : 'wallet');
    const provider = payload.provider || (loginMethod === 'wallet' ? 'metamask' : 'unknown');

    console.log('Authentication details:', {
      address,
      loginMethod,
      provider,
      displayName
    });

    // Use the unified authentication system
    const { data: authResult, error: authError } = await supabase.rpc('authenticate_or_create_user', {
      login_address: address,
      login_provider: provider,
      login_method: loginMethod,
      user_email: payload.email || null,
      user_name: displayName,
      user_avatar: payload.avatar || null,
      additional_data: {
        payload: payload,
        timestamp: payload.timestamp || new Date().toISOString()
      }
    });

    if (authError) {
      console.error('Authentication error:', authError);
      // Fall back to old method if unified auth isn't available yet
      console.log('Falling back to legacy authentication method...');
      return authenticateUserLegacy(address, payload);
    }

    if (!authResult || authResult.length === 0) {
      throw new Error('Authentication failed - no user data returned');
    }

    const userData = authResult[0];
    console.log('Unified authentication successful:', {
      user_id: userData.user_id,
      wallet_address: userData.wallet_address,
      display_name: userData.display_name,
      is_new_user: userData.is_new_user
    });

    return {
      success: true,
      userData: {
        id: userData.user_id,
        wallet_address: userData.wallet_address,
        email: userData.email,
        display_name: userData.display_name,
        avatar_url: userData.avatar_url,
        provider: provider,
        loginMethod: loginMethod,
        is_new_user: userData.is_new_user,
        connection_type: userData.connection_type
      }
    };

  } catch (error: any) {
    console.error("Authentication error:", error);

    // Fall back to legacy method if unified auth fails
    console.log('Falling back to legacy authentication method due to error...');
    return authenticateUserLegacy(address, payload);
  }
}

// Legacy authentication method as fallback
async function authenticateUserLegacy(
  address: string,
  payload: AuthPayload = {}
): Promise<{ success: boolean; error?: string; userData?: any }> {
  try {
    console.log(`Using legacy authentication for address: ${address}`);

    // Extract important data from payload
    const providerName = payload.provider || 'wallet';
    const timestamp = new Date().toISOString();

    // Format display name based on address or provider info
    const displayName = payload.name ||
      (payload.provider ?
        `${payload.provider} User` :
        address.substring(0, 6) + '...' + address.substring(address.length - 4));

    // Check if user exists using filter to handle special characters
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .filter('wallet_address', 'eq', address)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means not found, which is fine - we'll create the user
      console.error('Error checking user existence:', fetchError);
    }

    // Create user data object matching exact schema columns
    const userData = {
      wallet_address: address,
      email: payload.email || null,
      display_name: displayName,
      avatar_url: payload.avatar || null,
      updated_at: timestamp,
      last_login: timestamp
    };

    // Only include social_provider for social logins, not for wallet logins
    if (payload.provider && payload.loginMethod === 'social') {
      // For social logins, ensure we have a unique social_provider
      userData['social_provider'] = payload.provider;
    }

    // For wallet logins, set wallet_type if available
    if (payload.loginMethod === 'wallet' && payload.provider) {
      userData['wallet_type'] = payload.provider;
    }

    // If user doesn't exist, add created_at timestamp
    if (!existingUser) {
      userData['created_at'] = timestamp;
    }

    try {
      let result;

      if (existingUser) {
        // Update existing user with filter instead of eq
        result = await supabase
          .from('users')
          .update(userData)
          .filter('wallet_address', 'eq', address)
          .select();
      } else {
        // Insert new user
        result = await supabase
          .from('users')
          .insert(userData)
          .select();
      }

      if (result.error) {
        console.error('Database operation error:', result.error);
        console.error('Error details:', {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint
        });
        return {
          success: false,
          error: `Database error: ${result.error.message}`
        };
      }

      console.log('Database operation successful:', result.data);

      // Set up localStorage state
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('lastLogin', timestamp);

      if (payload.provider) {
        if (payload.loginMethod === 'social') {
          localStorage.setItem('walletType', 'social');
          localStorage.setItem('socialProvider', payload.provider);
        } else if (payload.loginMethod === 'wallet') {
          localStorage.setItem('walletType', payload.provider);
        }
      } else if (window.ethereum?.isMetaMask) {
        localStorage.setItem('walletType', 'metamask');
      }

      console.log('Authentication successful');
      return {
        success: true,
        userData: result.data?.[0] || userData
      };
    } catch (dbError) {
      console.error('Database operation error:', dbError);

      // Even if DB fails, set minimal auth state
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('isAuthenticated', 'true');

      return {
        success: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      };
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown authentication error'
    };
  }
}

/**
 * Gets user profile combining ThirdWeb and Supabase data
 * @param walletAddress User's wallet address
 * @returns User profile with combined data
 */
export const getUserProfile = async (walletAddress: string) => {
  try {
    if (!walletAddress) return null;

    // Check if we have a valid Supabase client
    if (!supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    // Get Supabase profile data - using filter for special character handling
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .filter('wallet_address', 'eq', walletAddress)
      .single();

    if (error) {
      console.error("Error fetching user profile from Supabase:", error);

      // Try again with a delay
      try {
        // We'll use the same client but with a delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: retryData, error: retryError } = await supabase
          .from('users')
          .select('*')
          .filter('wallet_address', 'eq', walletAddress)
          .single();

        if (retryError) {
          console.error("Retry error fetching user profile:", retryError);
          return null;
        }

        return retryData;
      } catch (retryError) {
        console.error("Retry operation failed:", retryError);
        return null;
      }
    }

    return userData;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}; 