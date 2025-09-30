import { supabase } from "@/lib/supabase";
import { authenticateUser } from "@/lib/thirdwebAuth";
import { toast } from "sonner";

// Configuration for OAuth providers
const PROVIDERS = {
  google: { name: "Google" },
  discord: { name: "Discord" },
  twitter: { name: "Twitter" },
  X: { name: "X" }, // Support both "X" and "twitter" for compatibility
  // Note: Telegram is NOT an OAuth provider - it uses WebApp authentication
};

/**
 * Initiates an OAuth login flow for the specified provider
 * 
 * @param provider - The OAuth provider to use (google, discord, twitter, etc.)
 */
export async function initiateOAuthLogin(provider: string) {
  try {
    if (!Object.keys(PROVIDERS).includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Set the redirect URL to our callback page
    const redirectTo = `${window.location.origin}/auth/callback`;

    // Normalize provider name - convert "X" to "twitter" for OAuth but keep original for storage
    const normalizedProvider = provider === 'X' ? 'twitter' : provider.toLowerCase();
    
    // Store the provider up-front to avoid race conditions on redirect
    localStorage.setItem('oauth_provider', normalizedProvider);

    // Configure provider-specific options
    const providerOptions: any = {
      redirectTo,
    };

    // Provider-specific configuration
    if (provider === 'twitter' || provider === 'X') {
      // X/Twitter API v2 configuration
      providerOptions.scopes = 'tweet.read users.read offline.access';
      // Note: X API v2 doesn't always provide email
    } else if (provider === 'discord') {
      // Discord specific scopes
      providerOptions.scopes = 'identify email';
    } else {
      // For other providers, request email and profile
      providerOptions.scopes = 'email profile';
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: normalizedProvider as any,
      options: providerOptions
    });

    if (error) {
      throw error;
    }

    // Provider already stored above

    // The user will be redirected to the provider's login page
    // and then back to our callback URL
  } catch (error) {
    console.error("OAuth initiation error:", error);
    throw error;
  }
}

/**
 * Handles the OAuth callback after a user authorizes with a provider
 * 
 * @returns Object containing success status and user data or error
 */
export async function handleOAuthCallback(): Promise<{
  success: boolean;
  error?: string;
  userData?: any;
}> {
  try {
    console.log("Processing OAuth callback");

    // Ensure session is established on callback (handles providers like X/Twitter)
    const currentUrl = new URL(window.location.href);
    const hasCodeParam = !!currentUrl.searchParams.get('code');
    const hasAccessTokenHash = window.location.hash.includes('access_token');

    // If there is an auth code or access token in the URL, attempt to exchange for a session
    if (hasCodeParam || hasAccessTokenHash) {
      try {
        await supabase.auth.exchangeCodeForSession(
          currentUrl.searchParams.get('code') || ''
        );
      } catch (exchangeErr) {
        console.warn('OAuth code exchange failed (may not be necessary):', exchangeErr);
      }
    }

    // Get the session from URL upon return from OAuth provider
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      throw error;
    }

    if (!data.session) {
      throw new Error("No session returned from authentication provider");
    }

    console.log("Session found!", data.session);

    // Get the provider we were using
    const provider = localStorage.getItem('oauth_provider') || 'unknown';

    // Get user data from the session
    const { user } = data.session;

    if (!user) {
      throw new Error("No user data in session");
    }

    // Get the user's identity information
    const identities = user.identities || [];
    const storedProvider = (localStorage.getItem('oauth_provider') || '').toLowerCase();
    const identity = identities.find((i: any) => (i.provider || '').toLowerCase() === storedProvider) || identities[0];

    if (!identity) {
      throw new Error("No identity information in user data");
    }

    console.log("Identity found:", identity.provider);

    // Extract identity data
    const identityData = identity.identity_data || {};

    // Create a unique wallet address for social login users
    const normalizedProvider = (identity.provider || storedProvider || 'unknown').toLowerCase();
    const providerUniqueId = identity.id || identity.identity_data?.sub || identity.identity_data?.user_id || identity.identity_data?.id || user.id;
    const socialWalletAddress = `social:${normalizedProvider}:${providerUniqueId}`;

    // Check if this is for additional connection linking
    const connectionMode = localStorage.getItem('connection_mode');
    const isAdditionalConnection = connectionMode === 'additional';

    console.log(`OAuth mode: ${isAdditionalConnection ? 'ADDITIONAL' : 'PRIMARY'} connection`);

    // For ADDITIONAL connections, just return the user data without creating/logging in
    if (isAdditionalConnection) {
      console.log('📋 ADDITIONAL MODE: Returning user data for linking without authentication');

      return {
        success: true,
        userData: {
          address: socialWalletAddress,
          wallet_address: socialWalletAddress,
          provider: normalizedProvider,
          name: identityData.full_name ||
            identityData.name ||
            identityData.user_name ||
            identityData.username ||
            user.email?.split('@')[0] ||
            `${normalizedProvider} User`,
          email: user.email || null, // Twitter might not provide email
          avatar: identityData.avatar_url ||
            identityData.picture ||
            identityData.profile_image_url ||
            undefined,
          username: identityData.username || identityData.user_name || identityData.name || null,
          is_new_user: false // This is always false for additional connections
        }
      };
    }

    // For PRIMARY connections, use the full social login system
    console.log('🚀 PRIMARY MODE: Processing full social login');

    // Use the unified social login system instead of authenticateUser directly
    const socialResult = await import('@/api/socialAuth').then(module =>
      module.processSocialLogin(identity.provider, {
        id: identity.id,
        email: user.email,
        name: identityData.full_name ||
          identityData.name ||
          identityData.user_name ||
          user.email?.split('@')[0] ||
          'User',
        picture: identityData.avatar_url ||
          identityData.picture ||
          undefined,
        ...identityData
      })
    );

    if (!socialResult.success) {
      throw new Error(socialResult.error || "Failed to authenticate user");
    }

    // Store auth token from Supabase session
    localStorage.setItem('supabase_access_token', data.session.access_token);
    localStorage.setItem('supabase_refresh_token', data.session.refresh_token);

    // Set our app's authentication state
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userAddress', socialWalletAddress);
    localStorage.setItem('walletType', 'social');
    localStorage.setItem('socialProvider', provider);

    return {
      success: true,
      userData: {
        address: socialResult.userData?.address || socialWalletAddress,
        wallet_address: socialResult.userData?.wallet_address || socialWalletAddress,
        provider: identity.provider,
        name: socialResult.userData?.display_name || 'User',
        email: user.email,
        avatar: socialResult.userData?.avatar_url,
        is_new_user: socialResult.isNewUser || false
      }
    };
  } catch (error) {
    console.error("OAuth callback error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during authentication",
    };
  }
} 