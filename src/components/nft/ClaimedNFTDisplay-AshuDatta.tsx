import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import nftClaimDisplayService from '../../services/NFTClaimDisplayService';

interface ClaimedNFT {
  id: string;
  nft_id: string;
  wallet_address: string;
  transaction_hash: string;
  token_id: string;
  contract_address: string;
  claimed_blockchain: string;
  claimed_at: string;
  metadata_uri?: string;
  metamask_compatible?: boolean;
}

interface ClaimedNFTDisplayProps {
  walletAddress?: string;
  refreshTrigger?: number;
}

const ClaimedNFTDisplay: React.FC<ClaimedNFTDisplayProps> = ({ 
  walletAddress, 
  refreshTrigger = 0 
}) => {
  const [claimedNFTs, setClaimedNFTs] = useState<ClaimedNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClaimedNFTs = async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 Loading claimed NFTs for wallet:', walletAddress);
      const claims = await nftClaimDisplayService.getClaimedNFTs(walletAddress);
      setClaimedNFTs(claims);
      console.log('✅ Loaded claimed NFTs:', claims.length);
    } catch (error: any) {
      console.error('❌ Failed to load claimed NFTs:', error);
      setError(error.message || 'Failed to load claimed NFTs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClaimedNFTs();
  }, [walletAddress, refreshTrigger]);

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading claimed NFTs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 mb-4">❌ {error}</div>
        <Button
          onClick={loadClaimedNFTs}
          variant="outline"
          className="border-[#5d43ef]/20 text-white hover:bg-[#5d43ef]/10"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (claimedNFTs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12"
      >
        <div className="w-24 h-24 bg-[#5d43ef]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-12 h-12 text-[#5d43ef]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-white mb-2">
          No Claimed NFTs Yet
        </h3>
        <p className="text-gray-400">
          Your claimed NFTs will appear here once you start collecting!
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Claimed NFTs ({claimedNFTs.length})
          </h3>
          <p className="text-gray-400 text-sm">
            Your on-chain NFT collection
          </p>
        </div>
        <Button
          onClick={loadClaimedNFTs}
          variant="outline"
          size="sm"
          className="border-[#5d43ef]/20 text-white hover:bg-[#5d43ef]/10"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {claimedNFTs.map((claim, index) => (
          <motion.div
            key={claim.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#0B0A14] border border-[#5d43ef]/20 rounded-xl p-4 hover:border-[#5d43ef]/40 transition-colors"
          >
            <div className="space-y-3">
              {/* NFT ID and Status */}
              <div className="flex items-center justify-between">
                <div className="text-white font-medium truncate">
                  NFT #{claim.nft_id}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-xs">Claimed</span>
                </div>
              </div>

              {/* Token ID */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Token ID:</span>
                <span className="text-white font-mono">{claim.token_id}</span>
              </div>

              {/* Contract Address */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Contract:</span>
                <span className="text-white font-mono">
                  {formatAddress(claim.contract_address)}
                </span>
              </div>

              {/* Blockchain */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Chain:</span>
                <span className="text-white capitalize">{claim.claimed_blockchain}</span>
              </div>

              {/* Claimed Date */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Claimed:</span>
                <span className="text-white text-xs">
                  {formatDate(claim.claimed_at)}
                </span>
              </div>

              {/* MetaMask Compatibility Badge */}
              {claim.metamask_compatible && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-blue-400">MetaMask Compatible</span>
                </div>
              )}

              {/* Transaction Link */}
              <div className="pt-2 border-t border-[#5d43ef]/10">
                <a
                  href={`https://amoy.polygonscan.com/tx/${claim.transaction_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[#5d43ef] hover:text-[#7B61FF] text-sm transition-colors"
                >
                  <span>View Transaction</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ClaimedNFTDisplay;
