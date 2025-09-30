import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal, Trophy, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
  id: number;
  rank: number;
  username: string;
  avatar: string;
  xp: number;
  nfts: number;
  isCurrentUser: boolean;
}

<<<<<<< HEAD
const leaderboardData: LeaderboardEntry[] = [
  {
    id: 1,
    rank: 1,
    username: 'CryptoKing',
    avatar: '/avatars/user1.png',
    xp: 15000,
    nfts: 25,
    isCurrentUser: false
  },
  {
    id: 2,
    rank: 2,
    username: 'NFTHunter',
    avatar: '/avatars/user2.png',
    xp: 12500,
    nfts: 20,
    isCurrentUser: false
  },
  {
    id: 3,
    rank: 3,
    username: 'BlockchainMaster',
    avatar: '/avatars/user3.png',
    xp: 10000,
    nfts: 18,
    isCurrentUser: true
  },
  {
    id: 4,
    rank: 4,
    username: 'DigitalArtist',
    avatar: '/avatars/user4.png',
    xp: 8500,
    nfts: 15,
    isCurrentUser: false
  },
  {
    id: 5,
    rank: 5,
    username: 'TokenWhale',
    avatar: '/avatars/user5.png',
    xp: 7000,
    nfts: 12,
    isCurrentUser: false
  }
];
=======
const leaderboardData: LeaderboardEntry[] = [];
>>>>>>> bc0fe74 (Initial commit for finalBranch)

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-[#FFD700]" />;
    case 2:
      return <Medal className="w-5 h-5 text-[#9D9BF3]" />;
    case 3:
      return <Trophy className="w-5 h-5 text-[#FF2E63]" />;
    default:
      return <span className="text-sm font-bold text-text-secondary">{rank}</span>;
  }
};

const LeaderboardEntry = ({ entry }: { entry: LeaderboardEntry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 transition-all group",
        entry.isCurrentUser 
          ? "bg-primary/5 border border-primary/20" 
          : "bg-background-card border border-border hover:border-border-hover"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
      
      <div className="relative flex items-center gap-4">
        <div className="flex items-center justify-center w-8 h-8">
          {getRankIcon(entry.rank)}
        </div>
        
        <div className="flex items-center flex-1 min-w-0">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border mr-3">
            {entry.avatar ? (
              <img 
                src={entry.avatar} 
                alt={entry.username} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-background flex items-center justify-center">
                <User className="w-5 h-5 text-text-secondary" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
<<<<<<< HEAD
            <h3 className={cn(
              "text-base font-bold truncate font-space-grotesk",
              entry.isCurrentUser ? "text-primary" : "text-text-primary"
            )}>
=======
            <h3 className="text-base font-bold truncate font-space-grotesk text-text-primary">
>>>>>>> bc0fe74 (Initial commit for finalBranch)
              {entry.username}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-text-secondary font-manrope">
                {entry.xp.toLocaleString()} XP
              </span>
              <span className="text-xs text-text-secondary font-manrope">
                {entry.nfts} NFTs
              </span>
            </div>
          </div>
        </div>
        
        <div className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium",
          entry.rank <= 3 ? "bg-primary/10 text-primary" : "bg-background text-text-secondary"
        )}>
          Rank #{entry.rank}
        </div>
      </div>
    </motion.div>
  );
};

const Leaderboard = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-text-primary font-space-grotesk mb-1">
            Leaderboard
          </h2>
          <p className="text-sm text-text-secondary font-dm-sans">
            Top performers this week
          </p>
        </div>
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors font-manrope">
          View Full Rankings
        </button>
      </div>
      
      <div className="space-y-4">
        {leaderboardData.map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <LeaderboardEntry entry={entry} />
          </motion.div>
        ))}
      </div>
      
      {leaderboardData.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-10 text-center bg-background-card backdrop-blur-xl border border-border"
        >
          <Trophy className="h-16 w-16 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-primary font-space-grotesk mb-2">
            No Rankings Yet
          </h3>
          <p className="text-text-secondary font-dm-sans">
            Be the first to climb the leaderboard!
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default Leaderboard; 