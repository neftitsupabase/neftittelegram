import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { useUserProfile } from '@/hooks/useUserProfile';
import { getWalletAddress } from '@/utils/authUtils';

export function ProfileButton() {
  const walletAddress = getWalletAddress();
  const { profile, loading } = useUserProfile(walletAddress);

  // Local override so we can update immediately on avatar change events
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { avatarUrl?: string } | undefined;
      if (detail?.avatarUrl) {
        setAvatarOverride(detail.avatarUrl);
      }
    };

    window.addEventListener('avatar-changed', handler as EventListener);
    return () => {
      window.removeEventListener('avatar-changed', handler as EventListener);
    };
  }, []);

  const username = profile?.display_name || profile?.username || 'User';
  const avatar = avatarOverride || profile?.avatar_url || '/profilepictures/profileimg1.jpg';

  return <Button variant="ghost" size="icon" className="rounded-full p-0 h-10 w-10 ring-1 ring-white/20 hover:ring-white/40 transition-all" type="button" aria-label="Open profile menu">
      <Avatar>
        <AvatarImage alt="Profile" src={avatar} />
        <AvatarFallback>{username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
    </Button>;
}