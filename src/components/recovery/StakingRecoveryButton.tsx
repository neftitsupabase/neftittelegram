import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthState } from '@/hooks/useAuthState';
import onchainStakingRecoveryService from '@/services/OnchainStakingRecoveryService';
import { useNFTContext } from '@/contexts/NFTContext';

interface StakingRecoveryButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export const StakingRecoveryButton: React.FC<StakingRecoveryButtonProps> = ({
  className = '',
  variant = 'outline',
  size = 'default'
}) => {
  const { walletAddress } = useAuthState();
  const { refreshNFTs } = useNFTContext();
  
  const [isChecking, setIsChecking] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    onchainStaked: number;
    databaseRecords: number;
    missing: number;
    missingDetails: any[];
  } | null>(null);

  const handleCheckMissingRecords = async () => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsChecking(true);
    try {
      console.log('🔍 Checking for missing staking records...');
      const result = await onchainStakingRecoveryService.checkForMissingRecords(walletAddress);
      setCheckResult(result);
      
      if (result.missing > 0) {
        toast.warning(`Found ${result.missing} NFTs staked on blockchain but missing from database`);
      } else {
        toast.success('All onchain staked NFTs are properly recorded in database');
      }
      
    } catch (error) {
      console.error('Error checking missing records:', error);
      toast.error('Failed to check missing records');
    } finally {
      setIsChecking(false);
    }
  };

  const handleRecoverRecords = async () => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsRecovering(true);
    try {
      console.log('🔄 Starting recovery of missing staking records...');
      const result = await onchainStakingRecoveryService.recoverMissingStakingRecords(walletAddress);
      
      if (result.success && result.recovered > 0) {
        toast.success(`Successfully recovered ${result.recovered} missing staking records!`);
        
        // Refresh NFT context to show updated staking status
        await refreshNFTs();
        
        // Clear check result to force re-check
        setCheckResult(null);
      } else if (result.recovered === 0) {
        toast.info('No missing records found to recover');
      } else {
        toast.error('Recovery completed with some errors');
      }
      
    } catch (error) {
      console.error('Error during recovery:', error);
      toast.error('Failed to recover missing records');
    } finally {
      setIsRecovering(false);
    }
  };

  if (!walletAddress) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Check Button */}
      <Button
        variant={variant}
        size={size}
        className={`flex items-center gap-2 ${className}`}
        onClick={handleCheckMissingRecords}
        disabled={isChecking || isRecovering}
      >
        {isChecking ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Info className="w-4 h-4" />
        )}
        {isChecking ? 'Checking...' : 'Check Missing Records'}
      </Button>

      {/* Results Display */}
      {checkResult && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-300">Onchain Staked:</span>
            <Badge variant="outline" className="text-blue-300 border-blue-500">
              {checkResult.onchainStaked}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-300">Database Records:</span>
            <Badge variant="outline" className="text-green-300 border-green-500">
              {checkResult.databaseRecords}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-300">Missing:</span>
            <Badge 
              variant="outline" 
              className={checkResult.missing > 0 ? "text-red-300 border-red-500" : "text-green-300 border-green-500"}
            >
              {checkResult.missing}
            </Badge>
          </div>

          {/* Missing Details */}
          {checkResult.missing > 0 && checkResult.missingDetails.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-slate-400 mb-1">Missing NFTs:</div>
              <div className="flex flex-wrap gap-1">
                {checkResult.missingDetails.map((nft, index) => (
                  <Badge key={index} variant="outline" className="text-xs text-red-300 border-red-500">
                    #{nft.tokenId}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recovery Button */}
          {checkResult.missing > 0 && (
            <Button
              variant="default"
              size="sm"
              className="mt-2 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRecoverRecords}
              disabled={isRecovering}
            >
              {isRecovering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Recovering...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Recover {checkResult.missing} Records
                </>
              )}
            </Button>
          )}

          {checkResult.missing === 0 && (
            <div className="flex items-center gap-2 mt-2 text-sm text-green-300">
              <CheckCircle className="w-4 h-4" />
              All records are in sync
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StakingRecoveryButton;
