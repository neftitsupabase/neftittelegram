import React from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';

export function UserProfileDisplay() {
  const walletAddress = typeof window !== 'undefined' ? localStorage.getItem('walletAddress') : null;
  const { profile, loading, error } = useUserProfile(walletAddress);

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error}</div>;

  return profile ? (
    <div className="flex items-center gap-3">
      <img
        src={profile.avatar_url || '/profilepictures/profileimg1.jpg'}
        alt="Avatar"
        className="w-10 h-10 rounded-full border border-gray-300"
      />
      <div>
        <div className="font-bold text-white">{profile.display_name}</div>
        {profile.email && <div className="text-xs text-gray-400">{profile.email}</div>}
        {profile.wallet_address && (
          <div className="text-xs text-gray-400 break-all">{profile.wallet_address}</div>
        )}
      </div>
    </div>
  ) : (
    <div>No profile found.</div>
  );
} 