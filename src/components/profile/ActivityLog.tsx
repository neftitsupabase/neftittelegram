import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Calendar, Clock, Filter, Flame, Search, Trophy, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: number;
  type: 'quest' | 'nft' | 'reward' | 'level';
  title: string;
  description: string;
  timestamp: string;
}

const activityTypeConfig = {
  quest: {
    icon: Flame,
    color: 'text-[#FF2E63]',
    label: 'Quest'
  },
  nft: {
    icon: Award,
    color: 'text-[#9D9BF3]',
    label: 'NFT'
  },
  reward: {
    icon: Wallet,
    color: 'text-[#36F9F6]',
    label: 'Reward'
  },
  level: {
    icon: Trophy,
    color: 'text-[#FFD700]',
    label: 'Level'
  }
};

const activities: Activity[] = [
  {
    id: 1,
    type: 'level',
    title: 'Reached Level 10',
    description: 'Congratulations! You\'ve reached a new milestone.',
    timestamp: '2024-03-18T14:30:00Z'
  },
  {
    id: 2,
    type: 'nft',
    title: 'Minted Genesis NFT',
    description: 'Successfully minted your first NFT on the platform.',
    timestamp: '2024-03-18T12:15:00Z'
  },
  {
    id: 3,
    type: 'quest',
    title: 'Daily Login Streak',
    description: 'Maintained a 7-day login streak.',
    timestamp: '2024-03-18T10:00:00Z'
  },
  {
    id: 4,
    type: 'reward',
    title: 'Community Contribution',
    description: 'Received reward for active participation in community.',
    timestamp: '2024-03-18T09:45:00Z'
  }
];

const ActivityCard = ({ activity }: { activity: Activity }) => {
  const type = activityTypeConfig[activity.type];
  const Icon = type.icon;
  const timestamp = new Date(activity.timestamp);
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} sec ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    }
    
    return date.toLocaleDateString();
  };
  
  const timeAgo = getTimeAgo(timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-background-card p-6",
        "border border-border hover:border-border-hover transition-all group"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
      
      <div className="relative">
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            type.color.replace('text-', 'bg-') + '/10'
          )}>
            <Icon className={cn("w-6 h-6", type.color)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary font-space-grotesk group-hover:text-primary transition-colors">
                  {activity.title}
                </h3>
                <p className="text-sm text-text-secondary font-dm-sans mt-1">
                  {activity.description}
                </p>
              </div>
              
              <div className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap",
                `${type.color} ${type.color.replace('text-', 'bg-')}/10 border-${type.color}/20`
              )}>
                {type.label}
              </div>
            </div>


            <div className="flex items-center gap-2 mt-4 text-xs text-text-secondary font-manrope">
              <Clock className="w-3.5 h-3.5" />
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ActivityLog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activity.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedType || activity.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold text-text-primary font-space-grotesk mb-1">
            Activity Log
          </h2>
          <p className="text-sm text-text-secondary font-dm-sans">
            Your recent activities and achievements
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-64 px-4 py-2 rounded-lg text-sm font-medium transition-colors font-manrope",
                "bg-background-card border border-border focus:border-primary",
                "text-text-primary placeholder:text-text-secondary",
                "focus:outline-none focus:ring-1 focus:ring-primary"
              )}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          </div>

          <div className="flex items-center gap-2">
            {Object.entries(activityTypeConfig).map(([type, config]) => (
              <button
                key={type}
                onClick={() => setSelectedType(selectedType === type ? null : type)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors font-manrope",
                  selectedType === type
                    ? `${config.color} ${config.color.replace('text-', 'bg-')}/10`
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        {filteredActivities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <ActivityCard activity={activity} />
          </motion.div>
        ))}
      </div>

      {filteredActivities.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-10 text-center bg-background-card backdrop-blur-xl border border-border"
        >
          <Clock className="h-16 w-16 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-primary font-space-grotesk mb-2">
            No Activities Found
          </h3>
          <p className="text-text-secondary font-dm-sans">
            Try adjusting your search or filters
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default ActivityLog; 