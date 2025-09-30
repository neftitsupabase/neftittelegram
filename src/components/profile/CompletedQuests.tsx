import React from 'react';
import { motion } from 'framer-motion';
import { Award, Calendar, ChevronRight, Trophy } from 'lucide-react';

const questData = [
  {
    id: 1,
    title: 'Early Bird',
    description: 'Join the platform within the first week of launch',
    completedDate: '2024-03-15',
    rewards: {
      xp: 500,
      coins: 100
    }
  },
  {
    id: 2,
    title: 'Social Butterfly',
    description: 'Connect your social media accounts',
    completedDate: '2024-03-16',
    rewards: {
      xp: 300,
      coins: 50
    }
  },
  {
    id: 3,
    title: 'First NFT',
    description: 'Mint your first NFT on the platform',
    completedDate: '2024-03-17',
    rewards: {
      xp: 1000,
      coins: 200,
      nft: 'Cosmic Explorer #001'
    }
  }
];

const QuestCard = ({ quest }: { quest: typeof questData[0] }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-background-card border border-border hover:border-border-hover transition-all group backdrop-blur-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
      
      <div className="p-6 relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-text-primary font-space-grotesk group-hover:text-primary transition-colors mb-2">
              {quest.title}
            </h3>
            <p className="text-sm text-text-secondary font-dm-sans mb-4">
              {quest.description}
            </p>
            
            <div className="flex items-center text-sm text-text-secondary font-manrope">
              <Calendar className="w-4 h-4 mr-2" />
              <span>Completed on {new Date(quest.completedDate).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="ml-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-[#36F9F6]/10 flex items-center justify-center mr-2">
                  <span className="text-xs font-bold text-[#36F9F6]">XP</span>
                </div>
                <span className="text-sm font-medium text-text-primary font-manrope">
                  +{quest.rewards.xp} XP
                </span>
              </div>
              
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-[#FF2E63]/10 flex items-center justify-center mr-2">
                  <span className="text-xs font-bold text-[#FF2E63]">$</span>
                </div>
                <span className="text-sm font-medium text-text-primary font-manrope">
                  +{quest.rewards.coins} Coins
                </span>
              </div>
              
              {quest.rewards.nft && (
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-[#9D9BF3]/10 flex items-center justify-center mr-2">
                    <Award className="w-3 h-3 text-[#9D9BF3]" />
                  </div>
                  <span className="text-sm font-medium text-text-primary font-manrope">
                    {quest.rewards.nft}
                  </span>
                </div>
              )}
            </div>
            
            <button className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CompletedQuests = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-text-primary font-space-grotesk">
          Completed Quests
        </h2>
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors font-manrope">
          View All
        </button>
      </div>
      
      <div className="space-y-4">
        {questData.map((quest, index) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <QuestCard quest={quest} />
          </motion.div>
        ))}
      </div>
      
      {questData.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-10 text-center bg-background-card backdrop-blur-xl border border-border"
        >
          <Trophy className="h-16 w-16 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-primary font-space-grotesk mb-2">
            No Completed Quests
          </h3>
          <p className="text-text-secondary font-dm-sans">
            Start completing quests to earn rewards!
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default CompletedQuests;
