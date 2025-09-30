import React, { useState, useEffect } from 'react';
import { ExternalLink, Clock, Hash, Wallet, Award, RefreshCw } from 'lucide-react';
import nftClaimDisplayService, { type ClaimedNFT, type NFTClaimStats } from '../../services/NFTClaimDisplayService';

interface ClaimedNFTDisplayProps {
  walletAddress: string;
  refreshTrigger?: number; // Used to trigger refresh from parent
}

const ClaimedNFTDisplay: React.FC<ClaimedNFTDisplayProps> = ({ 
  walletAddress, 
  refreshTrigger = 0 
}) => {
  const [claimedNFTs, setClaimedNFTs] = useState<ClaimedNFT[]>([]);
  const [stats, setStats] = useState<NFTClaimStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClaimedNFTs = async () => {
    if (!walletAddress) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔄 Loading claimed NFTs for:', walletAddress);

      const [nfts, claimStats] = await Promise.all([
        nftClaimDisplayService.getClaimedNFTs(walletAddress),
        nftClaimDisplayService.getClaimStats(walletAddress)
      ]);

      setClaimedNFTs(nfts);
      setStats(claimStats);

      console.log(`✅ Loaded ${nfts.length} claimed NFTs`);

    } catch (err: any) {
      console.error('❌ Failed to load claimed NFTs:', err);
      setError(err.message || 'Failed to load claimed NFTs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClaimedNFTs();
  }, [walletAddress, refreshTrigger]);

  const handleRefresh = () => {
    loadClaimedNFTs();
  };

  const openExplorer = (transactionHash: string, blockchain: string) => {
    const url = nftClaimDisplayService.getExplorerUrl(transactionHash, blockchain);
    if (url !== '#') {
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className="text-gray-600">Loading claimed NFTs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">❌ Error loading claimed NFTs</div>
          <div className="text-gray-600 text-sm mb-4">{error}</div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header with Stats */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Claimed NFTs</h2>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total_claims}</div>
              <div className="text-sm text-gray-600">Total Claims</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.ethereum_claims}</div>
              <div className="text-sm text-gray-600">Polygon</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.solana_claims}</div>
              <div className="text-sm text-gray-600">Solana</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.sui_claims}</div>
              <div className="text-sm text-gray-600">Sui</div>
            </div>
          </div>
        )}
      </div>

      {/* NFT List */}
      <div className="p-6">
        {claimedNFTs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">📦</div>
            <div className="text-gray-600">No NFTs claimed yet</div>
            <div className="text-sm text-gray-500 mt-2">
              Claim your first NFT to see it here!
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {claimedNFTs.map((nft) => {
              const blockchainInfo = nftClaimDisplayService.getBlockchainInfo(nft.claimed_blockchain);
              const formattedDate = nftClaimDisplayService.formatClaimDate(nft.claimed_at);

              return (
                <div
                  key={nft.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800">
                          {nft.nft_id}
                        </h3>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          ✅ Claimed
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <span className={`flex items-center gap-1 ${blockchainInfo.color}`}>
                          <span>{blockchainInfo.icon}</span>
                          {blockchainInfo.name}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>

                    {nft.token_id && (
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Token ID</div>
                        <div className="font-mono text-sm font-semibold">#{nft.token_id}</div>
                      </div>
                    )}
                  </div>

                  {/* Transaction Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        Transaction:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {nft.transaction_hash.slice(0, 10)}...{nft.transaction_hash.slice(-8)}
                        </span>
                        <button
                          onClick={() => openExplorer(nft.transaction_hash, nft.claimed_blockchain)}
                          className="text-blue-500 hover:text-blue-700 transition-colors"
                          title="View on Explorer"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {nft.contract_address && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Wallet className="w-3 h-3" />
                          Contract:
                        </span>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {nft.contract_address.slice(0, 10)}...{nft.contract_address.slice(-8)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Indicator */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-green-700 font-medium">
                          Successfully Claimed On-Chain
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Persistent across sessions
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimedNFTDisplay;
