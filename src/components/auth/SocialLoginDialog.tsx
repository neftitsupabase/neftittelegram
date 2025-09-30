import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { initiateOAuthLogin } from "@/api/oauth";

interface SocialLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SocialLoginDialog({ isOpen, onClose, onSuccess }: SocialLoginDialogProps) {
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  const socialProviders = [
    {
      name: "Google",
      icon: "https://cdn-icons-png.flaticon.com/128/300/300221.png",
      color: "#DB4437",
      id: "google"
    },
    {
      name: "Discord",
      icon: "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png",
      color: "#5865F2",
      id: "discord"
    },
    {
      name: "Twitter",
      icon: "https://upload.wikimedia.org/wikipedia/commons/5/57/X_logo_2023_%28white%29.png",
      color: "#1DA1F2",
      id: "twitter"
    }
  ];

  const handleSocialLogin = async (provider: string, providerId: string) => {
    try {
      setIsLoading({ ...isLoading, [provider]: true });
      
      // Log which provider we're attempting to use
      toast.info(`Connecting to ${provider}...`);
      
      // Initiate the real OAuth flow - this will redirect the user
      initiateOAuthLogin(providerId);
      
      // Note: No need to close dialog as we're redirecting away
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast.error(`${provider} login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading({ ...isLoading, [provider]: false });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-black/90 backdrop-blur-lg border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">Continue with Social Login</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {socialProviders.map((provider) => (
            <Button
              key={provider.name}
              onClick={() => handleSocialLogin(provider.name, provider.id)}
              disabled={isLoading[provider.name]}
              className="flex items-center justify-center w-full p-3 space-x-3 rounded-lg hover:scale-[1.01] transition-all"
              style={{ backgroundColor: `${provider.color}20`, borderColor: provider.color }}
            >
              {isLoading[provider.name] ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              ) : (
                <img src={provider.icon} alt={provider.name} className="w-6 h-6" />
              )}
              <span>Continue with {provider.name}</span>
            </Button>
          ))}
        </div>
        
        <div className="mt-4 text-center text-sm text-gray-400">
          By connecting, you agree to our Terms of Service & Privacy Policy
        </div>
      </DialogContent>
    </Dialog>
  );
} 