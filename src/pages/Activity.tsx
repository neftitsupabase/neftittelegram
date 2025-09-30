import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trophy,
  Gift,
  Flame,
  Filter,
  ChevronRight,
  Clock,
  Zap,
  X,
  Search,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import StarryBackground from "@/components/layout/StarryBackground";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useAuthState } from "@/hooks/useAuthState";
import activityTrackingService, { type ActivityItem, type ActivityType } from "@/services/ActivityTrackingService";
import userBalanceService from "@/services/UserBalanceService";
import { UserBalance } from "@/types/balance";

const Activity = () => {
  const { address, isAuthenticated } = useWallet();
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<ActivityType | "all">("all");
  const [allActivities, setAllActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);

  // Fetch user activities and balance from the services
  useEffect(() => {
    const fetchData = async () => {
      if (!address || !isAuthenticated) {
        setAllActivities([]);
        setUserBalance(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const activities = await activityTrackingService.getUserActivities(
          address,
          undefined, // no filter - get all types
          50, // limit
          0 // offset
        );
        setAllActivities(activities);

        const balance = await userBalanceService.getUserBalance(address);
        setUserBalance(balance);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setAllActivities([]);
        setUserBalance(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [address, isAuthenticated]);

  const filteredActivities =
    filter === "all"
      ? allActivities
      : allActivities.filter((activity) => activity.type === filter);

  const taskCount = allActivities.filter((a) => a.type === "task").length;
  const claimCount = allActivities.filter((a) => a.type === "claim").length;
  const burnCount = allActivities.filter((a) => a.type === "burn").length;
  const stakeCount = allActivities.filter((a) => a.type === "stake" || a.type === "unstake").length;
  const achievementCount = allActivities.filter((a) => a.type === "achievement").length;
  const dailyClaimCount = allActivities.filter((a) => a.type === "daily_claim").length;
  const campaignCount = allActivities.filter((a) => a.type === "campaign").length;

  // Use the balance from the userBalanceService
  const totalNeftEarned = userBalance?.total_neft_claimed || 0;
  const totalXpEarned = userBalance?.total_xp_earned || 0;

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case "task":
        return <Trophy className="h-5 w-5 text-[#5d43ef]" />;
      case "claim":
        return <Gift className="h-5 w-5 text-[#5d43ef]" />;
      case "burn":
        return <Flame className="h-5 w-5 text-[#5d43ef]" />;
      case "stake":
        return <TrendingUp className="h-5 w-5 text-[#5d43ef]" />;
      case "unstake":
        return <TrendingUp className="h-5 w-5 text-[#5d43ef] rotate-180" />;
      case "campaign":
        return <Trophy className="h-5 w-5 text-[#5d43ef]" />;
      case "daily_claim":
        return <Clock className="h-5 w-5 text-[#5d43ef]" />;
      case "achievement":
        return <Trophy className="h-5 w-5 text-[#5d43ef]" />;
      default:
        return <Zap className="h-5 w-5 text-[#5d43ef]" />;
    }
  };

  const getActivityBgClass = (type: ActivityType) => {
    switch (type) {
      case "task":
        return "from-[#38B2AC]/20 to-[#38B2AC]/10";
      case "claim":
        return "from-[#38B2AC]/20 to-[#38B2AC]/10";
      case "burn":
        return "from-[#38B2AC]/20 to-[#38B2AC]/10";
    }
  };

  const handleViewDetails = (activity: ActivityItem) => {
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0b0a14]">
      <Layout className="pt-0">
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="container relative mx-auto px-4 pt-0 mt-0 pb-16"
        >
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-left mb-4"
            >
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-sora tracking-tight text-white mt-0 pt-0">
                Activity Log
              </h1>
              <p className="text-xs sm:text-sm md:text-base font-sora text-[#94A3B8] max-w-2xl mt-1 mb-8">
                Track your journey, achievements, and rewards in the NEFTIT
                ecosystem
              </p>
            </motion.div>


            {/* Activities List */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              {loading ? (
                <div className="glass-card text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="font-site-body text-muted-foreground">Loading your activities...</p>
                </div>
              ) : !isAuthenticated ? (
                <div className="glass-card text-center py-12">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-site-heading text-lg font-bold text-foreground mb-2">
                    Connect Your Wallet
                  </h3>
                  <p className="font-site-body text-muted-foreground">
                    Connect your wallet to view your activity history.
                  </p>
                </div>
              ) : filteredActivities.length > 0 ? (
                filteredActivities.map((activity) => (
                  <motion.div
                    key={activity.id}
                    whileHover={{ scale: 1.005 }}
                    onClick={() => handleViewDetails(activity)}
                    className=" bg-[#121021] p-4 border rounded-lg hover:border-[#5d43ef] transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-[#121021]">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-site-heading text-base sm:text-lg font-bold text-foreground mb-1 truncate">
                          {activity.activity_title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{new Date(activity.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                          {activity.status && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-border"></span>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-xs",
                                  activity.status === "completed"
                                    ? "bg-[#5d43ef]/20 text-[#5d43ef]"
                                    : activity.status === "pending"
                                      ? "bg-yellow-500/20 text-yellow-500"
                                      : "bg-destructive/20 text-destructive"
                                )}
                              >
                                {activity.status}
                              </span>
                            </>
                          )}
                          {activity.nft_reward && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-border"></span>
                              <span className="text-xs text-[#5d43ef]">NFT Reward</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card text-center py-12"
                >
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-site-heading text-lg font-bold text-foreground mb-2">
                    No Activities Found
                  </h3>
                  <p className="font-site-body text-muted-foreground">
                    Complete tasks, claim rewards or burn NFTs to see your
                    activity history here.
                  </p>
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.main>
      </Layout>

      {/* Activity Details Modal - Moved outside Layout */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent variant="glass" className="max-w-md bg-[#121021]">
          <DialogHeader>
            <DialogTitle className="font-site-heading text-xl text-white">
              Activity Details
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detailed information about the selected activity item.
            </DialogDescription>
          </DialogHeader>

          {selectedActivity && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-[#1b1930]">
                  {getActivityIcon(selectedActivity.type)}
                </div>
                <div>
                  <h3 className="font-site-heading text-lg font-bold text-white mb-1">
                    {selectedActivity.activity_title}
                  </h3>
                  <p className="font-site-body text-sm text-gray-300">
                    {selectedActivity.created_at}
                  </p>
                </div>
              </div>

              {selectedActivity.details && (
                <div className="bg-[#1b1930] p-4 rounded-lg border border-white/10">
                  <p className="font-site-body text-gray-300">
                    {selectedActivity.details}
                  </p>
                </div>
              )}

              {(selectedActivity.neft_reward > 0 || selectedActivity.xp_reward > 0 || selectedActivity.nft_reward) && (
                <div className="bg-[#1b1930] p-4 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3 mb-2">
                    <Gift className="h-5 w-5 text-[#5d43ef]" />
                    <span className="font-medium text-white">
                      Rewards
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {selectedActivity.neft_reward > 0 && (
                      <div className="text-[#5d43ef]">+{selectedActivity.neft_reward} NEFT</div>
                    )}
                    {selectedActivity.xp_reward > 0 && (
                      <div className="text-[#5d43ef]">+{selectedActivity.xp_reward} XP</div>
                    )}
                    {selectedActivity.nft_reward && (
                      <div className="text-[#5d43ef]">NFT: {selectedActivity.nft_reward}</div>
                    )}
                  </div>
                </div>
              )}

              {selectedActivity.status && (
                <div className="bg-[#1b1930] p-4 rounded-lg border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-[#5d43ef]" />
                    <span className="font-medium text-white">
                      Status
                    </span>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      selectedActivity.status === "completed"
                        ? "bg-[#5d43ef]/20 text-[#5d43ef]"
                        : selectedActivity.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-500"
                          : "bg-destructive/20 text-destructive"
                    )}
                  >
                    {selectedActivity.status}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <div className="w-full flex justify-center">
              <Button
                className="w-[100px] bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white font-bold"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Activity;