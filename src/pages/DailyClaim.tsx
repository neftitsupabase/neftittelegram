import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, CalendarDays, Flame, Clock, Loader2 } from "lucide-react";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useAuthState } from "@/hooks/useAuthState";
import dailyClaimsService from "@/services/DailyClaimsService";
import userBalanceService from "@/services/UserBalanceService";
import { toast } from "sonner";

// Component for use in navigation
export function DailyClaim({ open, onOpenChange, hideTrigger }: { open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const { isAuthenticated } = useWallet();
  const { walletAddress } = useAuthState();

  // Support controlled/uncontrolled dialog open state
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [lastClaimDate, setLastClaimDate] = useState<string | null>(null);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [xpAmount, setXpAmount] = useState(0);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string>("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [claimedRewardAmount, setClaimedRewardAmount] = useState(0);
  const [claimedXpAmount, setClaimedXpAmount] = useState(0);
  const [nextClaimAt, setNextClaimAt] = useState<Date | null>(null);

  // Load user's daily claim status when component mounts or wallet changes
  useEffect(() => {
    const loadClaimStatus = async () => {
      if (isAuthenticated && walletAddress) {
        setLoadingStatus(true);
        try {
          // Use optimized dashboard call for accurate cooldown timing and totals
          const dashboard = await dailyClaimsService.getDashboardData(walletAddress);
          setCurrentStreak(dashboard.current_streak);
          setLastClaimDate(dashboard.last_claim_date || null);
          setCanClaim(dashboard.can_claim_today === true);

          // FIXED: Use database dashboard data for accurate next reward display
          // The database function already calculates the correct next day's reward
          console.log('🔍 Dashboard data received:', {
            current_streak: dashboard.current_streak,
            can_claim_today: dashboard.can_claim_today,
            neft_reward: dashboard.neft_reward,
            xp_reward: dashboard.xp_reward,
            reward_tier: dashboard.reward_tier,
            cycle_day: dashboard.cycle_day,
            last_claim_date: dashboard.last_claim_date
          });

          // Use the database's calculated next reward directly
          const nextReward = {
            neft: dashboard.neft_reward || 0,
            xp: dashboard.xp_reward || 0
          };

          // EMERGENCY FIX: If database returns 0 rewards, calculate manually
          if (nextReward.neft === 0 && nextReward.xp === 0) {
            console.log('⚠️ Database returned 0 rewards, calculating manually...');
          const nextStreak = dashboard.current_streak + 1;
          const cycleDay = ((nextStreak - 1) % 7) + 1;

          const progressiveRewards = [
              { neft: 5, xp: 5 },   // Day 1 - Fresh Start
              { neft: 8, xp: 8 },   // Day 2 - Building Momentum  
              { neft: 12, xp: 12 }, // Day 3 - Getting Stronger
              { neft: 17, xp: 17 }, // Day 4 - Steady Progress
              { neft: 22, xp: 22 }, // Day 5 - Consistent Effort
              { neft: 30, xp: 30 }, // Day 6 - Almost There
              { neft: 35, xp: 35 }  // Day 7 - Weekly Champion
            ];
            
            const manualReward = progressiveRewards[cycleDay - 1] || progressiveRewards[0];
            nextReward.neft = manualReward.neft;
            nextReward.xp = manualReward.xp;
            console.log('✅ Manual calculation result:', nextReward);
          }

          console.log('✅ Using database next reward:', nextReward);
          console.log('📊 Current streak:', dashboard.current_streak, '→ Next reward:', nextReward);
          console.log('🎯 Expected behavior: After Day 1 claim, should show Day 2 rewards (8 NEFT + 8 XP)');

          setRewardAmount(nextReward.neft);
          setXpAmount(nextReward.xp);

          // CRITICAL FIX: Build accurate next-claim target using dashboard timer data
          if (!dashboard.can_claim_today) {
            const hours = Number(dashboard.hours_until_next_claim || 0);
            const minutes = Number(dashboard.minutes_until_next_claim || 0);
            
            if (hours > 0 || minutes > 0) {
              // Use precise timer from database
              const now = new Date();
              const target = new Date(now.getTime() + (hours * 60 + minutes) * 60 * 1000);
              setNextClaimAt(target);
              console.log(`⏰ Timer set: ${hours}h ${minutes}m until next claim`);
            } else {
              // Fallback: Use last claim date + 24 hours
              if (dashboard.last_claim_date) {
                const lastClaim = new Date(dashboard.last_claim_date);
                const target = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
                setNextClaimAt(target);
                console.log(`⏰ Fallback timer: 24h from last claim at ${dashboard.last_claim_date}`);
              }
            }
          } else {
            setNextClaimAt(null);
            console.log(`✅ Can claim today - no timer needed`);
          }
        } catch (error) {
          console.error('Error loading claim status:', error);
          toast.error('Failed to load daily claim status');
        } finally {
          setLoadingStatus(false);
        }
      } else {
        // Reset state when not authenticated
        setCurrentStreak(0);
        setCanClaim(false);
        setLastClaimDate(null);
        setRewardAmount(0);
        setXpAmount(0);
        setLoadingStatus(false);
        setNextClaimAt(null);
      }
    };

    loadClaimStatus();
  }, [isAuthenticated, walletAddress]);

  // IMPROVED: Update countdown timer with better accuracy
  useEffect(() => {
    if (!canClaim && nextClaimAt) {
      const updateTimer = () => {
        const now = new Date();
        const timeDiff = nextClaimAt.getTime() - now.getTime();

        if (timeDiff <= 0) {
          // Timer expired - user can now claim
          setCanClaim(true);
          setTimeUntilNextClaim("");
          console.log('⏰ Timer expired - user can now claim');
        } else {
          // Calculate remaining time
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
          
          // Format timer display
          if (hours > 0) {
            setTimeUntilNextClaim(`${hours}h ${minutes}m ${seconds}s`);
          } else if (minutes > 0) {
            setTimeUntilNextClaim(`${minutes}m ${seconds}s`);
          } else {
            setTimeUntilNextClaim(`${seconds}s`);
          }
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else if (canClaim) {
      // Clear timer when user can claim
      setTimeUntilNextClaim("");
    }
  }, [canClaim, nextClaimAt]);

  const launchConfetti = () => {
    const count = 120;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 999999,
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 4,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 0.8,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleClaim = async () => {
    if (!isAuthenticated || !walletAddress || !canClaim || loading) return;

    setLoading(true);
    try {
      // Process daily claim through Supabase backend
      const result = await dailyClaimsService.processDailyClaim(walletAddress);

      if (result.success) {
        setClaimed(true);
        setCurrentStreak(result.streak_count || 0);
        setCanClaim(false);
        setLastClaimDate(new Date().toISOString());

        // Store claimed amounts for success message
        setClaimedRewardAmount(result.neft_reward || 0);
        setClaimedXpAmount(result.xp_reward || 0);

        // Note: Achievement checking can be added later when specific achievement keys are defined
        // For now, the daily claim is tracked in the activity log above

        // Launch confetti
        launchConfetti();

        // CRITICAL FIX: Remove duplicate balance update events
        // The DailyClaimsService already emits balance update events
        // Only dispatch UI-specific events here to avoid double rewards
        
        // Dispatch event for UI updates (streak display, etc.)
        window.dispatchEvent(new CustomEvent('daily-reward-claimed', {
          detail: {
            neftAmount: result.neft_reward,
            xpAmount: result.xp_reward,
            newStreak: result.streak_count
          }
        }));

        // Note: Balance update events are handled by DailyClaimsService
        // to prevent double reward addition in UI

        // CRITICAL FIX: Refresh dashboard data to show updated timer and next reward
        try {
          const updatedDashboard = await dailyClaimsService.getDashboardData(walletAddress);
          setCurrentStreak(updatedDashboard.current_streak);
          setLastClaimDate(updatedDashboard.last_claim_date || null);
          setCanClaim(updatedDashboard.can_claim_today === true);
          
          // Update next reward display
          setRewardAmount(updatedDashboard.neft_reward || 0);
          setXpAmount(updatedDashboard.xp_reward || 0);
          
          // Update timer if there's a cooldown
          if (updatedDashboard.hours_until_next_claim !== undefined && updatedDashboard.minutes_until_next_claim !== undefined) {
            const hours = updatedDashboard.hours_until_next_claim;
            const minutes = updatedDashboard.minutes_until_next_claim;
            setTimeUntilNextClaim(`${hours}h ${minutes}m`);
          }
          
          console.log('✅ Dashboard refreshed after claim:', updatedDashboard);
        } catch (error) {
          console.error('❌ Error refreshing dashboard after claim:', error);
        }

        toast.success(`Daily reward claimed! +${result.neft_reward} NEFT, +${result.xp_reward} XP`);

        // Hide success message and close dialog after 3 seconds
        setTimeout(() => {
          setClaimed(false);
          setIsOpen(false);
        }, 3000);
      } else {
        toast.error(result.message || 'Failed to claim daily reward');
      }
    } catch (error) {
      console.error('Error claiming daily reward:', error);
      toast.error('Failed to claim daily reward. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      { !hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-gradient-to-r from-[#0b0a14]/40 to-[#5d43ef]/60 hover:from-[#5d43ef] hover:to-[#0b0a14] text-white border-[#5d43ef] backdrop-blur-sm transition-all duration-100 hover:scale-105 h-8"
          >
            <div className="relative">
              {/* <Flame className="h-4 w-4 mr-2 animate-pulse" /> */}
            </div>
            <span className="font-medium">Daily Claim</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-card/90 backdrop-blur-xl border-[#5d43ef]/60 sm:border-white/20 text-white max-w-[300px] sm:max-w-md p-0 overflow-hidden">
        <DialogTitle className="sr-only">Daily Streak Rewards</DialogTitle>
        <DialogDescription className="sr-only">
          Claim your daily rewards and build your streak. Complete daily tasks to earn NEFT tokens and XP points.
        </DialogDescription>
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 text-white/60 hover:text-white transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div
              key="not-authenticated"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-700/50 to-gray-800/50 mx-auto flex items-center justify-center border border-gray-600/30">
                <Gift className="h-8 w-8 text-gray-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Connect Your Wallet</h2>
                <p className="text-gray-400 text-sm">Connect your wallet to claim daily rewards and build your streak!</p>
              </div>
            </motion.div>
          ) : loadingStatus ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 text-center space-y-4"
            >
              <Loader2 className="w-8 h-8 animate-spin text-[#5d43ef] mx-auto" />
              <p className="text-white/60">Loading claim status...</p>
            </motion.div>
          ) : !claimed ? (
            <motion.div
              key="claim"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6"
            >
              <div className="relative h-32 -mt-6 -mx-6 mb-4 sm:mb-6 bg-gradient-to-b from-[#5d43ef]/20 to-transparent flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className="relative"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#19172d]/70 to-[#5d43ef]/30 backdrop-blur-xl flex items-center justify-center border border-[#5d43ef]/30">
                    <Flame className="h-12 w-12 text-[#5d43ef]" />
                  </div>
                  <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-[#5d43ef] to-[#5d43ef]/50 border-none text-white px-3 py-1">
                    {currentStreak} Days
                  </Badge>
                </motion.div>
              </div>

              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#5d43ef] to-[#5d43ef]/50 bg-clip-text text-transparent">
                    {currentStreak === 0 ? 'First Claim!' : `${currentStreak} Day Streak!`}
                  </h2>
                  <p className="text-sm sm:text-base text-white/60">
                    {canClaim ? "Ready to claim today's reward! 🔥" : "Come back tomorrow for your next reward! ⏰"}
                  </p>
                </div>

                {!canClaim && timeUntilNextClaim && (
                  <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Next claim in: {timeUntilNextClaim}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-r from-[#5d43ef]/10 to-[#19172d]/10 rounded-lg sm:p-4 p-2 flex items-center justify-between backdrop-blur-sm border border-[#5d43ef]/20"
                  >
                    <div className="flex items-center gap-3">
                      <Gift className="h-5 w-5 text-[#5d43ef]" />
                      <span className="text-sm sm:text-base font-medium">Next Reward</span>
                    </div>
                    <div className="flex gap-2">
                    <span className="bg-white text-[#5d43ef] px-2 py-1 rounded-xl sm:rounded-full text-center font-bold text-xs sm:text-sm">
                        {rewardAmount} NEFT
                      </span>
                      <span className="bg-white text-[#5d43ef] px-2 py-1 rounded-xl sm:rounded-full text-center font-bold text-xs sm:text-sm">
                        {xpAmount} XP
                      </span>

                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Button
                      onClick={handleClaim}
                      className="w-full h-12 bg-gradient-to-r from-[#5d34ef] to-[#19172d] hover:from-[#5d34efd2] hover:to-[#19172dcb] text-white border-none shadow-lg shadow-[#5d43ef]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canClaim || loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Claiming...
                        </>
                      ) : canClaim ? (
                        <>
                          <Gift className="h-5 w-5 mr-2" />
                          Claim Today's Reward
                        </>
                      ) : (
                        <>
                          <Clock className="h-5 w-5 mr-2" />
                          Already Claimed Today
                        </>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="py-12 px-6 text-center space-y-6 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#5d43ef]/20 to-transparent" />

              <motion.div
                initial={{ rotate: 0 }}
                animate={{
                  rotate: 360,
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 0.6,
                  times: [0, 0.5, 1],
                }}
                className="relative z-10"
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#5d43ef]/30 to-[#5d43ef]/30 mx-auto flex items-center justify-center border border-[#5d43ef]/30">
                  <Gift className="h-12 w-12 text-[#5d43ef]" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative z-10 space-y-2"
              >
                <h2 className="text-2xl font-bold text-white">
                  Congratulations! 🎉
                </h2>
                <p className="text-gray-300">
                  You've earned <span className="text-white font-semibold">{claimedRewardAmount} NEFT</span> and{' '}
                  <span className="text-white font-semibold">{claimedXpAmount} XP</span>. Come back tomorrow to continue your streak!
                </p>
                <div className="flex justify-center gap-2">
                <span className="bg-white text-[#5d43ef] px-2 py-1 rounded-full sm:rounded-full font-bold text-xs sm:text-sm">
                    +{claimedRewardAmount} NEFT
                  </span>
                  <span className="bg-white text-[#5d43ef] px-2 py-1 rounded-full sm:rounded-full font-bold text-xs sm:text-sm">
                    +{claimedXpAmount} XP
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

