import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { SocialLoginDialog } from "./SocialLoginDialog";

interface SocialLoginControllerProps {
  variant?: "default" | "outline" | "icon";
  size?: "sm" | "md" | "lg";
  className?: string;
  provider?: string;
}

export function SocialLoginController({
  variant = "default",
  size = "md",
  className = "",
  provider
}: SocialLoginControllerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Define social provider icons
  const providerIcons: Record<string, string> = {
    Google: "https://cdn-icons-png.flaticon.com/128/300/300221.png",
    Discord: "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png",
    Apple: "https://cdn-icons-png.flaticon.com/128/0/747.png",
    Twitter: "https://upload.wikimedia.org/wikipedia/commons/5/57/X_logo_2023_%28white%29.png"
  };

  // Define button sizes
  const sizeClasses = {
    sm: "h-8 px-3",
    md: "h-10 px-4",
    lg: "h-12 px-5"
  };

  // Define button variants
  const variantClasses = {
    default: "bg-black/30 hover:bg-black/50 text-white border border-white/10 rounded-xl",
    outline: "bg-transparent hover:bg-black/20 text-white border border-white/20 rounded-xl",
    icon: "bg-black/30 hover:bg-black/50 text-white border border-white/10 rounded-full w-10 p-0 flex items-center justify-center"
  };

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  return (
    <>
      {provider ? (
        // Single provider button
        <Button
          onClick={handleOpenDialog}
          className={`${variantClasses[variant]} ${sizeClasses[size]} transition-all duration-200 hover:scale-[1.02] ${className}`}
        >
          <img src={providerIcons[provider]} alt={provider} className="w-5 h-5 mr-2" />
          {variant !== "icon" && <span>Continue with {provider}</span>}
        </Button>
      ) : (
        // General social login button
        <Button
          onClick={handleOpenDialog}
          className={`${variantClasses[variant]} ${sizeClasses[size]} transition-all duration-200 hover:scale-[1.02] ${className}`}
        >
          {variant !== "icon" && <span>Social Login</span>}
          {variant === "icon" && (
            <div className="flex items-center space-x-1">
              {Object.values(providerIcons).slice(0, 3).map((icon, index) => (
                <img key={index} src={icon} alt="Social" className="w-4 h-4" style={{ marginLeft: index ? "-8px" : "0" }} />
              ))}
            </div>
          )}
        </Button>
      )}

      <SocialLoginDialog isOpen={isDialogOpen} onClose={handleCloseDialog} />
    </>
  );
} 