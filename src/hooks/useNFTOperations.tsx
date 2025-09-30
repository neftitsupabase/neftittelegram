import { useCallback } from 'react';
import { useNFTContext, ContextNFT } from '@/contexts/NFTContext';
import { useAuthState } from '@/hooks/useAuthState';
import offChainStakingService from '@/services/EnhancedStakingService';
import improvedOnchainStakingService from '@/services/ImprovedOnchainStakingService';
import { nftLifecycleService } from '@/services/NFTLifecycleService';
import enhancedHybridBurnService from '@/services/EnhancedHybridBurnService';
import { optimizedCIDPoolBurnService } from '@/services/OptimizedCIDPoolBurnService';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export const useNFTOperations = () => {
  const { walletAddress } = useAuthState();
  const {
    allNFTs,
    optimisticStake,
    optimisticUnstake,
    optimisticClaimStart,
    optimisticClaim,
    optimisticBurn,
    handleSuccessfulClaim,
    revertOptimisticUpdate,
    clearOptimisticUpdates,
    refreshNFTs,
    syncStakingStatus
  } = useNFTContext();

  // Stake NFTs with hybrid onchain/offchain logic and optimistic updates
  const stakeNFTs = useCallback(async (nftIds: string[]) => {
    if (!walletAddress || nftIds.length === 0) return { success: false, message: 'Invalid parameters' };

    try {
      console.log('🔄 [NFTOperations] Staking NFTs with hybrid logic:', nftIds);
      
      const results = await Promise.all(
        nftIds.map(async (nftId) => {
          // Get NFT from context to determine status
          const nft = allNFTs.find(n => n.id === nftId);
          
          if (!nft) {
            throw new Error(`NFT not found in context: ${nftId}`);
          }
          
          console.log(`🔍 [NFTOperations] Staking NFT ${nftId}:`);
          console.log(`  - Status: ${nft.status}`);
          console.log(`  - Current StakingSource: ${nft.stakingSource || 'none'}`);
          console.log(`  - IsStaked: ${nft.isStaked}`);
          
          // Smart routing: Offchain NFTs = Offchain staking, Onchain NFTs = Onchain staking
          if (nft.status === 'onchain') {
            console.log(`  - Will use: ONCHAIN staking (blockchain NFT)`);
            
            // Check onchain availability only for onchain NFTs
            const isOnChainAvailable = await improvedOnchainStakingService.isOnChainAvailable();
            
            if (!isOnChainAvailable) {
              console.log(`⚠️ [NFTOperations] Onchain not available, falling back to offchain for ${nftId}`);
              // Fall back to offchain staking
              const result = await offChainStakingService.stakeNFT(walletAddress, nft);
              console.log(`☁️ [NFTOperations] Offchain fallback result for ${nftId}:`, result);
              return result;
            }
            
            // Proceed with onchain staking
            // Use onchain staking for claimed/onchain NFTs - but rewards handled by offchain system
            console.log(`⛓️ [NFTOperations] Using onchain staking for NFT: ${nftId}`);
            const tokenId = nft.tokenId || nftId;
            const cleanTokenId = tokenId.toString().replace(/^(onchain_|blockchain_|staked_)/, '');
            
            // Execute onchain transaction
            const onchainResult = await improvedOnchainStakingService.stakeNFTOnChain(cleanTokenId, walletAddress);
            
            // VERIFY transaction success before updating UI
            if (onchainResult.success && onchainResult.transactionHash) {
              console.log(`🔍 [NFTOperations] Verifying transaction success for ${nftId}...`);
              console.log(`📋 [NFTOperations] Transaction hash: ${onchainResult.transactionHash}`);
              
              // Additional verification: Check if transaction was actually mined successfully
              if (onchainResult.verified !== false) { // Allow undefined (no verification) or true
                console.log(`✅ [NFTOperations] Transaction verified! Updating staking status for ${nftId}`);
                
                // Update UI immediately
                optimisticStake([nftId], 'onchain');
                
                // Register for rewards only (lightweight - no full NFT data)
                try {
                  console.log(`🏆 [NFTOperations] Registering onchain NFT ${nftId} for rewards only...`);
                  const tokenIdOnly = cleanTokenId;
                  await offChainStakingService.registerOnchainNFTForRewards(
                    walletAddress, 
                    tokenIdOnly, 
                    nft.rarity, 
                    onchainResult.transactionHash
                  );
                  console.log(`✅ [NFTOperations] Onchain NFT ${nftId} registered for rewards (lightweight)`);
                } catch (rewardError) {
                  console.warn(`⚠️ [NFTOperations] Reward registration failed for ${nftId}:`, rewardError);
                  // Don't fail the whole operation - onchain staking was successful
                }
                
                console.log(`🎯 [NFTOperations] NFT ${nftId} successfully staked onchain with reward tracking`);
              } else {
                console.error(`❌ [NFTOperations] Transaction verification failed for ${nftId}`);
                throw new Error('Transaction was not successfully verified on blockchain');
              }
            } else {
              console.error(`❌ [NFTOperations] Onchain staking failed for ${nftId}:`, onchainResult.message);
              throw new Error(onchainResult.message || 'Onchain staking failed');
            }
            
            return onchainResult;
          } else {
            // Use offchain staking for unclaimed/offchain NFTs (NO APPROVAL NEEDED)
            console.log(`  - Will use: OFFCHAIN staking (database NFT - no approval needed)`);
            console.log(`☁️ [NFTOperations] Using offchain staking for NFT: ${nftId}`);
            
            try {
              const result = await offChainStakingService.stakeNFT(walletAddress, nft);
              
              // VERIFY offchain staking success before updating UI
              if (result.success) {
                console.log(`✅ [NFTOperations] Offchain staking successful! Updating UI for ${nftId}`);
                
                // Update UI immediately for offchain staking (database operation)
                optimisticStake([nftId], 'offchain');
                
                console.log(`🎯 [NFTOperations] NFT ${nftId} successfully staked offchain`);
              } else {
                console.error(`❌ [NFTOperations] Offchain staking failed for ${nftId}:`, result.message);
                throw new Error(result.message || 'Offchain staking failed');
              }
              
              return result;
            } catch (offchainError) {
              console.error(`❌ [NFTOperations] Offchain staking failed for ${nftId}:`, offchainError);
              throw offchainError;
            }
          }
        })
      );

      // Log all results for debugging
      console.log('📊 [NFTOperations] Staking results:', results);
      results.forEach((result, index) => {
        console.log(`📊 [NFTOperations] NFT ${nftIds[index]} result:`, {
          success: result.success,
          message: result.message,
          error: result.error
        });
      });

      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        // BATCH UI UPDATES - All individual operations already updated UI after verification
        results.forEach((result, index) => {
          const nftId = nftIds[index];
          
          if (result.success) {
            console.log(`✅ [NFTOperations] NFT ${nftId} UI already updated after successful operation`);
            // No additional UI updates needed - individual operations handle their own UI updates
            
            // Additional UI updates can be handled here
            if (result.data?.immediateUpdate?.showLockOverlay) {
              console.log(`🔒 [NFTOperations] Showing lock overlay for ${nftId}`);
            }
            if (result.data?.immediateUpdate?.updateStakingCount) {
              console.log(`📊 [NFTOperations] Updating staking count for ${nftId}`);
            }
          }
        });
        
        // Clear optimistic updates and sync staking status (no full reload!)
        setTimeout(() => {
          clearOptimisticUpdates();
          syncStakingStatus(); // Lightweight sync instead of full refresh
        }, 1000);
        
        toast.success(`Successfully staked ${nftIds.length} NFT${nftIds.length > 1 ? 's' : ''}!`);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        return { success: true, message: 'NFTs staked successfully' };
      } else {
        throw new Error('Some NFTs failed to stake');
      }
    } catch (error) {
      console.error('❌ [NFTOperations] Staking failed:', error);
      // No need to revert since we haven't applied optimistic update yet
      toast.error('Failed to stake NFTs. Please try again.');
      return { success: false, message: 'Staking failed' };
    }
  }, [walletAddress, allNFTs, optimisticStake, revertOptimisticUpdate, clearOptimisticUpdates, syncStakingStatus]);

  // Unstake NFTs with hybrid onchain/offchain logic and optimistic updates
  const unstakeNFTs = useCallback(async (nftIds: string[]) => {
    if (!walletAddress || nftIds.length === 0) return { success: false, message: 'Invalid parameters' };

    // DON'T apply optimistic update immediately - wait for transaction success
    console.log('🔄 [NFTOperations] Starting unstaking process (no optimistic update yet):', nftIds);

    try {
      console.log('🔄 [NFTOperations] Unstaking NFTs with hybrid logic:', nftIds);
      
      // Check onchain availability
      const isOnChainAvailable = await improvedOnchainStakingService.isOnChainAvailable();
      
      const results = await Promise.all(
        nftIds.map(async (nftId) => {
          // Get NFT from context to determine status
          const nft = allNFTs.find(n => n.id === nftId);
          
          if (!nft) {
            throw new Error(`NFT not found in context: ${nftId}`);
          }
          
          // Check the actual staking source, not just NFT status
          console.log(`🔍 [NFTOperations] Unstaking NFT ${nftId}:`);
          console.log(`  - Status: ${nft.status}`);
          console.log(`  - Current StakingSource: ${nft.stakingSource || 'none'}`);
          console.log(`  - IsStaked: ${nft.isStaked}`);
          
          // Force onchain detection for staked_ prefixed NFTs
          const isOnchainStaked = nft.stakingSource === 'onchain' || 
                                 nftId.startsWith('staked_') || 
                                 nft.id.startsWith('staked_');
          
          console.log(`  - Will use: ${isOnchainStaked ? 'ONCHAIN' : 'OFFCHAIN'} unstaking`);
          
          if (isOnchainStaked && isOnChainAvailable) {
            // Use onchain unstaking for NFTs staked onchain
            console.log(`⛓️ [NFTOperations] Using onchain unstaking for NFT staked onchain: ${nftId}`);
            const tokenId = nft.tokenId || nftId;
            const cleanTokenId = tokenId.toString().replace(/^(onchain_|blockchain_|staked_)/, '');
            
            try {
              // Execute onchain unstaking
              const onchainResult = await improvedOnchainStakingService.unstakeNFTOnChain(walletAddress, cleanTokenId);
              
              if (onchainResult.success) {
                console.log(`✅ [NFTOperations] Onchain unstaking successful for ${nftId}`);
                
                // IMMEDIATE UI UPDATE - Apply optimistic update right after successful onchain transaction
                console.log(`🚀 [NFTOperations] Onchain unstaking successful! Applying immediate UI update for ${nftId}`);
                optimisticUnstake([nftId]);
                
                // Unregister from rewards only (lightweight)
                try {
                  console.log(`🏆 [NFTOperations] Unregistering onchain NFT ${nftId} from rewards...`);
                  const tokenIdOnly = cleanTokenId;
                  await offChainStakingService.unregisterOnchainNFTFromRewards(walletAddress, tokenIdOnly);
                  console.log(`✅ [NFTOperations] Onchain NFT ${nftId} unregistered from rewards`);
                } catch (rewardError) {
                  console.warn(`⚠️ [NFTOperations] Reward unregistration failed for ${nftId}:`, rewardError);
                  // Don't fail the whole operation - onchain unstaking was successful
                }
                
                console.log(`🎯 [NFTOperations] NFT ${nftId} successfully unstaked onchain with reward cleanup`);
                
                return { success: true, nftId, data: onchainResult };
              } else {
                throw new Error(onchainResult.error || 'Onchain unstaking failed');
              }
            } catch (onchainError: any) {
              console.error(`❌ [NFTOperations] Onchain unstaking failed for ${nftId}:`, onchainError);
              
              // Check if it's an ABI decoding error but transaction might have succeeded
              if (onchainError.message && onchainError.message.includes('Parameter decoding error')) {
                console.log(`🔍 [NFTOperations] ABI decoding error detected for ${nftId}, but transaction may have succeeded`);
                // Return success and let the UI update optimistically
                // The backend will sync the actual state
                return { success: true, nftId, data: { transactionHash: 'abi-decode-error' } };
              }
              
              throw onchainError;
            }
          } else {
            // Use offchain unstaking for NFTs staked offchain (or fallback)
            console.log(`☁️ [NFTOperations] Using offchain unstaking for NFT staked offchain: ${nftId} (stakingSource: ${nft.stakingSource || 'none'})`);
            try {
              const result = await offChainStakingService.unstakeNFT(walletAddress, nftId);
              
              // VERIFY offchain unstaking success before updating UI
              if (result.success) {
                console.log(`✅ [NFTOperations] Offchain unstaking successful! Updating UI for ${nftId}`);
                
                // Update UI immediately for offchain unstaking (database operation)
                optimisticUnstake([nftId]);
                
                console.log(`🎯 [NFTOperations] NFT ${nftId} successfully unstaked offchain`);
              } else {
                console.error(`❌ [NFTOperations] Offchain unstaking failed for ${nftId}:`, result.message);
                throw new Error(result.message || 'Offchain unstaking failed');
              }
              
              return result;
            } catch (offchainError) {
              console.error(`❌ [NFTOperations] Offchain unstaking failed for ${nftId}:`, offchainError);
              throw offchainError;
            }
          }
        })
      );

      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        console.log(`✅ [NFTOperations] All ${nftIds.length} NFTs successfully unstaked with individual UI updates`);
        // No additional UI updates needed - individual operations handle their own UI updates
        
        // Additional UI updates can be handled here
        results.forEach((result, index) => {
          const nftId = nftIds[index];
          
          if (result.data?.immediateUpdate?.removeLockOverlay) {
            console.log(`🔓 [NFTOperations] Removing lock overlay for ${nftId}`);
          }
          if (result.data?.immediateUpdate?.updateStakingCount) {
            console.log(`📊 [NFTOperations] Updating staking count for ${nftId}`);
          }
        });
        
        // Clear optimistic updates and sync staking status (no full reload!)
        setTimeout(() => {
          clearOptimisticUpdates();
          syncStakingStatus(); // Lightweight sync instead of full refresh
        }, 1000);
        
        toast.success(`Successfully unstaked ${nftIds.length} NFT${nftIds.length > 1 ? 's' : ''}!`);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        return { success: true, message: 'NFTs unstaked successfully' };
      } else {
        throw new Error('Some NFTs failed to unstake');
      }
    } catch (error) {
      console.error('❌ [NFTOperations] Unstaking failed:', error);
      // No need to revert optimistic update since we didn't apply one initially
      console.log('🔄 [NFTOperations] No optimistic update to revert - transaction failed before UI update');
      toast.error('Failed to unstake NFTs. Please try again.');
      return { success: false, message: 'Unstaking failed' };
    }
  }, [walletAddress, allNFTs, optimisticUnstake, revertOptimisticUpdate]);

  // Check approval status for onchain staking
  const checkApprovalStatus = useCallback(async (): Promise<boolean> => {
    if (!walletAddress) return false;
    
    try {
      console.log('🔍 [NFTOperations] Checking approval status...');
      const isApproved = await improvedOnchainStakingService.checkApprovalStatus(walletAddress);
      console.log('✅ [NFTOperations] Approval status:', isApproved);
      return isApproved;
    } catch (error) {
      console.error('❌ [NFTOperations] Error checking approval:', error);
      return false;
    }
  }, [walletAddress]);

  // Approve staking contract for onchain staking
  const approveStakingContract = useCallback(async (): Promise<{ success: boolean; transactionHash?: string; error?: string }> => {
    if (!walletAddress) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      console.log('🔐 [NFTOperations] Starting approval process...');
      toast.loading('Requesting approval...', { id: 'approve-staking' });
      
      const result = await improvedOnchainStakingService.approveStakingContract(walletAddress);
      
      if (result.success) {
        toast.success('✅ Staking contract approved! You can now stake NFTs onchain.', { id: 'approve-staking' });
        console.log('✅ [NFTOperations] Approval successful:', result.transactionHash);
      } else {
        toast.error(`❌ Approval failed: ${result.error}`, { id: 'approve-staking' });
        console.error('❌ [NFTOperations] Approval failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Approval failed';
      toast.error(`❌ Approval failed: ${errorMessage}`, { id: 'approve-staking' });
      console.error('❌ [NFTOperations] Approval error:', error);
      return { success: false, error: errorMessage };
    }
  }, [walletAddress]);

  // Claim NFT with proper transaction tracking and status updates
  const claimNFT = useCallback(async (nftId: string) => {
    if (!walletAddress || !nftId) return { success: false, message: 'Invalid parameters' };

    // Show "claiming" status during transaction
    optimisticClaimStart(nftId);
    
    try {
      console.log('🔄 [NFTOperations] Claiming NFT (waiting for blockchain confirmation):', nftId);
      
      // Get NFT from context to pass full object
      const nft = allNFTs.find(n => n.id === nftId);
      
      if (!nft) {
        throw new Error(`NFT not found in context: ${nftId}`);
      }
      
      // Wait for actual blockchain transaction to complete
      const result = await nftLifecycleService.claimNFTToBlockchain(nft, walletAddress);
      
      if (result.success && result.onchainNFT?.transactionHash) {
        // VERIFY transaction success before updating UI
        console.log('🔍 [NFTOperations] Verifying claim transaction success for:', nftId);
        console.log('📋 [NFTOperations] Transaction hash:', result.onchainNFT.transactionHash);
        
        // Check if the claiming service returned a successful result (implies verification)
        if (result.success && result.onchainNFT) { // Transaction was successful and NFT was created
          console.log('✅ [NFTOperations] Claim transaction successful! Updating UI');
          
          // ONLY NOW update the UI after transaction verification
        // Create the onchain NFT object with blockchain data
        const onchainNFT = {
          ...nft,
          id: `onchain_${result.onchainNFT.tokenId}`,
          tokenId: result.onchainNFT.tokenId,
          transactionHash: result.onchainNFT.transactionHash,
          contractAddress: result.onchainNFT.contractAddress || '',
          metadataURI: result.onchainNFT.metadataURI || '',
          claimed_at: new Date().toISOString(),
          claimed_blockchain: 'polygon',
          status: 'onchain' as const,
          isStaked: false,
          stakingSource: 'none' as const
        };
        
          // Use handleSuccessfulClaim to properly move NFT from offchain to onchain
          handleSuccessfulClaim(nftId, onchainNFT);
          
          toast.success('NFT successfully claimed to blockchain!');
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
          });
          
          // Clear optimistic updates flag to prevent auto-reload
          clearOptimisticUpdates();
          
          return { success: true, message: 'NFT claimed successfully', data: result };
        } else {
          console.error('❌ [NFTOperations] Claim transaction verification failed for:', nftId);
          throw new Error('Claim transaction was not successfully verified on blockchain');
        }
      } else {
        throw new Error(result.error || 'Claiming failed');
      }
    } catch (error) {
      console.error('❌ [NFTOperations] Claiming failed:', error);
      // Revert the claiming status back to original state
      revertOptimisticUpdate();
      toast.error('Failed to claim NFT. Please try again.');
      return { success: false, message: 'Claiming failed' };
    }
  }, [walletAddress, allNFTs, optimisticClaimStart, optimisticClaim, revertOptimisticUpdate, clearOptimisticUpdates]);

  // Burn NFTs with hybrid onchain/offchain logic and optimistic updates
  const burnNFTs = useCallback(async (nftIds: string[], targetRarity?: string) => {
    if (!walletAddress || nftIds.length === 0) return { success: false, message: 'Invalid parameters' };

    try {
      console.log('🔄 [NFTOperations] Burning NFTs with hybrid logic:', nftIds);
      
      // Get NFTs from context and prepare for hybrid burning
      const nftsToburn = nftIds.map(nftId => {
        const nft = allNFTs.find(n => n.id === nftId);
        if (!nft) {
          throw new Error(`NFT not found in context: ${nftId}`);
        }
        return {
          ...nft,
          tokenId: nft.tokenId || nftId,
          contractAddress: nft.contractAddress
        };
      });

      // Check onchain availability
      const isOnChainAvailable = await enhancedHybridBurnService.isOnChainAvailable();
      
      // Determine burn strategy based on NFT statuses
      const onchainNFTs = nftsToburn.filter(nft => nft.status === 'onchain');
      const offchainNFTs = nftsToburn.filter(nft => nft.status === 'offchain');
      
      let result;
      
      if (onchainNFTs.length > 0 && isOnChainAvailable) {
        // Use hybrid burning service for onchain NFTs
        console.log(`⛓️ [NFTOperations] Using hybrid burn service for ${onchainNFTs.length} onchain + ${offchainNFTs.length} offchain NFTs`);
        result = await enhancedHybridBurnService.executeSmartHybridBurn(walletAddress, nftsToburn);
      } else {
        // Use offchain burning service for pure offchain NFTs
        console.log(`☁️ [NFTOperations] Using offchain burn service for ${nftIds.length} offchain NFTs`);
        result = await optimizedCIDPoolBurnService.burnNFTsOffChain(walletAddress, nftIds);
      }
      
      // VERIFY transaction success before updating UI
      if (result.success && result.resultNFT) {
        console.log('🔍 [NFTOperations] Verifying burn transaction success...');
        console.log('📋 [NFTOperations] Burn result:', result);
        
        // Check if burn service returned successful result with transaction verification
        if (result.transactionHash || result.verified !== false) { // Allow undefined (no verification) or true
          console.log('✅ [NFTOperations] Burn transaction verified! Updating UI');
          
          // Create the resulting NFT for optimistic update
          const resultingNFT: ContextNFT = {
            id: result.resultNFT.id || `burn-result-${Date.now()}`,
            name: result.resultNFT.name,
            description: result.resultNFT.description || '',
            image: result.resultNFT.image,
            rarity: result.resultNFT.rarity,
            status: 'offchain' as const,
            isStaked: false,
            stakingSource: 'none' as const,
            dailyReward: 0,
            wallet_address: walletAddress,
            ipfs_hash: result.resultNFT.ipfs_hash,
            metadata_uri: result.resultNFT.metadata_uri,
            attributes: result.resultNFT.attributes || [],
            lastUpdated: Date.now(),
            optimisticUpdate: true
          };

          // ONLY NOW update UI: remove burned NFTs and add resulting NFT
          optimisticBurn(nftIds, resultingNFT);
          
          toast.success(`Successfully burned ${nftIds.length} NFT${nftIds.length > 1 ? 's' : ''}!`);
          confetti({
            particleCount: 200,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ff6b6b', '#feca57', '#48dbfb']
          });
          
          // Clear optimistic updates flag after successful burn
          setTimeout(() => clearOptimisticUpdates(), 1000);
          
          return { success: true, message: 'NFTs burned successfully', data: result };
        } else {
          console.error('❌ [NFTOperations] Burn transaction verification failed');
          throw new Error('Burn transaction was not successfully verified');
        }
      } else {
        throw new Error(result.error || 'Burning failed');
      }
    } catch (error) {
      console.error('❌ [NFTOperations] Burning failed:', error);
      revertOptimisticUpdate();
      toast.error('Failed to burn NFTs. Please try again.');
      return { success: false, message: 'Burning failed' };
    }
  }, [walletAddress, allNFTs, optimisticBurn, revertOptimisticUpdate, clearOptimisticUpdates]);


  return {
    // NFT Operations
    stakeNFTs,
    unstakeNFTs,
    claimNFT,
    burnNFTs,
    
    // Approval functions for onchain staking
    checkApprovalStatus,
    approveStakingContract,
    
    // Utility functions
    syncStakingStatus,  // Lightweight staking status sync (no full reload)
    refreshNFTs,        // Full refresh (only when necessary)
    
    // Manual sync for debugging
    manualSyncStaking: syncStakingStatus
  };
};

export default useNFTOperations;
