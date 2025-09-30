import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MainNav } from '@/components/layout/MainNav';
import { Flame, Trophy, Coins, ArrowUpRight, Clock, Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from '@/components/Button';
import userBalanceService from '@/services/UserBalanceService';
import { useAuthState } from '@/hooks/useAuthState';
import { UserBalance } from '@/types/balance';

interface ActivityItem {
  id: string;
  type: 'quest' | 'nft' | 'reward';
  title: string;
  description: string;
  timestamp: string;
  rewards?: {
    xp?: number;
    neft?: number;
  };
  status?: 'completed' | 'ongoing' | 'expired';
  image?: string;
}

const ActivityLog = () => {
  const [selectedFilter, setSelectedFilter] = React.useState<'all' | 'quests' | 'nfts' | 'rewards'>('all');
  const [timeRange, setTimeRange] = React.useState<'all' | 'today' | 'week' | 'month'>('all');
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const { walletAddress, isAuthenticated } = useAuthState();

  useEffect(() => {
    const fetchBalance = async () => {
      if (isAuthenticated && walletAddress) {
        try {
          const balance = await userBalanceService.getUserBalance(walletAddress);
          setUserBalance(balance);
        } catch (error) {
          console.error("Error fetching user balance:", error);
        }
      }
    };

    fetchBalance();
  }, [isAuthenticated, walletAddress]);

  const stats = [
    {
      label: 'Total NEFT Earned',
      value: userBalance?.total_neft_claimed?.toFixed(0) || '0',
      icon: Coins,
      color: 'from-primary/20 to-transparent'
    },
    { 
      label: 'Total XP Earned', 
      value: userBalance?.total_xp_earned?.toString() || '0', 
      icon: Trophy,
      color: 'from-accent-purple/20 to-transparent'
    }
  ];

  const activities: ActivityItem[] = [
    {
      id: '1',
      type: 'quest',
      title: 'Daily Login Streak',
      description: 'Maintained your login streak for 7 days',
      timestamp: '2 hours ago',
      rewards: { xp: 150, neft: 50 },
      status: 'completed'
    },
    {
      id: '2',
      type: 'nft',
      title: 'Cyber Guardian NFT',
      description: 'Collected a rare NFT from the Cyber Series',
      timestamp: '5 hours ago',
      image: '/nft-preview.png'
    },
    {
      id: '3',
      type: 'reward',
      title: 'Level Up Reward',
      description: 'Reached Level 10 in the platform',
      timestamp: '1 day ago',
      rewards: { xp: 500, neft: 200 }
    },
    // Add more activities as needed
  ];

  const filteredActivities = activities.filter(activity => {
    if (selectedFilter === 'all') return true;
    const filterMap = {
      'quests': 'quest',
      'nfts': 'nft', 
      'rewards': 'reward'
    };
    return activity.type === filterMap[selectedFilter];
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_80%)] pointer-events-none opacity-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_500px_at_50%_200px,#1C1D2C,transparent)] pointer-events-none" />

      <MainNav />

      <main className="container mx-auto px-4 pt-0 pb-16">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-left mb-4"
          >
            <h1 className="text-2xl sm:text-3xl font-bold font-sora tracking-tight text-white mt-0 pt-0">
              Activity Log
            </h1>
            <p className="text-sm sm:text-base font-sora text-[#94A3B8] max-w-2xl mt-1 mb-8">
              Track your journey, achievements, and rewards in the NEFTIT ecosystem
            </p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl bg-background-card p-6',
                  'transition-all duration-300 group'
                )}
              >
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-b opacity-20',
                  stat.color
                )} />
                <stat.icon className="w-8 h-8 text-text-secondary mb-4 group-hover:text-white transition-colors" />
                <p className="text-2xl font-bold text-text-primary font-poppins mb-2">{stat.value}</p>
                <p className="text-sm text-text-secondary font-dm-sans">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3">
              <Button
                variant={selectedFilter === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedFilter('all')}
              >
                All Activities
              </Button>
              <Button
                variant={selectedFilter === 'quests' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedFilter('quests')}
                leftIcon={<Flame className="w-4 h-4" />}
              >
                Quests
              </Button>
              <Button
                variant={selectedFilter === 'nfts' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedFilter('nfts')}
                leftIcon={<Coins className="w-4 h-4" />}
              >
                NFTs
              </Button>
              <Button
                variant={selectedFilter === 'rewards' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedFilter('rewards')}
                leftIcon={<Trophy className="w-4 h-4" />}
              >
                Rewards
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              rightIcon={<ChevronDown className="w-4 h-4" />}
            >
              Filter by Time
            </Button>
          </div>

          {/* Activity Timeline */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {filteredActivities.map((activity) => (
              <motion.div
                key={activity.id}
                variants={itemVariants}
                className={cn(
                  'relative group rounded-2xl bg-background-card p-6',
                  'transition-all duration-300'
                )}
              >
                <div className="flex items-start gap-6">
                  {activity.image ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                      <img
                        src={activity.image}
                        alt={activity.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={cn(
                      'w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0',
                      activity.type === 'quest' ? 'bg-secondary/10' : '',
                      activity.type === 'nft' ? 'bg-accent-blue/10' : '',
                      activity.type === 'reward' ? 'bg-accent-purple/10' : ''
                    )}>
                      {activity.type === 'quest' && <Flame className="w-8 h-8 text-secondary" />}
                      {activity.type === 'nft' && <Coins className="w-8 h-8 text-accent-blue" />}
                      {activity.type === 'reward' && <Trophy className="w-8 h-8 text-accent-purple" />}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium text-text-primary font-space-grotesk">
                          {activity.title}
                        </h3>
                        <p className="text-sm text-text-secondary font-dm-sans mt-1">
                          {activity.description}
                        </p>
                      </div>
                      <time className="text-sm text-text-tertiary font-dm-sans whitespace-nowrap">
                        {activity.timestamp}
                      </time>
                    </div>

                    {activity.rewards && (
                      <div className="flex items-center gap-4 mt-4">
                        {activity.rewards.xp && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-purple/10">
                            <Trophy className="w-4 h-4 text-accent-purple" />
                            <span className="text-sm font-medium text-text-primary font-dm-sans">
                              +{activity.rewards.xp} XP
                            </span>
                          </div>
                        )}
                        {activity.rewards.neft && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10">
                            <Coins className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-text-primary font-dm-sans">
                              +{activity.rewards.neft} NEFT
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button className="p-2 rounded-full hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100">
                    <ArrowUpRight className="w-5 h-5 text-text-secondary" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default ActivityLog; 