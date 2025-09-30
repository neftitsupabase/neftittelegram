import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { referralService, ReferralData } from '@/services/ReferralService';
import { useAuthState } from './useAuthState';

export function useReferral() {

  const { walletAddress, isAuthenticated } = useAuthState();

  const [referralData, setReferralData] = useState<ReferralData>({
    code: '',
    link: '',
    count: 0,
    rewards: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // track mounted state to prevent updates on unmounted component
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadReferralData = useCallback(async () => {
    if (!walletAddress || !isAuthenticated) {
      setReferralData({
        code: '',
        link: '',
        count: 0,
        rewards: 0,
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Loading referral data for wallet:', walletAddress);
      const data = await referralService.getReferralData(walletAddress);
      if (mountedRef.current) {
        setReferralData(data);
      }
      console.log('Referral data loaded:', data);
    } catch (error) {
      console.error('Error loading referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [walletAddress, isAuthenticated]);

  // Load data whenever wallet changes or connects
  useEffect(() => {
    loadReferralData();
  }, [loadReferralData]);

  // Open/close modal and trigger fresh data load when opening
  const toggleModal = useCallback(() => {
    setIsModalOpen(prev => {
      const nextState = !prev;
      if (nextState && walletAddress) {
        loadReferralData();
      }
      return nextState;
    });
  }, [walletAddress, loadReferralData]);

  // Explicit helpers to avoid double-toggling issues
  const openModal = useCallback(() => {
    setIsModalOpen(true);
    if (walletAddress) {
      loadReferralData();
    }
  }, [walletAddress, loadReferralData]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const copyReferralLink = useCallback(async () => {
    if (!referralData.link) {
      toast.error('Referral link not available');
      return;
    }
    try {
      await navigator.clipboard.writeText(referralData.link);
      toast.success('Referral link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy. Please try again.');
      console.error('Failed to copy: ', error);
    }
  }, [referralData.link]);

  const processReferral = useCallback(
    async (referrerWallet: string) => {
      console.log('🎯 useReferral: Starting referral process...', { referrerWallet, walletAddress, isAuthenticated });

      if (!walletAddress || !isAuthenticated) {
        console.log('❌ useReferral: Wallet not connected or not authenticated');
        toast.error('Please connect your wallet first');
        return false;
      }

      if (referrerWallet === walletAddress) {
        console.log('❌ useReferral: Self-referral attempt blocked');
        toast.error('You cannot refer yourself');
        return false;
      }

      try {
        console.log('🚀 useReferral: Calling referralService.processReferral...');
        const success = await referralService.processReferral(
          referrerWallet,
          walletAddress
        );

        console.log('📊 useReferral: Process referral result:', success);

        if (success) {
          console.log('✅ useReferral: Referral processed successfully, refreshing data...');
          toast.success('Referral processed successfully! Rewards have been distributed.');
          await loadReferralData(); // refresh after reward
          return true;
        } else {
          console.log('❌ useReferral: Referral processing failed');
          toast.error('Referral already processed or failed');
          return false;
        }
      } catch (error) {
        console.error('💥 useReferral: Error processing referral:', error);
        toast.error('Error processing referral');
        return false;
      }
    },
    [walletAddress, isAuthenticated, loadReferralData]
  );

  const validateReferralCode = useCallback(async (referralCode: string) => {
    try {
      console.log('🎯 useReferral: Starting validation for code:', referralCode);
      const result = await referralService.validateReferralCode(referralCode);
      console.log('🎯 useReferral: Validation result:', result);

      if (result.valid && result.referrerWallet) {
        console.log('✅ useReferral: Valid referral code, referrer:', result.referrerWallet);
        return result.referrerWallet;
      } else {
        console.log('❌ useReferral: Invalid referral code');
        return null;
      }
    } catch (error) {
      console.error('💥 useReferral: Error validating referral code:', error);
      return null;
    }
  }, []);

  return {
    referralData,
    isModalOpen,
    isLoading,
    toggleModal,
    openModal,
    closeModal,
    copyReferralLink,
    processReferral,
    validateReferralCode,
    refreshData: loadReferralData
  };
}
