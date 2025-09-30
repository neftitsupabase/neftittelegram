import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/WalletProvider";
import { toast } from "sonner";
import { processSocialLogin, getMockOAuthData } from "@/api/socialAuth";

export default function SocialLoginDemo() {
  const { address, isConnected, disconnect } = useWallet();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  
  const socialProviders = [
    {
      name: "Google",
      icon: "https://cdn-icons-png.flaticon.com/128/300/300221.png",
      color: "#DB4437"
    },
    {
      name: "Discord",
      icon: "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png",
      color: "#5865F2" 
    },
    {
      name: "Apple",
      icon: "https://cdn-icons-png.flaticon.com/128/0/747.png",
      color: "#000000"
    },
    {
      name: "Twitter",
      icon: "https://upload.wikimedia.org/wikipedia/commons/5/57/X_logo_2023_%28white%29.png",
      color: "#1DA1F2"
    }
  ];
  
  const handleSocialLogin = async (provider: string) => {
    try {
      setLoading({ ...loading, [provider]: true });
      toast.info(`Opening ${provider} login...`);
      
      // Get provider key in the right format
      const providerKey = provider === "Twitter" ? "twitter" : provider.toLowerCase();
      
      // Get mock data
      const userInfo = await getMockOAuthData(providerKey);
      
      // Process social login
      const result = await processSocialLogin(providerKey, userInfo);
      
      if (result.success) {
        toast.success(`Logged in with ${provider}!`);
        
        // Check if there was a warning
        if (result.warning) {
          setSyncWarning(result.warning);
          toast.warning(result.warning);
        }
        
        // Refresh wallet state by updating URL with a timestamp param to force React to re-render
        window.history.replaceState(
          {}, 
          '', 
          `${window.location.pathname}?t=${Date.now()}`
        );
        
        // Force React to update by setting state
        setLoading({});
        
      } else {
        toast.error(`Login failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast.error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading({ ...loading, [provider]: false });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Social Login Demo</h1>
        
        {isConnected ? (
          <div className="bg-black/30 backdrop-blur-lg p-6 rounded-xl border border-white/10">
            <h2 className="text-2xl font-semibold mb-4">Connected Account</h2>
            <div className="mb-4">
              <p className="text-gray-400">Wallet Address:</p>
              <p className="bg-black/40 p-2 rounded font-mono">{address}</p>
            </div>
            
            {syncWarning && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-200">
                <p className="text-sm">{syncWarning}</p>
              </div>
            )}
            
            <button
              onClick={disconnect}
              className="bg-red-600/80 hover:bg-red-600 px-4 py-2 rounded-lg transition-all"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="bg-black/30 backdrop-blur-lg p-6 rounded-xl border border-white/10">
            <h2 className="text-2xl font-semibold mb-4">Choose a Login Method</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {socialProviders.map((provider) => (
                <Button
                  key={provider.name}
                  onClick={() => handleSocialLogin(provider.name)}
                  disabled={loading[provider.name]}
                  className="flex items-center justify-center space-x-3 p-3 h-auto"
                  style={{ backgroundColor: `${provider.color}20`, borderColor: provider.color }}
                >
                  {loading[provider.name] ? (
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                  ) : (
                    <img src={provider.icon} alt={provider.name} className="w-6 h-6" />
                  )}
                  <span>Continue with {provider.name}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-8 bg-black/30 backdrop-blur-lg p-6 rounded-xl border border-white/10">
          <h2 className="text-2xl font-semibold mb-4">Implementation Notes</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Each social login creates a deterministic wallet address like <code>social:google:uniqueId</code></li>
            <li>User data is stored in Supabase with robust error handling</li>
            <li>Even if database operations fail, the user can still log in (offline mode)</li>
            <li>Authentication state is maintained in localStorage</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 