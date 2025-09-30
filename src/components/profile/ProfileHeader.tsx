import React from 'react';
import { PencilLine, Copy, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProfileHeaderProps {
  username: string;
  walletAddress: string;
  xp: number;
  coins: number;
  level: number;
  avatar: string;
  nextLevelXp: number;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  username,
  walletAddress,
  xp,
  coins,
  level,
  avatar,
  nextLevelXp,
}) => {
  const navigate = useNavigate();
  const progressPercentage = (xp / nextLevelXp) * 100;

  const handleEditProfile = () => {
    navigate('/edit-profile');
  };

  const copyWalletAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast.success('Wallet address copied to clipboard');
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-background-card backdrop-blur-xl border border-border p-8">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
      
      <div className="relative flex flex-col md:flex-row gap-8 items-center md:items-start">
        {/* Avatar section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-4 group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#36F9F6] to-[#FF2E63] rounded-full opacity-75 group-hover:opacity-100 transition-all duration-300" />
            <div className="relative">
              <img 
                src={avatar}
                alt={username} 
                className="w-32 h-32 rounded-full object-cover border-2 border-background bg-background/80" 
              />
            </div>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute bottom-0 right-0 bg-gradient-to-r from-[#36F9F6] to-[#FF2E63] text-black font-bold px-3 py-1 rounded-full shadow-lg"
            >
              Lvl {level}
            </motion.div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleEditProfile}
              variant="outline"
              className={cn(
                "bg-background-card border-border hover:border-border-hover",
                "text-text-primary hover:text-primary",
                "flex items-center gap-2 transition-all duration-200 font-manrope"
              )}
            >
              <PencilLine className="w-4 h-4" />
              Edit Profile
            </Button>

            <Button
              variant="outline"
              className={cn(
                "bg-background-card border-border hover:border-border-hover",
                "text-text-primary hover:text-primary",
                "flex items-center gap-2 transition-all duration-200 font-manrope"
              )}
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </motion.div>

        {/* Info section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 space-y-6 text-center md:text-left"
        >
          <div>
            <h1 className="text-3xl font-bold text-text-primary font-space-grotesk mb-2">{username}</h1>
            <button 
              onClick={copyWalletAddress}
              className={cn(
                "flex items-center gap-2 mx-auto md:mx-0",
                "bg-background border border-border hover:border-border-hover",
                "px-3 py-1.5 rounded-lg transition-all duration-200 group"
              )}
            >
              <span className="font-mono text-sm text-text-secondary group-hover:text-text-primary">{walletAddress}</span>
              <Copy className="w-4 h-4 text-text-secondary group-hover:text-primary group-hover:scale-110 transition-all" />
            </button>
          </div>

          <div className="flex items-center gap-6 max-w-sm mx-auto md:mx-0">
            <div className="text-center">
              <div className="text-3xl font-bold text-text-primary font-space-grotesk">{coins}</div>
              <div className="text-sm text-text-secondary font-manrope">NEFT</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-text-primary font-space-grotesk">{xp}</div>
              <div className="text-sm text-text-secondary font-manrope">XP</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-manrope">
              <span className="text-text-secondary">Level Progress</span>
              <span className="text-text-primary font-medium">{xp}/{nextLevelXp} XP</span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-[#36F9F6] to-[#FF2E63]"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileHeader;
