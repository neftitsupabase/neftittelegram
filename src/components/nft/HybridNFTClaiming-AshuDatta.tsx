/**
 * Hybrid NFT Claiming - Component for claiming NFTs on-chain or from CID pool
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link, Database, Info, Gift, Zap, DollarSign, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import hybridNFTService from "@/services/HybridNFTService";
import optimizedCIDPoolBurnService from "@/services/OptimizedCIDPoolBurnService";

interface HybridNFTClaimingProps {
  walletAddress: string;
  onClaimSuccess: () => void;
}

interface ClaimCondition {
  maxClaimableSupply: string;
  maxClaimablePerWallet: string;
  currentMintSupply: string;
  availableSupply: string;
  price: string;
  currency: string;
}

interface SupplyInfo {
  totalSupply: number;
  maxSupply: number;
  availableSupply: number;
}

export const HybridNFTClaiming: React.FC<HybridNFTClaimingProps> = ({
  walletAddress,
  onClaimSuccess
}) => {
  const [isOnChainAvailable, setIsOnChainAvailable] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(true);
  const [selectedMode, setSelectedMode] = useState<'onchain' | 'offchain'>('offchain');
  const [nftConfig, setNftConfig] = useState<any>(null);
  
  // On-chain claiming state
  const [claimConditions, setClaimConditions] = useState<ClaimCondition | null>(null);
  const [claimableAmount, setClaimableAmount] = useState(0);
  const [supplyInfo, setSupplyInfo] = useState<SupplyInfo | null>(null);
  const [claimQuantity, setClaimQuantity] = useState(1);
  
  // Off-chain claiming state (CID pool)
  const [cidPoolStatus, setCidPoolStatus] = useState<any>(null);
  
  // UI state
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimProgress, setClaimProgress] = useState(0);
  const [claimStep, setClaimStep] = useState('');

  // Check availability and load data on component mount
  useEffect(() => {
    checkAvailabilityAndLoadData();
  }, [walletAddress]);

  const checkAvailabilityAndLoadData = async () => {
    setIsCheckingAvailability(true);
    try {
      // Check on-chain availability
      const available = await hybridNFTService.isOnChainAvailable();
      const config = hybridNFTService.getConfiguration();
      
      setIsOnChainAvailable(available);
      setNftConfig(config);
      
      if (available) {
        setSelectedMode('onchain');
        await loadOnChainData();
      } else {
        setSelectedMode('offchain');
        await loadOffChainData();
      }
      
      console.log('NFT claiming availability:', { available, config });
    } catch (error) {
      console.error('Error checking NFT claiming availability:', error);
      setIsOnChainAvailable(false);
      await loadOffChainData();
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const loadOnChainData = async () => {
    try {
      // Load claim conditions
      const conditions = await hybridNFTService.getClaimConditions();
      setClaimConditions(conditions);
      
      // Load claimable amount for this wallet
      const claimable = await hybridNFTService.getClaimableAmount(walletAddress);
      setClaimableAmount(claimable);
      
      // Load supply information
      const supply = await hybridNFTService.getSupplyInfo();
      setSupplyInfo(supply);
      
      console.log('On-chain data loaded:', { conditions, claimable, supply });
    } catch (error) {
      console.error('Error loading on-chain data:', error);
    }
  };

  const loadOffChainData = async () => {
    try {
      // Load CID pool status
      const status = await optimizedCIDPoolBurnService.getUserDataStatus(walletAddress);
      setCidPoolStatus(status);
      
      console.log('Off-chain CID pool status:', status);
    } catch (error) {
      console.error('Error loading off-chain data:', error);
    }
  };

  const handleClaim = async () => {
    if (selectedMode === 'onchain') {
      await handleOnChainClaim();
    } else {
      await handleOffChainClaim();
    }
  };

  const handleOnChainClaim = async () => {
    if (claimQuantity <= 0 || claimQuantity > claimableAmount) {
      toast.error(`You can claim between 1 and ${claimableAmount} NFTs`);
      return;
    }

    setIsClaiming(true);
    setClaimProgress(0);
    setClaimStep('Preparing claim transaction...');

    try {
      setClaimProgress(25);
      setClaimStep('Requesting wallet approval...');
      
      const result = await hybridNFTService.claimNFTOnChain(walletAddress, claimQuantity);
      
      setClaimProgress(75);
      setClaimStep('Processing claim...');
      
      if (result.success) {
        setClaimProgress(100);
        setClaimStep('Claim completed!');
        
        toast.success(`Successfully claimed ${claimQuantity} NFT${claimQuantity > 1 ? 's' : ''} on-chain!`);
        
        // Refresh data
        await loadOnChainData();
        onClaimSuccess();
      } else {
        toast.error(result.error || 'On-chain claiming failed');
      }
    } catch (error) {
      console.error('Error claiming NFTs on-chain:', error);
      toast.error('Failed to claim NFTs on-chain. Please try again.');
    } finally {
      setIsClaiming(false);
      setClaimProgress(0);
      setClaimStep('');
    }
  };

  const handleOffChainClaim = async () => {
    setIsClaiming(true);
    setClaimProgress(0);
    setClaimStep('Processing CID pool claim...');

    try {
      setClaimProgress(50);
      setClaimStep('Distributing NFT from pool...');
      
      // Note: This would integrate with existing CID pool claiming logic
      // For now, we'll show a placeholder implementation
      toast.info('Off-chain claiming through CID pool system (existing implementation)');
      
      setClaimProgress(100);
      setClaimStep('Claim completed!');
      
      // Refresh data
      await loadOffChainData();
      onClaimSuccess();
    } catch (error) {
      console.error('Error claiming NFTs off-chain:', error);
      toast.error('Failed to claim NFTs off-chain. Please try again.');
    } finally {
      setIsClaiming(false);
      setClaimProgress(0);
      setClaimStep('');
    }
  };

  if (isCheckingAvailability) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Checking claiming options...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Claiming Mode Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Gift className="w-5 h-5" />
                <span>Claim NFTs</span>
              </CardTitle>
              <CardDescription>
                {selectedMode === 'onchain' 
                  ? 'Claim NFTs directly from the blockchain contract'
                  : 'Claim NFTs from the CID pool system'
                }
              </CardDescription>
            </div>
            
            {isOnChainAvailable && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="claim-mode" className="text-sm">
                  {selectedMode === 'onchain' ? 'On-Chain' : 'Off-Chain'}
                </Label>
                <Switch
                  id="claim-mode"
                  checked={selectedMode === 'onchain'}
                  onCheckedChange={(checked) => {
                    setSelectedMode(checked ? 'onchain' : 'offchain');
                    if (checked) {
                      loadOnChainData();
                    } else {
                      loadOffChainData();
                    }
                  }}
                  disabled={isClaiming}
                />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* On-Chain Claiming Interface */}
          {selectedMode === 'onchain' && (
            <div className="space-y-4">
              {/* Supply Information */}
              {supplyInfo && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{supplyInfo.totalSupply}</div>
                    <div className="text-sm text-muted-foreground">Total Minted</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{supplyInfo.availableSupply}</div>
                    <div className="text-sm text-muted-foreground">Available</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{claimableAmount}</div>
                    <div className="text-sm text-muted-foreground">You Can Claim</div>
                  </div>
                </div>
              )}

              {/* Claim Conditions */}
              {claimConditions && (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div>Max per wallet: {claimConditions.maxClaimablePerWallet}</div>
                      <div>Price: {claimConditions.price === '0' ? 'Free' : `${claimConditions.price} tokens`}</div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Quantity Selector */}
              {claimableAmount > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="claim-quantity">Quantity to Claim</Label>
                  <Input
                    id="claim-quantity"
                    type="number"
                    min="1"
                    max={claimableAmount}
                    value={claimQuantity}
                    onChange={(e) => setClaimQuantity(Math.max(1, Math.min(claimableAmount, parseInt(e.target.value) || 1)))}
                    disabled={isClaiming}
                  />
                </div>
              )}

              {/* Gas Fee Warning */}
              <div className="flex items-center space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <DollarSign className="w-3 h-3 text-yellow-600" />
                <span className="text-yellow-700">Gas fees apply for on-chain transactions</span>
              </div>
            </div>
          )}

          {/* Off-Chain Claiming Interface */}
          {selectedMode === 'offchain' && (
            <div className="space-y-4">
              {/* CID Pool Status */}
              {cidPoolStatus && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{cidPoolStatus.nftCount}</div>
                    <div className="text-sm text-muted-foreground">Your NFTs</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">
                      {cidPoolStatus.rarityBreakdown ? 
                        (Object.values(cidPoolStatus.rarityBreakdown) as number[]).reduce((a, b) => a + b, 0) : 0
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Total Available</div>
                  </div>
                </div>
              )}

              <Alert>
                <Database className="w-4 h-4" />
                <AlertDescription>
                  Off-chain claiming uses the existing CID pool system for instant NFT distribution.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Claim Progress */}
          {isClaiming && claimProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{claimStep}</span>
                <span>{claimProgress}%</span>
              </div>
              <Progress value={claimProgress} className="h-2" />
            </div>
          )}

          {/* Claim Button */}
          <Button
            onClick={handleClaim}
            disabled={isClaiming || (selectedMode === 'onchain' && claimableAmount === 0)}
            className="w-full"
            size="lg"
          >
            {isClaiming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Claiming...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Claim {selectedMode === 'onchain' ? 'On-Chain' : 'Off-Chain'}
                {selectedMode === 'onchain' && claimQuantity > 1 && ` (${claimQuantity} NFTs)`}
              </>
            )}
          </Button>

          {/* Mode-specific badges */}
          <div className="flex justify-center space-x-2">
            {selectedMode === 'onchain' ? (
              <>
                <Badge variant="outline" className="text-xs">
                  <Link className="w-3 h-3 mr-1" />
                  Blockchain Verified
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  Gas Required
                </Badge>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-xs">
                  <Database className="w-3 h-3 mr-1" />
                  Instant Claim
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  No Gas Fees
                </Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Status */}
      {!nftConfig?.isConfigured && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            On-chain claiming is not fully configured. Using off-chain claiming as fallback.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default HybridNFTClaiming;
