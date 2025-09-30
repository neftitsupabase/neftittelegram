import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import {
  useAddress,
  useConnectionStatus,
  useDisconnect,
  useChain,
  useBalance,
  ConnectWallet,
  useConnect,
  metamaskWallet,
  coinbaseWallet,
  phantomWallet,
  trustWallet,
  rainbowWallet,
  WalletOptions
} from "@thirdweb-dev/react";
import { authenticateUser, getUserProfile, handlePostAuth } from "@/lib/thirdwebAuth";
import { processSocialLogin, getMockOAuthData } from "@/api/socialAuth";
import { useWallet as useSuiWallet } from '@suiet/wallet-kit';
import { useUpsertUser } from '@/hooks/useUpsertUser';
import { supabase } from '@/lib/supabase';


type WalletType = "evm" | "solana" | "sui" | "social";

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  connect: (type?: WalletType | string) => Promise<void>;
  disconnect: () => void;
  isAuthenticated: boolean;
  walletType: WalletType | null;
  balance: number;
  stakedAmount: number;
  updateBalance: (newBalance: number) => void;
  updateStakedAmount: (newStakedAmount: number) => void;
}

const WalletContext = createContext<WalletContextType & { connecting: boolean }>({
  address: null,
  isConnected: false,
  connect: async () => { },
  disconnect: () => { },
  isAuthenticated: false,
  walletType: null,
  balance: 0,
  stakedAmount: 0,
  updateBalance: () => { },
  updateStakedAmount: () => { },
  connecting: false,
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  // ThirdWeb hooks
  const thirdwebAddress = useAddress();
  const thirdwebConnectionStatus = useConnectionStatus();
  const thirdwebDisconnect = useDisconnect();
  const thirdwebConnect = useConnect();
  const currentChain = useChain();
  const { data: walletBalance } = useBalance();

  // Local state
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [stakedAmount, setStakedAmount] = useState<number>(0);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectionAttempt, setConnectionAttempt] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [walletConnectionStatus, setWalletConnectionStatus] = useState<{
    status: string;
    message: string;
    error?: string;
  }>({ status: "disconnected", message: "Not connected" });

  // Track if this is the initial load to prevent auto-connection
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasAuthenticated, setHasAuthenticated] = useState(false);
  const { address: suiAddress, connected: suiConnected } = useSuiWallet();
  const { upsertUser } = useUpsertUser();

  // Update local state when ThirdWeb state changes
  useEffect(() => {
    const savedAddress = localStorage.getItem("walletAddress") || localStorage.getItem("userAddress");
    const savedAuthStatus = localStorage.getItem("isAuthenticated");
    const savedWalletType = localStorage.getItem("walletType") as WalletType;
    const savedBalance = localStorage.getItem("walletBalance");
    const savedStakedAmount = localStorage.getItem("stakedAmount");
    const socialProvider = localStorage.getItem("socialProvider");

    if (thirdwebAddress) {
      console.log("ThirdWeb address updated:", thirdwebAddress);
      setAddress(thirdwebAddress);
      setIsConnected(true);

      // Update localStorage with the real address
      localStorage.setItem("walletAddress", thirdwebAddress);
      localStorage.setItem("isAuthenticated", "true");

      // If we were connecting and now we have an address, we're done connecting
      if (connecting && connectionAttempt > 0) {
        setConnecting(false);

        // Only show success once per connection attempt
        if (connectionAttempt === 1) {
          toast.success("Wallet connected successfully!");
        }
      }
    } else if (savedAddress && !thirdwebAddress) {
      setAddress(savedAddress);
      setIsConnected(true);
      setWalletType(savedWalletType);

      // If this is a social login, set authenticated state
      if (savedWalletType === 'social' && socialProvider) {
        setIsAuthenticated(true);
        console.log(`Restored social login session for provider: ${socialProvider}`);
      }
      if (savedAuthStatus === "true") {
        setIsAuthenticated(true);
      }

      if (savedBalance) {
        setBalance(Number(savedBalance));
      }

      if (savedStakedAmount) {
        setStakedAmount(Number(savedStakedAmount));
      }
    } else if (thirdwebConnectionStatus === "disconnected") {
      // Only clear address if we're explicitly disconnected (not just on initial load)
      if (!isInitialLoad) {
        setAddress(null);
        setIsConnected(false);
        setIsAuthenticated(false);
      }
    }
  }, [thirdwebAddress, thirdwebConnectionStatus, connecting, connectionAttempt, isInitialLoad]);



  // Set initial load to false after component mounts
  // useEffect(() => {
  //   setIsInitialLoad(false);
  // }, []);

  // // Clean up on unmount
  // useEffect(() => {
  //   return () => {
  //     // Clean up WalletConnect event listeners
  //     if (cleanupWalletConnect.current) {
  //       cleanupWalletConnect.current();
  //     }
  //   };
  // }, []);




  // Update balance when wallet balance changes
  // useEffect(() => {
  //   if (walletBalance && isConnected) {
  //     const formattedBalance = parseFloat(walletBalance.displayValue);
  //     setBalance(formattedBalance);
  //     localStorage.setItem("walletBalance", formattedBalance.toString());
  //   }
  // }, [walletBalance, isConnected]);

  // const getUserProfile = async (address: string) => {
  //   try {
  //     // Call the real getUserProfile from thirdwebAuth
  //     const userData = await import("../../lib/thirdwebAuth").then(
  //       (module) => module.getUserProfile(address)
  //     );
  //     return userData;
  //   } catch (error) {
  //     console.error("Failed to get user profile:", error);
  //     return null;
  //   }
  // };



  const connectWallet = useCallback(
    async (type: WalletType | string = "evm"): Promise<void> => {
      try {
        // Prevent multiple connection attempts
        if (connecting) {
          console.log("Already connecting, please wait...");
          return;
        }

        setConnecting(true);
        setConnectionAttempt(prev => prev + 1);

        // Clear any existing connection data first to prevent stale state
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("isAuthenticated");

        console.log(`Connecting wallet with type: ${type}`);

        // Map provider name to wallet type
        let actualWalletType: WalletType = "evm";
        if (type === "Phantom" || type === "solana") {
          actualWalletType = "solana";
        } else if (type === "sui") {
          actualWalletType = "sui";
        }

        // Check if the wallet is installed before attempting to connect
        if (type === "MetaMask") {
          if (!window.ethereum || !window.ethereum.isMetaMask) {
            toast.error("MetaMask is not installed. Please install it to continue.");
            window.open("https://metamask.io/download/", "_blank");
            setConnecting(false);
            return;
          }
          await thirdwebConnect(metamaskWallet());
          setWalletType("evm");
          localStorage.setItem("walletType", "evm");
        } else if (type === "Phantom") {
          // Check if Phantom is installed
          const provider = window.solana;
          if (!provider || !provider.isPhantom) {
            toast.error("Phantom is not installed. Please install it to continue.");
            window.open("https://phantom.app/", "_blank");
            setConnecting(false);
            return;
          }
          try {
            setWalletType("solana");
            localStorage.setItem("walletType", "solana");
            // Connect to Phantom and authenticate
            const resp = await provider.connect();
            const solAddress = resp.publicKey?.toString();
            if (solAddress) {
              const walletAddress = `${solAddress}`;
              setAddress(walletAddress);
              setIsAuthenticated(true);
              await authenticateWithBackend(walletAddress, "solana");
              window.location.replace("/discover");
            }
          } catch (error) {
            console.error("Phantom wallet error:", error);
            toast.error("Failed to connect with Phantom. Please try again.");
            setConnecting(false);
            return;
          }
        } else if (type === "sui") {
          // Check if we're in Edit Profile linking mode - if so, skip main authentication
          const isLinkingMode = localStorage.getItem('edit_profile_linking_mode') === 'true';
          const linkingWalletType = localStorage.getItem('linking_wallet_type');

          if (isLinkingMode && linkingWalletType === 'sui') {
            console.log('🔄 Sui wallet connection in Edit Profile linking mode - skipping main authentication');
            setConnecting(false);
            return;
          }

          // Only support Phantom as a Solana wallet (not EVM)
          const provider = window.sui;
          if (!provider || !provider.isSui) {
            toast.error("Sui wallet is not installed. Please install it to continue.");
            window.open("https://suiet.app/install", "_blank");
            setConnecting(false);
            return;
          }
          try {
            setWalletType("sui");
            localStorage.setItem("WalletType", "sui");
            // Connect to Phantom and authenticate
            const resp = await provider.connect();
            const suiAddress = resp.publicKey?.toString();
            if (suiAddress) {
              const walletAddress = `${suiAddress}`;
              setAddress(walletAddress);
              setIsAuthenticated(true);
              await authenticateWithBackend(walletAddress, "sui");
              window.location.replace("/discover");
            }
          } catch (error) {
            console.error("Sui wallet error:", error);
            toast.error("Failed to connect with Sui. Please try again.");
            setConnecting(false);
            return;
          }
        } else if (type === "Google" || type === "Discord" || type === "X") {
          try {
            // Set loading state
            setConnecting(true);

            // Log the social login attempt
            console.log(`Initiating ${type} social login...`);

            // Convert X to twitter for provider name (OAuth system expects 'twitter')
            const provider = type === "X" ? "twitter" : type.toLowerCase();

            // Store the provider we're using for the callback page
            localStorage.setItem('oauth_provider', provider);

            // Import Supabase client
            const { supabase } = await import("@/lib/supabase");

            // Show info toast that we're opening the auth window
            toast.info(`Opening ${type} login window...`, {
              duration: 3000,
            });

            // Use 's OAuth - this will open a popup window
            // This opens a real OAuth authentication window from the provider
            // When complete, it will redirect to our /auth/callback route
            const { data, error } = await supabase.auth.signInWithOAuth({
              provider: provider as any, // Type as any to avoid TypeScript errors
              options: {
                redirectTo: `${window.location.origin}/auth/callback`
              }
            });

            if (error) {
              throw new Error(`OAuth error: ${error.message}`);
            }

            if (!data) {
              throw new Error('No data returned from OAuth provider');
            }

            // The OAuth flow will redirect to the callback URL
            // The redirect will happen automatically, no need to do anything else here
            console.log("OAuth initiated successfully, waiting for redirect...");

            // Since the OAuth flow will redirect the page, we don't need to
            // manually handle the success case here
          } catch (error) {
            console.error(`${type} login error:`, error);
            toast.error(`${type} login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setConnecting(false);
          }
        } else {
          // Default to metamask for "evm" or unknown wallet types
          if (!window.ethereum) {
            toast.error("MetaMask is not installed. Please install it to continue.");
            window.open("https://metamask.io/download/", "_blank");
            setConnecting(false);
            return;
          }
          await thirdwebConnect(metamaskWallet());
          setWalletType("evm");
          localStorage.setItem("walletType", "evm");
        }

        // After successful wallet connection and address retrieval:
        if (thirdwebAddress) {
          const { supabase } = await import('@/lib/supabase');
          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', thirdwebAddress)
            .single();

          if (!existingUser) {
            // New user: upsert with display_name
            await upsertUser({
              wallet_address: thirdwebAddress,
              display_name: `User_${thirdwebAddress.slice(0, 6)}`,
              wallet_type: actualWalletType,
              provider: type,
            });
          } else {
            // Existing user: upsert only fields you want to update (do NOT send display_name)
            await upsertUser({
              wallet_address: thirdwebAddress,
              wallet_type: actualWalletType,
              provider: type,
              // Do NOT send display_name here!
            });
          }
        }

        // The address will be set by the useEffect hook when thirdwebAddress updates
        // This avoids the "no address found" issue

        // Wait a bit for the connection to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if we have an address now
        if (!thirdwebAddress) {
          // Connection in progress, no need to show error yet
          // The useEffect will handle setting the address when it becomes available
          console.log("Waiting for address from wallet...");
        } else {
          // We already have an address, let's finish the process
          await authenticateWithBackend(thirdwebAddress, type);
        }
      } catch (error) {
        console.error("Connection error:", error);
        setConnecting(false);

        // Show appropriate error message
        if (error instanceof Error) {
          if (error.message.includes("User rejected")) {
            toast.error(`Connection cancelled. You rejected the ${type} connection request.`);
          } else if (error.message.includes("Already processing")) {
            toast.error(`Already processing a ${type} connection. Please wait.`);
          } else {
            toast.error(`Failed to connect wallet: ${error.message}`);
          }
        } else {
          toast.error(`Failed to connect wallet. Please try again.`);
        }

        // Clear connection state
        clearConnectionState();
      }
    },
    [thirdwebConnect, thirdwebAddress, connecting, connectionAttempt, upsertUser]
  );

  // Helper function to authenticate with backend using unified system
  const authenticateWithBackend = async (walletAddress: string, providerType: WalletType | string) => {
    try {
      console.log(`Authenticating wallet ${walletAddress} with provider ${providerType} using unified system`);

      // Determine wallet type name
      let walletTypeName = typeof providerType === "string" ? providerType : providerType;
      if (walletTypeName === "evm") {
        walletTypeName = "metamask"; // Default EVM to MetaMask
      }

      // Use unified wallet authentication system
      const { processWalletLogin } = await import('@/api/walletAuth');
      const authResult = await processWalletLogin(walletAddress, walletTypeName, {
        provider_type: providerType
      });

      if (!authResult.success) {
        throw new Error(authResult.error || 'Wallet authentication failed');
      }

      if (authResult.isNewUser) {
        console.log('🎉 New user created successfully');
        toast.success(`Welcome! Your ${walletTypeName} wallet account has been created.`);
      } else {
        console.log('👋 Existing user logged in successfully');
        toast.success(`Welcome back! Logged in with ${walletTypeName}.`);
      }

      // Redirect to discover page
      window.location.replace("/discover");

    } catch (error: any) {
      console.error("Wallet authentication error:", error);
      toast.error(`Failed to authenticate wallet: ${error.message}`);

      // Set authentication failed status
      setWalletConnectionStatus({
        status: "error",
        message: "Authentication failed",
        error: error.message
      });

      // Reset connection state
      setConnecting(false);
      setIsConnected(false);
      setAddress(null);

      throw error;
    }
  };

  // Social login wrapper function
  const socialLoginWrapper = async (provider: string) => {
    try {
      // Import and call the unified social auth system
      const { processSocialLogin } = await import('@/api/socialAuth');
      const result = await processSocialLogin(provider, {});

      if (result.success) {
        setIsAuthenticated(true);
        setAddress(result.walletAddress);
        setIsConnected(true);
      }

      return result;
    } catch (error) {
      console.error('Social login wrapper error:', error);
      throw error;
    }
  };

  // Helper function to clear connection state
  const clearConnectionState = () => {
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("userAddress");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("walletType");
    localStorage.removeItem("walletBalance");
    localStorage.removeItem("stakedAmount");
    localStorage.removeItem("socialProvider");
    localStorage.removeItem("oauth_provider");
    localStorage.removeItem("supabase_access_token");
    localStorage.removeItem("supabase_refresh_token");
    localStorage.removeItem("__TW__/coordinatorStorage/lastConnectedWallet");

    setAddress(null);
    setIsConnected(false);
    setIsAuthenticated(false);
    setWalletType(null);
    setBalance(0);
    setStakedAmount(0);
  };

  const disconnect = useCallback(() => {
    console.log("Disconnecting wallet...");

    // First, clear all component state to prevent any race conditions
    setAddress(null);
    setIsConnected(false);
    setIsAuthenticated(false);
    setWalletType(null);
    setBalance(0);
    setStakedAmount(0);

    // Keep track of all cleanup operations that need to complete
    const cleanupPromises = [];

    // Attempt to disconnect from ThirdWeb first
    try {
      if (thirdwebConnectionStatus === 'connected') {
        thirdwebDisconnect();
      }
    } catch (error) {
      console.error("Error during ThirdWeb disconnect:", error);
    }

    // For MetaMask, attempt to clear connection state
    if (window.ethereum && window.ethereum.selectedAddress) {
      try {
        // For MetaMask, we can't force disconnect from their side
        // We can only clear our local connection state
        console.log("Clearing MetaMask connection state locally");
      } catch (error) {
        console.error("Error during MetaMask disconnect:", error);
      }
    }

    // For Supabase social login, we need to sign out - use await here directly
    const socialProvider = localStorage.getItem("socialProvider");
    if (socialProvider) {
      console.log(`Signing out social login (${socialProvider})`);

      try {
        // Add Supabase signout to our cleanup operations
        const supabaseSignout = import("@/lib/supabase").then(async (module) => {
          // Use supabase directly from the export
          const { supabase } = module;
          return supabase.auth.signOut().then(() => {
            console.log('Successfully signed out from Supabase');
          }).catch(e => {
            console.error('Error signing out from Supabase:', e);
          });
        });

        cleanupPromises.push(supabaseSignout);
      } catch (signOutError) {
        console.error("Error during social login sign out:", signOutError);
      }
    }

    // Clear ALL localStorage data to ensure complete reset
    console.log("Clearing all localStorage data");
    Object.keys(localStorage).forEach(key => {
      localStorage.removeItem(key);
    });

    // Clear ALL sessionStorage data
    console.log("Clearing all sessionStorage data");
    Object.keys(sessionStorage).forEach(key => {
      sessionStorage.removeItem(key);
    });

    // Dispatch an event that other components can listen for
    window.dispatchEvent(new CustomEvent('wallet-disconnected'));

    toast.success("Wallet disconnected");

    // Wait for all cleanup operations to complete before redirecting
    Promise.all(cleanupPromises).then(() => {
      console.log("All cleanup operations completed, redirecting to home page");
      // Force a hard redirect to the home page to reset all state
      window.location.replace("/");
    }).catch(error => {
      console.error("Error during cleanup:", error);
      // Still redirect even if cleanup fails
      window.location.replace("/");
    });
  }, [thirdwebDisconnect, thirdwebConnectionStatus]);

  const updateBalance = (newBalance: number) => {
    setBalance(newBalance);
    localStorage.setItem("walletBalance", newBalance.toString());
  };

  const updateStakedAmount = (newStakedAmount: number) => {
    setStakedAmount(newStakedAmount);
    localStorage.setItem("stakedAmount", newStakedAmount.toString());
  };

  // Social login integration (Google, Discord, etc.)
  const socialLogin = async (provider: string) => {
    try {
      // Set loading state
      setIsLoading(true);
      setWalletConnectionStatus({
        status: "connecting",
        message: `Connecting to ${provider}...`
      });

      console.log(`Initiating ${provider} login...`);

      // Import supabase client
      const { supabase } = await import("@/lib/supabase");

      // Start the Supabase OAuth flow - this navigates away from the current page
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any, // Type as any to avoid TypeScript errors
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error("Social login error:", error);
        setWalletConnectionStatus({
          status: "error",
          message: `Failed to connect to ${provider}.`,
          error: error.message
        });
        toast.error(`Could not connect to ${provider}. ${error.message || "Unknown error"}`);
        return;
      }

      if (!data || !data.url) {
        console.error("No redirect URL returned from Supabase");
        setWalletConnectionStatus({
          status: "error",
          message: `Failed to connect to ${provider}.`,
          error: "No redirect URL received"
        });
        toast.error(`Could not connect to ${provider}. No redirect URL received.`);
        return;
      }

      console.log(`${provider} OAuth URL received, redirecting...`);

      // The browser will now navigate to the OAuth URL from Supabase
      // When the authentication is complete, the provider will redirect back to our callback URL
      window.location.href = data.url;

    } catch (error: any) {
      console.error(`${provider} login error:`, error);
      setWalletConnectionStatus({
        status: "error",
        message: `Failed to connect to ${provider}.`,
        error: error.message || "Unknown error"
      });

      toast.error(`Could not connect to ${provider}. ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only authenticate if not already authenticated for this wallet address
    const lastAuthenticatedWallet = localStorage.getItem("lastAuthenticatedWallet");
    if (
      isConnected &&
      thirdwebAddress &&
      !hasAuthenticated &&
      thirdwebAddress !== lastAuthenticatedWallet
    ) {
      setHasAuthenticated(true);
      authenticateWithBackend(thirdwebAddress, walletType || "evm");
    }
    // Reset flag on disconnect
    if (!isConnected) {
      setHasAuthenticated(false);
    }
  }, [isConnected, thirdwebAddress, walletType]);

  // Remove fallback redirect useEffect, keep only reset flag logic
  useEffect(() => {
    if (!isConnected) {
      setHasAuthenticated(false);
    }
  }, [isConnected]);

  // Add Phantom reconnect and pending redirect logic
  // useEffect(() => {
  //   const savedWalletType = localStorage.getItem("walletType");

  //   if (savedWalletType === "solana" && !isConnected) {
  //     const provider = window.solana;

  //     if (provider && provider.isPhantom) {
  //       provider.connect({ onlyIfTrusted: true })
  //         .then((resp) => {
  //           const solAddress = resp.publicKey?.toString();
  //           if (solAddress) {
  //             const walletAddress = `${solAddress}|solana`;

  //             setAddress(walletAddress);
  //             setIsConnected(true);
  //             setWalletType("solana");
  //             setIsAuthenticated(true);

  //             console.log("[Phantom] Reconnected on load:", walletAddress);

  //             // Handle pending redirect
  //             const pendingRedirect = localStorage.getItem("pendingRedirect");
  //             if (pendingRedirect && window.location.pathname !== pendingRedirect) {
  //               localStorage.removeItem("pendingRedirect");
  //               window.location.replace(pendingRedirect);
  //             }
  //           }
  //         })
  //         .catch((err) => {
  //           console.warn("[Phantom] Reconnect failed:", err);
  //         });
  //     }
  //   }
  // }, []);

  return (
    <WalletContext.Provider value={{
      address,
      isConnected,
      connect: connectWallet,
      disconnect,
      isAuthenticated,
      walletType,
      balance,
      stakedAmount,
      updateBalance,
      updateStakedAmount,
      connecting, // <-- expose connecting
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;
