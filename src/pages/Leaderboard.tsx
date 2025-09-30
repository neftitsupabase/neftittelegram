import React, { useState } from "react";
import {
  Share2,
  Twitter,
  MessageSquare,
  Award,
  RefreshCw,
  Trophy,
  Gift,
  ChevronUp,
  Users,
  Clock,
  Zap,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { MainNav } from "@/components/layout/MainNav";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/hooks/useAuthState";

const Leaderboard = () => {
  const [timeFilter, setTimeFilter] = useState<"allTime" | "thisMonth">(
    "allTime"
  );
  const [activeTab, setActiveTab] = useState("neft");

  // Get current user wallet address from authentication
  const { isAuthenticated, walletAddress: currentUserWallet, isLoading: authLoading } = useAuthState();

  // Use real backend data instead of mock data
  const {
    neftLeaderboard,
    nftLeaderboard,
    currentUser,
    isLoading,
    error,
    refreshLeaderboards
  } = useLeaderboard(currentUserWallet);

  const handleTimeFilterChange = (value: "allTime" | "thisMonth") => {
    setTimeFilter(value);
  };

  const handleRefresh = async () => {
    await refreshLeaderboards();
    toast.success(
      "Leaderboard Updated: The latest rankings have been loaded."
    );
  };

  const handleShare = (platform: "twitter" | "discord") => {
    const message = `🏆 Ranked #${currentUser.rank} on NEFTIT! Join the competition and climb the ranks! 🚀`;

    if (platform === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
        "_blank"
      );
    } else {
      navigator.clipboard.writeText(message);
      toast.success("Message Copied: Share your achievement on Discord!");
    }
  };

  const handleBoostRank = () => {
    toast.success(
      "Boost Your Rank: Buy more NEFT tokens or NFTs to climb up the leaderboard!"
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0A14] font-sora relative overflow-hidden">
     

      <MainNav />

      <div className="relative">
        <main className="container max-w-7xl mx-auto px-4 pt-4 md:pt-0 mt-4 md:mt-0 pb-10 md:pb-16 relative z-10">
          {/* Page Header */}
          <div className="pb-2 md:pb-2 mt-0 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white mt-0 pt-0">
                  Leaderboard
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-[#94A3B8] max-w-2xl mt-1">
                  Compete with the best in the NEFTIT ecosystem and earn exclusive rewards
                </p>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="py-4 md:py-6"
          >
            {/* Quick Stats */}
            {/*<div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-6 md:mb-8">
              {[
                { 
                  icon: <Users className="h-4 sm:w-5 sm:h-5 text-[#38B2AC]" />,
                  label: "Total Players",
                  value: "1,458",
                },
                { 
                  icon: <Trophy className="h-4 sm:w-5 sm:h-5 text-[#38B2AC]" />,
                  label: "Rewards Given",
                  value: "24,628 NEFT",
                },
                { 
                  icon: <Clock className="h-4 sm:w-5 sm:h-5 text-[#38B2AC]" />,
                  label: "Next Reset",
                  value: "23h 45m",
                },
                { 
                  icon: <Shield className="h-4 sm:w-5 sm:h-5 text-[#38B2AC]" />,
                  label: "Your Position",
                  value: `#${currentUser.rank}`,
                  info: (
                    <div className="text-xs font-medium px-2 py-1 rounded-full bg-[#38B2AC]/20 text-[#38B2AC] flex items-center gap-1">
                      <ChevronUp className="h-3 w-3" />
                      5
                    </div>
                  )
                },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + (index * 0.1) }}
                  className="p-2 sm:p-3 md:p-4 rounded-lg bg-[#171923] border border-[#2D3748]/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-[#1A202C] flex-shrink-0">
                      {stat.icon}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-[#A0AEC0]">{stat.label}</div>
                      <div className="text-sm sm:text-base md:text-lg font-bold text-white">{stat.value}</div>
                    </div>
                  </div>
                  {stat.info && (
                    <div>{stat.info}</div>
                  )}
                </motion.div>
              ))}
            </div>*/}

            {/* Filters and Tabs */}
            {/* Removed the box after the leaderboard title as requested */}

            {/* Leaderboard tabs */}
            <Tabs
              defaultValue="neft"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 bg-[#1b1930] border border-[#2D3748]/50 p-1 rounded-lg">
                <TabsTrigger
                  value="neft"
                  className="text-xs sm:text-sm font-medium rounded-lg py-1.5 data-[state=active]:bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] data-[state=active]:text-white"
                >
                  <span className="hidden sm:inline">NEFT Token Holders</span>
                  <span className="sm:hidden">NEFT</span>
                </TabsTrigger>
                <TabsTrigger
                  value="nft"
                  className="text-xs sm:text-sm font-medium rounded-lg py-1.5 data-[state=active]:bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] data-[state=active]:text-white"
                >
                  <span className="hidden sm:inline">NFT Holders</span>
                  <span className="sm:hidden">NFTs</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="neft" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12 bg-[#121021] rounded-lg border border-[#2D3748]/50">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#38B2AC] mr-2" />
                      <span className="text-white">Loading NEFT rankings...</span>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center py-12 bg-[#121021] rounded-lg border border-[#2D3748]/50">
                      <span className="text-red-400">{error}</span>
                    </div>
                  ) : (
                    <LeaderboardTable
                      users={neftLeaderboard}
                      displayType="neft"
                      currentUser={currentUser || (isAuthenticated ? {
                        id: currentUserWallet || 'unknown',
                        username: 'You',
                        profileImage: '',
                        neftBalance: 0,
                        nftCount: 0,
                        rank: 0,
                        previousRank: 0
                      } : null)}
                      className="bg-[#121021] border-[#2D3748]/50"
                    />
                  )}
                </motion.div>
              </TabsContent>

              <TabsContent value="nft" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12 bg-[#121021] rounded-lg border border-[#2D3748]/50">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#38B2AC] mr-2" />
                      <span className="text-white">Loading NFT rankings...</span>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center py-12 bg-[#121021] rounded-lg border border-[#2D3748]/50">
                      <span className="text-red-400">{error}</span>
                    </div>
                  ) : (
                    <LeaderboardTable
                      users={nftLeaderboard}
                      displayType="nft"
                      currentUser={currentUser || (isAuthenticated ? {
                        id: currentUserWallet || 'unknown',
                        username: 'You',
                        profileImage: '',
                        neftBalance: 0,
                        nftCount: 0,
                        rank: 0,
                        previousRank: 0
                      } : null)}
                      className="bg-[#121021] border-[#2D3748]/50"
                    />
                  )}
                </motion.div>
              </TabsContent>
            </Tabs>

            {/* Disclaimer */}
            <div className="mt-6 sm:mt-8 px-3 sm:px-4 py-3 sm:py-4 bg-[#1b1930] rounded-lg border border-[#2D3748]/50 text-xs sm:text-sm text-[#94A3B8]">
              <p className="text-center ">
                Leaderboard rankings are updated daily. Complete tasks, stake NFTs, and participate in the ecosystem to climb the ranks.
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Leaderboard;
