import { useCallback } from 'react';
import { useAuthState } from '@/hooks/useAuthState';
import offChainStakingService from '@/services/EnhancedStakingService';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export const useTokenOperations = () => {
  const { walletAddress } = useAuthState();

  // Stake tokens with optimistic balance updates
  const stakeTokens = useCallback(async (amount: number) => {
    if (!walletAddress || amount <= 0) return { success: false, message: 'Invalid parameters' };

    try {
      console.log('🔄 [TokenOperations] Staking tokens:', amount);
      
      const result = await offChainStakingService.stakeTokens(walletAddress, amount);
      
      if (result.success) {
        toast.success(`Successfully staked ${amount} NEFT tokens!`);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        // Emit balance update event for other components
        window.dispatchEvent(new CustomEvent('balance-updated', { 
          detail: { type: 'token-stake', amount } 
        }));
        
        return { success: true, message: 'Tokens staked successfully' };
      } else {
        throw new Error(result.message || 'Token staking failed');
      }
    } catch (error) {
      console.error('❌ [TokenOperations] Token staking failed:', error);
      toast.error('Failed to stake tokens. Please try again.');
      return { success: false, message: 'Token staking failed' };
    }
  }, [walletAddress]);

  // Unstake tokens with optimistic balance updates
  const unstakeTokens = useCallback(async (amount: number) => {
    if (!walletAddress || amount <= 0) return { success: false, message: 'Invalid parameters' };

    try {
      console.log('🔄 [TokenOperations] Unstaking tokens:', amount);
      
      const result = await offChainStakingService.unstakeTokens(walletAddress, amount.toString());
      
      if (result.success) {
        toast.success(`Successfully unstaked ${amount} NEFT tokens!`);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        // Emit balance update event for other components
        window.dispatchEvent(new CustomEvent('balance-updated', { 
          detail: { type: 'token-unstake', amount } 
        }));
        
        return { success: true, message: 'Tokens unstaked successfully' };
      } else {
        throw new Error(result.message || 'Token unstaking failed');
      }
    } catch (error) {
      console.error('❌ [TokenOperations] Token unstaking failed:', error);
      toast.error('Failed to unstake tokens. Please try again.');
      return { success: false, message: 'Token unstaking failed' };
    }
  }, [walletAddress]);

  return {
    // Token Operations
    stakeTokens,
    unstakeTokens
  };
};

export default useTokenOperations;
