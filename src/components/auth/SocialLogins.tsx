import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { initiateOAuthLogin } from "@/api/oauth";
import { supabase } from '@/lib/supabase';

interface SocialLoginProps {
  onLogin?: (method: string) => void;
}

export function SocialLogins({ onLogin }: SocialLoginProps) {
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState([]);
  
  const socialLogins = [
    {
      name: "Google",
      icon: "https://cdn-icons-png.flaticon.com/128/300/300221.png",
      id: "google",
      primary: true
    },
    {
      name: "Discord",
      icon: "https://cdn-icons-png.flaticon.com/128/5968/5968756.png",
      id: "discord"
    },
    {
      name: "Twitter",
      icon: "https://cdn-icons-png.flaticon.com/128/3670/3670151.png",
      id: "twitter"
    }
  ];
  
  const handleLogin = async (provider: string, providerId: string) => {
    try {
      // If already loading, prevent multiple clicks
      if (isLoading[provider]) return;
      
      setIsLoading(prev => ({ ...prev, [provider]: true }));
      toast.info(`Connecting to ${provider}...`);
      
      // If parent wants to handle login differently
      if (onLogin) {
        onLogin(provider);
        return;
      }
      
      // Store current page URL for return after auth
      localStorage.setItem('auth_return_url', window.location.pathname);
      
      // Initiate real OAuth login
      await initiateOAuthLogin(providerId);
      
      // No need to handle success here as we'll be redirected
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast.error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  // Log helper
  const addLog = (message) => {
    setLogs(prev => [...prev, message]);
    console.log(`[OAuth Debug] ${message}`);
  };
  
  useEffect(() => {
    // Show Supabase config info
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'not set';
    addLog(`Supabase URL: ${supabaseUrl}`);
    
    // Log localStorage state
    addLog(`localStorage has oauth_provider: ${!!localStorage.getItem('oauth_provider')}`);
  }, []);

  // Direct OAuth login
  const handleDirectOAuth = async (provider) => {
    try {
      addLog(`Initiating direct ${provider} OAuth...`);
      
      // Store provider for tracking
      localStorage.setItem('oauth_provider', provider);
      
      // Direct Supabase OAuth call
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      
      if (error) {
        addLog(`OAuth Error: ${error.message}`);
        console.error(error);
      } else {
        addLog(`OAuth initiated, provider window should open`);
      }
    } catch (e) {
      addLog(`Fatal error: ${e.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        variant="outline" 
        className="w-full bg-white/5 hover:bg-white/10 hover:scale-[1.02] transition-all border-0 text-white h-12"
        onClick={() => handleLogin("Google", "google")}
        disabled={isLoading["Google"]}
      >
        {isLoading["Google"] ? (
          <div className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2" />
        ) : (
          <img src={socialLogins[0].icon} alt="Google" className="w-6 h-6 mr-2" />
        )}
        Continue with Google
      </Button>
      
      <div className="grid grid-cols-3 gap-4">
        {socialLogins.slice(1).map((login) => (
          <Button
            key={login.name}
            variant="outline"
            className="bg-white/5 hover:bg-white/10 hover:scale-[1.02] transition-all border-0"
            onClick={() => handleLogin(login.name, login.id)}
            disabled={isLoading[login.name]}
          >
            {isLoading[login.name] ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
            ) : (
              <img src={login.icon} alt={login.name} className="w-6 h-6" />
            )}
          </Button>
        ))}
      </div>
      
      {/* Debug buttons */}
      <div className="mb-4 p-2 bg-black/20 rounded">
        <h3>DEBUG DIRECT OAUTH:</h3>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button onClick={() => handleDirectOAuth('google')}>
            Direct Google
          </Button>
          <Button onClick={() => handleDirectOAuth('discord')}>
            Direct Discord
          </Button>
          <Button onClick={() => handleDirectOAuth('twitter')}>
            Direct Twitter
          </Button>
        </div>
      </div>
      
      {/* Debug logs */}
      <div className="mt-4 p-2 border rounded bg-black/10 max-h-40 overflow-y-auto">
        <h3>Debug Logs:</h3>
        {logs.map((log, i) => (
          <div key={i} className="text-xs">{log}</div>
        ))}
      </div>
    </div>
  );
}
