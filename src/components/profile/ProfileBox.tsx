import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useUserProfile } from '@/hooks/useUserProfile';
import { getWalletAddress } from '@/utils/authUtils';

interface ProfileBoxProps {
  className?: string;
}

// Function to get the best available username
  const getBestUsername = () => {
    // First try to get stored username
    const storedUsername = sessionStorage.getItem("username") || localStorage.getItem("username");
    if (storedUsername) return storedUsername;
    
    // Check for social provider data
    const provider = sessionStorage.getItem("provider") || localStorage.getItem("provider") || '';
    const userMetadata = JSON.parse(sessionStorage.getItem("user_metadata") || localStorage.getItem("user_metadata") || '{}');
    
    if (provider && userMetadata) {
      switch (provider) {
        case 'google':
        case 'discord':
          return userMetadata.full_name || userMetadata.name || 'User';
        case 'twitter':
          return userMetadata.preferred_username || userMetadata.name || 'User';
        case 'telegram':
          return (userMetadata.first_name || '') + (userMetadata.last_name ? ` ${userMetadata.last_name}` : '') || 
                 userMetadata.username || 'User';
        default:
          break;
      }
    }
    
    // Fallback to email-based username
    const email = sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || '';
    if (email) {
      return email.split('@')[0]
        .replace(/[^a-zA-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    return 'User';
  };

export function ProfileBox({ className }: ProfileBoxProps) {
  const walletAddress = getWalletAddress();
  const { profile, loading } = useUserProfile(walletAddress);

  const username = profile?.display_name || profile?.username || 'User';
  const avatar = profile?.avatar_url || '/profilepictures/profileimg1.jpg';
  const level = profile?.level || 1;

  return (
    <Link to="/profile" className="block">
      <div 
        className={cn(
          "relative p-4 transition-all duration-300",
          "bg-[#0b0a14] hover:bg-[#1b1930] cursor-pointer rounded-none",
          className
        )}
      >
        <div className="relative flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-pink-500/20 border border-white/20">
              <AvatarImage 
                alt="Profile" 
                src={avatar} 
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                {username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex flex-col">
            <h4 className="font-medium text-sm text-white">
              {username}
            </h4>
          </div>
          
          {/* <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" /> */}
        </div>
      </div>
    </Link>
  );
}