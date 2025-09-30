import { Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type Achievement, type AchievementCategory } from "@/services/AchievementsService";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import achievementsService from "@/services/AchievementsService";
import { useWallet } from "@/components/wallet/WalletProvider";
import { toast } from "sonner";

interface AchievementGridProps {
  achievements: Achievement[];
  activeCategory: AchievementCategory | "all";
  onAchievementClaimed?: () => void;
}

export const AchievementGrid = ({
  achievements,
  activeCategory,
  onAchievementClaimed,
}: AchievementGridProps) => {
  const { address } = useWallet();
  const [achievementsList, setAchievementsList] = useState(achievements);
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());

  // Update achievements list when prop changes
  useEffect(() => {
    setAchievementsList(achievements);
    
    // Debug: Log achievements data in UI component
    console.log('🎯 AchievementGrid received achievements:', achievements.length);
    const completed = achievements.filter(a => a.status === 'completed');
    console.log('🏆 AchievementGrid completed achievements:', completed.map(a => ({
      key: a.achievement_key,
      status: a.status,
      progress: a.current_progress,
      required: a.required_count,
      percentage: a.progress_percentage,
      claimed: !!a.claimed_at
    })));
  }, [achievements]);

  const handleClaim = async (achievementKey: string) => {
    if (!address || claimingIds.has(achievementKey)) return;

    try {
      setClaimingIds(prev => new Set(prev).add(achievementKey));

      const result = await achievementsService.claimAchievementReward(address, achievementKey);

      if (result.success) {
        // Update local state
        // FRESH SYSTEM: Update status to 'claimed'
        setAchievementsList(prev =>
          prev.map(ach =>
            ach.achievement_key === achievementKey
              ? { ...ach, status: 'claimed', claimed_at: new Date().toISOString() }
              : ach
          )
        );

        // Show success toast
        toast.success(`Achievement claimed! +${result.xp_reward || 0} XP, +${result.neft_reward || 0} NEFT`);

        // Notify parent component
        onAchievementClaimed?.();
      } else {
        toast.error(result.message || 'Failed to claim achievement');
      }
    } catch (error) {
      console.error('Error claiming achievement:', error);
      toast.error('Failed to claim achievement');
    } finally {
      setClaimingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(achievementKey);
        return newSet;
      });
    }
  };

  // Filter achievements by category
  const filteredAchievements = activeCategory === 'all'
    ? achievementsList
    : achievementsList.filter(ach => ach.category === activeCategory);

  const categoryOrder = ['quest', 'burn', 'referral', 'social', 'checkin', 'staking'];

  // Sort achievements: in_progress -> completed (unclaimed) -> locked -> claimed (any)
  // If a single category is selected, group by category first; if 'all', ignore category grouping
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    // Primary sort: by category only when a single category is active
    if (activeCategory !== 'all') {
      const categoryA = categoryOrder.indexOf(a.category);
      const categoryB = categoryOrder.indexOf(b.category);
      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }
    }

    // Secondary sort: by claimed status and progress (FRESH SYSTEM)
    const aIsClaimed = a.status === 'claimed';
    const bIsClaimed = b.status === 'claimed';
    if (aIsClaimed && !bIsClaimed) return 1;
    if (!aIsClaimed && bIsClaimed) return -1;
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
    if (a.status === 'completed' && b.status !== 'completed') return -1;
    if (a.status !== 'completed' && b.status === 'completed') return 1;
    return 0;
  });

  const getProgress = (achievement: Achievement) => {
    // Debug: Log progress calculation
    console.log(`📊 Progress calc for ${achievement.achievement_key}:`, {
      status: achievement.status,
      claimed_at: achievement.claimed_at,
      progress_percentage: achievement.progress_percentage,
      current_progress: achievement.current_progress,
      required_count: achievement.required_count
    });
    
    // Special handling for check-in achievements to show proper partial progress
    if (achievement.achievement_key === 'daily_visitor' || achievement.achievement_key === 'dedicated_user') {
      const currentProgress = achievement.current_progress || 0;
      const requiredCount = achievement.achievement_key === 'daily_visitor' ? 7 : 30;
      
      // Calculate percentage based on actual progress
      const percentage = Math.min(Math.round((currentProgress / requiredCount) * 100), 100);
      
      console.log(`🎯 ${achievement.achievement_key} streak progress: ${currentProgress}/${requiredCount} = ${percentage}%`);
      return percentage;
    }
    
    // For claimed achievements, always show 100%
    if (achievement.status === 'claimed') {
      console.log(`✅ ${achievement.achievement_key} returning 100% (claimed)`);
      return 100;
    }
    
    // For completed but unclaimed achievements, show 100%
    if (achievement.status === 'completed') {
      console.log(`🏆 ${achievement.achievement_key} returning 100% (completed, ready to claim)`);
      return 100;
    }
    
    // For locked achievements, show 0%
    if (achievement.status === 'locked') {
      console.log(`🔒 ${achievement.achievement_key} returning 0% (locked)`);
      return 0;
    }
    
    // For in-progress achievements, use progress percentage
    const percentage = achievement.progress_percentage || 0;
    console.log(`⏳ ${achievement.achievement_key} returning ${percentage}% (in progress)`);
    return percentage;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-4"
    >
      {sortedAchievements.length > 0 ? (
        sortedAchievements.map((achievement) => (
          <motion.div
            key={achievement.achievement_key}
            whileHover={{ scale: 1.01 }}
            className={cn(
              'relative bg-[#121021] backdrop-blur-xl p-4 rounded-xl border border-[#2D3748]/50 transition-all duration-300 flex flex-row items-center',
              'hover:border-[#5d43ef]/80',
              achievement.status === 'claimed' && 'opacity-50'
            )}
          >
            <div className="flex-1">
              <h3 className="text-sm max-sm:text-xs font-bold text-white font-sora">
                {achievement.title}
              </h3>
              <p className="text-sm max-sm:text-[11px] text-[#94A3B8]">
                {achievement.description}
              </p>
              <div className="w-full bg-[#1b1930] rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-l from-[#5D43EF] via-[#5D43EF]/80 to-[#A7ACEC]"
                  style={{ width: `${getProgress(achievement)}%` }}
                ></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 ml-4 w-auto">
              <div className="flex flex-col items-end text-sm max-sm:text-xs font-semibold">
                {achievement.xp_reward > 0 && <span className="text-white">{achievement.xp_reward} XP</span>}
                {achievement.neft_reward > 0 && <span className="text-white mt-1">{achievement.neft_reward} NEFT</span>}
              </div>
              <Button
                onClick={() => handleClaim(achievement.achievement_key)}
                disabled={achievement.status !== 'completed' || claimingIds.has(achievement.achievement_key)}
                className={cn(
                  'text-white font-bold py-1.5 px-3 max-sm:py-1 max-sm:px-2 rounded-lg min-w-[100px] max-sm:min-w-[80px] max-sm:text-xs transition-all duration-200 border',
                  achievement.status === 'claimed' ? 'bg-[#1b1930] border-[#5d43ef]/80 cursor-not-allowed' :
                    achievement.status === 'completed' ? 'bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:shadow-lg border-transparent' :
                      'bg-[#1b1930] border-[#5d43ef]/80 opacity-50 cursor-not-allowed'
                )}
              >
                {claimingIds.has(achievement.achievement_key) ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Claiming...
                  </div>
                ) : achievement.status === 'claimed' ? 'Claimed' :
                  achievement.status === 'completed' ? 'Claim Reward' : 'Claim Reward'
                }
              </Button>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-[#38B2AC]/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">
            No Achievements Found
          </h3>
          <p className="text-[#94A3B8]">
            No achievements match your current filter selection
          </p>
        </div>
      )}
    </motion.div>
  );
};
