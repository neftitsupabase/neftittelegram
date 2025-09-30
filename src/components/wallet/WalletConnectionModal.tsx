import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useWallet } from "./WalletProvider";
import { Link } from "react-router-dom";

import { useWallet as useSuiWallet, ConnectButton } from '@suiet/wallet-kit';
import { processSocialLogin } from "@/api/socialAuth";
import { toast } from "sonner";
import { authenticateUser } from "../../lib/thirdwebAuth";
import { storeTelegramUser } from "@/lib/supabase";
import { ChevronRight } from "lucide-react";
import type { WalletWithFeatures } from '@mysten/wallet-standard';
import { useUpsertUser } from '@/hooks/useUpsertUser';

// Sui wallet detection
declare global {
  interface Window {
    suiWallet?: any;
    onTelegramAuth?: (user: any) => void;
    sui?: any;
    martian?: any;
    ethos?: any;
    nightly?: any;
    wallets?: Map<string, any>; // Added for wallet-standard detection
  }
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TELEGRAM_BOT = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "neftit_bot";



function getSuiWallets(): WalletWithFeatures<Record<string, any>>[] {
  if (!window.wallets) return [];
  // If window.wallets is a Map, use .values(), else fallback to Array.from
  const walletsArr = typeof window.wallets.values === 'function' ? Array.from(window.wallets.values()) : Array.from(window.wallets);
  return walletsArr.filter(
    (wallet: any) =>
      wallet.features &&
      wallet.features['sui:signAndExecuteTransactionBlock'] &&
      wallet.features['standard:connect'] &&
      wallet.features['sui:signMessage']
  );
}

// Add this utility function before the WalletConnectionModal component
function hasWalletConnectSession() {
  // WalletConnect v2 sessions are stored with keys like 'wc@2:' or 'walletconnect'
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('wc@2:') || key.startsWith('walletconnect'))) {
      return true;
    }
  }
  return false;
}

const WalletConnectionModal: React.FC<WalletConnectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { connect, address, isConnected } = useWallet(); // from your custom WalletProvider
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);

  const [showMoreWallets, setShowMoreWallets] = useState(false);


  const [showSuiWalletPicker, setShowSuiWalletPicker] = useState(false);
  const [availableSuiWallets, setAvailableSuiWallets] = useState<WalletWithFeatures<Record<string, any>>[]>([]);
  const [suiWalletError, setSuiWalletError] = useState<string | null>(null);
  const [selectedSuiWallet, setSelectedSuiWallet] = useState<WalletWithFeatures<Record<string, any>> | null>(null);
  const { select } = useSuiWallet(); // from @suiet/wallet-kit
  const [hasSuiSignedIn, setHasSuiSignedIn] = useState(false);
  const { upsertUser } = useUpsertUser();

  // Auto-close modal when successfully connected
  useEffect(() => {
    if (isConnected && address && hasAttemptedConnect) {
      // Small delay to ensure the connection is stable
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, hasAttemptedConnect, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasAttemptedConnect(false);
      setIsLoading({});
    }
  }, [isOpen]);

  useEffect(() => {
    // Define the global handler for Telegram login
    window.onTelegramAuth = function (user) {
      console.log('Telegram user data received:', user);
      handleTelegramAuthSuccess(user);
    };
    // Clean up on unmount
    return () => {
      window.onTelegramAuth = undefined;
    };
  }, []);

  // Listen for custom event to open Telegram auth for additional connections
  useEffect(() => {
    const handleOpenTelegramAuth = (event: CustomEvent) => {
      if (event.detail?.mode === 'additional') {
        console.log('🔗 Opening Telegram auth for additional connection');
        // Set flag to indicate modal is handling the authentication
        localStorage.setItem('telegram_auth_handled', 'true');
        handleTelegramLoginButtonClick();
      }
    };

    window.addEventListener('openTelegramAuth', handleOpenTelegramAuth as EventListener);
    
    return () => {
      window.removeEventListener('openTelegramAuth', handleOpenTelegramAuth as EventListener);
    };
  }, []);

  // Listen for Telegram auth completion to clean up connecting state
  useEffect(() => {
    const handleTelegramAuthComplete = () => {
      // Clean up connecting state when Telegram auth completes
      setIsLoading((prev) => ({ ...prev, Telegram: false }));
    };

    window.addEventListener('telegramAuthComplete', handleTelegramAuthComplete);
    
    return () => {
      window.removeEventListener('telegramAuthComplete', handleTelegramAuthComplete);
    };
  }, []);

  // Direct Telegram Login Widget handler - no popup, direct authentication
  const handleTelegramLoginButtonClick = () => {
    setIsLoading((prev) => ({ ...prev, Telegram: true }));
    
    // Check if bot username is configured
    if (!TELEGRAM_BOT || TELEGRAM_BOT === "your_bot_username") {
      toast.error("Telegram bot is not properly configured. Please check your environment variables.");
      setIsLoading((prev) => ({ ...prev, Telegram: false }));
      return;
    }
    
    try {
      // Create a temporary container for the Telegram widget
      const widgetContainer = document.createElement('div');
      widgetContainer.style.position = 'fixed';
      widgetContainer.style.top = '50%';
      widgetContainer.style.left = '50%';
      widgetContainer.style.transform = 'translate(-50%, -50%)';
      widgetContainer.style.zIndex = '99999';
      widgetContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      widgetContainer.style.padding = '20px';
      widgetContainer.style.borderRadius = '10px';
      widgetContainer.style.backdropFilter = 'blur(10px)';
      document.body.appendChild(widgetContainer);

      // Create the Telegram Login Widget script
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.setAttribute('data-telegram-login', TELEGRAM_BOT);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      
      // Set up the global callback
      window.onTelegramAuth = async function (user: any) {
        try {
          // Remove the widget container
          if (widgetContainer.parentNode) {
            widgetContainer.parentNode.removeChild(widgetContainer);
          }
          
          // Process the authentication
          await handleTelegramAuthSuccess(user);
        } catch (error) {
          console.error('Telegram auth error:', error);
          setIsLoading((prev) => ({ ...prev, Telegram: false }));
          
          // Provide specific error messages
          if (error.message?.includes('domain')) {
            toast.error('Telegram bot domain not configured. Please contact support.');
          } else {
            toast.error('Telegram authentication failed. Please try again.');
          }
          
          // Remove the widget container on error
          if (widgetContainer.parentNode) {
            widgetContainer.parentNode.removeChild(widgetContainer);
          }
        }
      };
      
      // Add the script to the container
      widgetContainer.appendChild(script);
      
      // Add a close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '✕';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '10px';
      closeButton.style.right = '10px';
      closeButton.style.background = 'transparent';
      closeButton.style.border = 'none';
      closeButton.style.color = 'white';
      closeButton.style.fontSize = '20px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = () => {
        if (widgetContainer.parentNode) {
          widgetContainer.parentNode.removeChild(widgetContainer);
        }
        setIsLoading((prev) => ({ ...prev, Telegram: false }));
        if (window.onTelegramAuth) delete window.onTelegramAuth;
      };
      widgetContainer.appendChild(closeButton);
      
    } catch (error) {
      console.error('Telegram auth error:', error);
      setIsLoading((prev) => ({ ...prev, Telegram: false }));
      toast.error('Failed to start Telegram authentication');
    }
  };

  // Handle successful Telegram authentication
  const handleTelegramAuthSuccess = async (user: TelegramUser) => {
    try {
      // Check if this is for additional connection linking (from edit profile)
      const connectionMode = localStorage.getItem('connection_mode');
      const isAdditionalConnection = connectionMode === 'additional';
      const primaryWalletAddress = localStorage.getItem('primary_wallet_address');

      if (isAdditionalConnection && primaryWalletAddress) {
        console.log('🔗 ADDITIONAL CONNECTION MODE - linking Telegram to existing account');
        
        // Use the unified system to link Telegram as additional provider
      const { supabase } = await import('@/lib/supabase');
        const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
          target_user_address: primaryWalletAddress,
          new_address: `social:telegram:${user.id}`,
          new_provider: 'telegram',
          link_method: 'social',
          provider_email: null, // Telegram doesn't provide email
          provider_id: user.id.toString(),
          provider_username: user.username || `telegram_user_${user.id}`
        });

        if (linkError) {
          console.error('❌ Failed to link Telegram account:', linkError);
          toast.error('Failed to link Telegram account. It may already be connected to another user.');
        } else if (linkResult) {
          console.log('✅ Successfully linked Telegram account');
          toast.success('Telegram account linked successfully!');
          
          // Clean up temporary storage
          localStorage.removeItem('connection_mode');
          localStorage.removeItem('primary_wallet_address');
          localStorage.removeItem('oauth_provider');
          
          setIsLoading((prev) => ({ ...prev, Telegram: false }));
          
          // Dispatch completion event
          window.dispatchEvent(new CustomEvent('telegramAuthComplete'));
          
          if (typeof onClose === 'function') onClose();
          window.location.href = "/edit-profile";
          return;
      } else {
          console.warn('⚠️ Link operation returned false - account may already be linked');
          toast.warning('Telegram account is already connected.');
        }
      }

      // For primary connections, use the unified social login system
      console.log('🚀 PRIMARY MODE: Processing Telegram social login');
      
      // Import and use the unified social login system
      const { processSocialLogin } = await import('@/api/socialAuth');
      
      // Format user data for the unified system
      const userData = {
        id: user.id.toString(),
        username: user.username || `telegram_user_${user.id}`,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        photo_url: user.photo_url || '',
        auth_date: user.auth_date || Math.floor(Date.now() / 1000)
      };

      const result = await processSocialLogin('telegram', userData);

      if (!result.success) {
        throw new Error(result.error || 'Telegram authentication failed');
      }

      // Store session and redirect
      localStorage.setItem("walletAddress", result.userData.address);
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("walletType", "social");
      localStorage.setItem("socialProvider", "telegram");
      
      setIsLoading((prev) => ({ ...prev, Telegram: false }));
      
      // Dispatch completion event
      window.dispatchEvent(new CustomEvent('telegramAuthComplete'));
      
      if (typeof onClose === 'function') onClose();
      
      if (result.userData.is_new_user) {
        toast.success("Welcome! Your Telegram account has been connected.");
      } else {
        toast.success("Welcome back! Logged in with Telegram.");
      }
      
      window.location.href = "/discover";
      
    } catch (err) {
      console.error("Telegram auth error:", err);
      setIsLoading((prev) => ({ ...prev, Telegram: false }));
      
      // Dispatch completion event even on error
      window.dispatchEvent(new CustomEvent('telegramAuthComplete'));
      
      toast.error("Telegram authentication failed");
    }
  };



  const handleConnectWallet = async (provider: string) => {
    // Prevent connecting if already loading this provider
    if (isLoading[provider]) return;

    setIsLoading(prev => ({ ...prev, [provider]: true }));
    setHasAttemptedConnect(true);

    try {
      console.log(`Initiating connection with ${provider}...`);

      // Special handling for WalletConnect
      if (provider === 'WalletConnect') {
        // Ensure we have the required project ID
        if (!import.meta.env.VITE_WALLETCONNECT_PROJECT_ID) {
          console.warn('WalletConnect project ID is not configured');
          toast.warning('WalletConnect is not properly configured. Please try another wallet.');
          return;
        }

        // Show connection instructions
        toast.info('Scan the QR code with your wallet app', {
          duration: 5000,
          position: 'top-center',
        });
      }

      // Connect via wallet provider
      await connect(provider);

      // The connection process and success/error toast is handled in the WalletProvider
      // The modal will auto-close on successful connection

    } catch (error) {
      console.error(`Error connecting with ${provider}:`, error);

      // Only show error toast if not already shown by WalletProvider
      if (error instanceof Error && !error.message.includes('User rejected')) {
        const errorMessage = error.message || `Failed to connect with ${provider}`;
        toast.error(errorMessage, { duration: 5000 });
      }

      // Re-throw to allow WalletProvider to handle it as well
      throw error;
    } finally {
      // Reset loading state for this provider
      setTimeout(() => {
        setIsLoading(prev => ({ ...prev, [provider]: false }));
      }, 1000); // Small delay to prevent rapid re-clicking
    }
  };

  // Add useEffect for post-connection logic
  const { address: suiAddress, connected: suiConnected, signMessage } = useSuiWallet();
  useEffect(() => {
    // Sui sign-in effect (REMOVE THIS)
  }, [suiConnected, suiAddress, signMessage]);

  const handlePhantomConnect = async () => {
    setIsLoading(prev => ({ ...prev, Phantom: true }));
    try {
      // 1. Detect Phantom
      const provider = window.solana;
      if (!provider || !provider.isPhantom) {
        toast.error("Phantom wallet is not installed. Please install it to continue.");
        window.open("https://phantom.app/download", "_blank");
        setIsLoading(prev => ({ ...prev, Phantom: false }));
        return;
      }
      // 2. Connect
      const resp = await provider.connect();
      const solAddress = resp.publicKey?.toString();
      if (!solAddress) {
        toast.error("Failed to get Solana address from Phantom.");
        setIsLoading(prev => ({ ...prev, Phantom: false }));
        return;
      }
      // 3. Sign a message for authentication
      const message = `Sign in to NEFTIT with Solana wallet: ${solAddress}`;
      const encodedMessage = new TextEncoder().encode(message);
      let signature;
      try {
        const signed = await (provider as any).signMessage(encodedMessage, "utf8");
        signature = signed.signature ? btoa(String.fromCharCode(...new Uint8Array(signed.signature))) : undefined;
      } catch (e) {
        toast.error("Signature request was rejected.");
        setIsLoading(prev => ({ ...prev, Phantom: false }));
        return;
      }
      // 4. Authenticate with backend using unified system
      const { processWalletLogin } = await import("@/api/walletAuth");
      const walletAddress = `${solAddress}`;
      const authResult = await processWalletLogin(walletAddress, 'phantom', {
        signature,
        timestamp: new Date().toISOString(),
        provider_type: 'solana'
      });
      if (!authResult.success) {
        toast.error('Failed to authenticate with backend');
        setIsLoading(prev => ({ ...prev, Phantom: false }));
        return;
      }
      // 5. Set session/localStorage using data from unified system
      const userWalletAddress = authResult.userData?.wallet_address || walletAddress;
      localStorage.setItem("walletAddress", userWalletAddress);
      localStorage.setItem("userAddress", userWalletAddress);
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("walletType", "phantom");
      localStorage.setItem("lastLogin", new Date().toISOString());
      toast.success("Phantom wallet connected!");
      onClose();
      // Debug log and redirect for Phantom
      console.log("[Phantom] Redirecting to /discover after successful login. Auth state:", {
        isAuthenticated: true,
        walletAddress: userWalletAddress,
        isNewUser: authResult.isNewUser,
        userId: authResult.userData?.id,
        localStorageAuth: localStorage.getItem("isAuthenticated"),
        localStorageWallet: localStorage.getItem("walletAddress"),
        pathname: window.location.pathname
      });
      setTimeout(() => {
        window.location.replace("/discover");
      }, 1000);
    } catch (error) {
      toast.error(error.message || 'Failed to connect Phantom wallet.');
    } finally {
      setIsLoading(prev => ({ ...prev, Phantom: false }));
    }
  };

  // const moreWallets = [];

  const walletConnectSessionExists = hasWalletConnectSession();

  // Sui Button handler: open wallet, then sign and login after connect
  const handleSuiClick = async () => {
    setIsLoading((prev) => ({ ...prev, Sui: true }));
    try {
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

      // Use unified wallet authentication system
      const { processWalletLogin } = await import('@/api/walletAuth');
      const authResult = await processWalletLogin(suiAddress, 'sui', {
        name: `Sui_${suiAddress.slice(0, 6)}`,
        signature: result
      });

      if (!authResult.success) {
        throw new Error(authResult.error || 'Sui wallet authentication failed');
      }

      if (authResult.isNewUser) {
        toast.success("Welcome! Your Sui wallet account has been created.");
      } else {
        toast.success("Welcome back! Logged in with Sui wallet.");
      }

      // ✅ Close modal only after full connection
      if (typeof onClose === 'function') onClose();

      window.location.href = "/discover";
    } catch (error: any) {
      console.error("Sui connection error:", error);
      toast.error(error.message || "Failed to connect Sui wallet.");
    } finally {
      setIsLoading((prev) => ({ ...prev, Sui: false }));
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[300px] sm:w-[400px] bg-[#121021] backdrop-blur-xl border rounded-xl text-white">
        <DialogTitle className="text-white text-lg sm:text-xl font-bold text-center flex justify-start">
          Login or Signup
        </DialogTitle>

        <div className="flex flex-col gap-6 py-0">
          <motion.div
            className="flex flex-col gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* WalletConnect session warning */}
            {walletConnectSessionExists && (
              <div className="bg-yellow-900/80 border border-yellow-600 text-yellow-200 rounded-md px-3 py-2 text-xs mb-2 text-center">
                <strong>WalletConnect session detected.</strong><br />
                To connect a different wallet/account, please disconnect this site from your wallet app first.<br />
                <a
                  href="https://support.metamask.io/hc/en-us/articles/360058969391-How-to-remove-a-dapp-connection"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-yellow-300 hover:text-yellow-100 text-xs mt-1 inline-block"
                >
                  How to disconnect in MetaMask
                </a>
              </div>
            )}
            <Button
              onClick={() => handleConnectWallet("MetaMask")}
              disabled={isLoading["MetaMask"]}
              className="py-4 w-full bg-[#1b1930] border-[1.8px] border-[#1b1930] flex justify-center items-center gap-3 rounded-[10px] transition-all duration-300 ease-in-out hover:border-0 hover:bg-[#1b1930] hover:shadow-[0_0_25px_#1b1930]"
            >
              {isLoading["MetaMask"] ? (
                <div className="w-5 h-5 border-[3.2px] border-white/20 border-t-[3.2px] border-t-white/80 rounded-full animate-spin" />
              ) : (
                <img src="/icons/metamask-icon.png" alt="MetaMask" width={24} height={24} />
              )}
              <span>MetaMask</span>
            </Button>

            <Button
              onClick={() => handleConnectWallet("WalletConnect")}
              disabled={isLoading["WalletConnect"] || walletConnectSessionExists}
              className="w-full py-4 bg-[#1b1930] border-[1.8px] border-[#1b1930] flex justify-center items-center gap-3 rounded-[10px] transition-all duration-300 ease-in-out hover:border-0 hover:bg-[#1b1930] hover:shadow-[0_0_25px_#1b1930]"
            >
              {isLoading["WalletConnect"] ? (
                <div className="w-5 h-5 border-[3.2px] border-white/20 border-t-[3.2px] border-t-white/80 rounded-full animate-spin" />
              ) : (
                <>
                  <img
                    src="/icons/walletconnect-logo.svg"
                    alt="WalletConnect"
                    width={24}
                    height={24}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = '/icons/WalletConnect-icon.png';
                    }}
                  />
                  <span>WalletConnect</span>
                </>
              )}
            </Button>

            <Button
              onClick={handlePhantomConnect}
              disabled={isLoading["Phantom"]}
              className="py-4 w-full bg-[#1b1930] border-[1.8px] border-[#1b1930] flex justify-center items-center gap-3 rounded-[10px] transition-all duration-300 ease-in-out hover:border-0 hover:bg-[#1b1930] hover:shadow-[0_0_25px_#1b1930]"
            >
              {isLoading["Phantom"] ? (
                <div className="w-5 h-5 border-[3.2px] border-white/20 border-t-[3.2px] border-t-white/80 rounded-full animate-spin" />
              ) : (
                <img src="/icons/phantom-wallet.png" alt="Phantom" width={24} height={24} />
              )}
              <span>Phantom</span>
            </Button>

            <Button
              onClick={() => setShowMoreWallets(!showMoreWallets)}
              className="py-5 w-full bg-[#1b1930] border-[1.8px] border-[#1b1930] flex justify-center items-center gap-3 rounded-[10px] transition-all duration-300 ease-in-out hover:border-transparent hover:bg-[#1b1930] hover:shadow-[0_0_25px_#1b1930]"
            >
              <img src="/icons/wallet-icon.png" alt="Wallet" width={24} height={24} />
              <span>Other wallets</span>
              <ChevronRight size={14} className={`text-gray-400 group-hover:text-white transition-all duration-200 ${showMoreWallets ? 'rotate-90' : ''}`} />
            </Button>

            {showMoreWallets && (
              <div className="w-full">
                <Button
                  className="w-full py-5 bg-[#1b1930] border-[1.8px] border-[#1b1930] flex justify-center items-center gap-3 rounded-[10px] transition-all duration-300 ease-in-out hover:border-transparent hover:bg-[#1b1930] hover:shadow-[0_0_25px_#1b1930]"
                  onClick={handleSuiClick}
                >
                  <img src="/icons/sui-sui-logo.png" alt="Sui" width={24} height={24} style={{ marginRight: 8 }} />
                  <span>Sui</span>
                </Button>
                {/* If you have other wallets, render them here as before */}
              </div>
            )}

            <div id="or-continue-with" className="relative flex justify-center text-xs my-0 sm:my-2">
              <span className="bg-[#121021] px-2 text-gray-500">
                Or continue with
              </span>
            </div>

            <div id="social-media-btns" className="flex flex-row gap-6 justify-center items-center mt-0 sm:mt-2">
              <Button
                onClick={() => handleConnectWallet("Google")}
                disabled={isLoading["Google"]}
                className="w-12 h-12 bg-[#121021] border-[1.8px] border-[#121021] flex justify-center items-center rounded-full transition-all duration-100 ease-in-out hover:border-0 hover:bg-[#121021] hover:shadow-[0_0_25px_#121021] p-0"
              >
                <img src="/icons/icons8-google-48.png" alt="Google" />
              </Button>
              <Button
                onClick={handleTelegramLoginButtonClick}
                disabled={isLoading["Telegram"]}
                className="w-12 h-12 bg-[#121021] border-[1.8px] border-[#121021] flex justify-center items-center rounded-full transition-all duration-100 ease-in-out hover:border-0 hover:bg-[#121021] hover:shadow-[0_0_25px_#121021] p-0"
              >
                {isLoading["Telegram"] ? (
                  <div className="w-5 h-5 border-[2px] border-white/20 border-t-[2px] border-t-white/80 rounded-full animate-spin" />
                ) : (
                <img src="/icons/telegram-icon.png" alt="Telegram" />
                )}
              </Button>
              <Button
                onClick={() => handleConnectWallet("Discord")}
                disabled={isLoading["Discord"]}
                className="w-12 h-12 bg-[#121021] border-[1.8px] border-[#121021] flex justify-center items-center rounded-full transition-all duration-100 ease-in-out hover:border-0 hover:bg-[#121021] hover:shadow-[0_0_25px_#121021] p-0"
              >
                <img src="/icons/discord-round-color-icon.png" alt="Discord" />
              </Button>
              <Button
                onClick={() => handleConnectWallet("X")}
                disabled={isLoading["X"]}
                className="w-12 h-12 bg-[#121021] border-[1.8px] border-[#121021] flex justify-center items-center rounded-full transition-all duration-100 ease-in-out hover:border-0 hover:bg-[#121021] hover:shadow-[0_0_25px_#121021] p-0"
              >
                <img src="/icons/x-social-media-round-icon.png" alt="X" />
              </Button>
            </div>
          </motion.div>

          <div id="terms-of-service" className="text-center text-gray-500 text-xs mt-0 sm:mt-2">
            By connecting, you agree to our{" "}
            <Link to="/docs/legal-compliance-risk/terms-of-service" className="text-[#5d43ef] hover:text-white/80 transition-colors"> Terms of Service</Link> &{" "}
            <Link to="/docs/legal-compliance-risk/privacy-policy" className="text-[#5d43ef] hover:text-white/80 transition-colors"> Privacy Policy</Link>
          </div>

        </div>
      </DialogContent>
      {/* Sui Wallet Picker Modal */}
      {showSuiWalletPicker && (
        <Dialog open={showSuiWalletPicker} onOpenChange={setShowSuiWalletPicker}>
          <DialogContent className="bg-WCM-bg-container text-white max-w-xs mx-auto">
            <DialogTitle className="text-center mb-2">Select a Sui Wallet</DialogTitle>
            <div className="flex flex-col items-center gap-4 py-4">
              {availableSuiWallets.map((wallet, idx) => (
                <Button
                  key={wallet.name + idx}
                  onClick={async () => {
                    setShowSuiWalletPicker(false);
                    setSelectedSuiWallet(wallet);
                    setIsLoading(prev => ({ ...prev, Sui: true }));
                    try {
                      const { accounts } = await wallet.features['standard:connect'].connect();
                      if (!accounts || !accounts.length) {
                        setSuiWalletError('No Sui account found in wallet.');
                        setIsLoading(prev => ({ ...prev, Sui: false }));
                        return;
                      }
                      const suiAddress = accounts[0].address;
                      const message = new TextEncoder().encode(`Sign in to NEFTIT with Sui wallet: ${suiAddress}`);
                      const { signature } = await wallet.features['sui:signMessage'].signMessage({ message });
                      // Optionally, store in Supabase (if you want to track Sui users)
                      if (typeof processSocialLogin === 'function') {
                        const userData = {
                          id: suiAddress,
                          wallet_address: suiAddress,
                          display_name: `Sui_${suiAddress.slice(0, 6)}`,
                          provider: 'sui',
                          signature,
                        };
                        try {
                          await processSocialLogin('Sui', userData);
                        } catch (e) {
                          console.warn('Failed to store Sui user in Supabase:', e);
                        }
                      }
                      // Set session/localStorage
                      localStorage.setItem("walletAddress", suiAddress);
                      localStorage.setItem("userAddress", suiAddress);
                      localStorage.setItem("isAuthenticated", "true");
                      localStorage.setItem("walletType", "sui");
                      localStorage.setItem("socialProvider", "sui");
                      toast.success("Sui wallet connected!");
                      window.location.href = "/discover";
                    } catch (error: any) {
                      setSuiWalletError(error.message || 'Failed to connect Sui wallet.');
                      toast.error("Failed to connect Sui wallet: " + (error.message || error));
                    } finally {
                      setIsLoading(prev => ({ ...prev, Sui: false }));
                    }
                  }}
                  className="w-full py-3 bg-WCM-bg-buttons border-[1.8px] border-WCM-bg-buttons flex justify-center items-center gap-3 rounded-[10px]"
                >
                  <span>{wallet.name}</span>
                </Button>
              ))}
            </div>
            {suiWalletError && <div className="text-red-400 text-xs mt-2">{suiWalletError}</div>}
          </DialogContent>
        </Dialog>
      )}

    </Dialog>
  );
};

export default WalletConnectionModal;