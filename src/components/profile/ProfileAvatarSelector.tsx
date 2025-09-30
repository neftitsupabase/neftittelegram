import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Edit2, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileAvatarSelectorProps {
  currentAvatarUrl?: string;
  username?: string;
  onAvatarChange: (avatarUrl: string) => void;
  onHasUnsavedChanges: (hasChanges: boolean) => void;
  className?: string;
}

// Available profile avatars - using local profilepictures
const availableAvatars = [
  '/profilepictures/profileimg1.jpg',
  '/profilepictures/profileimg2.jpg',
  '/profilepictures/profileimg3.jpg',
  '/profilepictures/profileimg4.jpg',
  '/profilepictures/profileimg5.jpg',
  '/profilepictures/profileimg6.jpg',
  '/profilepictures/profileimg7.jpg',
  '/profilepictures/profileimg8.jpg',
  '/profilepictures/profileimg9.jpg',
  '/profilepictures/profileimg10.jpg',
  '/profilepictures/profileimg11.jpg'
];

// Default avatar URL
const DEFAULT_AVATAR = '/profilepictures/profileimg1.jpg';

export default function ProfileAvatarSelector({
  currentAvatarUrl = "",
  username = "",
  onAvatarChange,
  onHasUnsavedChanges,
  className = ""
}: ProfileAvatarSelectorProps) {
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);
  const [initialAvatarUrl, setInitialAvatarUrl] = useState("");
  const [tempSelectedAvatar, setTempSelectedAvatar] = useState("");

  // Initialize avatar URL from props
  useEffect(() => {
    // Use default avatar if no avatar is set or if it's not one of our local avatars
    if (!currentAvatarUrl || !currentAvatarUrl.includes('/profilepictures/')) {
      const defaultAvatar = DEFAULT_AVATAR;
      setAvatarUrl(defaultAvatar);
      setInitialAvatarUrl(defaultAvatar);
      setTempSelectedAvatar(defaultAvatar);
      onAvatarChange(defaultAvatar);
    } else {
      setAvatarUrl(currentAvatarUrl);
      setInitialAvatarUrl(currentAvatarUrl);
      setTempSelectedAvatar(currentAvatarUrl);
    }
  }, [currentAvatarUrl, onAvatarChange]);

  const handleAvatarSelect = (selectedAvatarUrl: string) => {
    setTempSelectedAvatar(selectedAvatarUrl);
  };

  const handleApplyAvatar = () => {
    setAvatarUrl(tempSelectedAvatar);
    onAvatarChange(tempSelectedAvatar);
    
    // Check if this is different from the initial avatar
    const hasChanges = tempSelectedAvatar !== initialAvatarUrl;
    onHasUnsavedChanges(hasChanges);
    
    // Broadcast avatar change so other components can react immediately
    try {
      window.dispatchEvent(
        new CustomEvent('avatar-changed', {
          detail: { avatarUrl: tempSelectedAvatar }
        })
      );
    } catch (e) {
      // no-op: event dispatch should not block UI even if unsupported
    }
    
    setShowAvatarGallery(false);
  };

  return (
    <>
      {/* Avatar Display */}
      <div className={cn("relative group", className)}>
        <div className="absolute -inset-2 bg-[#1b1930] rounded-full transition-all duration-500" />
        <div className="relative">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 cursor-pointer">
            <AvatarImage src={avatarUrl} alt="Profile" />
            <AvatarFallback className="bg-[#1b1930] text-white text-xl">
              {username?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Edit button overlay - shows on hover */}
          <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            {/* Select from gallery button */}
            <Button
              size="sm"
              onClick={() => setShowAvatarGallery(true)}
              className="bg-[#5d43ef] hover:bg-[#5d43ef]/80 transition-colors duration-200 rounded-full p-3 shadow-lg"
            >
              <Edit2 className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Avatar Gallery Modal */}
      {showAvatarGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#121021] border border-[#5d43ef]/20 rounded-xl p-6 lg:pl-10  max-w-3xl mt-10 w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold text-white">Choose Your Profile Avatar</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAvatarGallery(false)}
                className="text-white/60 hover:text-white hover:bg-[#5d43ef]/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <p className="text-white/60 text-sm mb-8">Select one of our curated profile avatars below:</p>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {availableAvatars.map((avatar, index) => (
                <div
                  key={index}
                  className={cn(
                    "relative group cursor-pointer rounded-full h-20 w-20 overflow-hidden border-2 transition-all duration-200 flex items-center justify-center",
                    tempSelectedAvatar === avatar 
                      ? "border-[#5d43ef] scale-105" 
                      : "border-transparent hover:border-[#5d43ef]/50 hover:scale-105"
                  )}
                  onClick={() => handleAvatarSelect(avatar)}
                >
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatar} alt={`Avatar ${index + 1}`} />
                    <AvatarFallback className="bg-[#1b1930] text-white">
                      {index + 1}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Selection indicator */}
                  {tempSelectedAvatar === avatar && (
                    <div className="absolute inset-0 bg-[#5d43ef]/20 flex items-center justify-center rounded-full">
                      <CheckCircle className="h-6 w-6 text-[#5d43ef]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAvatarGallery(false)}
                className="border-[#5d43ef]/20 text-white hover:bg-[#5d43ef]/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApplyAvatar}
                className="bg-[#5d43ef] hover:bg-[#5d43ef]/80 text-white"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
