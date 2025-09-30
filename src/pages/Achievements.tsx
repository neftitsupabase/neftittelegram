import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AchievementGrid } from "@/components/AchievementGrid";
import { HistoryModal } from "@/components/HistoryModal";
import achievementsService, { type Achievement, type AchievementCategory } from "@/services/AchievementsService";
import { useWallet } from "@/components/wallet/WalletProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { MainNav } from "@/components/layout/MainNav";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { Trophy, Sparkles, Target, Clock, Bug, Zap } from "lucide-react";

const Achievements = () => {
  const { address, isAuthenticated } = useWallet();
  const [activeCategory, setActiveCategory] = useState<AchievementCategory | "all">("all");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    completionPercentage: 0
  });
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch user achievements and stats
  useEffect(() => {
    const fetchAchievements = async () => {
      if (!address || !isAuthenticated) {
        setAchievements([]);
        setStats({ total: 0, completed: 0, inProgress: 0, completionPercentage: 0 });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Fetching achievements for wallet:', address);
        console.log('🔍 Wallet address type:', typeof address, 'length:', address?.length);

        // SKIP INITIALIZATION - it's not needed with new system
        console.log('🚀 FRESH: Skipping initialization for new system');

        // Fetch achievements and stats in parallel
        const [userAchievements, achievementStats] = await Promise.all([
          achievementsService.getUserAchievements(address),
          achievementsService.getAchievementStats(address)
        ]);

        console.log('User achievements:', userAchievements);
        console.log('Achievement stats:', achievementStats);

        // Debug: Log completed achievements
        const completedAchievements = userAchievements.filter(a => a.status === 'completed');
        console.log('🏆 Completed achievements found:', completedAchievements.map(a => ({ key: a.achievement_key, progress: a.current_progress, status: a.status })));

        // Debug: Log burn achievements specifically
        const burnAchievements = userAchievements.filter(a => a.category === 'burn');
        console.log('🔥 Burn achievements in UI:', burnAchievements.map(a => ({ key: a.achievement_key, progress: a.current_progress, status: a.status, claimed: !!a.claimed_at })));

        setAchievements(userAchievements);
        setStats(achievementStats);
      } catch (error) {
        console.error('Error fetching achievements:', error);
        setAchievements([]);
        setStats({ total: 0, completed: 0, inProgress: 0, completionPercentage: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [address, isAuthenticated]);

  // Listen for achievement update events
  useEffect(() => {
    const handleAchievementUpdate = (event: CustomEvent) => {
      console.log('🔄 Achievement update event received:', event.detail);
      if (address && isAuthenticated && event.detail.walletAddress === address) {
        // Refresh achievements and stats when achievements are updated
        Promise.all([
          achievementsService.getUserAchievements(address),
          achievementsService.getAchievementStats(address)
        ]).then(([userAchievements, achievementStats]) => {
          console.log('🔄 Refreshed achievements after update event:', userAchievements.length);
          setAchievements(userAchievements);
          setStats(achievementStats);
        }).catch(error => {
          console.error('Error refreshing achievements after update:', error);
        });
      }
    };

    window.addEventListener('achievementUpdated', handleAchievementUpdate as EventListener);
    
    return () => {
      window.removeEventListener('achievementUpdated', handleAchievementUpdate as EventListener);
    };
  }, [address, isAuthenticated]);

  // Callback to refresh achievements when one is claimed
  const handleAchievementClaimed = () => {
    if (address && isAuthenticated) {
      // Refresh achievements and stats
      Promise.all([
        achievementsService.getUserAchievements(address),
        achievementsService.getAchievementStats(address)
      ]).then(([userAchievements, achievementStats]) => {
        setAchievements(userAchievements);
        setStats(achievementStats);
      }).catch(error => {
        console.error('Error refreshing achievements:', error);
      });
    }
  };

  // Get achievement categories from service
  const achievementCategories = achievementsService.getAchievementCategories();

  return (
    <div className="min-h-screen bg-[#0b0a14] font-sora">

      <MainNav />

      <main className="container relative mx-auto px-2 sm:px-4 lg:px-8 pt-4 md:pt-0 pb-16 md:pb-24 space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-left mb-3 sm:mb-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-sora tracking-tight text-white">
                  Achievements
                </h1>
                <p className="text-xs sm:text-sm md:text-base font-sora text-[#94A3B8] max-w-3xl mt-1 sm:mt-2">
                  Track your progress and unlock rewards as you explore the NEFTIT ecosystem
                </p>
              </div>

            </div>
          </motion.div>

          {/* Stats Summary Section Removed */}

          {/* Enhanced Categories - Mobile Optimized */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mb-4 sm:mb-6 md:mb-8"
          >
            <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2">
              {achievementCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "px-2 sm:px-2.5 md:px-4 py-1.5 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl font-sora transition-colors duration-200 text-[10px] sm:text-xs md:text-sm",
                    activeCategory === category.id
                      ? "bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white"
                      : "bg-[#0b0a14] text-[#ffffff] border border-[#ffffff] hover:border-[#4A5568]"
                  )}
                >
                    {category.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Achievements Grid */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#36F9F6] mb-4"></div>
                <p className="text-[#94A3B8] font-sora">Loading your achievements...</p>
              </motion.div>
            ) : !isAuthenticated ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Clock className="w-12 h-12 text-[#94A3B8] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2 font-sora">
                  Connect Your Wallet
                </h3>
                <p className="text-[#94A3B8] font-sora">
                  Connect your wallet to view and claim your achievements.
                </p>
              </motion.div>
            ) : (
              <AchievementGrid
                key={activeCategory}
                achievements={achievements}
                activeCategory={activeCategory}
                onAchievementClaimed={handleAchievementClaimed}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Achievements;