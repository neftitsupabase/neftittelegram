import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Flame, Target, Trophy, Users, Zap, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
  colorClass: string;
  isPositive?: boolean;
}

interface TimeFilter {
  label: string;
  value: string;
}

const timeFilters: TimeFilter[] = [
  { label: 'All Time', value: 'all' },
  { label: 'This Month', value: 'month' },
  { label: 'This Week', value: 'week' },
  { label: 'Today', value: 'today' }
];

const StatCard = ({ title, value, change, icon: Icon, colorClass, isPositive }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-background-card p-6",
        "border border-border hover:border-border-hover",
        "transition-all duration-300 group"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            colorClass.replace('text-', 'bg-') + '/10',
            "group-hover:scale-110 transition-transform duration-300"
          )}>
            <Icon className={cn(
              "w-6 h-6",
              colorClass
            )} />
          </div>
          
          {change && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium font-manrope",
                isPositive ? "bg-[#36F9F6]/10 text-[#36F9F6]" : "bg-[#FF2E63]/10 text-[#FF2E63]",
                "flex items-center gap-1"
              )}
            >
              {isPositive ? '+' : ''}{change}
            </motion.div>
          )}
        </div>
        
        <h3 className="text-sm text-text-secondary font-dm-sans mb-1 group-hover:text-text-primary transition-colors">
          {title}
        </h3>
        
        <p className="text-2xl font-bold text-text-primary font-space-grotesk group-hover:text-primary transition-colors">
          {value}
        </p>
      </div>
    </motion.div>
  );
};

const Stats = () => {
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const stats: StatCardProps[] = [
    {
      title: 'Total XP Earned',
      value: '12,450',
      change: '15%',
      icon: Trophy,
      colorClass: 'text-[#36F9F6]',
      isPositive: true
    },
    {
      title: 'Current Level',
      value: '24',
      change: '2 levels',
      icon: Target,
      colorClass: 'text-[#9D9BF3]',
      isPositive: true
    },
    {
      title: 'Quests Completed',
      value: '48',
      change: '8',
      icon: Flame,
      colorClass: 'text-[#FF2E63]',
      isPositive: true
    },
    {
      title: 'NFTs Collected',
      value: '12',
      change: '3',
      icon: Award,
      colorClass: 'text-[#FFD700]',
      isPositive: true
    },
    {
      title: 'Active Streak',
      value: '7 days',
      change: '2 days',
      icon: Zap,
      colorClass: 'text-[#36F9F6]',
      isPositive: true
    },
    {
      title: 'Global Rank',
      value: '#245',
      change: '12',
      icon: Users,
      colorClass: 'text-[#9D9BF3]',
      isPositive: false
    }
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-text-primary font-space-grotesk mb-1">
            Statistics
          </h2>
          <p className="text-sm text-text-secondary font-dm-sans">
            Your activity overview
          </p>
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
            {timeFilters.find(f => f.value === timeFilter)?.label}
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
                className="absolute right-0 mt-2 w-40 py-1 rounded-lg border border-border bg-background-card shadow-lg z-10"
              >
                {timeFilters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => {
                      setTimeFilter(filter.value);
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2 text-sm font-medium text-left transition-colors font-manrope",
                      filter.value === timeFilter
                        ? "bg-primary/10 text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Stats; 