import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Crown, Medal, Star, Trophy, Search, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import achievementsService, { Achievement, AchievementCategory } from '@/services/AchievementsService';
import useAuthState from '@/hooks/useAuthState';

// Map achievement categories to icons
const categoryIcons = {
  quest: Trophy,
  burn: Award,
  social: Medal,
  referral: Crown,
  checkin: Star,
  staking: Trophy,
  campaign: Crown
};

// Map status to rarity for visual styling
const statusToRarity = {
  completed: 'Legendary',
  in_progress: 'Epic',
  locked: 'Common'
} as const;

const rarityConfig = {
  Common: {
    color: 'text-[#36F9F6]',
    bgColor: 'bg-[#36F9F6]',
    icon: Trophy
  },
  Rare: {
    color: 'text-[#9D9BF3]',
    bgColor: 'bg-[#9D9BF3]',
    icon: Medal
  },
  Epic: {
    color: 'text-[#FF2E63]',
    bgColor: 'bg-[#FF2E63]',
    icon: Crown
  },
  Legendary: {
    color: 'text-[#FFD700]',
    bgColor: 'bg-[#FFD700]',
    icon: Star
  }
};

// Convert service Achievement to display format
const convertAchievement = (achievement: Achievement) => {
  const icon = categoryIcons[achievement.category as keyof typeof categoryIcons] || Trophy;
  const rarity = statusToRarity[achievement.status as keyof typeof statusToRarity] || 'Common';

  return {
    id: achievement.achievement_key,
    title: achievement.title,
    description: achievement.description,
    icon,
    rarity,
    progress: achievement.current_progress,
    maxProgress: achievement.required_count,
    reward: {
      xp: achievement.xp_reward,
      coins: achievement.neft_reward
    },
    unlockedAt: achievement.completed_at
  };
};

const AchievementCard = ({ achievement }: { achievement: any }) => {
  const rarity = rarityConfig[achievement.rarity];
  const Icon = achievement.icon;
  const isUnlocked = achievement.unlockedAt !== null;
  const progress = (achievement.progress / achievement.maxProgress) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-6",
        isUnlocked
          ? "bg-[#121021] border border-primary/20"
          : "bg-[#121021] border border-border hover:border-[#5d43ef]/80",
        "transition-all duration-300 group"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            rarity.color.replace('text-', 'bg-') + '/10'
          )}>
            <Icon className={cn("w-6 h-6", rarity.color)} />
          </div>

          <div className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium font-manrope",
            rarity.color.replace('text-', 'bg-') + '/10',
            rarity.color
          )}>
            {achievement.rarity}
          </div>
        </div>

        <h3 className="text-lg font-bold text-text-primary font-space-grotesk mb-1 group-hover:text-primary transition-colors">
          {achievement.title}
        </h3>

        <p className="text-sm text-text-secondary font-dm-sans mb-4">
          {achievement.description}
        </p>

        {/* Progress Bar */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center text-sm font-manrope">
            <span className="text-text-secondary">Progress</span>
            <span className={cn(
              "font-medium",
              isUnlocked ? "text-primary" : "text-text-primary"
            )}>
              {achievement.progress}/{achievement.maxProgress}
            </span>
          </div>

          <div className="h-2 rounded-full bg-[#1b1930] overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                isUnlocked ? "bg-primary" : rarity.color.replace('text-', 'bg-') + '/50'
              )}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Rewards */}
        <div className="space-y-2">
          <span className="text-sm text-text-secondary font-manrope">Rewards</span>
          <div className="flex flex-wrap gap-2">
            <div className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium font-manrope",
              "bg-[#36F9F6]/10 text-[#36F9F6]"
            )}>
              +{achievement.reward.xp} XP
            </div>

            {achievement.reward.coins && (
              <div className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium font-manrope",
                "bg-[#FF2E63]/10 text-[#FF2E63]"
              )}>
                +{achievement.reward.coins} Coins
              </div>
            )}

            {achievement.reward.nft && (
              <div className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium font-manrope",
                "bg-[#9D9BF3]/10 text-[#9D9BF3]"
              )}>
                NFT: {achievement.reward.nft}
              </div>
            )}
          </div>
        </div>

        {isUnlocked && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-text-secondary font-manrope">
              <Trophy className="w-4 h-4 text-primary" />
              <span>Unlocked on {new Date(achievement.unlockedAt!).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Achievements = () => {
  const { walletAddress } = useAuthState();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Load achievements from service
  useEffect(() => {
    const loadAchievements = async () => {
      if (!walletAddress) return;

      try {
        setLoading(true);
        const data = await achievementsService.getUserAchievements(walletAddress);
        setAchievements(data);
      } catch (error) {
        console.error('Error loading achievements:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAchievements();
  }, [walletAddress]);

  const filteredAchievements = achievements.filter(achievement => {
    const matchesSearch = achievement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      achievement.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || achievement.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).map(convertAchievement);

  const unlockedCount = achievements.filter(a => a.status === 'completed').length;
  const totalXP = achievements.reduce((sum, a) => sum + (a.status === 'completed' ? a.xp_reward : 0), 0);

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold text-text-primary font-space-grotesk mb-1">
            Achievements
          </h2>
          <div className="flex items-center gap-4">
            <p className="text-sm text-text-secondary font-dm-sans">
              {unlockedCount} of {achievements.length} unlocked
            </p>
            <div className="w-px h-4 bg-border" />
            <p className="text-sm font-medium text-primary font-manrope">
              {totalXP.toLocaleString()} XP Earned
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search achievements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-64 px-4 py-2 rounded-lg text-sm font-medium transition-colors font-manrope",
                "bg-[#121021] border border-border focus:border-primary",
                "text-text-primary placeholder:text-text-secondary",
                "focus:outline-none focus:ring-1 focus:ring-primary"
              )}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          </div>

          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors font-manrope",
                "border border-border hover:border-border-hover",
                "flex items-center gap-2",
                isFilterOpen ? "bg-primary/10 text-primary" : "text-text-secondary hover:text-text-primary"
              )}
            >
              Category
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                isFilterOpen && "transform rotate-180"
              )} />
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-40 py-1 rounded-lg border border-border bg-[#121021] shadow-lg z-10"
                >
                  {achievementsService.getAchievementCategories().slice(1).map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategory(selectedCategory === category.id ? null : category.id as AchievementCategory);
                        setIsFilterOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-sm font-medium text-left transition-colors font-manrope",
                        selectedCategory === category.id
                          ? "text-primary bg-primary/10"
                          : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                      )}
                    >
                      {category.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-[#121021] rounded-2xl p-6 h-64" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAchievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <AchievementCard achievement={achievement} />
            </motion.div>
          ))}
        </div>
      )}

      {filteredAchievements.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-10 text-center bg-[#121021] backdrop-blur-xl border border-border"
        >
          <Trophy className="h-16 w-16 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-primary font-space-grotesk mb-2">
            No Achievements Found
          </h3>
          <p className="text-text-secondary font-dm-sans">
            Try adjusting your search or filters
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default Achievements; 