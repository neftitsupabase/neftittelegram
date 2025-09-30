import React, { useState } from 'react';
import { MainNav } from "@/components/layout/MainNav";
import { 
  Sparkles, Lock, Trophy, Medal, Crown, Star,
  Flame, Gift, Wallet, Zap, Users, PlusCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const QuestRewardsNew = () => {
  const [activeTab, setActiveTab] = useState("all");

  // Quest data structured to match the screenshot
  const questData = {
    questTiers: [
      {
        id: 1,
        title: "Quest Novice",
        description: "Complete 1 Quest",
        icon: <Trophy className="h-16 w-16 text-teal-400" />,
        status: "completed",
        tier: 1,
        progress: 1,
        target: 1,
        rewards: {
          neft: 5,
          xp: 100
        }
      },
      {
        id: 2,
        title: "Quest Explorer",
        description: "Complete 10 Quests",
        icon: <Medal className="h-16 w-16 text-blue-400" />,
        status: "in_progress",
        tier: 2,
        progress: 7,
        target: 10,
        rewards: {
          neft: 10,
          xp: 250
        }
      },
      {
        id: 3,
        title: "Quest Master",
        description: "Complete 50 Quests",
        icon: <Crown className="h-16 w-16 text-purple-400" />,
        status: "locked",
        tier: 3,
        progress: 0,
        target: 50,
        rewards: {
          neft: 20,
          xp: 500
        }
      },
      {
        id: 4,
        title: "Quest Legend",
        description: "Complete 100 Quests",
        icon: <Star className="h-16 w-16 text-yellow-400" />,
        status: "locked",
        tier: 4,
        progress: 0,
        target: 100,
        rewards: {
          neft: 50,
          xp: 1000
        }
      }
    ],
    commonNftHolders: [
      {
        id: 1,
        title: "Common NFT Holder 1",
        description: "Hold 1 Common NFT",
        icon: <Gift className="h-16 w-16 text-teal-400" />,
        status: "completed",
        tier: 1,
        progress: 1,
        target: 1,
        rewards: {
          neft: 5,
          xp: 100
        }
      },
      {
        id: 2,
        title: "Common NFT Holder 2",
        description: "Hold 10 Common NFTs",
        icon: <Gift className="h-16 w-16 text-blue-400" />,
        status: "in_progress",
        tier: 2,
        progress: 7,
        target: 10,
        rewards: {
          neft: 10,
          xp: 250
        }
      },
      {
        id: 3,
        title: "Common NFT Holder 3",
        description: "Hold 50 Common NFTs",
        icon: <Gift className="h-16 w-16 text-purple-400" />,
        status: "in_progress",
        tier: 3,
        progress: 16,
        target: 50,
        rewards: {
          neft: 20,
          xp: 500
        }
      },
      {
        id: 4,
        title: "Common NFT Holder 4",
        description: "Hold 100 Common NFTs",
        icon: <Gift className="h-16 w-16 text-yellow-400" />,
        status: "in_progress",
        tier: 4,
        progress: 24,
        target: 100,
        rewards: {
          neft: 50,
          xp: 1000
        }
      }
    ],
    rareNftHolders: [
      {
        id: 1,
        title: "Rare NFT Holder 1",
        description: "Hold 1 Rare NFT",
        icon: <Wallet className="h-16 w-16 text-pink-400" />,
        status: "in_progress",
        tier: 1,
        progress: 0,
        target: 1,
        rewards: {
          neft: 5,
          xp: 100
        }
      }
    ],
    nftHolders: [
      {
        id: 1,
        title: "NFT Holder 1",
        description: "Hold 1 NFT",
        icon: <Gift className="h-16 w-16 text-teal-400" />,
        status: "in_progress",
        tier: 1,
        progress: 0,
        target: 1,
        rewards: {
          neft: 5,
          xp: 100
        }
      },
      {
        id: 2,
        title: "NFT Holder 2",
        description: "Hold 5 NFTs",
        icon: <Gift className="h-16 w-16 text-blue-400" />,
        status: "locked",
        tier: 2,
        progress: 0,
        target: 5,
        rewards: {
          neft: 10,
          xp: 250
        }
      },
      {
        id: 3,
        title: "NFT Holder 3",
        description: "Hold 10 NFTs",
        icon: <Gift className="h-16 w-16 text-purple-400" />,
        status: "locked",
        tier: 3,
        progress: 0,
        target: 10,
        rewards: {
          neft: 20,
          xp: 500
        }
      }
    ]
  };

  // Card component for quest items
  const QuestCard = ({ quest }) => {
    const isLocked = quest.status === "locked";
    const isCompleted = quest.status === "completed";
    const isInProgress = quest.status === "in_progress";
    
    return (
      <div className={cn(
        "relative border rounded-xl overflow-hidden h-[280px]",
        isLocked ? "border-gray-800 bg-black/40" : 
        isCompleted ? "border-teal-500/30 bg-black/40" : 
        "border-orange-500/30 bg-black/40"
      )}>
        {/* Top badge section */}
        <div className="absolute left-3 top-3 bg-black/40 px-2 py-1 rounded-lg text-xs font-medium border border-white/10 text-white/90 z-10">
          Tier {quest.tier}
        </div>
        
        <div className={cn(
          "absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium border z-10",
          isCompleted ? "bg-teal-500/20 text-teal-400 border-teal-500/30" :
          isInProgress ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
          "bg-gray-700/50 text-gray-400 border-gray-600/30"
        )}>
          {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Locked"}
        </div>

        {/* Image placeholder with icon */}
        <div className="w-full h-[60%] bg-black/50 flex items-center justify-center">
          {isLocked ? (
            <Lock className="h-16 w-16 text-gray-600" />
          ) : (
            quest.icon
          )}
        </div>

        {/* Content area */}
        <div className="p-4 h-[40%] flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{quest.title}</h3>
            <p className="text-sm text-gray-400">{quest.description}</p>
          </div>
          
          {isInProgress && (
            <div className="my-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Progress</span>
                <span className="text-white font-medium">{quest.progress}/{quest.target}</span>
              </div>
              <Progress
                value={(quest.progress / quest.target) * 100}
                className="h-1.5 [&>div]:bg-[#38B2AC] bg-gray-800 mt-1"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#38B2AC]/10 flex items-center justify-center">
                <span className="text-xs font-bold text-[#38B2AC]">$</span>
              </div>
              <span className="text-xs font-medium text-white">{quest.rewards.neft} NEFT</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-purple-400" />
              </div>
              <span className="text-xs font-medium text-white">+{quest.rewards.xp} XP</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestSection = (quests, title) => {
    if (!quests || quests.length === 0) return null;
    
    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-white">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {quests.map(quest => (
            <QuestCard key={quest.id} quest={quest} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0C1B] text-white">
      <MainNav />

      <main className="container mx-auto px-4 pt-8 pb-24">
        {/* Tabs */}
        <div className="mb-6">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="bg-[#171923]/50 border border-gray-800 rounded-md p-1 gap-1 overflow-x-auto flex">
              <TabsTrigger 
                value="all" 
                className="data-[state=active]:bg-[#38B2AC] data-[state=active]:text-white text-sm rounded-md py-2 px-3"
              >
                All
              </TabsTrigger>
              <TabsTrigger 
                value="quests" 
                className="data-[state=active]:bg-[#38B2AC] data-[state=active]:text-white text-sm rounded-md py-2 px-3 flex items-center gap-1"
              >
                <Trophy className="h-4 w-4" /> Quests
              </TabsTrigger>
              <TabsTrigger 
                value="nft-holding" 
                className="data-[state=active]:bg-[#38B2AC] data-[state=active]:text-white text-sm rounded-md py-2 px-3 flex items-center gap-1"
              >
                <Gift className="h-4 w-4" /> NFT Holding
              </TabsTrigger>
              <TabsTrigger 
                value="burn" 
                className="data-[state=active]:bg-[#38B2AC] data-[state=active]:text-white text-sm rounded-md py-2 px-3 flex items-center gap-1"
              >
                <Flame className="h-4 w-4" /> Burn
              </TabsTrigger>
              <TabsTrigger 
                value="referrals" 
                className="data-[state=active]:bg-[#38B2AC] data-[state=active]:text-white text-sm rounded-md py-2 px-3 flex items-center gap-1"
              >
                <Users className="h-4 w-4" /> Referrals
              </TabsTrigger>
              <TabsTrigger 
                value="nft-staking" 
                className="data-[state=active]:bg-[#38B2AC] data-[state=active]:text-white text-sm rounded-md py-2 px-3 flex items-center gap-1"
              >
                <Zap className="h-4 w-4" /> NFT Staking
              </TabsTrigger>
              <TabsTrigger 
                value="create-inv" 
                className="data-[state=active]:bg-[#38B2AC] data-[state=active]:text-white text-sm rounded-md py-2 px-3 flex items-center gap-1"
              >
                <PlusCircle className="h-4 w-4" /> Create Inv
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Render quest sections */}
        <div className="space-y-8">
          {renderQuestSection(questData.questTiers, "Quest Tiers")}
          {renderQuestSection(questData.commonNftHolders, "Common NFT Holders")}
          {renderQuestSection(questData.rareNftHolders, "Rare NFT Holders")}
          {renderQuestSection(questData.nftHolders, "NFT Holders")}
        </div>
      </main>
    </div>
  );
};

export default QuestRewardsNew; 