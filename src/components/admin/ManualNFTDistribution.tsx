import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Eye, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DistributionResult {
  success: boolean;
  message: string;
  distributed_nfts: number;
  distributions: Array<{
    wallet_address: string;
    rarity: string;
    image: string;
    nft_id: string;
    project_id: string;
  }>;
  project_info: {
    id: string;
    title: string;
    collection_name: string;
  };
  distribution_stats: {
    legendary: number;
    rare: number;
    common: number;
    total: number;
  };
}

const ManualNFTDistribution: React.FC = () => {
  const [projectId, setProjectId] = useState('b5f6da7b-53b8-4bf7-9464-2def2bab609a');
  const [userWallet, setUserWallet] = useState('0x5BEdd9F1415B8Eb1F669AAc68B0Fd9106b265071');
  const [rarity, setRarity] = useState('common');



  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary font-space-grotesk mb-2">
          🎯 Manual NFT Distribution
        </h1>
        <p className="text-text-secondary font-dm-sans">
          Distribute specific NFT rarities to individual users
        </p>
      </div>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-background-card rounded-2xl p-6 border border-border"
      >
        <h2 className="text-xl font-bold text-text-primary font-space-grotesk mb-4">
          Distribution Parameters
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Project ID
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={cn(
                "w-full px-4 py-2 rounded-lg border transition-colors font-manrope",
                "bg-background border-border text-text-primary",
                "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              )}
              placeholder="Enter project ID"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              User Wallet Address
            </label>
            <input
              type="text"
              value={userWallet}
              onChange={(e) => setUserWallet(e.target.value)}
              className={cn(
                "w-full px-4 py-2 rounded-lg border transition-colors font-manrope",
                "bg-background border-border text-text-primary",
                "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              )}
              placeholder="0x..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              NFT Rarity
            </label>
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              className={cn(
                "w-full px-4 py-2 rounded-lg border transition-colors font-manrope",
                "bg-background border-border text-text-primary",
                "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              )}
            >
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Service Unavailable</span>
            </div>
            <p className="text-yellow-300 mt-2">Manual NFT distribution service is not currently available.</p>
          </div>
        </div>
      </motion.div>

    </div>
  );
};

export default ManualNFTDistribution;
